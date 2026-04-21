import { parentPort, workerData } from 'node:worker_threads';
import { bigIntToPrivKey, privKeyToAddress, privKeyToWIF, bigIntToHex } from './keygen.js';
import { buildStrategy } from './strategies.js';

const {
  puzzle,
  workerId,
  workerCount,
  strategy,
  resumeFrom,
  reportEveryMs,
  addressMode,
} = workerData;

const start = BigInt(puzzle.rangeStart);
const end = BigInt(puzzle.rangeEnd);
const target = puzzle.address;
const resume = resumeFrom ? BigInt(resumeFrom) : null;
const checkUncompressed = addressMode !== 'compressed';

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

async function emit(msg) {
  parentPort.postMessage(msg);
  // give IPC a tick to flush before any process.exit
  await new Promise((r) => setImmediate(r));
}

for (const k of gen) {
  const priv = bigIntToPrivKey(k);

  const addrC = privKeyToAddress(priv, true);
  let hit = addrC === target ? 'compressed' : null;
  if (!hit && checkUncompressed) {
    if (privKeyToAddress(priv, false) === target) hit = 'uncompressed';
  }

  if (hit) {
    await emit({
      type: 'found',
      workerId,
      privateKeyHex: bigIntToHex(k),
      wif: privKeyToWIF(priv, hit === 'compressed'),
      address: target,
      addressMode: hit,
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

parentPort.postMessage({
  type: 'exhausted',
  workerId,
  attempts,
  lastKey: lastKey.toString(),
});
