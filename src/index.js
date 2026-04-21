import fs from 'node:fs';
import { huntPuzzle } from './hunt.js';
import { snapshotPuzzles, scrapeMany, scrapeWallet, watchPuzzles } from './scrape.js';
import { loadConfig } from './config.js';
import { bigIntToPrivKey, privKeyToAddress } from './keygen.js';
import { banner, bold, cyan, green, yellow, red, dim, gray } from './ui.js';

const PUZZLES = JSON.parse(fs.readFileSync('data/puzzles.json', 'utf8'));

export function validatePuzzles(arr) {
  const errs = [];
  for (const p of arr) {
    const N = BigInt(p.puzzle);
    const expS = 1n << (N - 1n);
    const expE = (1n << N) - 1n;
    if (BigInt(p.rangeStart) !== expS || BigInt(p.rangeEnd) !== expE) {
      errs.push(`puzzle #${p.puzzle}: range tidak cocok dengan 2^${N - 1n}..2^${N}-1`);
    }
  }
  return errs;
}

export function parseFlags(args) {
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

function getPuzzle(num) {
  const p = PUZZLES.find((x) => x.puzzle === Number(num));
  if (!p) throw new Error(`Puzzle #${num} tidak ada di data/puzzles.json`);
  return p;
}

function help() {
  console.log(`
${bold('BTC Puzzle Hunter v2')}

${cyan('Penggunaan:')}
  npm start                              Tampilkan menu + scrape 5 wallet pertama
  npm start list                         Daftar semua target puzzle
  npm start verify                       Validasi data + keygen + konektivitas API
  npm start scrape [nomor...] [opsi]     Ambil saldo wallet
  npm start watch [interval-detik]       Monitor saldo terus-menerus
  npm start hunt --puzzle N [opsi]       Hunt puzzle dengan worker thread

${cyan('Opsi hunt (override config.json):')}
  --puzzle N            Nomor puzzle (wajib)
  --strategy NAME       random | sequential | stride | combined
  --workers N           Jumlah worker
  --duration SECS       Durasi maksimal (0 = tanpa batas)
  --address-mode MODE   compressed | both
  --mbaby N             Ukuran tabel BSGS (hanya untuk puzzle dengan pubkey)
  --no-resume           Abaikan checkpoint, mulai dari awal

${cyan('Opsi scrape:')}
  --concurrency N       Jumlah request paralel (default dari config.json)

${cyan('Default & tuning di config.json (root project)')}.

${cyan('Contoh:')}
  npm start hunt --puzzle 20 --duration 60
  npm start hunt --puzzle 67 --strategy stride --workers 8
  npm start scrape --concurrency 3
  npm start scrape 67 68 71
  npm start watch 30
  npm start verify
`);
}

function listPuzzles() {
  console.log('\n' + bold('Daftar target puzzle:') + '\n');
  console.log(gray('   #    Status   Saldo BTC   Address'));
  console.log(gray('  ────────────────────────────────────────────────────────────'));
  for (const p of PUZZLES) {
    const status = p.status === 'open' ? yellow('open   ') : green('solved ');
    const bal = String(p.balanceBTC).padStart(8);
    console.log(`  ${dim(String(p.puzzle).padStart(3))}  ${status}  ${bal}    ${p.address}`);
  }
  const open = PUZZLES.filter((x) => x.status === 'open').length;
  const solved = PUZZLES.filter((x) => x.status === 'solved').length;
  console.log('\n  ' + dim(`Total: ${PUZZLES.length} target (`) + yellow(open + ' terbuka') + dim(', ') + green(solved + ' terpecahkan') + dim(')') + '\n');
}

async function verify() {
  banner('VERIFY', 'sanity check sebelum hunt jangka panjang');

  console.log('\n' + cyan('1) Validasi data/puzzles.json'));
  const errs = validatePuzzles(PUZZLES);
  if (errs.length === 0) {
    console.log('   ' + green('✓') + ` ${PUZZLES.length} puzzle valid (range = 2^(N-1)..2^N-1)`);
  } else {
    for (const e of errs) console.log('   ' + red('✗ ') + e);
  }

  console.log('\n' + cyan('2) Keygen vector test'));
  const vectors = [
    { k: 1n, addr: '1BgGZ9tcN4rm9KBzDn7KprQz87SZ26SAMH' },
    { k: 0x15n, addr: '1E6NuFjCi27W5zoXg8TRdcSRq84zJeBW3k' },
  ];
  for (const v of vectors) {
    const got = privKeyToAddress(bigIntToPrivKey(v.k), true);
    const ok = got === v.addr;
    console.log('   ' + (ok ? green('✓') : red('✗')) + ` k=0x${v.k.toString(16)}  →  ${got}`);
  }

  console.log('\n' + cyan('3) Konektivitas API scraper'));
  try {
    const r = await scrapeWallet(PUZZLES[0].address, { useCache: false });
    console.log('   ' + green('✓') + ` ${r.source}  saldo=${r.balanceBTC.toFixed(8)} BTC  tx=${r.txCount}`);
  } catch (e) {
    console.log('   ' + red('✗') + ' tidak bisa fetch: ' + e.message);
  }

  console.log('\n' + cyan('4) Konfigurasi efektif'));
  console.log(JSON.stringify(loadConfig(), null, 2).split('\n').map((l) => '   ' + dim(l)).join('\n'));
  console.log('');
}

async function main() {
  const errs = validatePuzzles(PUZZLES);
  if (errs.length) {
    console.error(yellow('Peringatan validasi puzzles.json:'));
    for (const e of errs) console.error('  - ' + e);
    console.error('');
  }

  const [cmd, ...rest] = process.argv.slice(2);

  if (cmd === 'help' || cmd === '--help' || cmd === '-h') return help();
  if (cmd === 'list') return listPuzzles();
  if (cmd === 'verify') return verify();

  if (cmd === 'scrape') {
    const f = parseFlags(rest);
    const ids = rest.filter((a) => !a.startsWith('--') && !isNaN(Number(a))).map(Number);
    const targets = ids.length ? PUZZLES.filter((p) => ids.includes(p.puzzle)) : PUZZLES;
    const opts = {};
    if (f.concurrency) opts.concurrency = Number(f.concurrency);
    await snapshotPuzzles(targets, 'data/wallet-status.json', opts);
    return;
  }

  if (cmd === 'watch') {
    const arg0 = rest.find((a) => !a.startsWith('--'));
    const opts = {};
    if (arg0) opts.intervalMs = Number(arg0) * 1000;
    await watchPuzzles(PUZZLES.filter((p) => p.status === 'open'), opts);
    return;
  }

  if (cmd === 'hunt') {
    const f = parseFlags(rest);
    if (!f.puzzle) {
      console.error('Wajib --puzzle <nomor>. Lihat: npm start help');
      process.exit(1);
    }
    const p = getPuzzle(f.puzzle);
    const opts = {};
    if (f.strategy) opts.strategy = f.strategy;
    if (f.workers) opts.workers = Number(f.workers);
    if (f.duration !== undefined) opts.durationMs = Number(f.duration) * 1000;
    if (f['address-mode']) opts.addressMode = f['address-mode'];
    if (f.mbaby) opts.mBaby = Number(f.mbaby);
    if (f['no-resume']) opts.resume = false;
    await huntPuzzle(p, opts);
    return;
  }

  banner('BTC PUZZLE HUNTER v2', 'multi-worker · checkpointed · scraper');
  listPuzzles();
  console.log(bold('Live snapshot 5 wallet pertama:') + '\n');
  await scrapeMany(PUZZLES.slice(0, 5).map((p) => p.address));
  console.log('\n' + dim('Ketik `npm start help` untuk perintah lengkap.'));
}

main().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
