import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, NativeEventEmitter, NativeModules, PermissionsAndroid, Platform } from 'react-native';
import { deleteIdentity, identity } from './exchangeIdentity';
import { ExchangeStore } from './exchangeStore';
import { CloudExchange, request } from './exchangeSync';

const DATA = '@railmitra_exchange_v2';
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || '').replace(/\/$/,'');
if (API_URL && !/^https:\/\/[^/]+/.test(API_URL)) throw new Error('RailMitra API must use HTTPS');
let singleton: ReturnType<typeof initialize> | undefined;
async function initialize() {
  const key = await identity();
  const store = new ExchangeStore({read:() => AsyncStorage.getItem(DATA),write:value => AsyncStorage.setItem(DATA,value)},key.owner,key.sign);
  return { key,store,cloud:new CloudExchange(store,API_URL) };
}
export function exchange() { return singleton ??= initialize().catch(e => { singleton = undefined; throw e; }); }
export interface ConnectionStatus { nearby: number; nearbyReady: boolean; cloud: boolean; message: string; nearbyMessage?: string }
const native = Platform.OS === 'android' ? NativeModules.NearbyConnections : undefined;
let activeStop: (() => Promise<void>) | undefined;
let lifecycle: Promise<unknown> = Promise.resolve();

/** Lifetime is owned by the focused swap screen. Backgrounding stops radio and HTTP polling.
 * Signed records, not discovery names or endpoint IDs, authorize all incoming changes.
 */
export function connect(train: string,date: string,changed: (s: ConnectionStatus) => void) {
  const task = lifecycle.then(async () => { await activeStop?.(); return startConnection(train,date,changed); });
  lifecycle = task.catch(() => undefined);
  return task;
}
async function startConnection(train: string,date: string,changed: (s: ConnectionStatus) => void) {
  const ctx = await exchange();
  let stopped = false;
  let foreground = AppState.currentState === 'active';
  let running = false;
  let radioStarted = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let offset = 0;
  let retryDelay = 5000;
  let startup: Promise<void> | undefined;
  let stopping: Promise<void> | undefined;
  const peers = new Set<string>();
  const rates = new Map<string,{at:number,count:number}>();
  let status: ConnectionStatus = {nearby:0,nearbyReady:false,cloud:false,message:''};
  const subscriptions: {remove():void}[] = [];
  const notify = () => { if (!stopped) changed({...status,nearby:peers.size}); };
  async function announce() {
    if (!radioStarted || peers.size === 0) return;
    const s = await ctx.store.snapshot();
    const records = s.records.filter(r => r.offer.train === train && r.offer.date === date && !s.blocked.includes(r.offer.owner));
    for (let n = 0; n < Math.min(4,records.length); n++) {
      const record = records[(offset+n)%records.length];
      if (stopped || !foreground) return;
      await native.sendPayload(JSON.stringify({version:2,record}));
    }
    offset += 4;
  }
  async function startRadio() {
    if (!native || stopped || !foreground) return;
    const permissions = [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION];
    if (Number(Platform.Version) >= 31) permissions.push(PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,PermissionsAndroid.PERMISSIONS.BLUETOOTH_ADVERTISE,PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);
    if (Number(Platform.Version) >= 33) permissions.push(PermissionsAndroid.PERMISSIONS.NEARBY_WIFI_DEVICES);
    const result = await PermissionsAndroid.requestMultiple(permissions);
    if (permissions.some(p => result[p] !== PermissionsAndroid.RESULTS.GRANTED)) throw new Error('Nearby permission denied. Enable it in Android settings, or use cloud sync.');
    if (stopped || !foreground) return;
    const service = `railmitra_v2_${train}_${date}`;
    await native.startAdvertising('RailMitra',service);
    await native.startDiscovery(service);
    if (stopped || !foreground) { await native.stopAll(); return; }
    radioStarted = true; status.nearbyReady = true;
  }
  if (native) {
    const emitter = new NativeEventEmitter(native);
    subscriptions.push(emitter.addListener('onConnectionResult',(e: {endpointId:string;status:string}) => {
      if (e.status === 'CONNECTED') peers.add(e.endpointId); notify();
    }));
    subscriptions.push(emitter.addListener('onEndpointLost',(e: {endpointId:string}) => { peers.delete(e.endpointId); rates.delete(e.endpointId); notify(); }));
    subscriptions.push(emitter.addListener('onPayloadReceived',(e: {endpointId:string;data:string}) => {
      void (async () => {
        if (stopped || !foreground || typeof e.data !== 'string' || e.data.length > 4096) return;
        const rate = rates.get(e.endpointId) || {at:Date.now(),count:0};
        if (Date.now()-rate.at > 60000) { rate.at = Date.now(); rate.count = 0; }
        if (++rate.count > 120 || rates.size > 8) return;
        rates.set(e.endpointId,rate);
        const packet = JSON.parse(e.data);
        if (packet.version !== 2 || packet.record?.offer?.train !== train || packet.record?.offer?.date !== date) return;
        // Process locally first. A relay failure must not drop an already received update.
        const count = await ctx.store.merge([packet.record]);
        if (count) {
          notify();
          for (const endpoint of peers) if (endpoint !== e.endpointId) {
            try { await native.sendPayloadToEndpoint(endpoint,e.data); } catch { /* Periodic snapshots retry delivery. */ }
          }
        }
      })().catch(() => { /* Malformed peer packets never crash the foreground session. */ });
    }));
  }
  async function tick(retry = false) {
    if (running || stopped || !foreground) return;
    running = true;
    try {
      await announce().catch(() => { status.message = 'Nearby send failed; retrying.'; });
      await ctx.cloud.sync(train,date,retry);
      status.cloud = true; status.message = ''; retryDelay = 5000;
    } catch (e) {
      status.cloud = false; status.message = e instanceof Error ? e.message : 'Connection failed';
      retryDelay = Math.min(60000,retryDelay*2);
    } finally {
      running = false; notify();
      if (!stopped && foreground) timer = setTimeout(() => { void tick(); },retryDelay);
    }
  }
  async function pause() {
    if (timer) clearTimeout(timer);
    radioStarted = false; status.nearbyReady = false; status.cloud = false;
    peers.clear(); rates.clear();
    if (native) await native.stopAll();
    notify();
  }
  async function resume() {
    if (stopped || startup || radioStarted) return;
    startup = startRadio().catch(async e => {
      status.nearbyMessage = e.message;
      if (native) await native.stopAll().catch(() => undefined);
    });
    await startup; startup = undefined;
    notify(); void tick();
  }
  subscriptions.push(AppState.addEventListener('change',state => {
    foreground = state === 'active';
    if (foreground) void resume(); else void pause().catch(() => undefined);
  }));
  void resume();
  const stop = () => stopping ??= (async () => {
    stopped = true; subscriptions.forEach(s => s.remove());
    await startup; await pause(); await ctx.cloud.idle();
  })();
  activeStop = stop;
  return { retry: () => { if (timer) clearTimeout(timer); if (!radioStarted) void resume(); void tick(true); }, stop };
}

export async function reportAndBlock(owner: string): Promise<boolean> {
  const ctx = await exchange();
  await ctx.store.block(owner);
  if (!API_URL) return false;
  try { await request(`${API_URL}/api/v2/control`,{method:'POST',body:JSON.stringify(ctx.key.control('REPORT',owner))}); return true; }
  catch { return false; }
}
export async function eraseExchangeData() {
  await lifecycle; await activeStop?.(); activeStop = undefined;
  const ctx = await exchange();
  await ctx.cloud.idle();
  // Require cloud acknowledgment before discarding the key that authorizes remote deletion.
  if (API_URL) {
    await request(`${API_URL}/api/v2/control`,{method:'POST',body:JSON.stringify(ctx.key.control('DELETE'))});
  }
  await ctx.store.clear();
  const keys = await AsyncStorage.getAllKeys();
  await AsyncStorage.multiRemove(keys.filter(k => k.startsWith('@seatseeker_') || k.startsWith('@meshbridge_') || k.startsWith('@railmitra_')));
  await deleteIdentity(); singleton = undefined;
}
