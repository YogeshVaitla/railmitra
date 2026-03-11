import { StyleSheet, Platform } from 'react-native';
import Colors from '../../constants/Colors';

export const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background.primary },
    scrollContent: {
        paddingTop: Platform.OS === 'ios' ? 55 : 40,
        paddingBottom: 40, paddingHorizontal: 20,
    },
    header: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 16,
    },
    backBtn: {
        width: 42, height: 42, borderRadius: 13,
        backgroundColor: Colors.card.background,
        justifyContent: 'center', alignItems: 'center',
        shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1, shadowRadius: 6, elevation: 3,
    },
    headerTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '700' },

    // Train Context Header
    trainContextHeader: {
        marginBottom: 16,
    },
    trainInputContainer: {
        backgroundColor: Colors.card.background,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: Colors.card.border,
        shadowColor: Colors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 6,
        elevation: 2,
    },
    trainInputPrompt: {
        fontSize: 14,
        fontWeight: '700',
        color: Colors.text.primary,
        marginBottom: 12,
    },
    trainInputFieldWrapper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.background.tertiary,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: Colors.card.border,
    },
    trainInputField: {
        flex: 1,
        height: 48,
        paddingHorizontal: 10,
        fontSize: 16,
        fontWeight: '600',
        color: Colors.text.primary,
    },
    trainInputGoBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: Colors.primary.start,
        borderRadius: 10,
        paddingHorizontal: 16,
        height: 40,
        marginRight: 4,
    },
    trainInputGoText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '700',
    },
    trainPillContainer: {
        alignItems: 'center',
    },
    trainPill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.primary.light,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        gap: 8,
    },
    trainPillEmoji: {
        fontSize: 16,
    },
    trainPillText: {
        fontSize: 15,
        fontWeight: '700',
        color: Colors.primary.start,
    },
    trainEditBtn: {
        backgroundColor: Colors.card.background,
        width: 26,
        height: 26,
        borderRadius: 13,
        justifyContent: 'center',
        alignItems: 'center',
        marginLeft: 4,
        shadowColor: Colors.shadow,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.5,
        shadowRadius: 2,
        elevation: 1,
    },

    meshStatus: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: Colors.card.background, borderRadius: 12,
        paddingHorizontal: 12, paddingVertical: 8,
        shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 1, shadowRadius: 4, elevation: 2,
    },
    meshDot: { width: 8, height: 8, borderRadius: 4 },
    meshText: { color: Colors.text.secondary, fontSize: 12, fontWeight: '700' },

    meshBanner: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: Colors.success.light, borderRadius: 12,
        paddingHorizontal: 14, paddingVertical: 10, marginBottom: 12,
        borderWidth: 1, borderColor: `${Colors.success.start}20`,
    },
    meshBannerDot: {
        width: 8, height: 8, borderRadius: 4,
        backgroundColor: Colors.success.start,
    },
    meshBannerText: { color: Colors.text.secondary, fontSize: 13 },

    // Tabs
    tabBar: {
        flexDirection: 'row', gap: 4,
        backgroundColor: Colors.card.background, borderRadius: 14,
        padding: 4, marginBottom: 16,
        shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1, shadowRadius: 6, elevation: 3,
    },
    tab: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 6, paddingVertical: 12, borderRadius: 11,
    },
    tabActive: {
        backgroundColor: Colors.primary.light,
    },
    tabText: { color: Colors.text.tertiary, fontSize: 12, fontWeight: '600' },
    tabTextActive: { color: Colors.primary.start, fontWeight: '700' },
    tabBadge: {
        position: 'absolute', top: -3, right: -6,
        width: 8, height: 8, borderRadius: 4,
    },

    // Cards
    card: {
        backgroundColor: Colors.card.background, borderRadius: 16, padding: 18,
        marginBottom: 16,
        shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1, shadowRadius: 8, elevation: 2,
    },
    sectionLabel: {
        color: Colors.text.tertiary, fontSize: 11, fontWeight: '700',
        letterSpacing: 1, marginBottom: 12,
    },
    formRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-end' },
    formField: {},
    fieldLabel: { color: Colors.text.secondary, fontSize: 12, marginBottom: 6 },
    fieldInput: {
        backgroundColor: Colors.background.tertiary, borderRadius: 12,
        paddingHorizontal: 14, height: 48, color: Colors.text.primary,
        fontSize: 16, fontWeight: '600',
        borderWidth: 1, borderColor: Colors.card.border,
    },

    browseBtn: { marginBottom: 16 },
    browseBtnGradient: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
        height: 48, borderRadius: 12, paddingHorizontal: 18,
    },
    browseBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

    browseHeader: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'center', marginBottom: 12, marginTop: 4,
    },
    browseTitle: { color: Colors.text.primary, fontSize: 16, fontWeight: '700' },
    iconBtn: {
        width: 36, height: 36, borderRadius: 11,
        backgroundColor: Colors.card.background,
        justifyContent: 'center', alignItems: 'center',
        shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 1, shadowRadius: 4, elevation: 2,
    },

    // Analytics
    analyticsCard: {
        backgroundColor: Colors.accent.light, borderRadius: 16, padding: 16,
        marginBottom: 16, borderWidth: 1, borderColor: `${Colors.accent.start}15`,
    },
    analyticsSectionLabel: {
        color: Colors.text.tertiary, fontSize: 10, fontWeight: '700',
        letterSpacing: 1, marginBottom: 12,
    },
    heatmapGrid: { gap: 8, marginBottom: 14 },
    heatmapItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    heatmapLabel: { color: Colors.text.secondary, fontSize: 11, width: 70, fontWeight: '600' },
    heatmapBars: { flex: 1, gap: 3 },
    heatmapBarRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    heatmapBarLabel: { color: Colors.text.tertiary, fontSize: 9, width: 28 },
    heatmapBar: { height: 6, borderRadius: 3, minWidth: 4 },
    heatmapBarWant: { backgroundColor: Colors.primary.start },
    heatmapBarHave: { backgroundColor: Colors.accent.start },
    heatmapBarCount: { color: Colors.text.tertiary, fontSize: 9, width: 16 },
    analyticsStats: {
        flexDirection: 'row', justifyContent: 'space-around',
        borderTopWidth: 1, borderTopColor: Colors.divider,
        paddingTop: 12,
    },
    analyticsStat: { alignItems: 'center' },
    analyticsStatValue: { color: Colors.text.primary, fontSize: 18, fontWeight: '800' },
    analyticsStatLabel: { color: Colors.text.tertiary, fontSize: 10, marginTop: 2 },

    // Offer cards
    offerCard: {
        backgroundColor: Colors.card.background, borderRadius: 14,
        padding: 14, marginBottom: 8,
        shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 1, shadowRadius: 4, elevation: 2,
    },
    offerTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    offerIconBox: {
        width: 38, height: 38, borderRadius: 11,
        justifyContent: 'center', alignItems: 'center',
    },
    offerSeat: { color: Colors.text.primary, fontSize: 15, fontWeight: '700' },
    offerDetail: { color: Colors.text.secondary, fontSize: 12, marginTop: 2 },
    offerTime: { color: Colors.text.tertiary, fontSize: 11 },
    expiryText: { color: Colors.warning.start, fontSize: 10, marginTop: 2 },
    offerSwapVisual: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 8, marginTop: 10, paddingTop: 10,
        borderTopWidth: 1, borderTopColor: Colors.divider,
    },
    offerSwapChip: {
        backgroundColor: Colors.background.tertiary, borderRadius: 8,
        paddingHorizontal: 12, paddingVertical: 5,
    },
    offerSwapChipDesired: { backgroundColor: Colors.success.light },
    offerSwapChipText: { color: Colors.text.secondary, fontSize: 12, fontWeight: '600' },

    priorityBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
    priorityText: { fontSize: 10, fontWeight: '800' },

    emptyState: { alignItems: 'center', paddingVertical: 30, gap: 8 },
    emptyTitle: { color: Colors.text.secondary, fontSize: 14, fontWeight: '600' },
    emptySub: { color: Colors.text.tertiary, fontSize: 12, textAlign: 'center' },

    goRegisterBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        marginTop: 12, backgroundColor: Colors.primary.light,
        paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10,
    },
    goRegisterText: { color: Colors.primary.start, fontSize: 13, fontWeight: '600' },

    typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    typeChip: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        backgroundColor: Colors.background.tertiary, borderRadius: 12,
        paddingHorizontal: 14, paddingVertical: 11,
        borderWidth: 1.5, borderColor: Colors.card.border,
    },
    typeChipActive: {
        backgroundColor: Colors.primary.start, borderColor: Colors.primary.start,
    },
    typeChipDesired: {
        backgroundColor: Colors.success.start, borderColor: Colors.success.start,
    },
    reasonChipActive: {
        backgroundColor: Colors.accent.start, borderColor: Colors.accent.start,
    },
    typeChipText: { color: Colors.text.secondary, fontSize: 13, fontWeight: '600' },
    typeChipTextActive: { color: '#fff' },

    swapPreview: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        marginTop: 20, paddingTop: 18,
        borderTopWidth: 1, borderTopColor: Colors.divider,
        gap: 16,
    },
    swapSide: { alignItems: 'center' },
    swapLabel: { color: Colors.text.tertiary, fontSize: 11, marginBottom: 4 },
    swapValue: { color: Colors.text.primary, fontSize: 16, fontWeight: '800' },
    swapArrow: {
        width: 40, height: 40, borderRadius: 20,
        justifyContent: 'center', alignItems: 'center',
    },

    submitBtn: {
        flexDirection: 'row', justifyContent: 'center', alignItems: 'center',
        paddingVertical: 16, borderRadius: 14, gap: 10,
    },
    submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },

    successCard: {
        alignItems: 'center', padding: 24,
        backgroundColor: Colors.card.background, borderRadius: 16,
        marginBottom: 16,
        shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1, shadowRadius: 8, elevation: 2,
    },
    successIconBox: {
        width: 64, height: 64, borderRadius: 32,
        backgroundColor: Colors.success.light,
        justifyContent: 'center', alignItems: 'center', marginBottom: 14,
    },
    successTitle: { color: Colors.text.primary, fontSize: 20, fontWeight: '800', marginBottom: 8 },
    successDesc: { color: Colors.text.secondary, fontSize: 14, textAlign: 'center' },
    successMesh: {
        color: Colors.text.tertiary, fontSize: 12, textAlign: 'center',
        marginTop: 10, fontStyle: 'italic',
    },
    cancelBtn: {
        marginTop: 14, backgroundColor: Colors.danger.light, borderRadius: 10,
        paddingHorizontal: 20, paddingVertical: 8,
        borderWidth: 1, borderColor: `${Colors.danger.start}25`,
    },
    cancelBtnText: { color: Colors.danger.start, fontSize: 13, fontWeight: '600' },

    matchesSection: { marginBottom: 16 },
    matchCard: {
        backgroundColor: Colors.card.background, borderRadius: 14,
        padding: 14, marginBottom: 8, gap: 12,
        borderWidth: 1, borderColor: `${Colors.accent.start}15`,
        shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 1, shadowRadius: 4, elevation: 2,
    },
    matchHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    matchTypeBadge: {
        backgroundColor: Colors.accent.light, borderRadius: 6,
        paddingHorizontal: 8, paddingVertical: 3,
    },
    matchTypeText: { color: Colors.accent.start, fontSize: 10, fontWeight: '800' },
    matchCyclePath: { color: Colors.text.tertiary, fontSize: 11, flex: 1 },

    acceptBtn: {
        backgroundColor: Colors.success.start, borderRadius: 10,
        paddingHorizontal: 16, paddingVertical: 8,
    },
    acceptedBtn: { backgroundColor: Colors.background.tertiary },
    acceptBtnText: { color: '#fff', fontSize: 13, fontWeight: '700' },

    notifBanner: {
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 100,
        backgroundColor: Colors.success.start,
        paddingTop: Platform.OS === 'ios' ? 55 : 40,
        paddingBottom: 14, paddingHorizontal: 20,
        flexDirection: 'row', alignItems: 'center', gap: 10,
    },
    notifText: { color: '#fff', fontSize: 13, fontWeight: '600', flex: 1, lineHeight: 18 },
});
