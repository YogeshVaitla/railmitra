import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    ScrollView,
    StyleSheet,
    Dimensions,
    Animated,
    Platform,
    FlatList,
    Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Colors from '../constants/Colors';
import { getTrainSuggestions, getStationsForTrain, getTrainRunningDays, isUsingLiveAPI } from '../services/apiService';
import { getRecentSearches, RecentSearch } from '../services/favoritesService';
import { t, getLanguage, setLanguage, Language, LANGUAGES } from '../services/localization';
import DatePicker from '../components/DatePicker';

const { width, height } = Dimensions.get('window');

export default function HomeScreen() {
    const [trainNumber, setTrainNumber] = useState('');
    const [journeyDate, setJourneyDate] = useState('');
    const [fromStation, setFromStation] = useState('');
    const [toStation, setToStation] = useState('');
    const [fromStationName, setFromStationName] = useState('');
    const [toStationName, setToStationName] = useState('');
    const [suggestions, setSuggestions] = useState<{ number: string; name: string }[]>([]);
    const [stations, setStations] = useState<{ code: string; name: string }[]>([]);
    const [showStationModal, setShowStationModal] = useState<'from' | 'to' | null>(null);
    const [recentSearches, setRecentSearches] = useState<RecentSearch[]>([]);
    const [lang, setLang] = useState<Language>(getLanguage());
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [showLangModal, setShowLangModal] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [runningDays, setRunningDays] = useState<string[] | null>(null);
    const menuSlide = useState(new Animated.Value(-width))[0];

    // Animations
    const fadeAnim = useState(new Animated.Value(0))[0];
    const slideAnim = useState(new Animated.Value(50))[0];
    const logoScale = useState(new Animated.Value(0.5))[0];

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 800,
                useNativeDriver: true,
            }),
            Animated.spring(slideAnim, {
                toValue: 0,
                tension: 50,
                friction: 8,
                useNativeDriver: true,
            }),
            Animated.spring(logoScale, {
                toValue: 1,
                tension: 50,
                friction: 5,
                useNativeDriver: true,
            }),
        ]).start();

        loadRecentSearches();

        // Set default date to today
        const today = new Date();
        const formatted = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        setJourneyDate(formatted);
    }, []);

    const loadRecentSearches = async () => {
        const searches = await getRecentSearches();
        setRecentSearches(searches);
    };

    const handleTrainInput = (text: string) => {
        setTrainNumber(text);
        if (text.length >= 2) {
            const sugg = getTrainSuggestions(text);
            setSuggestions(sugg);
            setShowSuggestions(sugg.length > 0);
        } else {
            setSuggestions([]);
            setShowSuggestions(false);
        }
    };

    const selectTrain = (number: string) => {
        setTrainNumber(number);
        setShowSuggestions(false);
        const stns = getStationsForTrain(number);
        setStations(stns);
        // Get running days for this train
        const days = getTrainRunningDays(number);
        setRunningDays(days);
        // Reset station selections
        setFromStation('');
        setToStation('');
        setFromStationName('');
        setToStationName('');
    };

    const selectStation = (code: string, name: string) => {
        if (showStationModal === 'from') {
            setFromStation(code);
            setFromStationName(name);
        } else {
            setToStation(code);
            setToStationName(name);
        }
        setShowStationModal(null);
    };

    const handleSearch = () => {
        if (!trainNumber || !fromStation || !toStation) return;

        router.push({
            pathname: '/results',
            params: {
                trainNumber,
                journeyDate,
                fromStation,
                toStation,
                fromStationName,
                toStationName,
            },
        });
    };

    const selectLanguage = (newLang: Language) => {
        setLanguage(newLang);
        setLang(newLang);
        setShowLangModal(false);
    };

    const clearForm = () => {
        setTrainNumber('');
        setSuggestions([]);
        setShowSuggestions(false);
        setStations([]);
        setFromStation('');
        setToStation('');
        setFromStationName('');
        setToStationName('');
        // Reset date to today
        const today = new Date();
        const formatted = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        setJourneyDate(formatted);
        setRunningDays(null);
    };

    const currentLangOption = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0];

    const handleRecentSearch = (search: RecentSearch) => {
        router.push({
            pathname: '/results',
            params: {
                trainNumber: search.trainNumber,
                journeyDate: search.date,
                fromStation: search.fromStation,
                toStation: search.toStation,
                fromStationName: search.fromStationName,
                toStationName: search.toStationName,
            },
        });
    };

    const isSearchEnabled = trainNumber.length >= 4 && fromStation && toStation;

    return (
        <LinearGradient
            colors={Colors.background.dark as any}
            style={styles.container}
        >
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* Header */}
                <Animated.View
                    style={[
                        styles.header,
                        {
                            opacity: fadeAnim,
                            transform: [{ scale: logoScale }],
                        },
                    ]}
                >
                    <View style={styles.headerTop}>
                        <TouchableOpacity
                            onPress={() => {
                                setShowMenu(true);
                                Animated.spring(menuSlide, {
                                    toValue: 0,
                                    tension: 65,
                                    friction: 11,
                                    useNativeDriver: true,
                                }).start();
                            }}
                            style={styles.hamburgerBtn}
                        >
                            <Ionicons name="menu" size={24} color="#fff" />
                        </TouchableOpacity>
                        <View style={styles.logoContainer}>
                            <LinearGradient
                                colors={[Colors.primary.start, Colors.primary.end]}
                                style={styles.logoIcon}
                            >
                                <MaterialCommunityIcons name="train" size={28} color="#fff" />
                            </LinearGradient>
                            <View>
                                <Text style={styles.appName}>{t('appName')}</Text>
                                <Text style={styles.tagline}>{t('tagline')}</Text>
                            </View>
                        </View>
                        <View style={styles.headerActions}>
                            <TouchableOpacity onPress={() => setShowLangModal(true)} style={styles.langBtn}>
                                <Ionicons name="language" size={14} color="rgba(255,255,255,0.7)" />
                                <Text style={styles.langText}>{currentLangOption.shortLabel}</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Animated.View>

                {/* Search Card */}
                <Animated.View
                    style={[
                        styles.searchCard,
                        {
                            opacity: fadeAnim,
                            transform: [{ translateY: slideAnim }],
                        },
                    ]}
                >
                    <LinearGradient
                        colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
                        style={styles.cardGradient}
                    >
                        <View style={styles.searchTitleRow}>
                            <Text style={styles.searchTitle}>{t('searchTitle')}</Text>
                            <TouchableOpacity onPress={clearForm} style={styles.clearBtn}>
                                <Ionicons name="refresh" size={14} color="rgba(255,255,255,0.6)" />
                                <Text style={styles.clearBtnText}>{t('clearAll')}</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Train Number Input */}
                        <View style={styles.inputContainer}>
                            <Ionicons name="train-outline" size={20} color={Colors.primary.start} style={styles.inputIcon} />
                            <TextInput
                                style={styles.input}
                                placeholder={t('trainNumberPlaceholder')}
                                placeholderTextColor="rgba(255,255,255,0.35)"
                                value={trainNumber}
                                onChangeText={handleTrainInput}
                                keyboardType="number-pad"
                                maxLength={5}
                            />
                            {trainNumber.length > 0 && (
                                <TouchableOpacity onPress={() => { setTrainNumber(''); setSuggestions([]); setStations([]); }}>
                                    <Ionicons name="close-circle" size={20} color="rgba(255,255,255,0.5)" />
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Train Suggestions */}
                        {showSuggestions && (
                            <View style={styles.suggestionsContainer}>
                                {suggestions.map((sugg) => (
                                    <TouchableOpacity
                                        key={sugg.number}
                                        style={styles.suggestionItem}
                                        onPress={() => selectTrain(sugg.number)}
                                    >
                                        <MaterialCommunityIcons name="train" size={16} color={Colors.primary.start} />
                                        <Text style={styles.suggestionNumber}>{sugg.number}</Text>
                                        <Text style={styles.suggestionName} numberOfLines={1}>{sugg.name}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        )}

                        {/* Journey Date */}
                        <DatePicker
                            value={journeyDate}
                            onChange={setJourneyDate}
                            label={t('journeyDate')}
                            runningDays={runningDays}
                        />

                        {/* Station Selection */}
                        <View style={styles.stationRow}>
                            <TouchableOpacity
                                style={[styles.stationInput, !stations.length && styles.stationInputDisabled]}
                                onPress={() => stations.length > 0 && setShowStationModal('from')}
                                disabled={!stations.length}
                            >
                                <View style={styles.stationDot}>
                                    <View style={[styles.dot, { backgroundColor: Colors.success.end }]} />
                                </View>
                                <View style={styles.stationTextContainer}>
                                    <Text style={styles.stationLabel}>{t('fromStation')}</Text>
                                    <Text style={styles.stationValue} numberOfLines={1}>
                                        {fromStation ? `${fromStation} - ${fromStationName}` : t('selectStation')}
                                    </Text>
                                </View>
                            </TouchableOpacity>

                            {/* Swap Button */}
                            <TouchableOpacity
                                style={styles.swapBtn}
                                onPress={() => {
                                    const tempCode = fromStation;
                                    const tempName = fromStationName;
                                    setFromStation(toStation);
                                    setFromStationName(toStationName);
                                    setToStation(tempCode);
                                    setToStationName(tempName);
                                }}
                            >
                                <Ionicons name="swap-vertical" size={20} color="#fff" />
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.stationInput, !stations.length && styles.stationInputDisabled]}
                                onPress={() => stations.length > 0 && setShowStationModal('to')}
                                disabled={!stations.length}
                            >
                                <View style={styles.stationDot}>
                                    <View style={[styles.dot, { backgroundColor: Colors.danger.end }]} />
                                </View>
                                <View style={styles.stationTextContainer}>
                                    <Text style={styles.stationLabel}>{t('toStation')}</Text>
                                    <Text style={styles.stationValue} numberOfLines={1}>
                                        {toStation ? `${toStation} - ${toStationName}` : t('selectStation')}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        </View>

                        {/* Search Button */}
                        <TouchableOpacity
                            onPress={handleSearch}
                            disabled={!isSearchEnabled}
                            activeOpacity={0.8}
                        >
                            <LinearGradient
                                colors={
                                    isSearchEnabled
                                        ? [Colors.primary.start, Colors.primary.end]
                                        : ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']
                                }
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={[styles.searchButton, !isSearchEnabled && styles.searchButtonDisabled]}
                            >
                                <Ionicons name="search" size={20} color="#fff" />
                                <Text style={styles.searchButtonText}>{t('search')}</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </LinearGradient>
                </Animated.View>

                {/* Language Picker Modal */}
                <Modal
                    visible={showLangModal}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setShowLangModal(false)}
                >
                    <TouchableOpacity
                        style={styles.langModalOverlay}
                        activeOpacity={1}
                        onPress={() => setShowLangModal(false)}
                    >
                        <TouchableOpacity activeOpacity={1} onPress={() => { }}>
                            <View style={styles.langModalContent}>
                                <LinearGradient
                                    colors={['#1a1640', '#2d2460', '#1a1640']}
                                    style={styles.langModalGradient}
                                >
                                    <View style={styles.langModalHeader}>
                                        <Ionicons name="language" size={20} color={Colors.primary.start} />
                                        <Text style={styles.langModalTitle}>Select Language</Text>
                                    </View>
                                    {LANGUAGES.map((langOption) => (
                                        <TouchableOpacity
                                            key={langOption.code}
                                            style={[
                                                styles.langOption,
                                                lang === langOption.code && styles.langOptionActive,
                                            ]}
                                            onPress={() => selectLanguage(langOption.code)}
                                        >
                                            <View style={styles.langOptionLeft}>
                                                <Text style={styles.langOptionShort}>{langOption.shortLabel}</Text>
                                                <View>
                                                    <Text style={styles.langOptionName}>{langOption.nativeName}</Text>
                                                    <Text style={styles.langOptionEnName}>{langOption.name}</Text>
                                                </View>
                                            </View>
                                            {lang === langOption.code && (
                                                <Ionicons name="checkmark-circle" size={22} color={Colors.primary.start} />
                                            )}
                                        </TouchableOpacity>
                                    ))}
                                </LinearGradient>
                            </View>
                        </TouchableOpacity>
                    </TouchableOpacity>
                </Modal>

                {/* Quick Tips */}
                <Animated.View style={[styles.tipsContainer, { opacity: fadeAnim }]}>
                    <View style={styles.tipCard}>
                        <LinearGradient
                            colors={[Colors.success.start, Colors.success.end]}
                            style={styles.tipIconBg}
                        >
                            <Ionicons name="information-circle" size={18} color="#fff" />
                        </LinearGradient>
                        <View style={styles.tipContent}>
                            <Text style={styles.tipTitle}>How it works</Text>
                            <Text style={styles.tipText}>
                                Charts are prepared ~4 hours before departure. Enter your train details to see vacant seats after chart preparation.
                            </Text>
                        </View>
                    </View>
                </Animated.View>

                {/* Recent Searches */}
                {recentSearches.length > 0 && (
                    <Animated.View style={[styles.recentContainer, { opacity: fadeAnim }]}>
                        <Text style={styles.sectionTitle}>{t('recentSearches')}</Text>
                        {recentSearches.slice(0, 5).map((search, idx) => (
                            <TouchableOpacity
                                key={`${search.trainNumber}-${idx}`}
                                style={styles.recentItem}
                                onPress={() => handleRecentSearch(search)}
                            >
                                <LinearGradient
                                    colors={[Colors.primary.start, Colors.primary.end]}
                                    style={styles.recentIcon}
                                >
                                    <Ionicons name="time-outline" size={16} color="#fff" />
                                </LinearGradient>
                                <View style={styles.recentInfo}>
                                    <Text style={styles.recentTrain}>{search.trainNumber} - {search.trainName}</Text>
                                    <Text style={styles.recentRoute}>
                                        {search.fromStationName} → {search.toStationName}
                                    </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.4)" />
                            </TouchableOpacity>
                        ))}
                    </Animated.View>
                )}

                {/* Demo trains hint */}
                <View style={styles.demoHint}>
                    <Ionicons name="bulb-outline" size={16} color={Colors.warning.start} />
                    <Text style={styles.demoHintText}>
                        Try trains: 12301, 12951, 12003, 12049, 12259
                    </Text>
                </View>
            </ScrollView>

            {/* Hamburger Side Menu */}
            <Modal
                visible={showMenu}
                transparent
                animationType="none"
                onRequestClose={() => {
                    Animated.timing(menuSlide, { toValue: -width, duration: 250, useNativeDriver: true }).start(() => setShowMenu(false));
                }}
            >
                <View style={styles.menuOverlay}>
                    <TouchableOpacity
                        style={styles.menuBackdrop}
                        activeOpacity={1}
                        onPress={() => {
                            Animated.timing(menuSlide, { toValue: -width, duration: 250, useNativeDriver: true }).start(() => setShowMenu(false));
                        }}
                    />
                    <Animated.View style={[styles.menuDrawer, { transform: [{ translateX: menuSlide }] }]}>
                        <LinearGradient
                            colors={Colors.background.dark as any}
                            style={styles.menuGradient}
                        >
                            <View style={styles.menuHeader}>
                                <View style={styles.menuLogoRow}>
                                    <LinearGradient
                                        colors={[Colors.primary.start, Colors.primary.end]}
                                        style={styles.menuLogoIcon}
                                    >
                                        <MaterialCommunityIcons name="train" size={20} color="#fff" />
                                    </LinearGradient>
                                    <Text style={styles.menuLogoText}>{t('appName')}</Text>
                                </View>
                                <TouchableOpacity
                                    onPress={() => {
                                        Animated.timing(menuSlide, { toValue: -width, duration: 250, useNativeDriver: true }).start(() => setShowMenu(false));
                                    }}
                                >
                                    <Ionicons name="close" size={24} color="rgba(255,255,255,0.6)" />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.menuItems}>
                                {[
                                    { icon: 'ticket-confirmation-outline', label: 'PNR Search', sub: 'Track PNR & vacancy', route: '/pnr', colors: [Colors.primary.start, Colors.primary.end], ionicon: false },
                                    { icon: 'swap-horizontal-bold', label: 'Seat Swap', sub: 'Exchange berths P2P', route: '/swap', colors: [Colors.accent.start, Colors.accent.end], ionicon: false },
                                    { icon: 'toilet', label: 'Toilet Status', sub: 'Coach conditions', route: '/toilets', colors: [Colors.success.start, Colors.success.end], ionicon: false },
                                    { icon: 'star-outline', label: 'Favorites', sub: 'Saved routes', route: '/favorites', colors: [Colors.warning.start, Colors.warning.end], ionicon: true },
                                    { icon: 'cog-outline', label: 'Settings', sub: 'App preferences', route: '/settings', colors: ['#8B8B9E', '#6C6C80'], ionicon: true },
                                ].map((item) => (
                                    <TouchableOpacity
                                        key={item.route}
                                        style={styles.menuItem}
                                        activeOpacity={0.7}
                                        onPress={() => {
                                            Animated.timing(menuSlide, { toValue: -width, duration: 200, useNativeDriver: true }).start(() => {
                                                setShowMenu(false);
                                                router.push(item.route as any);
                                            });
                                        }}
                                    >
                                        <LinearGradient
                                            colors={item.colors as any}
                                            style={styles.menuItemIcon}
                                        >
                                            {item.ionicon ? (
                                                <Ionicons name={item.icon as any} size={20} color="#fff" />
                                            ) : (
                                                <MaterialCommunityIcons name={item.icon as any} size={20} color="#fff" />
                                            )}
                                        </LinearGradient>
                                        <View style={styles.menuItemText}>
                                            <Text style={styles.menuItemLabel}>{item.label}</Text>
                                            <Text style={styles.menuItemSub}>{item.sub}</Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.25)" />
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <View style={styles.menuFooter}>
                                <View style={styles.menuDataBadge}>
                                    <View style={[styles.dataSourceDot, { backgroundColor: isUsingLiveAPI() ? Colors.vacant : Colors.rac }]} />
                                    <Text style={styles.menuDataText}>{isUsingLiveAPI() ? 'Connected to Live API' : 'Using Mock Data'}</Text>
                                </View>
                            </View>
                        </LinearGradient>
                    </Animated.View>
                </View>
            </Modal>

            {/* Station Selection Modal */}
            <Modal
                visible={showStationModal !== null}
                transparent
                animationType="slide"
                onRequestClose={() => setShowStationModal(null)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <LinearGradient
                            colors={Colors.background.dark as any}
                            style={styles.modalGradient}
                        >
                            <View style={styles.modalHeader}>
                                <Text style={styles.modalTitle}>
                                    {showStationModal === 'from' ? t('fromStation') : t('toStation')}
                                </Text>
                                <TouchableOpacity onPress={() => setShowStationModal(null)}>
                                    <Ionicons name="close" size={24} color="#fff" />
                                </TouchableOpacity>
                            </View>
                            <FlatList
                                data={stations}
                                keyExtractor={(item) => item.code}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={styles.modalItem}
                                        onPress={() => selectStation(item.code, item.name)}
                                    >
                                        <View style={styles.modalItemLeft}>
                                            <Text style={styles.modalItemCode}>{item.code}</Text>
                                            <Text style={styles.modalItemName}>{item.name}</Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.4)" />
                                    </TouchableOpacity>
                                )}
                            />
                        </LinearGradient>
                    </View>
                </View>
            </Modal>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        paddingTop: Platform.OS === 'ios' ? 60 : 45,
        paddingBottom: 40,
        paddingHorizontal: 20,
    },
    header: {
        marginBottom: 24,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
    },
    logoContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    logoIcon: {
        width: 48,
        height: 48,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
    },
    appName: {
        fontSize: 20,
        fontWeight: '800',
        color: '#fff',
        letterSpacing: 0.5,
    },
    tagline: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.6)',
        letterSpacing: 1,
        textTransform: 'uppercase',
    },
    langBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    langText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flexShrink: 0,
    },
    settingsBtn: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 12,
        width: 38,
        height: 38,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    searchCard: {
        borderRadius: 20,
        overflow: 'hidden',
        marginBottom: 20,
        borderWidth: 1,
        borderColor: Colors.glass.border,
    },
    cardGradient: {
        padding: 20,
    },
    searchTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
    },
    searchTitleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 18,
    },
    clearBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    clearBtnText: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 12,
        fontWeight: '600',
    },
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
    input: {
        flex: 1,
        color: '#fff',
        fontSize: 16,
        height: 52,
    },
    suggestionsContainer: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 12,
        marginBottom: 12,
        marginTop: -8,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    suggestionItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
        gap: 8,
    },
    suggestionNumber: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 14,
        minWidth: 50,
    },
    suggestionName: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 13,
        flex: 1,
    },
    stationRow: {
        gap: 8,
        marginBottom: 16,
    },
    stationInput: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.07)',
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    stationInputDisabled: {
        opacity: 0.4,
    },
    stationDot: {
        marginRight: 12,
    },
    dot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    stationTextContainer: {
        flex: 1,
    },
    stationLabel: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.5)',
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 2,
    },
    stationValue: {
        fontSize: 15,
        color: '#fff',
        fontWeight: '600',
    },
    swapBtn: {
        alignSelf: 'center',
        backgroundColor: Colors.primary.start,
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginVertical: -4,
        zIndex: 1,
    },
    searchButton: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 16,
        borderRadius: 14,
        gap: 8,
    },
    searchButtonDisabled: {
        opacity: 0.5,
    },
    searchButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '700',
        letterSpacing: 0.5,
    },
    tipsContainer: {
        marginBottom: 20,
    },
    tipCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
        gap: 12,
    },
    tipIconBg: {
        width: 32,
        height: 32,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    tipContent: {
        flex: 1,
    },
    tipTitle: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
        marginBottom: 4,
    },
    tipText: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 12,
        lineHeight: 18,
    },
    recentContainer: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#fff',
        marginBottom: 12,
    },
    recentItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
        gap: 12,
    },
    recentIcon: {
        width: 32,
        height: 32,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    recentInfo: {
        flex: 1,
    },
    recentTrain: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '600',
    },
    recentRoute: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 12,
        marginTop: 2,
    },
    demoHint: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 8,
        paddingVertical: 12,
        backgroundColor: 'rgba(242, 201, 76, 0.08)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(242, 201, 76, 0.15)',
    },
    demoHintText: {
        color: Colors.warning.start,
        fontSize: 13,
        fontWeight: '500',
    },
    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.7)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: 'hidden',
        maxHeight: height * 0.6,
    },
    modalGradient: {
        padding: 20,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#fff',
    },
    modalItem: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.06)',
    },
    modalItemLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    modalItemCode: {
        color: Colors.primary.start,
        fontSize: 15,
        fontWeight: '800',
        minWidth: 48,
    },
    modalItemName: {
        color: '#fff',
        fontSize: 15,
    },
    // Language picker modal
    langModalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    langModalContent: {
        borderRadius: 20,
        overflow: 'hidden',
        width: width - 50,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)',
    },
    langModalGradient: {
        padding: 20,
    },
    langModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 16,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.08)',
    },
    langModalTitle: {
        color: '#fff',
        fontSize: 17,
        fontWeight: '700',
    },
    langOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        paddingHorizontal: 10,
        borderRadius: 12,
        marginBottom: 4,
    },
    langOptionActive: {
        backgroundColor: 'rgba(102, 126, 234, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(102, 126, 234, 0.2)',
    },
    langOptionLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
    },
    langOptionShort: {
        color: Colors.primary.start,
        fontSize: 16,
        fontWeight: '800',
        minWidth: 32,
        textAlign: 'center',
    },
    langOptionName: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
    },
    langOptionEnName: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 12,
        marginTop: 1,
    },
    taglineRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    dataSourceBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 3,
    },
    dataSourceDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    dataSourceText: {
        color: 'rgba(255,255,255,0.6)',
        fontSize: 10,
        fontWeight: '600',
    },
    hamburgerBtn: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.08)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    menuOverlay: {
        flex: 1,
        flexDirection: 'row',
    },
    menuBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    menuDrawer: {
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: width * 0.78,
        shadowColor: '#000',
        shadowOffset: { width: 4, height: 0 },
        shadowOpacity: 0.4,
        shadowRadius: 20,
        elevation: 20,
    },
    menuGradient: {
        flex: 1,
        paddingTop: Platform.OS === 'ios' ? 60 : 45,
        paddingHorizontal: 20,
        paddingBottom: 30,
    },
    menuHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 30,
        paddingBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.08)',
    },
    menuLogoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    menuLogoIcon: {
        width: 36,
        height: 36,
        borderRadius: 10,
        justifyContent: 'center',
        alignItems: 'center',
    },
    menuLogoText: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '800',
    },
    menuItems: {
        flex: 1,
        gap: 4,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        paddingVertical: 14,
        paddingHorizontal: 4,
        borderRadius: 12,
    },
    menuItemIcon: {
        width: 40,
        height: 40,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    menuItemText: {
        flex: 1,
    },
    menuItemLabel: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '700',
    },
    menuItemSub: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 12,
        marginTop: 2,
    },
    menuFooter: {
        paddingTop: 16,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255,255,255,0.08)',
    },
    menuDataBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 8,
    },
    menuDataText: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 12,
    },
});
