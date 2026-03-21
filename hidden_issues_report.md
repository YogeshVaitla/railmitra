# Hidden Issues Report

Based on a deeper code audit of the active files (`meshBridge.ts`, `swapStore.ts`, and `smart-utilities.ts`), several subtle bugs and architectural risks were found that are not caught by standard tests or linting:

## 1. Race Conditions & Data Loss (`services/swapStore.ts`)
- **The Issue**: Every function in `swapStore.ts` (e.g., `createLocalSwap`, `mergeRemoteSwaps`, `updateSwapStatus`, `acceptMatch`) performs a read-modify-write cycle: `await loadSwaps()`, modifies the array, then `await saveSwaps()`.
- **The Impact**: `AsyncStorage` has no transaction support. If a user taps a button twice quickly, or if the `CloudSyncBridge` writes a background sync exactly when the user is making an edit, one of the operations will overwrite the other. Data will be silently lost.
- **The Fix**: Implement an in-memory Mutex lock or async queue around `loadSwaps` and `saveSwaps` to ensure operations execute sequentially.

## 2. Silent Failures on State Changes (`services/meshBridge.ts`)
- **The Issue**: In `CloudSyncBridge.broadcastSwapAccept` and `broadcastSwapCancel`, the `fetchWithTimeout` calls have empty `.catch(() => { })` blocks and are not awaited or queued.
- **The Impact**: If a user accepts a match while moving through a poor connection area (like a tunnel), the local app will show the swap as "ACCEPTED", but the network request to the server will silently drop. The server (and the cloud peer) will never know the swap occurred, causing severe synchronization mismatch.
- **The Fix**: Implement a durable retry queue (e.g., in AsyncStorage) for outgoing `broadcastSwapAccept` changes, so they are re-attempted when the network returns.

## 3. Polling Storm / Overlapping Requests (`services/meshBridge.ts`)
- **The Issue**: `POLL_INTERVAL_MS` is set to 15 seconds, but the fetch timeout is 30 seconds to account for cold starts. `setInterval` is used instead of recursive `setTimeout`.
- **The Impact**: If the server takes 25 seconds to respond, the next poll fires 10 seconds before the previous poll finishes. Under poor network conditions or heavy server load, this will cascade and spawn dozens of overlapping concurrent fetch requests from the same client, eventually overwhelming the device and server.
- **The Fix**: Switch from `setInterval` to a recursive queue, ensuring the next poll only fires 15 seconds *after* the previous poll has fully resolved (success or fail).

## 4. Unsafe Date Instantiation (`services/meshBridge.ts`)
- **The Issue**: When converting server offers to local `LocalSwap` models in `fetchOffersFromServer`, `createdAt: new Date(offer.createdAt).getTime()` is used.
- **The Impact**: If `offer.createdAt` is ever undefined or null, this will evaluate to `NaN`, poisoning the LocalStore and crashing any sorting algorithms relying on numeric priority.
