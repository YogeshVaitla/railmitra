/**
 * Database seed script — Populates SeatMaster with real Indian train data.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Standard berth layout for Indian trains
const SLEEPER_BERTHS_ICF = [
    // Bay of 8 berths (6 in bay + 2 side)
    // Pattern repeats: LB, MB, UB, LB, MB, UB, SL, SU
    { suffix: 'LB' }, { suffix: 'MB' }, { suffix: 'UB' },
    { suffix: 'LB' }, { suffix: 'MB' }, { suffix: 'UB' },
    { suffix: 'SL' }, { suffix: 'SU' },
];

const AC3_BERTHS_ICF = [
    // Bay of 8 berths (6 in bay + 2 side)
    { suffix: 'LB' }, { suffix: 'MB' }, { suffix: 'UB' },
    { suffix: 'LB' }, { suffix: 'MB' }, { suffix: 'UB' },
    { suffix: 'SL' }, { suffix: 'SU' },
];

function getSeatType(seatNo: number, maxSeats: number): string {
    const bayPosition = (seatNo - 1) % 8;
    switch (bayPosition) {
        case 0: return 'LOWER';
        case 1: return 'MIDDLE_BERTH';
        case 2: return 'UPPER';
        case 3: return 'LOWER';
        case 4: return 'MIDDLE_BERTH';
        case 5: return 'UPPER';
        case 6: return 'SIDE_LOWER';
        case 7: return 'SIDE_UPPER';
        default: return 'UNKNOWN';
    }
}

interface TrainSeed {
    trainNo: string;
    coaches: { id: string; classType: string; coachType: string; maxSeats: number }[];
}

const TRAINS_TO_SEED: TrainSeed[] = [
    {
        trainNo: '12301',
        coaches: [
            { id: 'H1', classType: '1A', coachType: 'LHB', maxSeats: 24 },
            { id: 'A1', classType: '2A', coachType: 'LHB', maxSeats: 54 },
            { id: 'A2', classType: '2A', coachType: 'LHB', maxSeats: 54 },
            { id: 'B1', classType: '3A', coachType: 'LHB', maxSeats: 72 },
            { id: 'B2', classType: '3A', coachType: 'LHB', maxSeats: 72 },
            { id: 'B3', classType: '3A', coachType: 'LHB', maxSeats: 72 },
            { id: 'B4', classType: '3A', coachType: 'LHB', maxSeats: 72 },
            { id: 'B5', classType: '3A', coachType: 'LHB', maxSeats: 72 },
        ],
    },
    {
        trainNo: '12951',
        coaches: [
            { id: 'H1', classType: '1A', coachType: 'LHB', maxSeats: 24 },
            { id: 'A1', classType: '2A', coachType: 'LHB', maxSeats: 54 },
            { id: 'A2', classType: '2A', coachType: 'LHB', maxSeats: 54 },
            { id: 'B1', classType: '3A', coachType: 'LHB', maxSeats: 72 },
            { id: 'B2', classType: '3A', coachType: 'LHB', maxSeats: 72 },
            { id: 'B3', classType: '3A', coachType: 'LHB', maxSeats: 72 },
        ],
    },
    {
        trainNo: '12049',
        coaches: [
            { id: 'C1', classType: 'CC', coachType: 'LHB', maxSeats: 78 },
            { id: 'C2', classType: 'CC', coachType: 'LHB', maxSeats: 78 },
            { id: 'C3', classType: 'CC', coachType: 'LHB', maxSeats: 78 },
            { id: 'EC1', classType: 'EC', coachType: 'LHB', maxSeats: 56 },
        ],
    },
    {
        trainNo: '12259',
        coaches: [
            { id: 'A1', classType: '2A', coachType: 'LHB', maxSeats: 54 },
            { id: 'B1', classType: '3A', coachType: 'LHB', maxSeats: 72 },
            { id: 'B2', classType: '3A', coachType: 'LHB', maxSeats: 72 },
            { id: 'S1', classType: 'SL', coachType: 'LHB', maxSeats: 80 },
            { id: 'S2', classType: 'SL', coachType: 'LHB', maxSeats: 80 },
            { id: 'S3', classType: 'SL', coachType: 'LHB', maxSeats: 80 },
            { id: 'S4', classType: 'SL', coachType: 'LHB', maxSeats: 80 },
        ],
    },
];

async function main() {
    console.log('🌱 Seeding database...\n');

    // Clear existing data
    await prisma.seatReport.deleteMany();
    await prisma.seatMaster.deleteMany();
    await prisma.userReputation.deleteMany();
    await prisma.swapRequest.deleteMany();
    await prisma.toiletStatus.deleteMany();

    let totalSeats = 0;

    for (const train of TRAINS_TO_SEED) {
        console.log(`🚄 Train ${train.trainNo}:`);

        for (const coach of train.coaches) {
            const seats = [];

            for (let seatNo = 1; seatNo <= coach.maxSeats; seatNo++) {
                seats.push({
                    trainNo: train.trainNo,
                    coachId: coach.id,
                    seatNo,
                    seatType: getSeatType(seatNo, coach.maxSeats),
                    coachType: coach.coachType,
                    classType: coach.classType,
                });
            }

            await prisma.seatMaster.createMany({ data: seats });
            totalSeats += seats.length;
            console.log(`   ✅ ${coach.id} (${coach.classType}): ${coach.maxSeats} seats`);
        }
    }

    // Seed some sample user reputations
    const sampleUsers = [
        { deviceId: 'user_alpha_hash', trustScore: 0.85, totalReports: 42, verifiedReports: 36, streakCount: 8 },
        { deviceId: 'user_beta_hash', trustScore: 0.62, totalReports: 15, verifiedReports: 9, streakCount: 2 },
        { deviceId: 'user_gamma_hash', trustScore: 0.95, totalReports: 120, verifiedReports: 114, streakCount: 25 },
        { deviceId: 'user_delta_hash', trustScore: 0.3, totalReports: 8, verifiedReports: 2, streakCount: 0 },
    ];

    for (const user of sampleUsers) {
        await prisma.userReputation.create({ data: user });
    }

    console.log(`\n✅ Seeded ${totalSeats} seats across ${TRAINS_TO_SEED.length} trains`);
    console.log(`✅ Seeded ${sampleUsers.length} sample user reputations`);

    // Seed sample swap requests for testing the matching engine
    const today = new Date().toISOString().split('T')[0];
    const sampleSwaps = [
        { trainNo: '12301', userId: 'user_alpha_hash', currentCoachId: 'B1', currentSeatNo: 8, currentSeatType: 'UPPER', desiredSeatType: 'LOWER', reason: 'elderly', priorityScore: 0.50, journeyDate: today, expiresAt: new Date(Date.now() + 5 * 3600000) },
        { trainNo: '12301', userId: 'user_beta_hash', currentCoachId: 'B2', currentSeatNo: 15, currentSeatType: 'LOWER', desiredSeatType: 'UPPER', reason: 'preference', priorityScore: 0.25, journeyDate: today, expiresAt: new Date(Date.now() + 4 * 3600000) },
        { trainNo: '12301', userId: 'user_gamma_hash', currentCoachId: 'B3', currentSeatNo: 22, currentSeatType: 'MIDDLE', desiredSeatType: 'LOWER', reason: 'medical', priorityScore: 0.45, journeyDate: today, expiresAt: new Date(Date.now() + 6 * 3600000) },
        { trainNo: '12301', userId: 'peer_001_hash', currentCoachId: 'B1', currentSeatNo: 33, currentSeatType: 'SIDE_LOWER', desiredSeatType: 'LOWER', reason: 'family', priorityScore: 0.35, journeyDate: today, expiresAt: new Date(Date.now() + 3 * 3600000) },
        { trainNo: '12301', userId: 'peer_002_hash', currentCoachId: 'B4', currentSeatNo: 41, currentSeatType: 'LOWER', desiredSeatType: 'SIDE_LOWER', reason: 'preference', priorityScore: 0.25, journeyDate: today, expiresAt: new Date(Date.now() + 5 * 3600000) },
        { trainNo: '12301', userId: 'peer_003_hash', currentCoachId: 'B2', currentSeatNo: 5, currentSeatType: 'SIDE_UPPER', desiredSeatType: 'LOWER', reason: 'elderly', priorityScore: 0.50, journeyDate: today, expiresAt: new Date(Date.now() + 4 * 3600000) },
        { trainNo: '12951', userId: 'peer_004_hash', currentCoachId: 'A1', currentSeatNo: 12, currentSeatType: 'UPPER', desiredSeatType: 'LOWER', reason: 'medical', priorityScore: 0.45, journeyDate: today, expiresAt: new Date(Date.now() + 6 * 3600000) },
        { trainNo: '12951', userId: 'peer_005_hash', currentCoachId: 'B1', currentSeatNo: 28, currentSeatType: 'LOWER', desiredSeatType: 'MIDDLE', reason: 'preference', priorityScore: 0.25, journeyDate: today, expiresAt: new Date(Date.now() + 5 * 3600000) },
    ];

    for (const swap of sampleSwaps) {
        await prisma.swapRequest.create({ data: swap });
    }
    console.log(`✅ Seeded ${sampleSwaps.length} sample swap requests`);

    console.log('🎉 Done!\n');
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
