import fs from 'fs';
import { scrapeMany } from './scrape.js';
import { huntPuzzle } from './hunt.js';

function banner() {
  console.log('==================================================');
  console.log('   BTC PUZZLE HUNTER + WALLET TARGET SCRAPER');
  console.log('==================================================\n');
}

async function main() {
  banner();
  const puzzles = JSON.parse(fs.readFileSync('data/puzzles.json', 'utf8'));

  const args = process.argv.slice(2);
  const mode = args[0] || 'demo';

  if (mode === 'scrape') {
    await scrapeMany(puzzles.map((p) => p.address));
    return;
  }

  if (mode === 'hunt') {
    const num = Number(args[1] || 5);
    const max = Number(args[2] || 200000);
    const p = puzzles.find((x) => x.puzzle === num);
    if (!p) return console.error('Puzzle', num, 'tidak ada di data/puzzles.json');
    huntPuzzle(p, { strategy: 'combined', maxAttempts: max });
    return;
  }

  console.log('Daftar puzzle target:');
  for (const p of puzzles) {
    console.log(
      `  #${String(p.puzzle).padStart(3)}  ${p.address}  ` +
      `(${p.balanceBTC} BTC, range ${p.rangeStart}..${p.rangeEnd})`
    );
  }

  console.log('\nMengambil saldo live untuk 5 wallet pertama...\n');
  await scrapeMany(puzzles.slice(0, 5).map((p) => p.address));

  console.log('\nMencoba memecahkan Puzzle #5 dengan strategi kombinasi...');
  const target = puzzles.find((p) => p.puzzle === 5);
  huntPuzzle(target, { strategy: 'combined', maxAttempts: 50_000, reportEvery: 10_000 });

  console.log('\nSelesai. Perintah lain:');
  console.log('  npm start scrape         # ambil saldo semua target');
  console.log('  npm start hunt 5 100000  # cari key puzzle #5');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
