import { advances, CAPACITY, compatible, exchangeState, Offer, RETENTION, SignedOffer, TTL, verifyOffer } from '../server/src/protocol';

export interface Snapshot { records: SignedOffer[]; outbox: string[]; blocked: string[]; errors: Record<string,string> }
export interface Persistence { read(): Promise<string | null>; write(value: string): Promise<void> }
const empty = (): Snapshot => ({ records: [], outbox: [], blocked: [], errors: {} });

/** One durable write commits state and its outbox together. All operations share a mutex.
 * Full signed snapshots are idempotent; cancellation replaces any unsent creation.
 */
export class ExchangeStore {
  private tail: Promise<unknown> = Promise.resolve();
  constructor(private disk: Persistence, private owner: string, private sign: (o: Offer) => SignedOffer) {}
  private run<T>(fn: (s: Snapshot) => T | Promise<T>): Promise<T> {
    const work = this.tail.then(async () => {
      const raw = await this.disk.read();
      const s: Snapshot = raw ? JSON.parse(raw) : empty(); // Fail closed on corrupt storage; never silently reset identity/state.
      s.records = s.records.filter(r => r.offer.created > Date.now() - RETENTION);
      s.outbox = s.outbox.filter(id => s.records.some(r => r.offer.id === id));
      s.errors = Object.fromEntries(Object.entries(s.errors).filter(([id]) => s.outbox.includes(id)));
      const result = await fn(s);
      await this.disk.write(JSON.stringify(s));
      return result;
    });
    this.tail = work.catch(() => undefined);
    return work;
  }
  snapshot(): Promise<Snapshot> { return this.run(s => JSON.parse(JSON.stringify(s))); }
  create(input: Omit<Offer,'version'|'owner'|'created'|'expires'|'revision'|'state'|'partner'>): Promise<SignedOffer> {
    return this.run(s => {
      if (s.records.some(r => r.offer.owner === this.owner && r.offer.expires > Date.now() && ['OPEN','ACCEPTED'].includes(r.offer.state))) {
        throw new Error('Cancel your current offer before posting another.');
      }
      const now = Date.now();
      const record = this.sign({ ...input, version:2, owner:this.owner, created:now, expires:now+TTL, revision:1, state:'OPEN', partner:'' });
      if (s.records.length >= CAPACITY) throw new Error('Offer storage is full. Please try later.');
      s.records.push(record); s.outbox.push(record.offer.id);
      return record;
    });
  }
  act(id: string, action: 'ACCEPT'|'COMPLETE'|'CANCEL', partnerId = ''): Promise<SignedOffer> {
    return this.run(s => {
      const index = s.records.findIndex(r => r.offer.id === id && r.offer.owner === this.owner);
      if (index < 0) throw new Error('You do not own this offer.');
      const old = s.records[index].offer;
      const partner = s.records.find(r => r.offer.id === (partnerId || old.partner))?.offer;
      if (['CANCELLED','COMPLETED'].includes(old.state)) throw new Error('This offer is already final.');
      if (action !== 'CANCEL' && old.expires <= Date.now()) throw new Error('This offer has expired.');
      if (action === 'ACCEPT' && (!partner || old.state !== 'OPEN' || !compatible(old,partner) || partner.expires <= Date.now() ||
        s.blocked.includes(partner.owner) || partner.state === 'CANCELLED' || partner.state === 'COMPLETED' || (partner.partner && partner.partner !== old.id))) {
        throw new Error('This passenger is no longer available for this exchange.');
      }
      if (action === 'COMPLETE' && !['BOTH_ACCEPTED','COMPLETING'].includes(exchangeState(old,partner))) throw new Error('Both passengers must independently accept first.');
      const next = this.sign({ ...old, revision:old.revision+1,
        state:action === 'ACCEPT' ? 'ACCEPTED' : action === 'COMPLETE' ? 'COMPLETED' : 'CANCELLED',
        partner:action === 'ACCEPT' ? partnerId : old.partner });
      s.records[index] = next;
      if (!s.outbox.includes(id)) s.outbox.push(id);
      delete s.errors[id];
      return next;
    });
  }
  merge(incoming: unknown[]): Promise<number> {
    return this.run(async s => {
      if (incoming.length > CAPACITY) throw new Error('Too many incoming offers.');
      let changed = 0;
      let processed = 0;
      for (const value of incoming) {
        if (++processed % 8 === 0) await new Promise<void>(resolve => setTimeout(resolve,0));
        if (!verifyOffer(value) || s.blocked.includes(value.offer.owner)) continue;
        const index = s.records.findIndex(r => r.offer.id === value.offer.id);
        if (index >= 0) {
          if (advances(s.records[index].offer, value.offer)) { s.records[index] = value; changed++; }
        } else if (s.records.length < (value.offer.owner === this.owner ? CAPACITY : CAPACITY-20)) { s.records.push(value); changed++; }
      }
      return changed;
    });
  }
  acknowledge(id: string, revision: number): Promise<void> {
    return this.run(s => {
      // An in-flight OPEN acknowledgment must not erase a newer queued cancellation.
      if (s.records.find(r => r.offer.id === id)?.offer.revision === revision) {
        s.outbox = s.outbox.filter(x => x !== id); delete s.errors[id];
      }
    });
  }
  failed(id: string, message: string): Promise<void> { return this.run(s => { s.errors[id] = message.slice(0,160); }); }
  block(owner: string): Promise<void> {
    return this.run(s => {
      if (owner === this.owner) throw new Error('Cannot block your own installation.');
      if (!s.blocked.includes(owner)) {
        if (s.blocked.length >= CAPACITY) throw new Error('Block list is full.');
        s.blocked.push(owner);
      }
      // Keep signed terminal state for replay safety; only the UI hides blocked passengers.
    });
  }
  clear(): Promise<void> { return this.run(s => { Object.assign(s,empty()); }); }
}
