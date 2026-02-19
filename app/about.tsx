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
import { router } from 'expo-router';
import Colors from '../constants/Colors';

export default function AboutScreen() {
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
                    <Text style={styles.heroTitle}>SeatCheck</Text>
                    <Text style={styles.heroTagline}>Train Seat Availability</Text>
                    <Text style={styles.heroVersion}>Version 1.0.0</Text>
                </LinearGradient>

                {/* What is SeatCheck */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>🚂 What is SeatCheck?</Text>
                    <Text style={styles.cardText}>
                        SeatCheck is a mobile app that helps travelers quickly check vacant seats
                        in Indian Railway trains after chart preparation. Instead of manually
                        navigating the IRCTC website, SeatCheck gives you instant access to
                        coach-wise and berth-level vacancy information.
                    </Text>
                </View>

                {/* How it Works */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>⚡ How it works</Text>
                    <View style={styles.stepList}>
                        <View style={styles.step}>
                            <View style={styles.stepNumber}>
                                <Text style={styles.stepNumberText}>1</Text>
                            </View>
                            <Text style={styles.stepText}>
                                Enter your train number and journey date
                            </Text>
                        </View>
                        <View style={styles.step}>
                            <View style={styles.stepNumber}>
                                <Text style={styles.stepNumberText}>2</Text>
                            </View>
                            <Text style={styles.stepText}>
                                Select your boarding and destination stations
                            </Text>
                        </View>
                        <View style={styles.step}>
                            <View style={styles.stepNumber}>
                                <Text style={styles.stepNumberText}>3</Text>
                            </View>
                            <Text style={styles.stepText}>
                                View vacant berths filtered for your specific journey
                            </Text>
                        </View>
                    </View>
                </View>

                {/* Features */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>✨ Features</Text>
                    <View style={styles.featureList}>
                        {[
                            { icon: 'search', text: 'Search by train number or name' },
                            { icon: 'layers-outline', text: 'Class-wise vacancy breakdown (SL, 3A, 2A, 1A)' },
                            { icon: 'bed-outline', text: 'Individual berth details with type (LB, MB, UB)' },
                            { icon: 'map-outline', text: 'Full train route with arrival/departure times' },
                            { icon: 'heart-outline', text: 'Save favorite trains for quick access' },
                            { icon: 'language', text: 'Multi-language support (English & Hindi)' },
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

                {/* When to Use */}
                <View style={styles.card}>
                    <Text style={styles.cardTitle}>🎯 When to use SeatCheck?</Text>
                    <Text style={styles.cardText}>
                        Charts are typically prepared 4 hours before train departure and a
                        revised chart 30 minutes before departure. After chart preparation,
                        unbooked seats and cancelled tickets become visible.{'\n\n'}
                        SeatCheck is especially useful for:{'\n'}
                        • Emergency travel planning{'\n'}
                        • Finding last-minute seats on busy routes{'\n'}
                        • Checking if preferred berth types (Lower Berth) are available{'\n'}
                        • Platform ticket holders looking for vacant seats
                    </Text>
                </View>

                {/* Disclaimer */}
                <View style={[styles.card, styles.disclaimerCard]}>
                    <Text style={styles.disclaimerTitle}>⚠️ Disclaimer</Text>
                    <Text style={styles.disclaimerText}>
                        SeatCheck is an independent app and is NOT affiliated with, endorsed by,
                        or connected to Indian Railways, IRCTC, or any government body. The
                        information displayed is sourced from publicly available data and may not
                        always be 100% accurate. Users should verify seat availability through
                        official IRCTC channels before making travel decisions.
                    </Text>
                </View>

                {/* Footer */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>Made with ❤️ in India</Text>
                    <Text style={styles.footerCopy}>© 2026 SeatCheck. All rights reserved.</Text>
                </View>
            </ScrollView>
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    scrollContent: {
        paddingTop: Platform.OS === 'ios' ? 55 : 40,
        paddingBottom: 40,
        paddingHorizontal: 20,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 24,
    },
    backBtn: {
        width: 40, height: 40, borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.08)',
        justifyContent: 'center', alignItems: 'center',
    },
    headerTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
    heroCard: {
        borderRadius: 20, padding: 28, alignItems: 'center', marginBottom: 20,
    },
    heroIcon: {
        width: 70, height: 70, borderRadius: 20,
        backgroundColor: '#fff',
        justifyContent: 'center', alignItems: 'center', marginBottom: 14,
    },
    heroTitle: { color: '#fff', fontSize: 28, fontWeight: '800' },
    heroTagline: {
        color: 'rgba(255,255,255,0.8)', fontSize: 13,
        letterSpacing: 1, textTransform: 'uppercase', marginTop: 4,
    },
    heroVersion: {
        color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 10,
    },
    card: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 16, padding: 18, marginBottom: 14,
        borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    },
    cardTitle: {
        color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 12,
    },
    cardText: {
        color: 'rgba(255,255,255,0.65)', fontSize: 14, lineHeight: 22,
    },
    stepList: { gap: 12 },
    step: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    stepNumber: {
        width: 28, height: 28, borderRadius: 14,
        backgroundColor: Colors.primary.start,
        justifyContent: 'center', alignItems: 'center',
    },
    stepNumberText: { color: '#fff', fontSize: 13, fontWeight: '800' },
    stepText: { color: 'rgba(255,255,255,0.7)', fontSize: 14, flex: 1 },
    featureList: { gap: 10 },
    featureItem: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    featureText: { color: 'rgba(255,255,255,0.65)', fontSize: 14, flex: 1 },
    disclaimerCard: {
        backgroundColor: 'rgba(242, 201, 76, 0.06)',
        borderColor: 'rgba(242, 201, 76, 0.12)',
    },
    disclaimerTitle: {
        color: Colors.warning.start, fontSize: 15, fontWeight: '700', marginBottom: 8,
    },
    disclaimerText: {
        color: 'rgba(255,255,255,0.55)', fontSize: 13, lineHeight: 20,
    },
    footer: { alignItems: 'center', paddingVertical: 20, gap: 4 },
    footerText: { color: 'rgba(255,255,255,0.35)', fontSize: 13 },
    footerCopy: { color: 'rgba(255,255,255,0.2)', fontSize: 11 },
});
