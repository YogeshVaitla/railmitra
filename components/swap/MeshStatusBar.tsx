import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, LayoutAnimation, UIManager, Platform } from 'react-native';
import Colors from '../../constants/Colors';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

export type ConnectionState = 'FULL_SYNC' | 'P2P_ONLY' | 'CLOUD_ONLY' | 'ISOLATED';

interface MeshStatusBarProps {
    connectionState: ConnectionState;
    peerCount: number;
}

export const MeshStatusBar: React.FC<MeshStatusBarProps> = ({ connectionState, peerCount }) => {
    // We use a local state to trigger LayoutAnimation when the prop changes
    const [currentState, setCurrentState] = useState<ConnectionState>(connectionState);
    const [blink, setBlink] = useState(false);

    useEffect(() => {
        if (connectionState !== currentState) {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setCurrentState(connectionState);
        }
    }, [connectionState, currentState]);

    // Simple pulse effect for the dot when in FULL_SYNC or P2P_ONLY
    useEffect(() => {
        let interval: ReturnType<typeof setInterval>;
        if (connectionState === 'FULL_SYNC' || connectionState === 'P2P_ONLY') {
            interval = setInterval(() => {
                setBlink(b => !b);
            }, 1000);
        } else {
            setBlink(false);
        }
        return () => clearInterval(interval);
    }, [connectionState]);

    const getConfig = () => {
        switch (currentState) {
            case 'FULL_SYNC':
                return {
                    dotColor: Colors.success.start,
                    bgColor: `${Colors.success.start}1A`, // 10% opacity
                    text: `Online · ${peerCount} nearby`,
                    pulse: true,
                };
            case 'P2P_ONLY':
                return {
                    dotColor: Colors.warning.start,
                    bgColor: `${Colors.warning.start}1A`,
                    text: `Offline · P2P with ${peerCount} nearby`,
                    pulse: true,
                };
            case 'CLOUD_ONLY':
                return {
                    dotColor: Colors.accent.start,
                    bgColor: `${Colors.accent.start}1A`,
                    text: "Searching nearby...",
                    pulse: false,
                };
            case 'ISOLATED':
            default:
                return {
                    dotColor: Colors.danger.start,
                    bgColor: Colors.background.tertiary, // muted
                    text: "No connections",
                    pulse: false,
                };
        }
    };

    const config = getConfig();

    return (
        <View style={styles.container}>
            <View style={[styles.bar, { backgroundColor: config.bgColor }]}>
                <View 
                    style={[
                        styles.dot, 
                        { backgroundColor: config.dotColor },
                        config.pulse && blink ? { opacity: 0.4 } : { opacity: 1 }
                    ]} 
                />
                <Text style={styles.text}>{config.text}</Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 20,
        marginBottom: 8,
        alignItems: 'center',
    },
    bar: {
        flexDirection: 'row',
        alignItems: 'center',
        height: 36,
        paddingHorizontal: 12,
        borderRadius: 10,
        gap: 8,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    text: {
        color: Colors.text.secondary,
        fontWeight: '600',
        fontSize: 12,
    }
});
