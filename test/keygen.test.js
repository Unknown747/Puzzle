import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bigIntToPrivKey,
  privKeyToAddress,
  privKeyToWIF,
  deriveBoth,
  bigIntToHex,
} from '../src/keygen.js';

test('puzzle #1: privkey 0x1 → address terkenal', () => {
  const priv = bigIntToPrivKey(1n);
  const both = deriveBoth(priv);
  assert.equal(both.uncompressed.address, '1EHNa6Q4Jz2uvNExL497mE43ikXhwF6kZm');
  assert.equal(both.compressed.address, '1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH');
});

test('WIF format valid (compressed/uncompressed berbeda)', () => {
  const priv = bigIntToPrivKey(1n);
  const wifC = privKeyToWIF(priv, true);
  const wifU = privKeyToWIF(priv, false);
  assert.notEqual(wifC, wifU);
  assert.match(wifC, /^[KL]/);
  assert.match(wifU, /^5/);
});

test('range puzzle #5 mengandung kunci yang menghasilkan target address', () => {
  const target = '1E6NuFjCi27W5zoXg8TRdcSRq84zJeBW3k';
  let found = null;
  for (let k = 0x10n; k <= 0x1fn; k++) {
    const priv = bigIntToPrivKey(k);
    const { compressed, uncompressed } = deriveBoth(priv);
    if (compressed.address === target || uncompressed.address === target) {
      found = bigIntToHex(k);
      break;
    }
  }
  assert.ok(found, 'Harus menemukan key dalam range puzzle #5');
});

test('bigIntToHex menghasilkan 64 hex char', () => {
  assert.equal(bigIntToHex(1n).length, 64);
  assert.equal(bigIntToHex(0xffffn).length, 64);
});

test('privKeyToAddress idempoten', () => {
  const priv = bigIntToPrivKey(12345n);
  const a1 = privKeyToAddress(priv, true);
  const a2 = privKeyToAddress(priv, true);
  assert.equal(a1, a2);
});
