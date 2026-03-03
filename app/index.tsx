import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    Animated,
    BackHandler,
    Dimensions,
    Modal,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Colors from '../constants/Colors';
import { getLanguage, Language, LANGUAGES, setLanguage } from '../services/localization';
import { getOrCreateDeviceId } from '../services/swapStore';

const { width } = Dimensions.get('window');

/**
 * RailMitra V1 — Home Screen
 * 
 * Warm light theme, senior-friendly layout.
 * Big buttons, clear text, spacious cards.
 */
export default function HomeScreen() {
    const [lang, setLang] = useState<Language>(getLanguage());
    const [showLangModal, setShowLangModal] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [deviceId, setDeviceId] = useState('');
    const menuSlide = useState(new Animated.Value(-width))[0];

    // Animations
    const fadeIn = useState(new Animated.Value(0))[0];
    const slideUp = useState(new Animated.Value(30))[0];
    const heroScale = useState(new Animated.Value(0.9))[0];
    const stagger1 = useState(new Animated.Value(0))[0];
    const stagger2 = useState(new Animated.Value(0))[0];
    const stagger3 = useState(new Animated.Value(0))[0];

    useEffect(() => {
        getOrCreateDeviceId().then(id => setDeviceId(id));

        Animated.parallel([
            Animated.timing(fadeIn, { toValue: 1, duration: 600, useNativeDriver: true }),
            Animated.spring(slideUp, { toValue: 0, tension: 50, friction: 9, useNativeDriver: true }),
            Animated.spring(heroScale, { toValue: 1, tension: 40, friction: 7, useNativeDriver: true }),
        ]).start();

        setTimeout(() => Animated.timing(stagger1, { toValue: 1, duration: 350, useNativeDriver: true }).start(), 300);
        setTimeout(() => Animated.timing(stagger2, { toValue: 1, duration: 350, useNativeDriver: true }).start(), 450);
        setTimeout(() => Animated.timing(stagger3, { toValue: 1, duration: 350, useNativeDriver: true }).start(), 600);
    }, []);

    // Android back button exits app from home screen
    useEffect(() => {
        const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
            BackHandler.exitApp();
            return true;
        });
        return () => backHandler.remove();
    }, []);

    const selectLanguage = (newLang: Language) => {
        setLanguage(newLang);
        setLang(newLang);
        setShowLangModal(false);
    };

    const closeMenu = () => {
        Animated.timing(menuSlide, { toValue: -width, duration: 250, useNativeDriver: true }).start(() => setShowMenu(false));
    };

    const openMenu = () => {
        setShowMenu(true);
        Animated.spring(menuSlide, { toValue: 0, tension: 65, friction: 11, useNativeDriver: true }).start();
    };

    const currentLangOption = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0];

    return (
        <View style={styles.container}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <Animated.View style={[styles.header, { opacity: fadeIn }]}>
                    <TouchableOpacity onPress={openMenu} style={styles.menuBtn}>
                        <Ionicons name="menu" size={22} color={Colors.text.primary} />
                    </TouchableOpacity>
                    <View style={styles.logoRow}>
                        <LinearGradient
                            colors={[Colors.primary.start, Colors.primary.end]}
                            style={styles.logoIcon}
                        >
                            <MaterialCommunityIcons name="train" size={22} color="#fff" />
                        </LinearGradient>
                        <View>
                            <Text style={styles.appName}>RailMitra</Text>
                            <Text style={styles.tagline}>Your Train Companion</Text>
                        </View>
                    </View>
                    <View style={styles.betaBadge}>
                        <Text style={styles.betaText}>BETA</Text>
                    </View>
                    <TouchableOpacity onPress={() => setShowLangModal(true)} style={styles.langBtn}>
                        <Ionicons name="language" size={16} color={Colors.primary.start} />
                        <Text style={styles.langText}>{currentLangOption.shortLabel}</Text>
                    </TouchableOpacity>
                </Animated.View>

                {/* Hero Card */}
                <Animated.View style={[styles.heroCard, {
                    opacity: fadeIn,
                    transform: [{ scale: heroScale }, { translateY: slideUp }],
                }]}>
                    <LinearGradient
                        colors={[Colors.primary.start, Colors.primary.end]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.heroGradient}
                    >
                        <View style={styles.heroIconCircle}>
                            <MaterialCommunityIcons name="swap-horizontal-bold" size={32} color="#fff" />
                        </View>
                        <Text style={styles.heroTitle}>Exchange Your Berth</Text>
                        <Text style={styles.heroDesc}>
                            Find passengers on your train who want to swap seats.{'\n'}Works completely offline!
                        </Text>

                        {/* Stats row */}
                        <View style={styles.heroStats}>
                            {[
                                { emoji: '📡', label: 'P2P Mesh' },
                                { emoji: '🔒', label: 'No Login' },
                                { emoji: '📴', label: 'Offline' },
                            ].map((stat, idx) => (
                                <React.Fragment key={idx}>
                                    {idx > 0 && <View style={styles.heroStatDivider} />}
                                    <View style={styles.heroStat}>
                                        <Text style={styles.heroStatEmoji}>{stat.emoji}</Text>
                                        <Text style={styles.heroStatLabel}>{stat.label}</Text>
                                    </View>
                                </React.Fragment>
                            ))}
                        </View>
                    </LinearGradient>
                </Animated.View>

                {/* Main CTA */}
                <TouchableOpacity
                    onPress={() => router.push('/swap')}
                    activeOpacity={0.85}
                    style={styles.ctaWrapper}
                >
                    <LinearGradient
                        colors={[Colors.primary.start, Colors.primary.end]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.ctaButton}
                    >
                        <MaterialCommunityIcons name="swap-horizontal-bold" size={20} color="#fff" />
                        <Text style={styles.ctaText}>Start Swapping</Text>
                        <Ionicons name="arrow-forward" size={18} color="#fff" />
                    </LinearGradient>
                </TouchableOpacity>

                {/* Feature Cards */}
                <Animated.View style={[styles.featureCard, { opacity: stagger1 }]}>
                    <View style={[styles.featureIconBox, { backgroundColor: Colors.success.light }]}>
                        <MaterialCommunityIcons name="graph" size={22} color={Colors.success.start} />
                    </View>
                    <View style={styles.featureContent}>
                        <Text style={styles.featureTitle}>Smart Matching</Text>
                        <Text style={styles.featureDesc}>
                            Graph algorithm finds optimal swap cycles — even multi-party chains.
                        </Text>
                    </View>
                </Animated.View>

                <Animated.View style={[styles.featureCard, { opacity: stagger2 }]}>
                    <View style={[styles.featureIconBox, { backgroundColor: Colors.accent.light }]}>
                        <Ionicons name="accessibility" size={22} color={Colors.accent.start} />
                    </View>
                    <View style={styles.featureContent}>
                        <Text style={styles.featureTitle}>Priority for Seniors</Text>
                        <Text style={styles.featureDesc}>
                            Elderly and medical passengers get automatic priority in swap matching.
                        </Text>
                    </View>
                </Animated.View>

                <Animated.View style={[styles.featureCard, { opacity: stagger3 }]}>
                    <View style={[styles.featureIconBox, { backgroundColor: Colors.primary.light }]}>
                        <MaterialCommunityIcons name="shield-check" size={22} color={Colors.primary.start} />
                    </View>
                    <View style={styles.featureContent}>
                        <Text style={styles.featureTitle}>Privacy First</Text>
                        <Text style={styles.featureDesc}>
                            No accounts, no personal data. Swap data stays on your phone.
                        </Text>
                    </View>
                </Animated.View>

                {/* How It Works */}
                <View style={styles.howSection}>
                    <Text style={styles.sectionTitle}>How It Works</Text>
                    {[
                        { step: '1', text: 'Enter your train number' },
                        { step: '2', text: 'Browse swap offers from nearby passengers' },
                        { step: '3', text: 'Register your offer or accept a match' },
                        { step: '4', text: 'Walk to the seat and swap!' },
                    ].map((item, idx) => (
                        <View key={idx} style={styles.howStep}>
                            <LinearGradient
                                colors={[Colors.primary.start, Colors.primary.end]}
                                style={styles.howStepBadge}
                            >
                                <Text style={styles.howStepNum}>{item.step}</Text>
                            </LinearGradient>
                            <Text style={styles.howStepText}>{item.text}</Text>
                        </View>
                    ))}
                </View>

                {/* Coming Soon */}
                <View style={styles.comingSoon}>
                    <Text style={styles.comingSoonTitle}>COMING SOON</Text>
                    <View style={styles.comingSoonGrid}>
                        {[
                            { icon: 'ticket-confirmation-outline', label: 'PNR Tracking' },
                            { icon: 'seat-passenger', label: 'Seat Availability' },
                            { icon: 'train-car', label: 'Live Status' },
                            { icon: 'toilet', label: 'Coach Conditions' },
                        ].map((item, idx) => (
                            <View key={idx} style={styles.comingSoonItem}>
                                <MaterialCommunityIcons name={item.icon as any} size={18} color={Colors.text.tertiary} />
                                <Text style={styles.comingSoonLabel}>{item.label}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Device footer */}
                <View style={styles.deviceFooter}>
                    <Ionicons name="finger-print" size={13} color={Colors.text.tertiary} />
                    <Text style={styles.deviceText}>
                        Device: {deviceId ? `${deviceId.substring(0, 8)}...` : 'Loading'}
                    </Text>
                </View>
            </ScrollView>

            {/* Language Modal */}
            <Modal visible={showLangModal} transparent animationType="fade" onRequestClose={() => setShowLangModal(false)}>
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowLangModal(false)}>
                    <TouchableOpacity activeOpacity={1} onPress={() => { }}>
                        <View style={styles.langModalContent}>
                            <View style={styles.langModalHeader}>
                                <Ionicons name="language" size={20} color={Colors.primary.start} />
                                <Text style={styles.langModalTitle}>Select Language</Text>
                            </View>
                            <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
                                {LANGUAGES.map((langOption) => (
                                    <TouchableOpacity
                                        key={langOption.code}
                                        style={[styles.langOption, lang === langOption.code && styles.langOptionActive]}
                                        onPress={() => selectLanguage(langOption.code)}
                                    >
                                        <View style={styles.langOptionLeft}>
                                            <View style={[styles.langShortBadge, lang === langOption.code && styles.langShortBadgeActive]}>
                                                <Text style={[styles.langShortText, lang === langOption.code && styles.langShortTextActive]}>
                                                    {langOption.shortLabel}
                                                </Text>
                                            </View>
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
                            </ScrollView>
                        </View>
                    </TouchableOpacity>
                </TouchableOpacity>
            </Modal>

            {/* Side Menu */}
            <Modal
                visible={showMenu}
                transparent
                animationType="none"
                onRequestClose={closeMenu}
            >
                <View style={styles.menuOverlay}>
                    <TouchableOpacity style={styles.menuBackdrop} activeOpacity={1} onPress={closeMenu} />
                    <Animated.View style={[styles.menuDrawer, { transform: [{ translateX: menuSlide }] }]}>
                        <View style={styles.menuContainer}>
                            {/* Menu Header */}
                            <View style={styles.menuHeader}>
                                <View style={styles.menuLogoRow}>
                                    <LinearGradient colors={[Colors.primary.start, Colors.primary.end]} style={styles.menuLogoIcon}>
                                        <MaterialCommunityIcons name="train" size={18} color="#fff" />
                                    </LinearGradient>
                                    <Text style={styles.menuLogoText}>RailMitra</Text>
                                </View>
                                <TouchableOpacity onPress={closeMenu} style={styles.menuCloseBtn}>
                                    <Ionicons name="close" size={22} color={Colors.text.secondary} />
                                </TouchableOpacity>
                            </View>

                            {/* Menu Items */}
                            <View style={styles.menuItems}>
                                {[
                                    { icon: 'swap-horizontal-bold', label: 'Seat Swap', sub: 'Exchange berths P2P', route: '/swap', color: Colors.primary.start, ionicon: false },
                                    { icon: 'time-outline', label: 'Swap History', sub: 'Your past swaps', route: '/history', color: Colors.accent.start, ionicon: true },
                                    { icon: 'information-circle-outline', label: 'About', sub: 'About this app', route: '/about', color: Colors.text.tertiary, ionicon: true },
                                    { icon: 'shield-checkmark-outline', label: 'Privacy Policy', sub: 'How we protect you', route: '/privacy', color: Colors.success.start, ionicon: true },
                                    { icon: 'document-text-outline', label: 'Terms of Use', sub: 'Usage terms', route: '/terms', color: Colors.text.tertiary, ionicon: true },
                                    { icon: 'cog-outline', label: 'Settings', sub: 'App preferences', route: '/settings', color: Colors.text.tertiary, ionicon: true },
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
                                        <View style={[styles.menuItemIconBox, { backgroundColor: `${item.color}15` }]}>
                                            {item.ionicon ? (
                                                <Ionicons name={item.icon as any} size={20} color={item.color} />
                                            ) : (
                                                <MaterialCommunityIcons name={item.icon as any} size={20} color={item.color} />
                                            )}
                                        </View>
                                        <View style={styles.menuItemTextBox}>
                                            <Text style={styles.menuItemLabel}>{item.label}</Text>
                                            <Text style={styles.menuItemSub}>{item.sub}</Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={16} color={Colors.divider} />
                                    </TouchableOpacity>
                                ))}
                            </View>

                            {/* Menu Footer */}
                            <View style={styles.menuFooter}>
                                <Text style={styles.menuFooterText}>v1.0 · Offline-First</Text>
                            </View>
                        </View>
                    </Animated.View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background.primary },
    scrollContent: {
        paddingTop: Platform.OS === 'ios' ? 58 : 42,
        paddingBottom: 40, paddingHorizontal: 20,
    },

    // Header
    header: {
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between', marginBottom: 22,
    },
    menuBtn: {
        width: 44, height: 44, borderRadius: 14,
        backgroundColor: Colors.card.background,
        justifyContent: 'center', alignItems: 'center',
        shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1, shadowRadius: 6, elevation: 3,
    },
    logoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, paddingLeft: 12 },
    logoIcon: {
        width: 40, height: 40, borderRadius: 12,
        justifyContent: 'center', alignItems: 'center',
    },
    appName: { fontSize: 20, fontWeight: '800', color: Colors.text.primary },
    tagline: {
        fontSize: 11, color: Colors.text.tertiary,
        letterSpacing: 1, textTransform: 'uppercase', marginTop: 1,
    },
    betaBadge: {
        backgroundColor: Colors.warning.light,
        paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
        marginRight: 6,
    },
    betaText: {
        color: Colors.warning.start, fontSize: 10, fontWeight: '800', letterSpacing: 1,
    },
    langBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 5,
        backgroundColor: Colors.primary.light, borderRadius: 12,
        paddingHorizontal: 12, paddingVertical: 8,
    },
    langText: { color: Colors.primary.start, fontSize: 14, fontWeight: '700' },

    // Hero
    heroCard: { borderRadius: 20, overflow: 'hidden', marginBottom: 16 },
    heroGradient: { padding: 24, alignItems: 'center' },
    heroIconCircle: {
        width: 64, height: 64, borderRadius: 32,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center', alignItems: 'center',
        marginBottom: 14,
    },
    heroTitle: { color: '#fff', fontSize: 22, fontWeight: '800', marginBottom: 8, textAlign: 'center' },
    heroDesc: {
        color: 'rgba(255,255,255,0.85)', fontSize: 14, lineHeight: 21,
        textAlign: 'center', marginBottom: 18,
    },
    heroStats: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.12)', borderRadius: 12,
        paddingVertical: 12, paddingHorizontal: 16, width: '100%',
    },
    heroStat: { flex: 1, alignItems: 'center', gap: 3 },
    heroStatEmoji: { fontSize: 18 },
    heroStatLabel: {
        color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '600', textAlign: 'center',
    },
    heroStatDivider: {
        width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.15)', marginHorizontal: 4,
    },

    // CTA
    ctaWrapper: { marginBottom: 22 },
    ctaButton: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingVertical: 16, borderRadius: 16, gap: 10,
        shadowColor: Colors.primary.start, shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3, shadowRadius: 12, elevation: 6,
    },
    ctaText: { color: '#fff', fontSize: 16, fontWeight: '800' },

    // Features
    featureCard: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 14,
        backgroundColor: Colors.card.background, borderRadius: 16,
        padding: 16, marginBottom: 10,
        shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1, shadowRadius: 8, elevation: 2,
    },
    featureIconBox: {
        width: 44, height: 44, borderRadius: 13,
        justifyContent: 'center', alignItems: 'center',
    },
    featureContent: { flex: 1 },
    featureTitle: { color: Colors.text.primary, fontSize: 15, fontWeight: '700', marginBottom: 3 },
    featureDesc: { color: Colors.text.secondary, fontSize: 13, lineHeight: 19 },

    // How it works
    howSection: {
        marginTop: 14, marginBottom: 18,
        backgroundColor: Colors.card.background, borderRadius: 18,
        padding: 20,
        shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1, shadowRadius: 8, elevation: 2,
    },
    sectionTitle: { color: Colors.text.primary, fontSize: 17, fontWeight: '700', marginBottom: 16 },
    howStep: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14 },
    howStepBadge: {
        width: 30, height: 30, borderRadius: 15,
        justifyContent: 'center', alignItems: 'center',
    },
    howStepNum: { color: '#fff', fontSize: 13, fontWeight: '800' },
    howStepText: { color: Colors.text.secondary, fontSize: 14, flex: 1, lineHeight: 20 },

    // Coming Soon
    comingSoon: {
        backgroundColor: Colors.background.tertiary, borderRadius: 16,
        padding: 18, marginBottom: 16,
    },
    comingSoonTitle: {
        color: Colors.text.tertiary, fontSize: 11, fontWeight: '700',
        letterSpacing: 1.5, marginBottom: 12,
    },
    comingSoonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    comingSoonItem: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: Colors.card.background, borderRadius: 10,
        paddingHorizontal: 12, paddingVertical: 10,
    },
    comingSoonLabel: { color: Colors.text.tertiary, fontSize: 12, fontWeight: '600' },

    // Device footer
    deviceFooter: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 6, paddingVertical: 10,
    },
    deviceText: { color: Colors.text.tertiary, fontSize: 11 },

    // Language Modal
    modalOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center', alignItems: 'center', padding: 24,
    },
    langModalContent: {
        backgroundColor: Colors.card.background, borderRadius: 20,
        width: width - 48, maxWidth: 380, padding: 20,
        shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15, shadowRadius: 24, elevation: 10,
    },
    langModalHeader: {
        flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16,
    },
    langModalTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '700' },
    langOption: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12,
        marginBottom: 4,
    },
    langOptionActive: { backgroundColor: Colors.primary.light },
    langOptionLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    langShortBadge: {
        width: 36, height: 36, borderRadius: 10,
        backgroundColor: Colors.background.tertiary,
        justifyContent: 'center', alignItems: 'center',
    },
    langShortBadgeActive: { backgroundColor: Colors.primary.start },
    langShortText: { fontSize: 14, fontWeight: '800', color: Colors.text.secondary },
    langShortTextActive: { color: '#fff' },
    langOptionName: { color: Colors.text.primary, fontSize: 15, fontWeight: '600' },
    langOptionEnName: { color: Colors.text.tertiary, fontSize: 12 },

    // Side Menu
    menuOverlay: { flex: 1, flexDirection: 'row' },
    menuBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
    menuDrawer: {
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: width * 0.78, maxWidth: 320,
    },
    menuContainer: {
        flex: 1, backgroundColor: Colors.card.background,
        paddingTop: Platform.OS === 'ios' ? 58 : 42,
    },
    menuHeader: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: 20, marginBottom: 24,
    },
    menuLogoRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    menuLogoIcon: {
        width: 36, height: 36, borderRadius: 10,
        justifyContent: 'center', alignItems: 'center',
    },
    menuLogoText: { color: Colors.text.primary, fontSize: 18, fontWeight: '800' },
    menuCloseBtn: {
        width: 36, height: 36, borderRadius: 10,
        backgroundColor: Colors.background.tertiary,
        justifyContent: 'center', alignItems: 'center',
    },
    menuItems: { paddingHorizontal: 16, gap: 2 },
    menuItem: {
        flexDirection: 'row', alignItems: 'center', gap: 14,
        paddingVertical: 14, paddingHorizontal: 10, borderRadius: 14,
    },
    menuItemIconBox: {
        width: 40, height: 40, borderRadius: 12,
        justifyContent: 'center', alignItems: 'center',
    },
    menuItemTextBox: { flex: 1 },
    menuItemLabel: { color: Colors.text.primary, fontSize: 15, fontWeight: '600' },
    menuItemSub: { color: Colors.text.tertiary, fontSize: 12, marginTop: 1 },
    menuFooter: {
        position: 'absolute', bottom: 30, left: 0, right: 0, alignItems: 'center',
    },
    menuFooterText: {
        color: Colors.text.tertiary, fontSize: 12, fontWeight: '500',
        backgroundColor: Colors.background.tertiary,
        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10,
    },
});
