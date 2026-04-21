# BTC Puzzle Hunter v2

Script Node.js untuk Bitcoin Puzzle: pencarian private key paralel multi-worker, scraper saldo wallet target, monitoring real-time.

## Fitur

- **Multi-worker parallel** — `worker_threads`, otomatis pakai semua core CPU
- **Checkpoint & resume** — Ctrl+C aman, lanjut dari posisi terakhir
- **4 strategi** — `random`, `sequential`, `stride`, `combined`
- **Live statistik** — rate, avg, coverage %, ETA
- **Scraper saldo** — blockstream.info + mempool.space dengan retry/backoff
- **Watch mode** — monitor saldo target, alert kalau ada aktivitas baru
- **BSGS** — Baby-step Giant-step (untuk puzzle dengan pubkey terkuak)
- **Test suite** — `node:test` (9 test, verifikasi keygen + strategi)
- **Library cepat & ringan** — `@noble/secp256k1` + `@noble/hashes` (no native deps)

## Struktur

```
src/
  index.js       CLI dispatcher
  hunt.js        Orkestrator multi-worker + statistik + checkpoint
  worker.js      Worker thread (key derivation + match)
  keygen.js     Address & WIF derivation (P2PKH compressed/uncompressed)
  strategies.js  Generator key (random / sequential / stride / combined)
  scrape.js      Wallet scraper + watch mode (retry/backoff)
  bsgs.js        Baby-step Giant-step solver
  checkpoint.js  Save/load posisi pencarian
test/
  keygen.test.js
  strategies.test.js
data/
  puzzles.json        Daftar 35 target (#1-#160)
  found.json          Hasil key yang ditemukan (auto)
  wallet-status.json  Snapshot saldo (dari scrape)
  watch-log.csv       Log monitoring (dari watch)
  checkpoints/        Checkpoint per puzzle
```

## Perintah

```bash
npm start                              # menu + scrape 5 wallet pertama
npm start list                         # daftar semua target
npm start scrape [nomor...]            # ambil saldo (default: semua)
npm start watch [interval-detik]       # monitoring real-time
npm start hunt --puzzle N [opsi]       # hunt puzzle
npm test                               # jalankan test suite

# Opsi hunt
--puzzle N            wajib
--strategy NAME       random | sequential | stride | combined (default: combined)
--workers N           jumlah worker (default: cpus-1)
--duration SECS       durasi maks (0 = tanpa batas)
--address-mode MODE   compressed | both (default: compressed; "both" 2x lebih lambat)
--no-resume           abaikan checkpoint

# Auto-routing
Jika entry puzzle di data/puzzles.json punya field "pubkey", hunt akan
otomatis pakai BSGS (bukan brute-force address).

# Output
Kunci yang ditemukan ditulis append-only di data/found.jsonl (1 JSON per baris).

# Contoh
npm start hunt --puzzle 67 --strategy stride --workers 8
npm start hunt --puzzle 20 --duration 60
npm start scrape 67 68 71
npm start watch 30
```

## Catatan realistis

JavaScript di CPU ~~5-10 kkeys/sec per core~~. Puzzle #67+ butuh GPU (BitCrack/VanitySearch/Kangaroo) untuk peluang riil. Script ini tepat untuk: belajar, monitoring target, eksperimen strategi, atau menyelesaikan puzzle kecil (#1-#30 dalam hitungan detik-menit).
