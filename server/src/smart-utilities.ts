/**
 * Smart Utilities — Phase 5 Logic Stubs
 *
 * Contains:
 * 1. Toilet Queue Detector — Stationary location near coach ends > 3 min
 * 2. Anti-Theft Trigger — Accelerometer threshold + power disconnect
 *
 * These are logic stubs. Full hardware integration requires Expo Development Build
 * with native modules (accelerometer, GPS, power state listeners).
 */

// ============================================================
// TYPES
// ============================================================

export interface GPSPoint {
    lat: number;
    long: number;
    timestamp: number; // Unix ms
}

export interface ToiletQueueResult {
    isInQueue: boolean;
    estimatedWaitMinutes: number;
    confidence: number; // 0.0 to 1.0
    nearestToiletLocation: 'FRONT' | 'REAR' | 'UNKNOWN';
    reasoning: string;
}

export interface AccelerometerReading {
    x: number;
    y: number;
    z: number;
    timestamp: number; // Unix ms
}

export interface TheftRiskResult {
    riskDetected: boolean;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    triggerReason: string;
    recommendedAction: string;
    timestamp: number;
}

// ============================================================
// 1. TOILET QUEUE DETECTOR
// Determines if a user is likely standing in a toilet queue
// based on GPS stationary behavior near coach end zones.
// ============================================================

// Indian coach approximate dimensions
const COACH_LENGTH_METERS = 21.34; // Standard LHB coach
const TOILET_ZONE_METERS = 2.5; // Distance from coach end considered "near toilet"
const QUEUE_STATIONARY_THRESHOLD_MS = 3 * 60 * 1000; // 3 minutes
const GPS_STATIONARY_RADIUS_METERS = 3; // Max movement to be considered stationary

/**
 * Calculate distance between two GPS points using Haversine formula.
 */
function haversineDistance(p1: GPSPoint, p2: GPSPoint): number {
    const R = 6371000; // Earth radius in meters
    const dLat = ((p2.lat - p1.lat) * Math.PI) / 180;
    const dLon = ((p2.long - p1.long) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((p1.lat * Math.PI) / 180) *
        Math.cos((p2.lat * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

/**
 * Detect if the user is likely in a toilet queue.
 *
 * Algorithm:
 * 1. Check if user has been stationary (within GPS_STATIONARY_RADIUS_METERS)
 *    for at least QUEUE_STATIONARY_THRESHOLD_MS
 * 2. Estimate position relative to coach — near front or rear end = toilet zone
 * 3. Factor in time of day (morning rush 6-8 AM = higher probability)
 * 4. Return confidence score and estimated wait
 */
export function detectToiletQueue(gpsHistory: GPSPoint[]): ToiletQueueResult {
    if (gpsHistory.length < 2) {
        return {
            isInQueue: false,
            estimatedWaitMinutes: 0,
            confidence: 0,
            nearestToiletLocation: 'UNKNOWN',
            reasoning: 'Insufficient GPS data points',
        };
    }

    // Sort by timestamp
    const sorted = [...gpsHistory].sort((a, b) => a.timestamp - b.timestamp);
    const latest = sorted[sorted.length - 1];
    const earliest = sorted[0];

    // Check if user has been relatively stationary
    const maxDrift = sorted.reduce((max, point) => {
        const dist = haversineDistance(latest, point);
        return Math.max(max, dist);
    }, 0);

    const isStationary = maxDrift <= GPS_STATIONARY_RADIUS_METERS;
    const stationaryDuration = latest.timestamp - earliest.timestamp;

    if (!isStationary || stationaryDuration < QUEUE_STATIONARY_THRESHOLD_MS) {
        return {
            isInQueue: false,
            estimatedWaitMinutes: 0,
            confidence: isStationary ? 0.2 : 0.0,
            nearestToiletLocation: 'UNKNOWN',
            reasoning: isStationary
                ? `Stationary for only ${Math.round(stationaryDuration / 60000)} min (need ${Math.round(QUEUE_STATIONARY_THRESHOLD_MS / 60000)} min)`
                : `Moving too much (${maxDrift.toFixed(1)}m drift, threshold: ${GPS_STATIONARY_RADIUS_METERS}m)`,
        };
    }

    // Estimate position relative to coach
    // In practice, this would use the train's known GPS route + coach position
    // For now, use a heuristic based on slight position variations
    const nearestToiletLocation: 'FRONT' | 'REAR' | 'UNKNOWN' = 'UNKNOWN';

    // Time-of-day factor (morning rush = more likely a queue)
    const hour = new Date(latest.timestamp).getHours();
    const isMorningRush = hour >= 6 && hour <= 8;
    const isPostMeal = (hour >= 13 && hour <= 14) || (hour >= 20 && hour <= 21);
    const timeBonus = isMorningRush ? 0.15 : isPostMeal ? 0.1 : 0;

    // Base confidence from stationary duration
    const durationMinutes = stationaryDuration / 60000;
    const baseConfidence = Math.min(0.8, 0.4 + durationMinutes * 0.08);
    const confidence = Math.min(1.0, baseConfidence + timeBonus);

    // Estimate queue wait based on how long already stationary
    const estimatedWaitMinutes = Math.max(0, Math.round(8 - durationMinutes));

    return {
        isInQueue: confidence > 0.6,
        estimatedWaitMinutes,
        confidence: parseFloat(confidence.toFixed(2)),
        nearestToiletLocation,
        reasoning: `Stationary for ${durationMinutes.toFixed(0)} min within ${maxDrift.toFixed(1)}m radius${isMorningRush ? ' (morning rush hour)' : isPostMeal ? ' (post-meal time)' : ''}`,
    };
}

// ============================================================
// 2. ANTI-THEFT TRIGGER
// Detects suspicious phone movement when power is disconnected.
// Designed for phones placed on charging near berths.
// ============================================================

const ACCEL_THEFT_THRESHOLD = 2.5; // m/s² above gravity — sudden grab/lift
const ACCEL_SAMPLES_NEEDED = 3; // Consecutive readings above threshold
const POWER_DISCONNECT_GRACE_MS = 5 * 1000; // 5-second grace after unplug
// (user may unplug intentionally)

/**
 * Detect potential theft risk based on accelerometer + power state.
 *
 * Algorithm:
 * 1. Check if power was recently disconnected (charger unplugged)
 * 2. If yes, monitor accelerometer for sudden movement
 * 3. If N consecutive readings exceed threshold → trigger alert
 * 4. Risk levels:
 *    - LOW: Power disconnected, no unusual movement
 *    - MEDIUM: Power disconnected + slight movement
 *    - HIGH: Power disconnected + strong movement
 *    - CRITICAL: Power disconnected + strong sustained movement
 */
export function detectTheftRisk(
    accelReadings: AccelerometerReading[],
    isPowerConnected: boolean,
    powerDisconnectedAt: number | null, // Unix ms when power was lost
    currentTime: number = Date.now()
): TheftRiskResult {
    // If power is connected, no theft risk
    if (isPowerConnected) {
        return {
            riskDetected: false,
            riskLevel: 'LOW',
            triggerReason: 'Device is charging — no risk',
            recommendedAction: 'None',
            timestamp: currentTime,
        };
    }

    // Calculate how long since power was disconnected
    if (powerDisconnectedAt === null) {
        // Power was never connected during this session — no theft risk
        return {
            riskDetected: false,
            riskLevel: 'LOW',
            triggerReason: 'Device not previously connected to power',
            recommendedAction: 'None',
            timestamp: currentTime,
        };
    }

    const timeSinceDisconnect = currentTime - powerDisconnectedAt;

    // Grace period — user may have intentionally unplugged
    if (timeSinceDisconnect < POWER_DISCONNECT_GRACE_MS) {
        return {
            riskDetected: false,
            riskLevel: 'LOW',
            triggerReason: `Power disconnected ${Math.round(timeSinceDisconnect / 1000)}s ago — within grace period`,
            recommendedAction: 'Monitoring...',
            timestamp: currentTime,
        };
    }

    // Analyze accelerometer for sudden movement
    if (accelReadings.length === 0) {
        return {
            riskDetected: false,
            riskLevel: 'MEDIUM',
            triggerReason: 'Power disconnected, no accelerometer data available',
            recommendedAction: 'Enable motion sensors for theft protection',
            timestamp: currentTime,
        };
    }

    // Calculate magnitude (remove gravity component ~9.81)
    const magnitudes = accelReadings.map((r) => {
        const mag = Math.sqrt(r.x * r.x + r.y * r.y + r.z * r.z);
        return Math.abs(mag - 9.81); // Deviation from resting
    });

    // Count consecutive readings above threshold
    let maxConsecutive = 0;
    let currentConsecutive = 0;
    for (const mag of magnitudes) {
        if (mag > ACCEL_THEFT_THRESHOLD) {
            currentConsecutive++;
            maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
        } else {
            currentConsecutive = 0;
        }
    }

    const peakMagnitude = Math.max(...magnitudes);
    const avgMagnitude = magnitudes.reduce((s, v) => s + v, 0) / magnitudes.length;

    // Determine risk level
    if (maxConsecutive >= ACCEL_SAMPLES_NEEDED && peakMagnitude > ACCEL_THEFT_THRESHOLD * 2) {
        return {
            riskDetected: true,
            riskLevel: 'CRITICAL',
            triggerReason: `Sustained strong movement detected: ${maxConsecutive} consecutive high-accel readings (peak: ${peakMagnitude.toFixed(1)} m/s²)`,
            recommendedAction: 'ALERT: Sound alarm and send location to emergency contacts',
            timestamp: currentTime,
        };
    }

    if (maxConsecutive >= ACCEL_SAMPLES_NEEDED) {
        return {
            riskDetected: true,
            riskLevel: 'HIGH',
            triggerReason: `Sudden movement detected: ${maxConsecutive} consecutive readings above threshold (avg: ${avgMagnitude.toFixed(1)} m/s²)`,
            recommendedAction: 'Sound alarm — device may have been grabbed',
            timestamp: currentTime,
        };
    }

    if (peakMagnitude > ACCEL_THEFT_THRESHOLD) {
        return {
            riskDetected: true,
            riskLevel: 'MEDIUM',
            triggerReason: `Brief movement spike detected (peak: ${peakMagnitude.toFixed(1)} m/s²) but not sustained`,
            recommendedAction: 'Monitor closely — could be incidental contact',
            timestamp: currentTime,
        };
    }

    return {
        riskDetected: false,
        riskLevel: 'LOW',
        triggerReason: `Power disconnected, movement within normal range (avg: ${avgMagnitude.toFixed(1)} m/s²)`,
        recommendedAction: 'Continue monitoring',
        timestamp: currentTime,
    };
}

export default {
    detectToiletQueue,
    detectTheftRisk,
};
