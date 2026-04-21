import { Worker } from 'node:worker_threads';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as ckpt from './checkpoint.js';
import { isDeterministic } from './strategies.js';
import { bsgs } from './bsgs.js';
import {
  bold, dim, cyan, green, yellow, red, gray,
  fmtNum, fmtRate, fmtETA, progressBar, box, createLiveBlock,
} from './ui.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FOUND_LOG = 'data/found.jsonl';

function appendFound(record) {
  fs.mkdirSync(path.dirname(FOUND_LOG), { recursive: true });
  fs.appendFileSync(FOUND_LOG, JSON.stringify(record) + '\n');
}

function shortAddr(a) {
  return a.length > 22 ? a.slice(0, 10) + '…' + a.slice(-8) : a;
}

export async function huntPuzzle(puzzle, opts = {}) {
  const {
    strategy = 'combined',
    workers = Math.max(1, os.cpus().length - 1),
    reportEveryMs = 500,
    checkpointMs = 10_000,
    resume = true,
    durationMs = 0,
    addressMode = 'compressed',
  } = opts;

  // Auto-route to BSGS when pubkey is published
  if (puzzle.pubkey) {
    console.log('\n' + cyan('▶ ') + bold(`Puzzle #${puzzle.puzzle}`) +
      dim(' — pubkey diketahui, pakai BSGS.'));
    const res = bsgs(puzzle.pubkey, puzzle.rangeStart, puzzle.rangeEnd);
    if (res.found) {
      const record = {
        puzzle: puzzle.puzzle,
        address: puzzle.address,
        privateKeyHex: res.privateKeyHex,
        method: 'bsgs',
        foundAt: new Date().toISOString(),
      };
      appendFound(record);
      console.log('\n' + green(bold('*** KEY DITEMUKAN (BSGS) ***')));
      console.log(JSON.stringify(record, null, 2));
      return record;
    }
    console.log(yellow('BSGS selesai tanpa hasil dalam range yang diberikan.'));
    return null;
  }

  const start = BigInt(puzzle.rangeStart);
  const end = BigInt(puzzle.rangeEnd);
  const span = end - start + 1n;
  const saved = resume ? ckpt.load(puzzle.puzzle) : null;
  const totalPrior = saved?.totalAttempts ?? 0;
  const deterministic = isDeterministic(strategy);

  console.log('\n' + box(`PUZZLE #${puzzle.puzzle}`, [
    cyan('Address  ') + puzzle.address,
    cyan('Range    ') + dim(puzzle.rangeStart) + ' .. ' + dim(puzzle.rangeEnd),
    cyan('Span     ') + fmtNum(span) + dim(' keys'),
    cyan('Saldo    ') + green(puzzle.balanceBTC + ' BTC') +
      dim('  ·  Status: ') + (puzzle.status === 'open' ? yellow(puzzle.status) : green(puzzle.status ?? '?')),
    cyan('Workers  ') + bold(String(workers)) + dim('  ·  Strategi: ') + bold(strategy) +
      dim('  ·  Mode: ') + bold(addressMode),
    cyan('Resume   ') + (saved ? green(`+${fmtNum(totalPrior)} dari sesi sebelumnya`) : dim('sesi baru')),
  ], 64));
  console.log('');

  const workerScript = path.join(__dirname, 'worker.js');
  const stats = Array.from({ length: workers }, () => ({ attempts: 0, lastKey: '0' }));
  const t0 = Date.now();
  let stopped = false;

  const pool = Array.from({ length: workers }, (_, i) => {
    return new Worker(workerScript, {
      workerData: {
        puzzle,
        workerId: i,
        workerCount: workers,
        strategy,
        resumeFrom: saved?.workerLastKey?.[i] ?? null,
        reportEveryMs,
        addressMode,
      },
    });
  });

  const stop = () => {
    if (stopped) return;
    stopped = true;
    pool.forEach((w) => w.terminate().catch(() => {}));
  };

  function persist() {
    ckpt.save(puzzle.puzzle, {
      puzzle: puzzle.puzzle,
      address: puzzle.address,
      strategy,
      workers,
      totalAttempts: totalPrior + stats.reduce((a, s) => a + s.attempts, 0),
      workerLastKey: stats.map((s) => s.lastKey),
      updatedAt: new Date().toISOString(),
    });
  }

  const onSignal = (sig) => {
    console.log('\n\n' + yellow(`[!] ${sig} diterima — menyimpan checkpoint...`));
    persist();
    stop();
    process.exit(sig === 'SIGINT' ? 130 : 143);
  };
  const sigint = () => onSignal('SIGINT');
  const sigterm = () => onSignal('SIGTERM');
  process.once('SIGINT', sigint);
  process.once('SIGTERM', sigterm);

  const live = createLiveBlock();

  const result = await new Promise((resolve) => {
    let lastReport = Date.now();
    let lastCheckpoint = Date.now();
    let lastTotal = 0;

    const tick = setInterval(() => {
      const total = stats.reduce((a, s) => a + s.attempts, 0);
      const grand = total + totalPrior;
      const dt = (Date.now() - t0) / 1000;
      const rateNow = (total - lastTotal) / ((Date.now() - lastReport) / 1000);
      const rateAvg = total / dt;
      const ratio = Number((BigInt(grand) * 10000n) / span) / 10000;
      const eta = deterministic && rateAvg > 0
        ? (Number(span) - grand) / rateAvg
        : Infinity;
      lastTotal = total;
      lastReport = Date.now();

      const label = deterministic ? 'coverage' : 'samples ';
      live.render([
        '  ' + cyan('attempts ') + bold(fmtNum(grand)) +
          dim('   now ') + green(fmtRate(rateNow)) +
          dim('   avg ') + green(fmtRate(rateAvg)),
        '  ' + cyan(label) + ' ' + progressBar(ratio) + ' ' +
          bold((ratio * 100).toExponential(2) + '%'),
        '  ' + cyan('ETA      ') + (deterministic ? bold(fmtETA(eta)) : dim('∞ (non-deterministik)')),
        '  ' + gray(`uptime ${dt.toFixed(1)}s · checkpoint tiap ${checkpointMs/1000}s`),
      ]);

      if (Date.now() - lastCheckpoint > checkpointMs) {
        persist();
        lastCheckpoint = Date.now();
      }

      if (durationMs > 0 && Date.now() - t0 > durationMs) {
        clearInterval(tick);
        persist();
        stop();
        resolve(null);
      }
    }, 1000);

    pool.forEach((w) => {
      w.on('message', (msg) => {
        if (msg.type === 'progress') {
          stats[msg.workerId].attempts = msg.attempts;
          stats[msg.workerId].lastKey = msg.lastKey;
        } else if (msg.type === 'found') {
          const found = {
            puzzle: puzzle.puzzle,
            address: msg.address,
            privateKeyHex: msg.privateKeyHex,
            wif: msg.wif,
            addressMode: msg.addressMode,
            method: 'bruteforce',
            strategy,
            foundAt: new Date().toISOString(),
            workerAttempts: msg.attempts,
            totalAttempts: totalPrior + stats.reduce((a, s) => a + s.attempts, 0),
            elapsedMs: Date.now() - t0,
          };
          clearInterval(tick);
          appendFound(found);
          ckpt.clear(puzzle.puzzle);
          stop();
          resolve(found);
        } else if (msg.type === 'exhausted') {
          stats[msg.workerId].attempts = msg.attempts;
          stats[msg.workerId].lastKey = msg.lastKey;
        }
      });
      w.on('error', (e) => console.error('\n' + red('[worker error] ') + e.message));
    });
  });

  process.removeListener('SIGINT', sigint);
  process.removeListener('SIGTERM', sigterm);
  live.finalize();
  console.log('');

  if (result) {
    console.log('\n' + green(bold('╔════ KEY DITEMUKAN ════╗')));
    console.log(green('  address  ') + bold(result.address));
    console.log(green('  privkey  ') + bold(result.privateKeyHex));
    console.log(green('  WIF      ') + bold(result.wif));
    console.log(green('  mode     ') + result.addressMode);
    console.log(green('  attempts ') + fmtNum(result.totalAttempts) + dim(`  in ${(result.elapsedMs/1000).toFixed(1)}s`));
    console.log(green('  saved to ') + dim(FOUND_LOG));
  } else {
    console.log(yellow('\nWaktu habis / dihentikan tanpa hasil. Checkpoint disimpan.'));
  }
  return result;
}
