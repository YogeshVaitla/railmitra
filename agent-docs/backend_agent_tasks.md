# 🖥️ Backend / Core Logic Agent Task Specification: Seat Swap V1

> **Role**: Server Architecture, Transport Layer (P2P Mesh), and Core Graph Algorithms
> **Context**: You are working on the Seat Swap V1 backend, mesh networking, and algorithm workstreams.
> **Key Objective**: Secure the Node.js server, implement the offline Android Nearby Connections mesh network edge cases, and optimize the on-device graph matching algorithm.

---

## Part 1: Server Hardening & API Letdown

### 🔒 Ticket: RM-SW-010 — Scope Backend to Swap-Only Endpoints
**Priority**: P1 | **File**: `server/src/index.ts`
- Keep active: `/api/swaps/*`, `/api/health`, `/api/metrics`, `/api/reputation`, `/api/telemetry/mesh`
- Comment out or disable behind a toggle: `/api/reports`, `/api/toilets/*`, `/api/pnr/*`, `/api/utilities/*`, `/api/trains/:trainNo/availability`, `/api/seats/*`, `/api/classify/*`
- Update root `/` page text to "Seat Swap Sync Server v1.0.0".
- Provide graceful HTTP 501 `{ error: "This feature is coming in V2" }` for disabled routes. Do not modify `schema.prisma` DB models.

### ⏱️ Ticket: RM-SW-011 — Add Swap Expiry Cron Job
**Priority**: P1 | **File**: `server/src/index.ts`
- Implement a 15-minute interval job.
- Query DB for `SwapRequest` records where `status = 'OPEN'` and `expiresAt < now()`.
- Update status to `'EXPIRED'`, log a `SwapEvent`, and broadcast an `OFFER_EXPIRED` SSE payload to clients.

### 🔗 Ticket: RM-SW-012 — Server-Side Swap Session Management
**Priority**: P1 | **File**: `server/src/index.ts`
- Add `SwapSession` model to Prisma (trainNo, swapId1, swapId2, status [PENDING, COMPLETED, FAILED]). Add `sessionId` to `SwapRequest`. Run `npx prisma generate`.
- Update `POST /api/swaps/:swapId/accept` to create this session and transition both swaps.
- Create `POST /api/sessions/:sessionId/complete` to finalize successful trades.
- Create `POST /api/sessions/:sessionId/fail` to revert failed trades back to `OPEN`.

### 🛡️ Ticket: RM-SW-013 — Rate Limiting & Abuse Prevention
**Priority**: P1 | **File**: `server/src/index.ts`
- Install and apply `express-rate-limit` (e.g., max 20 requests/min per IP) to swap APIs.
- Enforce max 3 active (`OPEN` or `ACCEPTED`) swap offers per `userId`.
- Add input validation: `currentSeatNo` <= 80, `currentCoachId` length <= 4, `currentSeatType` !== `desiredSeatType`.

---

## Part 2: P2P Mesh Hardening (On-Device Client)

### 🔌 Ticket: RM-SW-020 — Handle P2P Reconnection Edge Cases
**Priority**: P1 | **File**: `services/NearbyMeshBridge.ts`
- Implement exponential backoff retry (5s, 10s, 30s) if Android Nearby `startAdvertising` or `startDiscovery` fails.
- Listen for RN `AppState` changes: if backgrounded > 5 minutes and foregrounds, tear down and re-initialize the P2P bridge.
- Fix duplicate peer counting: deduplicate nearby peers by `endpointName` or `deviceId`.

### 🤝 Ticket: RM-SW-021 — Broadcast Swap Acceptance over P2P
**Priority**: P1 | **File**: `services/NearbyMeshBridge.ts`, `services/swapStore.ts`
- Ensure `broadcastSwapAcceptance()` sends `{ TYPE: 'SWAP_ACCEPT', swapId }`.
- In `onPayloadReceived`, parse `SWAP_ACCEPT`, locate the local match, and transition the local store to `MATCHED` or `ACCEPTED` without cloud reliance. Account for `p2p_` ID prefixes.

### 📡 Ticket: RM-SW-022 — Implement Gossip Relay for Train-Wide Coverage
**Priority**: P3 (V1.1 feature) | **File**: `services/NearbyMeshBridge.ts`
- Wrap P2P outbound payloads: `{ ttl: 3, senderId: '...', timestamp: 12345, payload: {...} }`.
- Keep an LRU cache of the last 100 seen massage hashes `md5(senderId+timestamp)` to prevent broadcast storms.
- If payload is unseen and `ttl > 0`, decrement `ttl` by 1 and re-broadcast to all connected peers EXCEPT the origin peer.

---

## Part 3: Algorithm Optimizaton (On-Device Client)

### 🚂 Ticket: RM-SW-030 — Add Coach Proximity Bonus to Cycle Scoring
**Priority**: P2 | **File**: `services/swapEngine.ts`
- In `scoreCycle()`, grant a `+0.20` score bonus if both participants in a trade edge are in the exact same coach Id (e.g., B1 and B1).
- Parse the coach numbers to grant a `+0.10` bonus if they are in adjacent coaches (e.g., S4 and S5).

### ⚡ Ticket: RM-SW-031 — Optimize Cycle Finder for Scale
**Priority**: P3 (V1.1) | **File**: `services/swapEngine.ts`
- Add execution time logging to `findBestMatches()`.
- Implement short-circuit early termination logic: If `findAllCycles` has spent more than `250ms`, return the valid cycles found so far rather than exhausting the graph.
- Optimitze `buildSwapGraph` to use `Map` lookups for seat types instead of iterating mapped arrays.
