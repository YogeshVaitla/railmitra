import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    Platform,
    ActivityIndicator,
    Animated,
    Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Colors from '../constants/Colors';
import {
    createSwapRequest,
    findSwapMatches,
    acceptSwapRequest,
    browseSwapOffers,
} from '../services/apiService';

const SEAT_TYPES = [
    { id: 'LOWER', label: 'Lower', icon: 'bed-outline' },
    { id: 'MIDDLE', label: 'Middle', icon: 'reorder-three-outline' },
    { id: 'UPPER', label: 'Upper', icon: 'arrow-up-outline' },
    { id: 'SIDE_LOWER', label: 'Side Lower', icon: 'bed-outline' },
    { id: 'SIDE_UPPER', label: 'Side Upper', icon: 'arrow-up-outline' },
];

export default function SwapScreen() {
    const [trainNo, setTrainNo] = useState('');
    const [journeyDate, setJourneyDate] = useState(
        new Date().toISOString().split('T')[0]
    );

    // Browse state
    const [browseOffers, setBrowseOffers] = useState<any[]>([]);
    const [browseLoading, setBrowseLoading] = useState(false);
    const [hasBrowsed, setHasBrowsed] = useState(false);

    // Register form state
    const [showRegisterForm, setShowRegisterForm] = useState(false);
    const [coachId, setCoachId] = useState('');
    const [seatNo, setSeatNo] = useState('');
    const [currentType, setCurrentType] = useState('');
    const [desiredType, setDesiredType] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    // Matches (after registration)
    const [matches, setMatches] = useState<any[]>([]);
    const [matchLoading, setMatchLoading] = useState(false);
    const [acceptedIds, setAcceptedIds] = useState<number[]>([]);
    const [notification, setNotification] = useState<string | null>(null);
    const fadeAnim = useState(new Animated.Value(0))[0];

    const isFormValid = trainNo.length >= 4 && coachId && seatNo && currentType && desiredType && currentType !== desiredType;

    const handleBrowse = async () => {
        if (!trainNo || trainNo.length < 4) return;
        setBrowseLoading(true);
        setHasBrowsed(false);

        const result = await browseSwapOffers(trainNo, journeyDate);
        setBrowseOffers(result.offers || []);
        setHasBrowsed(true);
        setBrowseLoading(false);
    };

    const handleSubmit = async () => {
        if (!isFormValid) return;
        setLoading(true);

        const result = await createSwapRequest({
            trainNo,
            userId: 'device_' + Math.random().toString(36).substring(7),
            currentCoachId: coachId,
            currentSeatNo: parseInt(seatNo),
            currentSeatType: currentType,
            desiredSeatType: desiredType,
            journeyDate,
        });

        setLoading(false);
        if (result.success) {
            setSubmitted(true);
            setShowRegisterForm(false);
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 500,
                useNativeDriver: true,
            }).start();
            handleFindMatches();
        }
    };

    const handleFindMatches = async () => {
        setMatchLoading(true);
        const result = await findSwapMatches(trainNo, journeyDate, currentType, desiredType);
        setMatches(result.matches || []);
        setMatchLoading(false);
    };

    const handleAcceptSwap = (match: any) => {
        const seatInfo = match.otherCoachId
            ? `${match.otherCoachId}/${match.otherSeatNo}`
            : `${match.coachId}/${match.seatNo}`;
        const seatType = match.otherSeatType || match.currentSeatType;

        Alert.alert(
            'Confirm Swap',
            `Accept swap with ${seatInfo} (${getSeatTypeLabel(seatType)})? The other passenger will be notified.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Accept',
                    onPress: async () => {
                        const result = await acceptSwapRequest(match.id);
                        if (result.success) {
                            setAcceptedIds(prev => [...prev, match.id]);
                            setNotification(`✅ Swap accepted! ${seatInfo} (${getSeatTypeLabel(seatType)}) ↔ Your seat. The other passenger has been notified.`);
                            setTimeout(() => setNotification(null), 6000);
                        }
                    },
                },
            ]
        );
    };

    const getSeatTypeLabel = (type: string) => {
        return SEAT_TYPES.find(t => t.id === type)?.label || type;
    };

    const getTimeSince = (timestamp: string) => {
        const mins = Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
    };

    const handleReset = () => {
        setSubmitted(false);
        setShowRegisterForm(false);
        setHasBrowsed(false);
        setBrowseOffers([]);
        setTrainNo(''); setCoachId(''); setSeatNo('');
        setCurrentType(''); setDesiredType('');
        setMatches([]); setAcceptedIds([]);
        fadeAnim.setValue(0);
    };

    return (
        <LinearGradient colors={Colors.background.dark as any} style={styles.container}>
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
                        <Ionicons name="arrow-back" size={22} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Seat Swap</Text>
                    <View style={{ width: 40 }} />
                </View>

                {/* Info Banner */}
                <View style={styles.infoBanner}>
                    <LinearGradient
                        colors={[Colors.accent.start, Colors.accent.end]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.infoGradient}
                    >
                        <MaterialCommunityIcons name="swap-horizontal-bold" size={28} color="#fff" />
                        <View style={styles.infoContent}>
                            <Text style={styles.infoTitle}>P2P Seat Exchange</Text>
                            <Text style={styles.infoDesc}>
                                Enter your train number to see existing swap offers, or register your own!
                            </Text>
                        </View>
                    </LinearGradient>
                </View>

                {/* Step 1: Train Number + Browse */}
                <View style={styles.formCard}>
                    <Text style={styles.sectionLabel}>FIND SWAP OFFERS</Text>
                    <View style={styles.formRow}>
                        <View style={[styles.formField, { flex: 1 }]}>
                            <Text style={styles.fieldLabel}>Train No.</Text>
                            <TextInput
                                style={styles.fieldInput}
                                placeholder="12301"
                                placeholderTextColor="rgba(255,255,255,0.25)"
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
                                {browseOffers.length > 0
                                    ? `${browseOffers.length} Swap Offers Available`
                                    : 'No Swap Offers Yet'}
                            </Text>
                            <TouchableOpacity onPress={handleBrowse} style={styles.refreshBtn}>
                                <Ionicons name="refresh" size={16} color={Colors.primary.start} />
                            </TouchableOpacity>
                        </View>

                        {browseOffers.length > 0 ? (
                            browseOffers.map((offer, idx) => (
                                <View key={offer.id || idx} style={styles.offerCard}>
                                    <View style={styles.offerTop}>
                                        <LinearGradient
                                            colors={[Colors.accent.start, Colors.accent.end]}
                                            style={styles.offerIcon}
                                        >
                                            <MaterialCommunityIcons name="account-switch" size={18} color="#fff" />
                                        </LinearGradient>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.offerSeat}>
                                                {offer.coachId}/{offer.seatNo}
                                            </Text>
                                            <Text style={styles.offerDetail}>
                                                Has: {getSeatTypeLabel(offer.currentSeatType)} · Wants: {getSeatTypeLabel(offer.desiredSeatType)}
                                            </Text>
                                        </View>
                                        <Text style={styles.offerTime}>{getTimeSince(offer.createdAt)}</Text>
                                    </View>
                                    <View style={styles.offerSwapVisual}>
                                        <View style={styles.offerSwapChip}>
                                            <Text style={styles.offerSwapChipText}>{getSeatTypeLabel(offer.currentSeatType)}</Text>
                                        </View>
                                        <Ionicons name="arrow-forward" size={14} color="rgba(255,255,255,0.3)" />
                                        <View style={[styles.offerSwapChip, styles.offerSwapChipDesired]}>
                                            <Text style={[styles.offerSwapChipText, { color: Colors.success.end }]}>{getSeatTypeLabel(offer.desiredSeatType)}</Text>
                                        </View>
                                    </View>
                                </View>
                            ))
                        ) : (
                            <View style={styles.noOffers}>
                                <MaterialCommunityIcons name="swap-horizontal" size={40} color="rgba(255,255,255,0.12)" />
                                <Text style={styles.noOffersText}>No swap offers for this train yet</Text>
                                <Text style={styles.noOffersSub}>Be the first to register one!</Text>
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
                                        color={Colors.accent.end}
                                    />
                                    <Text style={styles.registerToggleText}>
                                        {showRegisterForm ? 'Hide Registration Form' : 'Register Your Swap Offer'}
                                    </Text>
                                </TouchableOpacity>

                                {showRegisterForm && (
                                    <View style={styles.formCard}>
                                        <Text style={styles.sectionLabel}>YOUR SEAT DETAILS</Text>
                                        <View style={styles.formRow}>
                                            <View style={[styles.formField, { flex: 1 }]}>
                                                <Text style={styles.fieldLabel}>Coach</Text>
                                                <TextInput
                                                    style={styles.fieldInput}
                                                    placeholder="B3"
                                                    placeholderTextColor="rgba(255,255,255,0.25)"
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
                                                    placeholderTextColor="rgba(255,255,255,0.25)"
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
                                                        color={currentType === type.id ? '#fff' : 'rgba(255,255,255,0.5)'}
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
                                                        color={desiredType === type.id ? '#fff' : 'rgba(255,255,255,0.5)'}
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

                                        {/* Visual swap indicator */}
                                        {currentType && desiredType && (
                                            <View style={styles.swapPreview}>
                                                <View style={styles.swapSide}>
                                                    <Text style={styles.swapLabel}>You Have</Text>
                                                    <Text style={styles.swapValue}>{getSeatTypeLabel(currentType)}</Text>
                                                </View>
                                                <LinearGradient
                                                    colors={[Colors.accent.start, Colors.accent.end]}
                                                    style={styles.swapArrow}
                                                >
                                                    <Ionicons name="swap-horizontal" size={20} color="#fff" />
                                                </LinearGradient>
                                                <View style={styles.swapSide}>
                                                    <Text style={styles.swapLabel}>You Want</Text>
                                                    <Text style={[styles.swapValue, { color: Colors.success.end }]}>
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
                                                        ? [Colors.accent.start, Colors.accent.end]
                                                        : ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']
                                                }
                                                start={{ x: 0, y: 0 }}
                                                end={{ x: 1, y: 0 }}
                                                style={[styles.submitBtn, !isFormValid && { opacity: 0.5 }]}
                                            >
                                                {loading ? (
                                                    <ActivityIndicator color="#fff" />
                                                ) : (
                                                    <>
                                                        <MaterialCommunityIcons name="swap-horizontal-bold" size={20} color="#fff" />
                                                        <Text style={styles.submitBtnText}>Register Swap Offer</Text>
                                                    </>
                                                )}
                                            </LinearGradient>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </>
                        )}

                        {/* After Registration: Success + Filtered Matches */}
                        {submitted && (
                            <Animated.View style={{ opacity: fadeAnim }}>
                                <View style={styles.successCard}>
                                    <LinearGradient
                                        colors={[Colors.success.start, Colors.success.end]}
                                        style={styles.successIcon}
                                    >
                                        <Ionicons name="checkmark-circle" size={32} color="#fff" />
                                    </LinearGradient>
                                    <Text style={styles.successTitle}>Swap Registered!</Text>
                                    <Text style={styles.successDesc}>
                                        {coachId}/{seatNo} ({getSeatTypeLabel(currentType)}) → Looking for {getSeatTypeLabel(desiredType)}
                                    </Text>
                                </View>

                                {/* Filtered Matches */}
                                <View style={styles.matchesSection}>
                                    <View style={styles.browseHeader}>
                                        <Text style={styles.browseTitle}>Your Matches</Text>
                                        <TouchableOpacity onPress={handleFindMatches} style={styles.refreshBtn}>
                                            <Ionicons name="refresh" size={16} color={Colors.primary.start} />
                                        </TouchableOpacity>
                                    </View>

                                    {matchLoading ? (
                                        <ActivityIndicator color={Colors.primary.start} style={{ marginVertical: 20 }} />
                                    ) : matches.length > 0 ? (
                                        matches.map((match, idx) => (
                                            <View key={match.id || idx} style={styles.offerCard}>
                                                <View style={styles.offerTop}>
                                                    <LinearGradient
                                                        colors={[Colors.primary.start, Colors.primary.end]}
                                                        style={styles.offerIcon}
                                                    >
                                                        <MaterialCommunityIcons name="account-switch" size={18} color="#fff" />
                                                    </LinearGradient>
                                                    <View style={{ flex: 1 }}>
                                                        <Text style={styles.offerSeat}>
                                                            {match.otherCoachId}/{match.otherSeatNo}
                                                        </Text>
                                                        <Text style={styles.offerDetail}>
                                                            Has: {getSeatTypeLabel(match.otherSeatType)} · Wants: {getSeatTypeLabel(match.desiredSeatType)}
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
                                            </View>
                                        ))
                                    ) : (
                                        <View style={styles.noOffers}>
                                            <MaterialCommunityIcons name="magnify-close" size={40} color="rgba(255,255,255,0.15)" />
                                            <Text style={styles.noOffersText}>No matching swaps yet</Text>
                                            <Text style={styles.noOffersSub}>Check back soon!</Text>
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
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: {
        paddingTop: Platform.OS === 'ios' ? 55 : 40,
        paddingBottom: 40, paddingHorizontal: 20,
    },
    header: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 20,
    },
    backBtn: {
        width: 40, height: 40, borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.08)',
        justifyContent: 'center', alignItems: 'center',
    },
    headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },

    infoBanner: { borderRadius: 16, overflow: 'hidden', marginBottom: 16 },
    infoGradient: {
        flexDirection: 'row', padding: 18, gap: 14, alignItems: 'center',
    },
    infoContent: { flex: 1 },
    infoTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 4 },
    infoDesc: { color: 'rgba(255,255,255,0.8)', fontSize: 12, lineHeight: 18 },

    formCard: {
        backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: 18,
        marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    },
    sectionLabel: {
        color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700',
        letterSpacing: 1, marginBottom: 12,
    },
    formRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-end' },
    formField: {},
    fieldLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 11, marginBottom: 6 },
    fieldInput: {
        backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 10,
        paddingHorizontal: 12, height: 44, color: '#fff', fontSize: 16, fontWeight: '600',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    },

    browseBtn: {},
    browseBtnGradient: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        height: 44, borderRadius: 12, paddingHorizontal: 16,
    },
    browseBtnText: { color: '#fff', fontSize: 14, fontWeight: '700' },

    browseHeader: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 12, marginTop: 4,
    },
    browseTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
    refreshBtn: {
        width: 32, height: 32, borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.08)',
        justifyContent: 'center', alignItems: 'center',
    },

    offerCard: {
        backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 14,
        padding: 14, marginBottom: 8,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    },
    offerTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    offerIcon: {
        width: 36, height: 36, borderRadius: 10,
        justifyContent: 'center', alignItems: 'center',
    },
    offerSeat: { color: '#fff', fontSize: 15, fontWeight: '700' },
    offerDetail: { color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 },
    offerTime: { color: 'rgba(255,255,255,0.3)', fontSize: 11 },
    offerSwapVisual: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 8, marginTop: 10, paddingTop: 10,
        borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
    },
    offerSwapChip: {
        backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 8,
        paddingHorizontal: 12, paddingVertical: 5,
    },
    offerSwapChipDesired: {
        backgroundColor: 'rgba(56,239,125,0.1)',
    },
    offerSwapChipText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600' },

    noOffers: {
        alignItems: 'center', paddingVertical: 30, gap: 8,
    },
    noOffersText: { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
    noOffersSub: { color: 'rgba(255,255,255,0.3)', fontSize: 12 },

    registerToggle: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 8, paddingVertical: 16,
        borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
        marginTop: 4, marginBottom: 8,
    },
    registerToggleText: { color: Colors.accent.end, fontSize: 14, fontWeight: '600' },

    typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    typeChip: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10,
        paddingHorizontal: 14, paddingVertical: 10,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    },
    typeChipActive: {
        backgroundColor: Colors.primary.start, borderColor: Colors.primary.start,
    },
    typeChipDesired: {
        backgroundColor: Colors.success.start, borderColor: Colors.success.start,
    },
    typeChipText: { color: 'rgba(255,255,255,0.5)', fontSize: 13, fontWeight: '600' },
    typeChipTextActive: { color: '#fff' },

    swapPreview: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        marginTop: 20, paddingTop: 18,
        borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
        gap: 16,
    },
    swapSide: { alignItems: 'center' },
    swapLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginBottom: 4 },
    swapValue: { color: '#fff', fontSize: 16, fontWeight: '800' },
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
        backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16,
        marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    },
    successIcon: {
        width: 64, height: 64, borderRadius: 32,
        justifyContent: 'center', alignItems: 'center', marginBottom: 14,
    },
    successTitle: { color: '#fff', fontSize: 20, fontWeight: '800', marginBottom: 8 },
    successDesc: { color: 'rgba(255,255,255,0.6)', fontSize: 14, textAlign: 'center' },

    matchesSection: { marginBottom: 16 },

    acceptBtn: {
        backgroundColor: Colors.success.start, borderRadius: 10,
        paddingHorizontal: 16, paddingVertical: 8,
    },
    acceptedBtn: {
        backgroundColor: 'rgba(255,255,255,0.15)',
    },
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
