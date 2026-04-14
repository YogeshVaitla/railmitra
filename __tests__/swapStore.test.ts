/**
 * ============================================================
 *   RM-SW-041: Swap Store — Exhaustive Unit Tests
 * ============================================================
 *
 * Coverage targets:
 *   CRDT Merge         — V1→V2 update, V2→V1 ignore, dedup
 *   Rate Limiting       — 4th swap rejection per deviceId
 *   Storage Cap         — 201st swap eviction
 *   Input Validation    — fuzz trainNo, coachId, seatNo
 *   Status Transitions  — all valid + invalid paths
 */

import AsyncStorage from '../__mocks__/@react-native-async-storage/async-storage';
import { __reset } from '../__mocks__/@react-native-async-storage/async-storage';
import {
  createLocalSwap,
  getSwapsForTrain,
  getMySwaps,
  mergeRemoteSwaps,
  updateSwapStatus,
  acceptMatch,
  cancelSwap,
  pruneExpired,
  clearAllSwapData,
  LocalSwap,
} from '../services/swapStore';

beforeEach(async () => {
  __reset();
});

// Valid params for quick swap creation
const VALID_PARAMS = {
  trainNo: '12301',
  journeyDate: '2026-03-15',
  currentCoachId: 'B3',
  currentSeatNo: 42,
  currentSeatType: 'UPPER' as const,
  desiredSeatType: 'LOWER' as const,
  reason: 'preference' as const,
};

// Helper: make a valid remote swap for CRDT tests
function makeRemote(overrides: Partial<LocalSwap> = {}): LocalSwap {
  const now = Date.now();
  return {
    id: 'remote_' + Math.random().toString(36).substring(7),
    deviceId: 'peer_' + Math.random().toString(36).substring(7),
    trainNo: '12301', journeyDate: '2026-03-15',
    currentCoachId: 'B1', currentSeatNo: Math.floor(Math.random() * 70) + 1,
    currentSeatType: 'LOWER', desiredSeatType: 'UPPER',
    status: 'OPEN', reason: 'preference', priorityScore: 0.25,
    matchedWith: null, sessionId: null,
    expiresAt: now + 3600000, createdAt: now, updatedAt: now,
    isLocal: false,
    boardingStation: null,
    destinationStation: null,
    ...overrides,
  };
}

// ===========================================================
// 1. INPUT VALIDATION (with fuzzing)
// ===========================================================

describe('SwapStore — Input Validation', () => {
  test('invalid train number (3 digits) throws', async () => {
    await expect(createLocalSwap({ ...VALID_PARAMS, trainNo: '123' }))
      .rejects.toThrow('Invalid train number');
  });

  test('invalid train number (6 digits) throws', async () => {
    await expect(createLocalSwap({ ...VALID_PARAMS, trainNo: '123456' }))
      .rejects.toThrow('Invalid train number');
  });

  test('invalid train number (letters) throws', async () => {
    await expect(createLocalSwap({ ...VALID_PARAMS, trainNo: 'ABCD' }))
      .rejects.toThrow('Invalid train number');
  });

  test('invalid train number (mixed) throws', async () => {
    await expect(createLocalSwap({ ...VALID_PARAMS, trainNo: '12A4' }))
      .rejects.toThrow('Invalid train number');
  });

  test('invalid date format (DD-MM-YYYY) throws', async () => {
    await expect(createLocalSwap({ ...VALID_PARAMS, journeyDate: '15-03-2026' }))
      .rejects.toThrow('Invalid date format');
  });

  test('invalid coach ID (special chars) throws', async () => {
    await expect(createLocalSwap({ ...VALID_PARAMS, currentCoachId: 'B@3!' }))
      .rejects.toThrow('Invalid coach ID');
  });

  test('invalid coach ID (>4 chars) throws', async () => {
    await expect(createLocalSwap({ ...VALID_PARAMS, currentCoachId: 'ABCDE' }))
      .rejects.toThrow('Invalid coach ID');
  });

  test('invalid coach ID (empty string) throws', async () => {
    await expect(createLocalSwap({ ...VALID_PARAMS, currentCoachId: '' }))
      .rejects.toThrow('Invalid coach ID');
  });

  test('invalid seat number (0) throws', async () => {
    await expect(createLocalSwap({ ...VALID_PARAMS, currentSeatNo: 0 }))
      .rejects.toThrow('Invalid seat number');
  });

  test('invalid seat number (81, exceeds MAX_SEAT_NUMBER) throws', async () => {
    await expect(createLocalSwap({ ...VALID_PARAMS, currentSeatNo: 81 }))
      .rejects.toThrow('Invalid seat number');
  });

  test('invalid seat number (negative) throws', async () => {
    await expect(createLocalSwap({ ...VALID_PARAMS, currentSeatNo: -1 }))
      .rejects.toThrow('Invalid seat number');
  });

  test('invalid seat number (decimal/non-integer) throws', async () => {
    await expect(createLocalSwap({ ...VALID_PARAMS, currentSeatNo: 42.5 }))
      .rejects.toThrow('Invalid seat number');
  });

  test('invalid seat number (very large) throws', async () => {
    await expect(createLocalSwap({ ...VALID_PARAMS, currentSeatNo: 9999 }))
      .rejects.toThrow('Invalid seat number');
  });

  test('invalid current seat type throws', async () => {
    await expect(createLocalSwap({ ...VALID_PARAMS, currentSeatType: 'WINDOW' as any }))
      .rejects.toThrow('Invalid current seat type');
  });

  test('invalid desired seat type throws', async () => {
    await expect(createLocalSwap({ ...VALID_PARAMS, desiredSeatType: 'AISLE' as any }))
      .rejects.toThrow('Invalid desired seat type');
  });

  test('same current and desired seat type throws', async () => {
    await expect(createLocalSwap({ ...VALID_PARAMS, desiredSeatType: 'UPPER' }))
      .rejects.toThrow('Current and desired seat types must be different');
  });

  test('invalid reason throws', async () => {
    await expect(createLocalSwap({ ...VALID_PARAMS, reason: 'bored' as any }))
      .rejects.toThrow('Invalid reason');
  });

  test('valid input creates swap successfully', async () => {
    const swap = await createLocalSwap(VALID_PARAMS);
    expect(swap.id).toBeDefined();
    expect(swap.status).toBe('OPEN');
    expect(swap.isLocal).toBe(true);
    expect(swap.trainNo).toBe('12301');
    expect(swap.currentSeatType).toBe('UPPER');
    expect(swap.desiredSeatType).toBe('LOWER');
  });

  test('valid 5-digit train number works', async () => {
    const swap = await createLocalSwap({ ...VALID_PARAMS, trainNo: '22301' });
    expect(swap.trainNo).toBe('22301');
  });

  test('coach ID is uppercased', async () => {
    const swap = await createLocalSwap({ ...VALID_PARAMS, currentCoachId: 'b3' });
    expect(swap.currentCoachId).toBe('B3');
  });

  test('seat at boundary (1) is valid', async () => {
    const swap = await createLocalSwap({ ...VALID_PARAMS, currentSeatNo: 1 });
    expect(swap.currentSeatNo).toBe(1);
  });

  test('seat at boundary (80) is valid', async () => {
    const swap = await createLocalSwap({ ...VALID_PARAMS, currentSeatNo: 80 });
    expect(swap.currentSeatNo).toBe(80);
  });
});

// ===========================================================
// 2. RATE LIMITING
// ===========================================================

describe('SwapStore — Rate Limiting', () => {
  test('can create up to 3 active swaps', async () => {
    await createLocalSwap({ ...VALID_PARAMS, currentSeatNo: 1 });
    await createLocalSwap({ ...VALID_PARAMS, currentSeatNo: 2 });
    await createLocalSwap({ ...VALID_PARAMS, currentSeatNo: 3 });
    const my = await getMySwaps();
    expect(my).toHaveLength(3);
  });

  test('4th active swap for same device throws', async () => {
    await createLocalSwap({ ...VALID_PARAMS, currentSeatNo: 1 });
    await createLocalSwap({ ...VALID_PARAMS, currentSeatNo: 2 });
    await createLocalSwap({ ...VALID_PARAMS, currentSeatNo: 3 });
    await expect(createLocalSwap({ ...VALID_PARAMS, currentSeatNo: 4 }))
      .rejects.toThrow(/already have 3 active/);
  });

  test('cancelled swap does not count toward rate limit', async () => {
    const swap1 = await createLocalSwap({ ...VALID_PARAMS, currentSeatNo: 1 });
    await createLocalSwap({ ...VALID_PARAMS, currentSeatNo: 2 });
    await createLocalSwap({ ...VALID_PARAMS, currentSeatNo: 3 });

    // Cancel first → now we have 2 active
    await updateSwapStatus(swap1.id, 'CANCELLED');

    // Should now allow a 4th creation (slot freed)
    const swap4 = await createLocalSwap({ ...VALID_PARAMS, currentSeatNo: 4 });
    expect(swap4.status).toBe('OPEN');
  });

  test('duplicate same-seat swap throws', async () => {
    await createLocalSwap(VALID_PARAMS);
    await expect(createLocalSwap(VALID_PARAMS))
      .rejects.toThrow(/already have a swap offer for this seat/);
  });
});

// ===========================================================
// 3. CRDT MERGE
// ===========================================================

describe('SwapStore — CRDT Merge', () => {
  test('new remote swap is added to local store', async () => {
    const remote = makeRemote();
    const result = await mergeRemoteSwaps([remote]);
    expect(result.added).toBe(1);
    expect(result.updated).toBe(0);
  });

  test('V1 local → V2 remote: local updates to V2', async () => {
    const now = Date.now();
    const v1 = makeRemote({ id: 'stable_id', deviceId: 'peer_x', updatedAt: now });
    await mergeRemoteSwaps([v1]);

    const v2 = { ...v1, updatedAt: now + 5000, status: 'MATCHED' as const };
    const result = await mergeRemoteSwaps([v2]);
    expect(result.updated).toBe(1);

    // Verify the stored version is V2
    const swaps = await getSwapsForTrain('12301', '2026-03-15');
    const found = swaps.find(s => s.id === 'stable_id');
    expect(found!.status).toBe('MATCHED');
  });

  test('V2 local → V1 remote: local ignores V1 (newer wins)', async () => {
    const now = Date.now();
    const v2 = makeRemote({ id: 'stable_id', deviceId: 'peer_x', updatedAt: now + 5000 });
    await mergeRemoteSwaps([v2]);

    const v1 = { ...v2, updatedAt: now, status: 'CANCELLED' as const };
    const result = await mergeRemoteSwaps([v1]);
    expect(result.updated).toBe(0);

    // Verify local still has V2 state
    const swaps = await getSwapsForTrain('12301', '2026-03-15');
    const found = swaps.find(s => s.id === 'stable_id');
    expect(found!.status).toBe('OPEN');
  });

  test('deduplication: no phantom copies after repeated merges', async () => {
    const remote = makeRemote({ id: 'dedup_test', deviceId: 'peer_d', currentSeatNo: 42 });
    await mergeRemoteSwaps([remote]);
    await mergeRemoteSwaps([remote]); // Same again
    await mergeRemoteSwaps([remote]); // And again

    const swaps = await getSwapsForTrain('12301', '2026-03-15');
    const copies = swaps.filter(s => s.id === 'dedup_test');
    expect(copies).toHaveLength(1);
  });

  test('invalid remote swap (missing fields) is silently rejected', async () => {
    const invalid = { id: 'x', deviceId: 'y' } as any;
    const result = await mergeRemoteSwaps([invalid]);
    expect(result.added).toBe(0);
  });

  test('expired remote swap is rejected', async () => {
    const expired = makeRemote({ expiresAt: Date.now() - 1000 });
    const result = await mergeRemoteSwaps([expired]);
    expect(result.added).toBe(0);
  });

  test('batch merge: mix of valid and invalid remotes', async () => {
    const valid1 = makeRemote({ currentSeatNo: 1 });
    const valid2 = makeRemote({ currentSeatNo: 2 });
    const invalid = { id: 'bad' } as any;
    const expired = makeRemote({ expiresAt: Date.now() - 1000, currentSeatNo: 3 });

    const result = await mergeRemoteSwaps([valid1, valid2, invalid, expired]);
    expect(result.added).toBe(2);
    // invalid and expired are silently rejected
  });
});

// ===========================================================
// 4. STORAGE CAP EVICTION
// ===========================================================

describe('SwapStore — Storage Cap Eviction', () => {
  test('201st swap triggers eviction of oldest terminal-state swap', async () => {
    // Directly populate storage with 200 COMPLETED swaps
    const now = Date.now();
    const existingSwaps: LocalSwap[] = [];
    for (let i = 0; i < 200; i++) {
      existingSwaps.push({
        id: `bulk_${i}`, deviceId: `bulk_device_${i}`,
        trainNo: '12301', journeyDate: '2026-03-15',
        currentCoachId: 'B1', currentSeatNo: (i % 80) + 1,
        currentSeatType: 'UPPER', desiredSeatType: 'LOWER',
        status: 'COMPLETED', reason: 'preference', priorityScore: 0.25,
        matchedWith: null, sessionId: null,
        expiresAt: now + 3600000,
        createdAt: now - (200 - i) * 60000, // Older first
        updatedAt: now - (200 - i) * 60000,
        isLocal: false,
        boardingStation: null,
        destinationStation: null,
      });
    }
    await AsyncStorage.setItem('@seatseeker_swaps', JSON.stringify(existingSwaps));

    // Merge the 201st swap via remote
    const overflowSwap = makeRemote({ id: 'overflow_201', currentSeatNo: 5 });
    await mergeRemoteSwaps([overflowSwap]);

    // Count total swaps — should be ≤ 200
    const raw = await AsyncStorage.getItem('@seatseeker_swaps');
    const allSwaps = JSON.parse(raw!);
    expect(allSwaps.length).toBeLessThanOrEqual(200);

    // The new swap should be present
    expect(allSwaps.some((s: any) => s.id === 'overflow_201')).toBe(true);

    // The absolute oldest COMPLETED swap should be gone
    expect(allSwaps.some((s: any) => s.id === 'bulk_0')).toBe(false);
  });
});

// ===========================================================
// 5. STATUS TRANSITIONS
// ===========================================================

describe('SwapStore — Status Transitions', () => {
  test('full happy path: OPEN → MATCHED → ACCEPTED → COMPLETED', async () => {
    const swap = await createLocalSwap(VALID_PARAMS);
    expect(swap.status).toBe('OPEN');

    const matched = await updateSwapStatus(swap.id, 'MATCHED');
    expect(matched!.status).toBe('MATCHED');

    const accepted = await updateSwapStatus(swap.id, 'ACCEPTED');
    expect(accepted!.status).toBe('ACCEPTED');

    const completed = await updateSwapStatus(swap.id, 'COMPLETED');
    expect(completed!.status).toBe('COMPLETED');
  });

  test('OPEN → CANCELLED is valid', async () => {
    const swap = await createLocalSwap(VALID_PARAMS);
    const cancelled = await updateSwapStatus(swap.id, 'CANCELLED');
    expect(cancelled!.status).toBe('CANCELLED');
  });

  test('OPEN → COMPLETED is INVALID (skips required stages)', async () => {
    const swap = await createLocalSwap(VALID_PARAMS);
    const result = await updateSwapStatus(swap.id, 'COMPLETED');
    expect(result).toBeNull();
  });

  test('OPEN → ACCEPTED is INVALID (must go through MATCHED first)', async () => {
    const swap = await createLocalSwap(VALID_PARAMS);
    const result = await updateSwapStatus(swap.id, 'ACCEPTED');
    expect(result).toBeNull();
  });

  test('COMPLETED → OPEN is INVALID (terminal state)', async () => {
    const swap = await createLocalSwap(VALID_PARAMS);
    await updateSwapStatus(swap.id, 'MATCHED');
    await updateSwapStatus(swap.id, 'ACCEPTED');
    await updateSwapStatus(swap.id, 'COMPLETED');
    const result = await updateSwapStatus(swap.id, 'OPEN');
    expect(result).toBeNull();
  });

  test('COMPLETED → CANCELLED is INVALID (terminal state)', async () => {
    const swap = await createLocalSwap(VALID_PARAMS);
    await updateSwapStatus(swap.id, 'MATCHED');
    await updateSwapStatus(swap.id, 'ACCEPTED');
    await updateSwapStatus(swap.id, 'COMPLETED');
    const result = await updateSwapStatus(swap.id, 'CANCELLED');
    expect(result).toBeNull();
  });

  test('CANCELLED is terminal — cannot transition further', async () => {
    const swap = await createLocalSwap(VALID_PARAMS);
    await updateSwapStatus(swap.id, 'CANCELLED');
    expect(await updateSwapStatus(swap.id, 'OPEN')).toBeNull();
    expect(await updateSwapStatus(swap.id, 'MATCHED')).toBeNull();
  });

  test('EXPIRED is terminal', async () => {
    const swap = await createLocalSwap(VALID_PARAMS);
    // Manually set to EXPIRED via storage tampering (simulating pruneExpired)
    const raw = await AsyncStorage.getItem('@seatseeker_swaps');
    const swaps = JSON.parse(raw!);
    swaps[0].status = 'EXPIRED';
    await AsyncStorage.setItem('@seatseeker_swaps', JSON.stringify(swaps));

    expect(await updateSwapStatus(swap.id, 'OPEN')).toBeNull();
  });

  test('MATCHED → CANCELLED is valid (reject a match)', async () => {
    const swap = await createLocalSwap(VALID_PARAMS);
    await updateSwapStatus(swap.id, 'MATCHED');
    const result = await updateSwapStatus(swap.id, 'CANCELLED');
    expect(result!.status).toBe('CANCELLED');
  });

  test('nonexistent swap ID returns null', async () => {
    const result = await updateSwapStatus('fake-id-999', 'MATCHED');
    expect(result).toBeNull();
  });
});

// ===========================================================
// 6. EXPIRY PRUNING
// ===========================================================

describe('SwapStore — Expiry Pruning', () => {
  test('expired OPEN swaps are marked EXPIRED', async () => {
    const swap = await createLocalSwap(VALID_PARAMS);

    // Tamper with storage to expire the swap
    const raw = await AsyncStorage.getItem('@seatseeker_swaps');
    const swaps = JSON.parse(raw!);
    swaps[0].expiresAt = Date.now() - 1000;
    await AsyncStorage.setItem('@seatseeker_swaps', JSON.stringify(swaps));

    const pruned = await pruneExpired();
    expect(pruned).toBe(1);

    const my = await getMySwaps();
    expect(my[0].status).toBe('EXPIRED');
  });

  test('non-OPEN swaps are not affected by expiry pruning', async () => {
    const swap = await createLocalSwap(VALID_PARAMS);
    await updateSwapStatus(swap.id, 'CANCELLED');

    // Tamper with expiresAt to be in the past
    const raw = await AsyncStorage.getItem('@seatseeker_swaps');
    const swaps = JSON.parse(raw!);
    swaps[0].expiresAt = Date.now() - 1000;
    await AsyncStorage.setItem('@seatseeker_swaps', JSON.stringify(swaps));

    const pruned = await pruneExpired();
    expect(pruned).toBe(0); // Already CANCELLED, not pruned again
  });
});

// ===========================================================
// 7. PRIORITY SCORING
// ===========================================================

describe('SwapStore — Priority Scoring', () => {
  test('elderly gets highest priority', async () => {
    const elderly = await createLocalSwap({ ...VALID_PARAMS, reason: 'elderly', currentSeatNo: 1 });
    const pref = await createLocalSwap({ ...VALID_PARAMS, reason: 'preference', currentSeatNo: 2 });
    expect(elderly.priorityScore).toBeGreaterThan(pref.priorityScore);
  });

  test('medical > family > preference', async () => {
    const med = await createLocalSwap({ ...VALID_PARAMS, reason: 'medical', currentSeatNo: 1 });
    const fam = await createLocalSwap({ ...VALID_PARAMS, reason: 'family', currentSeatNo: 2 });
    const pref = await createLocalSwap({ ...VALID_PARAMS, reason: 'preference', currentSeatNo: 3 });
    expect(med.priorityScore).toBeGreaterThan(fam.priorityScore);
    expect(fam.priorityScore).toBeGreaterThan(pref.priorityScore);
  });

  test('full priority hierarchy: elderly > medical > family > preference', async () => {
    const e = await createLocalSwap({ ...VALID_PARAMS, reason: 'elderly', currentSeatNo: 1 });
    const m = await createLocalSwap({ ...VALID_PARAMS, reason: 'medical', currentSeatNo: 2 });
    const f = await createLocalSwap({ ...VALID_PARAMS, reason: 'family', currentSeatNo: 3 });
    expect(e.priorityScore).toBeGreaterThan(m.priorityScore);
    expect(m.priorityScore).toBeGreaterThan(f.priorityScore);
  });
});

// ===========================================================
// 8. SWAP PROPERTIES
// ===========================================================

describe('SwapStore — Swap Properties', () => {
  test('swap has 6-hour expiry', async () => {
    const before = Date.now();
    const swap = await createLocalSwap(VALID_PARAMS);
    const after = Date.now();
    const sixHours = 6 * 60 * 60 * 1000;
    expect(swap.expiresAt).toBeGreaterThanOrEqual(before + sixHours);
    expect(swap.expiresAt).toBeLessThanOrEqual(after + sixHours);
  });

  test('swap has valid UUID-like ID', async () => {
    const swap = await createLocalSwap(VALID_PARAMS);
    expect(swap.id).toMatch(/^[0-9a-f-]+$/);
    expect(swap.id.length).toBeGreaterThanOrEqual(20);
  });

  test('swap isLocal is true for locally created', async () => {
    const swap = await createLocalSwap(VALID_PARAMS);
    expect(swap.isLocal).toBe(true);
  });
});
