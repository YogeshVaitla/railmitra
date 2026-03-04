import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Animated,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import Colors from '../constants/Colors';
import { createMeshBridge, IMeshBridge } from '../services/meshBridge';
import { findMyMatches, SwapMatch } from '../services/swapEngine';
import {
    acceptMatch,
    browseOffers,
    cancelSwap,
    clearMockSwapData,
    createLocalSwap,
    getOrCreateDeviceId,
    getSwapAnalytics,
    getSwapsForTrain,
    LocalSwap,
    SeatType,
    SwapAnalytics,
    SwapReason,
} from '../services/swapStore';

// --- Constants ---

const SEAT_TYPES: { id: SeatType; label: string; icon: string }[] = [
    { id: 'LOWER', label: 'Lower', icon: 'bed-outline' },
    { id: 'MIDDLE', label: 'Middle', icon: 'reorder-three-outline' },
    { id: 'UPPER', label: 'Upper', icon: 'arrow-up-outline' },
    { id: 'SIDE_LOWER', label: 'Side Lower', icon: 'bed-outline' },
    { id: 'SIDE_UPPER', label: 'Side Upper', icon: 'arrow-up-outline' },
];

const REASONS: { id: SwapReason; label: string; icon: string; emoji: string }[] = [
    { id: 'elderly', label: 'Elderly', icon: 'accessibility-outline', emoji: '👴' },
    { id: 'medical', label: 'Medical', icon: 'medkit-outline', emoji: '🏥' },
    { id: 'family', label: 'Family', icon: 'people-outline', emoji: '👨‍👩‍👧' },
    { id: 'preference', label: 'Preference', icon: 'heart-outline', emoji: '💜' },
];

export default function SwapScreen() {
    // --- Core State ---
    const [trainNo, setTrainNo] = useState('');
    const [journeyDate] = useState(new Date().toISOString().split('T')[0]);
    const [deviceId, setDeviceId] = useState('');

    // --- Mesh State ---
    const meshRef = useRef<IMeshBridge | null>(null);
    const [peerCount, setPeerCount] = useState(0);
    const [meshActive, setMeshActive] = useState(false);

    // --- Browse State ---
    const [offers, setOffers] = useState<LocalSwap[]>([]);
    const [browseLoading, setBrowseLoading] = useState(false);
    const [hasBrowsed, setHasBrowsed] = useState(false);

    // --- Register Form State ---
    const [showRegisterForm, setShowRegisterForm] = useState(false);
    const [coachId, setCoachId] = useState('');
    const [seatNo, setSeatNo] = useState('');
    const [currentType, setCurrentType] = useState<SeatType | ''>('');
    const [desiredType, setDesiredType] = useState<SeatType | ''>('');
    const [reason, setReason] = useState<SwapReason>('preference');
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [mySwapId, setMySwapId] = useState<string | null>(null);

    // --- Matches State ---
    const [matches, setMatches] = useState<SwapMatch[]>([]);
    const [matchLoading, setMatchLoading] = useState(false);
    const [acceptedIds, setAcceptedIds] = useState<string[]>([]);

    // --- Analytics State ---
    const [analytics, setAnalytics] = useState<SwapAnalytics | null>(null);
    const [showAnalytics, setShowAnalytics] = useState(false);

    // --- Notification ---
    const [notification, setNotification] = useState<string | null>(null);
    const fadeAnim = useRef(new Animated.Value(0)).current;

    // --- Init ---
    useEffect(() => {
        getOrCreateDeviceId().then(setDeviceId);
        // Clean up any mock swap data from dev testing
        clearMockSwapData();
        return () => { meshRef.current?.stop(); };
    }, []);

    const isFormValid =
        trainNo.length >= 4 &&
        coachId &&
        seatNo &&
        currentType &&
        desiredType &&
        currentType !== desiredType;

    // --- Handlers (logic preserved exactly) ---

    const initMeshBridge = async () => {
        if (!trainNo || trainNo.length < 4) return;
        if (!meshRef.current || !meshRef.current.isActive()) {
            const mesh = createMeshBridge();
            meshRef.current = mesh;
            mesh.onPeerCountChanged((count) => {
                setPeerCount(count);
                setMeshActive(count > 0);
            });
            mesh.onSwapReceived((newSwaps) => {
                browseOffers(trainNo, journeyDate).then(setOffers);
                handleFindMatches(); // Auto-refresh matches when background sync receives offers
                showNotification(`📡 ${newSwaps.length} new offer${newSwaps.length > 1 ? 's' : ''} from nearby passengers`);
            });
            await mesh.startDiscovery(trainNo, journeyDate);
        }
    };

    const handleBrowse = async () => {
        if (!trainNo || trainNo.length < 4) return;
        setBrowseLoading(true);
        setHasBrowsed(false);

        await initMeshBridge();

        const result = await browseOffers(trainNo, journeyDate);
        setOffers(result);
        setHasBrowsed(true);
        setBrowseLoading(false);

        const stats = await getSwapAnalytics(trainNo, journeyDate);
        setAnalytics(stats);
    };

    const handleSubmit = async () => {
        if (!isFormValid || !currentType || !desiredType) return;
        setLoading(true);

        await initMeshBridge(); // Ensure active before broadcasting

        try {
            const swap = await createLocalSwap({
                trainNo, journeyDate,
                currentCoachId: coachId,
                currentSeatNo: parseInt(seatNo),
                currentSeatType: currentType,
                desiredSeatType: desiredType,
                reason,
            });

            meshRef.current?.broadcastSwapOffer(swap);
            setMySwapId(swap.id); // Track for cancel button
            setLoading(false);
            setSubmitted(true);
            setShowRegisterForm(false);

            // Refresh offers so our swap appears in the list
            const updatedOffers = await browseOffers(trainNo, journeyDate);
            setOffers(updatedOffers);

            Animated.timing(fadeAnim, {
                toValue: 1, duration: 500, useNativeDriver: true,
            }).start();

            handleFindMatches();
        } catch (error: any) {
            setLoading(false);
            Alert.alert(
                'Can\'t Register',
                error.message || 'Something went wrong. Please try again.',
                [{ text: 'OK' }]
            );
        }
    };

    const handleFindMatches = async () => {
        setMatchLoading(true);
        const allSwaps = await getSwapsForTrain(trainNo, journeyDate);
        const myMatches = findMyMatches(allSwaps, deviceId);
        setMatches(myMatches);
        setMatchLoading(false);
    };

    const handleAcceptSwap = (match: SwapMatch) => {
        const myParticipant = match.participants.find(p => p.isYou);
        const otherParticipant = match.participants.find(p => !p.isYou);
        if (!myParticipant || !otherParticipant) return;

        const seatInfo = `${otherParticipant.coachId}/${otherParticipant.seatNo}`;
        const seatType = getSeatTypeLabel(otherParticipant.has);

        Alert.alert(
            'Confirm Swap',
            `Accept swap with ${seatInfo} (${seatType})? The other passenger will be notified via mesh.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Accept',
                    onPress: async () => {
                        const success = await acceptMatch(myParticipant.swapId, otherParticipant.swapId);
                        if (success) {
                            setAcceptedIds(prev => [...prev, match.id]);
                            meshRef.current?.broadcastSwapAccept(myParticipant.swapId, otherParticipant.swapId);
                            showNotification(`✅ Swap accepted! ${seatInfo} (${seatType}) ↔ Your seat.`);
                        }
                    },
                },
            ]
        );
    };

    const handleCancelSwap = async (swapId: string) => {
        Alert.alert(
            'Cancel Swap',
            'Are you sure you want to cancel your swap offer?',
            [
                { text: 'Keep It', style: 'cancel' },
                {
                    text: 'Cancel Offer', style: 'destructive',
                    onPress: async () => {
                        await cancelSwap(swapId);
                        meshRef.current?.broadcastSwapCancel(swapId);
                        showNotification('🚫 Swap offer cancelled.');
                        handleReset();
                    },
                },
            ]
        );
    };

    const showNotification = (msg: string) => {
        setNotification(msg);
        setTimeout(() => setNotification(null), 5000);
    };

    const getSeatTypeLabel = (type: string) => SEAT_TYPES.find(t => t.id === type)?.label || type;

    const getTimeSince = (timestamp: number) => {
        const mins = Math.floor((Date.now() - timestamp) / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
    };

    const getTimeUntilExpiry = (expiresAt: number) => {
        const mins = Math.floor((expiresAt - Date.now()) / 60000);
        if (mins <= 0) return 'Expired';
        if (mins < 60) return `${mins}m left`;
        return `${Math.floor(mins / 60)}h ${mins % 60}m left`;
    };

    const getReasonEmoji = (r: string) => REASONS.find(rs => rs.id === r)?.emoji || '💜';

    const getPriorityColor = (score: number) => {
        if (score >= 0.6) return Colors.success.start;
        if (score >= 0.4) return Colors.warning.start;
        return Colors.text.tertiary;
    };

    const handleReset = () => {
        setSubmitted(false);
        setShowRegisterForm(false);
        setHasBrowsed(false);
        setOffers([]);
        setTrainNo(''); setCoachId(''); setSeatNo('');
        setCurrentType(''); setDesiredType('');
        setReason('preference');
        setMatches([]); setAcceptedIds([]);
        setAnalytics(null); setShowAnalytics(false);
        setMySwapId(null);
        fadeAnim.setValue(0);
    };

    // --- Render ---

    return (
        <View style={styles.container}>
            {/* Notification Banner */}
            {notification && (
                <View style={styles.notifBanner}>
                    <Text style={styles.notifText}>{notification}</Text>
                    <TouchableOpacity onPress={() => setNotification(null)}>
                        <Ionicons name="close" size={18} color="#fff" />
                    </TouchableOpacity>
                </View>
            )}
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={20} color={Colors.text.primary} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Seat Swap</Text>
                    <View style={styles.meshStatus}>
                        <View style={[styles.meshDot, { backgroundColor: meshActive ? Colors.success.start : Colors.text.tertiary }]} />
                        <Text style={styles.meshText}>
                            {meshActive ? `${peerCount}` : '—'}
                        </Text>
                    </View>
                </View>

                {/* Info Banner */}
                <View style={styles.infoBanner}>
                    <LinearGradient
                        colors={[Colors.primary.start, Colors.primary.end]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.infoGradient}
                    >
                        <MaterialCommunityIcons name="swap-horizontal-bold" size={26} color="#fff" />
                        <View style={styles.infoContent}>
                            <Text style={styles.infoTitle}>P2P Seat Exchange</Text>
                            <Text style={styles.infoDesc}>
                                Register your swap offer and find matching passengers on the same train. Offers sync automatically.
                            </Text>
                        </View>
                    </LinearGradient>
                </View>

                {/* Mesh Banner */}
                {meshActive && peerCount > 0 && (
                    <View style={styles.meshBanner}>
                        <View style={styles.meshBannerDot} />
                        <Text style={styles.meshBannerText}>
                            📡 Connected to {peerCount} nearby passenger{peerCount !== 1 ? 's' : ''}
                        </Text>
                    </View>
                )}

                {/* Step 1: Train Number + Browse */}
                <View style={styles.card}>
                    <Text style={styles.sectionLabel}>FIND SWAP OFFERS</Text>
                    <View style={styles.formRow}>
                        <View style={[styles.formField, { flex: 1 }]}>
                            <Text style={styles.fieldLabel}>Train No.</Text>
                            <TextInput
                                style={styles.fieldInput}
                                placeholder="12301"
                                placeholderTextColor={Colors.text.tertiary}
                                value={trainNo}
                                onChangeText={setTrainNo}
                                keyboardType="number-pad"
                                maxLength={5}
                                editable={!submitted}
                            />
                        </View>
                        <TouchableOpacity
                            onPress={handleBrowse}
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
                                        <Text style={styles.browseBtnText}>Browse</Text>
                                    </>
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Browse Results */}
                {hasBrowsed && (
                    <>
                        <View style={styles.browseHeader}>
                            <Text style={styles.browseTitle}>
                                {offers.length > 0
                                    ? `${offers.length} Swap Offers Available`
                                    : 'No Swap Offers Yet'}
                            </Text>
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                {analytics && (
                                    <TouchableOpacity
                                        onPress={() => setShowAnalytics(!showAnalytics)}
                                        style={[styles.iconBtn, showAnalytics && { backgroundColor: Colors.accent.light }]}
                                    >
                                        <Ionicons name="analytics" size={16} color={Colors.accent.start} />
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity onPress={handleBrowse} style={styles.iconBtn}>
                                    <Ionicons name="refresh" size={16} color={Colors.primary.start} />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Analytics Panel */}
                        {showAnalytics && analytics && (
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
                                    <View style={styles.analyticsStat}>
                                        <Text style={styles.analyticsStatValue}>{Math.round(analytics.successRate * 100)}%</Text>
                                        <Text style={styles.analyticsStatLabel}>Rate</Text>
                                    </View>
                                </View>
                            </View>
                        )}

                        {offers.length > 0 ? (
                            offers.map((offer, idx) => (
                                <View key={offer.id || idx} style={styles.offerCard}>
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
                            ))
                        ) : (
                            <View style={styles.emptyState}>
                                <MaterialCommunityIcons name="swap-horizontal" size={40} color={Colors.divider} />
                                <Text style={styles.emptyTitle}>No swap offers for this train yet</Text>
                                <Text style={styles.emptySub}>Be the first to register one!</Text>
                            </View>
                        )}

                        {/* Register Button / Form */}
                        {!submitted && (
                            <>
                                <TouchableOpacity
                                    onPress={() => setShowRegisterForm(!showRegisterForm)}
                                    style={styles.registerToggle}
                                >
                                    <Ionicons
                                        name={showRegisterForm ? 'chevron-up' : 'add-circle-outline'}
                                        size={18}
                                        color={Colors.primary.start}
                                    />
                                    <Text style={styles.registerToggleText}>
                                        {showRegisterForm ? 'Hide Registration Form' : 'Register Your Swap Offer'}
                                    </Text>
                                </TouchableOpacity>

                                {showRegisterForm && (
                                    <View style={styles.card}>
                                        <Text style={styles.sectionLabel}>YOUR SEAT DETAILS</Text>
                                        <View style={styles.formRow}>
                                            <View style={[styles.formField, { flex: 1 }]}>
                                                <Text style={styles.fieldLabel}>Coach</Text>
                                                <TextInput
                                                    style={styles.fieldInput}
                                                    placeholder="B3"
                                                    placeholderTextColor={Colors.text.tertiary}
                                                    value={coachId}
                                                    onChangeText={setCoachId}
                                                    autoCapitalize="characters"
                                                    maxLength={4}
                                                />
                                            </View>
                                            <View style={[styles.formField, { flex: 1 }]}>
                                                <Text style={styles.fieldLabel}>Seat #</Text>
                                                <TextInput
                                                    style={styles.fieldInput}
                                                    placeholder="42"
                                                    placeholderTextColor={Colors.text.tertiary}
                                                    value={seatNo}
                                                    onChangeText={setSeatNo}
                                                    keyboardType="number-pad"
                                                    maxLength={3}
                                                />
                                            </View>
                                        </View>

                                        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>YOUR CURRENT BERTH</Text>
                                        <View style={styles.typeGrid}>
                                            {SEAT_TYPES.map(type => (
                                                <TouchableOpacity
                                                    key={type.id}
                                                    onPress={() => setCurrentType(type.id)}
                                                    style={[
                                                        styles.typeChip,
                                                        currentType === type.id && styles.typeChipActive,
                                                    ]}
                                                >
                                                    <Ionicons
                                                        name={type.icon as any}
                                                        size={16}
                                                        color={currentType === type.id ? '#fff' : Colors.text.tertiary}
                                                    />
                                                    <Text style={[
                                                        styles.typeChipText,
                                                        currentType === type.id && styles.typeChipTextActive,
                                                    ]}>
                                                        {type.label}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>

                                        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>DESIRED BERTH</Text>
                                        <View style={styles.typeGrid}>
                                            {SEAT_TYPES.filter(t => t.id !== currentType).map(type => (
                                                <TouchableOpacity
                                                    key={type.id}
                                                    onPress={() => setDesiredType(type.id)}
                                                    style={[
                                                        styles.typeChip,
                                                        desiredType === type.id && styles.typeChipDesired,
                                                    ]}
                                                >
                                                    <Ionicons
                                                        name={type.icon as any}
                                                        size={16}
                                                        color={desiredType === type.id ? '#fff' : Colors.text.tertiary}
                                                    />
                                                    <Text style={[
                                                        styles.typeChipText,
                                                        desiredType === type.id && styles.typeChipTextActive,
                                                    ]}>
                                                        {type.label}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>

                                        {/* Reason Selector */}
                                        <Text style={[styles.sectionLabel, { marginTop: 20 }]}>REASON (AFFECTS PRIORITY)</Text>
                                        <View style={styles.typeGrid}>
                                            {REASONS.map(r => (
                                                <TouchableOpacity
                                                    key={r.id}
                                                    onPress={() => setReason(r.id)}
                                                    style={[
                                                        styles.typeChip,
                                                        reason === r.id && styles.reasonChipActive,
                                                    ]}
                                                >
                                                    <Text style={{ fontSize: 14 }}>{r.emoji}</Text>
                                                    <Text style={[
                                                        styles.typeChipText,
                                                        reason === r.id && styles.typeChipTextActive,
                                                    ]}>
                                                        {r.label}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>

                                        {/* Visual swap indicator */}
                                        {currentType && desiredType && (
                                            <View style={styles.swapPreview}>
                                                <View style={styles.swapSide}>
                                                    <Text style={styles.swapLabel}>You Have</Text>
                                                    <Text style={styles.swapValue}>{getSeatTypeLabel(currentType)}</Text>
                                                </View>
                                                <LinearGradient
                                                    colors={[Colors.primary.start, Colors.primary.end]}
                                                    style={styles.swapArrow}
                                                >
                                                    <Ionicons name="swap-horizontal" size={20} color="#fff" />
                                                </LinearGradient>
                                                <View style={styles.swapSide}>
                                                    <Text style={styles.swapLabel}>You Want</Text>
                                                    <Text style={[styles.swapValue, { color: Colors.success.start }]}>
                                                        {getSeatTypeLabel(desiredType)}
                                                    </Text>
                                                </View>
                                            </View>
                                        )}

                                        {/* Submit */}
                                        <TouchableOpacity
                                            onPress={handleSubmit}
                                            disabled={!isFormValid || loading}
                                            activeOpacity={0.8}
                                            style={{ marginTop: 16 }}
                                        >
                                            <LinearGradient
                                                colors={
                                                    isFormValid
                                                        ? [Colors.primary.start, Colors.primary.end]
                                                        : [Colors.background.tertiary, Colors.background.tertiary]
                                                }
                                                start={{ x: 0, y: 0 }}
                                                end={{ x: 1, y: 0 }}
                                                style={[styles.submitBtn, !isFormValid && { opacity: 0.5 }]}
                                            >
                                                {loading ? (
                                                    <ActivityIndicator color="#fff" />
                                                ) : (
                                                    <>
                                                        <MaterialCommunityIcons name="swap-horizontal-bold" size={20} color={isFormValid ? '#fff' : Colors.text.tertiary} />
                                                        <Text style={[styles.submitBtnText, !isFormValid && { color: Colors.text.tertiary }]}>Register Swap Offer</Text>
                                                    </>
                                                )}
                                            </LinearGradient>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </>
                        )}

                        {/* After Registration: Success + Matches */}
                        {submitted && (
                            <Animated.View style={{ opacity: fadeAnim }}>
                                <View style={styles.successCard}>
                                    <View style={styles.successIconBox}>
                                        <Ionicons name="checkmark-circle" size={36} color={Colors.success.start} />
                                    </View>
                                    <Text style={styles.successTitle}>Swap Registered!</Text>
                                    <Text style={styles.successDesc}>
                                        {coachId}/{seatNo} ({getSeatTypeLabel(currentType)}) → Looking for {getSeatTypeLabel(desiredType)}
                                    </Text>
                                    <Text style={styles.successMesh}>
                                        {peerCount > 0
                                            ? `📡 Broadcasting to ${peerCount} nearby passenger${peerCount !== 1 ? 's' : ''}`
                                            : '📱 Saved locally — waiting for nearby passengers'}
                                    </Text>

                                    <TouchableOpacity
                                        onPress={() => {
                                            if (mySwapId) {
                                                handleCancelSwap(mySwapId);
                                            } else {
                                                const mySwaps = offers.filter(o => o.deviceId === deviceId);
                                                if (mySwaps.length > 0) handleCancelSwap(mySwaps[0].id);
                                            }
                                        }}
                                        style={styles.cancelBtn}
                                    >
                                        <Text style={styles.cancelBtnText}>Cancel Offer</Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Matches */}
                                <View style={styles.matchesSection}>
                                    <View style={styles.browseHeader}>
                                        <Text style={styles.browseTitle}>Your Matches</Text>
                                        <TouchableOpacity onPress={handleFindMatches} style={styles.iconBtn}>
                                            <Ionicons name="refresh" size={16} color={Colors.primary.start} />
                                        </TouchableOpacity>
                                    </View>

                                    {matchLoading ? (
                                        <ActivityIndicator color={Colors.primary.start} style={{ marginVertical: 20 }} />
                                    ) : matches.length > 0 ? (
                                        matches.map((match, idx) => (
                                            <View key={match.id || idx} style={styles.matchCard}>
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
                                                            style={[
                                                                styles.acceptBtn,
                                                                acceptedIds.includes(match.id) && styles.acceptedBtn,
                                                            ]}
                                                            onPress={() => handleAcceptSwap(match)}
                                                            disabled={acceptedIds.includes(match.id)}
                                                        >
                                                            <Text style={styles.acceptBtnText}>
                                                                {acceptedIds.includes(match.id) ? '✓ Accepted' : 'Accept'}
                                                            </Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                ))}
                                            </View>
                                        ))
                                    ) : (
                                        <View style={styles.emptyState}>
                                            <MaterialCommunityIcons name="magnify-close" size={40} color={Colors.divider} />
                                            <Text style={styles.emptyTitle}>No matching swaps yet</Text>
                                            <Text style={styles.emptySub}>
                                                {peerCount > 0
                                                    ? 'Scanning for matches...'
                                                    : 'Register your offer — matches will appear when other passengers join'}
                                            </Text>
                                        </View>
                                    )}
                                </View>

                                <TouchableOpacity onPress={handleReset} style={styles.newSwapBtn}>
                                    <Ionicons name="add-circle-outline" size={18} color={Colors.primary.start} />
                                    <Text style={styles.newSwapText}>Start Over</Text>
                                </TouchableOpacity>
                            </Animated.View>
                        )}
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
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 20,
    },
    backBtn: {
        width: 42, height: 42, borderRadius: 13,
        backgroundColor: Colors.card.background,
        justifyContent: 'center', alignItems: 'center',
        shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1, shadowRadius: 6, elevation: 3,
    },
    headerTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '700' },

    meshStatus: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: Colors.card.background, borderRadius: 12,
        paddingHorizontal: 12, paddingVertical: 8,
        shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 1, shadowRadius: 4, elevation: 2,
    },
    meshDot: { width: 8, height: 8, borderRadius: 4 },
    meshText: { color: Colors.text.secondary, fontSize: 12, fontWeight: '700' },

    meshBanner: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: Colors.success.light, borderRadius: 12,
        paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12,
        borderWidth: 1, borderColor: `${Colors.success.start}20`,
    },
    meshBannerDot: {
        width: 8, height: 8, borderRadius: 4,
        backgroundColor: Colors.success.start,
    },
    meshBannerText: { color: Colors.text.secondary, fontSize: 13 },

    infoBanner: { borderRadius: 16, overflow: 'hidden', marginBottom: 16 },
    infoGradient: {
        flexDirection: 'row', padding: 18, gap: 14, alignItems: 'center',
    },
    infoContent: { flex: 1 },
    infoTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 4 },
    infoDesc: { color: 'rgba(255,255,255,0.85)', fontSize: 13, lineHeight: 19 },

    // Cards
    card: {
        backgroundColor: Colors.card.background, borderRadius: 16, padding: 18,
        marginBottom: 16,
        shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1, shadowRadius: 8, elevation: 2,
    },
    sectionLabel: {
        color: Colors.text.tertiary, fontSize: 11, fontWeight: '700',
        letterSpacing: 1, marginBottom: 12,
    },
    formRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-end' },
    formField: {},
    fieldLabel: { color: Colors.text.secondary, fontSize: 12, marginBottom: 6 },
    fieldInput: {
        backgroundColor: Colors.background.tertiary, borderRadius: 12,
        paddingHorizontal: 14, height: 48, color: Colors.text.primary,
        fontSize: 16, fontWeight: '600',
        borderWidth: 1, borderColor: Colors.card.border,
    },

    browseBtn: {},
    browseBtnGradient: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        height: 48, borderRadius: 12, paddingHorizontal: 18,
    },
    browseBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

    browseHeader: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 12, marginTop: 4,
    },
    browseTitle: { color: Colors.text.primary, fontSize: 16, fontWeight: '700' },
    iconBtn: {
        width: 36, height: 36, borderRadius: 11,
        backgroundColor: Colors.card.background,
        justifyContent: 'center', alignItems: 'center',
        shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 1, shadowRadius: 4, elevation: 2,
    },

    // Analytics
    analyticsCard: {
        backgroundColor: Colors.accent.light, borderRadius: 16, padding: 16,
        marginBottom: 16, borderWidth: 1, borderColor: `${Colors.accent.start}15`,
    },
    analyticsSectionLabel: {
        color: Colors.text.tertiary, fontSize: 10, fontWeight: '700',
        letterSpacing: 1, marginBottom: 12,
    },
    heatmapGrid: { gap: 8, marginBottom: 14 },
    heatmapItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    heatmapLabel: { color: Colors.text.secondary, fontSize: 11, width: 70, fontWeight: '600' },
    heatmapBars: { flex: 1, gap: 3 },
    heatmapBarRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    heatmapBarLabel: { color: Colors.text.tertiary, fontSize: 9, width: 28 },
    heatmapBar: { height: 6, borderRadius: 3, minWidth: 4 },
    heatmapBarWant: { backgroundColor: Colors.primary.start },
    heatmapBarHave: { backgroundColor: Colors.accent.start },
    heatmapBarCount: { color: Colors.text.tertiary, fontSize: 9, width: 16 },
    analyticsStats: {
        flexDirection: 'row', justifyContent: 'space-around',
        borderTopWidth: 1, borderTopColor: Colors.divider,
        paddingTop: 12,
    },
    analyticsStat: { alignItems: 'center' },
    analyticsStatValue: { color: Colors.text.primary, fontSize: 18, fontWeight: '800' },
    analyticsStatLabel: { color: Colors.text.tertiary, fontSize: 10, marginTop: 2 },

    // Offer cards
    offerCard: {
        backgroundColor: Colors.card.background, borderRadius: 14,
        padding: 14, marginBottom: 8,
        shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 1, shadowRadius: 4, elevation: 2,
    },
    offerTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    offerIconBox: {
        width: 38, height: 38, borderRadius: 11,
        justifyContent: 'center', alignItems: 'center',
    },
    offerSeat: { color: Colors.text.primary, fontSize: 15, fontWeight: '700' },
    offerDetail: { color: Colors.text.secondary, fontSize: 12, marginTop: 2 },
    offerTime: { color: Colors.text.tertiary, fontSize: 11 },
    expiryText: { color: Colors.warning.start, fontSize: 10, marginTop: 2 },
    offerSwapVisual: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 8, marginTop: 10, paddingTop: 10,
        borderTopWidth: 1, borderTopColor: Colors.divider,
    },
    offerSwapChip: {
        backgroundColor: Colors.background.tertiary, borderRadius: 8,
        paddingHorizontal: 12, paddingVertical: 5,
    },
    offerSwapChipDesired: { backgroundColor: Colors.success.light },
    offerSwapChipText: { color: Colors.text.secondary, fontSize: 12, fontWeight: '600' },

    priorityBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
    priorityText: { fontSize: 10, fontWeight: '800' },

    emptyState: { alignItems: 'center', paddingVertical: 30, gap: 8 },
    emptyTitle: { color: Colors.text.secondary, fontSize: 14, fontWeight: '600' },
    emptySub: { color: Colors.text.tertiary, fontSize: 12 },

    registerToggle: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 8, paddingVertical: 16,
        borderTopWidth: 1, borderTopColor: Colors.divider,
        marginTop: 4, marginBottom: 8,
    },
    registerToggleText: { color: Colors.primary.start, fontSize: 14, fontWeight: '600' },

    typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    typeChip: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: Colors.background.tertiary, borderRadius: 12,
        paddingHorizontal: 14, paddingVertical: 11,
        borderWidth: 1.5, borderColor: Colors.card.border,
    },
    typeChipActive: {
        backgroundColor: Colors.primary.start, borderColor: Colors.primary.start,
    },
    typeChipDesired: {
        backgroundColor: Colors.success.start, borderColor: Colors.success.start,
    },
    reasonChipActive: {
        backgroundColor: Colors.accent.start, borderColor: Colors.accent.start,
    },
    typeChipText: { color: Colors.text.secondary, fontSize: 13, fontWeight: '600' },
    typeChipTextActive: { color: '#fff' },

    swapPreview: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        marginTop: 20, paddingTop: 18,
        borderTopWidth: 1, borderTopColor: Colors.divider,
        gap: 16,
    },
    swapSide: { alignItems: 'center' },
    swapLabel: { color: Colors.text.tertiary, fontSize: 11, marginBottom: 4 },
    swapValue: { color: Colors.text.primary, fontSize: 16, fontWeight: '800' },
    swapArrow: {
        width: 40, height: 40, borderRadius: 20,
        justifyContent: 'center', alignItems: 'center',
    },

    submitBtn: {
        flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
        paddingVertical: 16, borderRadius: 14, gap: 10,
    },
    submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

    successCard: {
        alignItems: 'center', padding: 24,
        backgroundColor: Colors.card.background, borderRadius: 16,
        marginBottom: 16,
        shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1, shadowRadius: 8, elevation: 2,
    },
    successIconBox: {
        width: 64, height: 64, borderRadius: 32,
        backgroundColor: Colors.success.light,
        justifyContent: 'center', alignItems: 'center', marginBottom: 14,
    },
    successTitle: { color: Colors.text.primary, fontSize: 20, fontWeight: '800', marginBottom: 8 },
    successDesc: { color: Colors.text.secondary, fontSize: 14, textAlign: 'center' },
    successMesh: {
        color: Colors.text.tertiary, fontSize: 12, textAlign: 'center',
        marginTop: 10, fontStyle: 'italic',
    },
    cancelBtn: {
        marginTop: 14, backgroundColor: Colors.danger.light, borderRadius: 10,
        paddingHorizontal: 20, paddingVertical: 8,
        borderWidth: 1, borderColor: `${Colors.danger.start}25`,
    },
    cancelBtnText: { color: Colors.danger.start, fontSize: 13, fontWeight: '600' },

    matchesSection: { marginBottom: 16 },
    matchCard: {
        backgroundColor: Colors.card.background, borderRadius: 14,
        padding: 14, marginBottom: 8, gap: 12,
        borderWidth: 1, borderColor: `${Colors.accent.start}15`,
        shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 1, shadowRadius: 4, elevation: 2,
    },
    matchHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    matchTypeBadge: {
        backgroundColor: Colors.accent.light, borderRadius: 6,
        paddingHorizontal: 8, paddingVertical: 3,
    },
    matchTypeText: { color: Colors.accent.start, fontSize: 10, fontWeight: '800' },
    matchCyclePath: { color: Colors.text.tertiary, fontSize: 11, flex: 1 },

    acceptBtn: {
        backgroundColor: Colors.success.start, borderRadius: 10,
        paddingHorizontal: 16, paddingVertical: 8,
    },
    acceptedBtn: { backgroundColor: Colors.background.tertiary },
    acceptBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

    newSwapBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 8, paddingVertical: 14,
    },
    newSwapText: { color: Colors.primary.start, fontSize: 14, fontWeight: '600' },

    notifBanner: {
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
        backgroundColor: Colors.success.start,
        paddingTop: Platform.OS === 'ios' ? 55 : 40,
        paddingBottom: 14, paddingHorizontal: 20,
        flexDirection: 'row', alignItems: 'center', gap: 10,
    },
    notifText: { color: '#fff', fontSize: 13, fontWeight: '600', flex: 1, lineHeight: 18 },
});
