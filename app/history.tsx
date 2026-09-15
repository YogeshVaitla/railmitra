import React, { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Paragraph, ReleasePage } from '../components/ReleasePage';
import { exchange } from '../services/exchange';
import { Offer } from '../server/src/protocol';
export default function History() {
  const [offers,setOffers] = useState<Offer[]>([]); const [error,setError] = useState('');
  useFocusEffect(useCallback(() => { let alive=true; void (async () => {const ctx=await exchange();const s=await ctx.store.snapshot();if(alive)setOffers(s.records.map(r=>r.offer).filter(o=>o.owner===ctx.key.owner));})().catch(e=>{if(alive)setError(e.message);});return()=>{alive=false;};},[]));
  return <ReleasePage title="My offer history"><Paragraph>History is kept on this phone for up to 24 hours. A passenger’s own accepted status does not establish mutual consent; check the exchange screen.</Paragraph>{!!error && <Paragraph>{error}</Paragraph>}{offers.length===0 && <Paragraph>No recent offers.</Paragraph>}{offers.map(o=><Paragraph key={o.id}>{o.train} · {o.date} · {o.coach}/{o.seat} · {o.state}</Paragraph>)}</ReleasePage>;
}
