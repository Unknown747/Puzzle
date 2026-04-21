import * as bitcoin from 'bitcoinjs-lib';
import { ECPairFactory } from 'ecpair';
import * as ecc from 'tiny-secp256k1';
import crypto from 'crypto';

const ECPair = ECPairFactory(ecc);
const network = bitcoin.networks.bitcoin;

export function privateKeyToAddress(privKeyHex, compressed = true) {
  const padded = privKeyHex.padStart(64, '0');
  const buf = Buffer.from(padded, 'hex');
  const keyPair = ECPair.fromPrivateKey(buf, { network, compressed });
  const { address } = bitcoin.payments.p2pkh({
    pubkey: keyPair.publicKey,
    network,
  });
  return { address, wif: keyPair.toWIF() };
}

export function privateKeyToBothAddresses(privKeyHex) {
  return {
    compressed: privateKeyToAddress(privKeyHex, true),
    uncompressed: privateKeyToAddress(privKeyHex, false),
  };
}

export function randomBigIntInRange(start, end) {
  const range = end - start + 1n;
  const bytes = Math.ceil(range.toString(2).length / 8);
  let rnd;
  do {
    const buf = crypto.randomBytes(bytes);
    rnd = BigInt('0x' + buf.toString('hex'));
  } while (rnd >= range);
  return start + rnd;
}

export function* sequentialRange(start, end, step = 1n) {
  for (let k = start; k <= end; k += step) yield k;
}

export function* randomWalk(start, end, count = Infinity) {
  let i = 0;
  while (i < count) {
    yield randomBigIntInRange(start, end);
    i++;
  }
}

export function* stridedSearch(start, end, stride = 1024n, offset = 0n) {
  for (let k = start + offset; k <= end; k += stride) yield k;
}

export function* combinedStrategy(start, end, randomRatio = 0.5) {
  const span = end - start;
  let cursor = start;
  const stride = span > 1000000n ? span / 1000000n : 1n;
  while (true) {
    if (Math.random() < randomRatio) {
      yield randomBigIntInRange(start, end);
    } else {
      if (cursor > end) cursor = start;
      yield cursor;
      cursor += stride;
    }
  }
}

export function bigIntToHex(n) {
  return n.toString(16);
}
