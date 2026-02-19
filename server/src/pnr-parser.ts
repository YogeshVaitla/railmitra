/**
 * PNR Parser — Passive Data Mining
 * 
 * Extracts train/coach/seat data from IRCTC SMS notifications.
 * Hashes PNR for privacy. Tracks WL → CNF transitions for vacancy inference.
 */

import { createHash } from 'crypto';

// ============================================================
// IRCTC SMS PATTERNS
// ============================================================

// Pattern 1: IRCTC booking confirmation
// "IRCTC Booking - PNR: 4521678901, Train: 12301/HOWRAH RAJDHANI, DOJ: 15-02-2026, Class: 3A, 
//  Passenger: JOHN, Coach: B3, Berth: 42/LB"
const BOOKING_REGEX = /PNR[:\s]*(\d{10}).*?Train[:\s]*(\d{4,5})[\/]?([^,]*).*?DOJ[:\s]*([\d-]+).*?Class[:\s]*([\w]+).*?Coach[:\s]*([A-Z]\d+).*?Berth[:\s]*(\d+)\/([\w]+)/i;

// Pattern 2: Chart preparation / final allotment
// "Your PNR 4521678901: Chart Prepared. Coach: B3, Berth No: 42, Lower Berth"
const CHART_REGEX = /PNR[:\s]*(\d{10}).*?Chart\s*Prepared.*?Coach[:\s]*([A-Z]\d+).*?Berth\s*(?:No)?[:\s]*(\d+).*?(Lower|Upper|Middle|Side\s*Lower|Side\s*Upper|Window|Aisle)/i;

// Pattern 3: Waitlist to confirmed
// "PNR: 4521678901, WL 5 → CNF, Coach: B3, Berth: 42/LB"
const WL_TO_CNF_REGEX = /PNR[:\s]*(\d{10}).*?(?:WL|RAC)\s*\d+\s*(?:→|->|to)\s*CNF.*?Coach[:\s]*([A-Z]\d+).*?Berth[:\s]*(\d+)/i;

// Pattern 4: Simple PNR status check result (from IRCTC or third-party apps)
// "PNR Status: 4521678901 | Train 12301 | 15-02-2026 | S3/42/LB | CNF"
const STATUS_REGEX = /PNR[:\s]*(\d{10}).*?Train[:\s]*(\d{4,5}).*?(\d{2}-\d{2}-\d{4}).*?([A-Z]\d+)\/(\d+)\/([\w]+).*?(CNF|WL|RAC)/i;

// ============================================================
// TYPES
// ============================================================

export interface ParsedPNR {
    pnrHash: string;       // SHA-256 hashed PNR (never store raw PNR)
    trainNo: string;
    trainName?: string;
    journeyDate?: string;
    classType?: string;
    coachId: string;
    seatNo: number;
    berthType: string;     // LB, UB, MB, SL, SU
    status: 'CNF' | 'WL' | 'RAC' | 'CHART_PREPARED';
    rawPattern: string;     // Which regex matched
}

export interface VacancyInference {
    pnrHash: string;
    trainNo: string;
    coachId: string;
    seatNo: number;
    previousStatus: string;
    newStatus: string;
    inference: string;
}

// ============================================================
// PNR HASHING — Privacy first
// ============================================================

/**
 * Hash PNR using SHA-256 so we never store the raw 10-digit number.
 * Add a salt to prevent rainbow table attacks.
 */
export function hashPNR(pnr: string): string {
    const salt = 'SeatSeeker_v1_2026';
    return createHash('sha256').update(`${salt}:${pnr}`).digest('hex').substring(0, 32);
}

// ============================================================
// SMS PARSING
// ============================================================

/**
 * Parse an IRCTC SMS/notification text and extract seat data.
 * Returns null if no recognizable pattern is found.
 */
export function parseIRCTCSMS(text: string): ParsedPNR | null {
    // Try each pattern in order of specificity

    // Pattern 1: Full booking confirmation
    let match = text.match(BOOKING_REGEX);
    if (match) {
        return {
            pnrHash: hashPNR(match[1]),
            trainNo: match[2],
            trainName: match[3]?.trim() || undefined,
            journeyDate: match[4],
            classType: match[5],
            coachId: match[6],
            seatNo: parseInt(match[7]),
            berthType: normalizeBerthType(match[8]),
            status: 'CNF',
            rawPattern: 'BOOKING_CONFIRMATION',
        };
    }

    // Pattern 2: Chart prepared notification
    match = text.match(CHART_REGEX);
    if (match) {
        return {
            pnrHash: hashPNR(match[1]),
            trainNo: '', // Not always in chart notification
            coachId: match[2],
            seatNo: parseInt(match[3]),
            berthType: normalizeBerthType(match[4]),
            status: 'CHART_PREPARED',
            rawPattern: 'CHART_PREPARED',
        };
    }

    // Pattern 3: WL to CNF transition
    match = text.match(WL_TO_CNF_REGEX);
    if (match) {
        return {
            pnrHash: hashPNR(match[1]),
            trainNo: '',
            coachId: match[2],
            seatNo: parseInt(match[3]),
            berthType: 'UNKNOWN',
            status: 'CNF',
            rawPattern: 'WL_TO_CNF',
        };
    }

    // Pattern 4: General PNR status
    match = text.match(STATUS_REGEX);
    if (match) {
        return {
            pnrHash: hashPNR(match[1]),
            trainNo: match[2],
            journeyDate: match[3],
            coachId: match[4],
            seatNo: parseInt(match[5]),
            berthType: normalizeBerthType(match[6]),
            status: match[7] as 'CNF' | 'WL' | 'RAC',
            rawPattern: 'STATUS_CHECK',
        };
    }

    return null;
}

// ============================================================
// VACANCY INFERENCE
// ============================================================

// In-memory store of tracked PNRs (would be DB-backed in production)
const pnrStateStore = new Map<string, { status: string; coachId?: string; seatNo?: number }>();

/**
 * Track a PNR status change and infer seat vacancy.
 * 
 * Logic:
 * - If WL → CNF: The newly assigned seat is "Recently Occupied"
 * - If RAC → CNF: Seat assignment changed, mark the new seat as occupied
 * - If a previously confirmed seat's PNR cancels: Mark that seat as potentially empty
 */
export function inferVacancy(parsed: ParsedPNR): VacancyInference | null {
    const previousState = pnrStateStore.get(parsed.pnrHash);

    if (!previousState) {
        // First time seeing this PNR — just store it
        pnrStateStore.set(parsed.pnrHash, {
            status: parsed.status,
            coachId: parsed.coachId,
            seatNo: parsed.seatNo,
        });
        return null;
    }

    const inference: VacancyInference = {
        pnrHash: parsed.pnrHash,
        trainNo: parsed.trainNo,
        coachId: parsed.coachId,
        seatNo: parsed.seatNo,
        previousStatus: previousState.status,
        newStatus: parsed.status,
        inference: '',
    };

    // WL/RAC → CNF: New seat assigned, mark as OCCUPIED
    if (
        (previousState.status === 'WL' || previousState.status === 'RAC') &&
        parsed.status === 'CNF'
    ) {
        inference.inference = `Seat ${parsed.coachId}/${parsed.seatNo} is now OCCUPIED (upgraded from ${previousState.status})`;
    }

    // CNF → CHART_PREPARED: Seat confirmed after chart — high confidence it's occupied
    else if (previousState.status === 'CNF' && parsed.status === 'CHART_PREPARED') {
        inference.inference = `Seat ${parsed.coachId}/${parsed.seatNo} CONFIRMED after chart preparation — 100% occupied`;
    }

    // Same status, different seat: Previous seat may be empty now
    else if (
        previousState.coachId && previousState.seatNo &&
        (previousState.coachId !== parsed.coachId || previousState.seatNo !== parsed.seatNo)
    ) {
        inference.inference = `Seat ${previousState.coachId}/${previousState.seatNo} may be EMPTY (passenger moved to ${parsed.coachId}/${parsed.seatNo})`;
    }

    // Update stored state
    pnrStateStore.set(parsed.pnrHash, {
        status: parsed.status,
        coachId: parsed.coachId,
        seatNo: parsed.seatNo,
    });

    return inference.inference ? inference : null;
}

// ============================================================
// HELPERS
// ============================================================

/**
 * Normalize berth type labels from various SMS formats
 */
function normalizeBerthType(raw: string): string {
    const upper = raw.toUpperCase().replace(/\s+/g, '_');
    const map: Record<string, string> = {
        'LB': 'LB', 'LOWER': 'LB', 'LOWER_BERTH': 'LB',
        'UB': 'UB', 'UPPER': 'UB', 'UPPER_BERTH': 'UB',
        'MB': 'MB', 'MIDDLE': 'MB', 'MIDDLE_BERTH': 'MB',
        'SL': 'SL', 'SIDE_LOWER': 'SL',
        'SU': 'SU', 'SIDE_UPPER': 'SU',
        'WINDOW': 'WS', 'AISLE': 'AS',
    };
    return map[upper] || upper;
}

export default {
    hashPNR,
    parseIRCTCSMS,
    inferVacancy,
};
