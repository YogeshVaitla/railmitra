/**
 * On-Device Swap Matching Engine
 * 
 * Graph-based N-way cycle finder that runs entirely on the user's phone.
 * Same class of algorithm used in kidney exchange networks — extremely rare
 * in consumer apps. No server, no internet, no latency.
 * 
 * How it works:
 * 1. Model all open swap requests as a directed graph
 *    - Each request is a node
 *    - Edge from A to B if A's desiredSeatType === B's currentSeatType
 * 2. Find all cycles in the graph (Johnson's algorithm variant)
 * 3. Score each cycle by cumulative priority, length, freshness
 * 4. Return the best non-overlapping set of matches
 */

import { LocalSwap, SeatType } from './swapStore';

// --- Types ---

export interface SwapMatch {
    id: string;
    type: 'DIRECT' | 'TRIANGULAR' | 'CHAIN';
    participants: MatchParticipant[];
    score: number;              // Cumulative priority score of all participants
    cyclePath: string;          // Human-readable: "UPPER → LOWER → UPPER"
}

export interface MatchParticipant {
    swapId: string;
    deviceId: string;
    coachId: string;
    seatNo: number;
    has: SeatType;
    wants: SeatType;
    priorityScore: number;
    reason: string;
    isYou: boolean;             // true if this is the current device's swap
}

// --- Graph Structures ---

interface GraphNode {
    swap: LocalSwap;
    edges: number[];            // Indices of nodes this connects to
}

// --- Core Algorithm ---

/**
 * Build a directed graph from open swap requests.
 * 
 * Node = swap request
 * Edge A→B exists when A wants what B has (A.desiredSeatType === B.currentSeatType)
 * 
 * RM-SW-031: Optimized with Map-based lookups instead of O(n²) nested loops.
 */
function buildSwapGraph(swaps: LocalSwap[]): GraphNode[] {
    const nodes: GraphNode[] = swaps.map(swap => ({ swap, edges: [] }));

    // Build a reverse index: seatType → list of node indices that HAVE that type
    const hasSeatType = new Map<string, number[]>();
    for (let i = 0; i < nodes.length; i++) {
        const type = nodes[i].swap.currentSeatType;
        if (!hasSeatType.has(type)) hasSeatType.set(type, []);
        hasSeatType.get(type)!.push(i);
    }

    // For each node, look up who has what they want via the Map (O(1) per lookup)
    for (let i = 0; i < nodes.length; i++) {
        const wanted = nodes[i].swap.desiredSeatType;
        const candidates = hasSeatType.get(wanted) || [];
        for (const j of candidates) {
            if (i !== j) nodes[i].edges.push(j);
        }
    }

    return nodes;
}

/**
 * Find all simple cycles in the graph up to maxLength.
 * 
 * Uses a bounded DFS. We cap at 5-way cycles because anything longer is
 * impractical for real-world seat swaps.
 * 
 * RM-SW-031: Added 250ms timeout — if the search takes too long on a
 * dense graph, return whatever valid cycles we've found so far.
 * 
 * Returns arrays of node indices representing each cycle.
 */
function findAllCycles(nodes: GraphNode[], maxLength: number = 5): number[][] {
    const cycles: number[][] = [];
    const n = nodes.length;
    const startTime = performance.now();
    const TIMEOUT_MS = 250;

    // For each starting node, do a bounded DFS looking for cycles back to start
    for (let start = 0; start < n; start++) {
        // RM-SW-031: Short-circuit if we've exceeded the time budget
        if (performance.now() - startTime > TIMEOUT_MS) {
            console.log(`[SwapEngine] Cycle search timed out after ${Math.round(performance.now() - startTime)}ms with ${cycles.length} cycles found`);
            break;
        }

        const stack: { nodeIdx: number; path: number[] }[] = [{ nodeIdx: start, path: [start] }];

        while (stack.length > 0) {
            const { nodeIdx, path } = stack.pop()!;

            if (path.length > maxLength) continue;

            for (const neighbor of nodes[nodeIdx].edges) {
                if (neighbor === start && path.length >= 2) {
                    // Found a cycle! But only record it if start is the smallest index
                    // (prevents counting the same cycle multiple times)
                    const minInCycle = Math.min(...path);
                    if (minInCycle === start) {
                        cycles.push([...path]);
                    }
                } else if (!path.includes(neighbor) && path.length < maxLength) {
                    stack.push({ nodeIdx: neighbor, path: [...path, neighbor] });
                }
            }
        }
    }

    return cycles;
}

/**
 * Score a cycle for ranking.
 * 
 * Factors:
 * - Cumulative priority of all participants (higher = better)
 * - Length penalty: shorter cycles are easier to coordinate (2-way > 3-way > N-way)
 * - Freshness bonus: recently created swaps get a slight boost
 * - "You" bonus: cycles containing the current user's swap get a boost
 * - RM-SW-030: Coach proximity bonus — same coach +0.20, adjacent +0.10
 */
function scoreCycle(cycle: number[], nodes: GraphNode[], myDeviceId: string): number {
    let cumulativePriority = 0;
    let freshnessBonus = 0;
    let youBonus = 0;
    let coachProximityBonus = 0;
    const now = Date.now();

    for (const idx of cycle) {
        const swap = nodes[idx].swap;
        cumulativePriority += swap.priorityScore;

        // Freshness: swaps created in the last 30 minutes get up to +0.1
        const ageMinutes = (now - swap.createdAt) / 60000;
        freshnessBonus += Math.max(0, 0.1 - ageMinutes * 0.003);

        // If this cycle involves the current user, boost it
        if (swap.deviceId === myDeviceId) {
            youBonus = 0.5;
        }
    }

    // RM-SW-030: Coach proximity bonus — check each trade edge in the cycle
    for (let i = 0; i < cycle.length; i++) {
        const nextIdx = (i + 1) % cycle.length;
        const coachA = nodes[cycle[i]].swap.currentCoachId;
        const coachB = nodes[cycle[nextIdx]].swap.currentCoachId;

        if (coachA === coachB) {
            // Same coach = easy walk, big bonus
            coachProximityBonus += 0.20;
        } else if (areAdjacentCoaches(coachA, coachB)) {
            // Next-door coaches, still pretty convenient
            coachProximityBonus += 0.10;
        }
    }

    // Length penalty: 2-way = 1.0x, 3-way = 0.85x, 4-way = 0.7x, 5-way = 0.55x
    const lengthMultiplier = Math.max(0.4, 1.15 - cycle.length * 0.15);

    return parseFloat(
        ((cumulativePriority + freshnessBonus + youBonus + coachProximityBonus) * lengthMultiplier).toFixed(3)
    );
}

/**
 * RM-SW-030: Check if two coach IDs are adjacent (e.g., S4 and S5, B1 and B2).
 * Parses the numeric suffix from coach IDs and checks if they differ by exactly 1.
 */
function areAdjacentCoaches(coachA: string, coachB: string): boolean {
    const numA = parseInt(coachA.replace(/[^0-9]/g, ''), 10);
    const numB = parseInt(coachB.replace(/[^0-9]/g, ''), 10);
    if (isNaN(numA) || isNaN(numB)) return false;

    // Must share the same letter prefix (e.g., both 'S' or both 'B')
    const prefixA = coachA.replace(/[0-9]/g, '');
    const prefixB = coachB.replace(/[0-9]/g, '');
    if (prefixA !== prefixB) return false;

    return Math.abs(numA - numB) === 1;
}

/**
 * From all found cycles, pick the best non-overlapping set.
 * 
 * Greedy approach: sort by score descending, then pick cycles that don't
 * share any participants with already-selected cycles.
 */
function selectBestMatches(
    cycles: number[][],
    nodes: GraphNode[],
    myDeviceId: string
): { cycle: number[]; score: number }[] {
    // Score all cycles
    const scored = cycles.map(cycle => ({
        cycle,
        score: scoreCycle(cycle, nodes, myDeviceId),
    }));

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Greedy selection: no node can appear in two selected cycles
    const usedNodes = new Set<number>();
    const selected: typeof scored = [];

    for (const candidate of scored) {
        if (candidate.cycle.some(idx => usedNodes.has(idx))) continue;
        selected.push(candidate);
        candidate.cycle.forEach(idx => usedNodes.add(idx));
    }

    return selected;
}

// --- Public API ---

/**
 * Main entry point. Find the best swap matches from a list of open swaps.
 * 
 * This is the core IP — a graph-based cycle finder with priority scoring,
 * running entirely on-device. No server call, no internet, no latency.
 * 
 * RM-SW-031: Added execution time logging for observability.
 */
export function findBestMatches(swaps: LocalSwap[], myDeviceId: string): SwapMatch[] {
    const t0 = performance.now();

    // Only consider open swaps
    const openSwaps = swaps.filter(s => s.status === 'OPEN');
    if (openSwaps.length < 2) return [];

    // Refresh priority scores (they decay over time)
    for (const swap of openSwaps) {
        swap.priorityScore = recomputePriority(swap);
    }

    // Build the graph
    const nodes = buildSwapGraph(openSwaps);

    // Find all possible cycles
    const cycles = findAllCycles(nodes, 5);
    if (cycles.length === 0) {
        const elapsed = Math.round(performance.now() - t0);
        if (elapsed > 50) console.log(`[SwapEngine] findBestMatches: ${openSwaps.length} swaps, 0 cycles, ${elapsed}ms`);
        return [];
    }

    // Select the best non-overlapping matches
    const bestMatches = selectBestMatches(cycles, nodes, myDeviceId);

    const elapsed = Math.round(performance.now() - t0);
    console.log(`[SwapEngine] findBestMatches: ${openSwaps.length} swaps, ${cycles.length} cycles, ${bestMatches.length} matches, ${elapsed}ms`);

    // Convert to SwapMatch format
    return bestMatches.map(({ cycle, score }) => {
        const type = cycle.length === 2 ? 'DIRECT' : cycle.length === 3 ? 'TRIANGULAR' : 'CHAIN';

        const participants: MatchParticipant[] = cycle.map(idx => {
            const swap = nodes[idx].swap;
            return {
                swapId: swap.id,
                deviceId: swap.deviceId,
                coachId: swap.currentCoachId,
                seatNo: swap.currentSeatNo,
                has: swap.currentSeatType,
                wants: swap.desiredSeatType,
                priorityScore: swap.priorityScore,
                reason: swap.reason,
                isYou: swap.deviceId === myDeviceId,
            };
        });

        // Build human-readable cycle path
        const cyclePath = participants.map(p => seatTypeShortLabel(p.has)).join(' → ') + ' → ' + seatTypeShortLabel(participants[0].has);

        return {
            id: `match_${cycle.map(i => nodes[i].swap.id.substring(0, 4)).join('_')}`,
            type,
            participants,
            score,
            cyclePath,
        };
    });
}

/**
 * Recompute priority score with time decay.
 * Priority grows logarithmically with wait time, capped at +0.30 bonus.
 */
function recomputePriority(swap: LocalSwap): number {
    const reasonBonus: Record<string, number> = {
        elderly: 0.30,
        medical: 0.25,
        family: 0.15,
        preference: 0.05,
    };

    const createdTimestamp = new Date(swap.createdAt).getTime();
    const waitHours = Math.max(0, (Date.now() - createdTimestamp) / 3600000);
    const waitBonus = Math.min(0.30, Math.log(1 + waitHours) * 0.17);

    return parseFloat((0.20 + (reasonBonus[swap.reason] || 0.05) + waitBonus).toFixed(3));
}

/**
 * Get matches specifically relevant to a user's swap.
 * Filters findBestMatches to only return cycles containing the user.
 */
export function findMyMatches(swaps: LocalSwap[], myDeviceId: string): SwapMatch[] {
    const allMatches = findBestMatches(swaps, myDeviceId);
    return allMatches.filter(m => m.participants.some(p => p.isYou));
}

/**
 * Check if a specific swap has any potential matches.
 * Quick check without running the full algorithm.
 */
export function hasAnyPotentialMatch(swap: LocalSwap, allSwaps: LocalSwap[]): boolean {
    // Does anyone have what I want?
    const someoneHasWhatIWant = allSwaps.some(
        s => s.id !== swap.id && s.status === 'OPEN' && s.currentSeatType === swap.desiredSeatType
    );
    // Does anyone want what I have?
    const someoneWantsWhatIHave = allSwaps.some(
        s => s.id !== swap.id && s.status === 'OPEN' && s.desiredSeatType === swap.currentSeatType
    );

    return someoneHasWhatIWant && someoneWantsWhatIHave;
}

// --- Helpers ---

function seatTypeShortLabel(type: SeatType): string {
    const labels: Record<SeatType, string> = {
        LOWER: 'LB',
        MIDDLE: 'MB',
        UPPER: 'UB',
        SIDE_LOWER: 'SL',
        SIDE_UPPER: 'SU',
    };
    return labels[type] || type;
}
