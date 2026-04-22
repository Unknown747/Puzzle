import * as secp from '@noble/secp256k1';
import { sha256 } from '@noble/hashes/sha256';
import { ripemd160 } from '@noble/hashes/ripemd160';
import { hmac } from '@noble/hashes/hmac';
import bs58check from 'bs58check';

secp.etc.hmacSha256Sync = (k, ...m) => hmac(sha256, k, secp.etc.concatBytes(...m));

const VERSION_P2PKH = 0x00;
const VERSION_WIF = 0x80;

export function bigIntToPrivKey(n, out = new Uint8Array(32)) {
  let x = n;
  for (let i = 31; i >= 0; i--) {
    out[i] = Number(x & 0xffn);
    x >>= 8n;
  }
  return out;
}

export function pubKeyToHash160(pubkey) {
  return ripemd160(sha256(pubkey));
}

export function hash160ToAddress(h160) {
  const payload = new Uint8Array(21);
  payload[0] = VERSION_P2PKH;
  payload.set(h160, 1);
  return bs58check.encode(payload);
}

export function addressToHash160(address) {
  const decoded = bs58check.decode(address);
  if (decoded.length !== 21) throw new Error(`Invalid address length: ${decoded.length}`);
  if (decoded[0] !== VERSION_P2PKH) throw new Error(`Unsupported address version: ${decoded[0]}`);
  return decoded.slice(1);
}

export function pubKeyToAddress(pubkey) {
  return hash160ToAddress(pubKeyToHash160(pubkey));
}

export function privKeyToAddress(priv, compressed = true) {
  return pubKeyToAddress(secp.getPublicKey(priv, compressed));
}

export function privKeyToWIF(priv, compressed = true) {
  const len = compressed ? 34 : 33;
  const out = new Uint8Array(len);
  out[0] = VERSION_WIF;
  out.set(priv, 1);
  if (compressed) out[33] = 0x01;
  return bs58check.encode(out);
}

export function deriveBoth(priv) {
  const pubC = secp.getPublicKey(priv, true);
  const pubU = secp.getPublicKey(priv, false);
  return {
    compressed: { address: pubKeyToAddress(pubC), wif: privKeyToWIF(priv, true) },
    uncompressed: { address: pubKeyToAddress(pubU), wif: privKeyToWIF(priv, false) },
  };
}

export function bigIntToHex(n) {
  return n.toString(16).padStart(64, '0');
}

export function bytesEq20(a, b) {
  for (let i = 0; i < 20; i++) if (a[i] !== b[i]) return false;
  return true;
}
