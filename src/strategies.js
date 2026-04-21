import crypto from 'node:crypto';

export function randomBigIntInRange(start, end) {
  const range = end - start + 1n;
  const bytes = Math.ceil(range.toString(2).length / 8);
  let r;
  do {
    r = BigInt('0x' + crypto.randomBytes(bytes).toString('hex'));
  } while (r >= range);
  return start + r;
}

export function* sequential(start, end, step = 1n, from = null) {
  for (let k = from ?? start; k <= end; k += step) yield k;
}

export function* random(start, end) {
  while (true) yield randomBigIntInRange(start, end);
}

export function* stride(start, end, stride, offset = 0n) {
  for (let k = start + offset; k <= end; k += stride) yield k;
}

export function* combined(start, end, randomRatio = 0.5, from = null) {
  const span = end - start;
  const step = span > 1_000_000n ? span / 1_000_000n : 1n;
  let cursor = from ?? start;
  while (true) {
    if (Math.random() < randomRatio) {
      yield randomBigIntInRange(start, end);
    } else {
      if (cursor > end) cursor = start;
      yield cursor;
      cursor += step;
    }
  }
}

export function buildStrategy(name, start, end, opts = {}) {
  const { workerId = 0, workerCount = 1, resumeFrom = null } = opts;
  switch (name) {
    case 'random':
      return random(start, end);
    case 'sequential': {
      const span = end - start + 1n;
      const chunk = span / BigInt(workerCount);
      const wStart = start + chunk * BigInt(workerId);
      const wEnd = workerId === workerCount - 1 ? end : wStart + chunk - 1n;
      return sequential(wStart, wEnd, 1n, resumeFrom);
    }
    case 'stride':
      return stride(start, end, BigInt(workerCount), BigInt(workerId));
    case 'combined':
    default:
      return combined(start, end, 0.5, resumeFrom);
  }
}
