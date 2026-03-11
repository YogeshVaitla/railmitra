import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { 
    SharedValue,
    useSharedValue, 
    useAnimatedStyle, 
    withRepeat, 
    withTiming, 
    withDelay,
    withSequence,
    interpolate,
    Easing,
    Extrapolation
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../constants/Colors';

interface RadarAnimationProps {
    peerCount: number;
}

export const RadarAnimation: React.FC<RadarAnimationProps> = ({ peerCount }) => {
    const isSuccess = peerCount > 0;

    // Rings animation values
    const progress1 = useSharedValue(0);
    const progress2 = useSharedValue(0);
    const progress3 = useSharedValue(0);

    // Success transition value
    const successAnim = useSharedValue(0);

    useEffect(() => {
        if (!isSuccess) {
            // Loop the rings
            const reanimatedConfig = { duration: 2000, easing: Easing.out(Easing.ease) };
            progress1.value = withRepeat(withTiming(1, reanimatedConfig), -1, false);
            progress2.value = withDelay(300, withRepeat(withTiming(1, reanimatedConfig), -1, false));
            progress3.value = withDelay(600, withRepeat(withTiming(1, reanimatedConfig), -1, false));
            successAnim.value = withTiming(0);
        } else {
            // Transition to success state
            progress1.value = 0;
            progress2.value = 0;
            progress3.value = 0;
            successAnim.value = withTiming(1, { duration: 500 });
        }
    }, [isSuccess]);

    const Ring = ({ progress, targetScale }: { progress: Readonly<SharedValue<number>>, targetScale: number }) => {
        const animatedStyle = useAnimatedStyle(() => {
            const scale = interpolate(progress.value, [0, 1], [40, targetScale], Extrapolation.CLAMP);
            const opacity = interpolate(progress.value, [0, 0.8, 1], [0.6, 0.1, 0], Extrapolation.CLAMP);
            
            // Fade out the rings when success starts
            const finalOpacity = interpolate(successAnim.value, [0, 0.5], [opacity, 0], Extrapolation.CLAMP);

            return {
                width: scale,
                height: scale,
                borderRadius: scale / 2,
                opacity: finalOpacity,
            };
        });

        return <Animated.View style={[styles.ring, animatedStyle]} />;
    };

    // Center icon container (scales from 40 to 50 on success and changes color)
    const centerStyle = useAnimatedStyle(() => {
        const size = interpolate(successAnim.value, [0, 1], [40, 50], Extrapolation.CLAMP);
        return {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: isSuccess ? Colors.success.start : 'transparent',
            justifyContent: 'center',
            alignItems: 'center',
        };
    });

    // Label fades in on success
    const labelStyle = useAnimatedStyle(() => {
        return {
            opacity: successAnim.value,
            transform: [
                { translateY: interpolate(successAnim.value, [0, 1], [10, 0]) }
            ]
        };
    });

    return (
        <View style={styles.container}>
            <View style={styles.radarContainer}>
                {/* Rings */}
                <Ring progress={progress1} targetScale={80} />
                <Ring progress={progress2} targetScale={100} />
                <Ring progress={progress3} targetScale={120} />

                {/* Center Icon */}
                <Animated.View style={[centerStyle, { position: 'absolute' }]}>
                    {isSuccess ? (
                        <Ionicons name="checkmark" size={24} color="#fff" />
                    ) : (
                        <Ionicons name="phone-portrait-outline" size={28} color={Colors.primary.start} />
                    )}
                </Animated.View>
            </View>

            {/* Success Label */}
            <Animated.View style={[styles.labelContainer, labelStyle]}>
                <Text style={styles.labelText}>
                    {peerCount} passenger{peerCount !== 1 ? 's' : ''} nearby
                </Text>
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 20,
    },
    radarContainer: {
        width: 120,
        height: 120,
        justifyContent: 'center',
        alignItems: 'center',
    },
    ring: {
        position: 'absolute',
        borderWidth: 1,
        borderColor: Colors.primary.start,
        backgroundColor: `${Colors.primary.start}1A`, // 10% opacity fill
    },
    labelContainer: {
        marginTop: 16,
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: Colors.success.light,
        borderRadius: 20,
    },
    labelText: {
        color: Colors.success.start,
        fontWeight: '700',
        fontSize: 14,
    }
});
