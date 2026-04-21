import { Worker } from 'node:worker_threads';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as ckpt from './checkpoint.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function fmtNum(n) {
  return n.toLocaleString('en-US');
}

function fmtRate(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M/s';
  if (n >= 1e3) return (n / 1e3).toFixed(2) + 'k/s';
  return n.toFixed(0) + '/s';
}

function fmtETA(seconds) {
  if (!isFinite(seconds)) return '∞';
  const y = seconds / (365.25 * 86400);
  if (y > 1e6) return y.toExponential(2) + ' tahun';
  if (y > 1) return y.toFixed(1) + ' tahun';
  const d = seconds / 86400;
  if (d > 1) return d.toFixed(1) + ' hari';
  const h = seconds / 3600;
  if (h > 1) return h.toFixed(1) + ' jam';
  return (seconds / 60).toFixed(1) + ' menit';
}

function appendFound(record) {
  const f = 'data/found.json';
  const arr = fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : [];
  arr.push(record);
  fs.writeFileSync(f, JSON.stringify(arr, null, 2));
}

export async function huntPuzzle(puzzle, opts = {}) {
  const {
    strategy = 'combined',
    workers = Math.max(1, os.cpus().length - 1),
    reportEveryMs = 500,
    checkpointMs = 10_000,
    resume = true,
    durationMs = 0,
  } = opts;

  const start = BigInt(puzzle.rangeStart);
  const end = BigInt(puzzle.rangeEnd);
  const span = end - start + 1n;
  const saved = resume ? ckpt.load(puzzle.puzzle) : null;
  const totalPrior = saved?.totalAttempts ?? 0;

  console.log('\n┌─────────────────────────────────────────────────┐');
  console.log(`│  Puzzle #${puzzle.puzzle}  →  ${puzzle.address}`);
  console.log(`│  Range  : ${puzzle.rangeStart} .. ${puzzle.rangeEnd}`);
  console.log(`│  Saldo  : ${puzzle.balanceBTC} BTC   Status: ${puzzle.status ?? '?'}`);
  console.log(`│  Workers: ${workers}   Strategi: ${strategy}`);
  console.log(`│  Resume : ${saved ? `+${fmtNum(totalPrior)} dari sesi sebelumnya` : 'sesi baru'}`);
  console.log('└─────────────────────────────────────────────────┘\n');

  const workerScript = path.join(__dirname, 'worker.js');
  const stats = Array.from({ length: workers }, () => ({ attempts: 0, lastKey: '0' }));
  const t0 = Date.now();
  let found = null;
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
      },
    });
  });

  const stop = () => {
    if (stopped) return;
    stopped = true;
    pool.forEach((w) => w.terminate().catch(() => {}));
  };

  const onSigint = () => {
    console.log('\n\n[!] Dihentikan, menyimpan checkpoint...');
    persist();
    stop();
    process.exit(130);
  };
  process.once('SIGINT', onSigint);

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
      const coverage = Number((BigInt(grand) * 10000n) / span) / 100;
      const eta = (Number(span) - grand) / rateAvg;
      lastTotal = total;
      lastReport = Date.now();

      process.stdout.write(
        `\r  attempts=${fmtNum(grand)}  rate=${fmtRate(rateNow)}  ` +
        `avg=${fmtRate(rateAvg)}  coverage=${coverage.toExponential(2)}%  ETA=${fmtETA(eta)}     `
      );

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
          found = {
            puzzle: puzzle.puzzle,
            address: msg.address,
            privateKeyHex: msg.privateKeyHex,
            wif: msg.wif,
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
      w.on('error', (e) => console.error('\n[worker error]', e.message));
    });
  });

  process.removeListener('SIGINT', onSigint);
  console.log('');

  if (result) {
    console.log('\n*** KEY DITEMUKAN ***');
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log('\nWaktu habis / dihentikan tanpa hasil. Checkpoint disimpan.');
  }
  return result;
}
