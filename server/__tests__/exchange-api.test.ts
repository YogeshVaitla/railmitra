import { PrismaClient } from '@prisma/client';
import nacl from 'tweetnacl';
import { Server } from 'http';
import { createApp } from '../src/app';
import { canonical, hex, Offer, signOffer, TTL } from '../src/protocol';

const url=process.env.TEST_DATABASE_URL;
// Never run deletion-based integration fixtures against a developer/production DB.
if(url && (!/^postgresql:\/\//.test(url) || !['localhost','127.0.0.1'].includes(new URL(url).hostname) || new URL(url).pathname!=='/railmitra_test')) throw new Error('TEST_DATABASE_URL must point to local railmitra_test');
const integration=url?describe:describe.skip;
integration('real PostgreSQL API transactions',()=>{
  let db:PrismaClient,server:Server,base:string;
  const key=(n:number)=>nacl.sign.keyPair.fromSeed(new Uint8Array(32).fill(n));
  function offer(n:number,overrides:Partial<Offer>={}){
    const owner=hex(key(n).publicKey);const created=Date.now();
    return signOffer({version:2,id:owner+':'+ 'a'.repeat(32),owner,train:'12345',date:new Date().toISOString().slice(0,10),coach:'S'+n,seat:n,berth:n===1?'LOWER':'UPPER',wanted:n===1?'UPPER':'LOWER',travelClass:'SL',from:'HYB',to:'VSKP',targetCoach:'',created,expires:created+TTL,revision:1,state:'OPEN',partner:'',...overrides},key(n).secretKey);
  }
  const post=(body:any,path='/api/v2/offers')=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  beforeAll(async()=>{db=new PrismaClient({datasources:{db:{url}}});await new Promise<void>(resolve=>{server=createApp(db).listen(0,'127.0.0.1',()=>resolve());});base='http://127.0.0.1:'+(server.address() as any).port;});
  beforeEach(async()=>{await db.exchangeOffer.deleteMany();await db.exchangeRevocation.deleteMany();await db.exchangeReport.deleteMany();});
  afterAll(async()=>{await new Promise<void>(resolve=>server.close(()=>resolve()));await db.$disconnect();});
  test('rejects unsigned mutations and unauthenticated diagnostics',async()=>{
    expect((await post({userId:'any',state:'COMPLETED'})).status).toBe(401);
    expect((await fetch(base+'/api/debug/swaps')).status).toBe(404);
    expect((await fetch(base+'/api/metrics')).status).toBe(403);
  });
  test('duplicate signed writes are idempotent despite JSONB key ordering; tombstone rejects replay',async()=>{
    const a=offer(1);expect((await post({record:a})).status).toBe(200);expect((await post({record:a})).status).toBe(200);
    const cancel=signOffer({...a.offer,state:'CANCELLED',revision:2},key(1).secretKey);
    expect((await post({record:cancel})).status).toBe(200);expect((await post({record:a})).status).toBe(409);
    const data=await (await fetch(base+'/api/v2/offers?train=12345&date='+a.offer.date)).json() as any;
    expect(data.records[0].offer.state).toBe('CANCELLED');
  });
  test('two competing writes cannot assign the same offer to different partners',async()=>{
    const a=offer(1),b=offer(2),c=offer(3);for(const record of [a,b,c])expect((await post({record})).status).toBe(200);
    const ab=signOffer({...a.offer,state:'ACCEPTED',revision:2,partner:b.offer.id},key(1).secretKey);
    const ac=signOffer({...a.offer,state:'ACCEPTED',revision:2,partner:c.offer.id},key(1).secretKey);
    const responses=await Promise.all([post({record:ab,proof:b}),post({record:ac,proof:c})]);
    expect(responses.filter(r=>r.status===200)).toHaveLength(1);
    expect(responses.some(r=>[409,503].includes(r.status))).toBe(true);
  });
  test('completion requires signed counterparty consent and survives offline-to-cloud snapshots',async()=>{
    const a=offer(1),b=offer(2);await post({record:a});await post({record:b});
    const done=signOffer({...a.offer,state:'COMPLETED',revision:3,partner:b.offer.id},key(1).secretKey);
    expect((await post({record:done,proof:b})).status).toBe(409);
    const bYes=signOffer({...b.offer,state:'ACCEPTED',revision:2,partner:a.offer.id},key(2).secretKey);
    expect((await post({record:done,proof:bYes})).status).toBe(200);
  });
  test('deletion is authenticated and prevents queued replay',async()=>{
    const a=offer(1);await post({record:a});
    const control={version:2,owner:a.offer.owner,action:'DELETE',target:a.offer.owner,at:Date.now()};
    expect((await post({control,signature:hex(nacl.sign.detached(canonical(control),key(2).secretKey))},'/api/v2/control')).status).toBe(401);
    expect((await post({control,signature:hex(nacl.sign.detached(canonical(control),key(1).secretKey))},'/api/v2/control')).status).toBe(204);
    expect((await post({record:a})).status).toBe(403);
    expect(await db.exchangeOffer.count()).toBe(0);
  });
});
