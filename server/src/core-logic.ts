/**
 * Core Logic — Seat Seeker Algorithms
 * 
 * Contains:
 * 1. Consensus Engine — Weighted seat confidence scoring
 * 2. LHB vs ICF Classifier — Coach type inference
 * 3. Seat Swap Matchmaker — Direct + triangular matching
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ============================================================
// 1. CONSENSUS ENGINE
// Calculates seat confidence from crowdsourced reports
// weighted by each reporter's trust score.
// ============================================================

interface ConfidenceResult {
    seatId: number;
    status: 'EMPTY' | 'OCCUPIED' | 'UNCERTAIN';
    confidence: number;
    totalReports: number;
    lastReportAt: Date | null;
}

/**
 * Calculate the confidence score for a seat's current status.
 * 
 * Algorithm:
 * 1. Fetch the last N reports for a given seat
 * 2. For each report, get the reporter's trust score
 * 3. Compute weighted average: Sum(Report * TrustScore) / Sum(TrustScores)
 * 4. If confidence > 0.8, mark as "Confirmed"
 * 
 * Reports saying EMPTY contribute 1.0, OCCUPIED contribute 0.0
 */
export async function calculateSeatConfidence(
    seatId: number,
    maxReports: number = 10
): Promise<ConfidenceResult> {
    // Fetch last N reports for this seat, ordered by most recent
    const reports = await prisma.seatReport.findMany({
        where: { seatId },
        orderBy: { timestamp: 'desc' },
        take: maxReports,
    });

    if (reports.length === 0) {
        return {
            seatId,
            status: 'UNCERTAIN',
            confidence: 0,
            totalReports: 0,
            lastReportAt: null,
        };
    }

    // Fetch trust scores for all unique reporters
    const deviceIds = [...new Set(reports.map(r => r.deviceId))];
    const reputations = await prisma.userReputation.findMany({
        where: { deviceId: { in: deviceIds } },
    });

    const trustMap = new Map<string, number>();
    reputations.forEach(rep => {
        trustMap.set(rep.deviceId, rep.trustScore);
    });

    // Calculate weighted confidence
    let weightedSum = 0;
    let totalWeight = 0;

    for (const report of reports) {
        const trustScore = trustMap.get(report.deviceId) ?? 0.3; // Default low trust for unknown reporters

        // Apply time decay: Recent reports are worth more
        const ageMinutes = (Date.now() - report.timestamp.getTime()) / (1000 * 60);
        const timeFactor = Math.max(0.1, 1 - ageMinutes / 120); // Decays over 2 hours

        // Apply verification method bonus
        const verificationBonus = getVerificationBonus(report.verificationMethod);

        const weight = trustScore * timeFactor * verificationBonus;

        // EMPTY = 1.0, OCCUPIED = 0.0, EXCHANGE_OFFER = 0.3
        const statusValue = report.status === 'EMPTY' ? 1.0
            : report.status === 'EXCHANGE_OFFER' ? 0.3
                : 0.0;

        weightedSum += statusValue * weight;
        totalWeight += weight;
    }

    const confidence = totalWeight > 0 ? weightedSum / totalWeight : 0;

    // Determine final status
    let status: 'EMPTY' | 'OCCUPIED' | 'UNCERTAIN';
    if (confidence >= 0.8) {
        status = 'EMPTY';
    } else if (confidence <= 0.2) {
        status = 'OCCUPIED';
    } else {
        status = 'UNCERTAIN';
    }

    return {
        seatId,
        status,
        confidence: Math.round(confidence * 1000) / 1000,
        totalReports: reports.length,
        lastReportAt: reports[0]?.timestamp ?? null,
    };
}

/**
 * Verification method grants different confidence bonuses
 */
function getVerificationBonus(method: string): number {
    switch (method) {
        case 'PNR_ANCHOR': return 1.5;  // SMS verified — highest trust
        case 'GPS_GEOFENCE': return 1.3;  // Phone was at the station/on the train
        case 'BLUETOOTH_PEER': return 1.2;  // Another device nearby confirmed
        case 'MANUAL': return 1.0;  // Manual user input — baseline
        default: return 0.8;
    }
}

// ============================================================
// 2. USER REPUTATION — Trust Score Update
// Users gain points when their report matches consensus.
// ============================================================

/**
 * Update a user's trust score after their report is verified.
 * 
 * Score formula:
 *  - Verified: trustScore += 0.05 * (1 - trustScore)  (diminishing returns)
 *  - Incorrect: trustScore -= 0.1 * trustScore         (faster penalty)
 *  - Streak bonus: +0.02 for every 5 consecutive verified reports
 */
export async function updateTrustScore(
    deviceId: string,
    wasVerified: boolean
): Promise<number> {
    let reputation = await prisma.userReputation.findUnique({
        where: { deviceId },
    });

    if (!reputation) {
        reputation = await prisma.userReputation.create({
            data: { deviceId, trustScore: 0.5, totalReports: 0, verifiedReports: 0 },
        });
    }

    let newScore = reputation.trustScore;
    let newStreak = reputation.streakCount;

    if (wasVerified) {
        // Reward — diminishing returns as score approaches 1.0
        newScore += 0.05 * (1 - newScore);
        newStreak += 1;

        // Streak bonus every 5 verified reports
        if (newStreak % 5 === 0) {
            newScore = Math.min(1.0, newScore + 0.02);
        }
    } else {
        // Penalty — faster drop
        newScore -= 0.1 * newScore;
        newStreak = 0; // Reset streak
    }

    // Clamp between 0 and 1
    newScore = Math.max(0.0, Math.min(1.0, newScore));

    const updated = await prisma.userReputation.update({
        where: { deviceId },
        data: {
            trustScore: Math.round(newScore * 1000) / 1000,
            totalReports: reputation.totalReports + 1,
            verifiedReports: wasVerified ? reputation.verifiedReports + 1 : reputation.verifiedReports,
            streakCount: newStreak,
            lastReportAt: new Date(),
        },
    });

    return updated.trustScore;
}

// ============================================================
// 3. LHB vs ICF CLASSIFIER — Static Inference
// Determines coach type based on seat numbering patterns.
// ============================================================

interface CoachClassification {
    coachType: 'LHB' | 'ICF' | 'UNKNOWN';
    maxSeats: number;
    reasoning: string;
}

/**
 * Infer whether a coach is LHB (Linke Hofmann Busch) or ICF
 * based on the highest seat number and class type.
 * 
 * LHB coaches have more seats per coach:
 *   SL class: LHB has 80 berths (ICF max = 72)
 *   3A class: LHB has 72 berths (ICF max = 64)
 *   2A class: LHB has 54 berths (ICF max = 48)
 *   1A class: Both have 24 berths (indistinguishable)
 */
export function inferCoachType(highestSeatNumber: number, classType: string): CoachClassification {
    switch (classType.toUpperCase()) {
        case 'SL':
            if (highestSeatNumber > 72) {
                return {
                    coachType: 'LHB',
                    maxSeats: 80,
                    reasoning: `Sleeper class with seat ${highestSeatNumber} > 72 → LHB (max 80 berths)`,
                };
            }
            return {
                coachType: 'ICF',
                maxSeats: 72,
                reasoning: `Sleeper class with seat ${highestSeatNumber} ≤ 72 → ICF (or could be LHB not fully occupied)`,
            };

        case '3A':
            if (highestSeatNumber > 64) {
                return {
                    coachType: 'LHB',
                    maxSeats: 72,
                    reasoning: `3AC class with seat ${highestSeatNumber} > 64 → LHB (max 72 berths)`,
                };
            }
            return {
                coachType: 'ICF',
                maxSeats: 64,
                reasoning: `3AC class with seat ${highestSeatNumber} ≤ 64 → ICF`,
            };

        case '2A':
            if (highestSeatNumber > 48) {
                return {
                    coachType: 'LHB',
                    maxSeats: 54,
                    reasoning: `2AC class with seat ${highestSeatNumber} > 48 → LHB (max 54 berths)`,
                };
            }
            return {
                coachType: 'ICF',
                maxSeats: 48,
                reasoning: `2AC class with seat ${highestSeatNumber} ≤ 48 → ICF`,
            };

        case '1A':
            return {
                coachType: 'UNKNOWN',
                maxSeats: 24,
                reasoning: `1AC class — both LHB and ICF have 24 berths. Cannot distinguish by seat number alone.`,
            };

        case 'CC':
            if (highestSeatNumber > 73) {
                return {
                    coachType: 'LHB',
                    maxSeats: 78,
                    reasoning: `Chair Car with seat ${highestSeatNumber} > 73 → LHB`,
                };
            }
            return {
                coachType: 'ICF',
                maxSeats: 73,
                reasoning: `Chair Car with seat ${highestSeatNumber} ≤ 73 → ICF`,
            };

        default:
            return {
                coachType: 'UNKNOWN',
                maxSeats: 0,
                reasoning: `Unknown class type: ${classType}`,
            };
    }
}

// ============================================================
// 4. SEAT SWAP MATCHMAKER
// Direct matching (A↔B) and triangular cycle detection (A→B→C→A)
// ============================================================

interface SwapMatch {
    type: 'DIRECT' | 'TRIANGULAR';
    participants: {
        requestId: number;
        userId: string;
        has: string;  // Current seat type
        wants: string; // Desired seat type
    }[];
}

/**
 * Find all possible seat swap matches for a given train.
 * 
 * Algorithm:
 * 1. DIRECT MATCH: Find pairs where A has what B wants AND B has what A wants.
 * 2. TRIANGULAR MATCH: Use DFS to detect cycles of length 3 in the swap graph.
 *    A → B → C → A (A wants B's type, B wants C's type, C wants A's type)
 */
export async function findSwapMatches(trainNo: string, journeyDate: string): Promise<SwapMatch[]> {
    // Fetch all open swap requests for this train/date
    const requests = await prisma.swapRequest.findMany({
        where: {
            trainNo,
            journeyDate,
            status: 'OPEN',
        },
    });

    const matches: SwapMatch[] = [];
    const matchedIds = new Set<number>();

    // ---- PASS 1: DIRECT MATCHES ----
    for (let i = 0; i < requests.length; i++) {
        if (matchedIds.has(requests[i].id)) continue;

        for (let j = i + 1; j < requests.length; j++) {
            if (matchedIds.has(requests[j].id)) continue;

            const a = requests[i];
            const b = requests[j];

            // A has what B wants AND B has what A wants
            if (
                a.currentSeatType === b.desiredSeatType &&
                b.currentSeatType === a.desiredSeatType
            ) {
                matches.push({
                    type: 'DIRECT',
                    participants: [
                        { requestId: a.id, userId: a.userId, has: a.currentSeatType, wants: a.desiredSeatType },
                        { requestId: b.id, userId: b.userId, has: b.currentSeatType, wants: b.desiredSeatType },
                    ],
                });
                matchedIds.add(a.id);
                matchedIds.add(b.id);
                break; // A is matched, move to next
            }
        }
    }

    // ---- PASS 2: TRIANGULAR MATCHES (Cycle detection via DFS) ----
    const unmatched = requests.filter(r => !matchedIds.has(r.id));

    // Build adjacency: "who can receive from whom"
    // Edge A → B means A's desiredSeatType === B's currentSeatType
    for (let i = 0; i < unmatched.length; i++) {
        if (matchedIds.has(unmatched[i].id)) continue;
        const a = unmatched[i];

        for (let j = 0; j < unmatched.length; j++) {
            if (i === j || matchedIds.has(unmatched[j].id)) continue;
            const b = unmatched[j];

            // A wants what B has
            if (a.desiredSeatType !== b.currentSeatType) continue;

            for (let k = 0; k < unmatched.length; k++) {
                if (k === i || k === j || matchedIds.has(unmatched[k].id)) continue;
                const c = unmatched[k];

                // B wants what C has, AND C wants what A has
                if (
                    b.desiredSeatType === c.currentSeatType &&
                    c.desiredSeatType === a.currentSeatType
                ) {
                    matches.push({
                        type: 'TRIANGULAR',
                        participants: [
                            { requestId: a.id, userId: a.userId, has: a.currentSeatType, wants: a.desiredSeatType },
                            { requestId: b.id, userId: b.userId, has: b.currentSeatType, wants: b.desiredSeatType },
                            { requestId: c.id, userId: c.userId, has: c.currentSeatType, wants: c.desiredSeatType },
                        ],
                    });
                    matchedIds.add(a.id);
                    matchedIds.add(b.id);
                    matchedIds.add(c.id);
                    break;
                }
            }
            if (matchedIds.has(a.id)) break;
        }
    }

    return matches;
}

export default {
    calculateSeatConfidence,
    updateTrustScore,
    inferCoachType,
    findSwapMatches,
};
