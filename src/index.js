import fs from 'node:fs';
import { huntPuzzle } from './hunt.js';
import { snapshotPuzzles, scrapeMany, watchPuzzles } from './scrape.js';

const PUZZLES = JSON.parse(fs.readFileSync('data/puzzles.json', 'utf8'));

function getPuzzle(num) {
  const p = PUZZLES.find((x) => x.puzzle === Number(num));
  if (!p) throw new Error(`Puzzle #${num} tidak ada di data/puzzles.json`);
  return p;
}

function parseFlags(args) {
  const out = {};
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = args[i + 1];
    if (next === undefined || next.startsWith('--')) {
      out[key] = true;
    } else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

function help() {
  console.log(`
BTC Puzzle Hunter v2

Penggunaan:
  npm start                              Tampilkan menu + scrape 5 wallet pertama
  npm start list                         Daftar semua target puzzle
  npm start scrape [nomor...]            Ambil saldo wallet (default: semua)
  npm start watch [interval-detik]       Monitor saldo terus-menerus
  npm start hunt --puzzle N [opsi]       Hunt puzzle dengan worker thread

Opsi hunt:
  --puzzle N            Nomor puzzle (wajib)
  --strategy NAME       random | sequential | stride | combined  (default: combined)
  --workers N           Jumlah worker (default: cpus-1)
  --duration SECS       Durasi maksimal (0 = tanpa batas)
  --address-mode MODE   compressed | both  (default: compressed; "both" cek 2x lebih lambat)
  --no-resume           Abaikan checkpoint, mulai dari awal

Contoh:
  npm start hunt --puzzle 20 --duration 60
  npm start hunt --puzzle 67 --strategy stride --workers 8
  npm start scrape 67 68 71
  npm start watch 30
`);
}

function listPuzzles() {
  console.log('\nDaftar target puzzle:\n');
  console.log('  #   Status  Saldo BTC   Address');
  console.log('  ───────────────────────────────────────────────────────────');
  for (const p of PUZZLES) {
    const status = (p.status ?? '?').padEnd(7);
    const bal = String(p.balanceBTC).padStart(8);
    console.log(`  ${String(p.puzzle).padStart(3)} ${status} ${bal}    ${p.address}`);
  }
  const open = PUZZLES.filter((x) => x.status === 'open').length;
  const solved = PUZZLES.filter((x) => x.status === 'solved').length;
  console.log(`\n  Total: ${PUZZLES.length} target (${open} terbuka, ${solved} terpecahkan)\n`);
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);

  if (cmd === 'help' || cmd === '--help' || cmd === '-h') return help();
  if (cmd === 'list') return listPuzzles();

  if (cmd === 'scrape') {
    const ids = rest.filter((a) => !isNaN(Number(a))).map(Number);
    const targets = ids.length ? PUZZLES.filter((p) => ids.includes(p.puzzle)) : PUZZLES;
    await snapshotPuzzles(targets);
    return;
  }

  if (cmd === 'watch') {
    const interval = Number(rest[0] || 60) * 1000;
    await watchPuzzles(PUZZLES.filter((p) => p.status === 'open'), { intervalMs: interval });
    return;
  }

  if (cmd === 'hunt') {
    const f = parseFlags(rest);
    if (!f.puzzle) {
      console.error('Wajib --puzzle <nomor>. Lihat: npm start help');
      process.exit(1);
    }
    const p = getPuzzle(f.puzzle);
    await huntPuzzle(p, {
      strategy: f.strategy || 'combined',
      workers: f.workers ? Number(f.workers) : undefined,
      durationMs: f.duration ? Number(f.duration) * 1000 : 0,
      addressMode: f['address-mode'] || 'compressed',
      resume: !f['no-resume'],
    });
    return;
  }

  console.log('==================================================');
  console.log('   BTC PUZZLE HUNTER v2 — multi-worker + scraper');
  console.log('==================================================');
  listPuzzles();
  console.log('Live snapshot 5 wallet pertama:\n');
  await scrapeMany(PUZZLES.slice(0, 5).map((p) => p.address));
  console.log('\nKetik `npm start help` untuk perintah lengkap.');
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
