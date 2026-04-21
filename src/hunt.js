import fs from 'fs';
import {
  privateKeyToBothAddresses,
  combinedStrategy,
  randomWalk,
  sequentialRange,
  bigIntToHex,
} from './keygen.js';

const STRATEGIES = {
  random: (s, e) => randomWalk(s, e),
  sequential: (s, e) => sequentialRange(s, e),
  combined: (s, e) => combinedStrategy(s, e, 0.5),
};

function loadPuzzles() {
  return JSON.parse(fs.readFileSync('data/puzzles.json', 'utf8'));
}

function appendFound(record) {
  const file = 'data/found.json';
  let arr = [];
  if (fs.existsSync(file)) arr = JSON.parse(fs.readFileSync(file, 'utf8'));
  arr.push(record);
  fs.writeFileSync(file, JSON.stringify(arr, null, 2));
}

export function huntPuzzle(puzzle, {
  strategy = 'combined',
  maxAttempts = 1_000_000,
  reportEvery = 50_000,
} = {}) {
  const start = BigInt(puzzle.rangeStart);
  const end = BigInt(puzzle.rangeEnd);
  const target = puzzle.address;
  const gen = STRATEGIES[strategy](start, end);

  console.log(`\n=== Puzzle #${puzzle.puzzle} ===`);
  console.log(`Target  : ${target}`);
  console.log(`Range   : ${puzzle.rangeStart} .. ${puzzle.rangeEnd}`);
  console.log(`Saldo   : ${puzzle.balanceBTC} BTC`);
  console.log(`Strategi: ${strategy}\n`);

  const t0 = Date.now();
  let i = 0;
  for (const k of gen) {
    if (i >= maxAttempts) break;
    const hex = bigIntToHex(k);
    const { compressed, uncompressed } = privateKeyToBothAddresses(hex);

    if (compressed.address === target || uncompressed.address === target) {
      const match =
        compressed.address === target ? compressed : uncompressed;
      const result = {
        puzzle: puzzle.puzzle,
        address: target,
        privateKeyHex: hex.padStart(64, '0'),
        wif: match.wif,
        foundAt: new Date().toISOString(),
        attempts: i + 1,
      };
      console.log('\n*** KEY DITEMUKAN ***');
      console.log(JSON.stringify(result, null, 2));
      appendFound(result);
      return result;
    }

    i++;
    if (i % reportEvery === 0) {
      const dt = (Date.now() - t0) / 1000;
      const rate = (i / dt).toFixed(0);
      process.stdout.write(
        `  attempts=${i.toLocaleString()}  ${rate} keys/s  last=0x${hex}\r`
      );
    }
  }
  console.log(`\nSelesai tanpa hasil setelah ${i.toLocaleString()} percobaan.`);
  return null;
}

async function main() {
  const args = process.argv.slice(2);
  const puzzles = loadPuzzles();

  let target = puzzles.find((p) => p.puzzle === 5);
  let strategy = 'combined';
  let maxAttempts = 200_000;

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--puzzle') target = puzzles.find((p) => p.puzzle === Number(args[++i]));
    else if (a === '--strategy') strategy = args[++i];
    else if (a === '--max') maxAttempts = Number(args[++i]);
  }
  if (!target) {
    console.error('Puzzle tidak ditemukan. Gunakan --puzzle <nomor>');
    process.exit(1);
  }
  huntPuzzle(target, { strategy, maxAttempts });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
