import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React from 'react';
import {
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Colors } from '../constants/Colors';

export default function AboutScreen() {
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
                    <Text style={styles.headerTitle}>About</Text>
                    <View style={{ width: 40 }} />
                </View>

                {/* Hero */}
                <LinearGradient
                    colors={[Colors.primary.start, Colors.primary.end]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.heroCard}
                >
                    <View style={styles.heroIcon}>
                        <MaterialCommunityIcons name="train" size={36} color={Colors.primary.start} />
                    </View>
                    <Text style={styles.heroTitle}>RailMitra</Text>
                    <Text style={styles.heroTagline}>Your Train Companion</Text>
                    <Text style={styles.heroVersion}>Version 1.0.0</Text>
                </LinearGradient>

                {/* What is RailMitra */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>🚂 What is RailMitra?</Text>
                    <Text style={styles.cardText}>
                        RailMitra is your all-in-one train companion app for Indian Railways.
                        Swap berths with nearby passengers using offline P2P mesh, check seat
                        availability after chart preparation, and more — all without needing
                        an account or login.
                    </Text>
                </View>

                {/* How it Works */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>⚡ How Seat Swap works</Text>
                    <View style={styles.stepList}>
                        <View style={styles.step}>
                            <View style={styles.stepNumber}>
                                <Text style={styles.stepNumberText}>1</Text>
                            </View>
                            <Text style={styles.stepText}>
                                Enter your train number to browse swap offers
                            </Text>
                        </View>
                        <View style={styles.step}>
                            <View style={styles.stepNumber}>
                                <Text style={styles.stepNumberText}>2</Text>
                            </View>
                            <Text style={styles.stepText}>
                                Register your own swap offer or accept a match
                            </Text>
                        </View>
                        <View style={styles.step}>
                            <View style={styles.stepNumber}>
                                <Text style={styles.stepNumberText}>3</Text>
                            </View>
                            <Text style={styles.stepText}>
                                Walk to the matched seat and swap — all done offline!
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Features */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>✨ Features</Text>
                    <View style={styles.featureList}>
                        {[
                            { icon: 'swap-horizontal', text: 'P2P berth exchange with nearby passengers' },
                            { icon: 'wifi-outline', text: 'Works completely offline — no internet needed' },
                            { icon: 'shield-checkmark-outline', text: 'Anonymous — no login, no personal data' },
                            { icon: 'accessibility', text: 'Priority for elderly & medical passengers' },
                            { icon: 'analytics', text: 'Demand heatmap and swap analytics' },
                            { icon: 'language', text: 'Multi-language support (9 Indian languages)' },
                        ].map((feature, idx) => (
                            <View key={idx} style={styles.featureItem}>
                                <Ionicons
                                    name={feature.icon as any}
                                    size={18}
                                    color={Colors.primary.start}
                                />
                                <Text style={styles.featureText}>{feature.text}</Text>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Coming Soon */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>🚀 Coming Soon</Text>
                    <Text style={styles.cardText}>
                        • PNR Tracking — check your booking status{'\n'}
                        • Seat Availability — find vacant berths after chart prep{'\n'}
                        • Live Train Status — real-time location and delays{'\n'}
                        • Coach Conditions — cleanliness and toilet reports
                    </Text>
                </View>

                {/* Disclaimer */}
                <View style={[styles.card, styles.disclaimerCard]}>
                    <Text style={styles.disclaimerTitle}>⚠️ Disclaimer</Text>
                    <Text style={styles.disclaimerText}>
                        RailMitra is an independent app and is NOT affiliated with, endorsed by,
                        or connected to Indian Railways, IRCTC, or any government body. The
                        information displayed is sourced from publicly available data and may not
                        always be 100% accurate. Users should verify information through
                        official IRCTC channels before making travel decisions.
                    </Text>
                </View>

                {/* Footer */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>Made with ❤️ in India</Text>
                    <Text style={styles.footerCopy}>© 2026 RailMitra. All rights reserved.</Text>
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
    heroCard: { borderRadius: 20, padding: 28, alignItems: 'center', marginBottom: 20 },
    heroIcon: {
        width: 70, height: 70, borderRadius: 20,
        backgroundColor: '#fff',
        justifyContent: 'center', alignItems: 'center', marginBottom: 14,
    },
    heroTitle: { color: '#fff', fontSize: 28, fontWeight: '800' },
    heroTagline: {
        color: 'rgba(255,255,255,0.85)', fontSize: 13,
        letterSpacing: 1, textTransform: 'uppercase', marginTop: 4,
    },
    heroVersion: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 10 },
    card: {
        backgroundColor: Colors.card.background, borderRadius: 16,
        padding: 18, marginBottom: 14,
        shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 1, shadowRadius: 4, elevation: 2,
    },
    cardTitle: { color: Colors.text.primary, fontSize: 16, fontWeight: '700', marginBottom: 12 },
    cardText: { color: Colors.text.secondary, fontSize: 14, lineHeight: 22 },
    stepList: { gap: 12 },
    step: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    stepNumber: {
        width: 28, height: 28, borderRadius: 14,
        backgroundColor: Colors.primary.start,
        justifyContent: 'center', alignItems: 'center',
    },
    stepNumberText: { color: '#fff', fontSize: 13, fontWeight: '800' },
    stepText: { color: Colors.text.secondary, fontSize: 14, flex: 1 },
    featureList: { gap: 10 },
    featureItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    featureText: { color: Colors.text.secondary, fontSize: 14, flex: 1 },
    disclaimerCard: {
        backgroundColor: Colors.warning.light,
    },
    disclaimerTitle: {
        color: Colors.warning.start, fontSize: 15, fontWeight: '700', marginBottom: 8,
    },
    disclaimerText: { color: Colors.text.secondary, fontSize: 13, lineHeight: 20 },
    footer: { alignItems: 'center', paddingVertical: 20, gap: 4 },
    footerText: { color: Colors.text.secondary, fontSize: 13 },
    footerCopy: { color: Colors.text.tertiary, fontSize: 11 },
});
