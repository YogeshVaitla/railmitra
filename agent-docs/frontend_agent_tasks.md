# 🛠️ Frontend Agent Task Specification: Seat Swap V1

> **Role**: Structural integration, State Management, and Component Decomposition
> **Context**: You are working on the Seat Swap V1 UI/UX Polish workstream alongside a UI/UX Agent.
> **Key Objective**: Refactor the monolithic `swap.tsx` into reusable components and wire up the underlying logic for new connection states and success flows.

---

## 🏗️ Ticket: RM-SW-001 — Refactor `swap.tsx` into Component Modules
**Priority**: P1 (Blocker for all other UI tasks)

### Objective
Break the 1,123-line `swap.tsx` monolith into focused, reusable component files. The main screen file should only orchestrate state and tab switching.

### File Structure to Create
Create these under `components/swap/`:
- `BrowseTab.tsx`
- `RegisterTab.tsx`
- `MySwapTab.tsx`
- `OfferCard.tsx`
- `MatchCard.tsx`
- `DemandHeatmap.tsx`
- `SwapPreview.tsx`
- `MeshStatusBar.tsx`
- `swap.styles.ts` (All shared styles extracted here)
- `swap.constants.ts` (Move `SEAT_TYPES` and `REASONS` here)
- `swap.utils.ts` (Move helper functions like `getSeatTypeLabel`, `getTimeSince`, etc., here)

### Strict Requirements
1. `swap.tsx` must be reduced to ≤300 lines (state, `useEffect` hooks, handlers, tab rendering).
2. Every new component must have a strictly typed `Props` interface.
3. **Zero Visual Regressions**: The UI must remain pixel-identical. Extract styles moving them exactly as they are to `swap.styles.ts`.
4. Manage all state in the parent `swap.tsx` and pass down explicitly via props and callbacks.
5. Fix any imports referencing `LocalSwap`, `SeatType`, `SwapMatch` to pull directly from `swapStore` or `swapEngine`.

---

## 📡 Ticket: RM-SW-003(A) — Offline/Online Status Logic
**Priority**: P1 | **Collaboration**: You handle the logic, UI/UX Agent handles the visual component.

### Objective
Wire up real network monitoring to pass connection state to the new `MeshStatusBar.tsx`.

### Tasks
1. Verify if `@react-native-community/netinfo` is installed (it often is via Expo). If not, install via `npx expo install @react-native-community/netinfo`.
2. In `swap.tsx`, add an `isOnline` boolean state, integrated via `NetInfo.addEventListener`.
3. Pass `isOnline`, `meshActive`, and `peerCount` into the `MeshStatusBar` component you extracted in RM-SW-001.

### State Matrix (For reference)
- `isOnline == true && peerCount > 0` → FULL_SYNC
- `isOnline == true && peerCount == 0` → CLOUD_ONLY
- `isOnline == false && peerCount > 0` → P2P_ONLY
- `isOnline == false && peerCount == 0` → ISOLATED

---

## 🎉 Ticket: RM-SW-005(A) — Celebration Screen Logic
**Priority**: P3 | **Collaboration**: You handle state integration, UI/UX Agent builds the animation.

### Objective
Provide the state transitions and handler methods required for the "Swap Accepted" full-screen overlay in `MySwapTab`.

### Tasks
1. Within `MySwapTab.tsx`, expose the following handler to the (future) celebration UI:
   - `onComplete`: Calls `updateSwapStatus(swapId, 'COMPLETED')` on the backend/store.
   - `onReportProblem`: Triggers an `Alert.alert` with reasons ("Other person not there", "Wrong seat", "Changed mind"), which then calls `updateSwapStatus` with 'CANCELLED'.
2. Ensure the UI triggers the `Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)` upon successful `MATCHED` transition, passing the relevant partner data down to the component.

---

## ⚠️ Collaboration Rules
- **DO NOT** add raw styles or animations for the Radar, Chain Visualization, or Celebration visuals. The UI/UX Agent will build those components.
- Your primary job is the structural teardown of `swap.tsx` and providing clean prop interfaces for the UI/UX Agent to hook into.
