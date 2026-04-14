/**
 * RegisterTab — Seat Swap Registration Form
 *
 * Chunk 1 update: Added Boarding & Destination station pickers
 * powered by assets/stations.json for geofence auto-wake.
 */

import React, { useState } from 'react';
import {
    FlatList,
    Modal,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    ActivityIndicator,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '../../constants/Colors';
import { SeatType, SwapReason } from '../../services/swapStore';
import { SEAT_TYPES, REASONS } from './swap.constants';
import { styles } from './swap.styles';
import { SwapPreview } from './SwapPreview';
import stationsData from '../../assets/stations.json';

// --- Station types ---

interface Station {
    code: string;
    name: string;
    lat: number;
    lng: number;
}

const ALL_STATIONS: Station[] = stationsData as Station[];

// --- Props ---

export interface RegisterTabProps {
    submitted: boolean;
    coachId: string;
    seatNo: string;
    currentType: SeatType | '';
    desiredType: SeatType | '';
    reason: SwapReason;
    loading: boolean;
    isFormValid: boolean;
    boardingStation: string | null;
    destinationStation: string | null;
    onCoachIdChange: (val: string) => void;
    onSeatNoChange: (val: string) => void;
    onCurrentTypeChange: (val: SeatType) => void;
    onDesiredTypeChange: (val: SeatType) => void;
    onReasonChange: (val: SwapReason) => void;
    onBoardingStationChange: (code: string | null) => void;
    onDestinationStationChange: (code: string | null) => void;
    onSubmit: () => void;
    onGoToMySwap: () => void;
}

// --- Station Picker Modal ---

interface StationPickerProps {
    visible: boolean;
    title: string;
    selectedCode: string | null;
    onSelect: (code: string) => void;
    onClose: () => void;
}

const StationPicker: React.FC<StationPickerProps> = ({
    visible,
    title,
    selectedCode,
    onSelect,
    onClose,
}) => {
    const [query, setQuery] = useState('');

    const filtered = ALL_STATIONS.filter(
        s =>
            s.code.toLowerCase().includes(query.toLowerCase()) ||
            s.name.toLowerCase().includes(query.toLowerCase()),
    );

    return (
        <Modal
            visible={visible}
            animationType="slide"
            presentationStyle="pageSheet"
            onRequestClose={onClose}
        >
            <View style={pickerStyles.container}>
                {/* Header */}
                <View style={pickerStyles.header}>
                    <Text style={pickerStyles.title}>{title}</Text>
                    <TouchableOpacity onPress={onClose} style={pickerStyles.closeBtn}>
                        <Ionicons name="close" size={22} color={Colors.text.primary} />
                    </TouchableOpacity>
                </View>

                {/* Search */}
                <View style={pickerStyles.searchWrapper}>
                    <Ionicons
                        name="search-outline"
                        size={18}
                        color={Colors.text.tertiary}
                        style={{ marginLeft: 12 }}
                    />
                    <TextInput
                        style={pickerStyles.searchInput}
                        placeholder="Search station name or code…"
                        placeholderTextColor={Colors.text.tertiary}
                        value={query}
                        onChangeText={setQuery}
                        autoFocus
                        autoCorrect={false}
                    />
                    {query.length > 0 && (
                        <TouchableOpacity onPress={() => setQuery('')} style={{ padding: 10 }}>
                            <Ionicons name="close-circle" size={16} color={Colors.text.tertiary} />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Station List */}
                <FlatList
                    data={filtered}
                    keyExtractor={item => item.code}
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{ paddingBottom: 40 }}
                    renderItem={({ item }) => {
                        const isSelected = item.code === selectedCode;
                        return (
                            <TouchableOpacity
                                style={[pickerStyles.row, isSelected && pickerStyles.rowSelected]}
                                onPress={() => {
                                    onSelect(item.code);
                                    onClose();
                                    setQuery('');
                                }}
                            >
                                <View style={pickerStyles.codeBox}>
                                    <Text style={pickerStyles.code}>{item.code}</Text>
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={pickerStyles.stationName}>{item.name}</Text>
                                    <Text style={pickerStyles.coords}>
                                        {item.lat.toFixed(3)}°N, {item.lng.toFixed(3)}°E
                                    </Text>
                                </View>
                                {isSelected && (
                                    <Ionicons name="checkmark-circle" size={20} color={Colors.primary.start} />
                                )}
                            </TouchableOpacity>
                        );
                    }}
                    ListEmptyComponent={
                        <Text style={pickerStyles.empty}>No stations match &quot;{query}&quot;</Text>
                    }
                />
            </View>
        </Modal>
    );
};

// --- RegisterTab ---

export const RegisterTab: React.FC<RegisterTabProps> = ({
    submitted,
    coachId,
    seatNo,
    currentType,
    desiredType,
    reason,
    loading,
    isFormValid,
    boardingStation,
    destinationStation,
    onCoachIdChange,
    onSeatNoChange,
    onCurrentTypeChange,
    onDesiredTypeChange,
    onReasonChange,
    onBoardingStationChange,
    onDestinationStationChange,
    onSubmit,
    onGoToMySwap,
}) => {
    const [boardingPickerOpen, setBoardingPickerOpen] = useState(false);
    const [destinationPickerOpen, setDestinationPickerOpen] = useState(false);

    const boardingName = boardingStation
        ? ALL_STATIONS.find(s => s.code === boardingStation)?.name ?? boardingStation
        : null;
    const destinationName = destinationStation
        ? ALL_STATIONS.find(s => s.code === destinationStation)?.name ?? destinationStation
        : null;

    if (submitted) {
        return (
            <View style={styles.emptyState}>
                <Ionicons name="checkmark-circle" size={48} color={Colors.success.start} />
                <Text style={styles.emptyTitle}>You already have an active swap</Text>
                <Text style={styles.emptySub}>Cancel your current swap to register a new one</Text>
                <TouchableOpacity onPress={onGoToMySwap} style={styles.goRegisterBtn}>
                    <Ionicons name="swap-horizontal-outline" size={16} color={Colors.primary.start} />
                    <Text style={styles.goRegisterText}>Go to My Swap</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.card}>
            {/* Seat Details */}
            <Text style={styles.sectionLabel}>YOUR SEAT DETAILS</Text>
            <View style={styles.formRow}>
                <View style={[styles.formField, { flex: 1 }]}>
                    <Text style={styles.fieldLabel}>Coach</Text>
                    <TextInput
                        style={styles.fieldInput}
                        placeholder="B3"
                        placeholderTextColor={Colors.text.tertiary}
                        value={coachId}
                        onChangeText={onCoachIdChange}
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
                        onChangeText={onSeatNoChange}
                        keyboardType="number-pad"
                        maxLength={3}
                    />
                </View>
            </View>

            {/* Journey Stations (Chunk 1 — Geofence source data) */}
            <Text style={[styles.sectionLabel, { marginTop: 20 }]}>JOURNEY STATIONS (FOR AUTO-WAKE)</Text>

            {/* Boarding Station */}
            <TouchableOpacity
                style={stationStyles.stationBtn}
                onPress={() => setBoardingPickerOpen(true)}
                activeOpacity={0.7}
            >
                <Ionicons name="location-outline" size={18} color={Colors.primary.start} />
                <View style={{ flex: 1 }}>
                    <Text style={stationStyles.stationBtnLabel}>Boarding Station</Text>
                    <Text style={stationStyles.stationBtnValue} numberOfLines={1}>
                        {boardingStation
                            ? `${boardingStation} — ${boardingName}`
                            : 'Tap to select your boarding station'}
                    </Text>
                </View>
                <Ionicons
                    name={boardingStation ? 'checkmark-circle' : 'chevron-forward'}
                    size={18}
                    color={boardingStation ? Colors.success.start : Colors.text.tertiary}
                />
            </TouchableOpacity>

            {/* Destination Station */}
            <TouchableOpacity
                style={[stationStyles.stationBtn, { marginTop: 8 }]}
                onPress={() => setDestinationPickerOpen(true)}
                activeOpacity={0.7}
            >
                <Ionicons name="flag-outline" size={18} color={Colors.accent.start} />
                <View style={{ flex: 1 }}>
                    <Text style={stationStyles.stationBtnLabel}>Destination Station</Text>
                    <Text style={stationStyles.stationBtnValue} numberOfLines={1}>
                        {destinationStation
                            ? `${destinationStation} — ${destinationName}`
                            : 'Tap to select your destination'}
                    </Text>
                </View>
                <Ionicons
                    name={destinationStation ? 'checkmark-circle' : 'chevron-forward'}
                    size={18}
                    color={destinationStation ? Colors.success.start : Colors.text.tertiary}
                />
            </TouchableOpacity>

            {/* Geofence hint */}
            {(!boardingStation || !destinationStation) && (
                <View style={stationStyles.hint}>
                    <Ionicons name="information-circle-outline" size={14} color={Colors.text.tertiary} />
                    <Text style={stationStyles.hintText}>
                        Set stations to enable automatic mesh network activation at your boarding point.
                    </Text>
                </View>
            )}

            {/* Current Berth */}
            <Text style={[styles.sectionLabel, { marginTop: 20 }]}>YOUR CURRENT BERTH</Text>
            <View style={styles.typeGrid}>
                {SEAT_TYPES.map(type => (
                    <TouchableOpacity
                        key={type.id}
                        onPress={() => onCurrentTypeChange(type.id)}
                        style={[styles.typeChip, currentType === type.id && styles.typeChipActive]}
                    >
                        <Ionicons
                            name={type.icon as any}
                            size={16}
                            color={currentType === type.id ? '#fff' : Colors.text.tertiary}
                        />
                        <Text
                            style={[
                                styles.typeChipText,
                                currentType === type.id && styles.typeChipTextActive,
                            ]}
                        >
                            {type.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Desired Berth */}
            <Text style={[styles.sectionLabel, { marginTop: 20 }]}>DESIRED BERTH</Text>
            <View style={styles.typeGrid}>
                {SEAT_TYPES.filter(t => t.id !== currentType).map(type => (
                    <TouchableOpacity
                        key={type.id}
                        onPress={() => onDesiredTypeChange(type.id)}
                        style={[styles.typeChip, desiredType === type.id && styles.typeChipDesired]}
                    >
                        <Ionicons
                            name={type.icon as any}
                            size={16}
                            color={desiredType === type.id ? '#fff' : Colors.text.tertiary}
                        />
                        <Text
                            style={[
                                styles.typeChipText,
                                desiredType === type.id && styles.typeChipTextActive,
                            ]}
                        >
                            {type.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Reason */}
            <Text style={[styles.sectionLabel, { marginTop: 20 }]}>REASON (AFFECTS PRIORITY)</Text>
            <View style={styles.typeGrid}>
                {REASONS.map(r => (
                    <TouchableOpacity
                        key={r.id}
                        onPress={() => onReasonChange(r.id)}
                        style={[styles.typeChip, reason === r.id && styles.reasonChipActive]}
                    >
                        <Text style={{ fontSize: 14 }}>{r.emoji}</Text>
                        <Text
                            style={[
                                styles.typeChipText,
                                reason === r.id && styles.typeChipTextActive,
                            ]}
                        >
                            {r.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            <SwapPreview currentType={currentType} desiredType={desiredType} />

            <TouchableOpacity
                onPress={onSubmit}
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
                            <MaterialCommunityIcons
                                name="swap-horizontal-bold"
                                size={20}
                                color={isFormValid ? '#fff' : Colors.text.tertiary}
                            />
                            <Text
                                style={[
                                    styles.submitBtnText,
                                    !isFormValid && { color: Colors.text.tertiary },
                                ]}
                            >
                                Register Swap Offer
                            </Text>
                        </>
                    )}
                </LinearGradient>
            </TouchableOpacity>

            {/* Station Picker Modals */}
            <StationPicker
                visible={boardingPickerOpen}
                title="Select Boarding Station"
                selectedCode={boardingStation}
                onSelect={onBoardingStationChange}
                onClose={() => setBoardingPickerOpen(false)}
            />
            <StationPicker
                visible={destinationPickerOpen}
                title="Select Destination Station"
                selectedCode={destinationStation}
                onSelect={onDestinationStationChange}
                onClose={() => setDestinationPickerOpen(false)}
            />
        </View>
    );
};

// --- Picker Styles ---

const pickerStyles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background.primary,
        paddingTop: Platform.OS === 'ios' ? 20 : 0,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: Colors.divider,
    },
    title: {
        color: Colors.text.primary,
        fontSize: 17,
        fontWeight: '700',
    },
    closeBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: Colors.background.tertiary,
        alignItems: 'center',
        justifyContent: 'center',
    },
    searchWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        margin: 16,
        backgroundColor: Colors.background.tertiary,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.card.border,
    },
    searchInput: {
        flex: 1,
        height: 44,
        paddingHorizontal: 10,
        color: Colors.text.primary,
        fontSize: 15,
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 14,
        gap: 12,
        borderBottomWidth: 1,
        borderBottomColor: Colors.divider,
    },
    rowSelected: {
        backgroundColor: Colors.primary.light,
    },
    codeBox: {
        backgroundColor: Colors.card.background,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        minWidth: 48,
        alignItems: 'center',
    },
    code: {
        color: Colors.primary.start,
        fontSize: 13,
        fontWeight: '800',
    },
    stationName: {
        color: Colors.text.primary,
        fontSize: 14,
        fontWeight: '600',
    },
    coords: {
        color: Colors.text.tertiary,
        fontSize: 11,
        marginTop: 2,
    },
    empty: {
        color: Colors.text.tertiary,
        textAlign: 'center',
        marginTop: 40,
        fontSize: 14,
    },
});

const stationStyles = StyleSheet.create({
    stationBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: Colors.background.tertiary,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.card.border,
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
    stationBtnLabel: {
        color: Colors.text.tertiary,
        fontSize: 11,
        fontWeight: '600',
        marginBottom: 2,
    },
    stationBtnValue: {
        color: Colors.text.primary,
        fontSize: 13,
        fontWeight: '600',
    },
    hint: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 6,
        marginTop: 8,
        paddingHorizontal: 4,
    },
    hintText: {
        flex: 1,
        color: Colors.text.tertiary,
        fontSize: 11,
        lineHeight: 16,
    },
});
