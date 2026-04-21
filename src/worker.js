import { parentPort, workerData } from 'node:worker_threads';
import { bigIntToPrivKey, deriveBoth, bigIntToHex } from './keygen.js';
import { buildStrategy } from './strategies.js';

const { puzzle, workerId, workerCount, strategy, resumeFrom, reportEveryMs } = workerData;
const start = BigInt(puzzle.rangeStart);
const end = BigInt(puzzle.rangeEnd);
const target = puzzle.address;
const resume = resumeFrom ? BigInt(resumeFrom) : null;

const gen = buildStrategy(strategy, start, end, {
  workerId,
  workerCount,
  resumeFrom: resume,
});

let attempts = 0;
let lastKey = 0n;
const t0 = Date.now();
let lastReport = t0;
const interval = reportEveryMs ?? 500;

for (const k of gen) {
  const priv = bigIntToPrivKey(k);
  const { compressed, uncompressed } = deriveBoth(priv);

  if (compressed.address === target || uncompressed.address === target) {
    const match = compressed.address === target ? compressed : uncompressed;
    parentPort.postMessage({
      type: 'found',
      workerId,
      privateKeyHex: bigIntToHex(k),
      wif: match.wif,
      address: target,
      attempts,
    });
    process.exit(0);
  }

  attempts++;
  lastKey = k;

  const now = Date.now();
  if (now - lastReport >= interval) {
    parentPort.postMessage({
      type: 'progress',
      workerId,
      attempts,
      lastKey: lastKey.toString(),
      elapsedMs: now - t0,
    });
    lastReport = now;
  }
}

parentPort.postMessage({ type: 'exhausted', workerId, attempts, lastKey: lastKey.toString() });
