/**
 * SMART UTILITIES — Unit Tests
 * Validates toilet queue detection and theft risk detection algorithms.
 */

import {
  detectToiletQueue,
  detectTheftRisk,
  GPSPoint,
  AccelerometerReading,
} from '../src/smart-utilities';

// Helper: create a GPS point
function gps(lat: number, long: number, timestamp: number): GPSPoint {
  return { lat, long, timestamp };
}

// Helper: create accelerometer reading
function accel(x: number, y: number, z: number, timestamp: number): AccelerometerReading {
  return { x, y, z, timestamp };
}

// Base GPS location (somewhere in India)
const BASE_LAT = 28.6139;
const BASE_LONG = 77.2090;

// ============================================================
// 1. TOILET QUEUE DETECTOR
// ============================================================

describe('Smart Utilities — Toilet Queue Detection', () => {
  test('insufficient data (< 2 points) returns not in queue', () => {
    const result = detectToiletQueue([]);
    expect(result.isInQueue).toBe(false);
    expect(result.confidence).toBe(0);
    expect(result.reasoning).toContain('Insufficient');
  });

  test('single GPS point returns not in queue', () => {
    const result = detectToiletQueue([gps(BASE_LAT, BASE_LONG, Date.now())]);
    expect(result.isInQueue).toBe(false);
  });

  test('moving user is not in queue', () => {
    const now = Date.now();
    // Points spread over 5 minutes but with significant drift (100m apart)
    const history = [
      gps(BASE_LAT, BASE_LONG, now - 300000),
      gps(BASE_LAT + 0.001, BASE_LONG, now - 200000), // ~111m north
      gps(BASE_LAT + 0.002, BASE_LONG, now - 100000), // ~222m north
      gps(BASE_LAT + 0.003, BASE_LONG, now),           // ~333m north
    ];
    const result = detectToiletQueue(history);
    expect(result.isInQueue).toBe(false);
    expect(result.reasoning).toContain('Moving');
  });

  test('stationary for < 3 minutes is not in queue', () => {
    const now = Date.now();
    // Same spot for only 2 minutes
    const history = [
      gps(BASE_LAT, BASE_LONG, now - 120000),
      gps(BASE_LAT + 0.000001, BASE_LONG, now - 60000),
      gps(BASE_LAT, BASE_LONG + 0.000001, now),
    ];
    const result = detectToiletQueue(history);
    expect(result.isInQueue).toBe(false);
    expect(result.confidence).toBeLessThanOrEqual(0.2);
  });

  test('stationary for > 3 minutes triggers queue detection', () => {
    const now = Date.now();
    // Same spot for 5 minutes (within 3m radius)
    const history = [
      gps(BASE_LAT, BASE_LONG, now - 300000),
      gps(BASE_LAT + 0.000001, BASE_LONG, now - 200000),
      gps(BASE_LAT, BASE_LONG + 0.000001, now - 100000),
      gps(BASE_LAT + 0.000002, BASE_LONG, now),
    ];
    const result = detectToiletQueue(history);
    expect(result.isInQueue).toBe(true);
    expect(result.confidence).toBeGreaterThan(0.6);
  });

  test('morning rush (6-8 AM) increases confidence', () => {
    // Create a timestamp at 7 AM
    const morning = new Date();
    morning.setHours(7, 0, 0, 0);
    const now = morning.getTime();

    const history = [
      gps(BASE_LAT, BASE_LONG, now - 300000),
      gps(BASE_LAT + 0.000001, BASE_LONG, now - 150000),
      gps(BASE_LAT, BASE_LONG + 0.000001, now),
    ];

    const morningResult = detectToiletQueue(history);

    // Same duration at 3 PM
    const afternoon = new Date();
    afternoon.setHours(15, 0, 0, 0);
    const nowAfternoon = afternoon.getTime();
    const historyAfternoon = [
      gps(BASE_LAT, BASE_LONG, nowAfternoon - 300000),
      gps(BASE_LAT + 0.000001, BASE_LONG, nowAfternoon - 150000),
      gps(BASE_LAT, BASE_LONG + 0.000001, nowAfternoon),
    ];
    const afternoonResult = detectToiletQueue(historyAfternoon);

    // Morning should have higher confidence due to rush hour bonus
    expect(morningResult.confidence).toBeGreaterThanOrEqual(afternoonResult.confidence);
  });

  test('longer stationary time increases estimated wait', () => {
    const now = Date.now();
    // 4 minutes stationary
    const short = [
      gps(BASE_LAT, BASE_LONG, now - 240000),
      gps(BASE_LAT + 0.000001, BASE_LONG, now),
    ];
    // 7 minutes stationary
    const long = [
      gps(BASE_LAT, BASE_LONG, now - 420000),
      gps(BASE_LAT + 0.000001, BASE_LONG, now),
    ];

    const shortResult = detectToiletQueue(short);
    const longResult = detectToiletQueue(long);

    // Longer wait should have lower remaining estimated wait
    // (already waited more of the total)
    expect(longResult.estimatedWaitMinutes).toBeLessThanOrEqual(shortResult.estimatedWaitMinutes);
  });

  test('GPS points sorted by timestamp regardless of input order', () => {
    const now = Date.now();
    // Out-of-order input
    const history = [
      gps(BASE_LAT, BASE_LONG + 0.000001, now),
      gps(BASE_LAT, BASE_LONG, now - 300000),
      gps(BASE_LAT + 0.000001, BASE_LONG, now - 150000),
    ];
    // Should not crash and should produce valid result
    const result = detectToiletQueue(history);
    expect(result).toBeDefined();
    expect(typeof result.isInQueue).toBe('boolean');
  });
});

// ============================================================
// 2. ANTI-THEFT DETECTION
// ============================================================

describe('Smart Utilities — Theft Risk Detection', () => {
  test('power connected = no risk', () => {
    const result = detectTheftRisk([], true, null);
    expect(result.riskDetected).toBe(false);
    expect(result.riskLevel).toBe('LOW');
    expect(result.triggerReason).toContain('charging');
  });

  test('power disconnected within 5s grace period = LOW', () => {
    const now = Date.now();
    const result = detectTheftRisk([], false, now - 2000, now);
    expect(result.riskDetected).toBe(false);
    expect(result.riskLevel).toBe('LOW');
    expect(result.triggerReason).toContain('grace period');
  });

  test('power disconnected, no accel data = MEDIUM', () => {
    const now = Date.now();
    const result = detectTheftRisk([], false, now - 10000, now);
    expect(result.riskDetected).toBe(false);
    expect(result.riskLevel).toBe('MEDIUM');
  });

  test('power disconnected, normal movement = LOW', () => {
    const now = Date.now();
    // Normal resting readings (gravity only, ~9.81 m/s²)
    const readings = [
      accel(0.1, 0.2, 9.75, now - 200),
      accel(0.15, 0.1, 9.80, now - 100),
      accel(0.05, 0.15, 9.78, now),
    ];
    const result = detectTheftRisk(readings, false, now - 10000, now);
    expect(result.riskDetected).toBe(false);
    expect(result.riskLevel).toBe('LOW');
  });

  test('brief movement spike = MEDIUM risk', () => {
    const now = Date.now();
    // One spike reading but not sustained
    const readings = [
      accel(0.1, 0.2, 9.75, now - 300),
      accel(5.0, 3.0, 12.0, now - 200), // Spike! magnitude ≈ 13.4, deviation ≈ 3.6
      accel(0.1, 0.15, 9.78, now - 100),
      accel(0.05, 0.1, 9.80, now),
    ];
    const result = detectTheftRisk(readings, false, now - 10000, now);
    expect(result.riskDetected).toBe(true);
    expect(result.riskLevel).toBe('MEDIUM');
  });

  test('3+ consecutive high readings = HIGH risk', () => {
    const now = Date.now();
    // 3 consecutive spikes (above 2.5 m/s² deviation from gravity)
    const readings = [
      accel(0.1, 0.2, 9.75, now - 400),
      accel(4.0, 3.0, 11.0, now - 300), // ~12.1, dev ~2.3... let's make bigger
      accel(5.0, 5.0, 11.0, now - 200), // ~13.0, dev ~3.2
      accel(6.0, 4.0, 12.0, now - 100), // ~14.0, dev ~4.2
      accel(5.0, 6.0, 10.0, now),       // ~12.7, dev ~2.9
    ];
    const result = detectTheftRisk(readings, false, now - 10000, now);
    expect(result.riskDetected).toBe(true);
    expect(['HIGH', 'CRITICAL']).toContain(result.riskLevel);
  });

  test('sustained strong movement (peak > 2x threshold) = CRITICAL', () => {
    const now = Date.now();
    // Very strong sustained movement
    const readings = [
      accel(8.0, 8.0, 12.0, now - 300), // ~16.5, dev ~6.7
      accel(9.0, 7.0, 14.0, now - 200), // ~18.0, dev ~8.2
      accel(10.0, 8.0, 13.0, now - 100), // ~18.1, dev ~8.3
      accel(8.0, 9.0, 12.0, now),        // ~17.0, dev ~7.2
    ];
    const result = detectTheftRisk(readings, false, now - 10000, now);
    expect(result.riskDetected).toBe(true);
    expect(result.riskLevel).toBe('CRITICAL');
    expect(result.recommendedAction).toContain('alarm');
  });

  test('powerDisconnectedAt = null treated as very long ago', () => {
    const now = Date.now();
    const readings = [
      accel(0.1, 0.2, 9.75, now - 100),
      accel(0.05, 0.1, 9.80, now),
    ];
    const result = detectTheftRisk(readings, false, null, now);
    // Should skip grace period since Infinity > threshold
    expect(result.riskLevel).toBe('LOW');
  });
});
