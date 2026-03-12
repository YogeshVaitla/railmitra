import { Ionicons } from '@expo/vector-icons';
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

export default function PrivacyPolicyScreen() {
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
                    <Text style={styles.headerTitle}>Privacy Policy</Text>
                    <View style={{ width: 40 }} />
                </View>

                <View style={styles.badge}>
                    <Ionicons name="shield-checkmark" size={16} color="#4facfe" />
                    <Text style={styles.badgeText}>Last updated: February 2026</Text>
                </View>

                <Section title="1. Introduction">
                    RailMitra (&quot;we&quot;, &quot;our&quot;, or &quot;the app&quot;) is committed to protecting your privacy.
                    This Privacy Policy explains how we collect, use, and safeguard your information
                    when you use our mobile application.
                </Section>

                <Section title="2. Information We Collect">
                    <BulletPoint text='Search queries: Train numbers, journey dates, and station selections you enter to search for seat availability.' />
                    <BulletPoint text='Favorites: Train routes you choose to save for quick access, stored locally on your device.' />
                    <BulletPoint text='Recent searches: Your last few searches, stored locally on your device for convenience.' />
                    <BulletPoint text='Language preference: Your selected display language (English/Hindi).' />
                </Section>

                <Section title="3. What We Do NOT Collect">
                    <BulletPoint text="Personal identification information (name, email, phone number)" />
                    <BulletPoint text="Location data" />
                    <BulletPoint text="Contact information" />
                    <BulletPoint text="Payment or financial information" />
                    <BulletPoint text="Photos, media, or files" />
                </Section>

                <Section title="4. Data Storage">
                    All your data (favorites, recent searches, and preferences) is stored
                    LOCALLY on your device using secure storage. We do not transmit your
                    personal search history to any server. The only network requests
                    made are to fetch publicly available train chart data.
                </Section>

                <Section title="5. Third-Party Services">
                    The app may use the following third-party services:{'\n\n'}
                    • Expo (React Native framework) — for app delivery{'\n'}
                    • IRCTC public chart data — for seat availability information{'\n\n'}
                    These services may collect anonymized usage data as per their own privacy policies.
                </Section>

                <Section title="6. Data Security">
                    We take reasonable measures to protect the information stored on your
                    device. However, no method of electronic storage is 100% secure, and
                    we cannot guarantee absolute security.
                </Section>

                <Section title="7. Children's Privacy">
                    Our app does not knowingly collect personal information from children
                    under 13. If you are a parent or guardian and believe your child has
                    provided us with personal information, please contact us.
                </Section>

                <Section title="8. Changes to This Policy">
                    We may update this Privacy Policy from time to time. Any changes will
                    be reflected in the app with an updated &quot;Last updated&quot; date. We encourage
                    you to review this policy periodically.
                </Section>

                <Section title="9. Contact Us">
                    If you have any questions about this Privacy Policy, please contact us at:{'\n\n'}
                    📧 support@railmitra.app
                </Section>

                <View style={styles.footer}>
                    <Text style={styles.footerText}>© 2026 RailMitra. All rights reserved.</Text>
                </View>
            </ScrollView>
        </View>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>{title}</Text>
            {typeof children === 'string' ? (
                <Text style={styles.sectionText}>{children}</Text>
            ) : (
                <View>{children}</View>
            )}
        </View>
    );
}

function BulletPoint({ text }: { text: string }) {
    return (
        <View style={styles.bullet}>
            <View style={styles.bulletDot} />
            <Text style={styles.bulletText}>{text}</Text>
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
        justifyContent: 'space-between', marginBottom: 20,
    },
    backBtn: {
        width: 42, height: 42, borderRadius: 13,
        backgroundColor: Colors.card.background,
        justifyContent: 'center', alignItems: 'center',
        shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1, shadowRadius: 6, elevation: 3,
    },
    headerTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '700' },
    badge: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: Colors.accent.light,
        borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8,
        alignSelf: 'flex-start', marginBottom: 20,
    },
    badgeText: { color: Colors.accent.start, fontSize: 12, fontWeight: '600' },
    section: {
        backgroundColor: Colors.card.background, borderRadius: 14,
        padding: 16, marginBottom: 12,
        shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 1, shadowRadius: 4, elevation: 2,
    },
    sectionTitle: {
        color: Colors.text.primary, fontSize: 15, fontWeight: '700', marginBottom: 10,
    },
    sectionText: { color: Colors.text.secondary, fontSize: 14, lineHeight: 22 },
    bullet: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 10,
        marginBottom: 8,
    },
    bulletDot: {
        width: 6, height: 6, borderRadius: 3,
        backgroundColor: Colors.primary.start, marginTop: 7,
    },
    bulletText: { color: Colors.text.secondary, fontSize: 14, lineHeight: 22, flex: 1 },
    footer: { alignItems: 'center', paddingVertical: 20 },
    footerText: { color: Colors.text.tertiary, fontSize: 11 },
});
