/**
 * API Service — Frontend Data Layer
 *
 * Provides a unified interface for data access.
 * Currently uses mock data (USE_LIVE_API = false).
 * When the backend is ready, flip the flag to switch to real API calls.
 */

import {
    Train,
    SearchParams,
} from '../models/types';
import {
    searchTrainAvailability,
    getTrainSuggestions as mockGetTrainSuggestions,
    getStationsForTrain as mockGetStationsForTrain,
    getTrainRunningDays as mockGetTrainRunningDays,
} from './mockDataService';

// ============================================================
// CONFIGURATION
// ============================================================

/**
 * Set to `true` when the backend server is ready and running.
 * When `false`, all data comes from mockDataService.
 */
const USE_LIVE_API = false;

/**
 * Backend API base URL. Update this if your server runs on a different host/port.
 * For Expo Go on physical device, use your computer's local IP (not localhost).
 */
const API_BASE_URL = 'http://localhost:3001';

// ============================================================
// TRAIN SEARCH
// ============================================================

/**
 * Search for train seat availability.
 * Uses mock data when USE_LIVE_API is false.
 */
export async function searchTrain(params: SearchParams): Promise<Train | null> {
    if (!USE_LIVE_API) {
        // Simulate network delay for realistic UX
        await new Promise(resolve => setTimeout(resolve, 800));
        return searchTrainAvailability(params);
    }

    try {
        const url = `${API_BASE_URL}/api/trains/${params.trainNumber}/availability?from=${params.fromStation}&to=${params.toStation}&date=${params.journeyDate}`;
        const response = await fetch(url);

        if (!response.ok) {
            console.warn(`API returned ${response.status}, falling back to mock data`);
            return searchTrainAvailability(params);
        }

        return await response.json();
    } catch (error) {
        console.warn('API unreachable, using mock data:', error);
        return searchTrainAvailability(params);
    }
}

// ============================================================
// TRAIN SUGGESTIONS & STATIONS
// ============================================================

export function getTrainSuggestions(query: string) {
    // Suggestions always come from local data (instant, no API needed)
    return mockGetTrainSuggestions(query);
}

export function getStationsForTrain(trainNumber: string) {
    return mockGetStationsForTrain(trainNumber);
}

export function getTrainRunningDays(trainNumber: string) {
    return mockGetTrainRunningDays(trainNumber);
}

// ============================================================
// SEAT REPORTS (Backend-only features, stubbed for now)
// ============================================================

export interface SeatReportData {
    seatId: number;
    status: 'EMPTY' | 'OCCUPIED';
    deviceId: string;
    gpsLat?: number;
    gpsLong?: number;
    verificationMethod?: string;
}

/**
 * Submit a crowdsourced seat report.
 * Only works when USE_LIVE_API is true.
 */
export async function reportSeat(data: SeatReportData): Promise<{ success: boolean; reportId?: number }> {
    if (!USE_LIVE_API) {
        console.log('[Mock] Seat report submitted:', data);
        return { success: true, reportId: Math.floor(Math.random() * 1000) };
    }

    const response = await fetch(`${API_BASE_URL}/api/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    return response.json();
}

/**
 * Get confidence score for a seat.
 */
export async function getSeatConfidence(seatId: number): Promise<{
    confidence: number;
    status: string;
    totalReports: number;
}> {
    if (!USE_LIVE_API) {
        return {
            confidence: 0.5 + Math.random() * 0.5,
            status: Math.random() > 0.5 ? 'EMPTY' : 'OCCUPIED',
            totalReports: Math.floor(Math.random() * 20),
        };
    }

    const response = await fetch(`${API_BASE_URL}/api/seats/${seatId}/confidence`);
    return response.json();
}

// ============================================================
// SWAP REQUESTS
// ============================================================

export interface SwapRequestData {
    trainNo: string;
    userId: string;
    currentCoachId: string;
    currentSeatNo: number;
    currentSeatType: string;
    desiredSeatType: string;
    journeyDate: string;
}

export async function createSwapRequest(data: SwapRequestData): Promise<{ success: boolean; swapId?: number }> {
    if (!USE_LIVE_API) {
        console.log('[Mock] Swap request created:', data);
        return { success: true, swapId: Math.floor(Math.random() * 1000) };
    }

    const response = await fetch(`${API_BASE_URL}/api/swaps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    return response.json();
}

export async function findSwapMatches(
    trainNo: string,
    journeyDate: string,
    currentSeatType?: string,
    desiredSeatType?: string
) {
    if (!USE_LIVE_API) {
        await new Promise(r => setTimeout(r, 500));
        // All possible mock swap registrations in the system
        const allMockOffers = [
            { id: 101, otherUserId: 'user_abc', otherCoachId: 'B2', otherSeatNo: 15, otherSeatType: 'LOWER', desiredSeatType: 'UPPER', createdAt: new Date().toISOString() },
            { id: 102, otherUserId: 'user_def', otherCoachId: 'S4', otherSeatNo: 33, otherSeatType: 'SIDE_LOWER', desiredSeatType: 'MIDDLE', createdAt: new Date().toISOString() },
            { id: 103, otherUserId: 'user_ghi', otherCoachId: 'B1', otherSeatNo: 8, otherSeatType: 'UPPER', desiredSeatType: 'LOWER', createdAt: new Date().toISOString() },
            { id: 104, otherUserId: 'user_jkl', otherCoachId: 'B3', otherSeatNo: 22, otherSeatType: 'MIDDLE', desiredSeatType: 'LOWER', createdAt: new Date().toISOString() },
            { id: 105, otherUserId: 'user_mno', otherCoachId: 'S2', otherSeatNo: 41, otherSeatType: 'LOWER', desiredSeatType: 'SIDE_LOWER', createdAt: new Date().toISOString() },
        ];

        // Filter: only show matches where their seat type = what you want, AND they want what you have
        let filtered = allMockOffers;
        if (currentSeatType && desiredSeatType) {
            filtered = allMockOffers.filter(
                m => m.otherSeatType === desiredSeatType && m.desiredSeatType === currentSeatType
            );
        }

        return { matches: filtered, totalMatches: filtered.length };
    }

    let url = `${API_BASE_URL}/api/swaps/${trainNo}/${journeyDate}/matches`;
    if (currentSeatType && desiredSeatType) {
        url += `?currentSeatType=${currentSeatType}&desiredSeatType=${desiredSeatType}`;
    }
    const response = await fetch(url);
    return response.json();
}

export async function acceptSwapRequest(swapId: number): Promise<{ success: boolean; message: string }> {
    if (!USE_LIVE_API) {
        await new Promise(r => setTimeout(r, 400));
        return { success: true, message: 'Swap accepted! The other passenger will be notified.' };
    }

    const response = await fetch(`${API_BASE_URL}/api/swaps/${swapId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    });
    return response.json();
}

export async function browseSwapOffers(trainNo: string, journeyDate: string) {
    if (!USE_LIVE_API) {
        await new Promise(r => setTimeout(r, 400));
        const allOffers = [
            { id: 101, userId: 'user_abc', coachId: 'B2', seatNo: 15, currentSeatType: 'LOWER', desiredSeatType: 'UPPER', createdAt: new Date(Date.now() - 3600000).toISOString() },
            { id: 102, userId: 'user_def', coachId: 'S4', seatNo: 33, currentSeatType: 'SIDE_LOWER', desiredSeatType: 'MIDDLE', createdAt: new Date(Date.now() - 7200000).toISOString() },
            { id: 103, userId: 'user_ghi', coachId: 'B1', seatNo: 8, currentSeatType: 'UPPER', desiredSeatType: 'LOWER', createdAt: new Date(Date.now() - 1800000).toISOString() },
            { id: 104, userId: 'user_jkl', coachId: 'B3', seatNo: 22, currentSeatType: 'MIDDLE', desiredSeatType: 'LOWER', createdAt: new Date(Date.now() - 5400000).toISOString() },
            { id: 105, userId: 'user_mno', coachId: 'S2', seatNo: 41, currentSeatType: 'LOWER', desiredSeatType: 'SIDE_LOWER', createdAt: new Date(Date.now() - 900000).toISOString() },
            { id: 106, userId: 'user_pqr', coachId: 'B1', seatNo: 4, currentSeatType: 'SIDE_UPPER', desiredSeatType: 'LOWER', createdAt: new Date(Date.now() - 600000).toISOString() },
        ];
        return { offers: allOffers, totalOffers: allOffers.length };
    }

    const response = await fetch(`${API_BASE_URL}/api/swaps/${trainNo}/${journeyDate}/browse`);
    return response.json();
}

// ============================================================
// PNR PARSING & ANALYTICS
// ============================================================

export interface PNRResult {
    pnrHash: string;
    trainNo: string;
    trainName?: string;
    journeyDate?: string;
    classType?: string;
    coachId: string;
    seatNo: number;
    berthType: string;
    status: 'CNF' | 'WL' | 'RAC' | 'CHART_PREPARED';
    vacancyInference?: string;
}

/**
 * Parse an IRCTC SMS or PNR-related text.
 * Returns parsed seat/train data + any vacancy inference.
 */
export async function parsePNR(smsText: string): Promise<PNRResult | null> {
    if (!USE_LIVE_API) {
        await new Promise(r => setTimeout(r, 600));
        // Mock: Simulate parsing a PNR
        const pnrMatch = smsText.match(/\d{10}/);
        if (!pnrMatch) return null;

        const mockTrains = ['12301', '12951', '12003', '12049', '12259'];
        const mockCoaches = ['B1', 'B2', 'B3', 'S1', 'S2', 'A1'];
        const mockBerthTypes = ['LB', 'MB', 'UB', 'SL', 'SU'];
        const mockStatuses: PNRResult['status'][] = ['CNF', 'WL', 'RAC', 'CNF'];

        return {
            pnrHash: `mock_${pnrMatch[0].substring(0, 6)}xxxx`,
            trainNo: mockTrains[Math.floor(Math.random() * mockTrains.length)],
            trainName: 'Howrah Rajdhani Express',
            journeyDate: new Date().toISOString().split('T')[0],
            classType: '3A',
            coachId: mockCoaches[Math.floor(Math.random() * mockCoaches.length)],
            seatNo: Math.floor(Math.random() * 72) + 1,
            berthType: mockBerthTypes[Math.floor(Math.random() * mockBerthTypes.length)],
            status: mockStatuses[Math.floor(Math.random() * mockStatuses.length)],
            vacancyInference: Math.random() > 0.5
                ? 'WL 5 → CNF: Seat B3/42 is now OCCUPIED (upgraded from WL)'
                : undefined,
        };
    }

    try {
        const response = await fetch(`${API_BASE_URL}/api/pnr/parse`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ smsText }),
        });
        if (!response.ok) return null;
        return response.json();
    } catch {
        return null;
    }
}

export interface PNRAnalytics {
    trainNo: string;
    totalPNRsTracked: number;
    confirmedCount: number;
    waitlistCount: number;
    racCount: number;
    estimatedVacancy: number;
    vacancyPercentage: number;
    lastUpdated: string;
}

/**
 * Get aggregated PNR analytics for a train — how many seats appear vacant
 * based on collective PNR data from all users.
 */
export async function getPNRAnalytics(trainNo: string): Promise<PNRAnalytics> {
    if (!USE_LIVE_API) {
        await new Promise(r => setTimeout(r, 400));
        const total = Math.floor(Math.random() * 200) + 50;
        const confirmed = Math.floor(total * (0.6 + Math.random() * 0.3));
        const wl = Math.floor((total - confirmed) * 0.6);
        const rac = total - confirmed - wl;
        const trainCapacity = 800;
        const estimatedVacancy = trainCapacity - confirmed;

        return {
            trainNo,
            totalPNRsTracked: total,
            confirmedCount: confirmed,
            waitlistCount: wl,
            racCount: rac,
            estimatedVacancy: Math.max(0, estimatedVacancy),
            vacancyPercentage: Math.round((Math.max(0, estimatedVacancy) / trainCapacity) * 100),
            lastUpdated: new Date().toISOString(),
        };
    }

    const response = await fetch(`${API_BASE_URL}/api/pnr/analytics/${trainNo}`);
    return response.json();
}

// ============================================================
// TOILET STATUS
// ============================================================

export interface ToiletStatusData {
    id: number;
    trainNo: string;
    coachId: string;
    toiletType: 'WESTERN' | 'INDIAN';
    cleanlinessScore: number;
    waterAvailable: boolean;
    queueLength: number;
    reportedBy: string;
    timestamp: string;
}

export async function getToiletStatus(trainNo: string, coachId: string): Promise<ToiletStatusData[]> {
    if (!USE_LIVE_API) {
        await new Promise(r => setTimeout(r, 400));
        return [
            {
                id: 1,
                trainNo,
                coachId,
                toiletType: 'WESTERN',
                cleanlinessScore: 3.5,
                waterAvailable: true,
                queueLength: 2,
                reportedBy: 'mock_user',
                timestamp: new Date(Date.now() - 600000).toISOString(),
            },
            {
                id: 2,
                trainNo,
                coachId,
                toiletType: 'INDIAN',
                cleanlinessScore: 2.8,
                waterAvailable: false,
                queueLength: 0,
                reportedBy: 'mock_user_2',
                timestamp: new Date(Date.now() - 1200000).toISOString(),
            },
        ];
    }

    const response = await fetch(`${API_BASE_URL}/api/toilets/${trainNo}/${coachId}`);
    return response.json();
}

export interface ToiletReportData {
    trainNo: string;
    coachId: string;
    toiletType: 'WESTERN' | 'INDIAN';
    cleanlinessScore: number;
    waterAvailable: boolean;
    queueLength: number;
    westernCount?: number;
    indianCount?: number;
    reportedBy: string;
}

export async function reportToiletStatus(data: ToiletReportData): Promise<{ success: boolean }> {
    if (!USE_LIVE_API) {
        console.log('[Mock] Toilet report submitted:', data);
        await new Promise(r => setTimeout(r, 300));
        return { success: true };
    }

    const response = await fetch(`${API_BASE_URL}/api/toilets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
    });
    return response.json();
}

// ============================================================
// UTILITY: Check backend connectivity
// ============================================================

export async function checkBackendHealth(): Promise<{
    isConnected: boolean;
    version?: string;
}> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/health`, {
            signal: AbortSignal.timeout(3000),
        });

        if (response.ok) {
            const data = await response.json();
            return { isConnected: true, version: data.version };
        }
        return { isConnected: false };
    } catch {
        return { isConnected: false };
    }
}

/**
 * Returns whether the service is currently using live API or mock data.
 */
export function isUsingLiveAPI(): boolean {
    return USE_LIVE_API;
}
