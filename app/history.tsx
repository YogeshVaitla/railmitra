import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Colors } from '../constants/Colors';
import {
    getMySwaps,
    getSwapEvents,
    LocalSwap,
    SeatType,
    SwapEvent,
    SwapStatus,
} from '../services/swapStore';

// --- Status helpers ---

const STATUS_CONFIG: Record<SwapStatus, { label: string; color: string; icon: string; bg: string }> = {
    OPEN: { label: 'Active', color: Colors.success.start, icon: 'radio-button-on', bg: Colors.success.light },
    MATCHED: { label: 'Matched', color: Colors.accent.start, icon: 'link', bg: Colors.accent.light },
    ACCEPTED: { label: 'Accepted', color: '#6C63FF', icon: 'checkmark-circle', bg: '#F0EFFF' },
    COMPLETED: { label: 'Completed', color: Colors.success.start, icon: 'checkmark-done-circle', bg: Colors.success.light },
    CANCELLED: { label: 'Cancelled', color: Colors.text.tertiary, icon: 'close-circle', bg: Colors.background.tertiary },
    EXPIRED: { label: 'Expired', color: Colors.text.tertiary, icon: 'time', bg: Colors.background.tertiary },
    WITHDRAWN: { label: 'Withdrawn', color: Colors.text.tertiary, icon: 'arrow-undo', bg: Colors.background.tertiary },
};

const SEAT_TYPE_LABELS: Record<SeatType, string> = {
    LOWER: 'Lower',
    MIDDLE: 'Middle',
    UPPER: 'Upper',
    SIDE_LOWER: 'Side Lower',
    SIDE_UPPER: 'Side Upper',
};

const REASON_EMOJI: Record<string, string> = {
    elderly: '👴',
    medical: '🏥',
    family: '👨‍👩‍👧',
    preference: '💜',
};

const EVENT_LABELS: Record<string, { label: string; emoji: string }> = {
    CREATED: { label: 'Swap registered', emoji: '📝' },
    MATCHED: { label: 'Match found', emoji: '🔗' },
    ACCEPTED: { label: 'Swap accepted', emoji: '✅' },
    REJECTED: { label: 'Swap rejected', emoji: '❌' },
    CANCELLED: { label: 'Swap cancelled', emoji: '🚫' },
    EXPIRED: { label: 'Swap expired', emoji: '⏰' },
    COMPLETED: { label: 'Swap completed', emoji: '🎉' },
    WITHDRAWN: { label: 'Swap withdrawn', emoji: '↩️' },
    RECEIVED_VIA_MESH: { label: 'Received via mesh', emoji: '📡' },
};

export default function HistoryScreen() {
    const [swaps, setSwaps] = useState<LocalSwap[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [events, setEvents] = useState<Record<string, SwapEvent[]>>({});

    const loadHistory = useCallback(async () => {
        const mySwaps = await getMySwaps();
        mySwaps.sort((a, b) => b.createdAt - a.createdAt);
        setSwaps(mySwaps);
    }, []);

    useEffect(() => {
        loadHistory().finally(() => setLoading(false));
    }, [loadHistory]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await loadHistory();
        setRefreshing(false);
    }, [loadHistory]);

    const toggleExpand = async (swapId: string) => {
        if (expandedId === swapId) {
            setExpandedId(null);
            return;
        }
        setExpandedId(swapId);
        if (!events[swapId]) {
            const swapEvents = await getSwapEvents(swapId);
            setEvents(prev => ({ ...prev, [swapId]: swapEvents }));
        }
    };

    const formatDate = (ts: number) => {
        const d = new Date(ts);
        const day = d.getDate().toString().padStart(2, '0');
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const month = months[d.getMonth()];
        const hours = d.getHours().toString().padStart(2, '0');
        const mins = d.getMinutes().toString().padStart(2, '0');
        return `${day} ${month}, ${hours}:${mins}`;
    };

    const getTimeSince = (ts: number) => {
        const mins = Math.floor((Date.now() - ts) / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    };

    const stats = {
        total: swaps.length,
        active: swaps.filter(s => s.status === 'OPEN' || s.status === 'MATCHED' || s.status === 'ACCEPTED').length,
        completed: swaps.filter(s => s.status === 'COMPLETED').length,
        expired: swaps.filter(s => s.status === 'EXPIRED' || s.status === 'CANCELLED').length,
    };

    return (
        <View style={styles.container}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary.start} />
                }
            >
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={20} color={Colors.text.primary} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Swap History</Text>
                    <View style={{ width: 42 }} />
                </View>

                {loading ? (
                    <View style={styles.loadingContainer}>
                        <ActivityIndicator color={Colors.primary.start} size="large" />
                        <Text style={styles.loadingText}>Loading history...</Text>
                    </View>
                ) : swaps.length === 0 ? (
                    <View style={styles.emptyState}>
                        <View style={styles.emptyIconBox}>
                            <MaterialCommunityIcons name="swap-horizontal" size={44} color={Colors.divider} />
                        </View>
                        <Text style={styles.emptyTitle}>No Swaps Yet</Text>
                        <Text style={styles.emptyDesc}>
                            Your swap history will appear here once you register your first swap offer.
                        </Text>
                        <TouchableOpacity onPress={() => router.push('/swap')} style={{ width: '100%' }}>
                            <LinearGradient
                                colors={[Colors.primary.start, Colors.primary.end]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={styles.emptyCta}
                            >
                                <MaterialCommunityIcons name="swap-horizontal-bold" size={18} color="#fff" />
                                <Text style={styles.emptyCtaText}>Start Swapping</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <>
                        {/* Stats Summary */}
                        <View style={styles.statsRow}>
                            <View style={styles.statCard}>
                                <Text style={styles.statValue}>{stats.total}</Text>
                                <Text style={styles.statLabel}>Total</Text>
                            </View>
                            <View style={styles.statCard}>
                                <Text style={[styles.statValue, { color: Colors.success.start }]}>{stats.active}</Text>
                                <Text style={styles.statLabel}>Active</Text>
                            </View>
                            <View style={styles.statCard}>
                                <Text style={[styles.statValue, { color: Colors.accent.start }]}>{stats.completed}</Text>
                                <Text style={styles.statLabel}>Done</Text>
                            </View>
                            <View style={styles.statCard}>
                                <Text style={[styles.statValue, { color: Colors.text.tertiary }]}>{stats.expired}</Text>
                                <Text style={styles.statLabel}>Closed</Text>
                            </View>
                        </View>

                        {/* Swap Cards */}
                        {swaps.map((swap) => {
                            const statusCfg = STATUS_CONFIG[swap.status] || STATUS_CONFIG.OPEN;
                            const isExpanded = expandedId === swap.id;
                            const swapEvents = events[swap.id] || [];

                            return (
                                <TouchableOpacity
                                    key={swap.id}
                                    activeOpacity={0.85}
                                    onPress={() => toggleExpand(swap.id)}
                                    style={styles.swapCard}
                                >
                                    {/* Card Header */}
                                    <View style={styles.cardHeader}>
                                        <View style={styles.cardLeft}>
                                            <View style={styles.trainIconBox}>
                                                <Ionicons name="train" size={16} color={Colors.primary.start} />
                                            </View>
                                            <View>
                                                <Text style={styles.trainNo}>Train {swap.trainNo}</Text>
                                                <Text style={styles.journeyDate}>{swap.journeyDate}</Text>
                                            </View>
                                        </View>
                                        <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
                                            <Ionicons name={statusCfg.icon as any} size={12} color={statusCfg.color} />
                                            <Text style={[styles.statusText, { color: statusCfg.color }]}>
                                                {statusCfg.label}
                                            </Text>
                                        </View>
                                    </View>

                                    {/* Seat Swap Visual */}
                                    <View style={styles.swapVisual}>
                                        <View style={styles.seatInfo}>
                                            <Text style={styles.seatCoach}>{swap.currentCoachId}/{swap.currentSeatNo}</Text>
                                            <Text style={styles.seatType}>
                                                {SEAT_TYPE_LABELS[swap.currentSeatType] || swap.currentSeatType}
                                            </Text>
                                        </View>
                                        <View style={styles.swapArrowBox}>
                                            <Ionicons name="arrow-forward" size={16} color={Colors.primary.start} />
                                        </View>
                                        <View style={[styles.seatInfo, styles.desiredSeat]}>
                                            <Text style={[styles.seatCoach, { color: Colors.success.start }]}>Desired</Text>
                                            <Text style={[styles.seatType, { color: Colors.success.start }]}>
                                                {SEAT_TYPE_LABELS[swap.desiredSeatType] || swap.desiredSeatType}
                                            </Text>
                                        </View>
                                    </View>

                                    {/* Meta Row */}
                                    <View style={styles.metaRow}>
                                        <View style={styles.metaItem}>
                                            <Text style={styles.metaEmoji}>{REASON_EMOJI[swap.reason] || '💜'}</Text>
                                            <Text style={styles.metaText}>
                                                {swap.reason.charAt(0).toUpperCase() + swap.reason.slice(1)}
                                            </Text>
                                        </View>
                                        <View style={styles.metaDot} />
                                        <Text style={styles.metaText}>P{(swap.priorityScore * 10).toFixed(0)}</Text>
                                        <View style={styles.metaDot} />
                                        <Text style={styles.metaText}>{getTimeSince(swap.createdAt)}</Text>
                                        <View style={{ flex: 1 }} />
                                        <Ionicons
                                            name={isExpanded ? 'chevron-up' : 'chevron-down'}
                                            size={16}
                                            color={Colors.text.tertiary}
                                        />
                                    </View>

                                    {/* Expanded: Event Timeline */}
                                    {isExpanded && (
                                        <View style={styles.timeline}>
                                            <View style={styles.timelineDivider} />
                                            <Text style={styles.timelineTitle}>EVENT LOG</Text>
                                            {swapEvents.length > 0 ? (
                                                swapEvents
                                                    .sort((a, b) => a.timestamp - b.timestamp)
                                                    .map((evt, idx) => {
                                                        const evtCfg = EVENT_LABELS[evt.eventType] || { label: evt.eventType, emoji: '📋' };
                                                        return (
                                                            <View key={evt.id || idx} style={styles.timelineEvent}>
                                                                <View style={styles.timelineLine}>
                                                                    <View style={[
                                                                        styles.timelineDot,
                                                                        idx === swapEvents.length - 1 && { backgroundColor: Colors.primary.start },
                                                                    ]} />
                                                                    {idx < swapEvents.length - 1 && <View style={styles.timelineConnector} />}
                                                                </View>
                                                                <View style={styles.timelineContent}>
                                                                    <Text style={styles.timelineEventText}>
                                                                        {evtCfg.emoji} {evtCfg.label}
                                                                    </Text>
                                                                    <Text style={styles.timelineEventTime}>
                                                                        {formatDate(evt.timestamp)}
                                                                    </Text>
                                                                </View>
                                                            </View>
                                                        );
                                                    })
                                            ) : (
                                                <Text style={styles.noEventsText}>No events recorded</Text>
                                            )}
                                            <View style={styles.timestampFooter}>
                                                <Text style={styles.timestampLabel}>Created: {formatDate(swap.createdAt)}</Text>
                                                <Text style={styles.timestampLabel}>Updated: {formatDate(swap.updatedAt)}</Text>
                                            </View>
                                        </View>
                                    )}
                                </TouchableOpacity>
                            );
                        })}
                    </>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background.primary },
    scrollContent: {
        paddingTop: Platform.OS === 'ios' ? 55 : 40,
        paddingBottom: 40, paddingHorizontal: 20,
    },
    header: {
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between', marginBottom: 24,
    },
    backBtn: {
        width: 42, height: 42, borderRadius: 13,
        backgroundColor: Colors.card.background,
        justifyContent: 'center', alignItems: 'center',
        shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1, shadowRadius: 6, elevation: 3,
    },
    headerTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '700' },

    // Loading
    loadingContainer: { alignItems: 'center', paddingTop: 80, gap: 12 },
    loadingText: { color: Colors.text.tertiary, fontSize: 14 },

    // Empty state
    emptyState: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 20 },
    emptyIconBox: {
        width: 100, height: 100, borderRadius: 50,
        backgroundColor: Colors.background.tertiary,
        justifyContent: 'center', alignItems: 'center',
        marginBottom: 20,
    },
    emptyTitle: { color: Colors.text.primary, fontSize: 20, fontWeight: '700', marginBottom: 8 },
    emptyDesc: {
        color: Colors.text.secondary, fontSize: 14,
        textAlign: 'center', lineHeight: 22, marginBottom: 28,
    },
    emptyCta: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingVertical: 16, borderRadius: 14, gap: 10,
    },
    emptyCtaText: { color: '#fff', fontSize: 16, fontWeight: '700' },

    // Stats
    statsRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
    statCard: {
        flex: 1, backgroundColor: Colors.card.background,
        borderRadius: 14, paddingVertical: 14, alignItems: 'center',
        shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 1, shadowRadius: 4, elevation: 2,
    },
    statValue: { color: Colors.text.primary, fontSize: 22, fontWeight: '800' },
    statLabel: { color: Colors.text.tertiary, fontSize: 11, fontWeight: '600', marginTop: 2 },

    // Swap card
    swapCard: {
        backgroundColor: Colors.card.background,
        borderRadius: 16, padding: 16, marginBottom: 10,
        shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1, shadowRadius: 8, elevation: 2,
    },
    cardHeader: {
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between', marginBottom: 14,
    },
    cardLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    trainIconBox: {
        width: 36, height: 36, borderRadius: 10,
        backgroundColor: Colors.primary.light,
        justifyContent: 'center', alignItems: 'center',
    },
    trainNo: { color: Colors.text.primary, fontSize: 15, fontWeight: '700' },
    journeyDate: { color: Colors.text.tertiary, fontSize: 12, marginTop: 1 },
    statusBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
    },
    statusText: { fontSize: 12, fontWeight: '700' },

    // Swap visual
    swapVisual: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: Colors.background.tertiary,
        borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14,
        marginBottom: 12,
    },
    seatInfo: { flex: 1 },
    seatCoach: { color: Colors.text.primary, fontSize: 14, fontWeight: '700' },
    seatType: { color: Colors.text.secondary, fontSize: 12, marginTop: 2 },
    desiredSeat: { alignItems: 'flex-end' },
    swapArrowBox: {
        width: 32, height: 32, borderRadius: 16,
        backgroundColor: Colors.primary.light,
        justifyContent: 'center', alignItems: 'center',
        marginHorizontal: 8,
    },

    // Meta
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaEmoji: { fontSize: 12 },
    metaText: { color: Colors.text.tertiary, fontSize: 12, fontWeight: '500' },
    metaDot: {
        width: 3, height: 3, borderRadius: 1.5,
        backgroundColor: Colors.divider,
    },

    // Timeline
    timeline: { marginTop: 14 },
    timelineDivider: { height: 1, backgroundColor: Colors.divider, marginBottom: 12 },
    timelineTitle: {
        color: Colors.text.tertiary, fontSize: 10,
        fontWeight: '700', letterSpacing: 1, marginBottom: 12,
    },
    timelineEvent: { flexDirection: 'row', marginBottom: 2 },
    timelineLine: { width: 20, alignItems: 'center' },
    timelineDot: {
        width: 8, height: 8, borderRadius: 4,
        backgroundColor: Colors.divider,
        marginTop: 4,
    },
    timelineConnector: {
        width: 1.5, flex: 1,
        backgroundColor: Colors.divider,
        marginVertical: 2,
    },
    timelineContent: { flex: 1, paddingLeft: 10, paddingBottom: 12 },
    timelineEventText: { color: Colors.text.secondary, fontSize: 13, fontWeight: '500' },
    timelineEventTime: { color: Colors.text.tertiary, fontSize: 11, marginTop: 2 },
    noEventsText: {
        color: Colors.text.tertiary, fontSize: 13,
        fontStyle: 'italic', paddingLeft: 30,
    },
    timestampFooter: {
        flexDirection: 'row', justifyContent: 'space-between',
        marginTop: 8, paddingTop: 8,
        borderTopWidth: 1, borderTopColor: Colors.divider,
    },
    timestampLabel: { color: Colors.text.tertiary, fontSize: 10 },
});
