/**
 * This is the main server for Seat Seeker.
 * We've got endpoints here for reporting seats, checking confidence scores,
 * parsing PNR SMS, and all that good stuff.
 */

import { PrismaClient } from '@prisma/client';
import cors from 'cors';
import express from 'express';
import {
    calculateSeatConfidence,
    findSwapMatches,
    inferCoachType
} from './core-logic';
import { hashPNR, inferVacancy, parseIRCTCSMS } from './pnr-parser';
import { detectTheftRisk, detectToiletQueue } from './smart-utilities';

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Just a quick check to see if the server is actually breathing
app.get('/api/health', (_req, res) => {
    res.json({
        status: 'ok',
        service: 'Seat Seeker API',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
    });
});

// Friendly root endpoint so standard browser visits don't throw 404
app.get('/', (_req, res) => {
    res.send(`
        <html>
            <body style="font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background-color: #f9f9f9;">
                <h1 style="color: #ff6b35;">🚄 Seat Swap Sync Server is Live!</h1>
                <p>Version 1.0.0</p>
            </body>
        </html>
    `);
});

// --- SEAT REPORTS ---

// When a user sees a seat is empty (or not), this is where it goes.
app.post('/api/reports', async (req, res) => {
    try {
        const { seatId, status, deviceId, gpsLat, gpsLong, verificationMethod } = req.body;

        const report = await prisma.seatReport.create({
            data: {
                seatId,
                status,
                deviceId: hashPNR(deviceId), // Privacy first—don't store raw device IDs
                gpsLat,
                gpsLong,
                verificationMethod: verificationMethod || 'MANUAL',
            },
        });

        // Track how active the user is. We use this for their trust score later.
        await prisma.userReputation.upsert({
            where: { deviceId: hashPNR(deviceId) },
            update: { totalReports: { increment: 1 }, lastReportAt: new Date() },
            create: { deviceId: hashPNR(deviceId), trustScore: 0.5, totalReports: 1 },
        });

        res.status(201).json({ success: true, reportId: report.id });
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

// --- SEAT CONFIDENCE ---

// How sure are we about this specific seat?
app.get('/api/seats/:seatId/confidence', async (req, res) => {
    try {
        const seatId = parseInt(req.params.seatId);
        const result = await calculateSeatConfidence(seatId);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Get the lowdown on every seat in a coach
app.get('/api/trains/:trainNo/coaches/:coachId/confidence', async (req, res) => {
    try {
        const { trainNo, coachId } = req.params;

        const seats = await prisma.seatMaster.findMany({
            where: { trainNo, coachId },
            orderBy: { seatNo: 'asc' },
        });

        const results = await Promise.all(
            seats.map(async (seat) => ({
                seatNo: seat.seatNo,
                seatType: seat.seatType,
                ...(await calculateSeatConfidence(seat.id)),
            }))
        );

        res.json({
            trainNo,
            coachId,
            seats: results,
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// --- COACH CLASSIFICATION ---

// Guess if it's LHB or ICF based on seat numbers
app.get('/api/classify/:classType/:highestSeat', (req, res) => {
    const classType = req.params.classType;
    const highestSeat = parseInt(req.params.highestSeat);
    const result = inferCoachType(highestSeat, classType);
    res.json(result);
});

// --- SEAT SWAPS ---
// These endpoints are the OPTIONAL sync layer. The app works fully offline
// using the local swapStore + swapEngine + meshBridge. When internet is
// available, the app can sync with this server for broader discovery.

// Register someone's wish to swap seats (with priority scoring)
app.post('/api/swaps', async (req, res) => {
    try {
        const { trainNo, userId, currentCoachId, currentSeatNo, currentSeatType, desiredSeatType, journeyDate, reason } = req.body;

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

// Accept a swap match
app.post('/api/swaps/:swapId/accept', async (req, res) => {
    try {
        const swapId = parseInt(req.params.swapId);
        const swap = await prisma.swapRequest.findUnique({ where: { id: swapId } });

        if (!swap) return res.status(404).json({ error: 'Swap not found' });
        if (swap.status !== 'OPEN' && swap.status !== 'MATCHED') {
            return res.status(400).json({ error: `Can't accept a swap with status "${swap.status}"` });
        }

        await prisma.swapRequest.update({
            where: { id: swapId },
            data: { status: 'ACCEPTED', updatedAt: new Date() },
        });

        await prisma.swapEvent.create({
            data: { swapId, eventType: 'ACCEPTED', actorId: swap.userId },
        });

        broadcastSSE(swap.trainNo, swap.journeyDate, { type: 'SWAP_ACCEPTED', swapId });

        res.json({ success: true, message: 'Swap accepted! The other passenger will get a ping.' });
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

    req.on('close', () => {
        sseClients.get(key)?.delete(res);
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

// --- PNR PROCESSING ---

// Parse those IRCTC SMS messages users get
app.post('/api/pnr/parse', (req, res) => {
    try {
        const { smsText } = req.body;
        const parsed = parseIRCTCSMS(smsText);

        if (!parsed) {
            return res.status(400).json({ error: 'Could not parse that SMS. Doesn\'t look like IRCTC.' });
        }

        // Try to guess vacancy from the ticket details
        const vacancy = inferVacancy(parsed);

        res.json({
            parsed,
            vacancy: vacancy || null,
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// --- TOILET STATUS ---

// Report if a toilet is sparkling or... not.
app.post('/api/toilets', async (req, res) => {
    try {
        const { trainNo, coachId, toiletType, cleanlinessScore, waterAvailable, queueLength, deviceId } = req.body;

        const status = await prisma.toiletStatus.create({
            data: {
                trainNo,
                coachId,
                toiletType,
                cleanlinessScore,
                waterAvailable,
                queueLength: queueLength || 0,
                reportedBy: hashPNR(deviceId),
            },
        });

        res.status(201).json({ success: true, id: status.id });
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

// Get the latest condition of a toilet
app.get('/api/toilets/:trainNo/:coachId', async (req, res) => {
    try {
        const { trainNo, coachId } = req.params;

        const latest = await prisma.toiletStatus.findFirst({
            where: { trainNo, coachId },
            orderBy: { timestamp: 'desc' },
        });

        res.json(latest || { message: 'No reports yet for this coach\'s toilet.' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// --- USER REPUTATION ---

app.get('/api/reputation/:deviceId', async (req, res) => {
    try {
        const deviceId = hashPNR(req.params.deviceId);
        const rep = await prisma.userReputation.findUnique({
            where: { deviceId },
        });

        res.json(rep || { message: 'New user detected!', trustScore: 0.5 });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// --- TRAIN AVAILABILITY (Aggregated) ---

// This pulls together everything we know about a train's availability
app.get('/api/trains/:trainNo/availability', async (req, res) => {
    try {
        const { trainNo } = req.params;
        const { from, to, date } = req.query;

        // Fetch all seats and their latest status reports
        const seats = await prisma.seatMaster.findMany({
            where: { trainNo },
            orderBy: [{ coachId: 'asc' }, { seatNo: 'asc' }],
            include: {
                reports: {
                    orderBy: { timestamp: 'desc' },
                    take: 1,
                },
            },
        });

        if (seats.length === 0) {
            return res.status(404).json({ error: `Never heard of train ${trainNo}.` });
        }

        // Bundle them up by class and coach for the app to display
        const classeMap: Record<string, {
            coaches: Record<string, {
                seats: typeof seats;
                coachType: string;
            }>;
        }> = {};

        for (const seat of seats) {
            if (!classeMap[seat.classType]) {
                classeMap[seat.classType] = { coaches: {} };
            }
            if (!classeMap[seat.classType].coaches[seat.coachId]) {
                classeMap[seat.classType].coaches[seat.coachId] = {
                    seats: [],
                    coachType: seat.coachType,
                };
            }
            classeMap[seat.classType].coaches[seat.coachId].seats.push(seat);
        }

        const classFullNames: Record<string, string> = {
            SL: 'Sleeper', '3A': 'AC 3 Tier', '2A': 'AC 2 Tier',
            '1A': 'AC First Class', CC: 'Chair Car', EC: 'Executive Chair',
        };

        const classes = Object.entries(classeMap).map(([classType, classData]) => {
            const coaches = Object.entries(classData.coaches).map(([coachId, coachData]) => {
                const vacantBerths = coachData.seats
                    .filter(s => {
                        const latestReport = s.reports[0];
                        return !latestReport || latestReport.status === 'EMPTY';
                    })
                    .map(s => ({
                        berthNumber: s.seatNo,
                        berthType: s.seatType.substring(0, 2) as any,
                        fromStation: (from as string) || '',
                        toStation: (to as string) || '',
                        isVacant: true,
                        coachName: coachId,
                    }));

                return {
                    coachName: coachId,
                    coachClass: classType,
                    totalBerths: coachData.seats.length,
                    vacantBerths,
                    occupiedBerths: coachData.seats.length - vacantBerths.length,
                };
            });

            const totalSeats = coaches.reduce((sum, c) => sum + c.totalBerths, 0);
            const vacantSeats = coaches.reduce((sum, c) => sum + c.vacantBerths.length, 0);

            return {
                className: classType,
                classFullName: classFullNames[classType] || classType,
                totalSeats,
                vacantSeats,
                coaches,
            };
        });

        res.json({
            trainNumber: trainNo,
            journeyDate: date || new Date().toISOString().split('T')[0],
            chartStatus: 'PREPARED',
            classes,
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// --- SMART UTILITIES ---

// Detect if someone is standing in line for the loo
app.post('/api/utilities/toilet-queue', (req, res) => {
    try {
        const { gpsHistory } = req.body;
        const result = detectToiletQueue(gpsHistory || []);
        res.json(result);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

// Check if the phone might be getting stolen (sudden movement + power cut)
app.post('/api/utilities/theft-risk', (req, res) => {
    try {
        const { accelReadings, isPowerConnected, powerDisconnectedAt } = req.body;
        const result = detectTheftRisk(
            accelReadings || [],
            isPowerConnected ?? true,
            powerDisconnectedAt || null
        );
        res.json(result);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

// Fire it up! Bind to 0.0.0.0 so phones on the same Wi-Fi can reach us.
app.listen(Number(PORT), '0.0.0.0', () => {
    console.log(`\n🚄 Server is live at http://localhost:${PORT}`);
    console.log(`   Network URL: http://0.0.0.0:${PORT} (use your Wi-Fi IP)`);
    console.log(`   Check health: http://localhost:${PORT}/api/health`);
    console.log(`   DB Browser: Run 'npm run prisma:studio'\n`);
});

export default app;
