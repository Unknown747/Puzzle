import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as ckpt from '../src/checkpoint.js';

test('checkpoint save → load round-trip', () => {
  const id = 99001;
  const data = {
    puzzle: id,
    address: 'test',
    strategy: 'stride',
    workers: 4,
    totalAttempts: 12345,
    workerLastKey: ['1', '2', '3', '4'],
    updatedAt: new Date().toISOString(),
  };
  ckpt.save(id, data);
  const loaded = ckpt.load(id);
  assert.deepEqual(loaded, data);
  ckpt.clear(id);
  assert.equal(ckpt.load(id), null);
});

test('checkpoint load mengembalikan null untuk file yang tidak ada', () => {
  assert.equal(ckpt.load(99999), null);
});

test('checkpoint clear aman jika file tidak ada', () => {
  assert.doesNotThrow(() => ckpt.clear(99998));
});

test.after(() => {
  // best-effort cleanup
  try { fs.rmSync('data/checkpoints/puzzle-99001.json'); } catch {}
});
