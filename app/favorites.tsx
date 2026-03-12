import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    FlatList,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Colors } from '../constants/Colors';
import { FavoriteSearch } from '../models/types';
import { getFavorites, removeFavorite } from '../services/favoritesService';
import { t } from '../services/localization';

export default function FavoritesScreen() {
    const [favorites, setFavorites] = useState<FavoriteSearch[]>([]);

    useEffect(() => {
        loadFavorites();
    }, []);

    const loadFavorites = async () => {
        const favs = await getFavorites();
        setFavorites(favs);
    };

    const handleRemove = async (id: string) => {
        await removeFavorite(id);
        loadFavorites();
    };

    const handleSelect = (fav: FavoriteSearch) => {
        const today = new Date();
        const formatted = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

        router.push({
            pathname: '/results',
            params: {
                trainNumber: fav.trainNumber,
                journeyDate: formatted,
                fromStation: fav.fromStation,
                toStation: fav.toStation,
                fromStationName: fav.fromStationName,
                toStationName: fav.toStationName,
            },
        });
    };

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={20} color={Colors.text.primary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('favorites')}</Text>
                <View style={{ width: 42 }} />
            </View>

            {favorites.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <View style={styles.emptyIconBox}>
                        <Ionicons name="heart-outline" size={40} color={Colors.primary.start} />
                    </View>
                    <Text style={styles.emptyTitle}>{t('noFavorites')}</Text>
                    <Text style={styles.emptyText}>
                        Search for trains and tap the heart icon to save them here for quick access.
                    </Text>
                    <TouchableOpacity onPress={() => router.back()}>
                        <LinearGradient
                            colors={[Colors.primary.start, Colors.primary.end]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={styles.emptyButton}
                        >
                            <Text style={styles.emptyButtonText}>Search Trains</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            ) : (
                <FlatList
                    data={favorites}
                    keyExtractor={(item) => item.id}
                    contentContainerStyle={styles.listContent}
                    renderItem={({ item }) => (
                        <TouchableOpacity
                            style={styles.favCard}
                            onPress={() => handleSelect(item)}
                            activeOpacity={0.7}
                        >
                            <View style={styles.favTop}>
                                <LinearGradient
                                    colors={[Colors.primary.start, Colors.primary.end]}
                                    style={styles.favIcon}
                                >
                                    <MaterialCommunityIcons name="train" size={20} color="#fff" />
                                </LinearGradient>
                                <View style={styles.favInfo}>
                                    <Text style={styles.favTrain}>
                                        {item.trainNumber} - {item.trainName}
                                    </Text>
                                    <View style={styles.favRoute}>
                                        <Text style={styles.favStation}>
                                            {item.fromStation} ({item.fromStationName})
                                        </Text>
                                        <Ionicons name="arrow-forward" size={12} color={Colors.text.tertiary} />
                                        <Text style={styles.favStation}>
                                            {item.toStation} ({item.toStationName})
                                        </Text>
                                    </View>
                                </View>
                                <TouchableOpacity
                                    onPress={() => handleRemove(item.id)}
                                    style={styles.removeBtn}
                                >
                                    <Ionicons name="trash-outline" size={18} color={Colors.danger.start} />
                                </TouchableOpacity>
                            </View>
                        </TouchableOpacity>
                    )}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1, backgroundColor: Colors.background.primary,
        paddingTop: Platform.OS === 'ios' ? 55 : 40,
    },
    header: {
        flexDirection: 'row', alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20, marginBottom: 20,
    },
    backBtn: {
        width: 42, height: 42, borderRadius: 13,
        backgroundColor: Colors.card.background,
        justifyContent: 'center', alignItems: 'center',
        shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1, shadowRadius: 6, elevation: 3,
    },
    headerTitle: { color: Colors.text.primary, fontSize: 18, fontWeight: '700' },
    emptyContainer: {
        flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40,
    },
    emptyIconBox: {
        width: 80, height: 80, borderRadius: 24,
        backgroundColor: Colors.primary.light,
        justifyContent: 'center', alignItems: 'center',
        marginBottom: 20,
    },
    emptyTitle: {
        color: Colors.text.primary, fontSize: 18, fontWeight: '700', marginBottom: 8,
    },
    emptyText: {
        color: Colors.text.secondary, fontSize: 14,
        textAlign: 'center', lineHeight: 22, marginBottom: 24,
    },
    emptyButton: {
        paddingHorizontal: 28, paddingVertical: 14, borderRadius: 14,
    },
    emptyButtonText: { color: '#fff', fontSize: 15, fontWeight: '700' },
    listContent: { paddingHorizontal: 20, paddingBottom: 20 },
    favCard: {
        backgroundColor: Colors.card.background,
        borderRadius: 14, padding: 16, marginBottom: 10,
        shadowColor: Colors.shadow, shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 1, shadowRadius: 4, elevation: 2,
    },
    favTop: {
        flexDirection: 'row', alignItems: 'center', gap: 12,
    },
    favIcon: {
        width: 42, height: 42, borderRadius: 12,
        justifyContent: 'center', alignItems: 'center',
    },
    favInfo: { flex: 1 },
    favTrain: { color: Colors.text.primary, fontSize: 15, fontWeight: '700' },
    favRoute: {
        flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4,
    },
    favStation: { color: Colors.text.tertiary, fontSize: 12 },
    removeBtn: {
        width: 36, height: 36, borderRadius: 10,
        backgroundColor: Colors.danger.light,
        justifyContent: 'center', alignItems: 'center',
    },
});
