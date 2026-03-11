# 🕵️ QA Agent Task Specification: Seat Swap V1

> **Role**: Test Automation, Quality Assurance, Edge Case Validation
> **Context**: You are working on the Seat Swap V1 Testing & QA workstream.
> **Key Objective**: Achieve 100% branch coverage on the core swapping algorithms and ensure data integrity under extreme offline syncing stress.

---

## 🧪 Ticket: RM-SW-040 — Expand swapEngine Unit Tests
**Priority**: P1 | **File**: `__tests__/swapEngine.test.ts`

### Objective
The matching algorithm (`swapEngine.ts`) is the heart of the app. It must be infallible.

### Tasks
1. Audit existing tests in `swapEngine.test.ts`.
2. Achieve 100% branch coverage for: `buildSwapGraph()`, `findAllCycles()`, `scoreCycle()`, and `selectBestMatches()`.
3. Add specific test scenarios for:
   - **Empty state**: 0 swaps provided.
   - **No match state**: 1 swap provided, or 2 swaps with incompatible wants/has.
   - **Direct Match**: 2-way standard trade.
   - **Triangular Match**: 3-way cycle (`A wants B, B wants C, C wants A`).
   - **Chain Match**: 5-way cycle.
   - **Overlapping Cycles**: A graph where Node A belongs to two different valid cycles, ensuring `selectBestMatches` picks the cycle with the highest total score and marks the other as invalid.
   - **Priority Scoring Verification**: Ensure `elderly > medical > family > preference` logic resolves tie-breakers correctly.
   - **Decay Verification**: Mock `Date.now()` to ensure older swaps receive the slight age bonus.

---

## 🗄️ Ticket: RM-SW-041 — Expand swapStore Unit Tests
**Priority**: P1 | **File**: `__tests__/swapStore.test.ts`

### Objective
Storage layer (`swapStore.ts`) handles CRDT merges, rate limiting, and eviction. It must not corrupt local data.

### Tasks
1. **CRDT Merge Testing**:
   - Local state has V1. Remote syncs V2 of same swap. Assert Local updates to V2.
   - Local state has V2. Remote syncs V1. Assert Local ignores V1 (newer wins).
   - Test deduplication ensures no phantom copies of the same swap exist.
2. **Rate Limiting**: Attempt to create a 4th active swap for the same deviceId. Assert rejection. 
3. **Storage Cap Eviction**: Mock 200 completed swaps. Add the 201st. Assert the absolute oldest terminal-state swap is evicted.
4. **Input Validation**: Actively fuzz `trainNo`, `coachId` (e.g., > 4 chars), and `seatNo` (e.g., > 80 or < 1). Assert rejections.
5. **Status Transitions**: Test all valid path combinations (`OPEN -> MATCHED -> ACCEPTED -> COMPLETED`). Test invalid requests (e.g., `COMPLETED -> OPEN`) and assert they return `null` or throw cleanly.

---

## 🔄 Ticket: RM-SW-042 — Integration Test: Full Swap Lifecycle
**Priority**: P2

### Objective
End-to-end trace of a swap using mocked interfaces.

### Tasks
1. Create a new test suite simulating two full React Native instances (headless) communicating via the `MockMeshBridge`.
2. Flow to verify:
   - Device A creates Swap A.
   - Device A browses (asserts sees own swap).
   - Device B connects via MockMeshBridge.
   - Device B creates Swap B (perfect match for A).
   - Assert Device A receives Swap B via Mesh Bridge event payload.
   - Device A accepts match.
   - Assert Device B receives ACCEPT payload and transitions state.
   - Assert both ends resolve to `COMPLETED`.

---

## 💥 Ticket: RM-SW-043 — P2P Sync Stress Test
**Priority**: P2

### Objective
Ensure race conditions don't destroy local data when massive mesh discovery occurs.

### Tasks
1. Simulate 8 concurrent peers sending large `SWAP_OFFERS` arrays simultaneously to the `mergeRemoteSwaps` function.
2. Assert 0 duplicate swaps exist after the merge storm resolves.
3. Simulate `createLocalSwap` firing exactly concurrently with a `mergeRemoteSwaps` resolution. Assert no data loss.
4. Inject payloads with expired TTLs to ensure they are silently dropped.
