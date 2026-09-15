import { Prisma, PrismaClient } from '@prisma/client';
import { timingSafeEqual } from 'crypto';
import express, { NextFunction, Request, Response } from 'express';
import rateLimit from 'express-rate-limit';
import { advances, calendarDate, canonical, CAPACITY, compatible, hex, RETENTION, SignedOffer, verifyControl, verifyOffer } from './protocol';

class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
const wrap = (fn: (req: Request,res: Response) => Promise<unknown>) => (req: Request,res: Response,next: NextFunction) => { void fn(req,res).catch(next); };
export function createApp(db: PrismaClient) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', Number(process.env.TRUST_PROXY_HOPS || 0));
  app.use(express.json({ limit:'8kb', strict:true }));
  app.use((_req,res,next) => { res.set({ 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff' }); next(); });
  app.use('/api',rateLimit({ windowMs:60000, limit:120, standardHeaders:'draft-7', legacyHeaders:false }));
  const writes = rateLimit({ windowMs:60000, limit:40, standardHeaders:'draft-7', legacyHeaders:false });
  const counts = { writes:0, rejected:0, failures:0 };
  const admin = (req: Request,res: Response,next: NextFunction) => {
    const expected = process.env.ADMIN_TOKEN || '';
    const got = req.get('authorization') || '';
    const want = 'Bearer ' + expected;
    if (expected.length < 32 || Buffer.byteLength(got) !== Buffer.byteLength(want) || !timingSafeEqual(Buffer.from(got),Buffer.from(want))) { res.sendStatus(403); return; }
    next();
  };
  app.get('/api/health',wrap(async (_req,res) => {
    await db.$queryRaw`SELECT 1`;
    res.json({ status:'ok', protocol:2, version:process.env.RENDER_GIT_COMMIT || process.env.RELEASE_SHA || 'development' });
  }));
  app.get('/api/metrics',admin,(_req,res) => { res.json(counts); });
  app.get('/api/admin/reports',admin,wrap(async (_req,res) => { res.json(await db.exchangeReport.findMany({ take:100, orderBy:{ created:'desc' } })); }));
  app.post('/api/admin/block',admin,writes,wrap(async (req,res) => {
    const owner = req.body.owner;
    if (typeof owner !== 'string' || !/^[a-f0-9]{64}$/.test(owner)) throw new HttpError(400,'Invalid installation');
    await db.$transaction([
      db.exchangeRevocation.upsert({ where:{owner}, create:{owner,expires:new Date(Date.now()+30*RETENTION)}, update:{expires:new Date(Date.now()+30*RETENTION)} }),
      db.exchangeOffer.deleteMany({ where:{owner} }),
    ]);
    res.sendStatus(204);
  }));
  app.get('/api/v2/offers',wrap(async (req,res) => {
    const { train, date } = req.query;
    if (typeof train !== 'string' || !/^\d{5}$/.test(train) || !calendarDate(date)) throw new HttpError(400,'Invalid train or service date');
    const records = await db.exchangeOffer.findMany({ where:{ train, date, created:{gt:new Date(Date.now()-RETENTION)} }, orderBy:{id:'asc'}, take:CAPACITY });
    res.json({ protocol:2, records:records.map(r => r.record) });
  }));
  app.post('/api/v2/offers',writes,wrap(async (req,res) => {
    const record: SignedOffer = req.body.record;
    if (!verifyOffer(record)) throw new HttpError(401,'Invalid signed offer');
    const o = record.offer;
    await db.$transaction(async tx => {
      if (await tx.exchangeRevocation.findFirst({where:{owner:o.owner,expires:{gt:new Date()}}})) throw new HttpError(403,'Installation removed or blocked');
      const existing = await tx.exchangeOffer.findUnique({where:{id:o.id}});
      if (existing) {
        const previous = existing.record as unknown as SignedOffer;
        if (hex(canonical(previous.offer)) === hex(canonical(o))) return;
        if (!advances(previous.offer,o)) throw new HttpError(409,'Stale or conflicting offer; cancel and create a new offer');
      }
      if (o.expires <= Date.now() && o.state !== 'CANCELLED') throw new HttpError(410,'Offer expired');
      if (['OPEN','ACCEPTED'].includes(o.state)) {
        const own = await tx.exchangeOffer.count({where:{owner:o.owner,id:{not:o.id},state:{in:['OPEN','ACCEPTED']},expires:{gt:new Date()}}});
        if (own) throw new HttpError(409,'An active offer already exists for this installation');
      }
      if (o.state === 'ACCEPTED' || o.state === 'COMPLETED') {
        const row = await tx.exchangeOffer.findUnique({where:{id:o.partner}});
        let proof = row ? row.record : req.body.proof;
        const supplied = req.body.proof;
        if (row && verifyOffer(supplied) && advances((row.record as unknown as SignedOffer).offer,supplied.offer)) proof = supplied;
        if (!verifyOffer(proof) || proof.offer.id !== o.partner || !compatible(o,proof.offer) || proof.offer.expires <= Date.now() ||
          proof.offer.state === 'CANCELLED' || (proof.offer.partner && proof.offer.partner !== o.id)) throw new HttpError(409,'Passenger is unavailable');
        if (o.state === 'COMPLETED' && (proof.offer.partner !== o.id || !['ACCEPTED','COMPLETED'].includes(proof.offer.state))) throw new HttpError(409,'Both passengers must accept');
        if (await tx.exchangeRevocation.findFirst({where:{owner:proof.offer.owner,expires:{gt:new Date()}}})) throw new HttpError(409,'Passenger is unavailable');
      }
      if (!existing && await tx.exchangeOffer.count({where:{train:o.train,date:o.date,created:{gt:new Date(Date.now()-RETENTION)}}}) >= CAPACITY) throw new HttpError(429,'Journey capacity reached');
      if (!existing && await tx.exchangeOffer.count() >= 20000) throw new HttpError(429,'Service capacity reached; try later');
      const data = { owner:o.owner,train:o.train,date:o.date,revision:o.revision,state:o.state,expires:new Date(o.expires),created:new Date(o.created),record:record as unknown as Prisma.InputJsonValue };
      await tx.exchangeOffer.upsert({where:{id:o.id},create:{id:o.id,...data},update:data});
    },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
    counts.writes++; res.json({id:o.id,revision:o.revision});
  }));
  app.post('/api/v2/control',writes,wrap(async (req,res) => {
    if (!verifyControl(req.body)) throw new HttpError(401,'Invalid signed control');
    const c = req.body.control;
    if (c.action === 'DELETE') {
      await db.$transaction([
        db.exchangeRevocation.upsert({where:{owner:c.owner},create:{owner:c.owner,expires:new Date(Date.now()+RETENTION)},update:{expires:new Date(Date.now()+RETENTION)}}),
        db.exchangeOffer.deleteMany({where:{owner:c.owner}}),
        db.exchangeReport.deleteMany({where:{OR:[{reporter:c.owner},{target:c.owner}]}}),
      ]);
    } else {
      if (await db.exchangeRevocation.findFirst({where:{owner:c.owner,expires:{gt:new Date()}}})) throw new HttpError(403,'Installation blocked');
      if (await db.exchangeReport.count() >= 20000) throw new HttpError(429,'Report capacity reached; contact support');
      const day = new Date(c.at).toISOString().slice(0,10);
      await db.exchangeReport.upsert({where:{reporter_target_day:{reporter:c.owner,target:c.target,day}},create:{reporter:c.owner,target:c.target,day},update:{}});
    }
    res.sendStatus(204);
  }));
  app.use((_req,res) => { res.status(404).json({error:'Route unavailable; use protocol v2'}); });
  app.use((err: any,_req: Request,res: Response,_next: NextFunction) => {
    const status = err.code === 'P2034' ? 503 : err instanceof HttpError ? err.status : err.status === 413 ? 413 : err instanceof SyntaxError ? 400 : 500;
    if (status >= 500) { counts.failures++; console.error('api_request_failed',status); } else counts.rejected++;
    res.status(status).json({error:err instanceof HttpError ? err.message : 'Request failed. Please retry.'});
  });
  return app;
}
