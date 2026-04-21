# BTC Puzzle Hunter

Script Node.js untuk mencari private key Bitcoin Puzzle dengan beberapa strategi kombinasi (random, sequential, combined) dan scraper saldo wallet target dari blockstream.info / mempool.space.

## Struktur

- `src/index.js` — entry utama (demo: list target, scrape 5 wallet, hunt puzzle #5)
- `src/keygen.js` — generator private key + derivasi address (compressed & uncompressed)
- `src/hunt.js` — engine pencarian key dengan strategi kombinasi
- `src/scrape.js` — pengambil saldo wallet dari blockchain explorer publik
- `data/puzzles.json` — daftar target puzzle (#1..#68 sample) dengan range key & address
- `data/found.json` — hasil key yang ditemukan (auto dibuat)
- `data/wallet-status.json` — snapshot saldo wallet target (dibuat oleh `scrape`)

## Perintah

- `npm start` — demo: tampilkan target, scrape 5 wallet, hunt puzzle #5
- `npm start scrape` — ambil saldo semua wallet target
- `npm start hunt <nomor> <maxAttempts>` — hunt puzzle tertentu
- `npm run scrape` — script scraper langsung (argumen: nomor puzzle, kosong = semua)
- `npm run hunt -- --puzzle 20 --strategy combined --max 1000000`

## Strategi pencarian

- `random` — random walk dalam range puzzle
- `sequential` — iterasi berurutan
- `combined` — kombinasi 50% random + 50% strided sweep (default, paling efektif untuk range besar)
