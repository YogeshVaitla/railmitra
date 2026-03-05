/**
 * Nearby Mesh Bridge — P2P via Android Nearby Connections
 * 
 * Uses the native NearbyModule to advertise/discover/exchange swap offers
 * with nearby devices. Works without internet using Bluetooth + WiFi Direct.
 * 
 * Service ID format: "railmitra_{trainNo}_{journeyDate}"
 * This ensures only passengers on the same train discover each other.
 */

import { NativeEventEmitter, NativeModules, PermissionsAndroid, Platform } from 'react-native';
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

        const serviceId = `railmitra_${trainNo}_${journeyDate}`;
        const deviceName = this.deviceId.substring(0, 8); // Short device identifier

        try {
            await NearbyConnections.startAdvertising(deviceName, serviceId);
            console.log('[NearbyP2P] Advertising started for', serviceId);
        } catch (error: any) {
            console.warn('[NearbyP2P] Advertising failed:', error.message);
        }
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

        const serviceId = `railmitra_${trainNo}_${journeyDate}`;

        try {
            await NearbyConnections.startDiscovery(serviceId);
            console.log('[NearbyP2P] Discovery started for', serviceId);
        } catch (error: any) {
            console.warn('[NearbyP2P] Discovery failed:', error.message);
        }
    }

    private setupEventListeners(): void {
        if (!NearbyConnections) return;
        if (this.eventEmitter) return; // Already set up

        this.eventEmitter = new NativeEventEmitter(NearbyConnections);

        // Peer found
        this.subscriptions.push(
            this.eventEmitter.addListener('onEndpointFound', (event) => {
                console.log('[NearbyP2P] Peer found:', event.endpointId);
                this.connectedPeers.set(event.endpointId, {
                    id: event.endpointId,
                    lastSeen: Date.now(),
                });
                // Immediately update UI with new peer count
                this.peerCount = this.connectedPeers.size;
                this.peerCallbacks.forEach(cb => cb(this.peerCount));
            })
        );

        // Peer lost
        this.subscriptions.push(
            this.eventEmitter.addListener('onEndpointLost', (event) => {
                console.log('[NearbyP2P] Peer lost:', event.endpointId);
                this.connectedPeers.delete(event.endpointId);
                // Immediately update UI with new peer count
                this.peerCount = this.connectedPeers.size;
                this.peerCallbacks.forEach(cb => cb(this.peerCount));
            })
        );

        // Peer count update
        this.subscriptions.push(
            this.eventEmitter.addListener('onPeerCountChanged', (event) => {
                this.peerCount = event.count;
                this.peerCallbacks.forEach(cb => cb(this.peerCount));
            })
        );

        // Incoming swap data
        this.subscriptions.push(
            this.eventEmitter.addListener('onPayloadReceived', async (event) => {
                try {
                    const data = JSON.parse(event.data);

                    if (data.type === 'SWAP_OFFERS' && Array.isArray(data.offers)) {
                        const remoteSwaps: LocalSwap[] = data.offers
                            .filter((o: any) => o.deviceId !== this.deviceId)
                            .map((o: any) => ({
                                ...o,
                                id: `p2p_${o.id}`,
                                isLocal: false,
                            }));

                        if (remoteSwaps.length > 0) {
                            const { added } = await mergeRemoteSwaps(remoteSwaps);
                            if (added > 0) {
                                this.swapCallbacks.forEach(cb => cb(remoteSwaps));
                            }
                        }
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
                s.isLocal && s.status === 'OPEN'
            );

            if (myOffers.length > 0) {
                const payload = JSON.stringify({
                    type: 'SWAP_OFFERS',
                    offers: myOffers,
                });
                await NearbyConnections.sendPayload(payload);
            }
        } catch (error) {
            console.warn('[NearbyP2P] Failed to broadcast offers:', error);
        }
    }

    broadcastSwapOffer(swap: LocalSwap): void {
        if (!NearbyConnections || !this.active) return;

        const payload = JSON.stringify({
            type: 'SWAP_OFFERS',
            offers: [swap],
        });

        NearbyConnections.sendPayload(payload).catch((err: any) => {
            console.log('[NearbyP2P] Send failed (no peers connected yet):', err.message);
        });
    }

    broadcastSwapAccept(swapId: string, matchedSwapId: string): void {
        if (!NearbyConnections || !this.active) return;

        const payload = JSON.stringify({
            type: 'SWAP_ACCEPT',
            swapId,
            matchedSwapId,
        });

        NearbyConnections.sendPayload(payload).catch(() => { });
    }

    broadcastSwapCancel(swapId: string): void {
        if (!NearbyConnections || !this.active) return;

        const payload = JSON.stringify({
            type: 'SWAP_CANCEL',
            swapId,
        });

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

    stop(): void {
        this.active = false;
        this.peerCount = 0;
        this.connectedPeers.clear();

        // Clean up event listeners
        this.subscriptions.forEach(sub => sub.remove());
        this.subscriptions = [];
        this.eventEmitter = null;
        this.swapCallbacks = [];
        this.peerCallbacks = [];

        if (NearbyConnections) {
            NearbyConnections.stopAll().catch(() => { });
        }
    }
}
