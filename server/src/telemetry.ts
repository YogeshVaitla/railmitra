/**
 * Telemetry & Observability Module
 * 
 * Structured logging, metrics collection, and health monitoring for
 * the RailMitra backend. Designed to work with any log aggregator
 * (Datadog, Grafana Loki, CloudWatch) via structured JSON output.
 * 
 * Key metrics tracked:
 * - Express request/response (latency, status codes, endpoint usage)
 * - SSE connection lifecycle (connects, drops, duration)
 * - P2P mesh relayed stats (peer counts, message throughput)
 * - Swap engine performance (match attempts, cycle discoveries)
 * - Database query latency via Prisma middleware
 */

// =============================================================================
//  Structured Logger
// =============================================================================

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
    timestamp: string;
    level: LogLevel;
    service: string;
    message: string;
    [key: string]: any;
}

const SERVICE_NAME = 'railmitra-api';

function createLogEntry(level: LogLevel, message: string, meta: Record<string, any> = {}): LogEntry {
    return {
        timestamp: new Date().toISOString(),
        level,
        service: SERVICE_NAME,
        message,
        ...meta,
    };
}

export const logger = {
    debug: (msg: string, meta?: Record<string, any>) =>
        console.log(JSON.stringify(createLogEntry('debug', msg, meta))),

    info: (msg: string, meta?: Record<string, any>) =>
        console.log(JSON.stringify(createLogEntry('info', msg, meta))),

    warn: (msg: string, meta?: Record<string, any>) =>
        console.warn(JSON.stringify(createLogEntry('warn', msg, meta))),

    error: (msg: string, meta?: Record<string, any>) =>
        console.error(JSON.stringify(createLogEntry('error', msg, meta))),
};

// =============================================================================
//  Metrics Collector (In-Memory, Exportable)
// =============================================================================

interface MetricPoint {
    name: string;
    value: number;
    tags: Record<string, string>;
    timestamp: number;
}

class MetricsCollector {
    private counters: Map<string, { value: number; tags: Record<string, string> }> = new Map();
    private gauges: Map<string, { value: number; tags: Record<string, string> }> = new Map();
    private histograms: Map<string, { values: number[]; tags: Record<string, string> }> = new Map();

    // --- Counters (monotonically increasing) ---
    increment(name: string, tags: Record<string, string> = {}, amount = 1): void {
        const key = this.keyFor(name, tags);
        const existing = this.counters.get(key);
        if (existing) {
            existing.value += amount;
        } else {
            this.counters.set(key, { value: amount, tags });
        }
    }

    // --- Gauges (point-in-time values) ---
    gauge(name: string, value: number, tags: Record<string, string> = {}): void {
        const key = this.keyFor(name, tags);
        this.gauges.set(key, { value, tags });
    }

    // --- Histograms (distribution tracking) ---
    histogram(name: string, value: number, tags: Record<string, string> = {}): void {
        const key = this.keyFor(name, tags);
        const existing = this.histograms.get(key);
        if (existing) {
            existing.values.push(value);
            // Keep only the last 1000 samples to prevent unbounded growth
            if (existing.values.length > 1000) {
                existing.values = existing.values.slice(-1000);
            }
        } else {
            this.histograms.set(key, { values: [value], tags });
        }
    }

    // --- Snapshot for /metrics endpoint ---
    snapshot(): {
        counters: Record<string, any>;
        gauges: Record<string, any>;
        histograms: Record<string, any>;
    } {
        const counters: Record<string, any> = {};
        this.counters.forEach((v, k) => { counters[k] = { value: v.value, tags: v.tags }; });

        const gauges: Record<string, any> = {};
        this.gauges.forEach((v, k) => { gauges[k] = { value: v.value, tags: v.tags }; });

        const histograms: Record<string, any> = {};
        this.histograms.forEach((v, k) => {
            const sorted = [...v.values].sort((a, b) => a - b);
            const len = sorted.length;
            histograms[k] = {
                count: len,
                min: sorted[0] || 0,
                max: sorted[len - 1] || 0,
                avg: len > 0 ? sorted.reduce((s, x) => s + x, 0) / len : 0,
                p50: sorted[Math.floor(len * 0.5)] || 0,
                p95: sorted[Math.floor(len * 0.95)] || 0,
                p99: sorted[Math.floor(len * 0.99)] || 0,
                tags: v.tags,
            };
        });

        return { counters, gauges, histograms };
    }

    private keyFor(name: string, tags: Record<string, string>): string {
        const tagStr = Object.entries(tags).sort().map(([k, v]) => `${k}:${v}`).join(',');
        return tagStr ? `${name}{${tagStr}}` : name;
    }
}

export const metrics = new MetricsCollector();

// =============================================================================
//  Express Middleware: Request Telemetry
// =============================================================================

import { Request, Response, NextFunction } from 'express';

/**
 * Express middleware that logs every request and tracks latency histograms.
 * Attach BEFORE your routes:
 *   app.use(requestTelemetry);
 */
export function requestTelemetry(req: Request, res: Response, next: NextFunction): void {
    const start = Date.now();

    // When the response finishes, record metrics
    res.on('finish', () => {
        const duration = Date.now() - start;
        const route = req.route?.path || req.path;
        const method = req.method;
        const status = String(res.statusCode);

        // Histogram: request latency
        metrics.histogram('http.request.duration_ms', duration, { method, route, status });

        // Counter: total requests
        metrics.increment('http.request.total', { method, route, status });

        // Log the request
        const logLevel: LogLevel = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
        logger[logLevel]('HTTP Request', {
            method,
            path: req.path,
            status: res.statusCode,
            duration_ms: duration,
            userAgent: req.get('User-Agent')?.substring(0, 80),
            ip: req.ip,
        });
    });

    next();
}

// =============================================================================
//  SSE Connection Tracking
// =============================================================================

interface SSEConnection {
    trainNo: string;
    journeyDate: string;
    connectedAt: number;
    clientIp?: string;
}

const activeSSEConnections: Map<string, SSEConnection> = new Map();
let sseConnectionIdCounter = 0;

/**
 * Call when a new SSE client connects.
 * Returns a connection ID for tracking.
 */
export function trackSSEConnect(trainNo: string, journeyDate: string, clientIp?: string): string {
    const connId = `sse_${++sseConnectionIdCounter}`;

    activeSSEConnections.set(connId, {
        trainNo,
        journeyDate,
        connectedAt: Date.now(),
        clientIp,
    });

    metrics.increment('sse.connections.total', { trainNo });
    metrics.gauge('sse.connections.active', activeSSEConnections.size);

    logger.info('SSE client connected', { connId, trainNo, journeyDate });

    return connId;
}

/**
 * Call when an SSE client disconnects (req 'close' event).
 */
export function trackSSEDisconnect(connId: string): void {
    const conn = activeSSEConnections.get(connId);
    if (!conn) return;

    const durationMs = Date.now() - conn.connectedAt;
    activeSSEConnections.delete(connId);

    metrics.increment('sse.disconnections.total', { trainNo: conn.trainNo });
    metrics.histogram('sse.connection.duration_ms', durationMs, { trainNo: conn.trainNo });
    metrics.gauge('sse.connections.active', activeSSEConnections.size);

    logger.info('SSE client disconnected', {
        connId,
        trainNo: conn.trainNo,
        duration_ms: durationMs,
        reason: 'client_close',
    });
}

/**
 * Returns current SSE connection stats for the /metrics endpoint.
 */
export function getSSEStats(): {
    activeConnections: number;
    byTrain: Record<string, number>;
} {
    const byTrain: Record<string, number> = {};
    activeSSEConnections.forEach(conn => {
        const key = `${conn.trainNo}_${conn.journeyDate}`;
        byTrain[key] = (byTrain[key] || 0) + 1;
    });

    return {
        activeConnections: activeSSEConnections.size,
        byTrain,
    };
}

// =============================================================================
//  P2P Mesh Telemetry (Client-side reports relayed through server)
// =============================================================================

/**
 * Record P2P mesh metrics reported by mobile clients.
 * Clients POST their mesh stats to /api/telemetry/mesh periodically.
 */
export function recordMeshMetrics(report: {
    deviceId: string;
    trainNo: string;
    peerCount: number;
    discoveryAttempts: number;
    discoverySuccesses: number;
    messagesSent: number;
    messagesReceived: number;
    messageDeliveryLatencyMs?: number;
    bridgeType: 'nearby' | 'cloud' | 'hybrid';
}): void {
    // P2P peer discovery success rate
    if (report.discoveryAttempts > 0) {
        const successRate = report.discoverySuccesses / report.discoveryAttempts;
        metrics.gauge('p2p.peer_discovery_success_rate', successRate, {
            trainNo: report.trainNo,
            bridgeType: report.bridgeType,
        });
    }

    // P2P message delivery latency
    if (report.messageDeliveryLatencyMs !== undefined) {
        metrics.histogram('p2p.message_delivery_latency_ms', report.messageDeliveryLatencyMs, {
            trainNo: report.trainNo,
            bridgeType: report.bridgeType,
        });
    }

    // Gauges for current state
    metrics.gauge('p2p.peer_count', report.peerCount, {
        trainNo: report.trainNo,
        bridgeType: report.bridgeType,
    });

    // Counters for throughput
    metrics.increment('p2p.messages_sent', { trainNo: report.trainNo, bridgeType: report.bridgeType }, report.messagesSent);
    metrics.increment('p2p.messages_received', { trainNo: report.trainNo, bridgeType: report.bridgeType }, report.messagesReceived);

    logger.debug('Mesh metrics received', {
        deviceId: report.deviceId.substring(0, 8),
        trainNo: report.trainNo,
        peerCount: report.peerCount,
        discoveryRate: report.discoveryAttempts > 0
            ? (report.discoverySuccesses / report.discoveryAttempts).toFixed(2)
            : 'N/A',
    });
}

// =============================================================================
//  Swap Engine Telemetry
// =============================================================================

/**
 * Record swap matching engine performance.
 */
export function recordSwapEngineRun(stats: {
    trainNo: string;
    journeyDate: string;
    openOffers: number;
    cyclesFound: number;
    matchDurationMs: number;
}): void {
    metrics.increment('swap_engine.runs.total', { trainNo: stats.trainNo });
    metrics.histogram('swap_engine.run_duration_ms', stats.matchDurationMs, { trainNo: stats.trainNo });
    metrics.gauge('swap_engine.open_offers', stats.openOffers, { trainNo: stats.trainNo });
    metrics.histogram('swap_engine.cycles_found', stats.cyclesFound, { trainNo: stats.trainNo });

    if (stats.matchDurationMs > 500) {
        logger.warn('Swap engine slow run', {
            trainNo: stats.trainNo,
            duration_ms: stats.matchDurationMs,
            openOffers: stats.openOffers,
        });
    }
}

// =============================================================================
//  Prisma Query Logging Middleware
// =============================================================================

/**
 * Attach to Prisma client to log slow queries:
 * 
 *   prisma.$use(prismaQueryLogger);
 */
export async function prismaQueryLogger(params: any, next: (params: any) => Promise<any>): Promise<any> {
    const start = Date.now();
    const result = await next(params);
    const duration = Date.now() - start;

    metrics.histogram('db.query.duration_ms', duration, {
        model: params.model || 'unknown',
        action: params.action || 'unknown',
    });

    if (duration > 200) {
        logger.warn('Slow DB query', {
            model: params.model,
            action: params.action,
            duration_ms: duration,
        });
    }

    return result;
}

// =============================================================================
//  Health Check Aggregator
// =============================================================================

interface HealthStatus {
    status: 'healthy' | 'degraded' | 'unhealthy';
    service: string;
    version: string;
    uptime_seconds: number;
    checks: {
        database: 'ok' | 'error';
        sse: 'ok' | 'degraded';
        memory: 'ok' | 'warning';
    };
    metrics_summary: {
        total_requests: number;
        active_sse_connections: number;
        avg_request_latency_ms: number;
    };
}

const startTime = Date.now();

export async function getHealthStatus(prisma: any): Promise<HealthStatus> {
    // Database check
    let dbStatus: 'ok' | 'error' = 'ok';
    try {
        await prisma.$queryRaw`SELECT 1`;
    } catch {
        dbStatus = 'error';
    }

    // Memory check
    const memUsage = process.memoryUsage();
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
    const memStatus: 'ok' | 'warning' = heapUsedMB > 450 ? 'warning' : 'ok';

    // SSE check
    const sseStats = getSSEStats();
    const sseStatus: 'ok' | 'degraded' = sseStats.activeConnections > 500 ? 'degraded' : 'ok';

    // Aggregate metrics
    const snap = metrics.snapshot();
    const totalRequests = Object.values(snap.counters)
        .filter((c: any) => c.tags?.method)
        .reduce((sum: number, c: any) => sum + c.value, 0);

    const latencyHist = Object.entries(snap.histograms)
        .find(([k]) => k.startsWith('http.request.duration_ms'));
    const avgLatency = latencyHist ? (latencyHist[1] as any).avg : 0;

    const overallStatus = dbStatus === 'error' ? 'unhealthy'
        : (memStatus === 'warning' || sseStatus === 'degraded') ? 'degraded'
        : 'healthy';

    return {
        status: overallStatus,
        service: SERVICE_NAME,
        version: '1.0.0',
        uptime_seconds: Math.floor((Date.now() - startTime) / 1000),
        checks: {
            database: dbStatus,
            sse: sseStatus,
            memory: memStatus,
        },
        metrics_summary: {
            total_requests: totalRequests,
            active_sse_connections: sseStats.activeConnections,
            avg_request_latency_ms: Math.round(avgLatency),
        },
    };
}
