import nacl from 'tweetnacl';
import { advances, canonical, compatible, exchangeState, hex, Offer, signOffer, TTL, verifyControl, verifyOffer } from '../server/src/protocol';
import { ExchangeStore } from '../services/exchangeStore';
import { CloudExchange } from '../services/exchangeSync';

function phone(seed: number) {
  const keys = nacl.sign.keyPair.fromSeed(new Uint8Array(32).fill(seed));
  const owner = hex(keys.publicKey);
  let disk: string | null = null;
  const persistence = {read:async () => disk,write:async (v:string) => {disk=v;}};
  const signer = (o:Offer) => signOffer(o,keys.secretKey);
  return {owner,keys,store:new ExchangeStore(persistence,owner,signer),restart:()=>new ExchangeStore(persistence,owner,signer)};
}
function input(p: ReturnType<typeof phone>, extra: Partial<Offer> = {}) {
  return { id:p.owner+':'+ 'a'.repeat(32),train:'12345',date:new Date().toISOString().slice(0,10),coach:'S1',seat:1,berth:'LOWER' as const,wanted:'UPPER' as const,travelClass:'SL' as const,from:'HYB',to:'VSKP',targetCoach:'',...extra } as Omit<Offer,'version'|'owner'|'created'|'expires'|'revision'|'state'|'partner'>;
}
async function pair() {
  const a=phone(1),b=phone(2);
  const ao=await a.store.create(input(a));
  const bo=await b.store.create(input(b,{coach:'S2',seat:5,berth:'UPPER',wanted:'LOWER'}));
  await a.store.merge([bo]); await b.store.merge([ao]);
  return {a,b,ao,bo};
}
describe('authenticated two-phone protocol',() => {
  test('independent acceptance and completion propagate across isolated stores',async () => {
    const {a,b,ao,bo}=await pair();
    const aYes=await a.store.act(ao.offer.id,'ACCEPT',bo.offer.id);
    expect(exchangeState(aYes.offer,bo.offer)).toBe('WAITING');
    await expect(a.store.act(ao.offer.id,'COMPLETE')).rejects.toThrow('Both passengers');
    await b.store.merge([aYes]);
    const bYes=await b.store.act(bo.offer.id,'ACCEPT',ao.offer.id);
    await a.store.merge([bYes]);
    expect(exchangeState(aYes.offer,bYes.offer)).toBe('BOTH_ACCEPTED');
    const aDone=await a.store.act(ao.offer.id,'COMPLETE');
    await b.store.merge([aDone]);
    expect(exchangeState(bYes.offer,aDone.offer)).toBe('COMPLETING');
    const bDone=await b.store.act(bo.offer.id,'COMPLETE');
    await a.store.merge([bDone]);
    expect(exchangeState(aDone.offer,bDone.offer)).toBe('COMPLETED');
    expect(exchangeState(bDone.offer,aDone.offer)).toBe('COMPLETED');
  });
  test('forged ownership, tampering and malformed inputs are rejected',async () => {
    const {ao,b}=await pair();
    expect(verifyOffer(ao)).toBe(true);
    expect(verifyOffer({...ao,offer:{...ao.offer,seat:22}})).toBe(false);
    const forged={...ao,signature:hex(nacl.sign.detached(canonical(ao.offer),b.keys.secretKey))};
    expect(verifyOffer(forged)).toBe(false);
    for(const change of [{date:'2026-02-30'},{train:12345},{created:Infinity},{seat:-1},{travelClass:'1A'},{extra:'junk'},{partner:'p2p_fake',state:'ACCEPTED'},{coach:'B1'}]) {
      expect(verifyOffer({...ao,offer:{...ao.offer,...change}})).toBe(false);
    }
    await expect(b.store.act(ao.offer.id,'CANCEL')).rejects.toThrow('own');
  });
  test('cancellation is a tombstone even when it arrives before creation and after process restart',async () => {
    const {a,b,ao}=await pair();
    const cancel=await a.store.act(ao.offer.id,'CANCEL');
    const c=phone(3);await c.store.merge([cancel]);
    const restarted=c.restart();await restarted.merge([ao,cancel]);
    expect((await restarted.snapshot()).records[0].offer.state).toBe('CANCELLED');
    await expect(a.store.act(ao.offer.id,'ACCEPT',(await b.store.snapshot()).records[0].offer.id)).rejects.toThrow('final');
    expect(advances(cancel.offer,{...ao.offer,revision:4})).toBe(false);
  });
  test('competing accepts cannot change an installation consent to another partner',async () => {
    const {a,ao,bo}=await pair();const c=phone(3);
    const co=await c.store.create(input(c,{coach:'S3',seat:9,berth:'UPPER',wanted:'LOWER'}));await a.store.merge([co]);
    const results=await Promise.allSettled([a.store.act(ao.offer.id,'ACCEPT',bo.offer.id),a.store.act(ao.offer.id,'ACCEPT',co.offer.id)]);
    expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
  });
  test('same class, service and identical ticket segments are mandatory; same-berth coach swaps work',async () => {
    const {ao,bo}=await pair();
    expect(compatible(ao.offer,bo.offer)).toBe(true);
    for(const change of [{travelClass:'3A'},{from:'BZA'},{to:'SC'},{date:'2026-09-20'},{train:'99999'},{coach:'S1',seat:1}]) expect(compatible(ao.offer,{...bo.offer,...change} as Offer)).toBe(false);
    const a={...ao.offer,wanted:'LOWER' as const,targetCoach:'S2'};
    const b={...bo.offer,berth:'LOWER' as const,wanted:'LOWER' as const};
    expect(compatible(a,b)).toBe(true);
    expect(compatible({...a,targetCoach:'S3'},b)).toBe(false);
  });
  test('an in-flight acknowledgment cannot erase a newer queued cancellation',async () => {
    const {a,ao}=await pair();await a.store.act(ao.offer.id,'CANCEL');
    await a.store.acknowledge(ao.offer.id,1);
    expect((await a.restart().snapshot()).outbox).toContain(ao.offer.id);
    await a.store.acknowledge(ao.offer.id,2);
    expect((await a.store.snapshot()).outbox).toHaveLength(0);
  });
  test('expired offers and stale controls fail closed',async () => {
    const {ao,a}=await pair();expect(exchangeState(ao.offer,undefined,Date.now()+TTL+1)).toBe('EXPIRED');
    const control={version:2 as const,owner:a.owner,action:'DELETE' as const,target:a.owner,at:Date.now()-600000};
    expect(verifyControl({control,signature:hex(nacl.sign.detached(canonical(control),a.keys.secretKey))})).toBe(false);
  });
  test('remote storage and queues are bounded, and deletion clears pending actions',async () => {
    const {a,ao}=await pair();
    await expect(a.store.merge(Array(201).fill(ao))).rejects.toThrow('Too many');
    await a.store.clear();expect(await a.restart().snapshot()).toEqual({records:[],outbox:[],blocked:[],errors:{}});
  });
});

describe('cloud HTTP and durable identities',() => {
  test('HTTP 500 keeps the signed mutation for retry, including after restart',async () => {
    const {a,ao}=await pair();
    const fetcher=jest.fn(async (_url:string,init:any) => init.method==='POST' ? new Response('{}',{status:500}) : new Response(JSON.stringify({protocol:2,records:[]})));
    await expect(new CloudExchange(a.store,'https://staging.invalid',fetcher as any).sync('12345',ao.offer.date)).rejects.toThrow('500');
    expect((await a.restart().snapshot()).outbox).toContain(ao.offer.id);
  });
  test('cancel before first upload sends a terminal canonical ID, never recreates OPEN',async () => {
    const {a,ao}=await pair();const cancel=await a.store.act(ao.offer.id,'CANCEL');
    const posted:any[]=[];
    const fetcher=jest.fn(async (_url:string,init:any) => {
      if(init.method==='POST'){const body=JSON.parse(init.body);posted.push(body);return new Response(JSON.stringify({id:body.record.offer.id,revision:body.record.offer.revision}));}
      return new Response(JSON.stringify({protocol:2,records:[]}));
    });
    await new CloudExchange(a.restart(),'https://staging.invalid',fetcher as any).sync('12345',ao.offer.date);
    expect(posted).toHaveLength(1);expect(posted[0].record).toEqual(cancel);
    expect((await a.store.snapshot()).outbox).toHaveLength(0);
  });
  test('polling merges own and cancelled remote records and preserves permanent failures visibly',async () => {
    const {a,b,ao,bo}=await pair();const cancel=await b.store.act(bo.offer.id,'CANCEL');
    const fetcher=jest.fn(async (_url:string,init:any) => init.method==='POST' ? new Response('{}',{status:409}) : new Response(JSON.stringify({protocol:2,records:[cancel,ao]})));
    const cloud=new CloudExchange(a.store,'https://staging.invalid',fetcher as any);
    await expect(cloud.sync('12345',ao.offer.date)).rejects.toThrow('409');
    const s=await a.store.snapshot();expect(s.records.find(r=>r.offer.id===bo.offer.id)?.offer.state).toBe('CANCELLED');
    expect(s.errors[ao.offer.id]).toContain('409');
  });
});
