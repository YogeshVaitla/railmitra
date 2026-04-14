/**
 * ============================================================
 *   RM-SW-042: Integration Test — Full Swap Lifecycle
 * ============================================================
 *
 * Simulates two devices (A and B) communicating via MockMeshBridge.
 * Validates the complete flow:
 *   Device A creates Swap A → browses → sees own swap
 *   Device B connects via MockMeshBridge
 *   Device B creates Swap B (a perfect match for A)
 *   Device A receives Swap B via mesh → match found
 *   Device A accepts → Device B receives ACCEPT
 *   Both resolve to COMPLETED
 *
 * Uses mocked AsyncStorage and direct function calls (headless RN).
 */

import AsyncStorage from '../__mocks__/@react-native-async-storage/async-storage';
import { __reset } from '../__mocks__/@react-native-async-storage/async-storage';
import {
  createLocalSwap,
  getMySwaps,
  getSwapsForTrain,
  mergeRemoteSwaps,
  updateSwapStatus,
  LocalSwap,
} from '../services/swapStore';
import { findBestMatches, findMyMatches } from '../services/swapEngine';

// We simulate two "devices" by giving them fixed IDs.
// In real RN, each device has its own AsyncStorage namespace.
// Here we share one store but distinguish by deviceId.
const DEVICE_A_ID = 'device_aaa_111';
const DEVICE_B_ID = 'device_bbb_222';

const TRAIN = '12301';
const DATE = '2026-03-15';

beforeEach(async () => {
  __reset();
});

describe('RM-SW-042 — Full Swap Lifecycle Integration', () => {
  test('end-to-end: create → mesh sync → match → accept → complete', async () => {
    // ── STEP 1: Device A creates Swap A ──────────────────
    // Seed the device ID for Device A
    await AsyncStorage.setItem('@seatseeker_device_id', DEVICE_A_ID);

    const swapA = await createLocalSwap({
      trainNo: TRAIN,
      journeyDate: DATE,
      currentCoachId: 'B3',
      currentSeatNo: 42,
      currentSeatType: 'UPPER',
      desiredSeatType: 'LOWER',
      reason: 'elderly',
    });

    expect(swapA.id).toBeDefined();
    expect(swapA.status).toBe('OPEN');
    expect(swapA.isLocal).toBe(true);
    expect(swapA.deviceId).toBe(DEVICE_A_ID);

    // ── STEP 2: Device A browses and sees own swap ───────
    const mySwaps = await getMySwaps();
    expect(mySwaps).toHaveLength(1);
    expect(mySwaps[0].id).toBe(swapA.id);

    const trainSwaps = await getSwapsForTrain(TRAIN, DATE);
    expect(trainSwaps.some(s => s.id === swapA.id)).toBe(true);

    // ── STEP 3: Device B creates Swap B (perfect match) ──
    // Swap B is the counterpart: has LOWER, wants UPPER
    // In reality this is created on Device B's store, but for
    // integration testing we simulate it as a remote swap payload.
    const swapB: LocalSwap = {
      id: 'swap_b_remote_001',
      deviceId: DEVICE_B_ID,
      trainNo: TRAIN,
      journeyDate: DATE,
      currentCoachId: 'B3',
      currentSeatNo: 15,
      currentSeatType: 'LOWER',
      desiredSeatType: 'UPPER',
      status: 'OPEN',
      reason: 'medical',
      priorityScore: 0.45,
      matchedWith: null,
      sessionId: null,
      expiresAt: Date.now() + 6 * 3600000,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isLocal: false,
      boardingStation: null,
      destinationStation: null,
    };

    // ── STEP 4: MockMeshBridge delivers Swap B to Device A ─
    const mergeResult = await mergeRemoteSwaps([swapB]);
    expect(mergeResult.added).toBe(1);

    // Device A now has both swaps in local store
    const allSwaps = await getSwapsForTrain(TRAIN, DATE);
    expect(allSwaps).toHaveLength(2);
    expect(allSwaps.some(s => s.deviceId === DEVICE_A_ID)).toBe(true);
    expect(allSwaps.some(s => s.deviceId === DEVICE_B_ID)).toBe(true);

    // ── STEP 5: Device A runs swap engine → finds match ───
    const matches = findBestMatches(allSwaps, DEVICE_A_ID);
    expect(matches).toHaveLength(1);
    expect(matches[0].type).toBe('DIRECT');
    expect(matches[0].participants).toHaveLength(2);

    // Verify participants
    const participantA = matches[0].participants.find(p => p.deviceId === DEVICE_A_ID);
    const participantB = matches[0].participants.find(p => p.deviceId === DEVICE_B_ID);
    expect(participantA).toBeDefined();
    expect(participantB).toBeDefined();
    expect(participantA!.isYou).toBe(true);
    expect(participantB!.isYou).toBe(false);
    expect(participantA!.has).toBe('UPPER');
    expect(participantA!.wants).toBe('LOWER');
    expect(participantB!.has).toBe('LOWER');
    expect(participantB!.wants).toBe('UPPER');

    // findMyMatches should also return this match for Device A
    const myMatches = findMyMatches(allSwaps, DEVICE_A_ID);
    expect(myMatches).toHaveLength(1);

    // ── STEP 6: Device A accepts the match ─────────────────
    const matchedA = await updateSwapStatus(swapA.id, 'MATCHED');
    expect(matchedA!.status).toBe('MATCHED');

    const acceptedA = await updateSwapStatus(swapA.id, 'ACCEPTED');
    expect(acceptedA!.status).toBe('ACCEPTED');

    // ── STEP 7: Simulate Device B receiving ACCEPT payload ─
    // In reality, the ACCEPT event is broadcast via mesh/SSE.
    // Here we simulate B's side by updating the remote swap in A's store.
    const matchedB = await updateSwapStatus(swapB.id, 'MATCHED');
    expect(matchedB!.status).toBe('MATCHED');

    const acceptedB = await updateSwapStatus(swapB.id, 'ACCEPTED');
    expect(acceptedB!.status).toBe('ACCEPTED');

    // ── STEP 8: Both sides complete ─────────────────────────
    const completedA = await updateSwapStatus(swapA.id, 'COMPLETED');
    expect(completedA!.status).toBe('COMPLETED');

    const completedB = await updateSwapStatus(swapB.id, 'COMPLETED');
    expect(completedB!.status).toBe('COMPLETED');

    // ── FINAL VERIFICATION ──────────────────────────────────
    const finalSwaps = await getSwapsForTrain(TRAIN, DATE);
    const finalA = finalSwaps.find(s => s.id === swapA.id);
    const finalB = finalSwaps.find(s => s.id === swapB.id);
    expect(finalA!.status).toBe('COMPLETED');
    expect(finalB!.status).toBe('COMPLETED');

    // Both swaps are terminal — no further transitions
    expect(await updateSwapStatus(swapA.id, 'OPEN')).toBeNull();
    expect(await updateSwapStatus(swapB.id, 'OPEN')).toBeNull();
  });

  test('three-way lifecycle: A → B → C → A triangular swap', async () => {
    await AsyncStorage.setItem('@seatseeker_device_id', DEVICE_A_ID);

    // Device A creates swap: has UPPER, wants LOWER
    const swapA = await createLocalSwap({
      trainNo: TRAIN, journeyDate: DATE,
      currentCoachId: 'B1', currentSeatNo: 10,
      currentSeatType: 'UPPER', desiredSeatType: 'LOWER',
      reason: 'family',
    });

    // Device B: has LOWER, wants MIDDLE
    const swapB: LocalSwap = {
      id: 'tri_b', deviceId: 'device_b_tri', trainNo: TRAIN, journeyDate: DATE,
      currentCoachId: 'B1', currentSeatNo: 20,
      currentSeatType: 'LOWER', desiredSeatType: 'MIDDLE',
      status: 'OPEN', reason: 'preference', priorityScore: 0.25,
      matchedWith: null, sessionId: null,
      expiresAt: Date.now() + 3600000, createdAt: Date.now(), updatedAt: Date.now(),
      isLocal: false,
      boardingStation: null,
      destinationStation: null,
    };

    // Device C: has MIDDLE, wants UPPER
    const swapC: LocalSwap = {
      id: 'tri_c', deviceId: 'device_c_tri', trainNo: TRAIN, journeyDate: DATE,
      currentCoachId: 'B2', currentSeatNo: 30,
      currentSeatType: 'MIDDLE', desiredSeatType: 'UPPER',
      status: 'OPEN', reason: 'preference', priorityScore: 0.25,
      matchedWith: null, sessionId: null,
      expiresAt: Date.now() + 3600000, createdAt: Date.now(), updatedAt: Date.now(),
      isLocal: false,
      boardingStation: null,
      destinationStation: null,
    };

    // Mesh delivers B and C
    await mergeRemoteSwaps([swapB, swapC]);

    // Engine should find a triangular match
    const allSwaps = await getSwapsForTrain(TRAIN, DATE);
    const matches = findBestMatches(allSwaps, DEVICE_A_ID);
    expect(matches).toHaveLength(1);
    expect(matches[0].type).toBe('TRIANGULAR');
    expect(matches[0].participants).toHaveLength(3);

    // All three transition to COMPLETED
    for (const swap of [swapA, swapB, swapC]) {
      await updateSwapStatus(swap.id, 'MATCHED');
      await updateSwapStatus(swap.id, 'ACCEPTED');
      await updateSwapStatus(swap.id, 'COMPLETED');
    }

    const finalSwaps = await getSwapsForTrain(TRAIN, DATE);
    expect(finalSwaps.every(s => s.status === 'COMPLETED')).toBe(true);
  });
});
