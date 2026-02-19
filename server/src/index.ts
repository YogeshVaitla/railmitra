/**
 * Seat Seeker — Express API Server
 * 
 * REST endpoints for the Seat Seeker mobile app backend.
 * Provides APIs for seat reports, swap matching, PNR processing,
 * and confidence scoring.
 */

import express from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';
import {
    calculateSeatConfidence,
    updateTrustScore,
    inferCoachType,
    findSwapMatches,
} from './core-logic';
import { parseIRCTCSMS, inferVacancy, hashPNR } from './pnr-parser';
import { detectToiletQueue, detectTheftRisk } from './smart-utilities';

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// ============================================================
// HEALTH CHECK
// ============================================================
app.get('/api/health', (_req, res) => {
    res.json({
        status: 'ok',
        service: 'Seat Seeker API',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
    });
});

// ============================================================
// SEAT REPORTS
// ============================================================

// Submit a crowdsourced seat report
app.post('/api/reports', async (req, res) => {
    try {
        const { seatId, status, deviceId, gpsLat, gpsLong, verificationMethod } = req.body;

        const report = await prisma.seatReport.create({
            data: {
                seatId,
                status,
                deviceId: hashPNR(deviceId), // Hash device ID for privacy
                gpsLat,
                gpsLong,
                verificationMethod: verificationMethod || 'MANUAL',
            },
        });

        // Update user reputation (simply tracked, verification happens later)
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

// ============================================================
// SEAT CONFIDENCE
// ============================================================

// Get confidence score for a specific seat
app.get('/api/seats/:seatId/confidence', async (req, res) => {
    try {
        const seatId = parseInt(req.params.seatId);
        const result = await calculateSeatConfidence(seatId);
        res.json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// Get confidence scores for all seats in a coach
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

// ============================================================
// COACH TYPE CLASSIFICATION
// ============================================================

app.get('/api/classify/:classType/:highestSeat', (req, res) => {
    const classType = req.params.classType;
    const highestSeat = parseInt(req.params.highestSeat);
    const result = inferCoachType(highestSeat, classType);
    res.json(result);
});

// ============================================================
// SEAT SWAPS
// ============================================================

// Create a swap request
app.post('/api/swaps', async (req, res) => {
    try {
        const { trainNo, userId, currentCoachId, currentSeatNo, currentSeatType, desiredSeatType, journeyDate } = req.body;

        const swap = await prisma.swapRequest.create({
            data: {
                trainNo,
                userId: hashPNR(userId),
                currentCoachId,
                currentSeatNo,
                currentSeatType,
                desiredSeatType,
                journeyDate,
            },
        });

        res.status(201).json({ success: true, swapId: swap.id });
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

// Find swap matches for a train
app.get('/api/swaps/:trainNo/:journeyDate/matches', async (req, res) => {
    try {
        const { trainNo, journeyDate } = req.params;
        const matches = await findSwapMatches(trainNo, journeyDate);
        res.json({ trainNo, journeyDate, matches, totalMatches: matches.length });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// PNR PROCESSING
// ============================================================

// Parse an IRCTC SMS/notification
app.post('/api/pnr/parse', (req, res) => {
    try {
        const { smsText } = req.body;
        const parsed = parseIRCTCSMS(smsText);

        if (!parsed) {
            return res.status(400).json({ error: 'Could not parse SMS. No IRCTC pattern matched.' });
        }

        // Run vacancy inference
        const vacancy = inferVacancy(parsed);

        res.json({
            parsed,
            vacancy: vacancy || null,
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// TOILET STATUS
// ============================================================

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

app.get('/api/toilets/:trainNo/:coachId', async (req, res) => {
    try {
        const { trainNo, coachId } = req.params;

        const latest = await prisma.toiletStatus.findFirst({
            where: { trainNo, coachId },
            orderBy: { timestamp: 'desc' },
        });

        res.json(latest || { message: 'No toilet status reported for this coach' });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// USER REPUTATION
// ============================================================

app.get('/api/reputation/:deviceId', async (req, res) => {
    try {
        const deviceId = hashPNR(req.params.deviceId);
        const rep = await prisma.userReputation.findUnique({
            where: { deviceId },
        });

        res.json(rep || { message: 'No reputation record found', trustScore: 0.5 });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

// ============================================================
// TRAIN AVAILABILITY (Aggregated)
// ============================================================

// Get seat availability for a train (aggregates SeatMaster data)
app.get('/api/trains/:trainNo/availability', async (req, res) => {
    try {
        const { trainNo } = req.params;
        const { from, to, date } = req.query;

        // Get all seats for this train grouped by coach
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
            return res.status(404).json({ error: `No data found for train ${trainNo}` });
        }

        // Group by class type, then by coach
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

        // Build response in frontend-compatible shape
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

// ============================================================
// SMART UTILITIES
// ============================================================

// Toilet queue detection
app.post('/api/utilities/toilet-queue', (req, res) => {
    try {
        const { gpsHistory } = req.body;
        const result = detectToiletQueue(gpsHistory || []);
        res.json(result);
    } catch (error: any) {
        res.status(400).json({ error: error.message });
    }
});

// Anti-theft risk detection
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

// ============================================================
// START SERVER
// ============================================================

app.listen(PORT, () => {
    console.log(`\n🚄 Seat Seeker API running on http://localhost:${PORT}`);
    console.log(`   Health: http://localhost:${PORT}/api/health`);
    console.log(`   Prisma Studio: Run 'npm run prisma:studio' to browse DB\n`);
});

export default app;
