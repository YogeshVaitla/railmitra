import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, TextInput } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import NetInfo from '@react-native-community/netinfo';

import Colors from '../constants/Colors';
import { styles } from '../components/swap/swap.styles';
import { createMeshBridge, IMeshBridge } from '../services/meshBridge';
import { findMyMatches, SwapMatch } from '../services/swapEngine';
import {
    acceptMatch, browseOffers, cancelSwap, clearMockSwapData,
    createLocalSwap, getOrCreateDeviceId, getSwapAnalytics,
    getSwapsForTrain, updateSwapStatus, LocalSwap, SeatType,
    SwapAnalytics, SwapReason,
} from '../services/swapStore';

// Components
import { MeshStatusBar } from '../components/swap/MeshStatusBar';
import { BrowseTab } from '../components/swap/BrowseTab';
import { RegisterTab } from '../components/swap/RegisterTab';
import { MySwapTab } from '../components/swap/MySwapTab';

type TabType = 'browse' | 'register' | 'myswap';

export default function SwapScreen() {
    // --- Tab State ---
    const [activeTab, setActiveTab] = useState<TabType>('browse');

    // --- Core State ---
    const [trainNo, setTrainNo] = useState('');
    const [journeyDate] = useState(new Date().toISOString().split('T')[0]);
    const [deviceId, setDeviceId] = useState('');
    const [tempTrainNo, setTempTrainNo] = useState('');
    const [isEditingTrain, setIsEditingTrain] = useState(true);

    // --- Mesh State ---
    const meshRef = useRef<IMeshBridge | null>(null);
    const [peerCount, setPeerCount] = useState(0);
    const [isOnline, setIsOnline] = useState(true);

    // --- Browse State ---
    const [offers, setOffers] = useState<LocalSwap[]>([]);
    const [browseLoading, setBrowseLoading] = useState(false);
    const [hasBrowsed, setHasBrowsed] = useState(false);

    // --- Register Form State ---
    const [coachId, setCoachId] = useState('');
    const [seatNo, setSeatNo] = useState('');
    const [currentType, setCurrentType] = useState<SeatType | ''>('');
    const [desiredType, setDesiredType] = useState<SeatType | ''>('');
    const [reason, setReason] = useState<SwapReason>('preference');
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [mySwapId, setMySwapId] = useState<string | null>(null);

    // --- Matches State ---
    const [matches, setMatches] = useState<SwapMatch[]>([]);
    const [matchLoading, setMatchLoading] = useState(false);
    const [acceptedIds, setAcceptedIds] = useState<string[]>([]);
    const [hasNewMatch, setHasNewMatch] = useState(false);

    // --- Analytics State ---
    const [analytics, setAnalytics] = useState<SwapAnalytics | null>(null);

    // --- Notification State ---
    const [notification, setNotification] = useState<string | null>(null);
    const didIAcceptRef = useRef(false);
    const prevStatusRef = useRef<string | null>(null);

    const isFormValid = trainNo.length >= 4 && coachId && seatNo && currentType && desiredType && currentType !== desiredType;

    // --- Active Swap Data ---
    const [activeSwapObj, setActiveSwapObj] = useState<LocalSwap | null>(null);
    const [matchedPartnerObj, setMatchedPartnerObj] = useState<LocalSwap | null>(null);

    const isAccepted = !!(activeSwapObj?.status === 'ACCEPTED' || activeSwapObj?.status === 'MATCHED');

    const loadActiveSwap = async () => {
        if (!deviceId) return;
        const { getMySwaps, getSwapsForTrain } = require('../services/swapStore');
        const mySwaps: LocalSwap[] = await getMySwaps();
        const active = mySwaps.find(s => s.status !== 'CANCELLED' && s.status !== 'EXPIRED' && s.status !== 'WITHDRAWN' && s.status !== 'COMPLETED');

        setActiveSwapObj(active || null);
        if (active) {
            setMySwapId(active.id);
            setSubmitted(true);
            setTrainNo(active.trainNo);
            setCoachId(active.currentCoachId);
            setSeatNo(active.currentSeatNo.toString());
            setCurrentType(active.currentSeatType);
            setDesiredType(active.desiredSeatType);
            setReason(active.reason);

            if ((active.status === 'ACCEPTED' || active.status === 'MATCHED') && active.matchedWith) {
                const allSwaps: LocalSwap[] = await getSwapsForTrain(active.trainNo, active.journeyDate);
                const partner = allSwaps.find((s: LocalSwap) => s.id === active.matchedWith);
                setMatchedPartnerObj(partner || null);
            } else {
                setMatchedPartnerObj(null);
            }
        } else {
            setMySwapId(null);
            setSubmitted(false);
            setMatchedPartnerObj(null);
        }
    };

    // --- Init ---
    useEffect(() => {
        getOrCreateDeviceId().then(setDeviceId);
        clearMockSwapData();

        const unsubscribeNetInfo = NetInfo.addEventListener(state => {
            setIsOnline(!!state.isConnected && !!state.isInternetReachable);
        });

        return () => {
            meshRef.current?.stop();
            unsubscribeNetInfo();
        };
    }, []);

    // Sync tempTrainNo when trainNo restores from storage
    useEffect(() => {
        if (trainNo && !activeSwapObj) {
            setTempTrainNo(trainNo);
            setIsEditingTrain(false);
        }
    }, [trainNo]);
    
    // Auto collapse edit mode if we have a submitted active swap
    useEffect(() => {
        if (submitted) setIsEditingTrain(false);
    }, [submitted]);

    // Load active swap when device ID is set
    useEffect(() => {
        if (deviceId) loadActiveSwap();
    }, [deviceId, hasNewMatch]);

    // Show popup if the other person accepted
    useEffect(() => {
        if (activeSwapObj) {
            if (prevStatusRef.current === 'OPEN' && (activeSwapObj.status === 'ACCEPTED' || activeSwapObj.status === 'MATCHED')) {
                if (!didIAcceptRef.current) {
                    Alert.alert(
                        "Swap Accepted! 🎉",
                        "Another passenger has accepted your swap offer! Do you confirm this swap?",
                        [
                            { 
                                text: 'Cancel Swap', 
                                style: 'cancel',
                                onPress: () => confirmReportProblem(activeSwapObj.id) 
                            },
                            { 
                                text: 'Confirm', 
                                style: 'default',
                                onPress: () => showNotification("Swap confirmed! Find your partner.") 
                            }
                        ]
                    );
                }
            }
            prevStatusRef.current = activeSwapObj.status;
        } else {
            prevStatusRef.current = null;
            didIAcceptRef.current = false; // reset when swap completes/cancels
        }
    }, [activeSwapObj]);

    // --- Handlers ---
    const handleSetTrain = () => {
        if (tempTrainNo.length >= 4) {
            setTrainNo(tempTrainNo);
            setIsEditingTrain(false);
            setHasBrowsed(false);
            setOffers([]);
            setActiveTab('browse');
        }
    };

    // Ref to avoid stale closures in mesh callbacks
    const trainNoRef = useRef(trainNo);
    useEffect(() => { trainNoRef.current = trainNo; }, [trainNo]);

    // Auto-fetch swaps when trainNo is successfully submitted
    useEffect(() => {
        if (trainNo.length >= 4 && activeTab === 'browse' && !hasBrowsed && !browseLoading) {
            handleBrowse();
        }
    }, [trainNo, activeTab, hasBrowsed, browseLoading]);

    const initMeshBridge = async () => {
        if (!trainNo || trainNo.length < 4) return;
        if (!meshRef.current || !meshRef.current.isActive()) {
            const mesh = createMeshBridge();
            meshRef.current = mesh;
            mesh.onPeerCountChanged((count) => {
                setPeerCount(count);
            });
            mesh.onSwapReceived((newSwaps) => {
                // Use ref to get current trainNo, not the stale closure value
                const currentTrainNo = trainNoRef.current;
                if (currentTrainNo) {
                    browseOffers(currentTrainNo, journeyDate).then(setOffers);
                }
                handleFindMatches();
                if (newSwaps.length > 0) {
                    setHasNewMatch(true);
                    showNotification(`📡 ${newSwaps.length} new offer${newSwaps.length > 1 ? 's' : ''} synced`);
                }
            });
            await mesh.startAdvertising(trainNo, journeyDate);
            await mesh.startDiscovery(trainNo, journeyDate);
        }
    };

    const handleBrowse = async () => {
        if (!trainNo || trainNo.length < 4) return;
        setBrowseLoading(true);
        setHasBrowsed(false);

        await initMeshBridge();

        // Force an immediate cloud poll to get the latest offers from server
        // This is especially important when the bridge was already active
        // and the last poll was up to 15 seconds ago
        if (meshRef.current) {
            try {
                await meshRef.current.forcePoll();
            } catch {
                // Ignore — offline is fine, we'll fall back to local data
            }
        }

        const result = await browseOffers(trainNo, journeyDate);
        setOffers(result);
        setHasBrowsed(true);
        setBrowseLoading(false);

        const stats = await getSwapAnalytics(trainNo, journeyDate);
        setAnalytics(stats);
    };

    const handleSubmit = async () => {
        if (!isFormValid || !currentType || !desiredType) return;
        setLoading(true);

        console.log(`[SwapScreen] Registering swap for train=${trainNo}, coach=${coachId}, seat=${seatNo}, currentType=${currentType}, desiredType=${desiredType}`);
        await initMeshBridge();

        try {
            const swap = await createLocalSwap({
                trainNo, journeyDate,
                currentCoachId: coachId,
                currentSeatNo: parseInt(seatNo),
                currentSeatType: currentType,
                desiredSeatType: desiredType,
                reason,
            });

            console.log(`[SwapScreen] Swap created locally, id=${swap.id}`);
            meshRef.current?.broadcastSwapOffer(swap);
            setMySwapId(swap.id);
            setLoading(false);
            setSubmitted(true);

            AsyncStorage.setItem('activeSwap', JSON.stringify({
                mySwapId: swap.id, trainNo, coachId, seatNo, currentType, desiredType,
            }));

            setActiveTab('myswap');
            showNotification('✅ Swap registered! Looking for matches...');

            const updatedOffers = await browseOffers(trainNo, journeyDate);
            setOffers(updatedOffers);
            await loadActiveSwap();
            const allSwaps = await getSwapsForTrain(trainNo, journeyDate);
            const myMatches = findMyMatches(allSwaps, deviceId);
            setMatches(myMatches);
        } catch (error: any) {
            console.error(`[SwapScreen] Register failed:`, error);
            setLoading(false);
            Alert.alert('Can\'t Register', error.message || 'Something went wrong.');
        }
    };

    const handleFindMatches = async () => {
        setMatchLoading(true);
        const allSwaps = await getSwapsForTrain(trainNo, journeyDate);
        const myMatches = findMyMatches(allSwaps, deviceId);
        console.log(`[SwapScreen] Finding matches... found: ${myMatches.length}`);
        setMatches(myMatches);
        setMatchLoading(false);
    };

    const handleAcceptSwap = (match: SwapMatch) => {
        const myParticipant = match.participants.find(p => p.isYou);
        const otherParticipant = match.participants.find(p => !p.isYou);
        if (!myParticipant || !otherParticipant) return;

        Alert.alert(
            'Accept This Swap?',
            `You'll swap your seat with ${otherParticipant.coachId}/${otherParticipant.seatNo}`,
            [
                { text: 'Not Now', style: 'cancel' },
                {
                    text: 'Accept Swap',
                    onPress: async () => {
                        didIAcceptRef.current = true;
                        console.log(`[SwapScreen] Accepting swap myId=${myParticipant.swapId}, otherId=${otherParticipant.swapId}`);
                        await acceptMatch(myParticipant.swapId, otherParticipant.swapId);
                        meshRef.current?.broadcastSwapAccept(otherParticipant.swapId, myParticipant.swapId);
                        setAcceptedIds(prev => [...prev, match.id]);
                        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

                        await loadActiveSwap();
                        
                        const updatedOffers = await browseOffers(trainNo, journeyDate);
                        setOffers(updatedOffers);
                        handleFindMatches();
                    },
                },
            ]
        );
    };

    const handleCancelSwap = async (swapId: string) => {
        Alert.alert('Cancel Swap', 'Are you sure you want to cancel your swap offer?', [
            { text: 'Keep It', style: 'cancel' },
            {
                text: 'Cancel Offer', style: 'destructive',
                onPress: async () => {
                    console.log(`[SwapScreen] Cancelling swap id=${swapId}`);
                    await cancelSwap(swapId);
                    meshRef.current?.broadcastSwapCancel(swapId);
                    AsyncStorage.removeItem('activeSwap');
                    showNotification('🚫 Swap offer cancelled.');
                    handleReset();
                    await loadActiveSwap();
                },
            },
        ]);
    };

    const handleCompleteSwap = async () => {
        if (mySwapId) {
            await updateSwapStatus(mySwapId, 'COMPLETED');
            if (activeSwapObj?.sessionId) {
                meshRef.current?.broadcastSessionComplete(activeSwapObj.sessionId);
            }
            Alert.alert('Success', 'Swap marked as completed! Have a great journey.');
            handleReset();
            router.push('/');
        }
    };

    const handleReportProblem = async () => {
        if (!mySwapId) return;
        Alert.alert(
            'Report a Problem',
            'Why did this swap fail?',
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Other person not there', onPress: () => confirmReportProblem(mySwapId) },
                { text: 'Wrong seat', onPress: () => confirmReportProblem(mySwapId) },
                { text: 'Changed mind', onPress: () => confirmReportProblem(mySwapId) }
            ]
        );
    };

    const confirmReportProblem = async (swapId: string) => {
        await updateSwapStatus(swapId, 'CANCELLED');
        if (activeSwapObj?.sessionId) {
            meshRef.current?.broadcastSessionFail(activeSwapObj.sessionId);
        }
        Alert.alert('Problem Reported', 'The swap has been cancelled. You can register a new one.');
        handleReset();
        await loadActiveSwap();
    };

    const showNotification = (msg: string) => {
        setNotification(msg);
        setTimeout(() => setNotification(null), 5000);
    };

    const handleReset = () => {
        setSubmitted(false); setHasBrowsed(false); setOffers([]);
        setCoachId(''); setSeatNo(''); setCurrentType(''); setDesiredType('');
        setReason('preference'); setMatches([]); setAcceptedIds([]);
        setAnalytics(null); setMySwapId(null); setActiveTab('browse');
    };

    const switchTab = (tab: TabType) => {
        setActiveTab(tab);
        if (tab === 'browse' && trainNo.length >= 4) handleBrowse();
        if (tab === 'myswap') {
            setHasNewMatch(false);
            if (submitted && trainNo.length >= 4) handleFindMatches();
        }
    };

    // Calculate Mesh Status Profile State
    const connectionState = (isOnline && peerCount > 0) ? 'FULL_SYNC' : 
                            (isOnline && peerCount === 0) ? 'CLOUD_ONLY' : 
                            (!isOnline && peerCount > 0) ? 'P2P_ONLY' : 'ISOLATED';

    return (
        <View style={styles.container}>
            {notification && (
                <View style={styles.notifBanner}>
                    <Text style={styles.notifText}>{notification}</Text>
                    <TouchableOpacity onPress={() => setNotification(null)}>
                        <Ionicons name="close" size={18} color="#fff" />
                    </TouchableOpacity>
                </View>
            )}
            <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={20} color={Colors.text.primary} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Seat Swap</Text>
                    <View style={{ width: 42 }} />
                </View>

                {/* Train Context Header */}
                <View style={styles.trainContextHeader}>
                    {isEditingTrain && !submitted ? (
                        <View style={styles.trainInputContainer}>
                            <Text style={styles.trainInputPrompt}>Enter Train Number to See Swaps</Text>
                            <View style={styles.trainInputFieldWrapper}>
                                <Ionicons name="train-outline" size={20} color={Colors.text.tertiary} style={{ marginLeft: 12 }} />
                                <TextInput
                                    style={styles.trainInputField}
                                    placeholder="e.g. 12423"
                                    placeholderTextColor={Colors.text.tertiary}
                                    value={tempTrainNo}
                                    onChangeText={setTempTrainNo}
                                    keyboardType="number-pad"
                                    maxLength={5}
                                />
                                <TouchableOpacity 
                                    onPress={handleSetTrain} 
                                    disabled={tempTrainNo.length < 4}
                                    style={[styles.trainInputGoBtn, tempTrainNo.length < 4 && { opacity: 0.5 }]}
                                >
                                    <Text style={styles.trainInputGoText}>Go</Text>
                                    <Ionicons name="arrow-forward" size={16} color="#fff" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        <View style={styles.trainPillContainer}>
                            <View style={styles.trainPill}>
                                <Text style={styles.trainPillEmoji}>🚄</Text>
                                <Text style={styles.trainPillText}>Train {trainNo} • Today</Text>
                                {!submitted && (
                                    <TouchableOpacity 
                                        onPress={() => {
                                            setIsEditingTrain(true);
                                            setTempTrainNo(trainNo);
                                        }} 
                                        style={styles.trainEditBtn}
                                    >
                                        <Ionicons name="pencil" size={14} color={Colors.primary.start} />
                                    </TouchableOpacity>
                                )}
                            </View>
                        </View>
                    )}
                </View>

                <View style={{ marginBottom: 16 }}>
                    <MeshStatusBar connectionState={connectionState} peerCount={peerCount} />
                </View>

                <View style={styles.tabBar}>
                    {[
                        { key: 'browse' as TabType, label: 'Browse', icon: 'search-outline' },
                        { key: 'register' as TabType, label: 'Register', icon: 'add-circle-outline' },
                        { key: 'myswap' as TabType, label: 'My Swap', icon: 'swap-horizontal-outline' },
                    ].map(tab => {
                        const isDisabled = tab.key !== 'browse' && trainNo.length < 4;
                        return (
                            <TouchableOpacity 
                                key={tab.key} 
                                style={[styles.tab, activeTab === tab.key && styles.tabActive, isDisabled && { opacity: 0.5 }]} 
                                disabled={isDisabled}
                                onPress={() => switchTab(tab.key)}
                            >
                                <View style={{ position: 'relative' }}>
                                    <Ionicons name={tab.icon as any} size={18} color={activeTab === tab.key ? Colors.primary.start : Colors.text.tertiary} />
                                    {tab.key === 'myswap' && (hasNewMatch || submitted) && (
                                        <View style={[styles.tabBadge, hasNewMatch ? { backgroundColor: Colors.danger.start } : { backgroundColor: Colors.success.start }]} />
                                    )}
                                </View>
                                <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive, isDisabled && { color: Colors.text.tertiary }]}>{tab.label}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {activeTab === 'browse' && (
                    <BrowseTab 
                        trainNo={trainNo} browseLoading={browseLoading} hasBrowsed={hasBrowsed}
                        offers={offers} analytics={analytics} 
                        onBrowse={handleBrowse} onSwitchToRegister={() => setActiveTab('register')}
                    />
                )}
                {activeTab === 'register' && (
                    <RegisterTab 
                        submitted={submitted} coachId={coachId} seatNo={seatNo} currentType={currentType}
                        desiredType={desiredType} reason={reason} loading={loading} isFormValid={!!isFormValid}
                        onCoachIdChange={setCoachId} onSeatNoChange={setSeatNo} onCurrentTypeChange={setCurrentType}
                        onDesiredTypeChange={setDesiredType} onReasonChange={setReason} onSubmit={handleSubmit}
                        onGoToMySwap={() => setActiveTab('myswap')}
                    />
                )}
                {activeTab === 'myswap' && (
                    <MySwapTab 
                        submitted={submitted} mySwapId={mySwapId} activeSwapObj={activeSwapObj}
                        matchedPartnerObj={matchedPartnerObj} isAccepted={!!isAccepted} peerCount={peerCount}
                        matchLoading={matchLoading} matches={matches} acceptedIds={acceptedIds}
                        onCancelSwap={handleCancelSwap} onFindMatches={handleFindMatches} onAcceptSwap={handleAcceptSwap}
                        onGoToRegister={() => setActiveTab('register')}
                        onCompleteSwap={handleCompleteSwap}
                        onReportProblem={handleReportProblem}
                    />
                )}
            </ScrollView>
        </View>
    );
}
