import { CAPACITY, SignedOffer } from '../server/src/protocol';
import { ExchangeStore } from './exchangeStore';

export class HttpFailure extends Error { constructor(public status: number, message: string) { super(message); } }
export async function request(url: string, init: RequestInit = {}, fetcher: typeof fetch = fetch): Promise<any> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(),15000);
  try {
    const res = await fetcher(url,{ ...init,signal:abort.signal,headers:{'Content-Type':'application/json',...init.headers} });
    if (!res.ok) throw new HttpFailure(res.status,`Server returned ${res.status}. ${res.status < 500 && res.status !== 429 ? 'Check this offer or cancel it.' : 'Will retry.'}`);
    if (res.status === 204) return null;
    const text = await res.text();
    if (text.length > 512000) throw new Error('Server response too large');
    return JSON.parse(text);
  } finally { clearTimeout(timer); }
}
/** Injectable transport for deterministic HTTP failure and process-restart tests. */
export class CloudExchange {
  private active?: Promise<void>;
  constructor(private store: ExchangeStore, private url: string, private fetcher: typeof fetch = fetch) {}
  sync(train: string, date: string, retry = false): Promise<void> {
    if (this.active) return this.active;
    const run = async () => {
      if (!this.url) throw new Error('Cloud sync is not configured. Nearby exchange is still available.');
      // Download before uploads so competing accepts and cancellations are visible promptly.
      const data = await request(`${this.url}/api/v2/offers?train=${encodeURIComponent(train)}&date=${encodeURIComponent(date)}`,{},this.fetcher);
      if (data.protocol !== 2 || !Array.isArray(data.records) || data.records.length > CAPACITY) throw new Error('Incompatible server response');
      await this.store.merge(data.records);
      const snapshot = await this.store.snapshot();
      for (const id of snapshot.outbox) {
        if (snapshot.errors[id] && !retry) continue;
        const record = snapshot.records.find(r => r.offer.id === id);
        if (!record) continue;
        const proof: SignedOffer | undefined = snapshot.records.find(r => r.offer.id === record.offer.partner);
        try {
          const ack = await request(`${this.url}/api/v2/offers`,{method:'POST',body:JSON.stringify({record,proof})},this.fetcher);
          if (ack.id !== id || ack.revision !== record.offer.revision) throw new Error('Invalid server acknowledgment');
          await this.store.acknowledge(id,record.offer.revision);
        } catch (e) {
          if (e instanceof HttpFailure && e.status < 500 && e.status !== 429 && e.status !== 408) await this.store.failed(id,e.message);
          throw e;
        }
      }
    };
    this.active = run().finally(() => { this.active = undefined; });
    return this.active;
  }
  async idle() { await this.active?.catch(() => undefined); }
}
