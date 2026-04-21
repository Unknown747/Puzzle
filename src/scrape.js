import fs from 'fs';
import fetch from 'node-fetch';

const API_ENDPOINTS = {
  blockstream: (addr) => `https://blockstream.info/api/address/${addr}`,
  blockchain: (addr) => `https://blockchain.info/rawaddr/${addr}?limit=0`,
  mempool: (addr) => `https://mempool.space/api/address/${addr}`,
};

async function fetchBlockstream(addr) {
  const r = await fetch(API_ENDPOINTS.blockstream(addr));
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = await r.json();
  const funded = d.chain_stats.funded_txo_sum + d.mempool_stats.funded_txo_sum;
  const spent = d.chain_stats.spent_txo_sum + d.mempool_stats.spent_txo_sum;
  return {
    address: addr,
    balanceSat: funded - spent,
    balanceBTC: (funded - spent) / 1e8,
    totalReceivedBTC: funded / 1e8,
    txCount: d.chain_stats.tx_count + d.mempool_stats.tx_count,
    source: 'blockstream',
  };
}

async function fetchMempool(addr) {
  const r = await fetch(API_ENDPOINTS.mempool(addr));
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const d = await r.json();
  const funded = d.chain_stats.funded_txo_sum + d.mempool_stats.funded_txo_sum;
  const spent = d.chain_stats.spent_txo_sum + d.mempool_stats.spent_txo_sum;
  return {
    address: addr,
    balanceSat: funded - spent,
    balanceBTC: (funded - spent) / 1e8,
    totalReceivedBTC: funded / 1e8,
    txCount: d.chain_stats.tx_count + d.mempool_stats.tx_count,
    source: 'mempool.space',
  };
}

export async function scrapeWallet(address) {
  const fetchers = [fetchBlockstream, fetchMempool];
  let lastErr;
  for (const fn of fetchers) {
    try {
      return await fn(address);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

export async function scrapeMany(addresses, { delayMs = 250 } = {}) {
  const results = [];
  for (const a of addresses) {
    try {
      const r = await scrapeWallet(a);
      results.push(r);
      console.log(
        `[OK] ${a}  saldo=${r.balanceBTC.toFixed(8)} BTC  ` +
        `received=${r.totalReceivedBTC.toFixed(8)} BTC  tx=${r.txCount}`
      );
    } catch (e) {
      results.push({ address: a, error: e.message });
      console.log(`[ERR] ${a}  -> ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, delayMs));
  }
  return results;
}

async function main() {
  const puzzles = JSON.parse(fs.readFileSync('data/puzzles.json', 'utf8'));
  const args = process.argv.slice(2);
  let targets = puzzles;
  if (args.length > 0) {
    const ids = args.map(Number);
    targets = puzzles.filter((p) => ids.includes(p.puzzle));
  }
  console.log(`Mengambil saldo untuk ${targets.length} wallet target puzzle...\n`);
  const out = await scrapeMany(targets.map((p) => p.address));
  const merged = targets.map((p, i) => ({ ...p, live: out[i] }));
  fs.writeFileSync('data/wallet-status.json', JSON.stringify(merged, null, 2));
  console.log('\nHasil tersimpan di data/wallet-status.json');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
