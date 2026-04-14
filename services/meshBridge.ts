/**
 * Mesh Bridge — P2P Abstraction Layer
 * 
 * Abstracts device-to-device communication for swap offer broadcasting.
 * In production, this would use Android Nearby Connections API (Wi-Fi Direct + BT).
 * For development, we use a MockMeshBridge that simulates peer discovery.
 * 
 * Message format follows the spec in docs/mesh-protocol.md:
 * - version, type, senderId, trainNo, timestamp, ttl, payload
 */

import NetInfo, { NetInfoSubscription } from '@react-native-community/netinfo';
import { NearbyMeshBridge } from './NearbyMeshBridge';
import { getOrCreateDeviceId, LocalSwap, mergeRemoteSwaps, SeatType, SwapReason } from './swapStore';

// --- Types ---

export interface MeshMessage {
    version: number;
    type: 'SWAP_OFFER' | 'SWAP_ACCEPT' | 'SWAP_CANCEL' | 'HEARTBEAT';
    senderId: string;
    trainNo: string;
    timestamp: number;
    ttl: number;                // Seconds until this message expires
    payload: any;
}

export interface MeshPeer {
    id: string;
    name?: string;
    coachId?: string;
    lastSeen: number;
}

export type SwapReceivedCallback = (swaps: LocalSwap[]) => void;
export type PeerCountCallback = (count: number) => void;

// --- Abstract Bridge ---

export interface IMeshBridge {
    startAdvertising(trainNo: string, journeyDate: string): Promise<void>;
    startDiscovery(trainNo: string, journeyDate: string): Promise<void>;
    broadcastSwapOffer(swap: LocalSwap): void;
    broadcastSwapAccept(swapId: string, matchedSwapId: string): void;
    broadcastSwapCancel(swapId: string): void;
    broadcastSessionComplete(sessionId: string): void;
    broadcastSessionFail(sessionId: string): void;
    onSwapReceived(callback: SwapReceivedCallback): void;
    onPeerCountChanged(callback: PeerCountCallback): void;
    getPeerCount(): number;
    getConnectedPeers(): MeshPeer[];
    isActive(): boolean;
    stop(): void;
    forcePoll(): Promise<void>;
}

// --- Mock Implementation for Development ---

/**
 * Simulates P2P mesh networking for development/testing.
 * 
 * Generates synthetic swap offers at random intervals to mimic
 * other passengers on the train broadcasting their offers.
 * In production, this would be replaced by the real Nearby Connections bridge.
 */
export class MockMeshBridge implements IMeshBridge {
    private active = false;
    private trainNo = '';
    private journeyDate = '';
    private swapCallbacks: SwapReceivedCallback[] = [];
    private peerCallbacks: PeerCountCallback[] = [];
    private peerCount = 0;
    private peers: MeshPeer[] = [];
    private intervals: ReturnType<typeof setInterval>[] = [];
    private deviceId = '';

    // Realistic Indian train passenger names (anonymous, just for variety)
    private mockCoaches = ['B1', 'B2', 'B3', 'B4', 'S1', 'S2', 'S3', 'S4', 'A1', 'A2'];
    private mockReasons: SwapReason[] = ['elderly', 'medical', 'family', 'preference'];

    async startAdvertising(trainNo: string, journeyDate: string): Promise<void> {
        this.trainNo = trainNo;
        this.journeyDate = journeyDate;
        this.active = true;
        this.deviceId = await getOrCreateDeviceId();
        this.startSimulation();
    }

    async startDiscovery(trainNo: string, journeyDate: string): Promise<void> {
        this.trainNo = trainNo;
        this.journeyDate = journeyDate;
        this.active = true;
        this.deviceId = await getOrCreateDeviceId();
        this.startSimulation();
    }

    private startSimulation(): void {
        // Simulate peers joining over time
        const peerInterval = setInterval(() => {
            if (!this.active) return;

            // Randomly add or remove peers
            if (Math.random() > 0.3 && this.peerCount < 8) {
                this.peerCount++;
                const peer: MeshPeer = {
                    id: `mock_peer_${Math.random().toString(36).substring(7)}`,
                    coachId: this.mockCoaches[Math.floor(Math.random() * this.mockCoaches.length)],
                    lastSeen: Date.now(),
                };
                this.peers.push(peer);
            } else if (this.peerCount > 1 && Math.random() > 0.7) {
                this.peerCount--;
                this.peers.pop();
            }

            this.peerCallbacks.forEach(cb => cb(this.peerCount));
        }, 5000 + Math.random() * 10000);

        // Simulate receiving swap offers from peers
        const swapInterval = setInterval(() => {
            if (!this.active || this.peerCount === 0) return;

            // ~30% chance of receiving a new swap offer each interval
            if (Math.random() > 0.3) return;

            const seatTypes: SeatType[] = ['LOWER', 'MIDDLE', 'UPPER', 'SIDE_LOWER', 'SIDE_UPPER'];
            const currentType = seatTypes[Math.floor(Math.random() * seatTypes.length)];
            let desiredType = seatTypes[Math.floor(Math.random() * seatTypes.length)];
            while (desiredType === currentType) {
                desiredType = seatTypes[Math.floor(Math.random() * seatTypes.length)];
            }

            const coach = this.mockCoaches[Math.floor(Math.random() * this.mockCoaches.length)];
            const reason = this.mockReasons[Math.floor(Math.random() * this.mockReasons.length)];
            const now = Date.now();

            const mockSwap: LocalSwap = {
                id: `mesh_${Math.random().toString(36).substring(2, 10)}`,
                deviceId: `peer_${Math.random().toString(36).substring(2, 10)}`,
                trainNo: this.trainNo,
                journeyDate: this.journeyDate,
                currentCoachId: coach,
                currentSeatNo: Math.floor(Math.random() * 72) + 1,
                currentSeatType: currentType,
                desiredSeatType: desiredType,
                status: 'OPEN',
                reason,
                priorityScore: 0.2 + Math.random() * 0.6,
                matchedWith: null,
                sessionId: null,
                expiresAt: now + 6 * 60 * 60 * 1000,
                createdAt: now - Math.floor(Math.random() * 3600000), // Up to 1 hour ago
                updatedAt: now,
                isLocal: false,
                boardingStation: null,
                destinationStation: null,
            };

            // Merge into local store and notify
            mergeRemoteSwaps([mockSwap]).then(({ added }) => {
                if (added > 0) {
                    this.swapCallbacks.forEach(cb => cb([mockSwap]));
                }
            });
        }, 8000 + Math.random() * 15000);

        this.intervals.push(peerInterval, swapInterval);

        // Initial peer discovery burst — simulate finding 2-3 peers quickly
        setTimeout(() => {
            if (!this.active) return;
            this.peerCount = 2 + Math.floor(Math.random() * 2);
            for (let i = 0; i < this.peerCount; i++) {
                this.peers.push({
                    id: `mock_peer_${Math.random().toString(36).substring(7)}`,
                    coachId: this.mockCoaches[Math.floor(Math.random() * this.mockCoaches.length)],
                    lastSeen: Date.now(),
                });
            }
            this.peerCallbacks.forEach(cb => cb(this.peerCount));
        }, 2000);
    }

    broadcastSwapOffer(swap: LocalSwap): void {
        if (!this.active) return;
        // In mock mode, just log it — real implementation would send via Nearby Connections
        console.log('[MockMesh] Broadcasting swap offer:', swap.id);
    }

    broadcastSwapAccept(swapId: string, matchedSwapId: string): void {
        if (!this.active) return;
        console.log('[MockMesh] Broadcasting swap accept:', swapId, '↔', matchedSwapId);
    }

    broadcastSwapCancel(swapId: string): void {
        if (!this.active) return;
        console.log('[MockMesh] Broadcasting swap cancel:', swapId);
    }

    broadcastSessionComplete(sessionId: string): void {
        if (!this.active) return;
        console.log('[MockMesh] Broadcasting session complete:', sessionId);
    }

    broadcastSessionFail(sessionId: string): void {
        if (!this.active) return;
        console.log('[MockMesh] Broadcasting session fail:', sessionId);
    }

    onSwapReceived(callback: SwapReceivedCallback): void {
        this.swapCallbacks.push(callback);
    }

    onPeerCountChanged(callback: PeerCountCallback): void {
        this.peerCallbacks.push(callback);
    }

    getPeerCount(): number {
        return this.peerCount;
    }

    getConnectedPeers(): MeshPeer[] {
        return [...this.peers];
    }

    isActive(): boolean {
        return this.active;
    }

    stop(): void {
        this.active = false;
        this.intervals.forEach(clearInterval);
        this.intervals = [];
        this.peerCount = 0;
        this.peers = [];
        this.swapCallbacks = [];
        this.peerCallbacks = [];
    }

    async forcePoll(): Promise<void> {
        // Mock bridge doesn't poll a server — no-op
    }
}

// --- Cloud Sync Implementation (Beta Testing) ---

/**
 * Cloud sync bridge — uses the backend server to share swap offers across devices.
 * 
 * This is a temporary replacement for real P2P mesh networking.
 * Keeps local AsyncStorage as the source of truth, syncs with server
 * in the background for cross-device discovery.
 * 
 * When real Nearby Connections is integrated, this becomes an
 * additional sync channel alongside P2P mesh.
 */

// Server URL — change this to your computer's IP for phone testing
// e.g. 'http://192.168.1.5:3001'// Default local config
const SYNC_SERVER_URL = 'https://railmitra-api.onrender.com';
const POLL_INTERVAL_MS = 15000; // Check for new offers every 15 seconds

/**
 * React Native / Hermes often lacks support for `AbortSignal.timeout()`.
 * This is a reliable wrapper to enforce fetch timeouts.
 */
async function fetchWithTimeout(url: string, options: RequestInit & { timeout?: number } = {}): Promise<Response> {
    const { timeout = 30000, ...fetchOptions } = options;

    // Fallback if AbortController isn't fully supported
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const id = setTimeout(() => controller?.abort(), timeout);

    try {
        const response = await fetch(url, {
            ...fetchOptions,
            signal: controller?.signal
        });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
}

export class CloudSyncBridge implements IMeshBridge {
    private active = false;
    private trainNo = '';
    private journeyDate = '';
    private deviceId = '';
    private swapCallbacks: SwapReceivedCallback[] = [];
    private peerCallbacks: PeerCountCallback[] = [];
    private peerCount = 0;
    private serverSwapIdMap = new Map<string, string>(); // local swap id -> server swap id
    private pollTimer: ReturnType<typeof setTimeout> | null = null;
    private serverReachable = false;
    private isPolling = false;

    async startAdvertising(trainNo: string, journeyDate: string): Promise<void> {
        this.trainNo = trainNo;
        this.journeyDate = journeyDate;
        this.active = true;
        this.deviceId = await getOrCreateDeviceId();
        await this.startPolling();
    }

    async startDiscovery(trainNo: string, journeyDate: string): Promise<void> {
        this.trainNo = trainNo;
        this.journeyDate = journeyDate;
        this.active = true;
        this.deviceId = await getOrCreateDeviceId();
        await this.startPolling();
    }

    private async startPolling(): Promise<void> {
        if (!this.active) return;
        this.isPolling = true;

        try {
            await this.fetchOffersFromServer();
            await this.flushOfflineQueue(); // Automatically retry missed actions
        } catch {
            // Ignored, try again next tick
        } finally {
            this.isPolling = false;
        }

        if (this.active) {
            this.pollTimer = setTimeout(() => this.startPolling(), POLL_INTERVAL_MS);
        }
    }

    public async forcePoll(): Promise<void> {
        console.log('[CloudSync] Force polling triggered (e.g. network restored)');
        if (this.active && !this.isPolling) {
            this.isPolling = true;
            try {
                await this.fetchOffersFromServer();
                await this.flushOfflineQueue();
            } finally {
                this.isPolling = false;
            }
        }
    }

    private async fetchOffersFromServer(): Promise<void> {
        try {
            console.log('[CloudSync] Fetching offers from server...');
            const response = await fetchWithTimeout(
                `${SYNC_SERVER_URL}/api/swaps/${this.trainNo}/${this.journeyDate}/browse`,
                { timeout: 30000 } // Render free tier can take 30s to wake up!
            );

            if (!response.ok) {
                const errText = await response.text();
                console.warn(`[CloudSync] fetchOffers failed: ${response.status} ${errText}`);
                this.serverReachable = false;
                return;
            }

            this.serverReachable = true;
            const data = await response.json();
            const serverOffers = data.offers || [];
            console.log(`[CloudSync] Received ${serverOffers.length} offers from server`);

            // Count unique users (excluding self) as "peers"
            const uniqueUsers = new Set<string>();
            const allSwaps: LocalSwap[] = [];

            for (const offer of serverOffers) {
                if (offer.userId === this.deviceId) continue; // Skip our own offers
                uniqueUsers.add(offer.userId);

                const expiresAtMs = (offer.expiresAt && !isNaN(new Date(offer.expiresAt).getTime())) 
                    ? new Date(offer.expiresAt).getTime() 
                    : Date.now() + 6 * 60 * 60 * 1000; // Backup expiry
                const createdAtMs = (offer.createdAt && !isNaN(new Date(offer.createdAt).getTime()))
                    ? new Date(offer.createdAt).getTime()
                    : Date.now();
                const updatedAtMs = (offer.updatedAt && !isNaN(new Date(offer.updatedAt).getTime()))
                    ? new Date(offer.updatedAt).getTime()
                    : Date.now();

                const localSwap: LocalSwap = {
                    id: `cloud_${offer.id}`,
                    deviceId: offer.userId,
                    trainNo: offer.trainNo,
                    journeyDate: offer.journeyDate,
                    currentCoachId: offer.currentCoachId,
                    currentSeatNo: offer.currentSeatNo,
                    currentSeatType: offer.currentSeatType as any,
                    desiredSeatType: offer.desiredSeatType as any,
                    status: offer.status === 'OPEN' ? 'OPEN' : 'MATCHED',
                    reason: offer.reason || 'preference',
                    priorityScore: offer.priorityScore || 0.3,
                    matchedWith: null,
                    sessionId: null,
                    expiresAt: expiresAtMs,
                    createdAt: createdAtMs,
                    updatedAt: updatedAtMs,
                    isLocal: false,
                    boardingStation: offer.boardingStation ?? null,
                    destinationStation: offer.destinationStation ?? null,
                };

                allSwaps.push(localSwap);
            }

            // Update peer count — always reflect latest server state
            const newPeerCount = uniqueUsers.size;
            if (newPeerCount !== this.peerCount) {
                this.peerCount = newPeerCount;
                this.peerCallbacks.forEach(cb => cb(this.peerCount));
            }

            // Merge ALL server offers into local store
            // mergeRemoteSwaps() handles deduplication by (deviceId, trainNo, coachId, seatNo, journeyDate)
            // This ensures offers deleted locally (e.g. by clearMockSwapData) get re-synced
            if (allSwaps.length > 0) {
                const { added } = await mergeRemoteSwaps(allSwaps);
                if (added > 0) {
                    this.swapCallbacks.forEach(cb => cb(allSwaps));
                }
            }
        } catch {
            // Server unreachable — that's fine, we're offline-first
            this.serverReachable = false;
            console.log('[CloudSync] Server not reachable, running in local-only mode');
        }
    }

    broadcastSwapOffer(swap: LocalSwap): void {
        if (!this.active) return;

        // Post to server in background — don't block the UI
        this.postOfferToServer(swap).catch(err => {
            console.log('[CloudSync] Failed to post offer to server:', err.message);
        });
    }

    private async postOfferToServer(swap: LocalSwap): Promise<void> {
        try {
            const response = await fetchWithTimeout(`${SYNC_SERVER_URL}/api/swaps`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                timeout: 30000, // Render cold start
                body: JSON.stringify({
                    trainNo: swap.trainNo,
                    userId: this.deviceId,
                    currentCoachId: swap.currentCoachId,
                    currentSeatNo: swap.currentSeatNo,
                    currentSeatType: swap.currentSeatType,
                    desiredSeatType: swap.desiredSeatType,
                    journeyDate: swap.journeyDate,
                    reason: swap.reason,
                }),
            });

            if (response.ok) {
                const result = await response.json();
                if (result.swapId) {
                    this.serverSwapIdMap.set(swap.id, result.swapId);
                    console.log('[CloudSync] Offer synced to server, ID:', result.swapId);
                }
            } else {
                const errText = await response.text();
                console.warn(`[CloudSync] postOffer failed: ${response.status} ${errText}`);
            }
        } catch (error: any) {
            console.warn('[CloudSync] Could not sync offer (network error):', error.message);
        }
    }

    // Resolve a local swap ID to the server's database ID.
    // Checks the local→server map first, then tries cloud_ prefix extraction.
    private resolveServerId(localId: string): string | null {
        // Check the explicit mapping (set when we POST our own offer)
        const mapped = this.serverSwapIdMap.get(localId);
        if (mapped) return String(mapped);

        // Cloud-synced offers have IDs like "cloud_42" — the number IS the server ID
        if (localId.startsWith('cloud_')) {
            return localId.replace('cloud_', '');
        }

        return null;
    }

    // --- Offline Queuing for Action Endpoints ---
    private async saveToOfflineQueue(action: { type: string, url: string, method: string, body?: any }): Promise<void> {
        try {
            const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
            const existing = await AsyncStorage.getItem('@meshbridge_offline_queue');
            const queue = existing ? JSON.parse(existing) : [];
            queue.push({ ...action, id: Date.now().toString() });
            await AsyncStorage.setItem('@meshbridge_offline_queue', JSON.stringify(queue));
        } catch (e) {
            console.error('[CloudSync] Failed to save to offline queue', e);
        }
    }

    private async flushOfflineQueue(): Promise<void> {
        try {
            const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
            const existing = await AsyncStorage.getItem('@meshbridge_offline_queue');
            if (!existing) return;
            
            const queue = JSON.parse(existing);
            if (queue.length === 0) return;

            console.log(`[CloudSync] Flushing ${queue.length} items from offline queue...`);
            const stillFailing = [];

            for (const item of queue) {
                try {
                    const response = await fetchWithTimeout(item.url, {
                        method: item.method,
                        headers: { 'Content-Type': 'application/json' },
                        body: item.body ? JSON.stringify(item.body) : undefined,
                        timeout: 10000,
                    });
                    if (!response.ok && response.status >= 500) {
                        stillFailing.push(item); // Only retry on server/network errors, not 400s
                    }
                } catch {
                    stillFailing.push(item);
                }
            }

            await AsyncStorage.setItem('@meshbridge_offline_queue', JSON.stringify(stillFailing));
        } catch (e) {
             console.error('[CloudSync] Failed to flush offline queue', e);
        }
    }

    /**
     * Broadcast acceptance of a swap via the cloud API.
     *
     * swapId:        the OTHER person's local swap ID (may be a cloud_ wrapper)
     * matchedSwapId: OUR local swap ID (created on this device)
     *
     * We resolve both to server IDs so the backend can create a proper
     * SwapSession with all participants, instead of a 1-sided session.
     */
    broadcastSwapAccept(swapId: string, matchedSwapId: string): void {
        // Resolve the primary swap (path param) on the server — this is the other person's offer
        const primaryServerId = this.resolveServerId(swapId);
        if (!primaryServerId) {
            return;
        }

        // Resolve our own counterpart swap on the server, if known
        const counterpartServerId = this.resolveServerId(matchedSwapId);
        const body: { matchedSwapId?: string } = {};
        if (counterpartServerId) {
            body.matchedSwapId = counterpartServerId;
        }

        const url = `${SYNC_SERVER_URL}/api/swaps/${primaryServerId}/accept`;

        fetchWithTimeout(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000, // Render cold start
            body: JSON.stringify(body),
        }).catch(() => {
            // Offline/Fail: Queue for later
            console.warn(`[CloudSync] acceptMatch offline. Queuing: ${url}`);
            this.saveToOfflineQueue({ type: 'ACCEPT_SWAP', url, method: 'POST', body });
        });
    }

    broadcastSwapCancel(swapId: string): void {
        const serverId = this.resolveServerId(swapId);
        if (serverId) {
            const url = `${SYNC_SERVER_URL}/api/swaps/${serverId}/cancel`;
            fetchWithTimeout(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                timeout: 30000, // Render cold start
            }).catch(() => {
                // Offline/Fail: Queue for later
                console.warn(`[CloudSync] cancelSwap offline. Queuing: ${url}`);
                this.saveToOfflineQueue({ type: 'CANCEL_SWAP', url, method: 'POST' });
            });
        }
    }

    broadcastSessionComplete(sessionId: string): void {
        const url = `${SYNC_SERVER_URL}/api/sessions/${sessionId}/complete`;
        fetchWithTimeout(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000, 
        }).catch(() => {
            console.warn(`[CloudSync] sessionComplete offline. Queuing: ${url}`);
            this.saveToOfflineQueue({ type: 'COMPLETE_SESSION', url, method: 'POST' });
        });
    }

    broadcastSessionFail(sessionId: string): void {
        const url = `${SYNC_SERVER_URL}/api/sessions/${sessionId}/fail`;
        fetchWithTimeout(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            timeout: 30000, 
        }).catch(() => {
            console.warn(`[CloudSync] sessionFail offline. Queuing: ${url}`);
            this.saveToOfflineQueue({ type: 'FAIL_SESSION', url, method: 'POST' });
        });
    }

    onSwapReceived(callback: SwapReceivedCallback): void {
        this.swapCallbacks.push(callback);
    }

    onPeerCountChanged(callback: PeerCountCallback): void {
        this.peerCallbacks.push(callback);
    }

    getPeerCount(): number { return this.peerCount; }
    getConnectedPeers(): MeshPeer[] { return []; }
    isActive(): boolean { return this.active; }

    stop(): void {
        this.active = false;
        if (this.pollTimer) {
            clearTimeout(this.pollTimer);
            this.pollTimer = null;
        }
        this.peerCount = 0;
        this.swapCallbacks = [];
        this.peerCallbacks = [];
        this.serverSwapIdMap.clear();
    }
}

/**
 * Hybrid bridge — runs BOTH P2P and cloud sync simultaneously.
 * 
 * P2P handles nearby passengers (no internet needed).
 * Cloud handles passengers who aren't physically close yet.
 * Both feed into the same swap store — no duplicates because
 * mergeRemoteSwaps() deduplicates by swap ID prefix (p2p_ vs cloud_).
 */

export class HybridMeshBridge implements IMeshBridge {
    private nearbyBridge: NearbyMeshBridge;
    private cloudBridge: CloudSyncBridge;
    private swapCallbacks: SwapReceivedCallback[] = [];
    private peerCallbacks: PeerCountCallback[] = [];
    private nearbyPeerCount = 0;
    private cloudPeerCount = 0;
    private netInfoUnsubscribe: NetInfoSubscription | null = null;
    private isInternetReachable: boolean | null = null;

    constructor() {
        this.nearbyBridge = new NearbyMeshBridge();
        this.cloudBridge = new CloudSyncBridge();

        // Forward swap events from both bridges
        this.nearbyBridge.onSwapReceived((swaps) => {
            this.swapCallbacks.forEach(cb => cb(swaps));
        });
        this.cloudBridge.onSwapReceived((swaps) => {
            this.swapCallbacks.forEach(cb => cb(swaps));
        });

        // Combine peer counts from both channels
        this.nearbyBridge.onPeerCountChanged((count) => {
            this.nearbyPeerCount = count;
            this.peerCallbacks.forEach(cb => cb(this.nearbyPeerCount + this.cloudPeerCount));
        });
        this.cloudBridge.onPeerCountChanged((count) => {
            this.cloudPeerCount = count;
            this.peerCallbacks.forEach(cb => cb(this.nearbyPeerCount + this.cloudPeerCount));
        });

        // Monitor Network changes
        this.setupNetworkMonitoring();
    }

    private setupNetworkMonitoring() {
        this.netInfoUnsubscribe = NetInfo.addEventListener(state => {
            console.log(`[HybridMeshBridge] Network state changed. Connected: ${state.isConnected}, Internet Reachable: ${state.isInternetReachable}`);
            
            // Check if we just transitioned from no internet to internet
            if (this.isInternetReachable === false && state.isInternetReachable === true) {
                console.log('[HybridMeshBridge] Internet connection restored! Triggering immediate sync.');
                // Force CloudBridge to fetch
                if (this.cloudBridge.isActive()) {
                    this.cloudBridge.forcePoll();
                }
                
                // When WiFi state changes, Nearby Connections over WiFi Direct can sometimes drop or stagger.
                // We'll log the peering state to see if restarting them is needed.
                console.log(`[HybridMeshBridge] Current P2P peer count: ${this.nearbyBridge.getPeerCount()}`);
            }
            
            // Update previous state
            if (state.isInternetReachable !== null) {
                this.isInternetReachable = state.isInternetReachable;
            }
        });
    }

    async startAdvertising(trainNo: string, journeyDate: string): Promise<void> {
        // Start both simultaneously
        await Promise.allSettled([
            this.nearbyBridge.startAdvertising(trainNo, journeyDate),
            this.cloudBridge.startAdvertising(trainNo, journeyDate),
        ]);
    }

    async startDiscovery(trainNo: string, journeyDate: string): Promise<void> {
        await Promise.allSettled([
            this.nearbyBridge.startDiscovery(trainNo, journeyDate),
            this.cloudBridge.startDiscovery(trainNo, journeyDate),
        ]);
    }

    broadcastSwapOffer(swap: LocalSwap): void {
        console.log(`[HybridMeshBridge] Broadcasting offer ${swap.id} to both channels.`);
        // Broadcast through both channels
        this.nearbyBridge.broadcastSwapOffer(swap);
        this.cloudBridge.broadcastSwapOffer(swap);
    }

    broadcastSwapAccept(swapId: string, matchedSwapId: string): void {
        console.log(`[HybridMeshBridge] Broadcasting ACCEPT for ${swapId} matched with ${matchedSwapId}.`);
        this.nearbyBridge.broadcastSwapAccept(swapId, matchedSwapId);
        this.cloudBridge.broadcastSwapAccept(swapId, matchedSwapId);
    }

    broadcastSwapCancel(swapId: string): void {
        console.log(`[HybridMeshBridge] Broadcasting CANCEL for ${swapId}.`);
        this.nearbyBridge.broadcastSwapCancel(swapId);
        this.cloudBridge.broadcastSwapCancel(swapId);
    }

    broadcastSessionComplete(sessionId: string): void {
        console.log(`[HybridMeshBridge] Broadcasting SESSION_COMPLETE for ${sessionId}.`);
        if (this.nearbyBridge.broadcastSessionComplete) this.nearbyBridge.broadcastSessionComplete(sessionId);
        this.cloudBridge.broadcastSessionComplete(sessionId);
    }

    broadcastSessionFail(sessionId: string): void {
        console.log(`[HybridMeshBridge] Broadcasting SESSION_FAIL for ${sessionId}.`);
        if (this.nearbyBridge.broadcastSessionFail) this.nearbyBridge.broadcastSessionFail(sessionId);
        this.cloudBridge.broadcastSessionFail(sessionId);
    }

    onSwapReceived(callback: SwapReceivedCallback): void {
        this.swapCallbacks.push(callback);
    }

    onPeerCountChanged(callback: PeerCountCallback): void {
        this.peerCallbacks.push(callback);
    }

    getPeerCount(): number {
        return this.nearbyPeerCount + this.cloudPeerCount;
    }

    getConnectedPeers(): MeshPeer[] {
        return [
            ...this.nearbyBridge.getConnectedPeers(),
            ...this.cloudBridge.getConnectedPeers(),
        ];
    }

    isActive(): boolean {
        return this.nearbyBridge.isActive() || this.cloudBridge.isActive();
    }

    stop(): void {
        this.nearbyBridge.stop();
        this.cloudBridge.stop();
        this.swapCallbacks = [];
        this.peerCallbacks = [];
        this.nearbyPeerCount = 0;
        this.cloudPeerCount = 0;
        
        if (this.netInfoUnsubscribe) {
            this.netInfoUnsubscribe();
            this.netInfoUnsubscribe = null;
        }
        console.log('[HybridMeshBridge] All mesh bridging stopped and listeners removed.');
    }

    async forcePoll(): Promise<void> {
        await this.cloudBridge.forcePoll();
    }
}

/**
 * Factory function — returns the appropriate bridge implementation.
 * 
 * Default: HybridMeshBridge (P2P + Cloud running together).
 * For cloud-only: return new CloudSyncBridge().
 * For dev testing: return new MockMeshBridge().
 */
export function createMeshBridge(): IMeshBridge {
    // PRODUCTION: hybrid — P2P for nearby, cloud for remote
    return new HybridMeshBridge();

    // CLOUD ONLY: uncomment if P2P causes issues
    // return new CloudSyncBridge();

    // DEV TESTING: uncomment to simulate fake peers
    // return new MockMeshBridge();
}
