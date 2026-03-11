import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Animated } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import Colors from '../../constants/Colors';

/*
  Represents a single node in the swap chain.
*/
export interface SwapNode {
    id: string; // e.g. "YOU", "P2", "P3"
    isYou: boolean;
    coachId: string;
    seatNo: number;
    has: string; // The seat type they currently HAVE
    wants: string; // The seat type they will GET from the next person
}

interface SwapChainVizProps {
    nodes: SwapNode[];
}

// Seat Type to Color mapper (using existing Colors tokens where possible)
const getSeatColor = (type: string) => {
    const t = type.toUpperCase();
    if (t.includes('LOWER') && !t.includes('SIDE')) return Colors.berth.lower;
    if (t.includes('MIDDLE')) return Colors.berth.middle;
    if (t.includes('UPPER') && !t.includes('SIDE')) return Colors.berth.upper;
    if (t.includes('SIDE_LOWER') || t === 'SL') return Colors.berth.sideLower;
    if (t.includes('SIDE_UPPER') || t === 'SU') return Colors.berth.sideUpper;
    return Colors.text.tertiary; // fallback
};

export const SwapChainViz: React.FC<SwapChainVizProps> = ({ nodes }) => {
    // We animate the dashed line chevrons to show flow direction
    const slideAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.loop(
            Animated.timing(slideAnim, {
                toValue: 1,
                duration: 1500,
                useNativeDriver: true,
            })
        ).start();
    }, []);

    // If it's a simple 2-way DIRECT swap
    if (nodes.length === 2) {
        return (
            <View style={styles.directContainer}>
                {/* Node 1 */}
                <View style={[styles.nodeCard, nodes[0].isYou ? styles.nodeCardYou : null]}>
                    <Text style={styles.nodeLabel}>{nodes[0].id}</Text>
                    <Text style={styles.nodeSeat}>{nodes[0].coachId}/{nodes[0].seatNo}</Text>
                    <View style={styles.seatTypes}>
                        <View style={[styles.seatDot, { backgroundColor: getSeatColor(nodes[0].has) }]} />
                        <Text style={styles.seatTypeLabel}>Has</Text>
                    </View>
                </View>

                {/* Swap Icon */}
                <View style={styles.directSwapCenter}>
                    <MaterialCommunityIcons name="swap-horizontal-bold" size={24} color={Colors.primary.start} />
                </View>

                {/* Node 2 */}
                <View style={[styles.nodeCard, nodes[1].isYou ? styles.nodeCardYou : null]}>
                    <Text style={styles.nodeLabel}>{nodes[1].id}</Text>
                    <Text style={styles.nodeSeat}>{nodes[1].coachId}/{nodes[1].seatNo}</Text>
                    <View style={styles.seatTypes}>
                        <View style={[styles.seatDot, { backgroundColor: getSeatColor(nodes[1].has) }]} />
                        <Text style={styles.seatTypeLabel}>Has</Text>
                    </View>
                </View>
            </View>
        );
    }

    // For 3-way or more, show a chain
    return (
        <View style={styles.chainWrapper}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                {nodes.map((node, index) => {
                    const isLast = index === nodes.length - 1;

                    // Animate the chevron moving from left to right slightly
                    const chevronTransform = {
                        transform: [{
                            translateX: slideAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [0, 10]
                            })
                        }]
                    };

                    return (
                        <View key={node.id} style={styles.chainItem}>
                            {/* The Node Card */}
                            <View style={[styles.nodeCard, node.isYou ? styles.nodeCardYou : null]}>
                                <Text style={styles.nodeLabel}>{node.id}</Text>
                                <Text style={styles.nodeSeat}>{node.coachId}/{node.seatNo}</Text>
                                <View style={styles.seatTypes}>
                                    <View style={[styles.seatDot, { backgroundColor: getSeatColor(node.has) }]} />
                                    <Text style={styles.seatTypeLabel}>Has</Text>
                                </View>
                            </View>

                            {/* The Connector (Arrow) between nodes */}
                            {!isLast && (
                                <View style={styles.connectorContainer}>
                                    <Animated.View style={[styles.chevronWrapper, chevronTransform]}>
                                        <Ionicons name="chevron-forward" size={16} color={Colors.text.tertiary} />
                                    </Animated.View>
                                    <View style={styles.dashedLine} />
                                </View>
                            )}

                            {/* The Loop back visual (from last node back to first, usually hidden in horizontal flow but we render a hint) */}
                            {isLast && (
                                <View style={styles.connectorContainer}>
                                    <Ionicons name="return-down-back" size={20} color={Colors.text.tertiary} style={{ marginLeft: 8 }} />
                                </View>
                            )}
                        </View>
                    );
                })}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({
    directContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
    },
    directSwapCenter: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: Colors.primary.light,
        justifyContent: 'center',
        alignItems: 'center',
        marginHorizontal: -12, // overlap the cards slightly
        zIndex: 2,
        borderWidth: 3,
        borderColor: Colors.card.background,
    },
    chainWrapper: {
        paddingVertical: 16,
    },
    scrollContent: {
        paddingHorizontal: 20,
        alignItems: 'flex-start',
    },
    chainItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    nodeCard: {
        width: 100,
        backgroundColor: Colors.card.background,
        borderWidth: 1,
        borderColor: Colors.card.border,
        borderRadius: 14,
        padding: 12,
        alignItems: 'center',
        shadowColor: Colors.shadow,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 1,
        shadowRadius: 4,
        elevation: 2,
        zIndex: 1,
    },
    nodeCardYou: {
        borderColor: Colors.primary.start,
        backgroundColor: Colors.primary.light,
    },
    nodeLabel: {
        fontSize: 11,
        fontWeight: '800',
        color: Colors.text.tertiary,
        marginBottom: 4,
    },
    nodeSeat: {
        fontSize: 16,
        fontWeight: '800',
        color: Colors.text.primary,
        marginBottom: 8,
    },
    seatTypes: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    seatDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
    },
    seatTypeLabel: {
        fontSize: 10,
        color: Colors.text.secondary,
        fontWeight: '600',
    },
    connectorContainer: {
        width: 40,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    dashedLine: {
        position: 'absolute',
        width: '100%',
        height: 1,
        borderStyle: 'dashed',
        borderWidth: 1,
        borderColor: Colors.text.tertiary,
        borderRadius: 1, // needed for dashed border in RN
    },
    chevronWrapper: {
        zIndex: 2,
        backgroundColor: Colors.background.primary,
        paddingHorizontal: 2,
    }
});
