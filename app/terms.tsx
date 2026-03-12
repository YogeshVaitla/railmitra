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
import Colors from '../constants/Colors';

export default function TermsScreen() {
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
                    <Text style={styles.headerTitle}>Terms & Conditions</Text>
                    <View style={{ width: 40 }} />
                </View>

                <View style={styles.badge}>
                    <Ionicons name="document-text" size={16} color={Colors.warning.start} />
                    <Text style={styles.badgeText}>Last updated: February 2026</Text>
                </View>

                <Section title="1. Acceptance of Terms">
                    By downloading, installing, or using RailMitra (&quot;the app&quot;), you agree to
                    be bound by these Terms and Conditions. If you do not agree with any part
                    of these terms, you must not use the app.
                </Section>

                <Section title="2. Description of Service">
                    RailMitra is a mobile application that displays publicly available train
                    seat vacancy information after chart preparation. The app aggregates data
                    from publicly accessible sources and presents it in an easy-to-read format.
                </Section>

                <Section title="3. Not Affiliated with Indian Railways">
                    <View style={styles.warningBox}>
                        <Ionicons name="warning" size={18} color={Colors.warning.start} />
                        <Text style={styles.warningText}>
                            RailMitra is an INDEPENDENT application. It is NOT affiliated with,
                            endorsed by, sponsored by, or in any way officially connected with
                            Indian Railways, IRCTC (Indian Railway Catering and Tourism Corporation),
                            CRIS, or any government entity.
                        </Text>
                    </View>
                </Section>

                <Section title="4. Accuracy of Information">
                    While we strive to provide accurate and up-to-date information:{'\n\n'}
                    • We do NOT guarantee the accuracy, completeness, or timeliness of the data displayed.{'\n'}
                    • Seat availability may change between the time data is fetched and you board the train.{'\n'}
                    • Users should ALWAYS verify information through official IRCTC channels before making travel decisions.{'\n'}
                    • We are not responsible for any loss, inconvenience, or damage resulting from reliance on information provided by this app.
                </Section>

                <Section title="5. No Booking Service">
                    RailMitra is an INFORMATIONAL tool only. We do not provide:{'\n\n'}
                    • Ticket booking or reservation services{'\n'}
                    • Payment processing{'\n'}
                    • Ticket cancellation or modification{'\n\n'}
                    For booking, please use the official IRCTC website or authorized agents.
                </Section>

                <Section title="6. User Responsibilities">
                    As a user of RailMitra, you agree to:{'\n\n'}
                    • Use the app only for lawful purposes{'\n'}
                    • Not attempt to reverse engineer, decompile, or modify the app{'\n'}
                    • Not use the app for any commercial data extraction{'\n'}
                    • Not overload our servers with excessive automated requests
                </Section>

                <Section title="7. Intellectual Property">
                    All content, design, graphics, and code in RailMitra are owned by us and
                    protected by applicable intellectual property laws. You may not reproduce,
                    distribute, or create derivative works without our written permission.
                </Section>

                <Section title="8. Limitation of Liability">
                    To the maximum extent permitted by law, RailMitra and its developers shall
                    not be liable for any direct, indirect, incidental, special, consequential,
                    or punitive damages arising from:{'\n\n'}
                    • Your use or inability to use the app{'\n'}
                    • Any errors or inaccuracies in the seat availability data{'\n'}
                    • Any unauthorized access to your stored data{'\n'}
                    • Any missed trains or travel inconveniences
                </Section>

                <Section title="9. Service Availability">
                    We do not guarantee uninterrupted or error-free service. The app may be
                    temporarily unavailable due to maintenance, updates, or circumstances
                    beyond our control. We reserve the right to modify, suspend, or
                    discontinue the service at any time without prior notice.
                </Section>

                <Section title="10. Changes to Terms">
                    We reserve the right to update these Terms & Conditions at any time.
                    Continued use of the app after changes constitutes acceptance of the
                    new terms. We encourage you to periodically review these terms.
                </Section>

                <Section title="11. Governing Law">
                    These terms shall be governed by and construed in accordance with the
                    laws of India. Any disputes shall be subject to the exclusive jurisdiction
                    of the courts in India.
                </Section>

                <Section title="12. Contact">
                    For questions about these Terms & Conditions:{'\n\n'}
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
        backgroundColor: Colors.warning.light,
        borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8,
        alignSelf: 'flex-start', marginBottom: 20,
    },
    badgeText: { color: Colors.warning.start, fontSize: 12, fontWeight: '600' },
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
    warningBox: {
        flexDirection: 'row', gap: 10,
        backgroundColor: Colors.warning.light,
        borderRadius: 10, padding: 14,
    },
    warningText: { color: Colors.text.secondary, fontSize: 13, lineHeight: 21, flex: 1 },
    footer: { alignItems: 'center', paddingVertical: 20 },
    footerText: { color: Colors.text.tertiary, fontSize: 11 },
});
