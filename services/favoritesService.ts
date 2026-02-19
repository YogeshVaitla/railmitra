// Favorites service using AsyncStorage
import AsyncStorage from '@react-native-async-storage/async-storage';
import { FavoriteSearch } from '../models/types';

const FAVORITES_KEY = 'train_seat_favorites';
const RECENT_SEARCHES_KEY = 'recent_searches';

export async function getFavorites(): Promise<FavoriteSearch[]> {
    try {
        const data = await AsyncStorage.getItem(FAVORITES_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
}

export async function addFavorite(fav: FavoriteSearch): Promise<void> {
    try {
        const existing = await getFavorites();
        // Check if already exists
        const exists = existing.find(
            (f) =>
                f.trainNumber === fav.trainNumber &&
                f.fromStation === fav.fromStation &&
                f.toStation === fav.toStation
        );
        if (!exists) {
            existing.unshift(fav);
            await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(existing.slice(0, 20)));
        }
    } catch {
        // ignore
    }
}

export async function removeFavorite(id: string): Promise<void> {
    try {
        const existing = await getFavorites();
        const filtered = existing.filter((f) => f.id !== id);
        await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(filtered));
    } catch {
        // ignore
    }
}

export async function isFavorite(
    trainNumber: string,
    fromStation: string,
    toStation: string
): Promise<boolean> {
    const favorites = await getFavorites();
    return favorites.some(
        (f) =>
            f.trainNumber === trainNumber &&
            f.fromStation === fromStation &&
            f.toStation === toStation
    );
}

export interface RecentSearch {
    trainNumber: string;
    trainName: string;
    fromStation: string;
    fromStationName: string;
    toStation: string;
    toStationName: string;
    date: string;
    searchedAt: string;
}

export async function getRecentSearches(): Promise<RecentSearch[]> {
    try {
        const data = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
        return data ? JSON.parse(data) : [];
    } catch {
        return [];
    }
}

export async function addRecentSearch(search: RecentSearch): Promise<void> {
    try {
        const existing = await getRecentSearches();
        // Remove duplicate if exists
        const filtered = existing.filter(
            (s) =>
                !(
                    s.trainNumber === search.trainNumber &&
                    s.fromStation === search.fromStation &&
                    s.toStation === search.toStation
                )
        );
        filtered.unshift(search);
        await AsyncStorage.setItem(
            RECENT_SEARCHES_KEY,
            JSON.stringify(filtered.slice(0, 3))
        );
    } catch {
        // ignore
    }
}
