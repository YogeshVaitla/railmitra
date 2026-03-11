/**
 * Client-Side Telemetry — Mesh & App Observability
 * 
 * Collects P2P mesh health metrics on-device and periodically reports
 * them to the backend's /api/telemetry/mesh endpoint. Also tracks local
 * diagnostics like swap engine runs, connection state changes, and errors.
 * 
 * Usage:
 *   import { meshTelemetry } from './telemetry';
 *   meshTelemetry.recordPeerDiscovery(true);
 *   meshTelemetry.recordMessageSent();
 *   meshTelemetry.startReporting('12345', 'nearby');
 */

import { getOrCreateDeviceId } from './swapStore';

const TELEMETRY_ENDPOINT = 'https://railmitra-api.onrender.com/api/telemetry/mesh';
const REPORT_INTERVAL_MS = 60_000; // Report every 60 seconds

interface MeshMetricsBuffer {
    discoveryAttempts: number;
    discoverySuccesses: number;
    messagesSent: number;
    messagesReceived: number;
    deliveryLatencies: number[];
    peerCount: number;
    connectionDrops: number;
    errors: string[];
}

function createEmptyBuffer(): MeshMetricsBuffer {
    return {
        discoveryAttempts: 0,
        discoverySuccesses: 0,
        messagesSent: 0,
        messagesReceived: 0,
        deliveryLatencies: [],
        peerCount: 0,
        connectionDrops: 0,
        errors: [],
    };
}

class MeshTelemetry {
    private buffer: MeshMetricsBuffer = createEmptyBuffer();
    private reportTimer: ReturnType<typeof setInterval> | null = null;
    private trainNo: string = '';
    private bridgeType: 'nearby' | 'cloud' | 'hybrid' = 'hybrid';
    private reporting = false;

    /**
     * Start periodic telemetry reporting.
     * Call this when the mesh bridge starts up.
     */
    startReporting(trainNo: string, bridgeType: 'nearby' | 'cloud' | 'hybrid' = 'hybrid'): void {
        this.trainNo = trainNo;
        this.bridgeType = bridgeType;
        this.reporting = true;

        // Don't double-start
        if (this.reportTimer) return;

        this.reportTimer = setInterval(() => {
            this.flush();
        }, REPORT_INTERVAL_MS);

        console.log(`[Telemetry] Started reporting for train ${trainNo} (${bridgeType})`);
    }

    /**
     * Stop reporting and flush any remaining data.
     */
    stopReporting(): void {
        this.reporting = false;
        if (this.reportTimer) {
            clearInterval(this.reportTimer);
            this.reportTimer = null;
        }
        // One final flush
        this.flush();
    }

    // --- Recording methods ---

    recordPeerDiscovery(success: boolean): void {
        this.buffer.discoveryAttempts++;
        if (success) this.buffer.discoverySuccesses++;
    }

    recordMessageSent(): void {
        this.buffer.messagesSent++;
    }

    recordMessageReceived(deliveryLatencyMs?: number): void {
        this.buffer.messagesReceived++;
        if (deliveryLatencyMs !== undefined) {
            this.buffer.deliveryLatencies.push(deliveryLatencyMs);
        }
    }

    recordPeerCount(count: number): void {
        this.buffer.peerCount = count;
    }

    recordConnectionDrop(): void {
        this.buffer.connectionDrops++;
    }

    recordError(error: string): void {
        // Keep only the last 10 errors to avoid memory bloat
        this.buffer.errors.push(error);
        if (this.buffer.errors.length > 10) {
            this.buffer.errors = this.buffer.errors.slice(-10);
        }
    }

    // --- Flush to server ---

    private async flush(): Promise<void> {
        if (!this.reporting || !this.trainNo) return;

        // Skip if there's nothing meaningful to report
        const b = this.buffer;
        if (b.discoveryAttempts === 0 && b.messagesSent === 0 && b.messagesReceived === 0 && b.connectionDrops === 0) {
            return;
        }

        // Calculate average delivery latency
        const avgLatency = b.deliveryLatencies.length > 0
            ? b.deliveryLatencies.reduce((s, x) => s + x, 0) / b.deliveryLatencies.length
            : undefined;

        try {
            const deviceId = await getOrCreateDeviceId();

            const report = {
                deviceId: deviceId.substring(0, 8), // Truncate for privacy
                trainNo: this.trainNo,
                peerCount: b.peerCount,
                discoveryAttempts: b.discoveryAttempts,
                discoverySuccesses: b.discoverySuccesses,
                messagesSent: b.messagesSent,
                messagesReceived: b.messagesReceived,
                messageDeliveryLatencyMs: avgLatency,
                connectionDrops: b.connectionDrops,
                bridgeType: this.bridgeType,
            };

            const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
            const timeoutId = setTimeout(() => controller?.abort(), 10000);

            await fetch(TELEMETRY_ENDPOINT, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(report),
                signal: controller?.signal,
            });

            clearTimeout(timeoutId);

            console.log('[Telemetry] Metrics flushed:', {
                peers: b.peerCount,
                sent: b.messagesSent,
                received: b.messagesReceived,
                discoveryRate: b.discoveryAttempts > 0
                    ? `${((b.discoverySuccesses / b.discoveryAttempts) * 100).toFixed(0)}%`
                    : 'N/A',
            });
        } catch {
            // Telemetry failure is never critical — silently skip
            console.log('[Telemetry] Flush failed (server unreachable), will retry next cycle');
        }

        // Reset buffer for next reporting window
        this.buffer = createEmptyBuffer();
    }

    /**
     * Get a diagnostic snapshot (useful for debug screens).
     */
    getSnapshot(): MeshMetricsBuffer & { trainNo: string; bridgeType: string } {
        return {
            ...this.buffer,
            trainNo: this.trainNo,
            bridgeType: this.bridgeType,
        };
    }
}

// Singleton export — one telemetry instance per app
export const meshTelemetry = new MeshTelemetry();
