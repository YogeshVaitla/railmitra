import React from 'react';
import { View, Text } from 'react-native';
import Colors from '../../constants/Colors';
import { SwapAnalytics } from '../../services/swapStore';
import { styles } from './swap.styles';
import { getSeatTypeLabel } from './swap.utils';

export interface DemandHeatmapProps {
    analytics: SwapAnalytics;
}

export const DemandHeatmap: React.FC<DemandHeatmapProps> = ({ analytics }) => {
    return (
        <View style={styles.analyticsCard}>
            <Text style={styles.analyticsSectionLabel}>DEMAND HEATMAP</Text>
            <View style={styles.heatmapGrid}>
                {Object.entries(analytics.demandHeatmap).map(([type, data]) => (
                    <View key={type} style={styles.heatmapItem}>
                        <Text style={styles.heatmapLabel}>{getSeatTypeLabel(type)}</Text>
                        <View style={styles.heatmapBars}>
                            <View style={styles.heatmapBarRow}>
                                <Text style={styles.heatmapBarLabel}>Want</Text>
                                <View style={[styles.heatmapBar, styles.heatmapBarWant, { width: Math.max(4, data.wanted * 20) }]} />
                                <Text style={styles.heatmapBarCount}>{data.wanted}</Text>
                            </View>
                            <View style={styles.heatmapBarRow}>
                                <Text style={styles.heatmapBarLabel}>Have</Text>
                                <View style={[styles.heatmapBar, styles.heatmapBarHave, { width: Math.max(4, data.offered * 20) }]} />
                                <Text style={styles.heatmapBarCount}>{data.offered}</Text>
                            </View>
                        </View>
                    </View>
                ))}
            </View>
            <View style={styles.analyticsStats}>
                <View style={styles.analyticsStat}>
                    <Text style={styles.analyticsStatValue}>{analytics.totalOffers}</Text>
                    <Text style={styles.analyticsStatLabel}>Total</Text>
                </View>
                <View style={styles.analyticsStat}>
                    <Text style={styles.analyticsStatValue}>{analytics.activeOffers}</Text>
                    <Text style={styles.analyticsStatLabel}>Active</Text>
                </View>
                <View style={styles.analyticsStat}>
                    <Text style={[styles.analyticsStatValue, { color: Colors.success.start }]}>{analytics.completedSwaps}</Text>
                    <Text style={styles.analyticsStatLabel}>Done</Text>
                </View>
            </View>
        </View>
    );
};
