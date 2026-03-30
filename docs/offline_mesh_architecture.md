# Automated Geofence Mesh Network & Speedometer

## 1. The Core Architecture
This architecture transforms the app from a manual P2P tool into an automated, zero-friction travel companion. By using the OS location APIs, we dynamically geofence the user's specific boarding and destination stations to automatically start and stop the offline mesh network.

## 2. Dynamic Notifications & The Live Speedometer
To legally run heavy networking (WiFi/Bluetooth) in the background on Android, Google mandates a Foreground Service notification. We turn this legal requirement into a premium product feature: **The Offline GPS Speedometer**.

The notification actively changes state based on journey progress:
1. **Pre-Boarding (At Station geofence breach):** *"🔎 Waiting for Train 12424 to depart..."*
2. **In-Transit (Speed > 5 km/h):** *"🚄 Speed: 84 km/h • 🔄 3 Swap Offers Nearby"*
3. **Post-Swap (Relay Node):** *"🚄 Speed: 112 km/h • ✅ Swap Complete!"*
4. **Arriving (Destination geofence breach):** App gracefully shuts down.

## 3. The iOS Fallback Strategy (Live Activities)
Apple iOS strictly prohibits automatically launching a persistent 10-hour background network process when the app is fully closed. When the iOS user enters the Boarding geofence, they will receive a highly appealing local notification designed to get them to open the app manually:

> 🚆 **Train 12424 is Boarding!**
> Tap to launch your Live Speedometer & Seat Swap Companion for the journey.

Once tapped, the app opens, the mesh connects, and the Speedometer transitions to the iOS **Dynamic Island / Lock Screen**, keeping the app legally alive while the screen is locked.

## 4. Execution Roadmap (The 4 Chunks)
Due to extreme native complexity, implementation is broken down strictly to minimize risk:
* **Chunk 1: UI & Data Foundation** (Add Source/Dest to Swap UI & Store)
* **Chunk 2: Active Speedometer** (Install `expo-location` & implement GPS math)
* **Chunk 3: Native Android Service** (The unkillable Notification)
* **Chunk 4: Geofence Triggers** (Hooking Chunk 1 to Chunk 3)
