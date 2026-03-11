# 🎨 UI/UX Polish Workstream — Detailed Technical Specifications

> **Workstream Owner**: Lead PM  
> **Agents**: Frontend Agent (structural code), UI/UX Agent (visual design, animations, styling)  
> **Execution Order**: RM-SW-001 → RM-SW-003 → RM-SW-002 → RM-SW-004 → RM-SW-005

---

## Context for All Agents

### Current State
- **`swap.tsx`** is a single 1,123-line monolith containing all 3 tabs (Browse, Register, My Swap), all handlers, and all styles
- **`components/`** has no swap-specific components — only generic UI pieces (`DatePicker`, `themed-text`, etc.)
- **`components/ui/`** has `collapsible.tsx` and `icon-symbol.tsx` — not relevant to swap
- **Design System**: [Colors.ts](file:///c:/Users/Yogesh/dev/seat-app/constants/Colors.ts) — warm light theme with coral primary, teal accent, senior-friendly high contrast
- **Available Libraries**: `react-native-reanimated` v4.1.1 (installed), `expo-linear-gradient`, `expo-haptics`, `@expo/vector-icons` (Ionicons + MaterialCommunityIcons)
- **No new dependencies** should be added without PM approval

### Key Files
| File | Lines | Role |
|------|-------|------|
| [swap.tsx](file:///c:/Users/Yogesh/dev/seat-app/app/swap.tsx) | 1,123 | Monolithic swap screen — needs decomposition |
| [index.tsx](file:///c:/Users/Yogesh/dev/seat-app/app/index.tsx) | 388 | Home screen — already V1-focused, do NOT touch |
| [Colors.ts](file:///c:/Users/Yogesh/dev/seat-app/constants/Colors.ts) | 109 | Design tokens — extend if needed, don't change existing values |
| [_layout.tsx](file:///c:/Users/Yogesh/dev/seat-app/app/_layout.tsx) | 273 | Root layout with splash — do NOT touch |
| [swapEngine.ts](file:///c:/Users/Yogesh/dev/seat-app/services/swapEngine.ts) | 301 | Match types: `DIRECT`, `TRIANGULAR`, `CHAIN` |
| [swapStore.ts](file:///c:/Users/Yogesh/dev/seat-app/services/swapStore.ts) | 672 | Data types: `LocalSwap`, `SeatType`, `SwapReason`, `SwapStatus` |

---

## RM-SW-001 — Refactor `swap.tsx` into Component Modules

| Field | Value |
|-------|-------|
| **Assignee** | Frontend Agent |
| **Priority** | P1 (Blocker — all other UI tickets depend on this) |
| **Estimated Effort** | 2-3 hours |

### Objective
Break the 1,123-line `swap.tsx` monolith into focused, reusable component files. The screen file should only orchestrate state and tab switching.

### File Structure to Create

```
components/
└── swap/
    ├── BrowseTab.tsx          # Browse offers tab content
    ├── RegisterTab.tsx        # Register swap form tab content
    ├── MySwapTab.tsx           # Active swap + matches tab content
    ├── OfferCard.tsx           # Individual swap offer display
    ├── MatchCard.tsx           # Individual match display with accept button
    ├── DemandHeatmap.tsx       # Analytics heatmap visualization
    ├── SwapPreview.tsx         # "You Have → You Want" visual indicator
    ├── MeshStatusBar.tsx       # Connection banner + peer count
    └── swap.styles.ts          # ALL shared styles, extracted from swap.tsx
```

### Acceptance Criteria
- [ ] `swap.tsx` reduced to ≤300 lines — only contains: state declarations, `useEffect` hooks, handler functions, tab switching, and renders `<BrowseTab>`, `<RegisterTab>`, `<MySwapTab>`
- [ ] Each extracted component has an explicit TypeScript `Props` interface
- [ ] All styles extracted to `components/swap/swap.styles.ts` as a named export `swapStyles`
- [ ] **Zero visual regressions** — pixel-identical to the current UI
- [ ] No circular imports — components import from `swapStore` and `swapEngine` directly if needed, parent passes callbacks via props
- [ ] Each component file is under 250 lines

### Detailed Decomposition Map

#### `BrowseTab.tsx`
**Lines extracted from swap.tsx**: ~L452–L583
**Props Interface**:
```typescript
interface BrowseTabProps {
  trainNo: string;
  journeyDate: string;
  offers: LocalSwap[];
  analytics: SwapAnalytics | null;
  browseLoading: boolean;
  hasBrowsed: boolean;
  onBrowse: () => void;
  onGoToRegister: () => void;
}
```
**Contains**: Browse button, results header with refresh, offer list or empty state, demand heatmap

#### `RegisterTab.tsx`
**Lines extracted from swap.tsx**: ~L586–L715
**Props Interface**:
```typescript
interface RegisterTabProps {
  submitted: boolean;
  trainNo: string;
  coachId: string;
  seatNo: string;
  currentType: SeatType | '';
  desiredType: SeatType | '';
  reason: SwapReason;
  loading: boolean;
  isFormValid: boolean;
  onCoachIdChange: (val: string) => void;
  onSeatNoChange: (val: string) => void;
  onCurrentTypeChange: (val: SeatType) => void;
  onDesiredTypeChange: (val: SeatType) => void;
  onReasonChange: (val: SwapReason) => void;
  onSubmit: () => void;
  onGoToMySwap: () => void;
}
```
**Contains**: Form fields, berth selectors, reason selector, swap preview, submit button

#### `MySwapTab.tsx`
**Lines extracted from swap.tsx**: ~L718–L846
**Props Interface**:
```typescript
interface MySwapTabProps {
  submitted: boolean;
  activeSwapObj: LocalSwap | null;
  matchedPartnerObj: LocalSwap | null;
  matches: SwapMatch[];
  matchLoading: boolean;
  acceptedIds: string[];
  peerCount: number;
  mySwapId: string | null;
  isAccepted: boolean;
  coachId: string;
  seatNo: string;
  currentType: SeatType | '';
  desiredType: SeatType | '';
  onFindMatches: () => void;
  onAcceptSwap: (match: SwapMatch) => void;
  onCancelSwap: (swapId: string) => void;
  onGoToRegister: () => void;
}
```

#### `OfferCard.tsx`
**Lines extracted from swap.tsx**: ~L531–L567 (the `offers.map(...)` block)
**Props Interface**:
```typescript
interface OfferCardProps {
  offer: LocalSwap;
}
```
**Contains**: Icon box, seat/coach label, has/wants, priority badge, time since, expiry text, swap visual chips

#### `MatchCard.tsx`
**Lines extracted from swap.tsx**: ~L779–L818 (the `matches.map(...)` block)
**Props Interface**:
```typescript
interface MatchCardProps {
  match: SwapMatch;
  isAccepted: boolean;
  onAccept: (match: SwapMatch) => void;
}
```

#### `DemandHeatmap.tsx`
**Lines extracted from swap.tsx**: ~L491–L528
**Props Interface**:
```typescript
interface DemandHeatmapProps {
  analytics: SwapAnalytics;
}
```

#### `SwapPreview.tsx`
**Lines extracted from swap.tsx**: ~L671–L687
**Props Interface**:
```typescript
interface SwapPreviewProps {
  currentType: SeatType;
  desiredType: SeatType;
}
```

#### `MeshStatusBar.tsx`
**Lines extracted from swap.tsx**: ~L392–L399 (mesh banner)
**Props Interface**:
```typescript
interface MeshStatusBarProps {
  meshActive: boolean;
  peerCount: number;
}
```

### Helper Functions to Keep in `swap.tsx` (or extract to a `swap.utils.ts`)
These are used across multiple components and should either stay in the parent or be extracted to a shared utilities file:
- `getSeatTypeLabel(type: string): string`
- `getTimeSince(timestamp: number): string`
- `getTimeUntilExpiry(expiresAt: number): string`
- `getReasonEmoji(reason: string): string`
- `getPriorityColor(score: number): string`

### Constants to Extract
The `SEAT_TYPES` and `REASONS` arrays (swap.tsx L38–L51) should move to `components/swap/swap.constants.ts` since multiple components need them.

> [!IMPORTANT]
> This ticket is a pure refactor. If any visual change is detected, it's a bug in the extraction. Test by comparing screenshots before and after.

---

## RM-SW-003 — Offline/Online Status Indicator

| Field | Value |
|-------|-------|
| **Assignee** | Frontend Agent (logic) + UI/UX Agent (visual design) |
| **Priority** | P1 |
| **Estimated Effort** | 1-2 hours |
| **Depends On** | RM-SW-001 (uses `MeshStatusBar.tsx`) |

### Objective
Replace the current minimal mesh dot/count in the header with a clear, always-visible connection status indicator that tells users exactly what connectivity mode they're in.

### Three Connection States

| State | Condition | Visual | Label |
|-------|-----------|--------|-------|
| 🟢 **Full Sync** | Internet available + P2P peers found | Green dot + gradient banner | `Online · {n} nearby` |
| 🟡 **P2P Only** | No internet + P2P peers found | Amber dot + subtle banner | `Offline · P2P with {n} nearby` |
| 🔴 **Isolated** | No internet + no P2P peers | Red dot + muted indicator | `No connections` |
| 🔵 **Cloud Only** | Internet available + no P2P peers | Blue dot + banner | `Online · Searching nearby...` |

### Implementation Spec

#### New Dependency: `@react-native-community/netinfo`
- **Check first**: This may already be available transitively through Expo SDK 54. The Frontend Agent should verify with:
  ```
  npx expo install @react-native-community/netinfo
  ```
- Use `NetInfo.addEventListener` to watch for connectivity changes in real-time

#### File: `components/swap/MeshStatusBar.tsx` (enhance existing from RM-SW-001)

**Updated Props Interface**:
```typescript
interface MeshStatusBarProps {
  meshActive: boolean;
  peerCount: number;
  isOnline: boolean;       // NEW — from NetInfo
  cloudConnected: boolean; // NEW — true if CloudSyncBridge has reached the server
}
```

**State Logic (pseudo-code)**:
```typescript
const getConnectionState = () => {
  if (isOnline && peerCount > 0) return 'FULL_SYNC';      // 🟢
  if (isOnline && peerCount === 0) return 'CLOUD_ONLY';   // 🔵
  if (!isOnline && peerCount > 0) return 'P2P_ONLY';      // 🟡
  return 'ISOLATED';                                       // 🔴
};
```

#### Visual Spec (for UI/UX Agent)
- **Position**: Compact horizontal bar directly below the header, above the tab bar
- **Height**: 36px with 12px horizontal padding
- **Background**: Tinted version of the status color at 10% opacity (e.g., green → `#27AE6018`)
- **Left**: Status dot (8px circle with the status color) — gently pulsing animation for `FULL_SYNC` and `P2P_ONLY`
- **Center**: Status text in `Colors.text.secondary`, font-weight 600, size 12
- **Right**: Peer count badge (small rounded rectangle, similar to current `meshStatus` style)
- **Border**: 1px border using status color at 20% opacity
- **Corner radius**: 10px
- **Transitions**: Use `LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInOut)` when state changes

#### Integration Point in `swap.tsx`
```typescript
// Add to swap.tsx state:
const [isOnline, setIsOnline] = useState(true);

// Add to useEffect:
import NetInfo from '@react-native-community/netinfo';
const unsubscribe = NetInfo.addEventListener(state => {
  setIsOnline(state.isConnected ?? false);
});
return () => unsubscribe();
```

### Acceptance Criteria
- [ ] Status bar visible in all three tabs (Browse, Register, My Swap) — it sits above the tabs
- [ ] Changes in real-time when toggling airplane mode on/off
- [ ] Peer count updates when mesh bridge discovers/loses peers
- [ ] Smooth color transition when state changes (no jarring flicker)
- [ ] Accessible: screen readers announce connection state changes
- [ ] Doesn't push content down excessively — max 36px height

---

## RM-SW-002 — P2P Discovery Radar Animation

| Field | Value |
|-------|-------|
| **Assignee** | UI/UX Agent |
| **Priority** | P2 |
| **Estimated Effort** | 2-3 hours |
| **Depends On** | RM-SW-001 (component structure must exist) |

### Objective
When the mesh bridge is scanning for peers but hasn't found any yet, display an engaging radar/sonar animation. When peers are found, transition smoothly to the connected state.

### Animation States

| State | Visual |
|-------|--------|
| **Scanning** (`meshActive && peerCount === 0`) | Pulsing radar rings expanding outward from center with phone icon |
| **Found** (`meshActive && peerCount > 0`) | Rings collapse inward, peer count appears with checkmark |
| **Inactive** (`!meshActive`) | Static phone icon with "Start scanning" prompt |

### Visual Spec

#### Radar Animation (Scanning State)
- **Container**: 120×120px centered
- **Center**: Phone icon (`Ionicons: phone-portrait-outline`, 28px, `Colors.primary.start`)
- **Rings**: 3 concentric circles expanding from center
  - Ring 1: 40px → 80px diameter, 300ms delay
  - Ring 2: 40px → 100px diameter, 600ms delay
  - Ring 3: 40px → 120px diameter, 900ms delay
  - Each ring: 2px border with `Colors.primary.start`, opacity fading from 0.6 → 0 as it expands
  - Duration: 2000ms per ring, looping
- **Use**: `react-native-reanimated` (already installed v4.1.1) for 60fps performance
  - `useSharedValue` for ring scale and opacity
  - `withRepeat(withSequence(...))` for the loop
  - `useAnimatedStyle` for each ring
- **Below rings**: Text "Searching for nearby passengers..." in `Colors.text.tertiary`, size 13, italic

#### Transition to Found State
- All 3 rings scale down to a single solid circle (50px)
- Circle color fills to `Colors.success.start`
- Checkmark icon (`Ionicons: checkmark-circle`, 24px, white) fades in inside the circle
- Peer count text appears below: `"{n} passenger{s} nearby"` in `Colors.success.start`
- Transition duration: 400ms with spring physics

### File Location
Create: `components/swap/RadarAnimation.tsx`

**Props Interface**:
```typescript
interface RadarAnimationProps {
  isScanning: boolean;   // mesh is active
  peerCount: number;     // 0 = scanning, >0 = found
}
```

### Integration
- Render inside `MySwapTab.tsx` when swap is submitted and `peerCount === 0`
- Render inside `BrowseTab.tsx` as part of the "searching" state during initial browse
- Also usable in the connection banner area when first connecting

### Acceptance Criteria
- [ ] Radar rings animate at 60fps (verified on Android mid-range device — Samsung A-series or equivalent)
- [ ] Uses `react-native-reanimated` (NOT `Animated` from RN core) for UI thread animations
- [ ] All animated values use `useNativeDriver: true` equivalent (Reanimated handles this by default)
- [ ] Smooth transition from scanning → found state
- [ ] No memory leaks — animation stops when component unmounts (use `cancelAnimation` in cleanup)
- [ ] Works in both light theme and potential future dark theme (use Colors tokens, no hardcoded colors)

> [!TIP]
> Reference the existing floating ticket animations in `index.tsx` (L40-65) for the coding pattern used in this project with `Animated`. But for this component, upgrade to `react-native-reanimated` for better performance.

---

## RM-SW-004 — Multi-Party Swap Chain Visualization

| Field | Value |
|-------|-------|
| **Assignee** | UI/UX Agent |
| **Priority** | P2 |
| **Estimated Effort** | 2-3 hours |
| **Depends On** | RM-SW-001 (needs `MatchCard.tsx` to exist) |

### Objective
For `TRIANGULAR` (3-way) and `CHAIN` (4-5 way) match types, render a visual chain diagram showing how seats flow between participants, making complex multi-party swaps intuitive.

### Current Problem
The current match card (swap.tsx L779-818) shows participants as a flat list with "Has/Wants" text. For a 3-way swap, it's confusing — users can't see _how_ the swap chain resolves.

### Visual Spec

#### Chain Diagram Layout (Horizontal Scroll for 4+ participants)
```
┌──────────┐      ┌──────────┐      ┌──────────┐
│ 👤 YOU   │  →   │ 👤 P2    │  →   │ 👤 P3    │  ─┐
│ B3/42    │      │ S1/17    │      │ B2/8     │   │
│ Has: MB  │      │ Has: LB  │      │ Has: UB  │   │
│ Gets: LB │      │ Gets: UB │      │ Gets: MB │   │
└──────────┘      └──────────┘      └──────────┘   │
      ↑                                             │
      └─────────────────────────────────────────────┘
```

#### Node Design
- **Container**: 100px wide, rounded rectangle (borderRadius: 14)
- **Your Node**: Highlighted border with `Colors.primary.start`, background `Colors.primary.light`
- **Other Nodes**: Border `Colors.card.border`, background `Colors.card.background`
- **Content**:
  - Top: Person icon + label ("YOU" or "P2", "P3" etc.) — font-weight 700, size 11
  - Middle: Coach/Seat (`B3/42`) — font-weight 800, size 14, `Colors.text.primary`
  - Bottom row 1: `Has:` + berth type with berth color dot from `Colors.berth.*`
  - Bottom row 2: `Gets:` + berth type with berth color dot
- **Arrow between nodes**: Animated dashed line with a small chevron (`→`), color `Colors.text.tertiary`
- **Cycle closing arrow**: Curved dotted line from last node back to first node (bottom of the chain)

#### For DIRECT (2-way) Swaps — Simpler Visual
```
┌──────────┐   ⇄   ┌──────────┐
│ 👤 YOU   │       │ 👤 Other │
│ B3/42    │       │ S1/17    │
│ MB → LB  │       │ LB → MB  │
└──────────┘       └──────────┘
```
- Two nodes side by side with a double-arrow swap icon in between
- Swap icon: `MaterialCommunityIcons: swap-horizontal-bold`, 24px, inside a gradient circle

#### Data Source
The `SwapMatch` type from `swapEngine.ts` provides everything needed:
```typescript
interface SwapMatch {
  type: 'DIRECT' | 'TRIANGULAR' | 'CHAIN';
  participants: MatchParticipant[];  // ordered in cycle order
  cyclePath: string;                 // "MB → LB → UB → MB"
  score: number;
}

interface MatchParticipant {
  coachId: string;
  seatNo: number;
  has: SeatType;
  wants: SeatType;
  isYou: boolean;
}
```

The `participants` array is already in cycle order — participant[0].wants === participant[1].has, and so on.

### File Location
Create: `components/swap/SwapChainViz.tsx`

**Props Interface**:
```typescript
interface SwapChainVizProps {
  match: SwapMatch;
}
```

### Berth Color Mapping
Use existing `Colors.berth` tokens:
```typescript
const berthColor: Record<SeatType, string> = {
  LOWER: Colors.berth.lower,      // '#E8614D'
  MIDDLE: Colors.berth.middle,    // '#F2994A'
  UPPER: Colors.berth.upper,      // '#2D9CDB'
  SIDE_LOWER: Colors.berth.sideLower, // '#27AE60'
  SIDE_UPPER: Colors.berth.sideUpper, // '#6C63FF'
};
```

### Acceptance Criteria
- [ ] `DIRECT` matches render the 2-node side-by-side layout
- [ ] `TRIANGULAR` matches render 3 nodes in a horizontal chain with closing arrow
- [ ] `CHAIN` (4-5 way) renders horizontally scrollable chain
- [ ] Current user's node is visually distinct (highlighted border + background)
- [ ] Each node shows berth type with the correct color from `Colors.berth.*`
- [ ] The "Accept" button is positioned below the chain visualization
- [ ] Works on screens as narrow as 320px (iPhone SE width)
- [ ] Chain is horizontally scrollable for 4+ participants (use `ScrollView horizontal`)

---

## RM-SW-005 — Swap Success Celebration Screen

| Field | Value |
|-------|-------|
| **Assignee** | UI/UX Agent (animation/visual) + Frontend Agent (state integration) |
| **Priority** | P3 |
| **Estimated Effort** | 2 hours |
| **Depends On** | RM-SW-001 |

### Objective
After a user accepts a swap, transition from the match card to a full-screen success celebration with actionable next steps.

### Trigger
When `acceptMatch()` succeeds in `swapStore.ts` and the active swap status transitions to `ACCEPTED` or `MATCHED`.

### Visual Spec

#### Phase 1: Celebration (0–2 seconds)
- Full card takeover in `MySwapTab` (not a new screen — stays within the tab)
- **Background**: Gradient from `Colors.success.light` to `Colors.card.background`
- **Center**: Large animated checkmark
  - Circle scales from 0 → 1 with spring physics
  - Checkmark draws itself (stroke animation) inside the circle
  - Use `react-native-reanimated` for the circle scale
- **Confetti**: 8-12 small colored dots (using berth colors) that burst upward from center and fade
  - Each dot: 6px circle, random velocity, gravity-affected fall
  - Duration: 1.5 seconds
- **Haptic**: Trigger `expo-haptics` — `Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)`

#### Phase 2: Information (after 2 seconds, auto-transition)
- Checkmark shrinks to 48px and moves to top-left of the card
- **Main text**: "Swap Accepted! 🎉" — size 22, weight 800
- **Swap details card** (white inset with subtle border):
  ```
  ┌─────────────────────────────┐
  │  Walk to: Coach B3, Seat 17 │
  │  Currently: Lower Berth     │
  │  Show this screen to the    │
  │  other passenger             │
  └─────────────────────────────┘
  ```
  - Coach/Seat from `matchedPartnerObj.currentCoachId` / `matchedPartnerObj.currentSeatNo`
  - Berth type from `matchedPartnerObj.currentSeatType`
- **Buttons**:
  1. `Mark as Completed` — Gradient primary button → calls `updateSwapStatus(swapId, 'COMPLETED')`
  2. `Report Problem` — Outlined danger button → opens Alert with options: "Other person not there", "Wrong seat", "Changed my mind" → calls `updateSwapStatus(swapId, 'CANCELLED')`

### File Location
Enhance existing `MySwapTab.tsx` (from RM-SW-001) — the accepted state section (currently swap.tsx L732-743).

Optionally extract the celebration animation to: `components/swap/SwapCelebration.tsx`

**Props Interface**:
```typescript
interface SwapCelebrationProps {
  partnerCoachId: string;
  partnerSeatNo: number;
  partnerSeatType: SeatType;
  onComplete: () => void;      // Mark swap as completed
  onReportProblem: (reason: string) => void;
}
```

### State Machine
```
ACCEPTED → [user sees celebration] → [user taps "Mark as Completed"] → COMPLETED
                                    → [user taps "Report Problem"] → CANCELLED (with reason in metadata)
```

### Acceptance Criteria
- [ ] Celebration animation plays immediately when swap transitions to ACCEPTED
- [ ] Haptic feedback fires on success
- [ ] "Walk to" instructions display the correct partner coach/seat info
- [ ] "Mark as Completed" button transitions swap to COMPLETED status
- [ ] "Report Problem" button shows Alert with 3 reason options and transitions to CANCELLED
- [ ] Confetti dots use colors from `Colors.berth.*` palette for visual coherence
- [ ] Animation doesn't replay if user switches tabs and comes back (guard with a `hasSeenCelebration` ref)
- [ ] Works on Android (no iOS-specific APIs used in animation)

---

## Execution Matrix

| Ticket | Frontend Agent | UI/UX Agent | Order |
|--------|---------------|-------------|-------|
| **RM-SW-001** (Refactor) | ✅ Primary owner | — | 1st (blocker) |
| **RM-SW-003** (Status indicator) | ✅ NetInfo integration + state logic | ✅ Visual design + transitions | 2nd (parallel) |
| **RM-SW-002** (Radar animation) | — | ✅ Primary owner | 3rd |
| **RM-SW-004** (Chain viz) | — | ✅ Primary owner | 4th |
| **RM-SW-005** (Celebration) | ✅ State integration + button handlers | ✅ Animation + visual | 5th |

### Handoff Protocol
1. **Frontend Agent** completes RM-SW-001 first (the refactor). This creates the component files that all other tickets will modify.
2. After RM-SW-001 merges, both agents can work in parallel:
   - Frontend Agent → RM-SW-003 (logic side)
   - UI/UX Agent → RM-SW-003 (visual side), then RM-SW-002, RM-SW-004
3. RM-SW-005 requires both agents to coordinate — UI/UX Agent builds the celebration component, Frontend Agent wires the state transitions.

> [!WARNING]
> **Merge conflict risk**: Both agents touch `MySwapTab.tsx`. Coordinate via clearly separated concerns — UI/UX Agent adds visual components, Frontend Agent adds state handlers. Do NOT both edit the same lines.

### Definition of Done (Entire Workstream)
- [ ] `swap.tsx` is under 300 lines
- [ ] All 8 component files exist under `components/swap/`
- [ ] Connection status reflects real network state in real-time
- [ ] Radar animation runs at 60fps on a mid-range Android device
- [ ] Chain visualization renders correctly for 2-way, 3-way, and 5-way matches
- [ ] Celebration screen plays once per accepted swap
- [ ] No new dependencies added beyond `@react-native-community/netinfo` (if needed)
- [ ] All components use `Colors` tokens — zero hardcoded color values
