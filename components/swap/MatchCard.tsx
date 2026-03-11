import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import Colors from '../../constants/Colors';
import { SwapMatch } from '../../services/swapEngine';
import { SwapChainViz, SwapNode } from './SwapChainViz';
import { styles } from './swap.styles';
import { getSeatTypeLabel, getReasonEmoji, getPriorityColor } from './swap.utils';

export interface MatchCardProps {
    match: SwapMatch;
    isAccepted: boolean;
    onAccept: (match: SwapMatch) => void;
}

export const MatchCard: React.FC<MatchCardProps> = ({ match, isAccepted, onAccept }) => {
    // Map SwapMatch participants to SwapNode[] for SwapChainViz
    const mappedNodes: SwapNode[] = match.participants.map(p => ({
        id: p.isYou ? 'YOU' : `Passenger (${p.coachId}/${p.seatNo})`,
        isYou: p.isYou,
        coachId: p.coachId,
        seatNo: p.seatNo,
        has: p.has,
        wants: p.wants,
    }));

    return (
        <View style={styles.matchCard}>
            <View style={styles.matchHeader}>
                <View style={styles.matchTypeBadge}>
                    <Text style={styles.matchTypeText}>{match.type}</Text>
                </View>
                <Text style={styles.matchCyclePath}>{match.cyclePath}</Text>
                <View style={[styles.priorityBadge, { backgroundColor: getPriorityColor(match.score / match.participants.length) + '18' }]}>
                    <Text style={[styles.priorityText, { color: getPriorityColor(match.score / match.participants.length) }]}>
                        S{match.score.toFixed(1)}
                    </Text>
                </View>
            </View>

            {match.participants.filter(p => !p.isYou).map((p, pidx) => (
                <View key={pidx} style={styles.offerTop}>
                    <View style={[styles.offerIconBox, { backgroundColor: Colors.accent.light }]}>
                        <MaterialCommunityIcons name="account-switch" size={18} color={Colors.accent.start} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.offerSeat}>{p.coachId}/{p.seatNo}</Text>
                            <Text style={{ fontSize: 12 }}>{getReasonEmoji(p.reason)}</Text>
                        </View>
                        <Text style={styles.offerDetail}>
                            Has: {getSeatTypeLabel(p.has)} · Wants: {getSeatTypeLabel(p.wants)}
                        </Text>
                    </View>
                    <TouchableOpacity
                        style={[styles.acceptBtn, isAccepted && styles.acceptedBtn]}
                        onPress={() => onAccept(match)}
                        disabled={isAccepted}
                    >
                        <Text style={styles.acceptBtnText}>
                            {isAccepted ? '✓ Accepted' : 'Accept'}
                        </Text>
                    </TouchableOpacity>
                </View>
            ))}
            
            <View style={{ marginTop: 8, marginHorizontal: -14 }}>
                <SwapChainViz nodes={mappedNodes} />
            </View>
        </View>
    );
};
