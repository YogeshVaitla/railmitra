/**
 * RailMitra — Production Deployment Verification Script
 * Ticket: RM-SW-052
 * 
 * Validates that the Render-deployed backend is alive, connected to the DB,
 * handles SSE streams, and processes swap lifecycle end-to-end.
 * 
 * Usage:
 *   npx ts-node scripts/verify-deploy.ts
 *   npx ts-node scripts/verify-deploy.ts --base-url https://your-custom-url.com
 * 
 * Exit codes:
 *   0 = All checks passed
 *   1 = One or more checks failed
 */

const DEFAULT_BASE_URL = 'https://railmitra-api.onrender.com';
const TIMEOUT_MS = 35000; // Render free tier cold starts can take ~30s

// --- Helpers ---

function getBaseUrl(): string {
    const idx = process.argv.indexOf('--base-url');
    if (idx !== -1 && process.argv[idx + 1]) {
        return process.argv[idx + 1].replace(/\/$/, '');
    }
    return DEFAULT_BASE_URL;
}

async function fetchWithTimeout(url: string, options: RequestInit = {}): Promise<Response> {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
        const res = await fetch(url, { ...options, signal: controller.signal });
        clearTimeout(id);
        return res;
    } catch (err) {
        clearTimeout(id);
        throw err;
    }
}

type CheckResult = { name: string; passed: boolean; details: string; duration_ms: number };

async function runCheck(name: string, fn: () => Promise<string>): Promise<CheckResult> {
    const start = Date.now();
    try {
        const details = await fn();
        return { name, passed: true, details, duration_ms: Date.now() - start };
    } catch (err: any) {
        return { name, passed: false, details: err.message || String(err), duration_ms: Date.now() - start };
    }
}

// =============================================================================
//  CHECK 1: Health Endpoint
// =============================================================================

async function checkHealth(baseUrl: string): Promise<string> {
    const res = await fetchWithTimeout(`${baseUrl}/api/health`);
    if (!res.ok) throw new Error(`Health endpoint returned ${res.status}`);

    const body = await res.json();

    // Per ticket: explicitly confirm status: "healthy" (meaning Prisma DB connected)
    if (body.status !== 'healthy') {
        throw new Error(`Health status is "${body.status}", not "healthy". Checks: ${JSON.stringify(body.checks)}`);
    }

    if (body.checks?.database !== 'ok') {
        throw new Error(`Database check failed: ${body.checks?.database}`);
    }

    return `Status: ${body.status} | DB: ${body.checks.database} | Uptime: ${body.uptime_seconds}s | SSE: ${body.metrics_summary?.active_sse_connections} active`;
}

// =============================================================================
//  CHECK 2: Metrics Endpoint
// =============================================================================

async function checkMetrics(baseUrl: string): Promise<string> {
    const res = await fetchWithTimeout(`${baseUrl}/api/metrics`);
    if (!res.ok) throw new Error(`Metrics endpoint returned ${res.status}`);

    const body = await res.json();

    // Per ticket: verify it returns expected shapes
    const requiredKeys = ['counters', 'gauges', 'histograms', 'sse'];
    const missingKeys = requiredKeys.filter(k => !(k in body));
    if (missingKeys.length > 0) {
        throw new Error(`Metrics response missing keys: ${missingKeys.join(', ')}`);
    }

    return `Counters: ${Object.keys(body.counters).length} | Gauges: ${Object.keys(body.gauges).length} | Histograms: ${Object.keys(body.histograms).length} | SSE active: ${body.sse?.activeConnections ?? 0}`;
}

// =============================================================================
//  CHECK 3: SSE Stream Test
// =============================================================================

async function checkSSEStream(baseUrl: string): Promise<string> {
    const testTrain = '99999';
    const testDate = '2026-12-31';
    const url = `${baseUrl}/api/swaps/${testTrain}/${testDate}/stream`;

    return new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error('SSE stream did not send CONNECTED payload within 30s'));
        }, 30000);

        // Use raw fetch to read the SSE stream
        fetchWithTimeout(url).then(async (res) => {
            if (!res.ok) {
                clearTimeout(timeout);
                reject(new Error(`SSE endpoint returned ${res.status}`));
                return;
            }

            const reader = res.body?.getReader();
            if (!reader) {
                clearTimeout(timeout);
                reject(new Error('No readable stream from SSE endpoint'));
                return;
            }

            const decoder = new TextDecoder();
            let buffer = '';

            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;

                    buffer += decoder.decode(value, { stream: true });

                    // Look for the CONNECTED event in the SSE stream
                    const lines = buffer.split('\n');
                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            try {
                                const payload = JSON.parse(line.substring(6));
                                if (payload.type === 'CONNECTED') {
                                    clearTimeout(timeout);
                                    reader.cancel();
                                    resolve(`Received CONNECTED payload: trainNo=${payload.trainNo}, journeyDate=${payload.journeyDate}`);
                                    return;
                                }
                            } catch {
                                // Not valid JSON yet, keep reading
                            }
                        }
                    }
                }
            } catch (err: any) {
                // Reader cancelled is expected after we get CONNECTED
                if (!err.message?.includes('cancel')) {
                    clearTimeout(timeout);
                    reject(err);
                }
            }
        }).catch((err) => {
            clearTimeout(timeout);
            reject(err);
        });
    });
}

// =============================================================================
//  CHECK 4: End-to-End Swap Lifecycle
// =============================================================================

async function checkSwapLifecycle(baseUrl: string): Promise<string> {
    const testTrain = '99999';
    const testDate = '2026-12-31';
    const testDeviceId = `verify_deploy_${Date.now()}`;

    // Step 1: POST a dummy swap offer
    const postRes = await fetchWithTimeout(`${baseUrl}/api/swaps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            trainNo: testTrain,
            userId: testDeviceId,
            currentCoachId: 'TEST1',
            currentSeatNo: 1,
            currentSeatType: 'UPPER',
            desiredSeatType: 'LOWER',
            journeyDate: testDate,
            reason: 'preference',
        }),
    });

    if (!postRes.ok) {
        const errText = await postRes.text();
        throw new Error(`POST /api/swaps failed (${postRes.status}): ${errText}`);
    }

    const postBody = await postRes.json();
    if (!postBody.success || !postBody.swapId) {
        throw new Error(`POST /api/swaps returned unexpected body: ${JSON.stringify(postBody)}`);
    }

    const swapId = postBody.swapId;

    // Step 2: GET the browse list and verify it appears
    const browseRes = await fetchWithTimeout(`${baseUrl}/api/swaps/${testTrain}/${testDate}/browse`);
    if (!browseRes.ok) throw new Error(`GET browse failed (${browseRes.status})`);

    const browseBody = await browseRes.json();
    const found = browseBody.offers?.find((o: any) => o.id === swapId);
    if (!found) {
        throw new Error(`Created swap ${swapId} not found in browse list (${browseBody.offers?.length || 0} offers returned)`);
    }

    // Step 3: POST cancel to clean up production state
    const cancelRes = await fetchWithTimeout(`${baseUrl}/api/swaps/${swapId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
    });

    if (!cancelRes.ok) {
        const errText = await cancelRes.text();
        throw new Error(`POST cancel failed (${cancelRes.status}): ${errText}`);
    }

    const cancelBody = await cancelRes.json();
    if (!cancelBody.success) {
        throw new Error(`Cancel returned unexpected body: ${JSON.stringify(cancelBody)}`);
    }

    return `Created swap ${swapId} → verified in browse list → cancelled. Full lifecycle OK.`;
}

// =============================================================================
//  Main Runner
// =============================================================================

async function main() {
    const baseUrl = getBaseUrl();

    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  🚄 RailMitra Deployment Verification');
    console.log(`  Target: ${baseUrl}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    const results: CheckResult[] = [];

    // Run checks sequentially (each depends on server being warmed up)
    console.log('⏳ [1/4] Health check...');
    results.push(await runCheck('Health Endpoint (/api/health)', () => checkHealth(baseUrl)));

    console.log('⏳ [2/4] Metrics endpoint...');
    results.push(await runCheck('Metrics Endpoint (/api/metrics)', () => checkMetrics(baseUrl)));

    console.log('⏳ [3/4] SSE stream test...');
    results.push(await runCheck('SSE Stream (CONNECTED payload)', () => checkSSEStream(baseUrl)));

    console.log('⏳ [4/4] End-to-end swap lifecycle...');
    results.push(await runCheck('Swap Lifecycle (POST → Browse → Cancel)', () => checkSwapLifecycle(baseUrl)));

    // Report
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  RESULTS');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    let allPassed = true;
    for (const r of results) {
        const icon = r.passed ? '✅' : '❌';
        console.log(`  ${icon} ${r.name} (${r.duration_ms}ms)`);
        console.log(`     ${r.details}`);
        console.log('');
        if (!r.passed) allPassed = false;
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    if (allPassed) {
        console.log('  🎉 ALL CHECKS PASSED — Deployment is healthy!');
    } else {
        console.log('  ⚠️  SOME CHECKS FAILED — Review issues above.');
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');

    process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
    console.error('Fatal error during verification:', err);
    process.exit(1);
});
