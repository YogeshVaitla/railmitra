import nacl from 'tweetnacl';
import { hex, signOffer, TTL } from '../server/src/protocol';

jest.mock('expo-crypto',()=>({getRandomBytesAsync:async(n:number)=>new Uint8Array(n).fill(8)}));
jest.mock('expo-secure-store',()=>({getItemAsync:async()=>null,setItemAsync:async()=>undefined,deleteItemAsync:async()=>undefined,WHEN_UNLOCKED_THIS_DEVICE_ONLY:1}));
jest.mock('react-native',()=>{
  const callbacks=new Map<string,Set<Function>>();
  const listen=(name:string,fn:Function)=>{if(!callbacks.has(name))callbacks.set(name,new Set());callbacks.get(name)!.add(fn);return{remove:()=>callbacks.get(name)!.delete(fn)};};
  const native={startAdvertising:jest.fn(async()=>true),startDiscovery:jest.fn(async()=>true),stopAll:jest.fn(async()=>true),sendPayload:jest.fn(async()=>true),sendPayloadToEndpoint:jest.fn(async()=>true)};
  return {
    Platform:{OS:'android',Version:35},
    NativeModules:{NearbyConnections:native},
    NativeEventEmitter:class { addListener(name:string,fn:Function){return listen(name,fn);} },
    PermissionsAndroid:{PERMISSIONS:{ACCESS_FINE_LOCATION:'fine',ACCESS_COARSE_LOCATION:'coarse',BLUETOOTH_SCAN:'scan',BLUETOOTH_ADVERTISE:'advertise',BLUETOOTH_CONNECT:'connect',NEARBY_WIFI_DEVICES:'wifi'},RESULTS:{GRANTED:'granted'},requestMultiple:jest.fn(async(p:string[])=>Object.fromEntries(p.map(x=>[x,'granted'])))},
    AppState:{currentState:'active',addEventListener:(_name:string,fn:Function)=>listen('appState',fn)},
    emit:async(name:string,data:any)=>{for(const fn of callbacks.get(name)||[])await fn(data);},
  };
});
const flush=async()=>{for(let i=0;i<100;i++)await Promise.resolve();};
test('three-phone relay failure still processes signed payload; callbacks survive background/reconnect',async()=>{
  jest.useFakeTimers();
  const rn=require('react-native');
  const {connect,exchange}=await import('../services/exchange');
  const updates=jest.fn();
  const link=await connect('12345',new Date().toISOString().slice(0,10),updates);await flush();
  await rn.emit('onConnectionResult',{endpointId:'phone-a',status:'CONNECTED'});
  await rn.emit('onConnectionResult',{endpointId:'phone-c',status:'CONNECTED'});
  rn.NativeModules.NearbyConnections.sendPayloadToEndpoint.mockRejectedValueOnce(new Error('relay unavailable'));
  const keys=nacl.sign.keyPair.fromSeed(new Uint8Array(32).fill(4));const owner=hex(keys.publicKey);const created=Date.now();
  const record=signOffer({version:2,id:owner+':'+ 'a'.repeat(32),owner,train:'12345',date:new Date().toISOString().slice(0,10),coach:'S1',seat:1,berth:'LOWER',wanted:'UPPER',travelClass:'SL',from:'HYB',to:'VSKP',targetCoach:'',created,expires:created+TTL,revision:1,state:'OPEN',partner:''},keys.secretKey);
  await rn.emit('onPayloadReceived',{endpointId:'phone-a',data:JSON.stringify({version:2,record})});await flush();
  const ctx=await exchange();expect((await ctx.store.snapshot()).records.some(r=>r.offer.id===record.offer.id)).toBe(true);
  expect(rn.NativeModules.NearbyConnections.sendPayloadToEndpoint).toHaveBeenCalledWith('phone-c',expect.any(String));
  await rn.emit('appState','background');await flush();await rn.emit('appState','active');await flush();
  const cancelled=signOffer({...record.offer,state:'CANCELLED',revision:2},keys.secretKey);
  await rn.emit('onPayloadReceived',{endpointId:'phone-a',data:JSON.stringify({version:2,record:cancelled})});await flush();
  expect((await ctx.store.snapshot()).records.find(r=>r.offer.id===record.offer.id)?.offer.state).toBe('CANCELLED');
  const count=updates.mock.calls.length;await link.stop();await rn.emit('onConnectionResult',{endpointId:'late',status:'CONNECTED'});expect(updates).toHaveBeenCalledTimes(count);
  jest.useRealTimers();
});
