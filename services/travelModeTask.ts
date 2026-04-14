/**
 * travelModeTask.ts — Chunk 3: React Native Headless JS Bridge
 *
 * This task runs in a headless JS context when:
 *   a) Android's GeofenceBroadcastReceiver starts TravelModeService, which
 *      in turn calls RN's HeadlessTask to execute offline CRDT gossip.
 *   b) The TravelModeService periodically wakes this task to sync the
 *      notification with live speed + peer count.
 *
 * AppRegistry.registerHeadlessTask('TravelModeTask', ...) is called in
 * index.ts so this runs even when the app UI is not mounted.
 *
 * Data flow:
 *   Kotlin Service → HeadlessTask (this file) → swapStore CRDT gossip
 *                                              → update notification via TravelModeModule
 */

import { AppRegistry } from 'react-native';
import { getMySwaps, pruneExpired } from './swapStore';

// --- Task Payload ---

interface TravelModeTaskData {
    /** km/h from the native GPS listener (0 if not started) */
    speedKmh: number;
    /** Connected peer count from NearbyMeshBridge */
    peerCount: number;
    /** Train number currently active */
    trainNo: string;
}

// --- Headless Task ---

/**
 * Runs offline CRDT maintenance when the JS engine is woken in headless mode.
 *
 * 1. Prune expired swaps so stale offers don't persist
 * 2. Check if any of our swaps are now ACCEPTED (swap complete)
 * 3. Return the notification state to Kotlin via the completion callback
 *    (the native side reads the resolved value)
 *
 * Must complete in < 30 seconds or Android forcibly terminates the task.
 */
const travelModeTask = async (taskData: TravelModeTaskData): Promise<void> => {
    const { speedKmh = 0, peerCount = 0 } = taskData ?? {};

    console.log('[TravelModeTask] Headless task started — speed:', speedKmh, 'peers:', peerCount);

    try {
        // 1. Prune expired swaps (lightweight CRDT maintenance)
        await pruneExpired();

        // 2. Determine swap state for the notification
        const mySwaps = await getMySwaps();
        const hasCompletedSwap = mySwaps.some(s => s.status === 'COMPLETED');
        const hasActiveSwap = mySwaps.some(s => s.status === 'OPEN' || s.status === 'MATCHED' || s.status === 'ACCEPTED');

        const swapState: 'WAITING' | 'FOUND' | 'COMPLETE' = hasCompletedSwap
            ? 'COMPLETE'
            : hasActiveSwap
                ? 'FOUND'
                : 'WAITING';

        // 3. Update the foreground notification (delegated to native via NativeModules if available)
        // In a headless context we can access NativeModules from React Native
        const { NativeModules } = await import('react-native');
        if (NativeModules.TravelModeModule) {
            NativeModules.TravelModeModule.updateNotification(speedKmh, peerCount, swapState);
        }

        console.log('[TravelModeTask] Headless task complete — swapState:', swapState);
    } catch (error) {
        console.error('[TravelModeTask] Error during headless task:', error);
    }
};

// Register the task so Android can wake it headlessly
AppRegistry.registerHeadlessTask('TravelModeTask', () => travelModeTask);

export default travelModeTask;
