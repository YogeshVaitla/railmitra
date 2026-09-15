import React, { useCallback, useRef, useState } from 'react';
import { Alert, AppState, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BERTHS, Berth, calendarDate, CLASSES, compatible, exchangeState, Offer, TravelClass } from '../server/src/protocol';
import { connect, ConnectionStatus, exchange, reportAndBlock } from '../services/exchange';
import { Snapshot } from '../services/exchangeStore';

const labels = { OPEN:'Offer ready', WAITING:'Waiting for passenger confirmation', BOTH_ACCEPTED:'Both passengers accepted', COMPLETING:'Waiting for both completion confirmations', COMPLETED:'Exchange completed', FAILED:'Exchange cancelled or unavailable', EXPIRED:'Offer expired' };
const indiaDate = () => new Date(Date.now()+330*60000).toISOString().slice(0,10);
export default function SwapScreen() {
  const [train,setTrain] = useState('');
  const [date,setDate] = useState(indiaDate);
  const [journey,setJourney] = useState<{train:string;date:string}>();
  const [snapshot,setSnapshot] = useState<Snapshot>({records:[],outbox:[],blocked:[],errors:{}});
  const [owner,setOwner] = useState('');
  const [status,setStatus] = useState<ConnectionStatus>({nearby:0,nearbyReady:false,cloud:false,message:''});
  const [busy,setBusy] = useState(false);
  const [coach,setCoach] = useState('');
  const [seat,setSeat] = useState('');
  const [from,setFrom] = useState('');
  const [to,setTo] = useState('');
  const [targetCoach,setTargetCoach] = useState('');
  const [travelClass,setClass] = useState<TravelClass>('SL');
  const [berth,setBerth] = useState<Berth>('UPPER');
  const [wanted,setWanted] = useState<Berth>('LOWER');
  const [rules,setRules] = useState(false);
  const connection = useRef<Awaited<ReturnType<typeof connect>> | null>(null);
  const refresh = useCallback(async () => {
    const ctx = await exchange(); setOwner(ctx.key.owner); setSnapshot(await ctx.store.snapshot());
  },[]);
  const run = async (fn: () => Promise<unknown>) => {
    if (busy) return; setBusy(true);
    try { await fn(); await refresh(); connection.current?.retry(); }
    catch (e) { Alert.alert('Please check',e instanceof Error ? e.message : 'The action failed. Please retry.'); }
    finally { setBusy(false); }
  };
  useFocusEffect(useCallback(() => {
    let alive = true;
    void (async () => {
      const ctx = await exchange();
      const s = await ctx.store.snapshot();
      if (!alive) return;
      setOwner(ctx.key.owner); setSnapshot(s);
      if (!journey) {
        const active = s.records.map(r => r.offer).find(o => o.owner === ctx.key.owner && o.expires > Date.now() && ['OPEN','ACCEPTED'].includes(o.state));
        if (active) { setTrain(active.train); setDate(active.date); setJourney({train:active.train,date:active.date}); }
        return;
      }
      const link = await connect(journey.train,journey.date,s => { if (alive) { setStatus(s); void refresh().catch(() => undefined); } });
      if (alive) connection.current = link; else await link.stop();
    })().catch(e => { if (alive) Alert.alert('Connection unavailable',e.message); });
    const timer = setInterval(() => { if (AppState.currentState === 'active') void refresh().catch(() => undefined); },5000);
    return () => { alive = false; clearInterval(timer); const link = connection.current; connection.current = null; void link?.stop().catch(() => undefined); };
  },[journey,refresh]));
  const offers = snapshot.records.map(r => r.offer).filter(o => o.train === journey?.train && o.date === journey?.date);
  const mine = offers.filter(o => o.owner === owner).sort((a,b) => b.created-a.created)[0];
  const partner = mine && offers.find(o => o.id === mine.partner);
  const state = mine ? exchangeState(mine,partner) : null;
  const active = mine && !['FAILED','EXPIRED','COMPLETED'].includes(state!);
  const matches = mine ? offers.filter(o => !snapshot.blocked.includes(o.owner) && compatible(mine,o) && o.expires > Date.now() &&
    (o.state === 'OPEN' || (o.state === 'ACCEPTED' && o.partner === mine.id))) : [];
  const button = (label: string,fn: () => void,disabled = busy) => <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled} onPress={fn} style={[styles.button,disabled && {opacity:0.5}]}><Text style={styles.buttonText}>{label}</Text></Pressable>;
  const field = (label: string,value: string,set: (x:string)=>void,maxLength:number,numeric=false) => <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} value={value} onChangeText={v => set(v.toUpperCase())} maxLength={maxLength} autoCapitalize="characters" autoCorrect={false} keyboardType={numeric ? 'number-pad':'default'} style={styles.input}/></View>;
  const choice = <T extends string,>(title:string,options:readonly T[],value:T,set:(v:T)=>void) => <View><Text style={styles.label}>{title}</Text><View style={styles.choices}>{options.map(o => <Pressable key={o} accessibilityRole="radio" accessibilityState={{checked:value===o}} accessibilityLabel={title+': '+o.replace(/_/g,' ')} onPress={() => set(o)} style={[styles.chip,value===o && styles.selected]}><Text style={{color:value===o?'#fff':'#28313D'}}>{o.replace(/_/g,' ')}</Text></Pressable>)}</View></View>;
  async function post() {
    if (!journey || !rules) throw new Error('Join a journey and agree to the usage rules first.');
    const ctx = await exchange();
    await ctx.store.create({id:await ctx.key.newId(),train:journey.train,date:journey.date,coach,seat:Number(seat),berth,wanted,travelClass,from,to,targetCoach});
  }
  function accept(other: Offer) {
    Alert.alert('Confirm your consent',`Exchange ${mine!.coach}/${mine!.seat} with ${other.coach}/${other.seat}? Verify tickets and agree in person. Your partner must also accept in their app.`,[
      {text:'Not now',style:'cancel'},{text:'I agree',onPress:() => { void run(async () => (await exchange()).store.act(mine!.id,'ACCEPT',other.id)); }},
    ]);
  }
  return <SafeAreaView style={styles.safe}><KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
    {button('Back',() => router.back(),false)}
    <Text accessibilityRole="header" style={styles.title}>Find a seat exchange</Text>
    <Text style={styles.copy}>Two passengers. Two independent confirmations. Keep this screen open on both phones; there are no background alerts.</Text>
    <View style={styles.card}>
      <Text style={styles.heading}>Your train service</Text>
      {field('Train number (5 digits)',train,setTrain,5,true)}
      {field('Service start date (YYYY-MM-DD)',date,setDate,10)}
      <Text style={styles.copy}>Use the date the train starts its service, including when you board after midnight.</Text>
      {button('Join journey',() => {
        if (!/^\d{5}$/.test(train) || !calendarDate(date)) { Alert.alert('Invalid journey','Enter a 5-digit train number and a real YYYY-MM-DD date.'); return; }
        if (active && (mine.train!==train || mine.date!==date)) { Alert.alert('Active offer','Cancel your offer before changing journeys.'); return; }
        setJourney({train,date});
      })}
    </View>
    {journey && <>
      <View style={styles.card}>
        <Text style={styles.heading}>{journey.train} · {journey.date}</Text>
        <Text style={styles.copy}>Nearby connections: {status.nearby} · {status.nearbyReady?'Radio ready':'Radio unavailable'}</Text>
        <Text style={styles.copy}>Cloud: {status.cloud?'Connected':'Not connected'} · Pending cloud updates: {snapshot.outbox.length}</Text>
        {!!status.message && <Text accessibilityLiveRegion="polite" style={styles.warning}>{status.message}</Text>}
        {!!status.nearbyMessage && <Text style={styles.warning}>{status.nearbyMessage}</Text>}
        <Text style={styles.copy}>Nearby discovery uses Bluetooth/Wi-Fi and requires location/nearby permissions. This release does not read or upload GPS coordinates. Offline exchange needs another compatible nearby app user.</Text>
        {button('Retry sync',() => connection.current?.retry())}
      </View>
      {mine && <View style={styles.card}>
        <Text style={styles.heading}>Your offer: {mine.coach} / {mine.seat}</Text>
        <Text accessibilityLiveRegion="polite" style={styles.heading}>{labels[state!]}</Text>
        <Text style={styles.copy}>{mine.travelClass} · {mine.from} → {mine.to} · {mine.berth.replace(/_/g,' ')} → {mine.wanted.replace(/_/g,' ')}</Text>
        {!!partner && <Text style={styles.copy}>Passenger: {partner.coach} / {partner.seat}. Verify their ticket and the permitted exchange before moving.</Text>}
        {!!partner && button('Block this passenger',() => { void run(async () => {
          if (mine.state==='ACCEPTED') await (await exchange()).store.act(mine.id,'CANCEL');
          const sent = await reportAndBlock(partner.owner);
          Alert.alert('Passenger blocked',sent?'Report submitted.':'Report could not be sent; contact support when online.');
        }); })}
        {!!snapshot.errors[mine.id] && <Text style={styles.warning}>Cloud has not confirmed this update: {snapshot.errors[mine.id]}</Text>}
        {(state==='BOTH_ACCEPTED' || state==='COMPLETING') && mine.state!=='COMPLETED' && button('Confirm exchange completed',() => { void run(async () => (await exchange()).store.act(mine.id,'COMPLETE')); })}
        {!['CANCELLED','COMPLETED'].includes(mine.state) && button('Cancel / decline / report a problem',() => Alert.alert('Cancel this offer?','Both phones will see cancellation after their next successful sync. You can create a new offer afterwards.',[{text:'Keep offer',style:'cancel'},{text:'Cancel offer',style:'destructive',onPress:() => { void run(async () => (await exchange()).store.act(mine.id,'CANCEL')); }}]))}
        {state==='WAITING' && <Text style={styles.copy}>The passenger must open their matching offer and tap “I agree”. Until then, this is only a request, not a completed swap.</Text>}
      </View>}
      {!active && <View style={styles.card}>
        <Text style={styles.heading}>Post your own ticketed seat</Text>
        {choice('Travel class',CLASSES,travelClass,setClass)}
        {field('Coach (for example S1, B2, A1, M1)',coach,setCoach,3)}
        {field('Seat number',seat,setSeat,2,true)}
        {choice('Current berth',BERTHS,berth,setBerth)}
        {choice('Wanted berth',BERTHS,wanted,setWanted)}
        {field('Boarding station code',from,setFrom,5)}
        {field('Destination station code',to,setTo,5)}
        {field('Preferred coach (optional)',targetCoach,setTargetCoach,3)}
        <Text style={styles.copy}>V1 supports SL, 3A, 3E and 2A, and matches identical boarding/destination segments only. Seat details are self-reported, not railway-verified. Same-berth swaps are allowed.</Text>
        <Pressable accessibilityRole="checkbox" accessibilityState={{checked:rules}} onPress={() => setRules(!rules)} style={styles.chip}><Text>{rules?'☑':'☐'} I own this ticketed seat, will not post fake offers or abuse passengers, and accept the terms and privacy policy.</Text></Pressable>
        {button('Read terms',() => router.push('/terms'),false)}
        {button('Read privacy policy',() => router.push('/privacy'),false)}
        {button('Post offer',() => { void run(post); },busy || !rules)}
      </View>}
      {mine?.state==='OPEN' && <View style={styles.card}>
        <Text style={styles.heading}>Compatible passengers</Text>
        {matches.length===0 && <Text style={styles.copy}>No compatible passengers found. Ask another willing passenger to open RailMitra and join the same train service/date. Both ticket segments and berth preferences must match.</Text>}
        {matches.map(other => <View key={other.id} style={styles.match}>
          <Text style={styles.heading}>{other.coach} / {other.seat} · {other.berth.replace(/_/g,' ')}</Text>
          <Text style={styles.copy}>{other.partner===mine.id?'This passenger has requested your seat. Your independent consent is required.':'Offer available'}</Text>
          {button('Agree to this exchange',() => accept(other))}
          {button('Report / block passenger',() => { void run(async () => {
            const sent = await reportAndBlock(other.owner);
            Alert.alert('Passenger blocked',sent?'Your report was sent for review.':'Blocked on this phone. The report could not be sent; retry when online through support.');
          }); })}
        </View>)}
      </View>}
    </>}
    <Text style={styles.copy}>RailMitra does not modify your official reservation and is not affiliated with Indian Railways or IRCTC. Follow railway staff instructions. No payments or free-text chat are supported.</Text>
  </ScrollView></KeyboardAvoidingView></SafeAreaView>;
}
const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#FFF8F3'},content:{padding:20,gap:16,paddingBottom:40},title:{fontSize:28,fontWeight:'700',color:'#28313D'},
  heading:{fontSize:19,fontWeight:'700',color:'#28313D'},copy:{fontSize:16,lineHeight:24,color:'#475569'},
  card:{backgroundColor:'#fff',padding:18,borderRadius:16,gap:14,borderWidth:1,borderColor:'#E6DCD5'},
  label:{fontSize:16,fontWeight:'600',color:'#28313D',marginBottom:8},field:{gap:2},
  input:{minHeight:48,borderWidth:1,borderColor:'#667085',borderRadius:8,padding:12,fontSize:17,color:'#28313D'},
  button:{minHeight:48,padding:14,borderRadius:10,backgroundColor:'#A83D16',justifyContent:'center'},buttonText:{fontSize:16,fontWeight:'600',color:'#fff',textAlign:'center'},
  choices:{flexDirection:'row',flexWrap:'wrap',gap:8},chip:{minHeight:48,padding:12,borderWidth:1,borderColor:'#667085',borderRadius:8,justifyContent:'center'},selected:{backgroundColor:'#A83D16'},
  warning:{fontSize:16,color:'#9C241C'},match:{gap:10,borderTopWidth:1,borderTopColor:'#E6DCD5',paddingTop:14},
});
