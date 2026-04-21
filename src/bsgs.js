import * as secp from '@noble/secp256k1';
import { bigIntToHex } from './keygen.js';

const Point = secp.ProjectivePoint ?? secp.Point;

function pointKey(P) {
  if (P.equals && P.equals(Point.ZERO)) return 'O';
  return P.toAffine().x.toString(16);
}

/**
 * Baby-step Giant-step solver: finds k such that k*G == target,
 * with k in [rangeStart, rangeEnd]. Memory ~mBaby points.
 */
export function bsgs(targetPubHex, rangeStart, rangeEnd, mBaby = 1n << 20n) {
  const target = Point.fromHex(targetPubHex);
  const start = BigInt(rangeStart);
  const end = BigInt(rangeEnd);
  const total = end - start + 1n;

  // Shift so we search k' in [0, total) where target' = target - start*G
  const shifted = start === 0n ? target : target.add(Point.BASE.multiply(start).negate());

  // Baby steps: store j -> j*G for j in [0, mBaby)
  const baby = new Map();
  let p = Point.ZERO;
  for (let j = 0n; j < mBaby; j++) {
    baby.set(pointKey(p), j);
    p = p.add(Point.BASE);
  }

  // Giant steps: subtract i*mBaby*G repeatedly, look for match
  const giantStep = Point.BASE.multiply(mBaby).negate();
  const giantCount = (total + mBaby - 1n) / mBaby;
  let acc = shifted;
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
