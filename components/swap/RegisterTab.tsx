import React from 'react';
import { View, Text, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Colors from '../../constants/Colors';
import { SeatType, SwapReason } from '../../services/swapStore';
import { SEAT_TYPES, REASONS } from './swap.constants';
import { styles } from './swap.styles';
import { SwapPreview } from './SwapPreview';

export interface RegisterTabProps {
    submitted: boolean;
    coachId: string;
    seatNo: string;
    currentType: SeatType | '';
    desiredType: SeatType | '';
    reason: SwapReason;
    loading: boolean;
    isFormValid: boolean;
    onCoachIdChange: (val: string) => void;
    onSeatNoChange: (val: string) => void;
    onCurrentTypeChange: (val: SeatType) => void;
    onDesiredTypeChange: (val: SeatType) => void;
    onReasonChange: (val: SwapReason) => void;
    onSubmit: () => void;
    onGoToMySwap: () => void;
}

export const RegisterTab: React.FC<RegisterTabProps> = ({
    submitted,
    coachId,
    seatNo,
    currentType,
    desiredType,
    reason,
    loading,
    isFormValid,
    onCoachIdChange,
    onSeatNoChange,
    onCurrentTypeChange,
    onDesiredTypeChange,
    onReasonChange,
    onSubmit,
    onGoToMySwap,
}) => {
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

            <Text style={[styles.sectionLabel, { marginTop: 20 }]}>YOUR CURRENT BERTH</Text>
            <View style={styles.typeGrid}>
                {SEAT_TYPES.map(type => (
                    <TouchableOpacity
                        key={type.id}
                        onPress={() => onCurrentTypeChange(type.id)}
                        style={[styles.typeChip, currentType === type.id && styles.typeChipActive]}
                    >
                        <Ionicons name={type.icon as any} size={16} color={currentType === type.id ? '#fff' : Colors.text.tertiary} />
                        <Text style={[styles.typeChipText, currentType === type.id && styles.typeChipTextActive]}>{type.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <Text style={[styles.sectionLabel, { marginTop: 20 }]}>DESIRED BERTH</Text>
            <View style={styles.typeGrid}>
                {SEAT_TYPES.filter(t => t.id !== currentType).map(type => (
                    <TouchableOpacity
                        key={type.id}
                        onPress={() => onDesiredTypeChange(type.id)}
                        style={[styles.typeChip, desiredType === type.id && styles.typeChipDesired]}
                    >
                        <Ionicons name={type.icon as any} size={16} color={desiredType === type.id ? '#fff' : Colors.text.tertiary} />
                        <Text style={[styles.typeChipText, desiredType === type.id && styles.typeChipTextActive]}>{type.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <Text style={[styles.sectionLabel, { marginTop: 20 }]}>REASON (AFFECTS PRIORITY)</Text>
            <View style={styles.typeGrid}>
                {REASONS.map(r => (
                    <TouchableOpacity
                        key={r.id}
                        onPress={() => onReasonChange(r.id)}
                        style={[styles.typeChip, reason === r.id && styles.reasonChipActive]}
                    >
                        <Text style={{ fontSize: 14 }}>{r.emoji}</Text>
                        <Text style={[styles.typeChipText, reason === r.id && styles.typeChipTextActive]}>{r.label}</Text>
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
                    colors={isFormValid ? [Colors.primary.start, Colors.primary.end] : [Colors.background.tertiary, Colors.background.tertiary]}
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
    );
};
