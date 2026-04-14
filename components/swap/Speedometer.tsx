/**
 * Speedometer — Live GPS Speed Display
 *
 * Chunk 2: Active Speedometer & Permissions
 * Renders a premium animated speedometer card for the active swap screen.
 * Shows journey state (docked at station vs. in transit) based on speed threshold.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import Colors from '../../constants/Colors';
import {
    onSpeedUpdate,
    SPEED_THRESHOLD_MOVING_KMH,
    SpeedUpdate,
    startSpeedWatch,
    stopSpeedWatch,
} from '../../services/locationService';

interface SpeedometerProps {
    peerCount: number;
}

/** Angle helpers for the needle arc (from -135° to +135°, 0 = left, max = right) */
const MIN_ANGLE = -135;
const MAX_ANGLE = 135;
const MAX_SPEED = 160; // km/h — cap the visual range at 160

function speedToAngle(speedKmh: number): number {
    const clamped = Math.max(0, Math.min(speedKmh, MAX_SPEED));
    return MIN_ANGLE + (clamped / MAX_SPEED) * (MAX_ANGLE - MIN_ANGLE);
}

type JourneyState = 'STARTING' | 'AT_STATION' | 'IN_TRANSIT';

function getJourneyState(speedKmh: number): JourneyState {
    if (speedKmh < 0) return 'STARTING';
    if (speedKmh < SPEED_THRESHOLD_MOVING_KMH) return 'AT_STATION';
    return 'IN_TRANSIT';
}

function getStateLabel(state: JourneyState): string {
    switch (state) {
        case 'STARTING': return '🔎 Waiting for GPS...';
        case 'AT_STATION': return '🚉 At Station — Mesh Active';
        case 'IN_TRANSIT': return '🚄 In Transit';
    }
}

export const Speedometer: React.FC<SpeedometerProps> = ({ peerCount }) => {
    const [speedUpdate, setSpeedUpdate] = useState<SpeedUpdate>({
        speedKmh: -1, latitude: 0, longitude: 0, accuracy: null, timestamp: 0,
    });
    const needleAnim = useRef(new Animated.Value(MIN_ANGLE)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;

    const displaySpeed = speedUpdate.speedKmh < 0 ? 0 : speedUpdate.speedKmh;
    const journeyState = getJourneyState(speedUpdate.speedKmh);

    // Animate needle smoothly to new speed
    useEffect(() => {
        Animated.timing(needleAnim, {
            toValue: speedToAngle(displaySpeed),
            duration: 600,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
        }).start();
    }, [displaySpeed, needleAnim]);

    // Pulse animation for the live dot indicator
    useEffect(() => {
        if (journeyState === 'IN_TRANSIT') {
            Animated.loop(
                Animated.sequence([
                    Animated.timing(pulseAnim, { toValue: 1.4, duration: 700, useNativeDriver: true }),
                    Animated.timing(pulseAnim, { toValue: 1.0, duration: 700, useNativeDriver: true }),
                ])
            ).start();
        } else {
            pulseAnim.setValue(1);
        }
    }, [journeyState, pulseAnim]);

    // Start / stop GPS watcher with the component lifecycle
    useEffect(() => {
        startSpeedWatch().catch(err => console.warn('[Speedometer] GPS error:', err));
        const unsubscribe = onSpeedUpdate(setSpeedUpdate);
        return () => {
            unsubscribe();
            stopSpeedWatch();
        };
    }, []);

    // Color ramp: green → amber → red
    const speedColor =
        displaySpeed > 100 ? Colors.danger.start :
        displaySpeed > 50  ? Colors.warning.start :
        Colors.success.start;

    const needleRotation = needleAnim.interpolate({
        inputRange: [MIN_ANGLE, MAX_ANGLE],
        outputRange: [`${MIN_ANGLE}deg`, `${MAX_ANGLE}deg`],
    });

    return (
        <View style={styles.card}>
            {/* Header */}
            <View style={styles.headerRow}>
                <Text style={styles.cardTitle}>GPS Speedometer</Text>
                <View style={styles.liveIndicator}>
                    <Animated.View style={[styles.liveDot, { transform: [{ scale: pulseAnim }] }]} />
                    <Text style={styles.liveText}>LIVE</Text>
                </View>
            </View>

            {/* Dial */}
            <View style={styles.dialContainer}>
                {/* Tick marks */}
                {[0, 40, 80, 120, 160].map((tick) => {
                    const angle = speedToAngle(tick);
                    return (
                        <View
                            key={tick}
                            style={[
                                styles.tickMark,
                                {
                                    transform: [
                                        { rotate: `${angle}deg` },
                                        { translateY: -50 },
                                    ],
                                },
                            ]}
                        />
                    );
                })}

                {/* Needle */}
                <Animated.View
                    style={[
                        styles.needle,
                        { transform: [{ rotate: needleRotation }] },
                        { backgroundColor: speedColor },
                    ]}
                />

                {/* Centre hub */}
                <View style={[styles.hub, { backgroundColor: speedColor }]} />

                {/* Digital readout */}
                <View style={styles.readout}>
                    <Text style={[styles.speedValue, { color: speedColor }]}>
                        {displaySpeed}
                    </Text>
                    <Text style={styles.speedUnit}>km/h</Text>
                </View>
            </View>

            {/* State label */}
            <Text style={styles.stateLabel}>{getStateLabel(journeyState)}</Text>

            {/* Mesh stats pill */}
            <View style={styles.statsPill}>
                <Text style={styles.statsIcon}>📡</Text>
                <Text style={styles.statsText}>
                    {peerCount > 0
                        ? `${peerCount} peer${peerCount > 1 ? 's' : ''} connected`
                        : 'Searching for nearby passengers…'}
                </Text>
            </View>

            {/* GPS accuracy info */}
            {speedUpdate.accuracy != null && (
                <Text style={styles.accuracyText}>
                    GPS accuracy: ±{Math.round(speedUpdate.accuracy)}m
                </Text>
            )}
        </View>
    );
};

const DIAL_SIZE = 160;
const NEEDLE_LENGTH = 56;

const styles = StyleSheet.create({
    card: {
        backgroundColor: Colors.card.background,
        borderRadius: 20,
        padding: 20,
        marginBottom: 16,
        alignItems: 'center',
        shadowColor: Colors.shadow,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 1,
        shadowRadius: 12,
        elevation: 4,
    },
    headerRow: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    cardTitle: {
        color: Colors.text.primary,
        fontSize: 15,
        fontWeight: '700',
    },
    liveIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: Colors.success.light,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 20,
    },
    liveDot: {
        width: 7,
        height: 7,
        borderRadius: 4,
        backgroundColor: Colors.success.start,
    },
    liveText: {
        color: Colors.success.start,
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.5,
    },
    dialContainer: {
        width: DIAL_SIZE,
        height: DIAL_SIZE / 2 + 20,
        alignItems: 'center',
        justifyContent: 'flex-end',
        marginBottom: 8,
        position: 'relative',
    },
    tickMark: {
        position: 'absolute',
        bottom: 20,
        width: 2,
        height: 8,
        backgroundColor: Colors.text.tertiary,
        borderRadius: 1,
        transformOrigin: 'center bottom',
    },
    needle: {
        position: 'absolute',
        bottom: 20,
        width: 3,
        height: NEEDLE_LENGTH,
        borderRadius: 2,
        transformOrigin: 'center bottom',
    },
    hub: {
        position: 'absolute',
        bottom: 12,
        width: 16,
        height: 16,
        borderRadius: 8,
        zIndex: 1,
    },
    readout: {
        position: 'absolute',
        bottom: 26,
        alignItems: 'center',
    },
    speedValue: {
        fontSize: 36,
        fontWeight: '800',
        lineHeight: 40,
    },
    speedUnit: {
        fontSize: 12,
        color: Colors.text.tertiary,
        fontWeight: '600',
    },
    stateLabel: {
        color: Colors.text.secondary,
        fontSize: 13,
        fontWeight: '600',
        marginTop: 4,
        marginBottom: 12,
    },
    statsPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: Colors.background.tertiary,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        marginBottom: 8,
    },
    statsIcon: {
        fontSize: 14,
    },
    statsText: {
        color: Colors.text.secondary,
        fontSize: 12,
        fontWeight: '600',
    },
    accuracyText: {
        color: Colors.text.tertiary,
        fontSize: 10,
        marginTop: 4,
    },
});
