import React, { useEffect, useState, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    Animated,
    Platform,
    Dimensions,
    ActivityIndicator,
    Modal,
    TextInput,
    Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import Colors from '../constants/Colors';
import { Train, TrainClassAvailability, Coach } from '../models/types';
import { searchTrain, reportSeat } from '../services/apiService';
import { addRecentSearch } from '../services/favoritesService';
import { addFavorite, isFavorite as checkFavorite } from '../services/favoritesService';
import { t } from '../services/localization';

const { width } = Dimensions.get('window');

export default function ResultsScreen() {
    const params = useLocalSearchParams<{
        trainNumber: string;
        journeyDate: string;
        fromStation: string;
        toStation: string;
        fromStationName: string;
        toStationName: string;
    }>();

    const [train, setTrain] = useState<Train | null>(null);
    const [loading, setLoading] = useState(true);
    const [selectedClass, setSelectedClass] = useState<string>('');
    const [expandedCoach, setExpandedCoach] = useState<string>('');
    const [isFav, setIsFav] = useState(false);
    const [showReportModal, setShowReportModal] = useState(false);
    const [reportCoach, setReportCoach] = useState('');
    const [reportBerth, setReportBerth] = useState('');
    const [reportStatus, setReportStatus] = useState<'EMPTY' | 'OCCUPIED'>('EMPTY');
    const [reportSubmitting, setReportSubmitting] = useState(false);

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(30)).current;

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setLoading(true);

        const result = await searchTrain({
            trainNumber: params.trainNumber!,
            journeyDate: params.journeyDate!,
            fromStation: params.fromStation!,
            toStation: params.toStation!,
        });

        if (result) {
            setTrain(result);
            if (result.classes.length > 0) {
                setSelectedClass(result.classes[0].className);
            }

            // Save to recent searches
            await addRecentSearch({
                trainNumber: params.trainNumber!,
                trainName: result.trainName,
                fromStation: params.fromStation!,
                fromStationName: params.fromStationName!,
                toStation: params.toStation!,
                toStationName: params.toStationName!,
                date: params.journeyDate!,
                searchedAt: new Date().toISOString(),
            });

            // Check if favorite
            const fav = await checkFavorite(params.trainNumber!, params.fromStation!, params.toStation!);
            setIsFav(fav);
        }

        setLoading(false);

        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 500,
                useNativeDriver: true,
            }),
            Animated.spring(slideAnim, {
                toValue: 0,
                tension: 60,
                friction: 10,
                useNativeDriver: true,
            }),
        ]).start();
    };

    const handleToggleFavorite = async () => {
        if (!train) return;
        if (!isFav) {
            await addFavorite({
                id: `${train.trainNumber}-${params.fromStation}-${params.toStation}`,
                trainNumber: train.trainNumber,
                trainName: train.trainName,
                fromStation: params.fromStation!,
                fromStationName: params.fromStationName!,
                toStation: params.toStation!,
                toStationName: params.toStationName!,
                savedAt: new Date().toISOString(),
            });
            setIsFav(true);
        }
    };

    const getSelectedClassData = (): TrainClassAvailability | undefined => {
        return train?.classes.find((c) => c.className === selectedClass);
    };

    const getVacancyPercentage = (cls: TrainClassAvailability): number => {
        if (cls.totalSeats === 0) return 0;
        return Math.round((cls.vacantSeats / cls.totalSeats) * 100);
    };

    const getVacancyColor = (percentage: number): string => {
        if (percentage > 40) return Colors.vacant;
        if (percentage > 15) return Colors.warning.start;
        return Colors.occupied;
    };

    if (loading) {
        return (
            <LinearGradient colors={Colors.background.dark as any} style={styles.container}>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={Colors.primary.start} />
                    <Text style={styles.loadingText}>{t('searching')}</Text>
                    <Text style={styles.loadingSubtext}>Fetching chart data...</Text>
                </View>
            </LinearGradient>
        );
    }

    if (!train) {
        return (
            <LinearGradient colors={Colors.background.dark as any} style={styles.container}>
                <View style={styles.errorContainer}>
                    <MaterialCommunityIcons name="train-variant" size={64} color="rgba(255,255,255,0.2)" />
                    <Text style={styles.errorTitle}>{t('trainNotFound')}</Text>
                    <Text style={styles.errorText}>Could not find train {params.trainNumber}. Please check the train number and try again.</Text>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtnError}>
                        <Text style={styles.backBtnText}>Go Back</Text>
                    </TouchableOpacity>
                </View>
            </LinearGradient>
        );
    }

    const selectedClassData = getSelectedClassData();

    return (
        <LinearGradient colors={Colors.background.dark as any} style={styles.container}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={22} color="#fff" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{t('results')}</Text>
                    <TouchableOpacity onPress={handleToggleFavorite} style={styles.favBtn}>
                        <Ionicons
                            name={isFav ? 'heart' : 'heart-outline'}
                            size={22}
                            color={isFav ? Colors.danger.end : '#fff'}
                        />
                    </TouchableOpacity>
                </View>

                {/* Train Info Card */}
                <Animated.View
                    style={[
                        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
                    ]}
                >
                    <LinearGradient
                        colors={[Colors.primary.start, Colors.primary.end]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.trainCard}
                    >
                        <View style={styles.trainBadge}>
                            <Text style={styles.trainType}>{train.trainType}</Text>
                        </View>
                        <Text style={styles.trainName}>{train.trainName}</Text>
                        <Text style={styles.trainNumber}>#{train.trainNumber}</Text>

                        <View style={styles.routeContainer}>
                            <View style={styles.routeEnd}>
                                <View style={[styles.routeDot, { backgroundColor: Colors.success.end }]} />
                                <Text style={styles.routeStation}>{params.fromStation}</Text>
                                <Text style={styles.routeStationName}>{params.fromStationName}</Text>
                            </View>
                            <View style={styles.routeLine}>
                                <View style={styles.routeLineDash} />
                                <MaterialCommunityIcons name="train" size={20} color="rgba(255,255,255,0.8)" />
                                <View style={styles.routeLineDash} />
                            </View>
                            <View style={styles.routeEnd}>
                                <View style={[styles.routeDot, { backgroundColor: Colors.danger.end }]} />
                                <Text style={styles.routeStation}>{params.toStation}</Text>
                                <Text style={styles.routeStationName}>{params.toStationName}</Text>
                            </View>
                        </View>

                        <View style={styles.trainMeta}>
                            <View style={styles.trainMetaItem}>
                                <Ionicons name="calendar-outline" size={14} color="rgba(255,255,255,0.8)" />
                                <Text style={styles.trainMetaText}>{params.journeyDate}</Text>
                            </View>
                            <View style={styles.chartBadge}>
                                <View
                                    style={[
                                        styles.chartDot,
                                        {
                                            backgroundColor:
                                                train.chartStatus === 'PREPARED'
                                                    ? Colors.chartPrepared
                                                    : Colors.chartNotPrepared,
                                        },
                                    ]}
                                />
                                <Text style={styles.chartText}>
                                    {train.chartStatus === 'PREPARED' ? t('chartPrepared') : t('chartNotPrepared')}
                                </Text>
                            </View>
                        </View>
                    </LinearGradient>
                </Animated.View>

                {/* Route Link */}
                <TouchableOpacity
                    style={styles.routeLink}
                    onPress={() =>
                        router.push({
                            pathname: '/route',
                            params: {
                                trainNumber: train.trainNumber,
                                trainName: train.trainName,
                                fromStation: params.fromStation,
                                toStation: params.toStation,
                                routeData: JSON.stringify(train.route),
                            },
                        })
                    }
                >
                    <Ionicons name="map-outline" size={18} color={Colors.primary.start} />
                    <Text style={styles.routeLinkText}>{t('trainRoute')}</Text>
                    <Ionicons name="chevron-forward" size={16} color="rgba(255,255,255,0.4)" />
                </TouchableOpacity>

                {/* Class Tabs */}
                <Animated.View style={{ opacity: fadeAnim }}>
                    <Text style={styles.sectionTitle}>{t('availableClasses')}</Text>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.classTabs}
                    >
                        {train.classes.map((cls) => {
                            const pct = getVacancyPercentage(cls);
                            const isSelected = cls.className === selectedClass;
                            return (
                                <TouchableOpacity
                                    key={cls.className}
                                    onPress={() => {
                                        setSelectedClass(cls.className);
                                        setExpandedCoach('');
                                    }}
                                >
                                    <LinearGradient
                                        colors={
                                            isSelected
                                                ? [Colors.primary.start, Colors.primary.end]
                                                : ['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.04)']
                                        }
                                        style={[
                                            styles.classTab,
                                            isSelected && styles.classTabSelected,
                                        ]}
                                    >
                                        <Text
                                            style={[
                                                styles.classTabName,
                                                isSelected && styles.classTabNameSelected,
                                            ]}
                                        >
                                            {cls.className}
                                        </Text>
                                        <Text
                                            style={[
                                                styles.classTabCount,
                                                { color: getVacancyColor(pct) },
                                            ]}
                                        >
                                            {cls.vacantSeats} {t('vacant').toLowerCase()}
                                        </Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </Animated.View>

                {/* Selected Class Summary */}
                {selectedClassData && (
                    <Animated.View style={{ opacity: fadeAnim }}>
                        <View style={styles.summaryCard}>
                            <Text style={styles.summaryTitle}>{selectedClassData.classFullName}</Text>
                            <View style={styles.summaryStats}>
                                <View style={styles.statItem}>
                                    <Text style={styles.statValue}>{selectedClassData.totalSeats}</Text>
                                    <Text style={styles.statLabel}>{t('totalSeats')}</Text>
                                </View>
                                <View style={styles.statDivider} />
                                <View style={styles.statItem}>
                                    <Text style={[styles.statValue, { color: Colors.vacant }]}>
                                        {selectedClassData.vacantSeats}
                                    </Text>
                                    <Text style={styles.statLabel}>{t('vacant')}</Text>
                                </View>
                                <View style={styles.statDivider} />
                                <View style={styles.statItem}>
                                    <Text style={[styles.statValue, { color: Colors.occupied }]}>
                                        {selectedClassData.totalSeats - selectedClassData.vacantSeats}
                                    </Text>
                                    <Text style={styles.statLabel}>{t('occupied')}</Text>
                                </View>
                            </View>

                            {/* Progress Bar */}
                            <View style={styles.progressBar}>
                                <View
                                    style={[
                                        styles.progressFill,
                                        {
                                            width: `${getVacancyPercentage(selectedClassData)}%`,
                                            backgroundColor: getVacancyColor(
                                                getVacancyPercentage(selectedClassData)
                                            ),
                                        },
                                    ]}
                                />
                            </View>
                            <Text style={styles.progressText}>
                                {getVacancyPercentage(selectedClassData)}% seats available
                            </Text>
                        </View>

                        {/* Coach List */}
                        <Text style={styles.sectionTitle}>{t('coachDetails')}</Text>
                        {selectedClassData.coaches.map((coach) => (
                            <CoachCard
                                key={coach.coachName}
                                coach={coach}
                                expanded={expandedCoach === coach.coachName}
                                onToggle={() =>
                                    setExpandedCoach(
                                        expandedCoach === coach.coachName ? '' : coach.coachName
                                    )
                                }
                                fromStation={params.fromStation!}
                                toStation={params.toStation!}
                                onReportSeat={(coachName) => {
                                    setReportCoach(coachName);
                                    setReportBerth('');
                                    setReportStatus('EMPTY');
                                    setShowReportModal(true);
                                }}
                            />
                        ))}
                    </Animated.View>
                )}
            </ScrollView>

            {/* Report Seat Modal */}
            <Modal
                visible={showReportModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowReportModal(false)}
            >
                <TouchableOpacity
                    style={styles.reportModalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowReportModal(false)}
                >
                    <TouchableOpacity activeOpacity={1} style={styles.reportModalCard}>
                        <LinearGradient
                            colors={Colors.background.dark as any}
                            style={styles.reportModalGradient}
                        >
                            <Text style={styles.reportModalTitle}>Report Seat Status</Text>
                            <Text style={styles.reportModalSub}>
                                Coach {reportCoach} — Help others by reporting seat status
                            </Text>

                            <View style={styles.reportField}>
                                <Text style={styles.reportFieldLabel}>BERTH NUMBER</Text>
                                <TextInput
                                    style={styles.reportInput}
                                    placeholder="e.g. 42"
                                    placeholderTextColor="rgba(255,255,255,0.3)"
                                    value={reportBerth}
                                    onChangeText={setReportBerth}
                                    keyboardType="number-pad"
                                    maxLength={3}
                                />
                            </View>

                            <View style={styles.reportField}>
                                <Text style={styles.reportFieldLabel}>STATUS</Text>
                                <View style={styles.reportStatusRow}>
                                    <TouchableOpacity
                                        onPress={() => setReportStatus('EMPTY')}
                                        style={[
                                            styles.reportStatusBtn,
                                            reportStatus === 'EMPTY' && { backgroundColor: Colors.vacant, borderColor: Colors.vacant },
                                        ]}
                                    >
                                        <Ionicons name="checkmark-circle" size={18} color={reportStatus === 'EMPTY' ? '#fff' : 'rgba(255,255,255,0.4)'} />
                                        <Text style={[styles.reportStatusText, reportStatus === 'EMPTY' && { color: '#fff' }]}>Empty</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => setReportStatus('OCCUPIED')}
                                        style={[
                                            styles.reportStatusBtn,
                                            reportStatus === 'OCCUPIED' && { backgroundColor: Colors.occupied, borderColor: Colors.occupied },
                                        ]}
                                    >
                                        <Ionicons name="close-circle" size={18} color={reportStatus === 'OCCUPIED' ? '#fff' : 'rgba(255,255,255,0.4)'} />
                                        <Text style={[styles.reportStatusText, reportStatus === 'OCCUPIED' && { color: '#fff' }]}>Occupied</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>

                            <View style={styles.reportActions}>
                                <TouchableOpacity
                                    onPress={() => setShowReportModal(false)}
                                    style={styles.reportCancelBtn}
                                >
                                    <Text style={styles.reportCancelText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={async () => {
                                        if (!reportBerth) return;
                                        setReportSubmitting(true);
                                        const result = await reportSeat({
                                            seatId: parseInt(reportBerth),
                                            status: reportStatus,
                                            deviceId: 'device_' + Math.random().toString(36).substring(7),
                                        });
                                        setReportSubmitting(false);
                                        setShowReportModal(false);
                                        if (result.success) {
                                            Alert.alert('Thank You!', `Seat ${reportCoach}/${reportBerth} reported as ${reportStatus}`);
                                        }
                                    }}
                                    disabled={!reportBerth || reportSubmitting}
                                >
                                    <LinearGradient
                                        colors={[Colors.primary.start, Colors.primary.end]}
                                        style={[styles.reportSubmitBtn, !reportBerth && { opacity: 0.4 }]}
                                    >
                                        {reportSubmitting ? (
                                            <ActivityIndicator color="#fff" size="small" />
                                        ) : (
                                            <Text style={styles.reportSubmitText}>Submit Report</Text>
                                        )}
                                    </LinearGradient>
                                </TouchableOpacity>
                            </View>
                        </LinearGradient>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>
        </LinearGradient>
    );
}

function CoachCard({
    coach,
    expanded,
    onToggle,
    fromStation,
    toStation,
    onReportSeat,
}: {
    coach: Coach;
    expanded: boolean;
    onToggle: () => void;
    fromStation: string;
    toStation: string;
    onReportSeat: (coachName: string) => void;
}) {
    const vacantForJourney = coach.vacantBerths.filter(
        (b) => b.fromStation === fromStation && b.toStation === toStation
    );
    const vacantPartial = coach.vacantBerths.filter(
        (b) => !(b.fromStation === fromStation && b.toStation === toStation)
    );

    return (
        <View style={styles.coachCard}>
            <TouchableOpacity onPress={onToggle} style={styles.coachHeader} activeOpacity={0.7}>
                <View style={styles.coachLeft}>
                    <LinearGradient
                        colors={[Colors.primary.start, Colors.primary.end]}
                        style={styles.coachIcon}
                    >
                        <MaterialCommunityIcons name="train-car" size={18} color="#fff" />
                    </LinearGradient>
                    <View>
                        <Text style={styles.coachName}>{t('coach')} {coach.coachName}</Text>
                        <Text style={styles.coachSubtext}>
                            {coach.vacantBerths.length} / {coach.totalBerths} {t('vacant').toLowerCase()}
                        </Text>
                    </View>
                </View>
                <View style={styles.coachRight}>
                    <View
                        style={[
                            styles.vacantBadge,
                            {
                                backgroundColor:
                                    coach.vacantBerths.length > 10
                                        ? 'rgba(56, 239, 125, 0.15)'
                                        : coach.vacantBerths.length > 3
                                            ? 'rgba(242, 201, 76, 0.15)'
                                            : 'rgba(244, 92, 67, 0.15)',
                            },
                        ]}
                    >
                        <Text
                            style={[
                                styles.vacantBadgeText,
                                {
                                    color:
                                        coach.vacantBerths.length > 10
                                            ? Colors.vacant
                                            : coach.vacantBerths.length > 3
                                                ? Colors.warning.start
                                                : Colors.occupied,
                                },
                            ]}
                        >
                            {coach.vacantBerths.length}
                        </Text>
                    </View>
                    <Ionicons
                        name={expanded ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color="rgba(255,255,255,0.5)"
                    />
                </View>
            </TouchableOpacity>

            {expanded && (
                <View style={styles.coachBody}>
                    {/* Full journey vacancies */}
                    {vacantForJourney.length > 0 && (
                        <View style={styles.berthSection}>
                            <View style={styles.berthSectionHeader}>
                                <View style={[styles.sectionDot, { backgroundColor: Colors.vacant }]} />
                                <Text style={styles.berthSectionTitle}>
                                    Full Journey ({fromStation} → {toStation})
                                </Text>
                            </View>
                            <View style={styles.berthGrid}>
                                {vacantForJourney.map((berth) => (
                                    <View key={`${berth.coachName}-${berth.berthNumber}`} style={styles.berthChip}>
                                        <Text style={styles.berthNumber}>{berth.berthNumber}</Text>
                                        <Text style={styles.berthTypeText}>{berth.berthType}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}

                    {/* Partial vacancies */}
                    {vacantPartial.length > 0 && (
                        <View style={styles.berthSection}>
                            <View style={styles.berthSectionHeader}>
                                <View style={[styles.sectionDot, { backgroundColor: Colors.warning.start }]} />
                                <Text style={styles.berthSectionTitle}>Partial Segment</Text>
                            </View>
                            <View style={styles.berthGrid}>
                                {vacantPartial.map((berth) => (
                                    <View
                                        key={`${berth.coachName}-${berth.berthNumber}`}
                                        style={[styles.berthChip, styles.berthChipPartial]}
                                    >
                                        <Text style={styles.berthNumber}>{berth.berthNumber}</Text>
                                        <Text style={styles.berthTypeText}>{berth.berthType}</Text>
                                        <Text style={styles.berthSegment}>
                                            {berth.fromStation}→{berth.toStation}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}

                    {coach.vacantBerths.length === 0 && (
                        <Text style={styles.noVacancy}>No vacant berths in this coach</Text>
                    )}

                    {/* Legend */}
                    <View style={styles.legend}>
                        <Text style={styles.legendTitle}>Berth Types:</Text>
                        <View style={styles.legendItems}>
                            {['LB - Lower', 'MB - Middle', 'UB - Upper', 'SL - Side Lower', 'SU - Side Upper'].map(
                                (item) => (
                                    <Text key={item} style={styles.legendItem}>
                                        {item}
                                    </Text>
                                )
                            )}
                        </View>
                    </View>

                    {/* Report Seat Button */}
                    <TouchableOpacity
                        onPress={() => onReportSeat(coach.coachName)}
                        style={styles.reportSeatBtn}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="flag-outline" size={15} color={Colors.primary.start} />
                        <Text style={styles.reportSeatText}>Report Seat Status</Text>
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        paddingTop: Platform.OS === 'ios' ? 55 : 40,
        paddingBottom: 40,
        paddingHorizontal: 20,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        gap: 12,
    },
    loadingText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
    },
    loadingSubtext: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 13,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
        gap: 12,
    },
    errorTitle: {
        color: '#fff',
        fontSize: 20,
        fontWeight: '700',
        marginTop: 8,
    },
    errorText: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 20,
    },
    backBtnError: {
        marginTop: 20,
        backgroundColor: Colors.primary.start,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 12,
    },
    backBtnText: {
        color: '#fff',
        fontWeight: '600',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.08)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
    favBtn: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.08)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    trainCard: {
        borderRadius: 20,
        padding: 20,
        marginBottom: 12,
    },
    trainBadge: {
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 4,
        marginBottom: 8,
    },
    trainType: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    trainName: {
        color: '#fff',
        fontSize: 22,
        fontWeight: '800',
    },
    trainNumber: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 14,
        marginBottom: 16,
    },
    routeContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
    },
    routeEnd: {
        alignItems: 'center',
        flex: 1,
    },
    routeDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
        marginBottom: 6,
    },
    routeStation: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '800',
    },
    routeStationName: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 11,
        marginTop: 2,
    },
    routeLine: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1.5,
        gap: 4,
    },
    routeLineDash: {
        flex: 1,
        height: 2,
        backgroundColor: 'rgba(255,255,255,0.25)',
        borderStyle: 'dashed',
    },
    trainMeta: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    trainMetaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    trainMetaText: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 13,
    },
    chartBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 5,
    },
    chartDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    chartText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: '600',
    },
    routeLink: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: 12,
        padding: 14,
        marginBottom: 20,
        gap: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
    },
    routeLinkText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
        flex: 1,
    },
    sectionTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 12,
        marginTop: 4,
    },
    classTabs: {
        gap: 10,
        paddingBottom: 16,
    },
    classTab: {
        borderRadius: 14,
        paddingHorizontal: 18,
        paddingVertical: 12,
        alignItems: 'center',
        minWidth: 80,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    classTabSelected: {
        borderColor: 'transparent',
    },
    classTabName: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 16,
        fontWeight: '800',
    },
    classTabNameSelected: {
        color: '#fff',
    },
    classTabCount: {
        fontSize: 11,
        fontWeight: '600',
        marginTop: 2,
    },
    summaryCard: {
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: 16,
        padding: 18,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
    },
    summaryTitle: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 14,
    },
    summaryStats: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        marginBottom: 16,
    },
    statItem: {
        alignItems: 'center',
    },
    statValue: {
        color: '#fff',
        fontSize: 26,
        fontWeight: '800',
    },
    statLabel: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 12,
        marginTop: 4,
    },
    statDivider: {
        width: 1,
        height: 30,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    progressBar: {
        height: 6,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressFill: {
        height: '100%',
        borderRadius: 3,
    },
    progressText: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 11,
        textAlign: 'right',
        marginTop: 6,
    },
    // Coach Card
    coachCard: {
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: 14,
        marginBottom: 10,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
    },
    coachHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 14,
    },
    coachLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    coachIcon: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    coachName: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '700',
    },
    coachSubtext: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 12,
        marginTop: 2,
    },
    coachRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    vacantBadge: {
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 4,
    },
    vacantBadgeText: {
        fontSize: 14,
        fontWeight: '800',
    },
    coachBody: {
        padding: 14,
        paddingTop: 0,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.06)',
    },
    berthSection: {
        marginTop: 12,
    },
    berthSectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8,
    },
    sectionDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    berthSectionTitle: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 13,
        fontWeight: '600',
    },
    berthGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    berthChip: {
        backgroundColor: 'rgba(56, 239, 125, 0.1)',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: 'rgba(56, 239, 125, 0.2)',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    berthChipPartial: {
        backgroundColor: 'rgba(242, 201, 76, 0.1)',
        borderColor: 'rgba(242, 201, 76, 0.2)',
        flexDirection: 'column',
        alignItems: 'flex-start',
    },
    berthNumber: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
    },
    berthTypeText: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 10,
        fontWeight: '600',
    },
    berthSegment: {
        color: Colors.warning.start,
        fontSize: 9,
        fontWeight: '600',
    },
    noVacancy: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 13,
        textAlign: 'center',
        paddingVertical: 16,
    },
    legend: {
        marginTop: 14,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.06)',
    },
    legendTitle: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 11,
        fontWeight: '600',
        marginBottom: 4,
    },
    legendItems: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    legendItem: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 10,
    },
    reportSeatBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginTop: 12,
        paddingVertical: 10,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.06)',
    },
    reportSeatText: {
        color: Colors.primary.start,
        fontSize: 13,
        fontWeight: '600',
    },
    reportModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 30,
    },
    reportModalCard: {
        width: '100%',
        borderRadius: 20,
        overflow: 'hidden',
    },
    reportModalGradient: {
        padding: 24,
    },
    reportModalTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '800',
        marginBottom: 4,
    },
    reportModalSub: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 13,
        marginBottom: 20,
    },
    reportField: {
        marginBottom: 16,
    },
    reportFieldLabel: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 1,
        marginBottom: 8,
    },
    reportInput: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 12,
        paddingHorizontal: 14,
        height: 48,
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    reportStatusRow: {
        flexDirection: 'row',
        gap: 10,
    },
    reportStatusBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    reportStatusText: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 14,
        fontWeight: '600',
    },
    reportActions: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 8,
    },
    reportCancelBtn: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.06)',
    },
    reportCancelText: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 14,
        fontWeight: '600',
    },
    reportSubmitBtn: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 12,
    },
    reportSubmitText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
    },
});
