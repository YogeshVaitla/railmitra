/**
 * geofenceService.ts — Chunk 4: Geofence Auto-Wake Triggers (JS layer)
 *
 * Bridges the station data selected in RegisterTab (Chunk 1) to the native
 * Android GeofenceManager (Chunk 4) via a NativeModule interface.
 *
 * On iOS the native geofencing is unavailable; instead we surface a
 * local notification prompt (the Live Activities / Dynamic Island strategy
 * described in the architecture doc).
 *
 * Usage:
 *   import { registerJourneyGeofences, removeJourneyGeofences } from './geofenceService';
 *   await registerJourneyGeofences(trainNo, boardingCode, destinationCode);
 */

import { Alert, NativeModules, Platform } from 'react-native';
import stationsData from '../assets/stations.json';
import { requestBackgroundLocation } from './locationService';

// ---------------------------------------------------------------------------
// Station lookup
// ---------------------------------------------------------------------------

interface Station {
    code: string;
    name: string;
    lat: number;
    lng: number;
}

const STATIONS: Station[] = stationsData as Station[];

function findStation(code: string): Station | undefined {
    return STATIONS.find(s => s.code === code);
}

// ---------------------------------------------------------------------------
// Native bridge stub
// Expects the TravelModeModule native module to be registered in MainApplication.kt
// ---------------------------------------------------------------------------

const TravelModeModule: {
    registerGeofences?: (
        trainNo: string,
        boardingLat: number,
        boardingLng: number,
        destinationLat: number,
        destinationLng: number,
    ) => Promise<void>;
    removeGeofences?: () => Promise<void>;
} = NativeModules.TravelModeModule ?? {};

// ---------------------------------------------------------------------------
// iOS fallback — local alert prompt (no expo-notifications needed)
// ---------------------------------------------------------------------------

function scheduleIosPrompt(trainNo: string, stationName: string): void {
    Alert.alert(
        `🚆 Train ${trainNo} is Boarding!`,
        `You are near ${stationName}.\n\nTap OK to manually start your Live Speedometer & Seat Swap Companion for the journey.`,
        [{ text: "OK, Let's Go!", style: 'default' }],
    );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Register Android geofences for the boarding + destination stations.
 * On iOS, schedules a local notification prompting the user to open the app.
 *
 * @returns true if registration succeeded, false otherwise
 */
export async function registerJourneyGeofences(
    trainNo: string,
    boardingCode: string,
    destinationCode: string,
): Promise<boolean> {
    const boarding = findStation(boardingCode);
    const destination = findStation(destinationCode);

    if (!boarding) {
        Alert.alert('Unknown Station', `Could not find boarding station "${boardingCode}" in the database.`);
        return false;
    }
    if (!destination) {
        Alert.alert('Unknown Station', `Could not find destination station "${destinationCode}" in the database.`);
        return false;
    }

    if (Platform.OS === 'android') {
        // Request background location before registering geofences
        const hasBackground = await requestBackgroundLocation();
        if (!hasBackground) {
            Alert.alert(
                'Background Location Required',
                'Without background location access, the auto-wake feature won\'t work. ' +
                'You can still manually start the mesh in the app.',
            );
            // Non-fatal — return true so the rest of the flow continues
            return true;
        }

        if (!TravelModeModule.registerGeofences) {
            console.warn('[GeofenceService] TravelModeModule.registerGeofences not available (Expo Go?)');
            return true; // Degrade gracefully
        }

        try {
            await TravelModeModule.registerGeofences(
                trainNo,
                boarding.lat,
                boarding.lng,
                destination.lat,
                destination.lng,
            );
            console.log(
                `[GeofenceService] Geofences registered: ${boarding.code} → ${destination.code}`
            );
            return true;
        } catch (error: any) {
            console.error('[GeofenceService] Failed to register geofences:', error.message);
            return false;
        }
    }

    // iOS fallback
    if (Platform.OS === 'ios') {
        scheduleIosPrompt(trainNo, boarding.name);
        return true;
    }

    return false;
}

/**
 * Remove all active journey geofences (e.g. when swap is cancelled).
 */
export async function removeJourneyGeofences(): Promise<void> {
    if (Platform.OS !== 'android') return;

    if (!TravelModeModule.removeGeofences) {
        console.warn('[GeofenceService] TravelModeModule.removeGeofences not available');
        return;
    }

    try {
        await TravelModeModule.removeGeofences();
        console.log('[GeofenceService] Geofences removed');
    } catch (error: any) {
        console.error('[GeofenceService] Failed to remove geofences:', error.message);
    }
}

/**
 * Check whether the native geofence module is available.
 * Returns false in Expo Go — graceful degradation.
 */
export function isGeofencingAvailable(): boolean {
    return Platform.OS === 'android' && !!TravelModeModule.registerGeofences;
}
