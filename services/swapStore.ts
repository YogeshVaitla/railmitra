/**
 * Local Swap Store — Offline-First Database
 * 
 * All swap data lives on the device in AsyncStorage. No server needed.
 * Uses a persistent anonymous device fingerprint (no login required).
 * Supports CRDT-inspired merge for conflict-free sync with peers.
 * 
 * Security measures:
 * - Input validation on all user-provided data
 * - Rate limiting: max 3 active swaps per device
 * - Storage cap: max 200 swaps to prevent abuse
 * - Remote swap validation in CRDT merge (reject malformed peer data)
 * - No PII stored anywhere
 * - Append-only event log for audit trail
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// --- Storage Keys ---
const DEVICE_ID_KEY = '@seatseeker_device_id';
const SWAPS_KEY = '@seatseeker_swaps';
const EVENTS_KEY = '@seatseeker_swap_events';
const SESSIONS_KEY = '@seatseeker_swap_sessions';

// --- Mutex Lock for Safe Storage Access ---
class AsyncMutex {
    private mutex = Promise.resolve();
    lock(): Promise<() => void> {
        let unlockNext!: () => void;
        const willLock = new Promise<void>(resolve => unlockNext = resolve);
        const willUnlock = this.mutex.then(() => unlockNext);
        this.mutex = this.mutex.then(() => willLock);
        return willUnlock;
    }
}
const storeMutex = new AsyncMutex();

// --- Security Constants ---
const MAX_ACTIVE_SWAPS_PER_DEVICE = 3;   // Rate limit: max active swaps at once
const MAX_TOTAL_SWAPS_STORED = 200;       // Storage cap to prevent device bloat
const MAX_COACH_ID_LENGTH = 4;            // B1, S3, A2, etc.
const MAX_SEAT_NUMBER = 80;               // Highest seat number in any coach
const VALID_SEAT_TYPES: SeatType[] = ['LOWER', 'MIDDLE', 'UPPER', 'SIDE_LOWER', 'SIDE_UPPER'];
const VALID_REASONS: SwapReason[] = ['elderly', 'medical', 'family', 'preference'];

// --- Types ---

export type SwapStatus = 'OPEN' | 'MATCHED' | 'ACCEPTED' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED' | 'WITHDRAWN';
export type SwapReason = 'elderly' | 'medical' | 'family' | 'preference';
export type SeatType = 'LOWER' | 'MIDDLE' | 'UPPER' | 'SIDE_LOWER' | 'SIDE_UPPER';

export interface LocalSwap {
    id: string;                      // UUID — unique across all devices
    deviceId: string;                // Who created this (hashed fingerprint)
    trainNo: string;
    journeyDate: string;
    currentCoachId: string;
    currentSeatNo: number;
    currentSeatType: SeatType;
    desiredSeatType: SeatType;
    status: SwapStatus;
    reason: SwapReason;
    priorityScore: number;           // Computed on creation, decays over time
    matchedWith: string | null;      // ID of matched swap
    sessionId: string | null;        // Group ID for multi-party swaps
    expiresAt: number;               // Unix timestamp — auto-expire after 6 hours
    createdAt: number;               // Unix timestamp
    updatedAt: number;               // Unix timestamp
    isLocal: boolean;                // true = created on this device
    boardingStation: string | null;  // Station code where user boards (for geofencing)
    destinationStation: string | null; // Station code where user exits (for geofencing)
}

export interface SwapEvent {
    id: string;
    swapId: string;
    eventType: 'CREATED' | 'MATCHED' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED' | 'EXPIRED' | 'COMPLETED' | 'WITHDRAWN' | 'RECEIVED_VIA_MESH';
    actorId: string;
    metadata?: Record<string, any>;
    timestamp: number;
}

export interface SwapSession {
    id: string;
    type: 'DIRECT' | 'TRIANGULAR' | 'CHAIN';
    status: 'PENDING' | 'ACCEPTED' | 'COMPLETED' | 'FAILED';
    participantIds: string[];    // Swap IDs
    acceptedBy: string[];        // Device IDs who accepted
    totalRequired: number;
    createdAt: number;
    completedAt: number | null;
}

export interface SwapAnalytics {
    totalOffers: number;
    activeOffers: number;
    completedSwaps: number;
    avgMatchTimeMinutes: number;
    demandHeatmap: Record<SeatType, { wanted: number; offered: number }>;
    topDesired: SeatType;
    topOffered: SeatType;
    successRate: number;         // 0 to 1
}

// --- Device Identity (No Login) ---

/**
 * Get or create a persistent anonymous device fingerprint.
 * 
 * We generate a random hex string on first launch and store it forever.
 * No account, no PII, no login. Just a unique device tag.
 */
export async function getOrCreateDeviceId(): Promise<string> {
    try {
        const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
        if (existing) return existing;

        // Generate a random 32-char hex string as our fingerprint
        const segments = [];
        for (let i = 0; i < 32; i++) {
            segments.push(Math.floor(Math.random() * 16).toString(16));
        }
        const newId = segments.join('');
        await AsyncStorage.setItem(DEVICE_ID_KEY, newId);
        return newId;
    } catch {
        // Fallback — won't persist but at least the app works
        return 'fallback_' + Date.now().toString(36);
    }
}

// --- Internal Helpers ---

async function loadSwaps(): Promise<LocalSwap[]> {
    try {
        const raw = await AsyncStorage.getItem(SWAPS_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

async function saveSwaps(swaps: LocalSwap[]): Promise<void> {
    await AsyncStorage.setItem(SWAPS_KEY, JSON.stringify(swaps));
}

async function loadEvents(): Promise<SwapEvent[]> {
    try {
        const raw = await AsyncStorage.getItem(EVENTS_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

async function saveEvents(events: SwapEvent[]): Promise<void> {
    // Keep last 500 events to avoid storage bloat
    await AsyncStorage.setItem(EVENTS_KEY, JSON.stringify(events.slice(-500)));
}

async function loadSessions(): Promise<SwapSession[]> {
    try {
        const raw = await AsyncStorage.getItem(SESSIONS_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

async function saveSessions(sessions: SwapSession[]): Promise<void> {
    await AsyncStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
}

function generateId(): string {
    // Simple UUID v4 generator — good enough for our needs
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === 'x' ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

/**
 * Compute priority score from reason + wait time.
 * 
 * Reason bonuses:
 *   elderly=0.30, medical=0.25, family=0.15, preference=0.05
 * 
 * Wait time bonus: logarithmic scale, max +0.30
 *   Waiting 1 hour = ~0.15 bonus, 3 hours = ~0.25, 6 hours = ~0.30
 * 
 * Base score: 0.20
 * Total range: 0.25 to 0.85
 */
function computePriorityScore(reason: SwapReason, createdAt: number): number {
    const reasonBonus: Record<SwapReason, number> = {
        elderly: 0.30,
        medical: 0.25,
        family: 0.15,
        preference: 0.05,
    };

    const waitHours = Math.max(0, (Date.now() - createdAt) / 3600000);
    const waitBonus = Math.min(0.30, Math.log(1 + waitHours) * 0.17);

    return parseFloat((0.20 + (reasonBonus[reason] || 0.05) + waitBonus).toFixed(3));
}

// --- Input Validation ---

function sanitizeString(input: string, maxLength: number): string {
    return input.replace(/[^a-zA-Z0-9\-_]/g, '').substring(0, maxLength);
}

function validateSwapInput(params: {
    trainNo: string;
    journeyDate: string;
    currentCoachId: string;
    currentSeatNo: number;
    currentSeatType: SeatType;
    desiredSeatType: SeatType;
    reason: SwapReason;
}): string | null {
    // Train number: 4-5 digits only
    if (!/^\d{4,5}$/.test(params.trainNo)) return 'Invalid train number';

    // Journey date: YYYY-MM-DD format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(params.journeyDate)) return 'Invalid date format';

    // Coach ID: 1-4 alphanumeric characters
    if (!/^[A-Za-z0-9]{1,4}$/.test(params.currentCoachId)) return 'Invalid coach ID';

    // Seat number: 1 to MAX_SEAT_NUMBER
    if (!Number.isInteger(params.currentSeatNo) || params.currentSeatNo < 1 || params.currentSeatNo > MAX_SEAT_NUMBER) {
        return 'Invalid seat number';
    }

    // Seat types must be valid
    if (!VALID_SEAT_TYPES.includes(params.currentSeatType)) return 'Invalid current seat type';
    if (!VALID_SEAT_TYPES.includes(params.desiredSeatType)) return 'Invalid desired seat type';

    // Can't swap same type
    if (params.currentSeatType === params.desiredSeatType) return 'Current and desired seat types must be different';

    // Reason must be valid
    if (!VALID_REASONS.includes(params.reason)) return 'Invalid reason';

    return null; // All good
}

function isValidRemoteSwap(swap: any): boolean {
    // Validate structure of a swap received via mesh or cloud
    if (!swap || typeof swap !== 'object') return false;
    // Cloud IDs can be short like "cloud_5" (7 chars), so we allow minimum 3
    if (typeof swap.id !== 'string' || swap.id.length < 3) return false;
    if (typeof swap.deviceId !== 'string' || swap.deviceId.length < 3) return false;
    if (!/^\d{4,5}$/.test(swap.trainNo)) return false;
    if (typeof swap.currentSeatNo !== 'number' || swap.currentSeatNo < 1 || swap.currentSeatNo > MAX_SEAT_NUMBER) return false;
    if (!VALID_SEAT_TYPES.includes(swap.currentSeatType)) return false;
    if (!VALID_SEAT_TYPES.includes(swap.desiredSeatType)) return false;

    // Server/Device clocks can drift. Let's just ensure it hasn't expired yet.
    if (typeof swap.expiresAt === 'number' && swap.expiresAt < Date.now()) return false;

    return true;
}

// --- Storage Management ---

async function enforceStorageCap(swaps: LocalSwap[]): Promise<LocalSwap[]> {
    if (swaps.length <= MAX_TOTAL_SWAPS_STORED) return swaps;

    // Remove oldest terminal-state swaps first (COMPLETED, CANCELLED, EXPIRED, WITHDRAWN)
    const terminal = ['COMPLETED', 'CANCELLED', 'EXPIRED', 'WITHDRAWN'];
    const sorted = [...swaps].sort((a, b) => a.updatedAt - b.updatedAt);
    const toRemove = sorted.filter(s => terminal.includes(s.status));

    let trimmed = [...swaps];
    while (trimmed.length > MAX_TOTAL_SWAPS_STORED && toRemove.length > 0) {
        const oldest = toRemove.shift()!;
        trimmed = trimmed.filter(s => s.id !== oldest.id);
    }

    return trimmed;
}

// --- Public API ---

/**
 * Create a new swap request, stored locally on this device.
 * Validates all input, enforces rate limits, and sets 6-hour expiry.
 */
export async function createLocalSwap(params: {
    trainNo: string;
    journeyDate: string;
    currentCoachId: string;
    currentSeatNo: number;
    currentSeatType: SeatType;
    desiredSeatType: SeatType;
    reason: SwapReason;
    boardingStation?: string | null;
    destinationStation?: string | null;
}): Promise<LocalSwap> {
    const unlock = await storeMutex.lock();
    try {
        // Validate input
        const validationError = validateSwapInput(params);
        if (validationError) throw new Error(validationError);

        const deviceId = await getOrCreateDeviceId();
        const swaps = await loadSwaps();

        // Rate limit: max active swaps per device
        const myActiveSwaps = swaps.filter(s => s.deviceId === deviceId && (s.status === 'OPEN' || s.status === 'MATCHED'));
        if (myActiveSwaps.length >= MAX_ACTIVE_SWAPS_PER_DEVICE) {
            throw new Error(`You already have ${MAX_ACTIVE_SWAPS_PER_DEVICE} active swap offers. Cancel one first.`);
        }

    // Duplicate check: same device, same seat
    const duplicate = swaps.find(
        s => s.deviceId === deviceId &&
            s.trainNo === params.trainNo &&
            s.currentSeatNo === params.currentSeatNo &&
            s.journeyDate === params.journeyDate &&
            s.status === 'OPEN'
    );
    if (duplicate) throw new Error('You already have a swap offer for this seat.');

    const now = Date.now();
    const swap: LocalSwap = {
        id: generateId(),
        deviceId,
        trainNo: sanitizeString(params.trainNo, 5),
        journeyDate: params.journeyDate,
        currentCoachId: sanitizeString(params.currentCoachId, MAX_COACH_ID_LENGTH).toUpperCase(),
        currentSeatNo: params.currentSeatNo,
        currentSeatType: params.currentSeatType,
        desiredSeatType: params.desiredSeatType,
        status: 'OPEN',
        reason: params.reason,
        priorityScore: computePriorityScore(params.reason, now),
        matchedWith: null,
        sessionId: null,
        expiresAt: now + 6 * 60 * 60 * 1000, // 6 hours from now
        createdAt: now,
        updatedAt: now,
        isLocal: true,
        boardingStation: params.boardingStation ?? null,
        destinationStation: params.destinationStation ?? null,
    };

        swaps.push(swap);
        const capped = await enforceStorageCap(swaps);
        await saveSwaps(capped);

        // Log the creation event
        await logSwapEvent(swap.id, 'CREATED', deviceId, {
            reason: params.reason,
            priorityScore: swap.priorityScore,
        });

        return swap;
    } finally {
        unlock();
    }
}

/**
 * Get all known swaps for a specific train/date.
 * Includes both local and peer-received swaps.
 * Auto-prunes expired ones before returning.
 */
export async function getSwapsForTrain(trainNo: string, journeyDate: string): Promise<LocalSwap[]> {
    await pruneExpired();
    const swaps = await loadSwaps();
    return swaps
        .filter(s => s.trainNo === trainNo && s.journeyDate === journeyDate)
        .sort((a, b) => b.priorityScore - a.priorityScore);
}

/**
 * Get only swaps created by this device.
 */
export async function getMySwaps(): Promise<LocalSwap[]> {
    const deviceId = await getOrCreateDeviceId();
    const swaps = await loadSwaps();
    return swaps.filter(s => s.deviceId === deviceId);
}

/**
 * Get all open offers for a train (excluding own).
 */
export async function browseOffers(trainNo: string, journeyDate: string): Promise<LocalSwap[]> {
    const deviceId = await getOrCreateDeviceId();
    const all = await getSwapsForTrain(trainNo, journeyDate);
    return all.filter(s => s.status === 'OPEN' && s.deviceId !== deviceId);
}

/**
 * CRDT-inspired merge for conflict-free sync with peers.
 * 
 * Rules:
 * 1. If we don't have this swap, add it
 * 2. If we do have it and the remote version is newer, update ours
 * 3. Never overwrite local-created swaps with remote versions
 * 4. Deduplicate by (deviceId, trainNo, currentSeatNo, journeyDate)
 */
export async function mergeRemoteSwaps(remoteSwaps: LocalSwap[]): Promise<{ added: number; updated: number }> {
    const unlock = await storeMutex.lock();
    try {
        const swaps = await loadSwaps();
        const deviceId = await getOrCreateDeviceId();
        let added = 0;
        let updated = 0;

    for (const remote of remoteSwaps) {
        // Security: validate incoming swap structure
        if (!isValidRemoteSwap(remote)) continue;

        // Don't merge our own swaps back
        if (remote.deviceId === deviceId) continue;

        // Find by unique key: (deviceId + trainNo + coachId + seatNo + journeyDate)
        const existingIdx = swaps.findIndex(
            s => s.deviceId === remote.deviceId &&
                s.trainNo === remote.trainNo &&
                s.currentCoachId === remote.currentCoachId &&
                s.currentSeatNo === remote.currentSeatNo &&
                s.journeyDate === remote.journeyDate
        );

        if (existingIdx === -1) {
            // New swap from a peer — add it
            swaps.push({ ...remote, isLocal: false });
            added++;
            await logSwapEvent(remote.id, 'RECEIVED_VIA_MESH', deviceId, {
                fromDevice: remote.deviceId.substring(0, 8),
            });
        } else if (remote.updatedAt > swaps[existingIdx].updatedAt) {
            // Peer has a newer version — update ours
            swaps[existingIdx] = { ...remote, isLocal: false };
            updated++;
        }
    }

        if (added > 0 || updated > 0) {
            const capped = await enforceStorageCap(swaps);
            await saveSwaps(capped);
        }

        return { added, updated };
    } finally {
        unlock();
    }
}

/**
 * Update the status of a swap.
 * Only allows valid transitions.
 */
export async function updateSwapStatus(
    swapId: string,
    newStatus: SwapStatus,
    metadata?: Record<string, any>
): Promise<LocalSwap | null> {
    const unlock = await storeMutex.lock();
    try {
        const swaps = await loadSwaps();
        const idx = swaps.findIndex(s => s.id === swapId);
        if (idx === -1) return null;

        const swap = swaps[idx];
        const validTransitions: Record<SwapStatus, SwapStatus[]> = {
        OPEN: ['MATCHED', 'CANCELLED', 'EXPIRED', 'WITHDRAWN'],
        MATCHED: ['ACCEPTED', 'CANCELLED', 'EXPIRED', 'WITHDRAWN'],
        ACCEPTED: ['COMPLETED', 'CANCELLED'],
        COMPLETED: [],
        CANCELLED: [],
        EXPIRED: [],
        WITHDRAWN: [],
    };

    if (!validTransitions[swap.status]?.includes(newStatus)) {
        return null; // Invalid transition
    }

        swap.status = newStatus;
        swap.updatedAt = Date.now();
        swaps[idx] = swap;
        await saveSwaps(swaps);

        const deviceId = await getOrCreateDeviceId();
        await logSwapEvent(swapId, newStatus as SwapEvent['eventType'], deviceId, metadata);

        return swap;
    } finally {
        unlock();
    }
}

/**
 * Accept a match — update both swaps and the session.
 */
export async function acceptMatch(swapId: string, matchedSwapId: string): Promise<boolean> {
    const unlock = await storeMutex.lock();
    try {
        const swaps = await loadSwaps();
        const deviceId = await getOrCreateDeviceId();

        const mySwap = swaps.find(s => s.id === swapId && s.deviceId === deviceId);
        const theirSwap = swaps.find(s => s.id === matchedSwapId);

        if (!mySwap || !theirSwap) return false;

    // Create or update session
    const session: SwapSession = {
        id: generateId(),
        type: 'DIRECT',
        status: 'ACCEPTED',
        participantIds: [swapId, matchedSwapId],
        acceptedBy: [deviceId],
        totalRequired: 2,
        createdAt: Date.now(),
        completedAt: null,
    };

        mySwap.status = 'ACCEPTED';
        mySwap.matchedWith = matchedSwapId;
        mySwap.sessionId = session.id;
        mySwap.updatedAt = Date.now();

        // Mark theirs as matched (they'll need to accept too via mesh)
        theirSwap.status = 'MATCHED';
        theirSwap.matchedWith = swapId;
        theirSwap.sessionId = session.id;
        theirSwap.updatedAt = Date.now();

        await saveSwaps(swaps);

        const sessions = await loadSessions();
        sessions.push(session);
        await saveSessions(sessions);

        await logSwapEvent(swapId, 'ACCEPTED', deviceId, {
            matchedWith: matchedSwapId,
            sessionId: session.id,
        });

        return true;
    } finally {
        unlock();
    }
}

/**
 * Cancel own swap offer.
 */
export async function cancelSwap(swapId: string): Promise<boolean> {
    const deviceId = await getOrCreateDeviceId();
    const swaps = await loadSwaps();
    const swap = swaps.find(s => s.id === swapId && s.deviceId === deviceId);
    if (!swap) return false;

    const result = await updateSwapStatus(swapId, 'CANCELLED');
    return result !== null;
}

/**
 * Log an append-only swap event for audit trail.
 */
export async function logSwapEvent(
    swapId: string,
    eventType: SwapEvent['eventType'],
    actorId: string,
    metadata?: Record<string, any>
): Promise<void> {
    const events = await loadEvents();
    events.push({
        id: generateId(),
        swapId,
        eventType,
        actorId,
        metadata,
        timestamp: Date.now(),
    });
    await saveEvents(events);
}

/**
 * Clean up expired swaps. Runs automatically before reads.
 */
export async function pruneExpired(): Promise<number> {
    const unlock = await storeMutex.lock();
    try {
        const swaps = await loadSwaps();
        const now = Date.now();
        let pruned = 0;
        const deviceId = await getOrCreateDeviceId();

    for (const swap of swaps) {
        if (swap.status === 'OPEN' && swap.expiresAt < now) {
            swap.status = 'EXPIRED';
            swap.updatedAt = now;
            pruned++;
            await logSwapEvent(swap.id, 'EXPIRED', deviceId, { expiredAt: now });
        }
    }

        if (pruned > 0) {
            await saveSwaps(swaps);
        }

        return pruned;
    } finally {
        unlock();
    }
}

/**
 * Compute analytics from local data.
 * Everything calculated on-device — no server needed.
 */
export async function getSwapAnalytics(trainNo: string, journeyDate: string): Promise<SwapAnalytics> {
    const swaps = await loadSwaps();
    const relevant = swaps.filter(s => s.trainNo === trainNo && s.journeyDate === journeyDate);
    const events = await loadEvents();

    const seatTypes: SeatType[] = ['LOWER', 'MIDDLE', 'UPPER', 'SIDE_LOWER', 'SIDE_UPPER'];
    const heatmap: Record<SeatType, { wanted: number; offered: number }> = {} as any;
    for (const st of seatTypes) {
        heatmap[st] = { wanted: 0, offered: 0 };
    }

    let totalOffers = 0;
    let activeOffers = 0;
    let completedSwaps = 0;
    let totalMatchTime = 0;
    let matchCount = 0;

    for (const swap of relevant) {
        totalOffers++;
        if (swap.status === 'OPEN') activeOffers++;
        if (swap.status === 'COMPLETED') completedSwaps++;

        if (swap.status !== 'CANCELLED' && swap.status !== 'EXPIRED' && swap.status !== 'WITHDRAWN') {
            if (heatmap[swap.desiredSeatType]) heatmap[swap.desiredSeatType].wanted++;
            if (heatmap[swap.currentSeatType]) heatmap[swap.currentSeatType].offered++;
        }

        // Calculate match time from events
        if (swap.status === 'MATCHED' || swap.status === 'ACCEPTED' || swap.status === 'COMPLETED') {
            const createEvent = events.find(e => e.swapId === swap.id && e.eventType === 'CREATED');
            const matchEvent = events.find(e => e.swapId === swap.id && e.eventType === 'MATCHED');
            if (createEvent && matchEvent) {
                totalMatchTime += (matchEvent.timestamp - createEvent.timestamp) / 60000;
                matchCount++;
            }
        }
    }

    // Find most wanted and most offered
    let topDesired: SeatType = 'LOWER';
    let topOffered: SeatType = 'UPPER';
    let maxWanted = 0;
    let maxOffered = 0;
    for (const st of seatTypes) {
        if (heatmap[st].wanted > maxWanted) { maxWanted = heatmap[st].wanted; topDesired = st; }
        if (heatmap[st].offered > maxOffered) { maxOffered = heatmap[st].offered; topOffered = st; }
    }

    return {
        totalOffers,
        activeOffers,
        completedSwaps,
        avgMatchTimeMinutes: matchCount > 0 ? Math.round(totalMatchTime / matchCount) : 0,
        demandHeatmap: heatmap,
        topDesired,
        topOffered,
        successRate: totalOffers > 0 ? parseFloat((completedSwaps / totalOffers).toFixed(2)) : 0,
    };
}

/**
 * Get the event log for a specific swap.
 */
export async function getSwapEvents(swapId: string): Promise<SwapEvent[]> {
    const events = await loadEvents();
    return events.filter(e => e.swapId === swapId).sort((a, b) => a.timestamp - b.timestamp);
}

/**
 * Get a session by ID.
 */
export async function getSession(sessionId: string): Promise<SwapSession | null> {
    const sessions = await loadSessions();
    return sessions.find(s => s.id === sessionId) || null;
}

/**
 * Wipe everything — for development/testing only.
 */
export async function clearAllSwapData(): Promise<void> {
    await AsyncStorage.multiRemove([DEVICE_ID_KEY, SWAPS_KEY, EVENTS_KEY, SESSIONS_KEY]);
}

/**
 * Remove any swap offers that were injected by the mock mesh bridge.
 * Only removes swaps from the MockMeshBridge simulation (deviceId 'peer_*'/'mock_peer_*').
 * Preserves legitimate remote swaps from cloud sync and real P2P connections.
 * Call this on app startup when switching from dev to production mode.
 */
export async function clearMockSwapData(): Promise<void> {
    const unlock = await storeMutex.lock();
    try {
        const swaps = await loadSwaps();
        // Only remove mock-simulated swaps, NOT real cloud/P2P synced data
        const isMockSwap = (s: LocalSwap): boolean => {
            return (s.deviceId.startsWith('peer_') || s.deviceId.startsWith('mock_peer_'))
                && s.isLocal === false;
        };
        const kept = swaps.filter(s => !isMockSwap(s));
        const removedCount = swaps.length - kept.length;
        if (removedCount > 0) {
            console.log(`[SwapStore] Cleared ${removedCount} mock swap(s), kept ${kept.length} (including remote synced)`);
            await saveSwaps(kept);
        }
    } finally {
        unlock();
    }
}
