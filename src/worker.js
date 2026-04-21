import { parentPort, workerData } from 'node:worker_threads';
import * as secp from '@noble/secp256k1';
import {
  bigIntToPrivKey,
  pubKeyToHash160,
  privKeyToWIF,
  addressToHash160,
  bigIntToHex,
  bytesEq20,
} from './keygen.js';
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
const targetHash = addressToHash160(puzzle.address);
const checkUncompressed = addressMode !== 'compressed';
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

async function emit(msg) {
  parentPort.postMessage(msg);
  await new Promise((r) => setImmediate(r));
}

for (const k of gen) {
  const priv = bigIntToPrivKey(k);

  const hC = pubKeyToHash160(secp.getPublicKey(priv, true));
  let hit = bytesEq20(hC, targetHash) ? 'compressed' : null;
  if (!hit && checkUncompressed) {
    const hU = pubKeyToHash160(secp.getPublicKey(priv, false));
    if (bytesEq20(hU, targetHash)) hit = 'uncompressed';
  }

  if (hit) {
    await emit({
      type: 'found',
      workerId,
      privateKeyHex: bigIntToHex(k),
      wif: privKeyToWIF(priv, hit === 'compressed'),
      address: puzzle.address,
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
