# Swap Visibility Fixes — Summary

## Issues Fixed

### Bug 1: Other users can't see offers when browsing the same train

**Root Cause:** `clearMockSwapData()` was wiping ALL non-local swaps (including real cloud/P2P-synced data) every time the swap screen opened.

**Additional Cause:** `CloudSyncBridge.knownServerIds` cache was preventing re-sync — once an offer was seen once, it would never be re-fetched from the server, even if locally deleted.

### Bug 2: Offline offers not visible, devices not showing

**Root Cause:** Same `clearMockSwapData()` issue destroyed P2P-received swaps. Combined with the `knownServerIds` cache, offers could never be restored after being wiped.

## Changes Made

### 1. `services/swapStore.ts` — Fix mock data cleanup
- `clearMockSwapData()` now **only removes MockMeshBridge simulation data** (deviceId `peer_*`/`mock_peer_*`)
- Preserves legitimate remote swaps from cloud sync (`cloud_*`) and real P2P (`p2p_*`)

### 2. `services/meshBridge.ts` — Fix cloud sync re-fetch + add forcePoll
- Removed `knownServerIds` cache — `mergeRemoteSwaps()` already handles dedup natively via CRDT merge
- Every poll now passes ALL server offers through `mergeRemoteSwaps()`, ensuring locally-deleted data gets re-synced
- Added `forcePoll()` to `IMeshBridge` interface and all implementations
- Cleaned up lint warnings (unused catch params)

### 3. `app/swap.tsx` — Fix stale closure + force poll on browse
- Fixed **stale closure bug**: `onSwapReceived` callback captured the initial `trainNo` value. Now uses `useRef` to always access the current value
- `handleBrowse` now calls `forcePoll()` to get fresh data from server immediately, instead of waiting for the next 15s poll interval
- Removed unused `meshActive` state variable

### 4. `services/NearbyMeshBridge.ts` — Interface compliance + lint
- Added `forcePoll()` method (no-op for P2P bridge)
- Removed unused `isGossip` variable

## Verification

| Check | Result |
|-------|--------|
| TypeScript compilation | ✅ 0 errors |
| ESLint | ✅ 0 errors, 9 warnings (all pre-existing, intentional) |
| Warnings reduced | 15 → 9 |

## How It Works Now

```
User A places offer → stored locally + synced to cloud server
                                        ↓
User B opens swap screen → clearMockSwapData (only removes mock data now)
  ↓
User B enters train number → handleBrowse()
  ↓
initMeshBridge → cloud bridge starts polling → fetchOffersFromServer
  ↓
forcePoll() → immediate server fetch → mergeRemoteSwaps (CRDT dedup)
  ↓
browseOffers() reads local store → User A's offer is visible ✅
  ↓
onSwapReceived callback → uses trainNoRef (no stale closure) → refreshes offers
```
