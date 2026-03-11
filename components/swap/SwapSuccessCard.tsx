import React, { useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Animated, { 
    useSharedValue, 
    useAnimatedStyle, 
    withSpring, 
    withTiming, 
    withDelay,
    interpolate,
    Extrapolation
} from 'react-native-reanimated';
import Colors from '../../constants/Colors';

interface SwapSuccessCardProps {
    partnerCoachId: string;
    partnerSeatNo: number;
    partnerHas: string; // The seat type they have
    onComplete: () => void;
    onReportProblem: () => void;
}

const CONFETTI_COLORS = [
    Colors.berth.lower,
    Colors.berth.middle,
    Colors.berth.upper,
    Colors.berth.sideLower,
    Colors.berth.sideUpper,
];

export const SwapSuccessCard: React.FC<SwapSuccessCardProps> = ({ 
    partnerCoachId, 
    partnerSeatNo, 
    partnerHas,
    onComplete, 
    onReportProblem 
}) => {
    // Animation states
    // 0 -> 1 : Celebration phase
    // 1 -> 2 : Transition to action card phase
    const phase = useSharedValue(0);

    useEffect(() => {
        // Start celebration (bounce checkmark, scatter confetti)
        phase.value = withTiming(1, { duration: 800 });
        
        // After 2 seconds, transition to the action card
        phase.value = withDelay(2000, withTiming(2, { duration: 600 }));
    }, []);

    // --- Container Styles ---
    const containerStyle = useAnimatedStyle(() => {
        // Gradient background fades from success.light -> card.background horizontally
        // We'll simulate this by fading a solid success.light view overlay
        const isActionPhase = phase.value > 1;
        
        return {
            backgroundColor: isActionPhase ? Colors.card.background : Colors.success.light,
            padding: interpolate(phase.value, [1, 2], [40, 24]),
            borderRadius: 16,
            shadowColor: Colors.shadow,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: interpolate(phase.value, [1, 2], [0, 1]),
            shadowRadius: 8,
            elevation: isActionPhase ? 2 : 0,
        };
    });

    // --- Checkmark Circle Styles ---
    const checkmarkStyle = useAnimatedStyle(() => {
        // Phase 0->1: Spring scale up
        // Phase 1->2: Shrink and move up/left
        
        const scale = phase.value < 1 
            ? interpolate(phase.value, [0, 1], [0.5, 1.2], Extrapolation.CLAMP) // initial bounce
            : interpolate(phase.value, [1, 2], [1.2, 0.7], Extrapolation.CLAMP); // shrink later

        const translateY = interpolate(phase.value, [1, 2], [0, -10]);
        const translateX = interpolate(phase.value, [1, 2], [0, -10]);

        return {
            transform: [
                { scale },
                { translateY },
                { translateX }
            ],
            marginBottom: interpolate(phase.value, [1, 2], [24, 0]),
            alignSelf: phase.value > 1 ? 'flex-start' : 'center',
        };
    });

    // --- Action Card Content Styles ---
    const detailContentStyle = useAnimatedStyle(() => {
        return {
            opacity: interpolate(phase.value, [1, 2], [0, 1]),
            transform: [
                { translateY: interpolate(phase.value, [1, 2], [20, 0]) }
            ],
            height: phase.value > 1 ? 'auto' : 0, // hide completely during celebration
            overflow: 'hidden',
        };
    });

    // Confetti Dot Component
    const ConfettiDot = ({ angle, distance, delay, color }: { angle: number, distance: number, delay: number, color: string }) => {
        const dotAnim = useSharedValue(0);
        
        useEffect(() => {
            dotAnim.value = withDelay(delay, withTiming(1, { duration: 1000 }));
        }, []);

        const style = useAnimatedStyle(() => {
            const currentDistance = interpolate(dotAnim.value, [0, 1], [0, distance]);
            // Convert polar to cartesian
            const tx = Math.cos(angle) * currentDistance;
            const ty = Math.sin(angle) * currentDistance + interpolate(dotAnim.value, [0.5, 1], [0, 30], Extrapolation.CLAMP); // add gravity

            const opacity = interpolate(phase.value, [1, 1.5], [
                interpolate(dotAnim.value, [0, 0.8, 1], [1, 1, 0]), // fade out locally
                0 // force fade out in phase 2
            ]);

            return {
                transform: [
                    { translateX: tx },
                    { translateY: ty },
                    { scale: interpolate(dotAnim.value, [0, 0.2, 1], [0, 1, 0.5]) }
                ],
                opacity: phase.value > 1 ? 0 : opacity, // instantly hide in action phase
                position: 'absolute',
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: color,
            };
        });

        return <Animated.View style={style} />;
    };

    return (
        <Animated.View style={[styles.container, containerStyle]}>
            {/* Confetti Explosion (Centered behind the checkmark) */}
            <View style={{ position: 'absolute', top: 50, left: '50%' }}>
                {[...Array(12)].map((_, i) => {
                    const angle = (i * 30 * Math.PI) / 180;
                    const distance = 40 + Math.random() * 40;
                    const delay = Math.random() * 200;
                    const color = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
                    return <ConfettiDot key={i} angle={angle} distance={distance} delay={delay} color={color} />;
                })}
            </View>

            {/* Checkmark Circle */}
            <Animated.View style={[styles.checkmarkCircle, checkmarkStyle]}>
                <Ionicons name="checkmark-done" size={40} color="#fff" />
            </Animated.View>

            {/* Action Card Content */}
            <Animated.View style={[styles.detailsContainer, detailContentStyle]}>
                <Text style={styles.title}>Swap Accepted!</Text>
                
                <View style={styles.walkCard}>
                    <Text style={styles.walkLabel}>Walk to:</Text>
                    <Text style={styles.walkSeat}>{partnerCoachId} / {partnerSeatNo}</Text>
                    <Text style={styles.walkType}>{partnerHas}</Text>
                </View>

                <View style={styles.buttonRow}>
                    <TouchableOpacity onPress={onComplete} activeOpacity={0.8} style={{ flex: 1 }}>
                        <LinearGradient
                            colors={[Colors.primary.start, Colors.primary.end]}
                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                            style={styles.primaryBtn}
                        >
                            <Ionicons name="checkmark-circle" size={18} color="#fff" />
                            <Text style={styles.primaryBtnText}>Mark Completed</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
                
                <TouchableOpacity onPress={onReportProblem} style={styles.secondaryBtn}>
                    <Text style={styles.secondaryBtnText}>Report a Problem</Text>
                </TouchableOpacity>
            </Animated.View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: '100%',
        marginBottom: 16,
    },
    checkmarkCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: Colors.success.start,
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: Colors.success.start,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 10,
        elevation: 6,
    },
    detailsContainer: {
        width: '100%',
    },
    title: {
        fontSize: 22,
        fontWeight: '900',
        color: Colors.text.primary,
        marginBottom: 16,
    },
    walkCard: {
        backgroundColor: Colors.background.tertiary,
        borderRadius: 12,
        padding: 16,
        alignItems: 'center',
        marginBottom: 20,
        borderWidth: 1,
        borderColor: Colors.card.border,
    },
    walkLabel: {
        fontSize: 12,
        color: Colors.text.secondary,
        fontWeight: '600',
        marginBottom: 4,
    },
    walkSeat: {
        fontSize: 24,
        fontWeight: '900',
        color: Colors.text.primary,
        letterSpacing: 1,
    },
    walkType: {
        fontSize: 13,
        color: Colors.text.tertiary,
        marginTop: 4,
    },
    buttonRow: {
        flexDirection: 'row',
        marginBottom: 12,
    },
    primaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        borderRadius: 12,
    },
    primaryBtnText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '700',
    },
    secondaryBtn: {
        paddingVertical: 12,
        alignItems: 'center',
    },
    secondaryBtnText: {
        color: Colors.danger.start,
        fontSize: 14,
        fontWeight: '600',
    }
});
