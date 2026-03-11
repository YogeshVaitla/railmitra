import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
    Linking,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    Alert,
} from 'react-native';
import Colors from '../constants/Colors';
import { clearAllSwapData } from '../services/swapStore';
import { getLanguage, Language, LANGUAGES, setLanguage, t } from '../services/localization';

const APP_VERSION = '1.0.0';
const SUPPORT_EMAIL = 'support@railmitra.app';

export default function SettingsScreen() {
    const [lang, setLang] = useState<Language>(getLanguage());

    const cycleLanguage = () => {
        const currentIdx = LANGUAGES.findIndex(l => l.code === lang);
        const nextIdx = (currentIdx + 1) % LANGUAGES.length;
        const newLang = LANGUAGES[nextIdx].code;
        setLanguage(newLang);
        setLang(newLang);
    };

    const currentLangOption = LANGUAGES.find(l => l.code === lang) || LANGUAGES[0];

    const openLink = (url: string) => {
        Linking.openURL(url).catch(() => { });
    };

    const sendEmail = () => {
        Linking.openURL(`mailto:${SUPPORT_EMAIL}?subject=RailMitra App Support`).catch(() => { });
    };

    const handleClearData = () => {
        Alert.alert(
            "Clear All App Data",
            "Are you sure? This will delete all your swap history and reset your device identity.",
            [
                { text: "Cancel", style: "cancel" },
                {
                    text: "Delete Everything",
                    style: "destructive",
                    onPress: async () => {
                        await clearAllSwapData();
                        router.replace('/');
                    }
                }
            ]
        );
    };

    return (
        <View style={styles.container}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={20} color={Colors.text.primary} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>{t('settings')}</Text>
                    <View style={{ width: 40 }} />
                </View>

                {/* App Info Card */}
                <LinearGradient
                    colors={[Colors.primary.start, Colors.primary.end]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.appCard}
                >
                    <View style={styles.appIconContainer}>
                        <View style={styles.appIcon}>
                            <MaterialCommunityIcons name="train" size={32} color={Colors.primary.start} />
                        </View>
                    </View>
                    <Text style={styles.appCardName}>{t('appName')}</Text>
                    <Text style={styles.appCardTagline}>{t('tagline')}</Text>
                    <View style={styles.versionBadge}>
                        <Text style={styles.versionText}>v{APP_VERSION}</Text>
                    </View>
                </LinearGradient>

                {/* General Section */}
                <Text style={styles.sectionTitle}>General</Text>
                <View style={styles.section}>
                    <TouchableOpacity style={styles.menuItem} onPress={cycleLanguage}>
                        <View style={styles.menuLeft}>
                            <LinearGradient
                                colors={[Colors.primary.start, Colors.primary.end]}
                                style={styles.menuIcon}
                            >
                                <Ionicons name="language" size={18} color="#fff" />
                            </LinearGradient>
                            <View>
                                <Text style={styles.menuTitle}>{t('language')}</Text>
                                <Text style={styles.menuSubtitle}>
                                    {currentLangOption.nativeName} ({currentLangOption.name})
                                </Text>
                            </View>
                        </View>
                        <View style={styles.langSwitch}>
                            <Text style={styles.langSwitchText}>
                                {currentLangOption.shortLabel}
                            </Text>
                        </View>
                    </TouchableOpacity>
                </View>

                {/* About Section */}
                <Text style={styles.sectionTitle}>{t('about')}</Text>
                <View style={styles.section}>
                    <TouchableOpacity
                        style={styles.menuItem}
                        onPress={() => router.push('/about')}
                    >
                        <View style={styles.menuLeft}>
                            <LinearGradient
                                colors={[Colors.success.start, Colors.success.end]}
                                style={styles.menuIcon}
                            >
                                <Ionicons name="information-circle" size={18} color="#fff" />
                            </LinearGradient>
                            <View>
                                <Text style={styles.menuTitle}>About RailMitra</Text>
                                <Text style={styles.menuSubtitle}>Learn more about the app</Text>
                            </View>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={Colors.text.tertiary} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.menuItem}
                        onPress={() => router.push('/privacy')}
                    >
                        <View style={styles.menuLeft}>
                            <LinearGradient
                                colors={['#4facfe', '#00f2fe']}
                                style={styles.menuIcon}
                            >
                                <Ionicons name="shield-checkmark" size={18} color="#fff" />
                            </LinearGradient>
                            <View>
                                <Text style={styles.menuTitle}>Privacy Policy</Text>
                                <Text style={styles.menuSubtitle}>How we handle your data</Text>
                            </View>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={Colors.text.tertiary} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.menuItem}
                        onPress={() => router.push('/terms')}
                    >
                        <View style={styles.menuLeft}>
                            <LinearGradient
                                colors={[Colors.warning.start, Colors.warning.end]}
                                style={styles.menuIcon}
                            >
                                <Ionicons name="document-text" size={18} color="#fff" />
                            </LinearGradient>
                            <View>
                                <Text style={styles.menuTitle}>Terms & Conditions</Text>
                                <Text style={styles.menuSubtitle}>Usage terms and disclaimer</Text>
                            </View>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={Colors.text.tertiary} />
                    </TouchableOpacity>
                </View>

                {/* Support Section */}
                <Text style={styles.sectionTitle}>Support</Text>
                <View style={styles.section}>
                    <TouchableOpacity style={styles.menuItem} onPress={sendEmail}>
                        <View style={styles.menuLeft}>
                            <LinearGradient
                                colors={[Colors.accent.start, Colors.accent.end]}
                                style={styles.menuIcon}
                            >
                                <Ionicons name="mail" size={18} color="#fff" />
                            </LinearGradient>
                            <View>
                                <Text style={styles.menuTitle}>Contact Support</Text>
                                <Text style={styles.menuSubtitle}>{SUPPORT_EMAIL}</Text>
                            </View>
                        </View>
                        <Ionicons name="open-outline" size={16} color={Colors.text.tertiary} />
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.menuItem} onPress={() => { }}>
                        <View style={styles.menuLeft}>
                            <LinearGradient
                                colors={['#f7971e', '#ffd200']}
                                style={styles.menuIcon}
                            >
                                <Ionicons name="star" size={18} color="#fff" />
                            </LinearGradient>
                            <View>
                                <Text style={styles.menuTitle}>Rate Us ⭐</Text>
                                <Text style={styles.menuSubtitle}>Love the app? Rate us on Play Store</Text>
                            </View>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={Colors.text.tertiary} />
                    </TouchableOpacity>
                </View>

                {/* Danger Zone */}
                <Text style={styles.sectionTitle}>Danger Zone</Text>
                <View style={[styles.section, { marginBottom: 32 }]}>
                    <TouchableOpacity style={styles.menuItem} onPress={handleClearData}>
                        <View style={styles.menuLeft}>
                            <LinearGradient
                                colors={[Colors.danger.start, Colors.danger.end]}
                                style={styles.menuIcon}
                            >
                                <Ionicons name="trash" size={18} color="#fff" />
                            </LinearGradient>
                            <View>
                                <Text style={[styles.menuTitle, { color: Colors.danger.start }]}>Clear All App Data</Text>
                                <Text style={styles.menuSubtitle}>Reset device state & delete history</Text>
                            </View>
                        </View>
                    </TouchableOpacity>
                </View>

                {/* Footer */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>Made with ❤️ in India</Text>
                    <Text style={styles.footerVersion}>RailMitra v{APP_VERSION}</Text>
                    <Text style={styles.footerDisclaimer}>
                        This app is not affiliated with Indian Railways or IRCTC.
                    </Text>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background.primary },
    scrollContent: {
        paddingTop: Platform.OS === 'ios' ? 55 : 40,
        paddingBottom: 40, paddingHorizontal: 20,
    },
    header: {
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between', marginBottom: 24,
    },
    backBtn: {
        width: 42, height: 42, borderRadius: 13,
        backgroundColor: Colors.card.background,
        justifyContent: 'center', alignItems: 'center',
        shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1, shadowRadius: 6, elevation: 3,
    },
    headerTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '700' },
    appCard: {
        borderRadius: 20, padding: 24, alignItems: 'center', marginBottom: 24,
    },
    appIconContainer: { marginBottom: 12 },
    appIcon: {
        width: 64, height: 64, borderRadius: 18,
        backgroundColor: '#fff',
        justifyContent: 'center', alignItems: 'center',
    },
    appCardName: { color: '#fff', fontSize: 24, fontWeight: '800' },
    appCardTagline: {
        color: 'rgba(255,255,255,0.85)', fontSize: 13,
        marginTop: 4, letterSpacing: 1, textTransform: 'uppercase',
    },
    versionBadge: {
        marginTop: 12, backgroundColor: 'rgba(255,255,255,0.2)',
        borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4,
    },
    versionText: { color: '#fff', fontSize: 12, fontWeight: '700' },
    sectionTitle: {
        color: Colors.text.tertiary, fontSize: 12, fontWeight: '700',
        textTransform: 'uppercase', letterSpacing: 1.5,
        marginBottom: 10, marginLeft: 4,
    },
    section: {
        backgroundColor: Colors.card.background, borderRadius: 16,
        overflow: 'hidden', marginBottom: 24,
        shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 1, shadowRadius: 4, elevation: 2,
    },
    menuItem: {
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14, paddingHorizontal: 16,
        borderBottomWidth: 1, borderBottomColor: Colors.divider,
    },
    menuLeft: {
        flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1,
    },
    menuIcon: {
        width: 36, height: 36, borderRadius: 10,
        justifyContent: 'center', alignItems: 'center',
    },
    menuTitle: { color: Colors.text.primary, fontSize: 15, fontWeight: '600' },
    menuSubtitle: { color: Colors.text.tertiary, fontSize: 12, marginTop: 2 },
    langSwitch: {
        backgroundColor: Colors.background.tertiary,
        borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6,
    },
    langSwitchText: { color: Colors.text.primary, fontSize: 13, fontWeight: '700' },
    footer: { alignItems: 'center', paddingVertical: 20, gap: 6 },
    footerText: { color: Colors.text.secondary, fontSize: 13 },
    footerVersion: { color: Colors.text.tertiary, fontSize: 11 },
    footerDisclaimer: {
        color: Colors.text.tertiary, fontSize: 10,
        textAlign: 'center', marginTop: 4, lineHeight: 16,
    },
});
