import React from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';
import Colors from '../constants/Colors';
import { Station } from '../models/types';

export default function RouteScreen() {
    const params = useLocalSearchParams<{
        trainNumber: string;
        trainName: string;
        fromStation: string;
        toStation: string;
        routeData: string;
    }>();

    let route: Station[] = [];
    try {
        route = JSON.parse(params.routeData || '[]');
    } catch {
        route = [];
    }

    const isBoardingOrDest = (code: string) =>
        code === params.fromStation || code === params.toStation;

    const isInJourney = (stopNumber: number) => {
        const fromIdx = route.findIndex((s) => s.code === params.fromStation);
        const toIdx = route.findIndex((s) => s.code === params.toStation);
        return stopNumber - 1 >= fromIdx && stopNumber - 1 <= toIdx;
    };

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
                    <View style={styles.headerCenter}>
                        <Text style={styles.headerTitle}>Train Route</Text>
                        <Text style={styles.headerSubtitle}>
                            {params.trainNumber} - {params.trainName}
                        </Text>
                    </View>
                    <View style={{ width: 40 }} />
                </View>

                {/* Journey Summary */}
                <View style={styles.journeySummary}>
                    <View style={styles.journeyEndpoint}>
                        <View style={[styles.endpointDot, { backgroundColor: Colors.success.end }]} />
                        <Text style={styles.endpointCode}>{params.fromStation}</Text>
                    </View>
                    <View style={styles.journeyLine}>
                        <MaterialCommunityIcons name="train" size={18} color={Colors.primary.start} />
                    </View>
                    <View style={styles.journeyEndpoint}>
                        <View style={[styles.endpointDot, { backgroundColor: Colors.danger.end }]} />
                        <Text style={styles.endpointCode}>{params.toStation}</Text>
                    </View>
                </View>

                {/* Route Timeline */}
                <View style={styles.timeline}>
                    {route.map((station, idx) => {
                        const isFirst = idx === 0;
                        const isLast = idx === route.length - 1;
                        const isHighlight = isBoardingOrDest(station.code);
                        const inJourney = isInJourney(station.stopNumber);

                        return (
                            <View key={station.code} style={styles.timelineItem}>
                                {/* Timeline line */}
                                <View style={styles.timelineSide}>
                                    {!isFirst && (
                                        <View
                                            style={[
                                                styles.timelineLineUp,
                                                inJourney && styles.timelineLineActive,
                                            ]}
                                        />
                                    )}
                                    <View
                                        style={[
                                            styles.timelineDot,
                                            isHighlight && styles.timelineDotHighlight,
                                            inJourney && !isHighlight && styles.timelineDotInJourney,
                                        ]}
                                    >
                                        {isHighlight && (
                                            <Ionicons
                                                name={station.code === params.fromStation ? 'arrow-up' : 'arrow-down'}
                                                size={12}
                                                color="#fff"
                                            />
                                        )}
                                    </View>
                                    {!isLast && (
                                        <View
                                            style={[
                                                styles.timelineLineDown,
                                                isInJourney(station.stopNumber + 1) && styles.timelineLineActive,
                                            ]}
                                        />
                                    )}
                                </View>

                                {/* Station Card */}
                                <View
                                    style={[
                                        styles.stationCard,
                                        isHighlight && styles.stationCardHighlight,
                                        inJourney && !isHighlight && styles.stationCardInJourney,
                                    ]}
                                >
                                    <View style={styles.stationMain}>
                                        <View>
                                            <Text
                                                style={[
                                                    styles.stationCode,
                                                    isHighlight && styles.stationCodeHighlight,
                                                ]}
                                            >
                                                {station.code}
                                            </Text>
                                            <Text style={styles.stationName}>{station.name}</Text>
                                        </View>
                                        {station.dayCount && (
                                            <View style={styles.dayBadge}>
                                                <Text style={styles.dayText}>Day {station.dayCount}</Text>
                                            </View>
                                        )}
                                    </View>

                                    <View style={styles.stationTimes}>
                                        {station.arrivalTime && (
                                            <View style={styles.timeBlock}>
                                                <Text style={styles.timeLabel}>Arrives</Text>
                                                <Text style={styles.timeValue}>{station.arrivalTime}</Text>
                                            </View>
                                        )}
                                        {station.departureTime && (
                                            <View style={styles.timeBlock}>
                                                <Text style={styles.timeLabel}>Departs</Text>
                                                <Text style={styles.timeValue}>{station.departureTime}</Text>
                                            </View>
                                        )}
                                        {isFirst && !station.arrivalTime && (
                                            <View style={styles.timeBlock}>
                                                <Text style={styles.timeLabel}>Origin</Text>
                                                <Text style={styles.timeValue}>{station.departureTime}</Text>
                                            </View>
                                        )}
                                        {isLast && !station.departureTime && (
                                            <View style={styles.timeBlock}>
                                                <Text style={styles.timeLabel}>Terminus</Text>
                                                <Text style={styles.timeValue}>{station.arrivalTime}</Text>
                                            </View>
                                        )}
                                    </View>

                                    {isHighlight && (
                                        <View style={styles.highlightBadge}>
                                            <Text style={styles.highlightText}>
                                                {station.code === params.fromStation ? '📍 Boarding' : '🏁 Destination'}
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        );
                    })}
                </View>
            </ScrollView>
        </LinearGradient>
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
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 24,
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.08)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerCenter: {
        flex: 1,
        alignItems: 'center',
    },
    headerTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
    headerSubtitle: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 12,
        marginTop: 2,
    },
    journeySummary: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: 14,
        padding: 14,
        marginBottom: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
        gap: 12,
    },
    journeyEndpoint: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    endpointDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    endpointCode: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '800',
    },
    journeyLine: {
        flex: 1,
        alignItems: 'center',
    },
    timeline: {},
    timelineItem: {
        flexDirection: 'row',
        minHeight: 80,
    },
    timelineSide: {
        width: 30,
        alignItems: 'center',
    },
    timelineLineUp: {
        flex: 1,
        width: 2,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    timelineLineDown: {
        flex: 1,
        width: 2,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    timelineLineActive: {
        backgroundColor: Colors.primary.start,
    },
    timelineDot: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.15)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.2)',
    },
    timelineDotHighlight: {
        backgroundColor: Colors.primary.start,
        borderColor: Colors.primary.end,
        width: 24,
        height: 24,
        borderRadius: 12,
    },
    timelineDotInJourney: {
        backgroundColor: 'rgba(102, 126, 234, 0.4)',
        borderColor: Colors.primary.start,
    },
    stationCard: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.04)',
        borderRadius: 12,
        padding: 12,
        marginLeft: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.04)',
    },
    stationCardHighlight: {
        backgroundColor: 'rgba(102, 126, 234, 0.12)',
        borderColor: 'rgba(102, 126, 234, 0.3)',
    },
    stationCardInJourney: {
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderColor: 'rgba(255,255,255,0.08)',
    },
    stationMain: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    stationCode: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 15,
        fontWeight: '800',
    },
    stationCodeHighlight: {
        color: Colors.primary.start,
    },
    stationName: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
        marginTop: 2,
    },
    dayBadge: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    dayText: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 10,
        fontWeight: '600',
    },
    stationTimes: {
        flexDirection: 'row',
        gap: 20,
        marginTop: 8,
    },
    timeBlock: {},
    timeLabel: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    timeValue: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
        marginTop: 1,
    },
    highlightBadge: {
        marginTop: 8,
    },
    highlightText: {
        color: Colors.primary.start,
        fontSize: 12,
        fontWeight: '700',
    },
});
