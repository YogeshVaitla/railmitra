import React, { useState, useMemo } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Modal,
    Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import Colors from '../constants/Colors';

const { width } = Dimensions.get('window');
const DAYS_OF_WEEK = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

// Map JS getDay() index to train schedule day names
const DAY_INDEX_TO_NAME = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

interface DatePickerProps {
    value: string; // YYYY-MM-DD
    onChange: (date: string) => void;
    label?: string;
    runningDays?: string[] | null; // e.g., ['Mon', 'Wed', 'Fri']
}

export default function DatePicker({ value, onChange, label, runningDays }: DatePickerProps) {
    const [visible, setVisible] = useState(false);

    const selectedDate = useMemo(() => {
        if (!value) return new Date();
        const parts = value.split('-');
        return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
    }, [value]);

    const [viewYear, setViewYear] = useState(selectedDate.getFullYear());
    const [viewMonth, setViewMonth] = useState(selectedDate.getMonth());

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const formatDisplay = (dateStr: string): string => {
        if (!dateStr) return 'Select Date';
        const parts = dateStr.split('-');
        const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]));
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${dayNames[d.getDay()]}, ${d.getDate()} ${monthNames[d.getMonth()]} ${d.getFullYear()}`;
    };

    const getDaysInMonth = (year: number, month: number) => {
        return new Date(year, month + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (year: number, month: number) => {
        return new Date(year, month, 1).getDay();
    };

    const calendarDays = useMemo(() => {
        const daysInMonth = getDaysInMonth(viewYear, viewMonth);
        const firstDay = getFirstDayOfMonth(viewYear, viewMonth);
        const days: (number | null)[] = [];

        // Empty slots before first day
        for (let i = 0; i < firstDay; i++) {
            days.push(null);
        }

        // Days of month
        for (let i = 1; i <= daysInMonth; i++) {
            days.push(i);
        }

        return days;
    }, [viewYear, viewMonth]);

    const goToPrevMonth = () => {
        if (viewMonth === 0) {
            setViewMonth(11);
            setViewYear(viewYear - 1);
        } else {
            setViewMonth(viewMonth - 1);
        }
    };

    const goToNextMonth = () => {
        if (viewMonth === 11) {
            setViewMonth(0);
            setViewYear(viewYear + 1);
        } else {
            setViewMonth(viewMonth + 1);
        }
    };

    const selectDay = (day: number) => {
        const formatted = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        onChange(formatted);
        setVisible(false);
    };

    const isSelected = (day: number): boolean => {
        return (
            selectedDate.getDate() === day &&
            selectedDate.getMonth() === viewMonth &&
            selectedDate.getFullYear() === viewYear
        );
    };

    const isToday = (day: number): boolean => {
        return (
            today.getDate() === day &&
            today.getMonth() === viewMonth &&
            today.getFullYear() === viewYear
        );
    };

    const isPast = (day: number): boolean => {
        const checkDate = new Date(viewYear, viewMonth, day);
        checkDate.setHours(0, 0, 0, 0);
        return checkDate < today;
    };

    const isNonRunningDay = (day: number): boolean => {
        if (!runningDays || runningDays.length === 0 || runningDays.length === 7) return false;
        const checkDate = new Date(viewYear, viewMonth, day);
        const dayName = DAY_INDEX_TO_NAME[checkDate.getDay()];
        return !runningDays.includes(dayName);
    };

    return (
        <>
            {/* Date Display Button */}
            <TouchableOpacity
                style={styles.inputContainer}
                onPress={() => {
                    setViewYear(selectedDate.getFullYear());
                    setViewMonth(selectedDate.getMonth());
                    setVisible(true);
                }}
                activeOpacity={0.7}
            >
                <Ionicons name="calendar-outline" size={20} color={Colors.accent.start} style={styles.inputIcon} />
                <View style={styles.dateTextContainer}>
                    {label && <Text style={styles.dateLabel}>{label}</Text>}
                    <Text style={styles.dateValue}>{formatDisplay(value)}</Text>
                </View>
                <Ionicons name="chevron-down" size={16} color="rgba(255,255,255,0.4)" />
            </TouchableOpacity>

            {/* Calendar Modal */}
            <Modal
                visible={visible}
                transparent
                animationType="fade"
                onRequestClose={() => setVisible(false)}
            >
                <TouchableOpacity
                    style={styles.overlay}
                    activeOpacity={1}
                    onPress={() => setVisible(false)}
                >
                    <TouchableOpacity activeOpacity={1} onPress={() => { }}>
                        <View style={styles.calendarContainer}>
                            <LinearGradient
                                colors={['#1a1640', '#2d2460', '#1a1640']}
                                style={styles.calendarGradient}
                            >
                                {/* Month/Year Header */}
                                <View style={styles.calendarHeader}>
                                    <TouchableOpacity onPress={goToPrevMonth} style={styles.navBtn}>
                                        <Ionicons name="chevron-back" size={22} color="#fff" />
                                    </TouchableOpacity>
                                    <View style={styles.monthYearContainer}>
                                        <Text style={styles.monthText}>{MONTHS[viewMonth]}</Text>
                                        <Text style={styles.yearText}>{viewYear}</Text>
                                    </View>
                                    <TouchableOpacity onPress={goToNextMonth} style={styles.navBtn}>
                                        <Ionicons name="chevron-forward" size={22} color="#fff" />
                                    </TouchableOpacity>
                                </View>

                                {/* Day of week headers */}
                                <View style={styles.weekRow}>
                                    {DAYS_OF_WEEK.map((day) => (
                                        <View key={day} style={styles.weekDayCell}>
                                            <Text style={styles.weekDayText}>{day}</Text>
                                        </View>
                                    ))}
                                </View>

                                {/* Calendar Grid */}
                                <View style={styles.daysGrid}>
                                    {calendarDays.map((day, idx) => {
                                        if (day === null) {
                                            return <View key={`empty-${idx}`} style={styles.dayCell} />;
                                        }

                                        const selected = isSelected(day);
                                        const todayFlag = isToday(day);
                                        const past = isPast(day);
                                        const nonRunning = isNonRunningDay(day);
                                        const disabled = past || nonRunning;

                                        return (
                                            <TouchableOpacity
                                                key={day}
                                                style={styles.dayCell}
                                                onPress={() => !disabled && selectDay(day)}
                                                disabled={disabled}
                                                activeOpacity={0.6}
                                            >
                                                {selected ? (
                                                    <LinearGradient
                                                        colors={[Colors.primary.start, Colors.primary.end]}
                                                        style={styles.daySelected}
                                                    >
                                                        <Text style={styles.dayTextSelected}>{day}</Text>
                                                    </LinearGradient>
                                                ) : (
                                                    <View
                                                        style={[
                                                            styles.dayInner,
                                                            todayFlag && !nonRunning && styles.dayToday,
                                                            nonRunning && !past && styles.dayNonRunning,
                                                        ]}
                                                    >
                                                        <Text
                                                            style={[
                                                                styles.dayText,
                                                                past && styles.dayTextPast,
                                                                todayFlag && !nonRunning && styles.dayTextToday,
                                                                nonRunning && !past && styles.dayTextNonRunning,
                                                            ]}
                                                        >
                                                            {day}
                                                        </Text>
                                                        {nonRunning && !past && (
                                                            <View style={styles.nonRunningDot} />
                                                        )}
                                                    </View>
                                                )}
                                            </TouchableOpacity>
                                        );
                                    })}
                                </View>

                                {/* Running Days Legend */}
                                {runningDays && runningDays.length > 0 && runningDays.length < 7 && (
                                    <View style={styles.runLegend}>
                                        <Ionicons name="train-outline" size={14} color={Colors.accent.start} />
                                        <Text style={styles.runLegendText}>
                                            Runs on: {runningDays.join(', ')}
                                        </Text>
                                    </View>
                                )}

                                {/* Quick Actions */}
                                <View style={styles.quickActions}>
                                    <TouchableOpacity
                                        style={[
                                            styles.quickBtn,
                                            runningDays && !runningDays.includes(DAY_INDEX_TO_NAME[new Date().getDay()]) && styles.quickBtnDisabled,
                                        ]}
                                        disabled={runningDays ? !runningDays.includes(DAY_INDEX_TO_NAME[new Date().getDay()]) : false}
                                        onPress={() => {
                                            const d = new Date();
                                            const formatted = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                                            onChange(formatted);
                                            setVisible(false);
                                        }}
                                    >
                                        <Text style={styles.quickBtnText}>Today</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[
                                            styles.quickBtn,
                                            runningDays && !runningDays.includes(DAY_INDEX_TO_NAME[(() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.getDay(); })()]) && styles.quickBtnDisabled,
                                        ]}
                                        disabled={runningDays ? !runningDays.includes(DAY_INDEX_TO_NAME[(() => { const d = new Date(); d.setDate(d.getDate() + 1); return d.getDay(); })()]) : false}
                                        onPress={() => {
                                            const d = new Date();
                                            d.setDate(d.getDate() + 1);
                                            const formatted = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                                            onChange(formatted);
                                            setVisible(false);
                                        }}
                                    >
                                        <Text style={styles.quickBtnText}>Tomorrow</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.quickBtn, styles.quickBtnCancel]}
                                        onPress={() => setVisible(false)}
                                    >
                                        <Text style={[styles.quickBtnText, { color: 'rgba(255,255,255,0.5)' }]}>Cancel</Text>
                                    </TouchableOpacity>
                                </View>
                            </LinearGradient>
                        </View>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>
        </>
    );
}

const CELL_PERCENTAGE = 100 / 7;

const styles = StyleSheet.create({
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.07)',
        borderRadius: 14,
        paddingHorizontal: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        height: 52,
    },
    inputIcon: {
        marginRight: 10,
    },
    dateTextContainer: {
        flex: 1,
    },
    dateLabel: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.4)',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    dateValue: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
    },
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    calendarContainer: {
        borderRadius: 24,
        overflow: 'hidden',
        width: width - 40,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
    },
    calendarGradient: {
        padding: 20,
    },
    calendarHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    navBtn: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.08)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    monthYearContainer: {
        alignItems: 'center',
    },
    monthText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
    yearText: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 13,
        marginTop: 2,
    },
    weekRow: {
        flexDirection: 'row',
        marginBottom: 8,
    },
    weekDayCell: {
        width: `${CELL_PERCENTAGE}%` as any,
        alignItems: 'center',
    },
    weekDayText: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 12,
        fontWeight: '600',
    },
    daysGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    dayCell: {
        width: `${CELL_PERCENTAGE}%` as any,
        aspectRatio: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 2,
    },
    dayInner: {
        width: '85%',
        aspectRatio: 1,
        borderRadius: 100,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dayToday: {
        borderWidth: 1.5,
        borderColor: Colors.primary.start,
    },
    daySelected: {
        width: '85%',
        aspectRatio: 1,
        borderRadius: 100,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dayText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '500',
    },
    dayTextSelected: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '800',
    },
    dayTextPast: {
        color: 'rgba(255,255,255,0.2)',
    },
    dayTextToday: {
        color: Colors.primary.start,
        fontWeight: '700',
    },
    dayNonRunning: {
        opacity: 0.35,
    },
    dayTextNonRunning: {
        color: 'rgba(255,255,255,0.35)',
        textDecorationLine: 'line-through',
    },
    nonRunningDot: {
        width: 3,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: 'rgba(255,100,100,0.5)',
        marginTop: 2,
        position: 'absolute',
        bottom: 4,
    },
    runLegend: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.06)',
        justifyContent: 'center',
    },
    runLegendText: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 12,
        fontWeight: '500',
    },
    quickActions: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 10,
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.08)',
    },
    quickBtn: {
        paddingHorizontal: 18,
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: 'rgba(102, 126, 234, 0.15)',
    },
    quickBtnCancel: {
        backgroundColor: 'rgba(255,255,255,0.06)',
    },
    quickBtnDisabled: {
        opacity: 0.3,
    },
    quickBtnText: {
        color: Colors.primary.start,
        fontSize: 13,
        fontWeight: '700',
    },
});
