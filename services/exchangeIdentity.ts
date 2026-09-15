import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import nacl from 'tweetnacl';
import { canonical, Control, hex, Offer, signOffer, unhex } from '../server/src/protocol';

const KEY = 'railmitra.installation.v2';
let pending: ReturnType<typeof load> | undefined;
async function load() {
  let seed = await SecureStore.getItemAsync(KEY);
  if (!seed) {
    seed = hex(await Crypto.getRandomBytesAsync(32));
    await SecureStore.setItemAsync(KEY, seed, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  }
  if (!/^[a-f0-9]{64}$/.test(seed)) throw new Error('Installation key is damaged. Contact support before resetting.');
  const pair = nacl.sign.keyPair.fromSeed(unhex(seed));
  const owner = hex(pair.publicKey);
  return { owner,
    newId: async () => owner + ':' + hex(await Crypto.getRandomBytesAsync(16)),
    sign: (o: Offer) => signOffer(o,pair.secretKey),
    control: (action: Control['action'], target = owner) => {
      const control: Control = { version:2, owner, action, target, at:Date.now() };
      return { control, signature:hex(nacl.sign.detached(canonical(control),pair.secretKey)) };
    },
  };
}
export function identity() { return pending ??= load().catch(e => { pending = undefined; throw e; }); }
export async function deleteIdentity() { await SecureStore.deleteItemAsync(KEY); pending = undefined; }
