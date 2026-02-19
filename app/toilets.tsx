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
import { getToiletStatus, reportToiletStatus, ToiletStatusData } from '../services/apiService';

export default function ToiletsScreen() {
    const [trainNo, setTrainNo] = useState('');
    const [coachId, setCoachId] = useState('');
    const [loading, setLoading] = useState(false);
    const [toilets, setToilets] = useState<ToiletStatusData[]>([]);
    const [searched, setSearched] = useState(false);
    const [showReport, setShowReport] = useState(false);
    const [reportType, setReportType] = useState<'WESTERN' | 'INDIAN'>('WESTERN');
    const [cleanliness, setCleanliness] = useState(3);
    const [waterAvail, setWaterAvail] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const fadeAnim = useState(new Animated.Value(0))[0];
    const [westernCount, setWesternCount] = useState(2);
    const [indianCount, setIndianCount] = useState(2);

    const handleSearch = async () => {
        if (!trainNo || !coachId) return;
        setLoading(true);
        setSearched(false);

        const data = await getToiletStatus(trainNo, coachId);
        setToilets(data);
        setSearched(true);
        setLoading(false);

        Animated.timing(fadeAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
        }).start();
    };

    const handleReport = async () => {
        setSubmitting(true);
        const result = await reportToiletStatus({
            trainNo,
            coachId,
            toiletType: reportType,
            cleanlinessScore: cleanliness,
            waterAvailable: waterAvail,
            queueLength: 0,
            westernCount,
            indianCount,
            reportedBy: 'device_' + Math.random().toString(36).substring(7),
        });

        setSubmitting(false);
        if (result.success) {
            Alert.alert('Thank You!', 'Your toilet report has been submitted.', [
                { text: 'OK', onPress: () => setShowReport(false) },
            ]);
            handleSearch(); // Refresh
        }
    };

    const renderStars = (score: number) => {
        const stars = [];
        for (let i = 1; i <= 5; i++) {
            stars.push(
                <Ionicons
                    key={i}
                    name={i <= Math.round(score) ? 'star' : 'star-outline'}
                    size={16}
                    color={score >= 3.5 ? Colors.success.end : score >= 2 ? Colors.warning.start : Colors.occupied}
                />
            );
        }
        return stars;
    };

    const renderStarPicker = () => {
        return (
            <View style={styles.starPicker}>
                {[1, 2, 3, 4, 5].map(i => (
                    <TouchableOpacity key={i} onPress={() => setCleanliness(i)}>
                        <Ionicons
                            name={i <= cleanliness ? 'star' : 'star-outline'}
                            size={28}
                            color={cleanliness >= 4 ? Colors.success.end : cleanliness >= 2 ? Colors.warning.start : Colors.occupied}
                        />
                    </TouchableOpacity>
                ))}
            </View>
        );
    };

    const getTimeSince = (timestamp: string) => {
        const mins = Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000);
        if (mins < 1) return 'Just now';
        if (mins < 60) return `${mins}m ago`;
        return `${Math.floor(mins / 60)}h ${mins % 60}m ago`;
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
                    <Text style={styles.headerTitle}>Toilet Status</Text>
                    <View style={{ width: 40 }} />
                </View>

                {/* Info Banner */}
                <View style={styles.infoBanner}>
                    <LinearGradient
                        colors={[Colors.success.start, Colors.success.end]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.infoGradient}
                    >
                        <MaterialCommunityIcons name="toilet" size={28} color="#fff" />
                        <View style={styles.infoContent}>
                            <Text style={styles.infoTitle}>Coach Toilet Tracker</Text>
                            <Text style={styles.infoDesc}>
                                Check cleanliness &amp; water availability. Help others by sharing reports!
                            </Text>
                        </View>
                    </LinearGradient>
                </View>

                {/* Search Form */}
                <View style={styles.searchCard}>
                    <View style={styles.searchRow}>
                        <View style={[styles.searchField, { flex: 1.2 }]}>
                            <Text style={styles.fieldLabel}>Train No.</Text>
                            <TextInput
                                style={styles.fieldInput}
                                placeholder="12301"
                                placeholderTextColor="rgba(255,255,255,0.25)"
                                value={trainNo}
                                onChangeText={setTrainNo}
                                keyboardType="number-pad"
                                maxLength={5}
                            />
                        </View>
                        <View style={[styles.searchField, { flex: 0.8 }]}>
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
                        <TouchableOpacity
                            onPress={handleSearch}
                            disabled={!trainNo || !coachId || loading}
                            style={[styles.searchBtn, (!trainNo || !coachId) && { opacity: 0.4 }]}
                        >
                            <LinearGradient
                                colors={[Colors.primary.start, Colors.primary.end]}
                                style={styles.searchBtnGradient}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#fff" size="small" />
                                ) : (
                                    <Ionicons name="search" size={20} color="#fff" />
                                )}
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Results */}
                {searched && (
                    <Animated.View style={{ opacity: fadeAnim }}>
                        {toilets.length > 0 ? (
                            <>
                                {/* Coach toilet summary */}
                                <View style={styles.toiletSummary}>
                                    <Text style={styles.summaryTitle}>Coach Toilet Info</Text>
                                    <View style={styles.summaryRow}>
                                        <View style={styles.summaryItem}>
                                            <MaterialCommunityIcons name="toilet" size={20} color={Colors.primary.start} />
                                            <Text style={styles.summaryCount}>2</Text>
                                            <Text style={styles.summaryLabel}>Western</Text>
                                        </View>
                                        <View style={styles.summaryDivider} />
                                        <View style={styles.summaryItem}>
                                            <MaterialCommunityIcons name="water-outline" size={20} color={Colors.accent.start} />
                                            <Text style={styles.summaryCount}>2</Text>
                                            <Text style={styles.summaryLabel}>Indian</Text>
                                        </View>
                                    </View>
                                </View>
                                {toilets.map((toilet) => (
                                    <View key={toilet.id} style={styles.toiletCard}>
                                        <View style={styles.toiletHeader}>
                                            <View style={styles.toiletTypeContainer}>
                                                <MaterialCommunityIcons
                                                    name={toilet.toiletType === 'WESTERN' ? 'toilet' : 'water-outline'}
                                                    size={22}
                                                    color={Colors.primary.start}
                                                />
                                                <Text style={styles.toiletType}>
                                                    {toilet.toiletType === 'WESTERN' ? 'Western' : 'Indian'} Toilet
                                                </Text>
                                            </View>
                                            <Text style={styles.toiletTime}>{getTimeSince(toilet.timestamp)}</Text>
                                        </View>

                                        <View style={styles.toiletStats}>
                                            {/* Cleanliness */}
                                            <View style={styles.toiletStat}>
                                                <Text style={styles.statLabel}>Cleanliness</Text>
                                                <View style={styles.starsRow}>{renderStars(toilet.cleanlinessScore)}</View>
                                                <Text style={styles.statScore}>{toilet.cleanlinessScore.toFixed(1)}/5</Text>
                                            </View>

                                            {/* Water */}
                                            <View style={styles.toiletStat}>
                                                <Text style={styles.statLabel}>Water</Text>
                                                <View style={[
                                                    styles.waterBadge,
                                                    { backgroundColor: toilet.waterAvailable ? 'rgba(56,239,125,0.15)' : 'rgba(244,92,67,0.15)' }
                                                ]}>
                                                    <Ionicons
                                                        name={toilet.waterAvailable ? 'water' : 'water-outline'}
                                                        size={16}
                                                        color={toilet.waterAvailable ? Colors.vacant : Colors.occupied}
                                                    />
                                                    <Text style={[
                                                        styles.waterText,
                                                        { color: toilet.waterAvailable ? Colors.vacant : Colors.occupied }
                                                    ]}>
                                                        {toilet.waterAvailable ? 'Available' : 'Not Available'}
                                                    </Text>
                                                </View>
                                            </View>
                                        </View>
                                    </View>
                                ))}
                            </>
                        ) : (
                            <View style={styles.noData}>
                                <MaterialCommunityIcons name="information-outline" size={40} color="rgba(255,255,255,0.15)" />
                                <Text style={styles.noDataText}>No reports yet for this coach</Text>
                                <Text style={styles.noDataSub}>Be the first to report!</Text>
                            </View>
                        )}

                        {/* Report Button */}
                        <TouchableOpacity
                            onPress={() => setShowReport(!showReport)}
                            style={styles.reportToggle}
                        >
                            <Ionicons
                                name={showReport ? 'chevron-up' : 'add-circle-outline'}
                                size={18}
                                color={Colors.success.end}
                            />
                            <Text style={styles.reportToggleText}>
                                {showReport ? 'Hide Report Form' : 'Submit a Report'}
                            </Text>
                        </TouchableOpacity>

                        {/* Report Form */}
                        {showReport && (
                            <View style={styles.reportForm}>
                                <Text style={styles.reportTitle}>Rate Toilet Condition</Text>

                                {/* Type selector */}
                                <View style={styles.typeRow}>
                                    <TouchableOpacity
                                        onPress={() => setReportType('WESTERN')}
                                        style={[styles.typeBtn, reportType === 'WESTERN' && styles.typeBtnActive]}
                                    >
                                        <MaterialCommunityIcons
                                            name="toilet"
                                            size={18}
                                            color={reportType === 'WESTERN' ? '#fff' : 'rgba(255,255,255,0.5)'}
                                        />
                                        <Text style={[styles.typeBtnText, reportType === 'WESTERN' && { color: '#fff' }]}>
                                            Western
                                        </Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => setReportType('INDIAN')}
                                        style={[styles.typeBtn, reportType === 'INDIAN' && styles.typeBtnActive]}
                                    >
                                        <MaterialCommunityIcons
                                            name="water-outline"
                                            size={18}
                                            color={reportType === 'INDIAN' ? '#fff' : 'rgba(255,255,255,0.5)'}
                                        />
                                        <Text style={[styles.typeBtnText, reportType === 'INDIAN' && { color: '#fff' }]}>
                                            Indian
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Cleanliness */}
                                <Text style={styles.reportLabel}>Cleanliness</Text>
                                {renderStarPicker()}

                                {/* Water */}
                                <Text style={styles.reportLabel}>Water Available?</Text>
                                <View style={styles.toggleRow}>
                                    <TouchableOpacity
                                        onPress={() => setWaterAvail(true)}
                                        style={[styles.toggleBtn, waterAvail && styles.toggleBtnYes]}
                                    >
                                        <Text style={[styles.toggleText, waterAvail && { color: '#fff' }]}>Yes</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => setWaterAvail(false)}
                                        style={[styles.toggleBtn, !waterAvail && styles.toggleBtnNo]}
                                    >
                                        <Text style={[styles.toggleText, !waterAvail && { color: '#fff' }]}>No</Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Toilet Count */}
                                <Text style={styles.reportLabel}>Toilets in this Coach</Text>
                                <View style={styles.countRow}>
                                    <View style={styles.countItem}>
                                        <Text style={styles.countLabel}>Western</Text>
                                        <View style={styles.stepper}>
                                            <TouchableOpacity
                                                onPress={() => setWesternCount(Math.max(0, westernCount - 1))}
                                                style={styles.stepBtn}
                                            >
                                                <Text style={styles.stepBtnText}>−</Text>
                                            </TouchableOpacity>
                                            <Text style={styles.stepValue}>{westernCount}</Text>
                                            <TouchableOpacity
                                                onPress={() => setWesternCount(Math.min(4, westernCount + 1))}
                                                style={styles.stepBtn}
                                            >
                                                <Text style={styles.stepBtnText}>+</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                    <View style={styles.countItem}>
                                        <Text style={styles.countLabel}>Indian</Text>
                                        <View style={styles.stepper}>
                                            <TouchableOpacity
                                                onPress={() => setIndianCount(Math.max(0, indianCount - 1))}
                                                style={styles.stepBtn}
                                            >
                                                <Text style={styles.stepBtnText}>−</Text>
                                            </TouchableOpacity>
                                            <Text style={styles.stepValue}>{indianCount}</Text>
                                            <TouchableOpacity
                                                onPress={() => setIndianCount(Math.min(4, indianCount + 1))}
                                                style={styles.stepBtn}
                                            >
                                                <Text style={styles.stepBtnText}>+</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>

                                <TouchableOpacity onPress={handleReport} disabled={submitting} activeOpacity={0.8}>
                                    <LinearGradient
                                        colors={[Colors.success.start, Colors.success.end]}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                        style={styles.submitBtn}
                                    >
                                        {submitting ? (
                                            <ActivityIndicator color="#fff" />
                                        ) : (
                                            <>
                                                <Ionicons name="send" size={16} color="#fff" />
                                                <Text style={styles.submitBtnText}>Submit Report</Text>
                                            </>
                                        )}
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        )}
                    </Animated.View>
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

    searchCard: {
        backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: 16,
        marginBottom: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    },
    searchRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 10 },
    searchField: {},
    fieldLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 11, marginBottom: 6 },
    fieldInput: {
        backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 10,
        paddingHorizontal: 12, height: 44, color: '#fff', fontSize: 16, fontWeight: '600',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    },
    searchBtn: {},
    searchBtnGradient: {
        width: 44, height: 44, borderRadius: 12,
        justifyContent: 'center', alignItems: 'center',
    },

    toiletCard: {
        backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: 16,
        marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    },
    toiletHeader: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 14,
    },
    toiletTypeContainer: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
    },
    toiletType: { color: '#fff', fontSize: 15, fontWeight: '700' },
    toiletTime: { color: 'rgba(255,255,255,0.4)', fontSize: 12 },

    toiletStats: { gap: 14 },
    toiletStat: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    },
    statLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 13 },
    starsRow: { flexDirection: 'row', gap: 3 },
    statScore: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },
    waterBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
    },
    waterText: { fontSize: 13, fontWeight: '600' },

    noData: {
        alignItems: 'center', paddingVertical: 30, gap: 8,
    },
    noDataText: { color: 'rgba(255,255,255,0.5)', fontSize: 14 },
    noDataSub: { color: 'rgba(255,255,255,0.3)', fontSize: 12 },

    reportToggle: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 8, paddingVertical: 14,
        borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
        marginTop: 4,
    },
    reportToggleText: { color: Colors.success.end, fontSize: 14, fontWeight: '600' },

    reportForm: {
        backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: 18,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    },
    reportTitle: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 16 },
    reportLabel: {
        color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: '600',
        marginBottom: 8, marginTop: 16,
    },

    typeRow: { flexDirection: 'row', gap: 10 },
    typeBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 8, paddingVertical: 12, borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    },
    typeBtnActive: { backgroundColor: Colors.primary.start, borderColor: Colors.primary.start },
    typeBtnText: { color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: '600' },

    starPicker: { flexDirection: 'row', gap: 8, justifyContent: 'center' },

    toggleRow: { flexDirection: 'row', gap: 10 },
    toggleBtn: {
        flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    },
    toggleBtnYes: { backgroundColor: Colors.success.start, borderColor: Colors.success.start },
    toggleBtnNo: { backgroundColor: Colors.occupied, borderColor: Colors.occupied },
    toggleText: { color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: '600' },

    submitBtn: {
        flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
        paddingVertical: 14, borderRadius: 12, gap: 8, marginTop: 20,
    },
    submitBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

    toiletSummary: {
        backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 16, padding: 16,
        marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    },
    summaryTitle: { color: 'rgba(255,255,255,0.5)', fontSize: 11, fontWeight: '700', letterSpacing: 1, marginBottom: 12 },
    summaryRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 24 },
    summaryItem: { alignItems: 'center', gap: 4 },
    summaryCount: { color: '#fff', fontSize: 22, fontWeight: '800' },
    summaryLabel: { color: 'rgba(255,255,255,0.5)', fontSize: 12 },
    summaryDivider: { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.1)' },

    countRow: { flexDirection: 'row', gap: 12 },
    countItem: { flex: 1, alignItems: 'center', gap: 8 },
    countLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 13, fontWeight: '600' },
    stepper: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
        backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 12, paddingHorizontal: 8, paddingVertical: 6,
    },
    stepBtn: {
        width: 32, height: 32, borderRadius: 8,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center', alignItems: 'center',
    },
    stepBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
    stepValue: { color: '#fff', fontSize: 18, fontWeight: '800', minWidth: 20, textAlign: 'center' },
});
