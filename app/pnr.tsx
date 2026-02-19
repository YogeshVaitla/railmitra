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
import { parsePNR, getPNRAnalytics, PNRResult, PNRAnalytics, isUsingLiveAPI } from '../services/apiService';

export default function PNRScreen() {
    const [pnrInput, setPnrInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<PNRResult | null>(null);
    const [analytics, setAnalytics] = useState<PNRAnalytics | null>(null);
    const [error, setError] = useState('');
    const fadeAnim = useState(new Animated.Value(0))[0];

    const handleSearch = async () => {
        if (pnrInput.length < 10) {
            setError('Please enter a valid 10-digit PNR number');
            return;
        }
        setError('');
        setLoading(true);
        setResult(null);
        setAnalytics(null);

        const parsed = await parsePNR(pnrInput);
        if (parsed) {
            setResult(parsed);
            // Also fetch analytics for this train
            const trainAnalytics = await getPNRAnalytics(parsed.trainNo);
            setAnalytics(trainAnalytics);

            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 500,
                useNativeDriver: true,
            }).start();
        } else {
            setError('Could not parse PNR. Try pasting the full IRCTC SMS text.');
        }
        setLoading(false);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'CNF': return Colors.vacant;
            case 'WL': return Colors.waitlist;
            case 'RAC': return Colors.rac;
            case 'CHART_PREPARED': return Colors.chartPrepared;
            default: return Colors.text.secondary;
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case 'CNF': return 'Confirmed';
            case 'WL': return 'Waitlisted';
            case 'RAC': return 'RAC';
            case 'CHART_PREPARED': return 'Chart Prepared';
            default: return status;
        }
    };

    const getBerthLabel = (type: string) => {
        const map: Record<string, string> = {
            LB: 'Lower Berth', MB: 'Middle Berth', UB: 'Upper Berth',
            SL: 'Side Lower', SU: 'Side Upper',
        };
        return map[type] || type;
    };

    return (
        <LinearGradient colors={Colors.background.dark as any} style={styles.container}>
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
                    <Text style={styles.headerTitle}>PNR Search</Text>
                    <View style={styles.dataSourceBadge}>
                        <View style={[styles.dataSourceDot, { backgroundColor: isUsingLiveAPI() ? Colors.vacant : Colors.rac }]} />
                        <Text style={styles.dataSourceText}>{isUsingLiveAPI() ? 'Live' : 'Mock'}</Text>
                    </View>
                </View>

                {/* Info Card */}
                <View style={styles.infoCard}>
                    <LinearGradient
                        colors={[Colors.primary.start, Colors.primary.end]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.infoGradient}
                    >
                        <MaterialCommunityIcons name="ticket-confirmation-outline" size={32} color="#fff" />
                        <View style={styles.infoContent}>
                            <Text style={styles.infoTitle}>PNR Vacancy Tracker</Text>
                            <Text style={styles.infoDesc}>
                                Enter your PNR to check status. Your anonymized data helps everyone find vacant seats!
                            </Text>
                        </View>
                    </LinearGradient>
                </View>

                {/* PNR Input */}
                <View style={styles.inputCard}>
                    <Text style={styles.inputLabel}>PNR NUMBER</Text>
                    <View style={styles.inputRow}>
                        <Ionicons name="document-text-outline" size={20} color={Colors.primary.start} />
                        <TextInput
                            style={styles.input}
                            placeholder="Enter 10-digit PNR number"
                            placeholderTextColor="rgba(255,255,255,0.35)"
                            value={pnrInput}
                            onChangeText={(text) => {
                                setPnrInput(text.replace(/[^0-9]/g, ''));
                                setError('');
                            }}
                            keyboardType="number-pad"
                            maxLength={10}
                        />
                        {pnrInput.length > 0 && (
                            <TouchableOpacity onPress={() => { setPnrInput(''); setResult(null); setAnalytics(null); }}>
                                <Ionicons name="close-circle" size={20} color="rgba(255,255,255,0.5)" />
                            </TouchableOpacity>
                        )}
                    </View>

                    <Text style={styles.orText}>— or paste IRCTC SMS text —</Text>

                    <TextInput
                        style={styles.smsInput}
                        placeholder="Paste full IRCTC SMS here..."
                        placeholderTextColor="rgba(255,255,255,0.25)"
                        value={pnrInput.length > 10 ? pnrInput : ''}
                        onChangeText={setPnrInput}
                        multiline
                        numberOfLines={3}
                    />

                    {error ? <Text style={styles.errorText}>{error}</Text> : null}

                    <TouchableOpacity
                        onPress={handleSearch}
                        disabled={loading || pnrInput.length < 10}
                        activeOpacity={0.8}
                    >
                        <LinearGradient
                            colors={
                                pnrInput.length >= 10
                                    ? [Colors.primary.start, Colors.primary.end]
                                    : ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']
                            }
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={[styles.searchBtn, pnrInput.length < 10 && styles.searchBtnDisabled]}
                        >
                            {loading ? (
                                <ActivityIndicator color="#fff" size="small" />
                            ) : (
                                <>
                                    <Ionicons name="search" size={18} color="#fff" />
                                    <Text style={styles.searchBtnText}>Check PNR Status</Text>
                                </>
                            )}
                        </LinearGradient>
                    </TouchableOpacity>
                </View>

                {/* Results */}
                {result && (
                    <Animated.View style={{ opacity: fadeAnim }}>
                        {/* PNR Status Card */}
                        <View style={styles.resultCard}>
                            <View style={styles.resultHeader}>
                                <Text style={styles.resultTitle}>PNR Status</Text>
                                <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(result.status)}25` }]}>
                                    <View style={[styles.statusDot, { backgroundColor: getStatusColor(result.status) }]} />
                                    <Text style={[styles.statusText, { color: getStatusColor(result.status) }]}>
                                        {getStatusLabel(result.status)}
                                    </Text>
                                </View>
                            </View>

                            <View style={styles.resultGrid}>
                                <View style={styles.resultItem}>
                                    <Text style={styles.resultItemLabel}>Train</Text>
                                    <Text style={styles.resultItemValue}>{result.trainNo}</Text>
                                    {result.trainName && (
                                        <Text style={styles.resultItemSub}>{result.trainName}</Text>
                                    )}
                                </View>
                                <View style={styles.resultItem}>
                                    <Text style={styles.resultItemLabel}>Class</Text>
                                    <Text style={styles.resultItemValue}>{result.classType || 'N/A'}</Text>
                                </View>
                                <View style={styles.resultItem}>
                                    <Text style={styles.resultItemLabel}>Coach</Text>
                                    <Text style={styles.resultItemValue}>{result.coachId}</Text>
                                </View>
                                <View style={styles.resultItem}>
                                    <Text style={styles.resultItemLabel}>Berth</Text>
                                    <Text style={styles.resultItemValue}>{result.seatNo}</Text>
                                    <Text style={styles.resultItemSub}>{getBerthLabel(result.berthType)}</Text>
                                </View>
                            </View>

                            {result.journeyDate && (
                                <View style={styles.dateRow}>
                                    <Ionicons name="calendar-outline" size={14} color="rgba(255,255,255,0.6)" />
                                    <Text style={styles.dateText}>Journey: {result.journeyDate}</Text>
                                </View>
                            )}

                            {/* Privacy note */}
                            <View style={styles.privacyNote}>
                                <Ionicons name="shield-checkmark-outline" size={14} color={Colors.success.end} />
                                <Text style={styles.privacyText}>
                                    PNR hashed (SHA-256) — never stored in plain text
                                </Text>
                            </View>
                        </View>

                        {/* Vacancy Inference */}
                        {result.vacancyInference && (
                            <View style={styles.inferenceCard}>
                                <LinearGradient
                                    colors={[Colors.success.start, Colors.success.end]}
                                    style={styles.inferenceIcon}
                                >
                                    <Ionicons name="analytics" size={18} color="#fff" />
                                </LinearGradient>
                                <View style={styles.inferenceContent}>
                                    <Text style={styles.inferenceTitle}>Vacancy Inference</Text>
                                    <Text style={styles.inferenceText}>{result.vacancyInference}</Text>
                                </View>
                            </View>
                        )}

                        {/* Train Analytics */}
                        {analytics && (
                            <View style={styles.analyticsCard}>
                                <Text style={styles.analyticsTitle}>
                                    <Ionicons name="bar-chart" size={16} color={Colors.primary.start} />{' '}
                                    Train Vacancy Analytics
                                </Text>
                                <Text style={styles.analyticsSubtitle}>
                                    Based on {analytics.totalPNRsTracked} PNR lookups from users
                                </Text>

                                <View style={styles.analyticsGrid}>
                                    <View style={styles.analyticsItem}>
                                        <Text style={[styles.analyticsValue, { color: Colors.vacant }]}>
                                            {analytics.confirmedCount}
                                        </Text>
                                        <Text style={styles.analyticsLabel}>Confirmed</Text>
                                    </View>
                                    <View style={styles.analyticsItem}>
                                        <Text style={[styles.analyticsValue, { color: Colors.waitlist }]}>
                                            {analytics.waitlistCount}
                                        </Text>
                                        <Text style={styles.analyticsLabel}>Waitlist</Text>
                                    </View>
                                    <View style={styles.analyticsItem}>
                                        <Text style={[styles.analyticsValue, { color: Colors.rac }]}>
                                            {analytics.racCount}
                                        </Text>
                                        <Text style={styles.analyticsLabel}>RAC</Text>
                                    </View>
                                </View>

                                {/* Vacancy Bar */}
                                <View style={styles.vacancyBarContainer}>
                                    <View style={styles.vacancyBarHeader}>
                                        <Text style={styles.vacancyBarLabel}>Estimated Vacancy</Text>
                                        <Text style={[styles.vacancyBarValue, {
                                            color: analytics.vacancyPercentage > 30 ? Colors.vacant : Colors.occupied
                                        }]}>
                                            {analytics.vacancyPercentage}%
                                        </Text>
                                    </View>
                                    <View style={styles.vacancyBar}>
                                        <View
                                            style={[styles.vacancyBarFill, {
                                                width: `${analytics.vacancyPercentage}%`,
                                                backgroundColor: analytics.vacancyPercentage > 30 ? Colors.vacant : Colors.occupied,
                                            }]}
                                        />
                                    </View>
                                    <Text style={styles.vacancyEstimate}>
                                        ~{analytics.estimatedVacancy} of 800 seats may be vacant
                                    </Text>
                                </View>
                            </View>
                        )}
                    </Animated.View>
                )}

                {/* Demo hint */}
                <View style={styles.demoHint}>
                    <Ionicons name="bulb-outline" size={16} color={Colors.warning.start} />
                    <Text style={styles.demoHintText}>
                        Try PNR: 4521678901 or paste any text with a 10-digit number
                    </Text>
                </View>
            </ScrollView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: {
        paddingTop: Platform.OS === 'ios' ? 55 : 40,
        paddingBottom: 40,
        paddingHorizontal: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    backBtn: {
        width: 40, height: 40, borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.08)',
        justifyContent: 'center', alignItems: 'center',
    },
    headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
    dataSourceBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10,
        paddingHorizontal: 10, paddingVertical: 6,
    },
    dataSourceDot: { width: 8, height: 8, borderRadius: 4 },
    dataSourceText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontWeight: '600' },

    infoCard: { borderRadius: 16, overflow: 'hidden', marginBottom: 16 },
    infoGradient: {
        flexDirection: 'row', padding: 18, gap: 14, alignItems: 'center',
    },
    infoContent: { flex: 1 },
    infoTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 4 },
    infoDesc: { color: 'rgba(255,255,255,0.8)', fontSize: 12, lineHeight: 18 },

    inputCard: {
        backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: 18,
        marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    },
    inputLabel: {
        color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700',
        letterSpacing: 1, marginBottom: 10,
    },
    inputRow: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 12,
        paddingHorizontal: 14, height: 50, gap: 10,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    },
    input: { flex: 1, color: '#fff', fontSize: 18, fontWeight: '600', letterSpacing: 2 },
    orText: {
        color: 'rgba(255,255,255,0.3)', fontSize: 12, textAlign: 'center',
        marginVertical: 12,
    },
    smsInput: {
        backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 12,
        padding: 14, color: '#fff', fontSize: 13, minHeight: 70,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
        textAlignVertical: 'top',
    },
    errorText: { color: Colors.occupied, fontSize: 12, marginTop: 8 },
    searchBtn: {
        flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
        paddingVertical: 14, borderRadius: 12, gap: 8, marginTop: 14,
    },
    searchBtnDisabled: { opacity: 0.5 },
    searchBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

    resultCard: {
        backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: 18,
        marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    },
    resultHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        marginBottom: 16,
    },
    resultTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
    statusBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10,
    },
    statusDot: { width: 8, height: 8, borderRadius: 4 },
    statusText: { fontSize: 13, fontWeight: '700' },

    resultGrid: {
        flexDirection: 'row', flexWrap: 'wrap', gap: 12,
    },
    resultItem: {
        backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12,
        padding: 12, minWidth: '45%', flex: 1,
    },
    resultItemLabel: {
        color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '600',
        letterSpacing: 0.5, marginBottom: 4,
    },
    resultItemValue: { color: '#fff', fontSize: 18, fontWeight: '800' },
    resultItemSub: { color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 2 },

    dateRow: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        marginTop: 14, paddingTop: 14,
        borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)',
    },
    dateText: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },

    privacyNote: {
        flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12,
    },
    privacyText: { color: 'rgba(255,255,255,0.4)', fontSize: 11 },

    inferenceCard: {
        flexDirection: 'row', alignItems: 'flex-start',
        backgroundColor: 'rgba(17, 153, 142, 0.12)', borderRadius: 14,
        padding: 14, marginBottom: 12, gap: 12,
        borderWidth: 1, borderColor: 'rgba(56, 239, 125, 0.15)',
    },
    inferenceIcon: {
        width: 36, height: 36, borderRadius: 10,
        justifyContent: 'center', alignItems: 'center',
    },
    inferenceContent: { flex: 1 },
    inferenceTitle: { color: Colors.success.end, fontSize: 13, fontWeight: '700', marginBottom: 4 },
    inferenceText: { color: 'rgba(255,255,255,0.7)', fontSize: 12, lineHeight: 18 },

    analyticsCard: {
        backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: 18,
        marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    },
    analyticsTitle: { color: '#fff', fontSize: 15, fontWeight: '700', marginBottom: 4 },
    analyticsSubtitle: { color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 16 },
    analyticsGrid: {
        flexDirection: 'row', justifyContent: 'space-around', marginBottom: 18,
    },
    analyticsItem: { alignItems: 'center' },
    analyticsValue: { fontSize: 24, fontWeight: '800' },
    analyticsLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 4 },

    vacancyBarContainer: { marginTop: 4 },
    vacancyBarHeader: {
        flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8,
    },
    vacancyBarLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 13 },
    vacancyBarValue: { fontSize: 16, fontWeight: '800' },
    vacancyBar: {
        height: 8, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 4,
        overflow: 'hidden',
    },
    vacancyBarFill: { height: '100%', borderRadius: 4 },
    vacancyEstimate: {
        color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 6, textAlign: 'center',
    },

    demoHint: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        justifyContent: 'center', marginTop: 8, paddingVertical: 12,
    },
    demoHintText: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },
});
