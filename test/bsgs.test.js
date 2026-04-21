import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as secp from '@noble/secp256k1';
import { bsgs } from '../src/bsgs.js';
import { bigIntToPrivKey } from '../src/keygen.js';

test('BSGS menemukan kunci kecil yang diketahui', () => {
  const k = 12345n;
  const pub = Buffer.from(secp.getPublicKey(bigIntToPrivKey(k), true)).toString('hex');
  const res = bsgs(pub, '0x1', '0x10000', 1n << 8n);
  assert.equal(res.found, true);
  assert.equal(BigInt('0x' + res.privateKeyHex), k);
});

test('BSGS mengembalikan not-found jika di luar range', () => {
  const k = 50_000n;
  const pub = Buffer.from(secp.getPublicKey(bigIntToPrivKey(k), true)).toString('hex');
  const res = bsgs(pub, '0x1', '0x100', 1n << 4n);
  assert.equal(res.found, false);
});
