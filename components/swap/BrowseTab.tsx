import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '../../constants/Colors';
import { LocalSwap, SwapAnalytics } from '../../services/swapStore';
import { styles } from './swap.styles';
import { DemandHeatmap } from './DemandHeatmap';
import { OfferCard } from './OfferCard';

export interface BrowseTabProps {
    trainNo: string;
    browseLoading: boolean;
    hasBrowsed: boolean;
    offers: LocalSwap[];
    analytics: SwapAnalytics | null;
    onBrowse: () => void;
    onSwitchToRegister: () => void;
}

export const BrowseTab: React.FC<BrowseTabProps> = ({
    trainNo,
    browseLoading,
    hasBrowsed,
    offers,
    analytics,
    onBrowse,
    onSwitchToRegister,
}) => {
    return (
        <View>
            {/* Browse Button */}
            <TouchableOpacity
                onPress={onBrowse}
                disabled={!trainNo || trainNo.length < 4 || browseLoading}
                style={[styles.browseBtn, (!trainNo || trainNo.length < 4) && { opacity: 0.4 }]}
            >
                <LinearGradient
                    colors={[Colors.primary.start, Colors.primary.end]}
                    style={styles.browseBtnGradient}
                >
                    {browseLoading ? (
                        <ActivityIndicator color="#fff" size="small" />
                    ) : (
                        <>
                            <Ionicons name="search" size={16} color="#fff" />
                            <Text style={styles.browseBtnText}>Find Swap Offers</Text>
                        </>
                    )}
                </LinearGradient>
            </TouchableOpacity>

            {/* Results */}
            {hasBrowsed && (
                <>
                    <View style={styles.browseHeader}>
                        <Text style={styles.browseTitle}>
                            {offers.length > 0
                                ? `${offers.length} Swap Offer${offers.length > 1 ? 's' : ''}`
                                : 'No Offers Yet'}
                        </Text>
                        <TouchableOpacity onPress={onBrowse} style={styles.iconBtn}>
                            <Ionicons name="refresh" size={16} color={Colors.primary.start} />
                        </TouchableOpacity>
                    </View>

                    {analytics && <DemandHeatmap analytics={analytics} />}

                    {offers.length > 0 ? (
                        offers.map((offer, idx) => (
                            <OfferCard key={offer.id || idx} offer={offer} />
                        ))
                    ) : (
                        <View style={styles.emptyState}>
                            <MaterialCommunityIcons name="swap-horizontal" size={40} color={Colors.divider} />
                            <Text style={styles.emptyTitle}>No swap offers for this train yet</Text>
                            <Text style={styles.emptySub}>Be the first to register one!</Text>
                            <TouchableOpacity onPress={onSwitchToRegister} style={styles.goRegisterBtn}>
                                <Ionicons name="add-circle-outline" size={16} color={Colors.primary.start} />
                                <Text style={styles.goRegisterText}>Register Your Swap</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </>
            )}
        </View>
    );
};
