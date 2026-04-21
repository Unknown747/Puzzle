import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildStrategy, randomBigIntInRange } from '../src/strategies.js';

test('random tetap dalam range', () => {
  for (let i = 0; i < 1000; i++) {
    const r = randomBigIntInRange(100n, 200n);
    assert.ok(r >= 100n && r <= 200n);
  }
});

test('sequential strategy membagi range antar worker tanpa overlap', () => {
  const start = 0n, end = 99n, workerCount = 4;
  const seen = new Set();
  for (let w = 0; w < workerCount; w++) {
    const gen = buildStrategy('sequential', start, end, { workerId: w, workerCount });
    let count = 0;
    for (const k of gen) {
      assert.ok(!seen.has(k), `duplicate key ${k}`);
      seen.add(k);
      if (++count > 50) break;
    }
  }
  assert.equal(seen.size, 100);
});

test('stride strategy mencakup seluruh range tanpa overlap', () => {
  const start = 0n, end = 99n, workerCount = 5;
  const seen = new Set();
  for (let w = 0; w < workerCount; w++) {
    const gen = buildStrategy('stride', start, end, { workerId: w, workerCount });
    for (const k of gen) seen.add(k);
  }
  assert.equal(seen.size, 100);
});

test('combined strategy menghasilkan key dalam range', () => {
  const gen = buildStrategy('combined', 1000n, 2000n);
  let i = 0;
  for (const k of gen) {
    assert.ok(k >= 1000n && k <= 2000n);
    if (++i >= 200) break;
  }
});
