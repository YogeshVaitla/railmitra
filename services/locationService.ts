/**
 * Location Service — Chunk 2: Active Speedometer & Background Location
 *
 * Wraps expo-location to:
 *  1. Request ACCESS_FINE_LOCATION + ACCESS_BACKGROUND_LOCATION with a clear
 *     rationale shown to the user before the system dialog appears.
 *  2. Stream raw GPS updates and convert speed from m/s → km/h.
 *  3. Expose helpers consumed by the geofence service (Chunk 4) and the
 *     live speedometer UI component.
 *
 * Important: Background location is only available on native (not Expo Go).
 * The service degrades gracefully — foreground-only on web/iOS Expo Go.
 */

import * as Location from 'expo-location';
import { Alert, Platform } from 'react-native';

// --- Types ---

export interface SpeedUpdate {
    /** Speed in km/h derived from GPS. -1 when unavailable. */
    speedKmh: number;
    /** Raw GPS coordinate */
    latitude: number;
    longitude: number;
    /** Accuracy radius in metres */
    accuracy: number | null;
    timestamp: number;
}

export type SpeedCallback = (update: SpeedUpdate) => void;

// --- Constants ---

/** Below this speed (km/h) the train is considered stationary at a station. */
export const SPEED_THRESHOLD_MOVING_KMH = 5;

/** GPS accuracy interval — balance between battery and precision */
const LOCATION_UPDATE_INTERVAL_MS = 3000;

// --- Internal State ---

let _watchSubscription: Location.LocationSubscription | null = null;
let _speedCallbacks: SpeedCallback[] = [];
let _currentSpeed: SpeedUpdate = {
    speedKmh: -1,
    latitude: 0,
    longitude: 0,
    accuracy: null,
    timestamp: 0,
};

// --- Helpers ---

/**
 * Convert GPS speed (m/s) to km/h.
 * GPS speed can occasionally be negative on bad readings — clamp to 0.
 */
function msToKmh(speedMs: number | null | undefined): number {
    if (speedMs == null || speedMs < 0) return 0;
    return Math.round(speedMs * 3.6);
}

// --- Permission Requests ---

/**
 * Show a clear rationale alert BEFORE the OS permission dialog.
 * Returns true if the user agrees to proceed, false if they dismiss.
 */
async function showLocationRationale(): Promise<boolean> {
    return new Promise(resolve => {
        Alert.alert(
            '📍 Location Permission Required',
            'RailMitra needs precise location access to:\n\n' +
            '• Show your live train speed on the speedometer\n' +
            '• Automatically start/stop the swap network when your train enters the station\n' +
            '• Run the mesh network in the background during your journey\n\n' +
            'No location data ever leaves your device.',
            [
                { text: 'Not Now', style: 'cancel', onPress: () => resolve(false) },
                { text: 'Enable Location', style: 'default', onPress: () => resolve(true) },
            ],
            { cancelable: false }
        );
    });
}

/**
 * Request foreground location permission.
 * Returns true if granted.
 */
export async function requestForegroundLocation(): Promise<boolean> {
    const { status: existing } = await Location.getForegroundPermissionsAsync();
    if (existing === 'granted') return true;

    const agreed = await showLocationRationale();
    if (!agreed) return false;

    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
}

/**
 * Request background location permission (Android only).
 * MUST be called AFTER foreground permission is already granted.
 * Returns true if granted.
 */
export async function requestBackgroundLocation(): Promise<boolean> {
    // Background location is only needed on Android native builds
    if (Platform.OS !== 'android') return true;

    const { status: existing } = await Location.getBackgroundPermissionsAsync();
    if (existing === 'granted') return true;

    // Show additional background-specific rationale before system prompt
    return new Promise(resolve => {
        Alert.alert(
            '🔋 Allow Background Location?',
            'To run the offline seat-swap mesh network while the screen is locked, ' +
            'please select "Allow all the time" in the next screen.\n\n' +
            'This is required by Android to run Bluetooth/WiFi networking in the background.',
            [
                { text: 'Skip', style: 'cancel', onPress: () => resolve(false) },
                {
                    text: 'Enable Background',
                    style: 'default',
                    onPress: async () => {
                        const { status } = await Location.requestBackgroundPermissionsAsync();
                        resolve(status === 'granted');
                    },
                },
            ],
            { cancelable: false }
        );
    });
}

// --- Speed Watching ---

/**
 * Start listening to GPS updates and computing km/h speed.
 * Calls all registered SpeedCallbacks on each update.
 * Safe to call multiple times — won't start a second watcher.
 */
export async function startSpeedWatch(): Promise<boolean> {
    if (_watchSubscription) return true; // Already watching

    const hasPermission = await requestForegroundLocation();
    if (!hasPermission) {
        console.warn('[LocationService] Foreground location permission denied.');
        return false;
    }

    try {
        _watchSubscription = await Location.watchPositionAsync(
            {
                accuracy: Location.Accuracy.BestForNavigation,
                timeInterval: LOCATION_UPDATE_INTERVAL_MS,
                distanceInterval: 10, // metres — don't update unless moved 10m
            },
            (location) => {
                const update: SpeedUpdate = {
                    speedKmh: msToKmh(location.coords.speed),
                    latitude: location.coords.latitude,
                    longitude: location.coords.longitude,
                    accuracy: location.coords.accuracy,
                    timestamp: location.timestamp,
                };
                _currentSpeed = update;
                _speedCallbacks.forEach(cb => cb(update));
            }
        );

        console.log('[LocationService] Speed watch started.');
        return true;
    } catch (error) {
        console.error('[LocationService] Failed to start speed watch:', error);
        return false;
    }
}

/**
 * Stop GPS speed watching and release the subscription.
 */
export function stopSpeedWatch(): void {
    if (_watchSubscription) {
        _watchSubscription.remove();
        _watchSubscription = null;
        console.log('[LocationService] Speed watch stopped.');
    }
}

/**
 * Register a callback for speed updates.
 * Returns a cleanup function to deregister.
 */
export function onSpeedUpdate(callback: SpeedCallback): () => void {
    _speedCallbacks.push(callback);
    return () => {
        _speedCallbacks = _speedCallbacks.filter(cb => cb !== callback);
    };
}

/**
 * Get the most recent speed reading without subscribing.
 */
export function getCurrentSpeed(): SpeedUpdate {
    return _currentSpeed;
}

// --- One-shot Current Location ---

/**
 * Get the device's current location (single reading, no continuous watch).
 * Useful for geofence entry point checks.
 */
export async function getCurrentLocation(): Promise<Location.LocationObject | null> {
    const hasPermission = await requestForegroundLocation();
    if (!hasPermission) return null;

    try {
        return await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
        });
    } catch (error) {
        console.error('[LocationService] getCurrentLocation error:', error);
        return null;
    }
}
