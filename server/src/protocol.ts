/** RailMitra wire protocol v2. Shared verbatim by mobile and server.
 * A signature proves installation ownership, NOT ticket ownership.
 * Each installation can consent only for its own immutable offer.
 */
import nacl from 'tweetnacl';

export const BERTHS = ['LOWER', 'MIDDLE', 'UPPER', 'SIDE_LOWER', 'SIDE_UPPER'] as const;
export const CLASSES = ['SL', '3A', '3E', '2A'] as const;
export type Berth = typeof BERTHS[number];
export type TravelClass = typeof CLASSES[number];
export type OfferState = 'OPEN' | 'ACCEPTED' | 'COMPLETED' | 'CANCELLED';
export interface Offer {
  version: 2; id: string; owner: string; train: string; date: string;
  coach: string; seat: number; berth: Berth; wanted: Berth; travelClass: TravelClass;
  from: string; to: string; targetCoach: string;
  created: number; expires: number; revision: number; state: OfferState; partner: string;
}
export interface SignedOffer { offer: Offer; signature: string }
export interface Control { version: 2; owner: string; action: 'DELETE' | 'REPORT'; target: string; at: number }
export interface SignedControl { control: Control; signature: string }
export const RETENTION = 24 * 60 * 60 * 1000;
export const TTL = 6 * 60 * 60 * 1000;
export const CAPACITY = 200;
const OWNER = /^[a-f0-9]{64}$/;
const ID = /^[a-f0-9]{64}:[a-f0-9]{32}$/;
const COACH = /^(S|B|A|M)[1-9][0-9]?$/;
const STATION = /^[A-Z]{2,5}$/;
const fields = ['version','id','owner','train','date','coach','seat','berth','wanted','travelClass','from','to','targetCoach','created','expires','revision','state','partner'];
export const hex = (bytes: Uint8Array): string => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
export const unhex = (value: string): Uint8Array => Uint8Array.from(value.match(/../g) || [], b => parseInt(b, 16));
// Only validated ASCII primitive fields are allowed on the wire. No platform UTF-8 dependency.
export function canonical(value: object): Uint8Array {
  const sorted = Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
  return Uint8Array.from(JSON.stringify(sorted), c => c.charCodeAt(0));
}
export function calendarDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;
}
export function validOffer(o: any, now = Date.now()): o is Offer {
  if (!o || typeof o !== 'object' || Object.keys(o).length !== fields.length || fields.some(f => !(f in o))) return false;
  if (fields.filter(f => !['version','seat','created','expires','revision'].includes(f)).some(f => typeof o[f] !== 'string' || !/^[\x20-\x7e]*$/.test(o[f]))) return false;
  if (o.version !== 2 || typeof o.id !== 'string' || !ID.test(o.id) || !OWNER.test(o.owner) || !o.id.startsWith(o.owner + ':')) return false;
  if (!/^\d{5}$/.test(o.train) || !calendarDate(o.date) || !COACH.test(o.coach) || !CLASSES.includes(o.travelClass)) return false;
  const prefix: Record<TravelClass, string> = { SL:'S', '3A':'B', '3E':'M', '2A':'A' };
  if (!o.coach.startsWith(prefix[o.travelClass as TravelClass])) return false;
  const max = o.travelClass === '2A' ? 54 : o.travelClass === '3E' ? 83 : 80;
  if (!Number.isInteger(o.seat) || o.seat < 1 || o.seat > max || !BERTHS.includes(o.berth) || !BERTHS.includes(o.wanted)) return false;
  if (o.travelClass === '2A' && (o.berth === 'MIDDLE' || o.wanted === 'MIDDLE')) return false;
  if (!STATION.test(o.from) || !STATION.test(o.to) || o.from === o.to || typeof o.targetCoach !== 'string') return false;
  if (o.targetCoach && (!COACH.test(o.targetCoach) || !o.targetCoach.startsWith(prefix[o.travelClass as TravelClass]))) return false;
  if (![o.created, o.expires].every(Number.isSafeInteger) || o.created > now + 60000 || o.created < now - RETENTION || o.expires !== o.created + TTL) return false;
  // Service date is explicitly entered: allow overnight services started up to two days earlier.
  const day = Date.parse(o.date);
  if (day < o.created - 3 * RETENTION || day > o.created + 8 * RETENTION) return false;
  if (!['OPEN','ACCEPTED','COMPLETED','CANCELLED'].includes(o.state)) return false;
  if (!Number.isInteger(o.revision) || o.revision < 1 || o.revision > 4 || typeof o.partner !== 'string') return false;
  if (o.state === 'OPEN') return o.revision === 1 && o.partner === '';
  if (o.state === 'CANCELLED') return o.revision >= 2 && (o.partner === '' || (ID.test(o.partner) && !o.partner.startsWith(o.owner + ':')));
  return ID.test(o.partner) && !o.partner.startsWith(o.owner + ':') && o.revision === (o.state === 'ACCEPTED' ? 2 : 3);
}
export function verifyOffer(value: any, now = Date.now()): value is SignedOffer {
  try {
    return value && Object.keys(value).length === 2 && validOffer(value.offer, now) &&
      typeof value.signature === 'string' && /^[a-f0-9]{128}$/.test(value.signature) &&
      nacl.sign.detached.verify(canonical(value.offer), unhex(value.signature), unhex(value.offer.owner));
  } catch { return false; }
}
export function signOffer(offer: Offer, secret: Uint8Array): SignedOffer {
  if (!validOffer(offer)) throw new Error('Invalid offer. Check service date, class, coach, seat and station codes.');
  return { offer, signature: hex(nacl.sign.detached(canonical(offer), secret)) };
}
export function verifyControl(value: any, now = Date.now()): value is SignedControl {
  try {
    const c = value.control;
    return Object.keys(value).length === 2 && Object.keys(c).length === 5 && c.version === 2 && OWNER.test(c.owner) &&
      ['DELETE','REPORT'].includes(c.action) && Number.isSafeInteger(c.at) && Math.abs(now - c.at) < 300000 &&
      (c.action === 'DELETE' ? c.target === c.owner : OWNER.test(c.target) && c.target !== c.owner) &&
      /^[a-f0-9]{128}$/.test(value.signature) && nacl.sign.detached.verify(canonical(c), unhex(value.signature), unhex(c.owner));
  } catch { return false; }
}
export function immutable(o: Offer): string {
  const { revision: _revision, state: _state, partner: _partner, ...identity } = o;
  return JSON.stringify(Array.from(canonical(identity)));
}
export function advances(previous: Offer, next: Offer): boolean {
  if (immutable(previous) !== immutable(next) || next.revision <= previous.revision) return false;
  if (previous.state === 'CANCELLED' || previous.state === 'COMPLETED') return false;
  if (previous.partner && previous.partner !== next.partner) return false;
  return next.state !== 'OPEN';
}
export function compatible(a: Offer, b: Offer): boolean {
  // Conservative V1: identical ticket segments guarantee overlap without an unverified timetable.
  return a.id !== b.id && a.owner !== b.owner && a.train === b.train && a.date === b.date &&
    a.travelClass === b.travelClass && a.from === b.from && a.to === b.to &&
    !(a.coach === b.coach && a.seat === b.seat) && a.wanted === b.berth && b.wanted === a.berth &&
    (!a.targetCoach || a.targetCoach === b.coach) && (!b.targetCoach || b.targetCoach === a.coach);
}
export type ExchangeState = 'OPEN' | 'WAITING' | 'BOTH_ACCEPTED' | 'COMPLETING' | 'COMPLETED' | 'FAILED' | 'EXPIRED';
export function exchangeState(a: Offer, b?: Offer, now = Date.now()): ExchangeState {
  if (a.state === 'CANCELLED') return 'FAILED';
  if (b && a.partner === b.id && (b.state === 'CANCELLED' || (b.partner && b.partner !== a.id))) return 'FAILED';
  if (b && compatible(a,b) && a.partner === b.id && b.partner === a.id && a.state === 'COMPLETED' && b.state === 'COMPLETED') return 'COMPLETED';
  if (a.expires <= now || (b && b.expires <= now)) return 'EXPIRED';
  if (a.state === 'OPEN') return 'OPEN';
  if (!b || !compatible(a,b) || b.partner !== a.id || b.state === 'OPEN') return 'WAITING';
  return a.state === 'COMPLETED' || b.state === 'COMPLETED' ? 'COMPLETING' : 'BOTH_ACCEPTED';
}
