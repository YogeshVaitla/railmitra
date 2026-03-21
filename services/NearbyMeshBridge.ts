/**
 * Nearby Mesh Bridge — P2P via Android Nearby Connections
 * 
 * Uses the native NearbyModule to advertise/discover/exchange swap offers
 * with nearby devices. Works without internet using Bluetooth + WiFi Direct.
 * 
 * Service ID format: "railmitra_{trainNo}_{journeyDate}"
 * This ensures only passengers on the same train discover each other.
 * 
 * RM-SW-020: Exponential backoff retry + AppState-aware reconnection
 * RM-SW-021: Robust SWAP_ACCEPT broadcast and receive handling
 * RM-SW-022: Gossip relay with TTL and LRU dedup for train-wide coverage
 */

import { AppState, AppStateStatus, NativeEventEmitter, NativeModules, PermissionsAndroid, Platform } from 'react-native';
import {
    IMeshBridge,
    MeshPeer,
    PeerCountCallback,
    SwapReceivedCallback,
} from './meshBridge';
import {
    getOrCreateDeviceId,
    LocalSwap,
    mergeRemoteSwaps,
} from './swapStore';

// Grab the native module (will be null on iOS or if not installed)
const NearbyConnections = Platform.OS === 'android'
    ? NativeModules.NearbyConnections
    : null;

// RM-SW-020: Retry delays for exponential backoff (in ms)
const RETRY_DELAYS = [5000, 10000, 30000];

// RM-SW-022: Max number of seen message hashes to keep (LRU-style)
const GOSSIP_CACHE_SIZE = 100;

export class NearbyMeshBridge implements IMeshBridge {
    private active = false;
    private trainNo = '';
    private journeyDate = '';
    private deviceId = '';
    private swapCallbacks: SwapReceivedCallback[] = [];
    private peerCallbacks: PeerCountCallback[] = [];
    private peerCount = 0;
    private connectedPeers: Map<string, MeshPeer> = new Map();
    private eventEmitter: NativeEventEmitter | null = null;
    private subscriptions: any[] = [];

    // RM-SW-020: Retry state
    private advertiseRetryCount = 0;
    private discoveryRetryCount = 0;
    private advertiseRetryTimer: ReturnType<typeof setTimeout> | null = null;
    private discoveryRetryTimer: ReturnType<typeof setTimeout> | null = null;

    // RM-SW-020: AppState tracking
    private appStateSubscription: any = null;
    private lastBackgroundedAt: number | null = null;

    // RM-SW-022: Gossip relay LRU cache — stores hashes of seen messages
    private seenMessageHashes: string[] = [];
    private peerGcTimer: ReturnType<typeof setInterval> | null = null;

    /**
     * Check if the native module is actually available
     */
    static isAvailable(): boolean {
        return Platform.OS === 'android' && NearbyConnections != null;
    }

    /**
     * Request all required Android runtime permissions for Nearby Connections.
     */
    private async requestPermissions(): Promise<boolean> {
        if (Platform.OS !== 'android') return true;

        try {
            const permissionsToRequest = [
                PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
                // Android 12+ (API 31+) required permissions
                'android.permission.BLUETOOTH_SCAN',
                'android.permission.BLUETOOTH_ADVERTISE',
                'android.permission.BLUETOOTH_CONNECT',
                // Android 13+ (API 33+) required permissions
                'android.permission.NEARBY_WIFI_DEVICES',
            ];

            const granted = await PermissionsAndroid.requestMultiple(permissionsToRequest as any[]);

            // Just log the results, Location is the absolute strict one, others depend on Android version
            console.log('[NearbyP2P] Permission results:', granted);

            // If location is denied, Nearby Connections fundamentally won't work on most devices
            if (granted[PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION] === PermissionsAndroid.RESULTS.DENIED) {
                console.warn('[NearbyP2P] Location permission denied, P2P will likely fail.');
                return false;
            }

            return true;
        } catch (err) {
            console.warn('[NearbyP2P] Error requesting permissions:', err);
            return false;
        }
    }

    // RM-SW-020: AppState listener — tear down and re-init if backgrounded > 5 minutes
    private setupAppStateListener(): void {
        if (this.appStateSubscription) return;

        this.appStateSubscription = AppState.addEventListener('change', (nextState: AppStateStatus) => {
            if (nextState === 'background' || nextState === 'inactive') {
                this.lastBackgroundedAt = Date.now();
                console.log('[NearbyP2P] App backgrounded, tracking time.');
            } else if (nextState === 'active' && this.lastBackgroundedAt) {
                const backgroundDuration = Date.now() - this.lastBackgroundedAt;
                const fiveMinutes = 5 * 60 * 1000;

                if (backgroundDuration > fiveMinutes && this.active) {
                    console.log(`[NearbyP2P] App was backgrounded for ${Math.round(backgroundDuration / 1000)}s — re-initializing P2P bridge.`);
                    this.teardownAndReconnect();
                }
                this.lastBackgroundedAt = null;
            }
        });
    }

    // RM-SW-020: Full teardown and re-initialization
    private async teardownAndReconnect(): Promise<void> {
        const savedTrainNo = this.trainNo;
        const savedJourneyDate = this.journeyDate;

        // Tear down current connections
        this.stopInternal(false); // Don't remove AppState listener

        // Small breath before reconnecting
        await new Promise(r => setTimeout(r, 1000));

        // Re-initialize both advertising and discovery
        await this.startAdvertising(savedTrainNo, savedJourneyDate);
        await this.startDiscovery(savedTrainNo, savedJourneyDate);
    }

    async startAdvertising(trainNo: string, journeyDate: string): Promise<void> {
        if (!NearbyMeshBridge.isAvailable()) {
            console.log('[NearbyP2P] Native module not available, skipping');
            return;
        }

        const hasPermissions = await this.requestPermissions();
        if (!hasPermissions) return;

        this.trainNo = trainNo;
        this.journeyDate = journeyDate;
        this.deviceId = await getOrCreateDeviceId();
        this.active = true;

        this.setupEventListeners();
        this.setupAppStateListener();

        const serviceId = `railmitra_${trainNo}_${journeyDate}`;
        const deviceName = this.deviceId.substring(0, 8); // Short device identifier

        try {
            await NearbyConnections.startAdvertising(deviceName, serviceId);
            console.log('[NearbyP2P] Advertising started for', serviceId);
            this.advertiseRetryCount = 0; // Reset on success
        } catch (error: any) {
            console.warn('[NearbyP2P] Advertising failed:', error.message);
            this.retryAdvertising(trainNo, journeyDate);
        }
    }

    // RM-SW-020: Exponential backoff retry for advertising
    private retryAdvertising(trainNo: string, journeyDate: string): void {
        if (this.advertiseRetryCount >= RETRY_DELAYS.length) {
            console.warn('[NearbyP2P] Advertising retry limit reached. Giving up.');
            return;
        }

        const delay = RETRY_DELAYS[this.advertiseRetryCount];
        console.log(`[NearbyP2P] Retrying advertising in ${delay / 1000}s (attempt ${this.advertiseRetryCount + 1}/${RETRY_DELAYS.length})`);

        this.advertiseRetryTimer = setTimeout(async () => {
            this.advertiseRetryCount++;
            try {
                const serviceId = `railmitra_${trainNo}_${journeyDate}`;
                const deviceName = this.deviceId.substring(0, 8);
                await NearbyConnections.startAdvertising(deviceName, serviceId);
                console.log('[NearbyP2P] Advertising started (retry succeeded)');
                this.advertiseRetryCount = 0;
            } catch (err: any) {
                console.warn('[NearbyP2P] Advertising retry failed:', err.message);
                this.retryAdvertising(trainNo, journeyDate);
            }
        }, delay);
    }

    async startDiscovery(trainNo: string, journeyDate: string): Promise<void> {
        if (!NearbyMeshBridge.isAvailable()) {
            console.log('[NearbyP2P] Native module not available, skipping');
            return;
        }

        const hasPermissions = await this.requestPermissions();
        if (!hasPermissions) return;

        this.trainNo = trainNo;
        this.journeyDate = journeyDate;
        this.deviceId = await getOrCreateDeviceId();
        this.active = true;

        this.setupEventListeners();
        this.setupAppStateListener();

        const serviceId = `railmitra_${trainNo}_${journeyDate}`;

        try {
            await NearbyConnections.startDiscovery(serviceId);
            console.log('[NearbyP2P] Discovery started for', serviceId);
            this.discoveryRetryCount = 0; // Reset on success
        } catch (error: any) {
            console.warn('[NearbyP2P] Discovery failed:', error.message);
            this.retryDiscovery(trainNo, journeyDate);
        }
    }

    // RM-SW-020: Exponential backoff retry for discovery
    private retryDiscovery(trainNo: string, journeyDate: string): void {
        if (this.discoveryRetryCount >= RETRY_DELAYS.length) {
            console.warn('[NearbyP2P] Discovery retry limit reached. Giving up.');
            return;
        }

        const delay = RETRY_DELAYS[this.discoveryRetryCount];
        console.log(`[NearbyP2P] Retrying discovery in ${delay / 1000}s (attempt ${this.discoveryRetryCount + 1}/${RETRY_DELAYS.length})`);

        this.discoveryRetryTimer = setTimeout(async () => {
            this.discoveryRetryCount++;
            try {
                const serviceId = `railmitra_${trainNo}_${journeyDate}`;
                await NearbyConnections.startDiscovery(serviceId);
                console.log('[NearbyP2P] Discovery started (retry succeeded)');
                this.discoveryRetryCount = 0;
            } catch (err: any) {
                console.warn('[NearbyP2P] Discovery retry failed:', err.message);
                this.retryDiscovery(trainNo, journeyDate);
            }
        }, delay);
    }

    private setupEventListeners(): void {
        if (!NearbyConnections) return;
        if (this.eventEmitter) return; // Already set up

        this.eventEmitter = new NativeEventEmitter(NearbyConnections);

        if (!this.peerGcTimer) {
            this.peerGcTimer = setInterval(() => {
                this.recalculatePeerCount();
            }, 10000);
        }

        // Peer found — RM-SW-020: deduplicate by endpointName (deviceId)
        this.subscriptions.push(
            this.eventEmitter.addListener('onEndpointFound', (event) => {
                console.log('[NearbyP2P] Peer found:', event.endpointId, 'Name:', event.endpointName);

                // RM-SW-020: Check for duplicate peers by endpointName before adding
                const existingByName = Array.from(this.connectedPeers.values()).find(
                    p => p.name === event.endpointName && p.id !== event.endpointId
                );
                if (existingByName) {
                    console.log('[NearbyP2P] Duplicate peer detected (same name, different endpoint). Removing stale entry:', existingByName.id);
                    this.connectedPeers.delete(existingByName.id);
                }

                this.connectedPeers.set(event.endpointId, {
                    id: event.endpointId,
                    name: event.endpointName,
                    lastSeen: Date.now(),
                });

                this.recalculatePeerCount();
            })
        );

        // Peer lost
        this.subscriptions.push(
            this.eventEmitter.addListener('onEndpointLost', (event) => {
                console.log('[NearbyP2P] Peer lost:', event.endpointId);
                this.connectedPeers.delete(event.endpointId);
                this.recalculatePeerCount();
            })
        );

        // Peer count update
        this.subscriptions.push(
            this.eventEmitter.addListener('onPeerCountChanged', (event) => {
                // If native module explicitly sends a count, we can use it, but our manual calculation is often better
                // for deduping device IDs. We'll only use this if our map is somehow empty.
                if (this.peerCount === 0 && event.count > 0) {
                    this.peerCount = event.count;
                    this.peerCallbacks.forEach(cb => cb(this.peerCount));
                }
            })
        );

        // Incoming swap data — RM-SW-021 + RM-SW-022: handles gossip relay
        this.subscriptions.push(
            this.eventEmitter.addListener('onPayloadReceived', async (event) => {
                try {
                    // Update lastSeen for this peer to prevent GC
                    const peer = this.connectedPeers.get(event.endpointId);
                    if (peer) {
                        peer.lastSeen = Date.now();
                        this.connectedPeers.set(event.endpointId, peer);
                    }

                    const rawData = JSON.parse(event.data);

                    // RM-SW-022: Unwrap gossip envelope if present
                    let data = rawData;
                    let isGossip = false;
                    let originEndpointId = event.endpointId;

                    if (rawData.ttl !== undefined && rawData.senderId && rawData.payload) {
                        // This is a gossip-wrapped payload
                        isGossip = true;
                        const msgHash = `${rawData.senderId}_${rawData.timestamp}`;

                        // Check if we've already seen this message
                        if (this.seenMessageHashes.includes(msgHash)) {
                            return; // Already processed, skip
                        }

                        // Add to LRU cache
                        this.seenMessageHashes.push(msgHash);
                        if (this.seenMessageHashes.length > GOSSIP_CACHE_SIZE) {
                            this.seenMessageHashes.shift(); // Evict oldest
                        }

                        // RM-SW-022: Relay if TTL > 0
                        if (rawData.ttl > 0) {
                            this.relayGossip(rawData, originEndpointId);
                        }

                        data = rawData.payload;
                    }

                    if (data.type === 'SWAP_OFFERS' && Array.isArray(data.offers)) {
                        const remoteSwaps: LocalSwap[] = data.offers
                            .filter((o: any) => o.deviceId !== this.deviceId)
                            .map((o: any) => ({
                                ...o,
                                id: `p2p_${o.id}`, // Add prefix to namespace P2P swaps
                                isLocal: false,
                            }));

                        if (remoteSwaps.length > 0) {
                            const { added } = await mergeRemoteSwaps(remoteSwaps);
                            if (added > 0) {
                                this.swapCallbacks.forEach(cb => cb(remoteSwaps));
                            }
                        }
                    } else if (data.type === 'SWAP_ACCEPT') {
                        // RM-SW-021: The remote user accepted a swap.
                        // Convention:
                        // - data.swapId        = OUR swap ID as the sender sees it (raw UUID)
                        // - data.matchedSwapId = THEIR swap ID on the sender (raw UUID)
                        //
                        // Locally, we store remote/offline swaps with a p2p_ prefix,
                        // so translate both IDs into the form our swapStore uses.
                        const { acceptMatch } = require('./swapStore');

                        const myStoredId = data.swapId.startsWith('p2p_') ? data.swapId : `p2p_${data.swapId}`;
                        const theirStoredId = data.matchedSwapId.startsWith('p2p_')
                            ? data.matchedSwapId
                            : `p2p_${data.matchedSwapId}`;

                        console.log('[NearbyP2P] Received SWAP_ACCEPT:', myStoredId, 'WITH', theirStoredId);

                        const success = await acceptMatch(myStoredId, theirStoredId);
                        if (success) {
                            // Notify UI to refresh (empty array signifies general state update)
                            this.swapCallbacks.forEach(cb => cb([]));
                        } else {
                            // RM-SW-021: We were a 3rd party observer. Both swaps matched, so we should hide them
                            console.log(`[NearbyP2P] Handling 3rd party acceptance for swaps ${myStoredId} and ${theirStoredId}`);
                            const { updateSwapStatus } = require('./swapStore');
                            await updateSwapStatus(myStoredId, 'ACCEPTED');
                            await updateSwapStatus(theirStoredId, 'ACCEPTED');
                            this.swapCallbacks.forEach(cb => cb([]));
                        }
                    } else if (data.type === 'SWAP_CANCEL') {
                        // Remote user cancelled their swap offer
                        const { updateSwapStatus } = require('./swapStore');

                        // Their ID could be sent raw. We store it as `p2p_{raw}`
                        const theirStoredId = data.swapId.startsWith('p2p_') ? data.swapId : `p2p_${data.swapId}`;
                        console.log('[NearbyP2P] Received SWAP_CANCEL for:', theirStoredId);

                        // Update status locally to cancel it out so it disappears from Browse/Matches
                        await updateSwapStatus(theirStoredId, 'CANCELLED');

                        // Notify UI to refresh
                        this.swapCallbacks.forEach(cb => cb([]));
                    }
                } catch (error) {
                    console.warn('[NearbyP2P] Failed to parse payload:', error);
                }
            })
        );

        // Connection result
        this.subscriptions.push(
            this.eventEmitter.addListener('onConnectionResult', (event) => {
                if (event.status === 'CONNECTED') {
                    console.log('[NearbyP2P] Connected to peer:', event.endpointId);
                    // When a new peer connects, send our current swap offers
                    this.broadcastCurrentOffers();
                }
            })
        );
    }

    // RM-SW-020: Centralized peer count recalculation with dedup by name
    private recalculatePeerCount(): void {
        const now = Date.now();
        const PEER_TIMEOUT_MS = 20000; // 20 seconds — clear stale peers faster for more accurate counts

        // RM-SW-022: GC stale peers
        for (const [endpointId, peer] of this.connectedPeers.entries()) {
            if (now - peer.lastSeen > PEER_TIMEOUT_MS) {
                console.log(`[NearbyP2P] GCing stale peer ${endpointId} (${peer.name})`);
                this.connectedPeers.delete(endpointId);
            }
        }

        const uniqueNames = new Set(
            Array.from(this.connectedPeers.values()).map(p => p.name).filter(Boolean)
        );
        const newCount = uniqueNames.size;
        if (newCount !== this.peerCount) {
            this.peerCount = newCount;
            this.peerCallbacks.forEach(cb => cb(this.peerCount));
        }
    }

    // RM-SW-022: Gossip relay — re-broadcast unseen payloads with decremented TTL
    private relayGossip(envelope: any, originEndpointId: string): void {
        if (!NearbyConnections || !this.active) return;

        const relayEnvelope = {
            ...envelope,
            ttl: envelope.ttl - 1,
        };

        const payload = JSON.stringify(relayEnvelope);

        // Send to all connected peers EXCEPT the one that sent it to us
        for (const [endpointId] of this.connectedPeers) {
            if (endpointId !== originEndpointId) {
                NearbyConnections.sendPayloadToEndpoint(endpointId, payload).catch(() => { });
            }
        }
    }

    /**
     * RM-SW-022: Wrap a payload in a gossip envelope with TTL, senderId, and timestamp.
     */
    private wrapInGossipEnvelope(payload: any): string {
        return JSON.stringify({
            ttl: 3,
            senderId: this.deviceId,
            timestamp: Date.now(),
            payload,
        });
    }

    /**
     * Send all our current swap offers to newly connected peers
     */
    private async broadcastCurrentOffers(): Promise<void> {
        if (!NearbyConnections) return;

        // Small delay to let connection stabilize
        await new Promise(r => setTimeout(r, 500));

        try {
            // Import dynamically to avoid circular deps
            const { getSwapsForTrain } = require('./swapStore');
            const localSwaps = await getSwapsForTrain(this.trainNo, this.journeyDate);
            const myOffers = localSwaps.filter((s: LocalSwap) =>
                s.status === 'OPEN'
            );

            if (myOffers.length > 0) {
                const innerPayload = {
                    type: 'SWAP_OFFERS',
                    offers: myOffers,
                };
                // RM-SW-022: Wrap in gossip envelope for relay
                const payload = this.wrapInGossipEnvelope(innerPayload);
                await NearbyConnections.sendPayload(payload);
            }
        } catch (error) {
            console.warn('[NearbyP2P] Failed to broadcast offers:', error);
        }
    }

    broadcastSwapOffer(swap: LocalSwap): void {
        if (!NearbyConnections || !this.active) return;

        const innerPayload = {
            type: 'SWAP_OFFERS',
            offers: [swap],
        };
        // RM-SW-022: Wrap in gossip envelope
        const payload = this.wrapInGossipEnvelope(innerPayload);

        NearbyConnections.sendPayload(payload).catch((err: any) => {
            console.log('[NearbyP2P] Send failed (no peers connected yet):', err.message);
        });
    }

    // RM-SW-021: Broadcast swap acceptance with proper format
    broadcastSwapAccept(swapId: string, matchedSwapId: string): void {
        if (!NearbyConnections || !this.active) return;

        const innerPayload = {
            type: 'SWAP_ACCEPT',
            swapId,
            matchedSwapId,
        };
        // RM-SW-022: Wrap in gossip envelope
        const payload = this.wrapInGossipEnvelope(innerPayload);

        NearbyConnections.sendPayload(payload).catch(() => { });
    }


    broadcastSwapCancel(swapId: string): void {
        if (!NearbyConnections || !this.active) return;

        const innerPayload = {
            type: 'SWAP_CANCEL',
            swapId,
        };
        // RM-SW-022: Wrap in gossip envelope
        const payload = this.wrapInGossipEnvelope(innerPayload);

        NearbyConnections.sendPayload(payload).catch(() => { });
    }

    broadcastSessionComplete(sessionId: string): void {
        if (!NearbyConnections || !this.active) return;

        const innerPayload = {
            type: 'SESSION_COMPLETE',
            sessionId,
        };
        const payload = this.wrapInGossipEnvelope(innerPayload);
        NearbyConnections.sendPayload(payload).catch(() => { });
    }

    broadcastSessionFail(sessionId: string): void {
        if (!NearbyConnections || !this.active) return;

        const innerPayload = {
            type: 'SESSION_FAIL',
            sessionId,
        };
        const payload = this.wrapInGossipEnvelope(innerPayload);
        NearbyConnections.sendPayload(payload).catch(() => { });
    }

    onSwapReceived(callback: SwapReceivedCallback): void {
        this.swapCallbacks.push(callback);
    }

    onPeerCountChanged(callback: PeerCountCallback): void {
        this.peerCallbacks.push(callback);
    }

    getPeerCount(): number { return this.peerCount; }

    getConnectedPeers(): MeshPeer[] {
        return Array.from(this.connectedPeers.values());
    }

    isActive(): boolean { return this.active; }

    // Internal stop — optionally keeps the AppState listener alive during reconnect
    private stopInternal(removeAppStateListener: boolean): void {
        this.active = false;
        this.peerCount = 0;
        this.connectedPeers.clear();

        if (this.peerGcTimer) {
            clearInterval(this.peerGcTimer);
            this.peerGcTimer = null;
        }

        // Clear retry timers
        if (this.advertiseRetryTimer) clearTimeout(this.advertiseRetryTimer);
        if (this.discoveryRetryTimer) clearTimeout(this.discoveryRetryTimer);
        this.advertiseRetryTimer = null;
        this.discoveryRetryTimer = null;
        this.advertiseRetryCount = 0;
        this.discoveryRetryCount = 0;

        // Clean up event listeners
        this.subscriptions.forEach(sub => sub.remove());
        this.subscriptions = [];
        this.eventEmitter = null;
        this.swapCallbacks = [];
        this.peerCallbacks = [];

        if (removeAppStateListener && this.appStateSubscription) {
            this.appStateSubscription.remove();
            this.appStateSubscription = null;
        }

        if (NearbyConnections) {
            NearbyConnections.stopAll().catch(() => { });
        }
    }

    stop(): void {
        this.stopInternal(true);
    }
}
