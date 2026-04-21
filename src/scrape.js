import fs from 'node:fs';
import path from 'node:path';
import { loadConfig } from './config.js';

const SOURCES = [
  {
    name: 'blockstream',
    url: (a) => `https://blockstream.info/api/address/${a}`,
    parse: (d) => parseStats(d.chain_stats, d.mempool_stats),
  },
  {
    name: 'mempool.space',
    url: (a) => `https://mempool.space/api/address/${a}`,
    parse: (d) => parseStats(d.chain_stats, d.mempool_stats),
  },
];

const cache = new Map(); // address -> { at, value }

function parseStats(c, m) {
  const funded = (c.funded_txo_sum ?? 0) + (m.funded_txo_sum ?? 0);
  const spent = (c.spent_txo_sum ?? 0) + (m.spent_txo_sum ?? 0);
  return {
    balanceSat: funded - spent,
    balanceBTC: (funded - spent) / 1e8,
    totalReceivedBTC: funded / 1e8,
    txCount: (c.tx_count ?? 0) + (m.tx_count ?? 0),
  };
}

async function fetchWithRetry(url, { tries, baseMs }) {
  let lastErr;
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(10_000) });
      if (r.status === 429 || r.status >= 500) throw new Error(`HTTP ${r.status}`);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return await r.json();
    } catch (e) {
      lastErr = e;
      const wait = baseMs * 2 ** i + Math.random() * 200;
      await new Promise((res) => setTimeout(res, wait));
    }
  }
  throw lastErr;
}

export async function scrapeWallet(address, opts = {}) {
  const cfg = loadConfig().scrape;
  const useCache = opts.useCache ?? true;
  const ttl = opts.cacheTtlMs ?? cfg.cacheTtlMs;
  const tries = opts.retryTries ?? cfg.retryTries;
  const baseMs = opts.retryBaseMs ?? cfg.retryBaseMs;

  if (useCache) {
    const c = cache.get(address);
    if (c && Date.now() - c.at < ttl) return c.value;
  }
  let lastErr;
  for (const src of SOURCES) {
    try {
      const d = await fetchWithRetry(src.url(address), { tries, baseMs });
      const value = { address, ...src.parse(d), source: src.name };
      cache.set(address, { at: Date.now(), value });
      return value;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

export async function scrapeMany(addresses, opts = {}) {
  const cfg = loadConfig().scrape;
  const delayMs = opts.delayMs ?? cfg.delayMs;
  const concurrency = Math.max(1, opts.concurrency ?? cfg.concurrency);
  const useCache = opts.useCache ?? true;

  const results = [];
  const queue = [...addresses];
  async function worker() {
    while (queue.length) {
      const a = queue.shift();
      try {
        const r = await scrapeWallet(a, { useCache });
        results.push(r);
        console.log(
          `[OK]  ${a}  saldo=${r.balanceBTC.toFixed(8)} BTC  ` +
          `received=${r.totalReceivedBTC.toFixed(8)}  tx=${r.txCount}  (${r.source})`
        );
      } catch (e) {
        results.push({ address: a, error: e.message });
        console.log(`[ERR] ${a}  -> ${e.message}`);
      }
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  await Promise.all(Array.from({ length: concurrency }, worker));
  return results;
}

export async function snapshotPuzzles(puzzles, outFile = 'data/wallet-status.json', opts = {}) {
  console.log(`Mengambil saldo untuk ${puzzles.length} wallet target...\n`);
  const out = await scrapeMany(puzzles.map((p) => p.address), opts);
  const byAddr = new Map(out.map((r) => [r.address, r]));
  const merged = puzzles.map((p) => ({ ...p, live: byAddr.get(p.address) }));
  fs.writeFileSync(outFile, JSON.stringify(merged, null, 2));
  console.log(`\nTersimpan di ${outFile}`);
  return merged;
}

function rotateIfNeeded(file, maxBytes) {
  if (!fs.existsSync(file)) return;
  const sz = fs.statSync(file).size;
  if (sz < maxBytes) return;
  const stamp = new Date().toISOString().slice(0, 10);
  const dir = path.dirname(file);
  const base = path.basename(file, '.csv');
  let target = path.join(dir, `${base}-${stamp}.csv`);
  let n = 1;
  while (fs.existsSync(target)) {
    target = path.join(dir, `${base}-${stamp}.${n++}.csv`);
  }
  fs.renameSync(file, target);
}

export async function watchPuzzles(puzzles, opts = {}) {
  const cfg = loadConfig().watch;
  const intervalMs = opts.intervalMs ?? cfg.intervalSec * 1000;
  const rotateMaxBytes = opts.rotateMaxBytes ?? cfg.rotateMaxBytes;

  console.log(`Watch mode: cek tiap ${intervalMs / 1000}s. Ctrl+C untuk berhenti.\n`);
  const csvFile = 'data/watch-log.csv';
  const ensureHeader = () => {
    if (!fs.existsSync(csvFile)) {
      fs.mkdirSync(path.dirname(csvFile), { recursive: true });
      fs.writeFileSync(csvFile, 'timestamp,puzzle,address,balanceBTC,txCount\n');
    }
  };
  ensureHeader();

  const prev = new Map();
  while (true) {
    rotateIfNeeded(csvFile, rotateMaxBytes);
    ensureHeader();
    const ts = new Date().toISOString();
    for (const p of puzzles) {
      try {
        const r = await scrapeWallet(p.address, { useCache: false });
        const before = prev.get(p.address);
        const tag =
          before && before.txCount !== r.txCount
            ? ` ⚠ AKTIVITAS BARU (tx ${before.txCount}→${r.txCount})`
            : '';
        console.log(
          `${ts}  #${p.puzzle}  ${p.address}  ` +
          `saldo=${r.balanceBTC.toFixed(8)} BTC  tx=${r.txCount}${tag}`
        );
        fs.appendFileSync(
          csvFile,
          `${ts},${p.puzzle},${p.address},${r.balanceBTC},${r.txCount}\n`
        );
        prev.set(p.address, r);
      } catch (e) {
        console.log(`${ts}  #${p.puzzle}  ${p.address}  ERR ${e.message}`);
      }
      await new Promise((res) => setTimeout(res, 250));
    }
    await new Promise((res) => setTimeout(res, intervalMs));
  }
}
