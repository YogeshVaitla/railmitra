import React, { useEffect, useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    FlatList,
    StyleSheet,
    Platform,
    Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Colors from '../constants/Colors';
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
        <LinearGradient colors={Colors.background.dark as any} style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="arrow-back" size={22} color="#fff" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>{t('favorites')}</Text>
                <View style={{ width: 40 }} />
            </View>

            {favorites.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <LinearGradient
                        colors={[Colors.primary.start, Colors.primary.end]}
                        style={styles.emptyIcon}
                    >
                        <Ionicons name="heart-outline" size={40} color="#fff" />
                    </LinearGradient>
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
                            <LinearGradient
                                colors={['rgba(255,255,255,0.08)', 'rgba(255,255,255,0.03)']}
                                style={styles.favCardGradient}
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
                                            <Ionicons name="arrow-forward" size={12} color="rgba(255,255,255,0.4)" />
                                            <Text style={styles.favStation}>
                                                {item.toStation} ({item.toStationName})
                                            </Text>
                                        </View>
                                    </View>
                                    <TouchableOpacity
                                        onPress={() => handleRemove(item.id)}
                                        style={styles.removeBtn}
                                    >
                                        <Ionicons name="trash-outline" size={18} color={Colors.danger.end} />
                                    </TouchableOpacity>
                                </View>
                            </LinearGradient>
                        </TouchableOpacity>
                    )}
                />
            )}
        </LinearGradient>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: Platform.OS === 'ios' ? 55 : 40,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        marginBottom: 20,
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.08)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    headerTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    emptyIcon: {
        width: 80,
        height: 80,
        borderRadius: 24,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 20,
    },
    emptyTitle: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '700',
        marginBottom: 8,
    },
    emptyText: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 14,
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 24,
    },
    emptyButton: {
        paddingHorizontal: 28,
        paddingVertical: 14,
        borderRadius: 14,
    },
    emptyButtonText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '700',
    },
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 20,
    },
    favCard: {
        borderRadius: 14,
        overflow: 'hidden',
        marginBottom: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
    },
    favCardGradient: {
        padding: 16,
    },
    favTop: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    favIcon: {
        width: 42,
        height: 42,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    favInfo: {
        flex: 1,
    },
    favTrain: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '700',
    },
    favRoute: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 4,
    },
    favStation: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 12,
    },
    removeBtn: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: 'rgba(244, 92, 67, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
});
