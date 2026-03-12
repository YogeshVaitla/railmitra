/**
 * Seat Swap Sync Server — V1.0.0
 * 
 * Swap-only mode: only seat swap endpoints are active.
 * Other features (PNR, toilets, availability, utilities) are disabled
 * behind a 501 stub and will return in V2.
 */

import { PrismaClient } from '@prisma/client';
import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import {
    findSwapMatches,
} from './core-logic';

// V2 imports — kept for reference, disabled in V1
// import { calculateSeatConfidence, inferCoachType } from './core-logic';
// import { hashPNR, inferVacancy, parseIRCTCSMS } from './pnr-parser';
// import { detectTheftRisk, detectToiletQueue } from './smart-utilities';
import {
    logger,
    metrics,
    requestTelemetry,
    trackSSEConnect,
    trackSSEDisconnect,
    getSSEStats,
    recordMeshMetrics,
    recordSwapEngineRun,
    prismaQueryLogger,
    getHealthStatus,
} from './telemetry';

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// RM-SW-013: Rate limiting — max 20 requests per minute per IP on swap APIs
const swapLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    message: { error: 'Too many requests, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});
app.use('/api/swaps', swapLimiter);

// --- Telemetry middleware: logs every request + tracks latency ---
app.use(requestTelemetry);

// Deep health check — pings DB, checks memory, SSE load
app.get('/api/health', async (_req: express.Request, res: express.Response) => {
    const health = await getHealthStatus(prisma);
    const statusCode = health.status === 'unhealthy' ? 503 : 200;
    res.status(statusCode).json(health);
});

// --- Internal: Metrics Endpoint ---
app.get('/api/metrics', (_req: express.Request, res: express.Response) => {
    const snap = metrics.snapshot();
    const sseStats = getSSEStats();
    res.json({
        ...snap,
        sse: sseStats,
        uptime_seconds: Math.floor(process.uptime()),
        memory: process.memoryUsage(),
    });
});

// --- Telemetry: Receive P2P Mesh metrics from mobile clients ---
app.post('/api/telemetry/mesh', (req, res) => {
    try {
        recordMeshMetrics(req.body);
        res.json({ success: true });
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

// Friendly root endpoint so standard browser visits don't throw 404
app.get('/', (_req, res) => {
    res.send(`
        <html>
            <body style="font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background-color: #f9f9f9;">
                <h1 style="color: #ff6b35;">🚄 Seat Swap Sync Server v1.0.0</h1>
                <p>Swap-only mode active. Other features coming in V2.</p>
            </body>
        </html>
    `);
});

// ============================================================
// RM-SW-010: V2 ENDPOINTS — Disabled for V1, return 501
// ============================================================

const v2Stub = (_req: express.Request, res: express.Response) => {
    res.status(501).json({ error: 'This feature is coming in V2' });
};

app.post('/api/reports', v2Stub);
app.get('/api/seats/:seatId/confidence', v2Stub);
app.get('/api/trains/:trainNo/coaches/:coachId/confidence', v2Stub);
app.get('/api/classify/:classType/:highestSeat', v2Stub);

// --- SEAT SWAPS ---
// These endpoints are the OPTIONAL sync layer. The app works fully offline
// using the local swapStore + swapEngine + meshBridge. When internet is
// available, the app can sync with this server for broader discovery.

app.get('/api/debug/swaps', async (_req, res) => {
    try {
        const recentSwaps = await prisma.swapRequest.findMany({
            orderBy: { createdAt: 'desc' },
            take: 10
        });
        res.json(recentSwaps);
    } catch (err: any) {
        res.status(500).json({ error: err.message });
    }
});

// Register someone's wish to swap seats (with priority scoring)
app.post('/api/swaps', async (req, res) => {
    try {
        const { trainNo, userId, currentCoachId, currentSeatNo, currentSeatType, desiredSeatType, journeyDate, reason } = req.body;

        // RM-SW-013: Input validation
        if (!trainNo || !userId || !currentCoachId || !currentSeatType || !desiredSeatType || !journeyDate) {
            return res.status(400).json({ error: 'Missing required fields.' });
        }
        if (typeof currentSeatNo !== 'number' || currentSeatNo < 1 || currentSeatNo > 80) {
            return res.status(400).json({ error: 'currentSeatNo must be between 1 and 80.' });
        }
        if (typeof currentCoachId !== 'string' || currentCoachId.length > 4) {
            return res.status(400).json({ error: 'currentCoachId must be at most 4 characters.' });
        }
        if (currentSeatType === desiredSeatType) {
            return res.status(400).json({ error: 'currentSeatType and desiredSeatType cannot be the same.' });
        }

        // RM-SW-013: Max 3 active (OPEN or ACCEPTED) swap offers per user
        const activeCount = await prisma.swapRequest.count({
            where: { userId, status: { in: ['OPEN', 'ACCEPTED'] } },
        });
        if (activeCount >= 3) {
            return res.status(429).json({ error: 'Maximum 3 active swap offers per user. Cancel an existing one first.' });
        }

        logger.info(`[+] New swap offer received from ${userId.substring(0, 8)} for train ${trainNo} (${currentCoachId}-${currentSeatNo} -> ${desiredSeatType})`);

        // Duplicate check: same seat on same train+date can't have two active offers
        const existingOffer = await prisma.swapRequest.findFirst({
            where: {
                trainNo,
                journeyDate,
                currentCoachId,
                currentSeatNo,
                status: 'OPEN',
            },
        });
        if (existingOffer) {
            return res.status(409).json({ error: `Seat ${currentCoachId}/${currentSeatNo} already has an active swap offer on this train.` });
        }

        // Compute priority score based on reason
        const reasonBonuses: Record<string, number> = { elderly: 0.30, medical: 0.25, family: 0.15, preference: 0.05 };
        const priorityScore = 0.20 + (reasonBonuses[reason] || 0.05);

        const swap = await prisma.swapRequest.create({
            data: {
                trainNo,
                userId,
                currentCoachId,
                currentSeatNo,
                currentSeatType,
                desiredSeatType,
                journeyDate,
                reason: reason || 'preference',
                priorityScore,
                expiresAt: new Date(Date.now() + 6 * 60 * 60 * 1000), // 6 hours
            },
        });

        // Log the creation event
        await prisma.swapEvent.create({
            data: {
                swapId: swap.id,
                eventType: 'CREATED',
                actorId: userId,
                metadata: JSON.stringify({ reason, priorityScore }),
            },
        });

        // Try auto-matching immediately
        const matches = await findSwapMatches(trainNo, journeyDate);

        // Broadcast to SSE clients
        broadcastSSE(trainNo, journeyDate, { type: 'NEW_OFFER', swap });

        res.status(201).json({
            success: true,
            swapId: swap.id,
            priorityScore,
            immediateMatches: matches.length,
        });
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

// Browse all open swap offers for a train
app.get('/api/swaps/:trainNo/:journeyDate/browse', async (req, res) => {
    try {
        const { trainNo, journeyDate } = req.params;

        const offers = await prisma.swapRequest.findMany({
            where: { trainNo, journeyDate, status: 'OPEN' },
            orderBy: { priorityScore: 'desc' },
        });

        res.json({
            offers,
            totalOffers: offers.length,
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Find matching swap cycles for a train
app.get('/api/swaps/:trainNo/:journeyDate/matches', async (req, res) => {
    try {
        const { trainNo, journeyDate } = req.params;
        const matches = await findSwapMatches(trainNo, journeyDate);
        res.json({ trainNo, journeyDate, matches, totalMatches: matches.length });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Accept a swap match — RM-SW-012: now creates a SwapSession
app.post('/api/swaps/:swapId/accept', async (req, res) => {
    try {
        const swapId = parseInt(req.params.swapId);
        const { matchedSwapId } = req.body; // The other swap being matched against
        const swap = await prisma.swapRequest.findUnique({ where: { id: swapId } });

        if (!swap) return res.status(404).json({ error: 'Swap not found' });
        if (swap.status !== 'OPEN' && swap.status !== 'MATCHED') {
            return res.status(400).json({ error: `Can't accept a swap with status "${swap.status}"` });
        }

        // Determine session type and gather participant swap IDs
        const participantIds = [swapId];
        if (matchedSwapId) {
            participantIds.push(parseInt(matchedSwapId));
        } else if (swap.matchedWith) {
            participantIds.push(swap.matchedWith);
        }

        // Figure out session type
        const sessionType = participantIds.length === 2 ? 'DIRECT'
            : participantIds.length === 3 ? 'TRIANGULAR' : 'CHAIN';

        // Create the SwapSession
        const session = await prisma.swapSession.create({
            data: {
                type: sessionType,
                status: 'PENDING',
                totalRequired: participantIds.length,
                acceptedBy: swap.userId,
                participants: {
                    connect: participantIds.map(id => ({ id })),
                },
            },
        });

        // Update all participating swaps
        for (const pid of participantIds) {
            await prisma.swapRequest.update({
                where: { id: pid },
                data: {
                    status: 'ACCEPTED',
                    sessionId: session.id,
                    matchedWith: pid === swapId ? (participantIds.find(p => p !== swapId) || null) : swapId,
                    updatedAt: new Date(),
                },
            });
        }

        await prisma.swapEvent.create({
            data: { swapId, eventType: 'ACCEPTED', actorId: swap.userId, metadata: JSON.stringify({ sessionId: session.id }) },
        });

        broadcastSSE(swap.trainNo, swap.journeyDate, { type: 'SWAP_ACCEPTED', swapId, sessionId: session.id });

        res.json({ success: true, sessionId: session.id, message: 'Swap accepted! Session created.' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Reject a swap match
app.post('/api/swaps/:swapId/reject', async (req, res) => {
    try {
        const swapId = parseInt(req.params.swapId);
        const swap = await prisma.swapRequest.findUnique({ where: { id: swapId } });

        if (!swap) return res.status(404).json({ error: 'Swap not found' });

        await prisma.swapRequest.update({
            where: { id: swapId },
            data: { status: 'OPEN', matchedWith: null, updatedAt: new Date() },
        });

        await prisma.swapEvent.create({
            data: { swapId, eventType: 'REJECTED', actorId: swap.userId },
        });

        broadcastSSE(swap.trainNo, swap.journeyDate, { type: 'SWAP_REJECTED', swapId });

        res.json({ success: true, message: 'Swap rejected. Back to looking.' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Cancel own swap offer
app.post('/api/swaps/:swapId/cancel', async (req, res) => {
    try {
        const swapId = parseInt(req.params.swapId);
        const swap = await prisma.swapRequest.findUnique({ where: { id: swapId } });

        if (!swap) return res.status(404).json({ error: 'Swap not found' });
        if (swap.status === 'COMPLETED') {
            return res.status(400).json({ error: 'Can\'t cancel a completed swap.' });
        }

        await prisma.swapRequest.update({
            where: { id: swapId },
            data: { status: 'CANCELLED', updatedAt: new Date() },
        });

        await prisma.swapEvent.create({
            data: { swapId, eventType: 'CANCELLED', actorId: swap.userId },
        });

        broadcastSSE(swap.trainNo, swap.journeyDate, { type: 'OFFER_CANCELLED', swapId });

        res.json({ success: true, message: 'Swap cancelled.' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// --- SWAP SESSION MANAGEMENT (RM-SW-012) ---

// Complete a swap session — both parties confirm the physical swap happened
app.post('/api/sessions/:sessionId/complete', async (req, res) => {
    try {
        const sessionId = parseInt(req.params.sessionId);
        const session = await prisma.swapSession.findUnique({
            where: { id: sessionId },
            include: { participants: true },
        });

        if (!session) return res.status(404).json({ error: 'Session not found' });
        if (session.status === 'COMPLETED') return res.status(400).json({ error: 'Session already completed.' });

        // Mark all participants as COMPLETED
        for (const swap of session.participants) {
            await prisma.swapRequest.update({
                where: { id: swap.id },
                data: { status: 'COMPLETED' },
            });
            await prisma.swapEvent.create({
                data: { swapId: swap.id, eventType: 'COMPLETED', actorId: swap.userId },
            });
        }

        await prisma.swapSession.update({
            where: { id: sessionId },
            data: { status: 'COMPLETED', completedAt: new Date() },
        });

        const firstSwap = session.participants[0];
        if (firstSwap) {
            broadcastSSE(firstSwap.trainNo, firstSwap.journeyDate, { type: 'SESSION_COMPLETED', sessionId });
        }

        res.json({ success: true, message: 'Swap session completed successfully!' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Fail/revert a swap session — something went wrong, put everyone back to OPEN
app.post('/api/sessions/:sessionId/fail', async (req, res) => {
    try {
        const sessionId = parseInt(req.params.sessionId);
        const session = await prisma.swapSession.findUnique({
            where: { id: sessionId },
            include: { participants: true },
        });

        if (!session) return res.status(404).json({ error: 'Session not found' });
        if (session.status === 'COMPLETED') return res.status(400).json({ error: 'Cannot fail an already completed session.' });

        // Revert all participants to OPEN
        for (const swap of session.participants) {
            await prisma.swapRequest.update({
                where: { id: swap.id },
                data: { status: 'OPEN', matchedWith: null, sessionId: null },
            });
            await prisma.swapEvent.create({
                data: {
                    swapId: swap.id,
                    eventType: 'FAILED',
                    actorId: swap.userId,
                    metadata: JSON.stringify({ sessionId }),
                },
            });
        }

        await prisma.swapSession.update({
            where: { id: sessionId },
            data: { status: 'FAILED' },
        });

        const firstSwap = session.participants[0];
        if (firstSwap) {
            broadcastSSE(firstSwap.trainNo, firstSwap.journeyDate, { type: 'SESSION_FAILED', sessionId });
        }

        res.json({ success: true, message: 'Swap session failed. Participants reverted to OPEN.' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Server-Sent Events stream for real-time updates (when online)
const sseClients: Map<string, Set<any>> = new Map();

function broadcastSSE(trainNo: string, journeyDate: string, event: any) {
    const key = `${trainNo}_${journeyDate}`;
    const clients = sseClients.get(key);
    if (!clients) return;
    const data = `data: ${JSON.stringify(event)}\n\n`;
    clients.forEach(res => res.write(data));
}

app.get('/api/swaps/:trainNo/:journeyDate/stream', (req, res) => {
    const { trainNo, journeyDate } = req.params;
    const key = `${trainNo}_${journeyDate}`;

    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
    });

    res.write(`data: ${JSON.stringify({ type: 'CONNECTED', trainNo, journeyDate })}\n\n`);

    if (!sseClients.has(key)) sseClients.set(key, new Set());
    sseClients.get(key)!.add(res);

    // Track SSE connection for observability
    const connId = trackSSEConnect(trainNo, journeyDate, req.ip);

    req.on('close', () => {
        sseClients.get(key)?.delete(res);
        trackSSEDisconnect(connId);
    });
});

// Swap analytics — demand heatmap, match stats
app.get('/api/swaps/:trainNo/:journeyDate/analytics', async (req, res) => {
    try {
        const { trainNo, journeyDate } = req.params;

        const allSwaps = await prisma.swapRequest.findMany({
            where: { trainNo, journeyDate },
        });

        const seatTypes = ['LOWER', 'MIDDLE', 'UPPER', 'SIDE_LOWER', 'SIDE_UPPER'];
        const heatmap: Record<string, { wanted: number; offered: number }> = {};
        for (const st of seatTypes) {
            heatmap[st] = { wanted: 0, offered: 0 };
        }

        let active = 0, completed = 0;
        for (const swap of allSwaps) {
            if (swap.status === 'OPEN') active++;
            if (swap.status === 'COMPLETED') completed++;
            if (heatmap[swap.desiredSeatType]) heatmap[swap.desiredSeatType].wanted++;
            if (heatmap[swap.currentSeatType]) heatmap[swap.currentSeatType].offered++;
        }

        res.json({
            trainNo,
            journeyDate,
            totalOffers: allSwaps.length,
            activeOffers: active,
            completedSwaps: completed,
            successRate: allSwaps.length > 0 ? parseFloat((completed / allSwaps.length).toFixed(2)) : 0,
            demandHeatmap: heatmap,
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// RM-SW-010: V2 endpoints — PNR + Toilets disabled
app.post('/api/pnr/parse', v2Stub);
app.post('/api/toilets', v2Stub);
app.get('/api/toilets/:trainNo/:coachId', v2Stub);

// --- USER REPUTATION ---

app.get('/api/reputation/:deviceId', async (req, res) => {
    try {
        const deviceId = req.params.deviceId;
        const rep = await prisma.userReputation.findUnique({
            where: { deviceId },
        });

        res.json(rep || { message: 'New user detected!', trustScore: 0.5 });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// RM-SW-010: V2 endpoints — Availability + Utilities disabled
app.get('/api/trains/:trainNo/availability', v2Stub);
app.post('/api/utilities/toilet-queue', v2Stub);
app.post('/api/utilities/theft-risk', v2Stub);

// ============================================================
// RM-SW-011: Swap Expiry Cron Job — runs every 15 minutes
// Finds OPEN swaps past their expiresAt and marks them EXPIRED.
// ============================================================
setInterval(async () => {
    try {
        const now = new Date();
        const expired = await prisma.swapRequest.findMany({
            where: { status: 'OPEN', expiresAt: { lt: now } },
        });

        for (const swap of expired) {
            await prisma.swapRequest.update({
                where: { id: swap.id },
                data: { status: 'EXPIRED', updatedAt: now },
            });
            await prisma.swapEvent.create({
                data: { swapId: swap.id, eventType: 'EXPIRED', actorId: 'SYSTEM' },
            });
            broadcastSSE(swap.trainNo, swap.journeyDate, { type: 'OFFER_EXPIRED', swapId: swap.id });
        }

        if (expired.length > 0) {
            logger.info(`[Cron] Expired ${expired.length} stale swap offer(s)`);
        }
    } catch (err) {
        logger.error('[Cron] Swap expiry check failed:', { error: err });
    }
}, 15 * 60 * 1000); // Every 15 minutes

// Fire it up! Bind to 0.0.0.0 so phones on the same Wi-Fi can reach us.
app.listen(Number(PORT), '0.0.0.0', () => {
    logger.info('Server started', {
        port: PORT,
        nodeEnv: process.env.NODE_ENV || 'development',
        pid: process.pid,
    });
    logger.info(`\n🚄 Seat Swap Sync Server v1.0.0\n   Local:   http://localhost:${PORT}\n   Network: http://0.0.0.0:${PORT}\n   Health:  http://localhost:${PORT}/api/health\n   Metrics: http://localhost:${PORT}/api/metrics\n   Studio:  Run 'npm run prisma:studio'\n`);
});

export default app;
