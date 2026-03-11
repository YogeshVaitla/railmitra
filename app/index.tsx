import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
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
    TouchableWithoutFeedback,
    View,
} from 'react-native';
import Colors from '../constants/Colors';
import { getLanguage, Language, LANGUAGES, setLanguage } from '../services/localization';
import { getOrCreateDeviceId } from '../services/swapStore';

const { width } = Dimensions.get('window');

/**
 * RailMitra V1 — Premium Home Screen
 * 
 * Sleek, modern, and focused entirely on the Seat Swap experience.
 */
export default function HomeScreen() {
    const [lang, setLang] = useState<Language>(getLanguage());
    const [showLangModal, setShowLangModal] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [deviceId, setDeviceId] = useState('');
    const menuSlide = useRef(new Animated.Value(-width)).current;
    const backdropFade = useRef(new Animated.Value(0)).current;

    // Animations
    const fadeIn = useRef(new Animated.Value(0)).current;
    const slideUp = useRef(new Animated.Value(30)).current;

    // Floating Ticket Animations for Hero Section
    const floatAnim1 = useRef(new Animated.Value(0)).current;
    const floatAnim2 = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        getOrCreateDeviceId().then(id => setDeviceId(id));

        // Entrance animations
        Animated.parallel([
            Animated.timing(fadeIn, { toValue: 1, duration: 800, useNativeDriver: true }),
            Animated.spring(slideUp, { toValue: 0, tension: 40, friction: 8, useNativeDriver: true }),
        ]).start();

        // Continuous floating animations for tickets
        Animated.loop(
            Animated.sequence([
                Animated.timing(floatAnim1, { toValue: -8, duration: 2000, useNativeDriver: true }),
                Animated.timing(floatAnim1, { toValue: 0, duration: 2000, useNativeDriver: true })
            ])
        ).start();

        Animated.loop(
            Animated.sequence([
                Animated.timing(floatAnim2, { toValue: 8, duration: 2200, useNativeDriver: true }),
                Animated.timing(floatAnim2, { toValue: 0, duration: 2200, useNativeDriver: true })
            ])
        ).start();
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
        Animated.parallel([
            Animated.timing(menuSlide, { toValue: -width, duration: 250, useNativeDriver: true }),
            Animated.timing(backdropFade, { toValue: 0, duration: 250, useNativeDriver: true })
        ]).start(() => setShowMenu(false));
    };

    const openMenu = () => {
        setShowMenu(true);
        Animated.parallel([
            Animated.spring(menuSlide, { toValue: 0, tension: 40, friction: 8, useNativeDriver: true }),
            Animated.timing(backdropFade, { toValue: 1, duration: 250, useNativeDriver: true })
        ]).start();
    };

    const currentLangOption = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0];

    const renderFeatureCard = (icon: any, title: string, desc: string, color: string) => (
        <View style={[styles.featureCard, { borderColor: `${color}30` }]}>
            <View style={[styles.featureIconWrap, { backgroundColor: `${color}15` }]}>
                <Ionicons name={icon} size={24} color={color} />
            </View>
            <Text style={styles.featureCardTitle}>{title}</Text>
            <Text style={styles.featureCardDesc}>{desc}</Text>
        </View>
    );

    return (
        <View style={styles.container}>
            {/* Dynamic Hero Background */}
            <LinearGradient
                colors={['#fff', Colors.background.primary]}
                style={StyleSheet.absoluteFillObject}
            />

            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

                {/* --- HEADER --- */}
                <Animated.View style={[styles.header, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>
                    <TouchableOpacity onPress={openMenu} style={styles.iconButton}>
                        <Ionicons name="menu" size={24} color={Colors.text.primary} />
                    </TouchableOpacity>

                    <View style={styles.brandCenter}>
                        <LinearGradient colors={[Colors.primary.start, Colors.primary.end]} style={styles.brandLogo}>
                            <MaterialCommunityIcons name="train" size={18} color="#fff" />
                        </LinearGradient>
                        <Text style={styles.brandName}>RailMitra</Text>
                    </View>

                    <TouchableOpacity onPress={() => setShowLangModal(true)} style={styles.langPill}>
                        <Text style={styles.langPillText}>{currentLangOption.shortLabel}</Text>
                    </TouchableOpacity>
                </Animated.View>

                {/* --- HERO SECTION --- */}
                <Animated.View style={[styles.heroSection, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>
                    <View style={styles.ticketVisualization}>
                        {/* Floating Ticket 1 */}
                        <Animated.View style={[styles.floatTicket, styles.ticketLeft, { transform: [{ translateY: floatAnim1 }, { rotate: '-5deg' }] }]}>
                            <Text style={styles.ticketTopText}>YOUR SEAT</Text>
                            <Text style={styles.ticketMainText}>MIDDLE</Text>
                            <Text style={styles.ticketSubText}>B4 · 42</Text>
                        </Animated.View>

                        {/* Center Swap Arrow */}
                        <View style={styles.swapArrowCenter}>
                            <LinearGradient colors={[Colors.primary.start, Colors.primary.end]} style={styles.swapArrowCircle}>
                                <Ionicons name="swap-horizontal" size={24} color="#fff" />
                            </LinearGradient>
                        </View>

                        {/* Floating Ticket 2 */}
                        <Animated.View style={[styles.floatTicket, styles.ticketRight, { transform: [{ translateY: floatAnim2 }, { rotate: '5deg' }] }]}>
                            <Text style={styles.ticketTopText}>FOUND MATCH</Text>
                            <Text style={[styles.ticketMainText, { color: Colors.primary.start }]}>LOWER</Text>
                            <Text style={styles.ticketSubText}>B4 · 17</Text>
                        </Animated.View>
                    </View>

                    <Text style={styles.heroMainTitle}>Upgrade Your Journey</Text>
                    <Text style={styles.heroSubTitle}>
                        Instantly connect with passengers on your train to swap seats. No internet? No problem.
                    </Text>

                    {/* Offline Badges */}
                    <View style={styles.badgeRow}>
                        <View style={styles.premiumBadge}>
                            <Ionicons name="wifi" size={12} color={Colors.text.secondary} />
                            <Text style={styles.premiumBadgeText}>100% Offline</Text>
                        </View>
                        <View style={styles.premiumBadge}>
                            <Ionicons name="shield-checkmark" size={12} color={Colors.text.secondary} />
                            <Text style={styles.premiumBadgeText}>Private P2P</Text>
                        </View>
                        <View style={styles.premiumBadge}>
                            <MaterialCommunityIcons name="account-group" size={14} color={Colors.text.secondary} />
                            <Text style={styles.premiumBadgeText}>No Login</Text>
                        </View>
                    </View>
                </Animated.View>

                {/* --- PREMIUM CALL TO ACTION --- */}
                <Animated.View style={{ opacity: fadeIn, transform: [{ translateY: slideUp }], zIndex: 10, alignItems: 'center', marginTop: 10 }}>
                    <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => router.push('/swap')}
                    >
                        <LinearGradient
                            colors={[Colors.primary.start, Colors.primary.end]}
                            start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                            style={styles.mainCtaButton}
                        >
                            <Text style={styles.mainCtaText}>Start Swapping Now</Text>
                            <View style={styles.mainCtaIcon}>
                                <Ionicons name="arrow-forward" size={20} color={Colors.primary.start} />
                            </View>
                        </LinearGradient>
                    </TouchableOpacity>
                    <Text style={styles.ctaHint}>Uses Bluetooth & WiFi-Direct</Text>
                </Animated.View>

                {/* --- HORIZONTAL FEATURES --- */}
                <Animated.View style={[styles.featuresSection, { opacity: fadeIn }]}>
                    <Text style={styles.sectionHeader}>Why RailMitra?</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 16 }}>
                        {renderFeatureCard('analytics-outline', 'Smart Graph Matching', 'Our local algorithm builds multi-person chains to maximize swap chances.', Colors.success.start)}
                        {renderFeatureCard('people-circle-outline', 'Priority Matches', 'Elderly, pregnant, and medical passengers get boosted visibility automatically.', Colors.accent.start)}
                        {renderFeatureCard('lock-closed-outline', 'Zero Central Servers', 'Your data never leaves the train. Completely peer-to-peer and secure.', Colors.primary.start)}
                    </ScrollView>
                </Animated.View>

                {/* --- FOOTER --- */}
                <View style={styles.footerContainer}>
                    <Ionicons name="hardware-chip-outline" size={14} color={Colors.text.tertiary} />
                    <Text style={styles.footerText}>Device ID: {deviceId ? `${deviceId.substring(0, 8)}` : '...'}</Text>
                    <Text style={styles.footerDot}>•</Text>
                    <Text style={styles.footerText}>v1.0.0</Text>
                </View>

            </ScrollView>

            {/* Language Modal (Kept unchanged but styled cleaner) */}
            <Modal visible={showLangModal} transparent animationType="fade" onRequestClose={() => setShowLangModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.langModalContent}>
                        <Text style={styles.langModalTitle}>Select Language</Text>
                        {LANGUAGES.map((langOption) => (
                            <TouchableOpacity
                                key={langOption.code}
                                style={[styles.langOption, lang === langOption.code && styles.langOptionActive]}
                                onPress={() => selectLanguage(langOption.code)}
                            >
                                <Text style={[styles.langOptionText, lang === langOption.code && styles.langOptionTextActive]}>
                                    {langOption.nativeName} ({langOption.name})
                                </Text>
                            </TouchableOpacity>
                        ))}
                        <TouchableOpacity style={styles.closeModalBtn} onPress={() => setShowLangModal(false)}>
                            <Text style={styles.closeModalText}>Close</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Side Menu */}
            <Modal
                visible={showMenu}
                transparent
                animationType="none"
                onRequestClose={closeMenu}
            >
                <View style={styles.menuOverlay}>
                    <TouchableWithoutFeedback onPress={closeMenu}>
                        <Animated.View style={[styles.menuBackdrop, { backgroundColor: '#000', opacity: backdropFade.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] }) }]} />
                    </TouchableWithoutFeedback>
                    <Animated.View style={[styles.menuDrawer, { transform: [{ translateX: menuSlide }] }]}>
                        <View style={styles.menuContainer}>
                            <View style={styles.menuHeader}>
                                <Text style={styles.menuHeaderTitle}>Menu</Text>
                                <TouchableOpacity onPress={closeMenu} style={styles.iconButton}>
                                    <Ionicons name="close" size={24} color={Colors.text.primary} />
                                </TouchableOpacity>
                            </View>

                            <View style={styles.menuItems}>
                                {[
                                    { icon: 'time-outline', label: 'Past Swaps', route: '/history' },
                                    { icon: 'settings-outline', label: 'Settings', route: '/settings' },
                                    { icon: 'information-circle-outline', label: 'About', route: '/about' },
                                    { icon: 'shield-checkmark-outline', label: 'Privacy', route: '/privacy' },
                                ].map((item) => (
                                    <TouchableOpacity
                                        key={item.route} style={styles.menuItemRow}
                                        onPress={() => {
                                            closeMenu();
                                            setTimeout(() => router.push(item.route as any), 300);
                                        }}
                                    >
                                        <Ionicons name={item.icon as any} size={22} color={Colors.text.secondary} />
                                        <Text style={styles.menuItemText}>{item.label}</Text>
                                    </TouchableOpacity>
                                ))}
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
    scrollContent: { paddingBottom: 60 },

    // Header
    header: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 60 : 40,
        marginBottom: 30,
    },
    iconButton: {
        width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.card.background,
        justifyContent: 'center', alignItems: 'center',
        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2,
    },
    brandCenter: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    brandLogo: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    brandName: { fontSize: 20, fontWeight: '800', color: Colors.text.primary, letterSpacing: -0.5 },
    langPill: {
        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
        backgroundColor: Colors.primary.light,
    },
    langPillText: { fontSize: 13, fontWeight: '700', color: Colors.primary.start },

    // Hero Section
    heroSection: { paddingHorizontal: 24, alignItems: 'center', marginBottom: 20 },
    ticketVisualization: {
        width: '100%', height: 160, flexDirection: 'row',
        alignItems: 'center', justifyContent: 'center', marginBottom: 24,
    },
    floatTicket: {
        backgroundColor: Colors.card.background, padding: 16, borderRadius: 20,
        width: 130, shadowColor: Colors.primary.start, shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.15, shadowRadius: 16, elevation: 10,
    },
    ticketLeft: { marginRight: -20, zIndex: 1 },
    ticketRight: { marginLeft: -20, zIndex: 1 },
    ticketTopText: { fontSize: 10, fontWeight: '800', color: Colors.text.tertiary, letterSpacing: 1, marginBottom: 8 },
    ticketMainText: { fontSize: 20, fontWeight: '800', color: Colors.text.primary, marginBottom: 4 },
    ticketSubText: { fontSize: 13, fontWeight: '600', color: Colors.text.secondary },

    swapArrowCenter: { zIndex: 2 },
    swapArrowCircle: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', borderWidth: 4, borderColor: Colors.background.primary },

    heroMainTitle: { fontSize: 32, fontWeight: '900', color: Colors.text.primary, textAlign: 'center', marginBottom: 12, letterSpacing: -1 },
    heroSubTitle: { fontSize: 15, lineHeight: 24, color: Colors.text.secondary, textAlign: 'center', paddingHorizontal: 10, marginBottom: 24 },

    badgeRow: { flexDirection: 'row', gap: 12, justifyContent: 'center', flexWrap: 'wrap' },
    premiumBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: Colors.background.tertiary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
    premiumBadgeText: { fontSize: 12, fontWeight: '600', color: Colors.text.secondary },

    // Big CTA
    mainCtaButton: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12,
        paddingVertical: 18, paddingHorizontal: 32, borderRadius: 100,
        shadowColor: Colors.primary.start, shadowOffset: { width: 0, height: 12 },
        shadowOpacity: 0.4, shadowRadius: 20, elevation: 12,
        width: width - 48,
    },
    mainCtaText: { color: '#fff', fontSize: 18, fontWeight: '800' },
    mainCtaIcon: { backgroundColor: '#fff', width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
    ctaHint: { fontSize: 12, color: Colors.text.tertiary, marginTop: 12, fontWeight: '500' },

    // Horizontal Features
    featuresSection: { marginTop: 40 },
    sectionHeader: { fontSize: 18, fontWeight: '800', color: Colors.text.primary, paddingHorizontal: 24, marginBottom: 16 },
    featureCard: {
        width: 240, backgroundColor: Colors.card.background,
        borderRadius: 24, padding: 20, borderWidth: 1,
    },
    featureIconWrap: { width: 48, height: 48, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
    featureCardTitle: { fontSize: 16, fontWeight: '800', color: Colors.text.primary, marginBottom: 8 },
    featureCardDesc: { fontSize: 13, lineHeight: 20, color: Colors.text.secondary },

    // Footer
    footerContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 50, opacity: 0.6 },
    footerText: { fontSize: 12, color: Colors.text.tertiary, fontWeight: '500' },
    footerDot: { fontSize: 12, color: Colors.text.tertiary },

    // Modals
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
    langModalContent: { width: '100%', backgroundColor: Colors.card.background, borderRadius: 24, padding: 24 },
    langModalTitle: { fontSize: 18, fontWeight: '800', color: Colors.text.primary, marginBottom: 16, textAlign: 'center' },
    langOption: { paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: Colors.divider },
    langOptionActive: { backgroundColor: Colors.primary.light, borderRadius: 12, paddingHorizontal: 16, borderBottomWidth: 0 },
    langOptionText: { fontSize: 16, color: Colors.text.primary, fontWeight: '500', textAlign: 'center' },
    langOptionTextActive: { color: Colors.primary.start, fontWeight: '700' },
    closeModalBtn: { marginTop: 24, paddingVertical: 14, backgroundColor: Colors.background.tertiary, borderRadius: 12, alignItems: 'center' },
    closeModalText: { fontSize: 15, fontWeight: '700', color: Colors.text.secondary },

    // Menu
    menuOverlay: { flex: 1, flexDirection: 'row' },
    menuBackdrop: { flex: 1 },
    menuDrawer: { width: '75%', maxWidth: 320, backgroundColor: Colors.card.background, height: '100%' },
    menuContainer: { flex: 1, paddingTop: Platform.OS === 'ios' ? 60 : 40, paddingHorizontal: 24 },
    menuHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 40 },
    menuHeaderTitle: { fontSize: 24, fontWeight: '900', color: Colors.text.primary },
    menuItems: { gap: 8 },
    menuItemRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 16 },
    menuItemText: { fontSize: 16, fontWeight: '600', color: Colors.text.primary },
});
