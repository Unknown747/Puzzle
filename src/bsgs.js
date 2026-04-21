import * as secp from '@noble/secp256k1';
import { bigIntToHex } from './keygen.js';

const { Point } = secp.ProjectivePoint
  ? { Point: secp.ProjectivePoint }
  : { Point: secp.Point };

function pointKey(P) {
  const a = P.toAffine();
  return a.x.toString(16);
}

export function bsgs(targetPubHex, rangeStart, rangeEnd, mBaby = 1n << 20n) {
  const target = Point.fromHex(targetPubHex);
  const start = BigInt(rangeStart);
  const end = BigInt(rangeEnd);

  const baseShift = Point.BASE.multiply(start === 0n ? 1n : start).negate();
  let cur = target.add(baseShift);
  if (start === 0n) cur = target;

  const baby = new Map();
  let p = Point.ZERO;
  for (let j = 0n; j < mBaby; j++) {
    baby.set(pointKey(p), j);
    p = p.add(Point.BASE);
  }

  const giantStep = Point.BASE.multiply(mBaby).negate();
  let acc = cur;
  const total = end - start + 1n;
  const giantCount = (total + mBaby - 1n) / mBaby;

  for (let i = 0n; i < giantCount; i++) {
    const j = baby.get(pointKey(acc));
    if (j !== undefined) {
      const k = start + i * mBaby + j;
      if (k >= start && k <= end) {
        return { found: true, privateKeyHex: bigIntToHex(k), k };
      }
    }
    acc = acc.add(giantStep);
  }
  return { found: false };
}
