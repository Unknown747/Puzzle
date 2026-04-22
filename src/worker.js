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

const Point = secp.ProjectivePoint ?? secp.Point;

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
const interval = reportEveryMs ?? 500;

function emitFound(k, P, mode) {
  const priv = bigIntToPrivKey(k);
  parentPort.postMessage({
    type: 'found',
    workerId,
    privateKeyHex: bigIntToHex(k),
    wif: privKeyToWIF(priv, mode === 'compressed'),
    address: puzzle.address,
    addressMode: mode,
  });
}

function emitProgress(attempts, lastKey, t0) {
  parentPort.postMessage({
    type: 'progress',
    workerId,
    attempts,
    lastKey: lastKey.toString(),
    elapsedMs: Date.now() - t0,
  });
}

/**
 * Hot path for sequential & stride: incremental EC addition.
 * Compute P = k*G once, then P += step*G per iteration (cheap).
 * 10-50x faster than calling getPublicKey() per candidate.
 */
function runIncremental() {
  let firstK;
  let stepK;
  if (strategy === 'sequential') {
    const span = end - start + 1n;
    const chunk = span / BigInt(workerCount);
    const wStart = start + chunk * BigInt(workerId);
    const wEnd = workerId === workerCount - 1 ? end : wStart + chunk - 1n;
    firstK = resume ?? wStart;
    stepK = 1n;
    return loopIncremental(firstK, stepK, wEnd);
  }
  // stride
  firstK = resume ?? (start + BigInt(workerId));
  stepK = BigInt(workerCount);
  return loopIncremental(firstK, stepK, end);
}

function loopIncremental(firstK, stepK, lastK) {
  if (firstK > lastK) {
    parentPort.postMessage({ type: 'exhausted', workerId, attempts: 0, lastKey: '0' });
    return;
  }
  let P = Point.BASE.multiply(firstK);
  const stepP = stepK === 1n ? Point.BASE : Point.BASE.multiply(stepK);

  const t0 = Date.now();
  let lastReport = t0;
  let attempts = 0;
  let k = firstK;

  while (k <= lastK) {
    const pubC = P.toRawBytes(true);
    const hC = pubKeyToHash160(pubC);
    if (bytesEq20(hC, targetHash)) {
      emitFound(k, P, 'compressed');
      process.exit(0);
    }
    if (checkUncompressed) {
      const pubU = P.toRawBytes(false);
      const hU = pubKeyToHash160(pubU);
      if (bytesEq20(hU, targetHash)) {
        emitFound(k, P, 'uncompressed');
        process.exit(0);
      }
    }

    P = P.add(stepP);
    k += stepK;
    attempts++;

    const now = Date.now();
    if (now - lastReport >= interval) {
      emitProgress(attempts, k, t0);
      lastReport = now;
    }
  }
  parentPort.postMessage({
    type: 'exhausted',
    workerId,
    attempts,
    lastKey: k.toString(),
  });
}

/**
 * Slow path for random & combined: full scalar mult per candidate.
 * Reuses the privKey buffer to reduce GC pressure.
 */
function runGeneric() {
  const gen = buildStrategy(strategy, start, end, {
    workerId,
    workerCount,
    resumeFrom: resume,
  });
  const privBuf = new Uint8Array(32);
  const t0 = Date.now();
  let lastReport = t0;
  let attempts = 0;
  let lastKey = 0n;

  for (const k of gen) {
    bigIntToPrivKey(k, privBuf);

    const hC = pubKeyToHash160(secp.getPublicKey(privBuf, true));
    if (bytesEq20(hC, targetHash)) {
      emitFound(k, null, 'compressed');
      process.exit(0);
    }
    if (checkUncompressed) {
      const hU = pubKeyToHash160(secp.getPublicKey(privBuf, false));
      if (bytesEq20(hU, targetHash)) {
        emitFound(k, null, 'uncompressed');
        process.exit(0);
      }
    }

    attempts++;
    lastKey = k;

    const now = Date.now();
    if (now - lastReport >= interval) {
      emitProgress(attempts, lastKey, t0);
      lastReport = now;
    }
  }
  parentPort.postMessage({
    type: 'exhausted',
    workerId,
    attempts,
    lastKey: lastKey.toString(),
  });
}

if (strategy === 'sequential' || strategy === 'stride') {
  runIncremental();
} else {
  runGeneric();
}
