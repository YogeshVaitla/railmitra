import React from 'react';
import { View, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../../constants/Colors';
import { styles } from './swap.styles';
import { getSeatTypeLabel } from './swap.utils';

export interface SwapPreviewProps {
    currentType: string;
    desiredType: string;
}

export const SwapPreview: React.FC<SwapPreviewProps> = ({ currentType, desiredType }) => {
    if (!currentType || !desiredType) return null;

    return (
        <View style={styles.swapPreview}>
            <View style={styles.swapSide}>
                <Text style={styles.swapLabel}>You Have</Text>
                <Text style={styles.swapValue}>{getSeatTypeLabel(currentType)}</Text>
            </View>
            <LinearGradient colors={[Colors.primary.start, Colors.primary.end]} style={styles.swapArrow}>
                <Ionicons name="swap-horizontal" size={20} color="#fff" />
            </LinearGradient>
            <View style={styles.swapSide}>
                <Text style={styles.swapLabel}>You Want</Text>
                <Text style={[styles.swapValue, { color: Colors.success.start }]}>
                    {getSeatTypeLabel(desiredType)}
                </Text>
            </View>
        </View>
    );
};
