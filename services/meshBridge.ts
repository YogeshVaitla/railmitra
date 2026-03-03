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
    onSwapReceived(callback: SwapReceivedCallback): void;
    onPeerCountChanged(callback: PeerCountCallback): void;
    getPeerCount(): number;
    getConnectedPeers(): MeshPeer[];
    isActive(): boolean;
    stop(): void;
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
// e.g. 'http://192.168.1.5:3001' for local network
const SYNC_SERVER_URL = 'https://railmitra-api.onrender.com';
const POLL_INTERVAL_MS = 15000; // Check for new offers every 15 seconds

export class CloudSyncBridge implements IMeshBridge {
    private active = false;
    private trainNo = '';
    private journeyDate = '';
    private deviceId = '';
    private swapCallbacks: SwapReceivedCallback[] = [];
    private peerCallbacks: PeerCountCallback[] = [];
    private peerCount = 0;
    private knownServerIds = new Set<number>();
    private serverSwapIdMap = new Map<string, number>(); // local swap id -> server swap id
    private pollTimer: ReturnType<typeof setInterval> | null = null;
    private serverReachable = false;

    async startAdvertising(trainNo: string, journeyDate: string): Promise<void> {
        this.trainNo = trainNo;
        this.journeyDate = journeyDate;
        this.active = true;
        this.deviceId = await getOrCreateDeviceId();
        this.startPolling();
    }

    async startDiscovery(trainNo: string, journeyDate: string): Promise<void> {
        this.trainNo = trainNo;
        this.journeyDate = journeyDate;
        this.active = true;
        this.deviceId = await getOrCreateDeviceId();
        this.startPolling();
    }

    private startPolling(): void {
        // Fetch immediately, then poll
        this.fetchOffersFromServer();

        this.pollTimer = setInterval(() => {
            if (!this.active) return;
            this.fetchOffersFromServer();
        }, POLL_INTERVAL_MS);
    }

    private async fetchOffersFromServer(): Promise<void> {
        try {
            const response = await fetch(
                `${SYNC_SERVER_URL}/api/swaps/${this.trainNo}/${this.journeyDate}/browse`,
                { signal: AbortSignal.timeout(5000) }
            );

            if (!response.ok) {
                this.serverReachable = false;
                return;
            }

            this.serverReachable = true;
            const data = await response.json();
            const serverOffers = data.offers || [];

            // Count unique users (excluding self) as "peers"
            const uniqueUsers = new Set<string>();
            const newSwaps: LocalSwap[] = [];

            for (const offer of serverOffers) {
                if (offer.userId === this.deviceId) continue; // Skip our own offers
                uniqueUsers.add(offer.userId);

                // Only process offers we haven't seen before
                if (!this.knownServerIds.has(offer.id)) {
                    this.knownServerIds.add(offer.id);

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
                        expiresAt: new Date(offer.expiresAt).getTime(),
                        createdAt: new Date(offer.createdAt).getTime(),
                        updatedAt: new Date(offer.updatedAt).getTime(),
                        isLocal: false,
                    };

                    newSwaps.push(localSwap);
                }
            }

            // Update peer count
            const newPeerCount = uniqueUsers.size;
            if (newPeerCount !== this.peerCount) {
                this.peerCount = newPeerCount;
                this.peerCallbacks.forEach(cb => cb(this.peerCount));
            }

            // Merge new offers into local store and notify
            if (newSwaps.length > 0) {
                const { added } = await mergeRemoteSwaps(newSwaps);
                if (added > 0) {
                    this.swapCallbacks.forEach(cb => cb(newSwaps));
                }
            }
        } catch (error) {
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
            const response = await fetch(`${SYNC_SERVER_URL}/api/swaps`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: AbortSignal.timeout(5000),
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
            }
        } catch {
            console.log('[CloudSync] Could not sync offer — will retry on next poll');
        }
    }

    broadcastSwapAccept(swapId: string, _matchedSwapId: string): void {
        const serverId = this.serverSwapIdMap.get(swapId);
        if (serverId) {
            fetch(`${SYNC_SERVER_URL}/api/swaps/${serverId}/accept`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: AbortSignal.timeout(5000),
            }).catch(() => { });
        }
    }

    broadcastSwapCancel(swapId: string): void {
        const serverId = this.serverSwapIdMap.get(swapId);
        if (serverId) {
            fetch(`${SYNC_SERVER_URL}/api/swaps/${serverId}/cancel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: AbortSignal.timeout(5000),
            }).catch(() => { });
        }
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
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
        this.peerCount = 0;
        this.swapCallbacks = [];
        this.peerCallbacks = [];
        this.knownServerIds.clear();
        this.serverSwapIdMap.clear();
    }
}

/**
 * Factory function — returns the appropriate bridge implementation.
 * 
 * For beta with cloud sync: returns CloudSyncBridge (polls server).
 * For dev testing: swap to MockMeshBridge to simulate fake peers.
 * For production (when native module is ready): use real NearbyConnectionsBridge.
 */
export function createMeshBridge(): IMeshBridge {
    // BETA: cloud sync for multi-user testing
    return new CloudSyncBridge();

    // DEV TESTING: uncomment to simulate fake peers and offers
    // return new MockMeshBridge();
}

