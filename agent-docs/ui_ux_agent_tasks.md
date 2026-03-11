# 🎨 UI/UX Agent Task Specification: Seat Swap V1

> **Role**: Visual Design, Micro-Animations, and UI Components
> **Context**: You are working on the Seat Swap V1 UI/UX Polish workstream alongside a Frontend Agent.
> **Key Objective**: Build high-quality, 60fps animations and polished visual components for the complex interactions (P2P discovery, multi-party chains, success celebrations).

---

## 📡 Ticket: RM-SW-003(B) — Connection Status Visuals
**Priority**: P1 | **Depends On**: Frontend Agent wiring `NetInfo` logic in `swap.tsx`.

### Objective
Build the presentation layer of `MeshStatusBar.tsx` to clearly communicate 1 of 4 connection states.

### Visual Specification
- **Container**: Compact horizontal bar, 36px height, 12px padding, 10px borderRadius. Sits below the screen header, above the tabs.
- **Left Element**: 8px status dot.
- **Center Element**: Text (e.g., "Online · {n} nearby" or "Offline · P2P with {n} nearby"). `Colors.text.secondary`, weight 600, size 12.
- **States**:
  - 🟢 **FULL_SYNC**: Green dot (`Colors.success.start`), Background 10% opacity, gently pulsing dot.
  - 🟡 **P2P_ONLY**: Amber dot (`Colors.warning.start`), Background 10% opacity, gently pulsing dot.
  - 🔵 **CLOUD_ONLY**: Blue dot (`Colors.accent.start`), Background 10% opacity. Text: "Searching nearby..."
  - 🔴 **ISOLATED**: Red dot (`Colors.danger.start`), Background muted. Text: "No connections".
- **Interactions**: Use `LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInOut)` when the state shifts to avoid jarring jumps.

---

## 📡 Ticket: RM-SW-002 — P2P Discovery Radar Animation
**Priority**: P2 | **Standalone Task**

### Objective
Create a `RadarAnimation.tsx` component inside `components/swap/` to show when the mesh is active but zero peers are found.

### Animation Specification (Reanimated)
- **Container**: 120x120px, centered.
- **Center Icon**: Phone (`Ionicons: phone-portrait-outline`, 28px, `Colors.primary.start`).
- **Rings**: 3 concentric circles expanding outward from the phone.
  - Ring 1 scales 40px → 80px (delay 300ms)
  - Ring 2 scales 40px → 100px (delay 600ms)
  - Ring 3 scales 40px → 120px (delay 900ms)
  - Scale up while fading opacity from 0.6 → 0. Loop duration: 2000ms.
- **Transition down**: When `peerCount > 0`, the rings collapse into a solid `Colors.success.start` circle (50px), the icon swaps to a white checkmark, and a `{n} passengers nearby` label fades in underneath.
- **Requirement**: MUST use `react-native-reanimated` for smooth UI-thread performance. 

---

## 🔗 Ticket: RM-SW-004 — Multi-Party Swap Chain Visualization
**Priority**: P2 | **Standalone Task**

### Objective
Create a `SwapChainViz.tsx` component to visualize how a 3-way, 4-way, or 5-way swap revolves.

### Visual Specification
- **Layout**: Horizontal, scrollable (`<ScrollView horizontal>`) container for nodes.
- **Node Style**: 100px wide rounded rectangle, 14px border radius.
  - **Your Node**: Border `Colors.primary.start`, Background `Colors.primary.light`.
  - **Other Nodes**: Border `Colors.card.border`, Background `Colors.card.background`.
- **Node Content**:
  - Person Label: "YOU" or "P2", "P3" (size 11, bold).
  - Seat Details: `B3/42` (size 14, `Colors.text.primary`, bold).
  - Has/Gets: Use `Colors.berth.*` tokens to render small colored dots next to the seat types.
- **Connecting Arrows**: Animated dashed lines with a `→` chevron connecting the nodes.
- **Closing the Loop**: A curved dotted line connecting the very last node back to the first.
- **DIRECT Swaps (2-way)**: Just render two adjacent boxes with a gradient `MaterialCommunityIcons: swap-horizontal-bold` circle between them.

---

## 🎉 Ticket: RM-SW-005(B) — Swap Success Celebration
**Priority**: P3 | **Collaboration**: Frontend Agent provides the `onComplete` / `onReportProblem` callbacks.

### Objective
Build the success animation and actionable follow-up card shown inside `MySwapTab` when a swap is accepted.

### Animation Specification
- **Phase 1 (Celebration - 0-2s)**: 
  - Full screen gradient (`Colors.success.light` to `Colors.card.background`).
  - Spring-scaled checkmark circle.
  - Confetti burst: 8-12 dots (colored using the 5 `Colors.berth.*` tokens), exploding outward from the center with gravity/fade.
- **Phase 2 (Action - 2s onwards)**:
  - Checkmark shrinks and moves top-left.
  - "Walk to: Coach X, Seat Y" card appears.
  - Render the "Mark as Completed" (Primary Gradient) and "Report Problem" (Outlined Danger) buttons provided via props.

---

## ⚠️ Collaboration Rules
- The **Frontend Agent** is currently executing RM-SW-001 (Refactoring `swap.tsx`). Wait until they establish the basic file skeletons in `components/swap/` before heavily editing the tab structure.
- You own the styling (`swap.styles.ts` additions), animations, and granular component UI (Cards, heatmaps, svgs).
- Stick strictly to the `Colors.ts` tokens. Do not introduce new hex codes.
