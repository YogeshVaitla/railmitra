import React from 'react';
import { View, Text } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Colors from '../../constants/Colors';
import { LocalSwap } from '../../services/swapStore';
import { styles } from './swap.styles';
import { getSeatTypeLabel, getReasonEmoji, getPriorityColor, getTimeSince, getTimeUntilExpiry } from './swap.utils';

export interface OfferCardProps {
    offer: LocalSwap;
}

export const OfferCard: React.FC<OfferCardProps> = ({ offer }) => {
    return (
        <View style={styles.offerCard}>
            <View style={styles.offerTop}>
                <View style={[styles.offerIconBox, { backgroundColor: Colors.primary.light }]}>
                    <MaterialCommunityIcons name="account-switch" size={18} color={Colors.primary.start} />
                </View>
                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={styles.offerSeat}>
                            {offer.currentCoachId}/{offer.currentSeatNo}
                        </Text>
                        <Text style={{ fontSize: 12 }}>{getReasonEmoji(offer.reason)}</Text>
                        <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(offer.priorityScore) + '18' }]}>
                            <Text style={[styles.priorityText, { color: getPriorityColor(offer.priorityScore) }]}>
                                P{(offer.priorityScore * 10).toFixed(0)}
                            </Text>
                        </View>
                    </View>
                    <Text style={styles.offerDetail}>
                        Has: {getSeatTypeLabel(offer.currentSeatType)} · Wants: {getSeatTypeLabel(offer.desiredSeatType)}
                    </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.offerTime}>{getTimeSince(offer.createdAt)}</Text>
                    <Text style={styles.expiryText}>{getTimeUntilExpiry(offer.expiresAt)}</Text>
                </View>
            </View>
            <View style={styles.offerSwapVisual}>
                <View style={styles.offerSwapChip}>
                    <Text style={styles.offerSwapChipText}>{getSeatTypeLabel(offer.currentSeatType)}</Text>
                </View>
                <Ionicons name="arrow-forward" size={14} color={Colors.text.tertiary} />
                <View style={[styles.offerSwapChip, styles.offerSwapChipDesired]}>
                    <Text style={[styles.offerSwapChipText, { color: Colors.success.start }]}>{getSeatTypeLabel(offer.desiredSeatType)}</Text>
                </View>
            </View>
        </View>
    );
};
