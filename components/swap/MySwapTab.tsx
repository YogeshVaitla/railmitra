import React from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Colors from '../../constants/Colors';
import { LocalSwap } from '../../services/swapStore';
import { SwapMatch } from '../../services/swapEngine';
import { RadarAnimation } from './RadarAnimation';
import { SwapSuccessCard } from './SwapSuccessCard';
import { MatchCard } from './MatchCard';
import { styles } from './swap.styles';
import { getSeatTypeLabel } from './swap.utils';

export interface MySwapTabProps {
    submitted: boolean;
    mySwapId: string | null;
    activeSwapObj: LocalSwap | null;
    matchedPartnerObj: LocalSwap | null;
    isAccepted: boolean;
    peerCount: number;
    matchLoading: boolean;
    matches: SwapMatch[];
    acceptedIds: string[];
    onCancelSwap: (swapId: string) => void;
    onFindMatches: () => void;
    onAcceptSwap: (match: SwapMatch) => void;
    onGoToRegister: () => void;
    // New handlers for SwapSuccessCard
    onCompleteSwap: () => void;
    onReportProblem: () => void;
}

export const MySwapTab: React.FC<MySwapTabProps> = ({
    submitted,
    mySwapId,
    activeSwapObj,
    matchedPartnerObj,
    isAccepted,
    peerCount,
    matchLoading,
    matches,
    acceptedIds,
    onCancelSwap,
    onFindMatches,
    onAcceptSwap,
    onGoToRegister,
    onCompleteSwap,
    onReportProblem,
}) => {
    if (!submitted || !activeSwapObj) {
        return (
            <View style={styles.emptyState}>
                <MaterialCommunityIcons name="swap-horizontal" size={48} color={Colors.divider} />
                <Text style={styles.emptyTitle}>No active swap</Text>
                <Text style={styles.emptySub}>Register your seat swap to start finding matches</Text>
                <TouchableOpacity onPress={onGoToRegister} style={styles.goRegisterBtn}>
                    <Ionicons name="add-circle-outline" size={16} color={Colors.primary.start} />
                    <Text style={styles.goRegisterText}>Register Now</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View>
            {/* Active Swap Card / Success Card */}
            {isAccepted && matchedPartnerObj ? (
                <View style={{ marginBottom: 16 }}>
                    <SwapSuccessCard
                        partnerCoachId={matchedPartnerObj.currentCoachId}
                        partnerSeatNo={matchedPartnerObj.currentSeatNo}
                        partnerHas={getSeatTypeLabel(matchedPartnerObj.currentSeatType)}
                        onComplete={onCompleteSwap}
                        onReportProblem={onReportProblem}
                    />
                </View>
            ) : (
                <View style={styles.successCard}>
                    <RadarAnimation peerCount={peerCount} />
                    <Text style={[styles.successTitle, { marginTop: 12 }]}>Swap Active</Text>
                    <Text style={styles.successDesc}>
                        {activeSwapObj.currentCoachId}/{activeSwapObj.currentSeatNo} ({getSeatTypeLabel(activeSwapObj.currentSeatType)}) → Looking for {getSeatTypeLabel(activeSwapObj.desiredSeatType)}
                    </Text>

                    <Text style={styles.successMesh}>
                        {peerCount > 0
                            ? `📡 Broadcasting to ${peerCount} nearby passenger${peerCount !== 1 ? 's' : ''}`
                            : '📱 Waiting for nearby passengers'}
                    </Text>

                    <TouchableOpacity
                        onPress={() => mySwapId && onCancelSwap(mySwapId)}
                        style={styles.cancelBtn}
                    >
                        <Text style={styles.cancelBtnText}>Cancel Offer</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Matches */}
            {!isAccepted && (
                <View style={styles.matchesSection}>
                    <View style={styles.browseHeader}>
                        <Text style={styles.browseTitle}>Your Matches</Text>
                        <TouchableOpacity onPress={onFindMatches} style={styles.iconBtn}>
                            <Ionicons name="refresh" size={16} color={Colors.primary.start} />
                        </TouchableOpacity>
                    </View>

                    {matchLoading ? (
                        <ActivityIndicator color={Colors.primary.start} style={{ marginVertical: 20 }} />
                    ) : matches.length > 0 ? (
                        matches.map((match, idx) => (
                            <MatchCard 
                                key={match.id || idx} 
                                match={match} 
                                isAccepted={acceptedIds.includes(match.id)} 
                                onAccept={onAcceptSwap} 
                            />
                        ))
                    ) : (
                        <View style={styles.emptyState}>
                            <MaterialCommunityIcons name="magnify-close" size={40} color={Colors.divider} />
                            <Text style={styles.emptyTitle}>No matching swaps yet</Text>
                            <Text style={styles.emptySub}>
                                {peerCount > 0
                                    ? 'Scanning for matches...'
                                    : 'Matches will appear when other passengers join'}
                            </Text>
                        </View>
                    )}
                </View>
            )}
        </View>
    );
};
