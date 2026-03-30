# Task Checklist: Automated Geofence Mesh Network

> [!TIP]
> **HOW TO RESUME YOUR SESSION LATER:**
> Copy and paste the exact text below into a **New Chat Window** when your AI credits replenish. This forces the new assistant to read this file and instantly restore your architecture plans!
> 
> ***"Please resume work on the Auto-Wake Geofencing Mesh architecture. Read the `docs/offline_mesh_architecture.md` and `docs/offline_mesh_tasklist.md` artifacts and begin executing Chunk 1: UI & Data Foundation."***

---

This checklist tracks our execution across the 4 major architectural chunks to implement the "Travel Mode" offline mesh network.

## Chunk 1: UI & Data Foundation
- `[ ]` Add a static `assets/stations.json` containing Indian Railway station codes and GPS coordinates.
- `[ ]` Update `services/swapStore.ts` (the `LocalSwap` interface) to accept `boardingStation` and `destinationStation` data.
- `[ ]` Update `components/swap/RegisterTab.tsx` UI to capture the Boarding and Destination stations from the user via dropdown/search.

## Chunk 2: Active Speedometer & Permissions
- `[ ]` Install `expo-location` and required plugins.
- `[ ]` Create `services/locationService.ts` to request `ACCESS_BACKGROUND_LOCATION` with an elegant rationale screen for the user.
- `[ ]` Implement raw GPS speed calculation logic (m/s to km/h).
- `[ ]` Add a live Speedometer UI to the active Swap screen to verify math accuracy.

## Chunk 3: Native Android Service (The Unkillable Notification)
- `[ ]` Modify `android/app/src/main/AndroidManifest.xml` (Add Foreground Service permissions).
- `[ ]` Refactor Native Android Kotlin code into a standalone `Service`.
- `[ ]` Build the persistent notification UI showing the dynamic 4-state speedometer and mesh stats.
- `[ ]` Implement React Native Headless JS task to bridge offline CRDT gossip payloads between the Kotlin Service and the Javascript database.

## Chunk 4: Geofence Auto-Wake Triggers
- `[ ]` Hook Chunk 1's boarding/destination coordinates to Android's `GeofencingClient`.
- `[ ]` Configure the Geofence `BroadcastReceiver` to automatically start Chunk 3's service upon arriving at the station.
- `[ ]` Configure the Geofence `BroadcastReceiver` to gracefully kill Chunk 3's service upon exiting the destination.
- `[ ]` Implement the iOS Live Activities (Dynamic Island) fallback notification for iPhone users.
