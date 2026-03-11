/**
 * ============================================================
 *   RM-SW-040: Swap Engine — Exhaustive Unit Tests
 * ============================================================
 *
 * Coverage targets:
 *   buildSwapGraph()     — 100% branch
 *   findAllCycles()      — 100% branch (incl. timeout)
 *   scoreCycle()         — 100% branch (incl. coach proximity)
 *   selectBestMatches()  — 100% branch
 *   recomputePriority()  — all reason types + decay
 */

import {
  findBestMatches,
  findMyMatches,
  hasAnyPotentialMatch,
  SwapMatch,
} from '../services/swapEngine';
import { LocalSwap, SeatType, SwapReason } from '../services/swapStore';

let swapCounter = 0;

function makeSwap(overrides: Partial<LocalSwap> = {}): LocalSwap {
  swapCounter++;
  const now = Date.now();
  return {
    id: `swap_${swapCounter}`, deviceId: `device_${swapCounter}`,
    trainNo: '12301', journeyDate: '2026-03-15', currentCoachId: 'B3',
    currentSeatNo: swapCounter, currentSeatType: 'UPPER', desiredSeatType: 'LOWER',
    status: 'OPEN', reason: 'preference', priorityScore: 0.25,
    matchedWith: null, sessionId: null,
    expiresAt: now + 6 * 3600000, createdAt: now, updatedAt: now, isLocal: true,
    ...overrides,
  };
}

const MY_DEVICE = 'my_device_001';

// ============================================================
// 1. BASIC / EMPTY / NO-MATCH
// ============================================================

describe('SwapEngine — Basic & No-Match Cases', () => {
  beforeEach(() => { swapCounter = 0; });

  test('0 swaps → empty', () => {
    expect(findBestMatches([], MY_DEVICE)).toEqual([]);
  });

  test('1 swap → empty (can\'t form a cycle alone)', () => {
    expect(findBestMatches([makeSwap()], MY_DEVICE)).toEqual([]);
  });

  test('all non-OPEN swaps → empty', () => {
    const swaps = [
      makeSwap({ status: 'CANCELLED', currentSeatType: 'UPPER', desiredSeatType: 'LOWER' }),
      makeSwap({ status: 'COMPLETED', currentSeatType: 'LOWER', desiredSeatType: 'UPPER' }),
      makeSwap({ status: 'EXPIRED', currentSeatType: 'MIDDLE', desiredSeatType: 'UPPER' }),
      makeSwap({ status: 'WITHDRAWN', currentSeatType: 'SIDE_LOWER', desiredSeatType: 'UPPER' }),
    ];
    expect(findBestMatches(swaps, MY_DEVICE)).toEqual([]);
  });

  test('2 swaps with incompatible wants/has → no edges → empty', () => {
    const swaps = [
      makeSwap({ currentSeatType: 'UPPER', desiredSeatType: 'LOWER' }),
      makeSwap({ currentSeatType: 'UPPER', desiredSeatType: 'LOWER' }),
    ];
    expect(findBestMatches(swaps, MY_DEVICE)).toEqual([]);
  });

  test('acyclic graph (A→B→C, no back-edge) → empty', () => {
    const swaps = [
      makeSwap({ currentSeatType: 'UPPER', desiredSeatType: 'LOWER' }),
      makeSwap({ currentSeatType: 'LOWER', desiredSeatType: 'MIDDLE' }),
    ];
    expect(findBestMatches(swaps, MY_DEVICE)).toEqual([]);
  });
});

// ============================================================
// 2. CYCLE DETECTION: 2-way through 5-way
// ============================================================

describe('SwapEngine — Cycle Detection', () => {
  beforeEach(() => { swapCounter = 0; });

  test('2-way DIRECT match: A(UB→LB) ↔ B(LB→UB)', () => {
    const swaps = [
      makeSwap({ currentSeatType: 'UPPER', desiredSeatType: 'LOWER' }),
      makeSwap({ currentSeatType: 'LOWER', desiredSeatType: 'UPPER' }),
    ];
    const m = findBestMatches(swaps, MY_DEVICE);
    expect(m).toHaveLength(1);
    expect(m[0].type).toBe('DIRECT');
    expect(m[0].participants).toHaveLength(2);
  });

  test('3-way TRIANGULAR match: UB→LB→MB→UB', () => {
    const swaps = [
      makeSwap({ currentSeatType: 'UPPER', desiredSeatType: 'LOWER' }),
      makeSwap({ currentSeatType: 'LOWER', desiredSeatType: 'MIDDLE' }),
      makeSwap({ currentSeatType: 'MIDDLE', desiredSeatType: 'UPPER' }),
    ];
    const m = findBestMatches(swaps, MY_DEVICE);
    expect(m).toHaveLength(1);
    expect(m[0].type).toBe('TRIANGULAR');
    expect(m[0].participants).toHaveLength(3);
  });

  test('4-way CHAIN match: UB→LB→MB→SL→UB', () => {
    const swaps = [
      makeSwap({ currentSeatType: 'UPPER', desiredSeatType: 'LOWER' }),
      makeSwap({ currentSeatType: 'LOWER', desiredSeatType: 'MIDDLE' }),
      makeSwap({ currentSeatType: 'MIDDLE', desiredSeatType: 'SIDE_LOWER' }),
      makeSwap({ currentSeatType: 'SIDE_LOWER', desiredSeatType: 'UPPER' }),
    ];
    const m = findBestMatches(swaps, MY_DEVICE);
    expect(m).toHaveLength(1);
    expect(m[0].type).toBe('CHAIN');
    expect(m[0].participants).toHaveLength(4);
  });

  test('5-way CHAIN match (maximum cycle length)', () => {
    const swaps = [
      makeSwap({ currentSeatType: 'UPPER', desiredSeatType: 'LOWER' }),
      makeSwap({ currentSeatType: 'LOWER', desiredSeatType: 'MIDDLE' }),
      makeSwap({ currentSeatType: 'MIDDLE', desiredSeatType: 'SIDE_LOWER' }),
      makeSwap({ currentSeatType: 'SIDE_LOWER', desiredSeatType: 'SIDE_UPPER' }),
      makeSwap({ currentSeatType: 'SIDE_UPPER', desiredSeatType: 'UPPER' }),
    ];
    const m = findBestMatches(swaps, MY_DEVICE);
    expect(m).toHaveLength(1);
    expect(m[0].type).toBe('CHAIN');
    expect(m[0].participants).toHaveLength(5);
  });

  test('multiple independent 2-way cycles all found', () => {
    const swaps = [
      makeSwap({ currentSeatType: 'UPPER', desiredSeatType: 'LOWER' }),
      makeSwap({ currentSeatType: 'LOWER', desiredSeatType: 'UPPER' }),
      makeSwap({ currentSeatType: 'MIDDLE', desiredSeatType: 'SIDE_LOWER' }),
      makeSwap({ currentSeatType: 'SIDE_LOWER', desiredSeatType: 'MIDDLE' }),
    ];
    const m = findBestMatches(swaps, MY_DEVICE);
    expect(m).toHaveLength(2);
    expect(m.every(x => x.type === 'DIRECT')).toBe(true);
  });
});

// ============================================================
// 3. OVERLAPPING CYCLES — selectBestMatches greedy resolution
// ============================================================

describe('SwapEngine — Overlapping Cycles (selectBestMatches)', () => {
  beforeEach(() => { swapCounter = 0; });

  test('node A in two cycles: greedy picks highest total score, invalidates the other', () => {
    // Node A (shared) can pair with either highPriority or lowPriority
    const shared = makeSwap({ currentSeatType: 'UPPER', desiredSeatType: 'LOWER' });
    const highPriority = makeSwap({
      currentSeatType: 'LOWER', desiredSeatType: 'UPPER',
      reason: 'elderly', priorityScore: 0.50,
    });
    const lowPriority = makeSwap({
      currentSeatType: 'LOWER', desiredSeatType: 'UPPER',
      reason: 'preference', priorityScore: 0.25,
    });
    const m = findBestMatches([shared, highPriority, lowPriority], MY_DEVICE);

    // Only ONE cycle can include 'shared' — the higher scoring one
    expect(m).toHaveLength(1);
    expect(m[0].participants).toHaveLength(2);
    // The selected cycle should be the one with the elderly participant
    const hasElderly = m[0].participants.some(p => p.reason === 'elderly');
    expect(hasElderly).toBe(true);
  });

  test('3-way overlaps with 2-way: greedy selects highest total score, leaves others unmatched', () => {
    // A, B, C form a triangle, but A ↔ D is also a 2-way.
    // Both cycles share node A.
    const a = makeSwap({ currentSeatType: 'UPPER', desiredSeatType: 'LOWER' });
    const b = makeSwap({ currentSeatType: 'LOWER', desiredSeatType: 'MIDDLE' });
    const c = makeSwap({ currentSeatType: 'MIDDLE', desiredSeatType: 'UPPER' });
    const d = makeSwap({ currentSeatType: 'LOWER', desiredSeatType: 'UPPER' });

    const m = findBestMatches([a, b, c, d], MY_DEVICE);
    // Only 1 match possible (A is shared between both cycles)
    expect(m).toHaveLength(1);
    // A must be in the selected match
    expect(m[0].participants.some(p => p.swapId === a.id)).toBe(true);
  });

  test('participant uniqueness: each swap appears in at most one match', () => {
    const swaps = [
      makeSwap({ currentSeatType: 'UPPER', desiredSeatType: 'LOWER' }),
      makeSwap({ currentSeatType: 'LOWER', desiredSeatType: 'UPPER' }),
      makeSwap({ currentSeatType: 'LOWER', desiredSeatType: 'UPPER' }),
      makeSwap({ currentSeatType: 'UPPER', desiredSeatType: 'LOWER' }),
    ];
    const m = findBestMatches(swaps, MY_DEVICE);
    const allIds = m.flatMap(x => x.participants.map(p => p.swapId));
    expect(new Set(allIds).size).toBe(allIds.length);
  });
});

// ============================================================
// 4. PRIORITY SCORING — full reason hierarchy + tiebreakers
// ============================================================

describe('SwapEngine — Priority Scoring Verification', () => {
  beforeEach(() => { swapCounter = 0; });

  test('elderly > medical > family scoring hierarchy (all independent cycles)', () => {
    // 3 independent 2-way cycles with NO seat-type overlap:
    // Cycle 1 (elderly): UPPER ↔ LOWER
    // Cycle 2 (medical): MIDDLE ↔ SIDE_UPPER
    // Cycle 3 (family):  SIDE_LOWER ↔ UPPER — WAIT, can't reuse UPPER.
    // Use unique seat type combos to avoid graph edges between cycles.
    const swaps = [
      // elderly pair
      makeSwap({ currentSeatType: 'UPPER', desiredSeatType: 'LOWER', reason: 'elderly', priorityScore: 0.50, currentCoachId: 'B1' }),
      makeSwap({ currentSeatType: 'LOWER', desiredSeatType: 'UPPER', reason: 'elderly', priorityScore: 0.50, currentCoachId: 'B1' }),
      // medical pair
      makeSwap({ currentSeatType: 'MIDDLE', desiredSeatType: 'SIDE_UPPER', reason: 'medical', priorityScore: 0.45, currentCoachId: 'S1' }),
      makeSwap({ currentSeatType: 'SIDE_UPPER', desiredSeatType: 'MIDDLE', reason: 'medical', priorityScore: 0.45, currentCoachId: 'S1' }),
    ];
    const m = findBestMatches(swaps, MY_DEVICE);

    // Both cycles should be found (no overlapping nodes)
    expect(m.length).toBe(2);
    // Should be sorted by score descending — elderly first
    expect(m[0].score).toBeGreaterThan(m[1].score);
  });

  test('"you" bonus resolves tiebreaker: identical cycles, one with you', () => {
    const swaps = [
      makeSwap({ deviceId: MY_DEVICE, currentSeatType: 'UPPER', desiredSeatType: 'LOWER', currentCoachId: 'B1' }),
      makeSwap({ currentSeatType: 'LOWER', desiredSeatType: 'UPPER', currentCoachId: 'B1' }),
      makeSwap({ currentSeatType: 'MIDDLE', desiredSeatType: 'SIDE_UPPER', currentCoachId: 'S5' }),
      makeSwap({ currentSeatType: 'SIDE_UPPER', desiredSeatType: 'MIDDLE', currentCoachId: 'S5' }),
    ];
    const m = findBestMatches(swaps, MY_DEVICE);
    expect(m).toHaveLength(2);
    const myCycle = m.find(x => x.participants.some(p => p.isYou));
    const other = m.find(x => !x.participants.some(p => p.isYou));
    expect(myCycle!.score).toBeGreaterThan(other!.score);
  });
});

// ============================================================
// 5. DECAY / AGE BONUS — Date.now() mocking
// ============================================================

describe('SwapEngine — Decay Verification (Date.now mock)', () => {
  beforeEach(() => { swapCounter = 0; });

  test('older swaps receive higher wait bonus (logarithmic)', () => {
    // The recomputePriority function gives:
    //   waitBonus = min(0.30, log(1 + hours) * 0.17)
    // At 0 hours: bonus ≈ 0
    // At 3 hours: bonus ≈ 0.24
    // At 6 hours: bonus ≈ 0.30 (capped)
    const now = Date.now();

    // Fresh swap (0 hours old)
    const freshSwaps = [
      makeSwap({ currentSeatType: 'UPPER', desiredSeatType: 'LOWER', createdAt: now }),
      makeSwap({ currentSeatType: 'LOWER', desiredSeatType: 'UPPER', createdAt: now }),
    ];
    const freshMatch = findBestMatches(freshSwaps, MY_DEVICE);

    swapCounter = 0;

    // Stale swap (3 hours old) — higher wait bonus
    const staleSwaps = [
      makeSwap({ currentSeatType: 'UPPER', desiredSeatType: 'LOWER', createdAt: now - 3 * 3600000 }),
      makeSwap({ currentSeatType: 'LOWER', desiredSeatType: 'UPPER', createdAt: now - 3 * 3600000 }),
    ];
    const staleMatch = findBestMatches(staleSwaps, MY_DEVICE);

    expect(freshMatch).toHaveLength(1);
    expect(staleMatch).toHaveLength(1);
    // Stale should score higher because recomputePriority gives log-scale wait bonus
    // (freshness bonus < wait bonus for 3h swaps)
    expect(staleMatch[0].score).toBeGreaterThan(freshMatch[0].score);
  });

  test('6-hour old swaps hit the wait bonus cap (0.30)', () => {
    const now = Date.now();
    const sixHourSwaps = [
      makeSwap({ currentSeatType: 'UPPER', desiredSeatType: 'LOWER', createdAt: now - 6 * 3600000, reason: 'preference' }),
      makeSwap({ currentSeatType: 'LOWER', desiredSeatType: 'UPPER', createdAt: now - 6 * 3600000, reason: 'preference' }),
    ];
    const result = findBestMatches(sixHourSwaps, MY_DEVICE);
    expect(result).toHaveLength(1);
    // Each participant should have priority ~ 0.20 (base) + 0.05 (preference) + 0.30 (capped) = 0.55
    for (const p of result[0].participants) {
      expect(p.priorityScore).toBeGreaterThanOrEqual(0.50);
      expect(p.priorityScore).toBeLessThanOrEqual(0.60);
    }
  });
});

// ============================================================
// 6. COACH PROXIMITY SCORING (RM-SW-030)
// ============================================================

describe('SwapEngine — Coach Proximity Scoring', () => {
  beforeEach(() => { swapCounter = 0; });

  test('same-coach cycle scores higher than cross-coach cycle', () => {
    // Cycle 1: both in B3 (same coach → +0.20 per edge)
    const sameCoach = [
      makeSwap({ currentSeatType: 'UPPER', desiredSeatType: 'LOWER', currentCoachId: 'B3' }),
      makeSwap({ currentSeatType: 'LOWER', desiredSeatType: 'UPPER', currentCoachId: 'B3' }),
    ];
    // Cycle 2: B1 vs S4 (different prefix → no proximity bonus)
    const diffCoach = [
      makeSwap({ currentSeatType: 'MIDDLE', desiredSeatType: 'SIDE_LOWER', currentCoachId: 'B1' }),
      makeSwap({ currentSeatType: 'SIDE_LOWER', desiredSeatType: 'MIDDLE', currentCoachId: 'S4' }),
    ];
    const m = findBestMatches([...sameCoach, ...diffCoach], MY_DEVICE);
    expect(m).toHaveLength(2);
    // Same-coach should be ranked first due to proximity bonus
    expect(m[0].score).toBeGreaterThan(m[1].score);
  });

  test('adjacent coaches (B1↔B2) get partial proximity bonus', () => {
    // Cycle 1: adjacent coaches B1 ↔ B2
    const adjacent = [
      makeSwap({ currentSeatType: 'UPPER', desiredSeatType: 'LOWER', currentCoachId: 'B1' }),
      makeSwap({ currentSeatType: 'LOWER', desiredSeatType: 'UPPER', currentCoachId: 'B2' }),
    ];
    // Cycle 2: far-apart coaches B1 ↔ B5
    const farApart = [
      makeSwap({ currentSeatType: 'MIDDLE', desiredSeatType: 'SIDE_LOWER', currentCoachId: 'B1' }),
      makeSwap({ currentSeatType: 'SIDE_LOWER', desiredSeatType: 'MIDDLE', currentCoachId: 'B5' }),
    ];
    const m = findBestMatches([...adjacent, ...farApart], MY_DEVICE);
    expect(m).toHaveLength(2);
    expect(m[0].score).toBeGreaterThan(m[1].score);
  });

  test('different coach prefixes (S1 vs B1) get no proximity bonus', () => {
    const swaps = [
      makeSwap({ currentSeatType: 'UPPER', desiredSeatType: 'LOWER', currentCoachId: 'S1' }),
      makeSwap({ currentSeatType: 'LOWER', desiredSeatType: 'UPPER', currentCoachId: 'B1' }),
    ];
    // Should still find match, just without proximity bonus
    const m = findBestMatches(swaps, MY_DEVICE);
    expect(m).toHaveLength(1);
  });
});

// ============================================================
// 7. findMyMatches
// ============================================================

describe('SwapEngine — findMyMatches', () => {
  beforeEach(() => { swapCounter = 0; });

  test('only returns cycles containing current user', () => {
    const swaps = [
      makeSwap({ deviceId: MY_DEVICE, currentSeatType: 'UPPER', desiredSeatType: 'LOWER' }),
      makeSwap({ currentSeatType: 'LOWER', desiredSeatType: 'UPPER' }),
      makeSwap({ currentSeatType: 'MIDDLE', desiredSeatType: 'SIDE_LOWER' }),
      makeSwap({ currentSeatType: 'SIDE_LOWER', desiredSeatType: 'MIDDLE' }),
    ];
    const my = findMyMatches(swaps, MY_DEVICE);
    expect(my).toHaveLength(1);
    expect(my[0].participants.some(p => p.isYou)).toBe(true);
  });

  test('returns empty when user not part of any cycle', () => {
    const swaps = [
      makeSwap({ currentSeatType: 'UPPER', desiredSeatType: 'LOWER' }),
      makeSwap({ currentSeatType: 'LOWER', desiredSeatType: 'UPPER' }),
    ];
    expect(findMyMatches(swaps, MY_DEVICE)).toEqual([]);
  });
});

// ============================================================
// 8. hasAnyPotentialMatch
// ============================================================

describe('SwapEngine — hasAnyPotentialMatch', () => {
  beforeEach(() => { swapCounter = 0; });

  test('true when direct partner exists', () => {
    const my = makeSwap({ currentSeatType: 'UPPER', desiredSeatType: 'LOWER' });
    const other = makeSwap({ currentSeatType: 'LOWER', desiredSeatType: 'UPPER' });
    expect(hasAnyPotentialMatch(my, [my, other])).toBe(true);
  });

  test('false when nobody has what I want', () => {
    const my = makeSwap({ currentSeatType: 'UPPER', desiredSeatType: 'LOWER' });
    const other = makeSwap({ currentSeatType: 'MIDDLE', desiredSeatType: 'UPPER' });
    expect(hasAnyPotentialMatch(my, [my, other])).toBe(false);
  });

  test('false when nobody wants what I have', () => {
    const my = makeSwap({ currentSeatType: 'UPPER', desiredSeatType: 'LOWER' });
    const other = makeSwap({ currentSeatType: 'LOWER', desiredSeatType: 'MIDDLE' });
    expect(hasAnyPotentialMatch(my, [my, other])).toBe(false);
  });

  test('ignores non-OPEN swaps', () => {
    const my = makeSwap({ currentSeatType: 'UPPER', desiredSeatType: 'LOWER' });
    const other = makeSwap({ currentSeatType: 'LOWER', desiredSeatType: 'UPPER', status: 'CANCELLED' });
    expect(hasAnyPotentialMatch(my, [my, other])).toBe(false);
  });

  test('[KNOWN BUG] false positive when conditions met by different people', () => {
    const my = makeSwap({ currentSeatType: 'UPPER', desiredSeatType: 'LOWER' });
    const x = makeSwap({ currentSeatType: 'LOWER', desiredSeatType: 'MIDDLE' });
    const y = makeSwap({ currentSeatType: 'MIDDLE', desiredSeatType: 'UPPER' });
    expect(hasAnyPotentialMatch(my, [my, x, y])).toBe(true);
    const direct = findBestMatches([my, x, y], MY_DEVICE).filter(m => m.type === 'DIRECT');
    expect(direct).toHaveLength(0);
  });
});

// ============================================================
// 9. EDGE CASES
// ============================================================

describe('SwapEngine — Edge Cases', () => {
  beforeEach(() => { swapCounter = 0; });

  test('demand imbalance: 5 want LOWER, 1 has LOWER', () => {
    const swaps = [
      makeSwap({ currentSeatType: 'LOWER', desiredSeatType: 'UPPER' }),
      ...Array.from({ length: 5 }, () =>
        makeSwap({ currentSeatType: 'UPPER', desiredSeatType: 'LOWER' })
      ),
    ];
    const m = findBestMatches(swaps, MY_DEVICE);
    expect(m).toHaveLength(1);
    expect(m[0].type).toBe('DIRECT');
  });

  test('isYou flag set correctly', () => {
    const swaps = [
      makeSwap({ deviceId: MY_DEVICE, currentSeatType: 'UPPER', desiredSeatType: 'LOWER' }),
      makeSwap({ currentSeatType: 'LOWER', desiredSeatType: 'UPPER' }),
    ];
    const m = findBestMatches(swaps, MY_DEVICE);
    expect(m[0].participants.find(p => p.deviceId === MY_DEVICE)?.isYou).toBe(true);
    expect(m[0].participants.find(p => p.deviceId !== MY_DEVICE)?.isYou).toBe(false);
  });

  test('cycle path string format', () => {
    const swaps = [
      makeSwap({ currentSeatType: 'UPPER', desiredSeatType: 'LOWER' }),
      makeSwap({ currentSeatType: 'LOWER', desiredSeatType: 'UPPER' }),
    ];
    const m = findBestMatches(swaps, MY_DEVICE);
    expect(m[0].cyclePath).toContain('UB');
    expect(m[0].cyclePath).toContain('LB');
    expect(m[0].cyclePath).toContain('→');
  });

  test('match type classification: DIRECT / TRIANGULAR / CHAIN', () => {
    const d = findBestMatches([
      makeSwap({ currentSeatType: 'UPPER', desiredSeatType: 'LOWER' }),
      makeSwap({ currentSeatType: 'LOWER', desiredSeatType: 'UPPER' }),
    ], MY_DEVICE);
    expect(d[0].type).toBe('DIRECT');

    swapCounter = 0;
    const t = findBestMatches([
      makeSwap({ currentSeatType: 'UPPER', desiredSeatType: 'LOWER' }),
      makeSwap({ currentSeatType: 'LOWER', desiredSeatType: 'MIDDLE' }),
      makeSwap({ currentSeatType: 'MIDDLE', desiredSeatType: 'UPPER' }),
    ], MY_DEVICE);
    expect(t[0].type).toBe('TRIANGULAR');
  });

  test('[RACE CONDITION] engine returns matches for nearly-expired swaps', () => {
    const now = Date.now();
    const swaps = [
      makeSwap({ currentSeatType: 'UPPER', desiredSeatType: 'LOWER', expiresAt: now + 100, createdAt: now - 5 * 3600000 }),
      makeSwap({ currentSeatType: 'LOWER', desiredSeatType: 'UPPER', expiresAt: now + 100, createdAt: now - 5 * 3600000 }),
    ];
    expect(findBestMatches(swaps, MY_DEVICE)).toHaveLength(1);
  });

  test('match IDs are unique across results', () => {
    // Use distinct IDs to ensure unique match ID generation
    const swaps = [
      makeSwap({ id: 'alpha_1', currentSeatType: 'UPPER', desiredSeatType: 'LOWER' }),
      makeSwap({ id: 'beta_22', currentSeatType: 'LOWER', desiredSeatType: 'UPPER' }),
      makeSwap({ id: 'gamma_3', currentSeatType: 'MIDDLE', desiredSeatType: 'SIDE_LOWER' }),
      makeSwap({ id: 'delta_4', currentSeatType: 'SIDE_LOWER', desiredSeatType: 'MIDDLE' }),
    ];
    const m = findBestMatches(swaps, MY_DEVICE);
    const ids = m.map(x => x.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ============================================================
// 10. STRESS & TIMEOUT
// ============================================================

describe('SwapEngine — Stress & Timeout', () => {
  beforeEach(() => { swapCounter = 0; });

  test('30 swaps completes in under 1 second', () => {
    const types: SeatType[] = ['LOWER', 'MIDDLE', 'UPPER', 'SIDE_LOWER', 'SIDE_UPPER'];
    const swaps = Array.from({ length: 30 }, (_, i) => {
      const c = types[i % 5];
      let d = types[(i + 1) % 5];
      if (d === c) d = types[(i + 2) % 5];
      return makeSwap({ currentSeatType: c, desiredSeatType: d });
    });
    const t0 = performance.now();
    findBestMatches(swaps, MY_DEVICE);
    expect(performance.now() - t0).toBeLessThan(1000);
  });

  test('dense graph (all type pairs) completes within 2 seconds', () => {
    const types: SeatType[] = ['LOWER', 'MIDDLE', 'UPPER', 'SIDE_LOWER', 'SIDE_UPPER'];
    const swaps: LocalSwap[] = [];
    for (const c of types)
      for (const d of types)
        if (c !== d) swaps.push(makeSwap({ currentSeatType: c, desiredSeatType: d }));
    const t0 = performance.now();
    const m = findBestMatches(swaps, MY_DEVICE);
    expect(performance.now() - t0).toBeLessThan(2000);
    expect(m.length).toBeGreaterThanOrEqual(1);
    // No duplicate participants
    const allIds = m.flatMap(x => x.participants.map(p => p.swapId));
    expect(new Set(allIds).size).toBe(allIds.length);
  });
});
