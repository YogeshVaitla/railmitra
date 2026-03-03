/**
 * This is our main data layer. 
 * 
 * We toggle between mock data and the real backend using USE_LIVE_API.
 * If you're running the backend server, flip that flag to true!
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

// --- CONFIG ---

// Flip this to true when your local server is up and running
const USE_LIVE_API = false;

// If you're on a physical phone, change 'localhost' to your computer's IP
const API_BASE_URL = 'http://localhost:3001';

// --- TRAIN SEARCH ---

/**
 * The main search function. 
 * If we're in mock mode, we add a little delay so the UI feels more "real".
 */
export async function searchTrain(params: SearchParams): Promise<Train | null> {
    if (!USE_LIVE_API) {
        await new Promise(resolve => setTimeout(resolve, 800));
        return searchTrainAvailability(params);
    }

    try {
        const url = `${API_BASE_URL}/api/trains/${params.trainNumber}/availability?from=${params.fromStation}&to=${params.toStation}&date=${params.journeyDate}`;
        const response = await fetch(url);

        if (!response.ok) {
            console.warn(`Server complained with ${response.status}, falling back to mock data.`);
            return searchTrainAvailability(params);
        }

        return await response.json();
    } catch (error) {
        console.warn('Can\'t reach the server, using mock data instead:', error);
        return searchTrainAvailability(params);
    }
}

// These are pretty straightforward—just grabbing basic train info
export function getTrainSuggestions(query: string) {
    return mockGetTrainSuggestions(query);
}

export function getStationsForTrain(trainNumber: string) {
    return mockGetStationsForTrain(trainNumber);
}

export function getTrainRunningDays(trainNumber: string) {
    return mockGetTrainRunningDays(trainNumber);
}

// --- SEAT REPORTS ---

export interface SeatReportData {
    seatId: number;
    status: 'EMPTY' | 'OCCUPIED';
    deviceId: string;
    gpsLat?: number;
    gpsLong?: number;
    verificationMethod?: string;
}

/**
 * Send a report about a seat to the server.
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
 * Check how much we trust a seat's current status.
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

// --- SWAP REQUESTS ---

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

/**
 * Look for people on the same train who want to swap.
 */
export async function findSwapMatches(
    trainNo: string,
    journeyDate: string,
    currentSeatType?: string,
    desiredSeatType?: string
) {
    if (!USE_LIVE_API) {
        await new Promise(r => setTimeout(r, 500));

        const allMockOffers = [
            { id: 101, otherUserId: 'user_abc', otherCoachId: 'B2', otherSeatNo: 15, otherSeatType: 'LOWER', desiredSeatType: 'UPPER', createdAt: new Date().toISOString() },
            { id: 102, otherUserId: 'user_def', otherCoachId: 'S4', otherSeatNo: 33, otherSeatType: 'SIDE_LOWER', desiredSeatType: 'MIDDLE', createdAt: new Date().toISOString() },
            { id: 103, otherUserId: 'user_ghi', otherCoachId: 'B1', otherSeatNo: 8, otherSeatType: 'UPPER', desiredSeatType: 'LOWER', createdAt: new Date().toISOString() },
            { id: 104, otherUserId: 'user_jkl', otherCoachId: 'B3', otherSeatNo: 22, otherSeatType: 'MIDDLE', desiredSeatType: 'LOWER', createdAt: new Date().toISOString() },
            { id: 105, otherUserId: 'user_mno', otherCoachId: 'S2', otherSeatNo: 41, otherSeatType: 'LOWER', desiredSeatType: 'SIDE_LOWER', createdAt: new Date().toISOString() },
        ];

        // Filter: do they want what I have, and do they have what I want?
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
        return { success: true, message: 'Swap accepted! The other passenger will get a ping.' };
    }

    const response = await fetch(`${API_BASE_URL}/api/swaps/${swapId}/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    });
    return response.json();
}

export async function rejectSwapRequest(swapId: number): Promise<{ success: boolean; message: string }> {
    if (!USE_LIVE_API) {
        await new Promise(r => setTimeout(r, 400));
        return { success: true, message: 'Swap rejected. Back to looking.' };
    }

    const response = await fetch(`${API_BASE_URL}/api/swaps/${swapId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    });
    return response.json();
}

export async function cancelSwapRequest(swapId: number): Promise<{ success: boolean; message: string }> {
    if (!USE_LIVE_API) {
        await new Promise(r => setTimeout(r, 300));
        return { success: true, message: 'Swap cancelled.' };
    }

    const response = await fetch(`${API_BASE_URL}/api/swaps/${swapId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    });
    return response.json();
}

export async function getSwapAnalytics(trainNo: string, journeyDate: string) {
    if (!USE_LIVE_API) {
        return {
            totalOffers: 6, activeOffers: 4, completedSwaps: 1, successRate: 0.17,
            demandHeatmap: {
                LOWER: { wanted: 4, offered: 2 }, MIDDLE: { wanted: 1, offered: 2 },
                UPPER: { wanted: 0, offered: 3 }, SIDE_LOWER: { wanted: 2, offered: 1 },
                SIDE_UPPER: { wanted: 1, offered: 0 },
            },
        };
    }

    const response = await fetch(`${API_BASE_URL}/api/swaps/${trainNo}/${journeyDate}/analytics`);
    return response.json();
}

/**
 * See a list of all people on this train looking to swap.
 */
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

// --- PNR & ANALYTICS ---

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
 * Parse an IRCTC PNR text.
 * We also try to guess if anyone's canceled based on the waitlist status.
 */
export async function parsePNR(smsText: string): Promise<PNRResult | null> {
    if (!USE_LIVE_API) {
        await new Promise(r => setTimeout(r, 600));
        // Just look for 10 digits in a row
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
                ? 'Waitlist moved up — Seat B3/42 probably fresh.'
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
        return null; // Silent fail if server is down
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
 * Get the crowd-sourced data on how full a train actually is.
 */
export async function getPNRAnalytics(trainNo: string): Promise<PNRAnalytics> {
    if (!USE_LIVE_API) {
        await new Promise(r => setTimeout(r, 400));
        const total = Math.floor(Math.random() * 200) + 50;
        const confirmed = Math.floor(total * (0.6 + Math.random() * 0.3));
        const wl = Math.floor((total - confirmed) * 0.6);
        const rac = total - confirmed - wl;
        const trainCapacity = 800; // Rough average
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

// --- TOILET STATUS ---

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
                reportedBy: 'user_1',
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
                reportedBy: 'user_2',
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

// --- CONNECTIVITY CHECK ---

export async function checkBackendHealth(): Promise<{
    isConnected: boolean;
    version?: string;
}> {
    try {
        const response = await fetch(`${API_BASE_URL}/api/health`, {
            signal: AbortSignal.timeout(3000), // Don't hang forever
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
 * Quick helper to check if we're in mock mode.
 */
export function isUsingLiveAPI(): boolean {
    return USE_LIVE_API;
}
