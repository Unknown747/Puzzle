# BTC Puzzle Hunter v2

![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)
![Tests](https://img.shields.io/badge/tests-19%20passing-success)
![License](https://img.shields.io/badge/license-MIT-blue)
![Type](https://img.shields.io/badge/module-ESM-orange)
![Deps](https://img.shields.io/badge/deps-pure%20JS-informational)

Script Node.js untuk Bitcoin Puzzle: pencarian private key paralel multi-worker, scraper saldo wallet target, monitoring real-time, dan notifikasi Telegram saat key ditemukan.

## Fitur

- **Multi-worker parallel** — `worker_threads`, otomatis pakai semua core CPU
- **Incremental EC math** — strategi `sequential`/`stride` ~20× lebih cepat dari naive scalar mult
- **Checkpoint & resume** — Ctrl+C aman, lanjut dari posisi terakhir
- **4 strategi pencarian** — `random`, `sequential`, `stride`, `combined`
- **Auto-mode** — pilih puzzle terbuka terkecil otomatis, atau rotasi semua puzzle
- **Live statistik** — rate, avg, coverage %, ETA
- **Scraper saldo** — blockstream.info + mempool.space dengan retry/backoff
- **Watch mode** — monitor saldo target, alert kalau ada aktivitas baru
- **BSGS** — Baby-step Giant-step (untuk puzzle dengan pubkey terkuak)
- **Notifikasi** — Telegram + webhook + beep saat key ditemukan
- **Progress periodik** — laporan ke Telegram tiap N menit
- **Test suite** — `node:test` (19 test)
- **Library cepat & ringan** — `@noble/secp256k1` + `@noble/hashes` (no native deps)

## Install

```bash
npm install
npm link              # opsional: enable perintah `btc-hunt` global
```

## Perintah Cepat

### Cara paling sederhana — auto-mode

```bash
btc-hunt auto                        # pilih puzzle terbuka terkecil, hunt non-stop
btc-hunt auto --duration 3600        # hunt 1 jam lalu stop
btc-hunt auto --rotate 600           # siklus semua puzzle terbuka, 10 menit/puzzle
```

### Menu interaktif

```bash
btc-hunt              # tampilkan menu
npm start             # alternatif
```

### Mode CLI langsung

```bash
btc-hunt list                          # daftar semua target puzzle
btc-hunt verify                        # validasi data + keygen + konektivitas API
btc-hunt scrape [nomor...]             # ambil saldo (default: semua)
btc-hunt watch [interval-detik]        # monitoring real-time
btc-hunt hunt --puzzle N [opsi]        # hunt puzzle spesifik
btc-hunt notify-test                   # cek setup Telegram/webhook
```

### npm scripts (alternatif)

```bash
npm run auto       # = btc-hunt auto
npm run hunt -- --puzzle 67
npm run scrape -- 67 68
npm run watch -- 30
npm run list
npm run verify
npm test
```

## Opsi Hunt

| Flag | Deskripsi |
|---|---|
| `--puzzle N` | Nomor puzzle (wajib untuk `hunt`) |
| `--strategy NAME` | `random` \| `sequential` \| `stride` \| `combined` |
| `--workers N` | Jumlah worker (default: cpus−1) |
| `--duration SECS` | Durasi maksimal (0 = tanpa batas) |
| `--address-mode MODE` | `compressed` \| `both` |
| `--mbaby N` | Ukuran tabel BSGS (untuk puzzle dengan pubkey) |
| `--no-resume` | Abaikan checkpoint, mulai dari awal |
| `--rotate SECS` | (hanya `auto`) durasi per puzzle saat siklus |

## Konfigurasi (`config.json`)

Default & tuning di root project — bisa di-override via flag CLI.

```json
{
  "hunt": {
    "strategy": "combined",
    "workers": null,
    "durationSec": 0,
    "addressMode": "compressed",
    "resume": true,
    "reportEveryMs": 500,
    "checkpointMs": 10000
  },
  "bsgs": { "mBaby": 1048576 },
  "scrape": {
    "concurrency": 1,
    "delayMs": 250,
    "cacheTtlMs": 60000,
    "retryTries": 4,
    "retryBaseMs": 600
  },
  "watch": { "intervalSec": 60, "rotateMaxBytes": 10485760 },
  "notify": {
    "beep": true,
    "beepTimes": 3,
    "progress": { "enabled": false, "intervalMinutes": 60 },
    "telegram": {
      "enabled": false,
      "botToken": "${TELEGRAM_BOT_TOKEN}",
      "chatId": "${TELEGRAM_CHAT_ID}"
    },
    "webhook": {
      "enabled": false,
      "url": "${NOTIFY_WEBHOOK_URL}"
    }
  }
}
```

Sintaks `${VAR_NAME}` otomatis di-resolve dari environment variable — token tidak perlu masuk file/git.

## Setup Notifikasi Telegram

1. Chat dengan [@BotFather](https://t.me/BotFather) di Telegram → `/newbot` → simpan **bot token**.
2. Chat dengan bot Anda sekali (kirim apa saja).
3. Buka `https://api.telegram.org/bot<TOKEN>/getUpdates` → cari `chat.id` Anda.
4. Set environment variable:
   ```bash
   export TELEGRAM_BOT_TOKEN="123456:ABC..."
   export TELEGRAM_CHAT_ID="987654321"
   ```
5. Edit `config.json` → `notify.telegram.enabled = true`.
6. Test: `btc-hunt notify-test` → cek HP Anda.

Untuk laporan progress periodik, set juga `notify.progress.enabled = true`.

## Auto-completion Shell

```bash
source scripts/btc-hunt.completion.bash                              # sesi ini
echo 'source ~/workspace/scripts/btc-hunt.completion.bash' >> ~/.bashrc   # permanen
```

Setelah aktif: `btc-hunt <TAB>` daftar perintah, `btc-hunt hunt --puzzle <TAB>` daftar nomor puzzle terbuka, `btc-hunt hunt --strategy <TAB>` pilihan strategi.

## Struktur Project

```
src/
  index.js       CLI dispatcher + parser flag + validasi puzzles.json
  hunt.js        Orkestrator multi-worker + statistik + checkpoint
  worker.js      Worker thread (compare hash160 langsung, no base58 di hot loop)
  keygen.js      Address & WIF derivation, hash160 helpers
  strategies.js  Generator key (random / sequential / stride / combined)
  scrape.js      Wallet scraper + watch mode (retry/backoff + cache 60s)
  bsgs.js        Baby-step Giant-step solver
  checkpoint.js  Save/load posisi (atomic write via tmp+rename)
  notify.js      Telegram + webhook + beep notifier
  ui.js          ANSI helpers, progress bar, redrawable status block
  menu.js        Menu interaktif + prompt
  config.js      Loader config.json (deep-merge dengan default)
config.json      Default & tuning di root project (override via CLI flag)
scripts/
  btc-hunt.completion.bash   Auto-completion bash
test/
  bsgs.test.js
  checkpoint.test.js
  keygen.test.js
  parseflags.test.js
  strategies.test.js
data/
  puzzles.json        Daftar 35 target (#1-#160)
  found.jsonl         Hasil key yang ditemukan (auto-append)
  wallet-status.json  Snapshot saldo (dari scrape)
  watch-log.csv       Log monitoring (dari watch)
  checkpoints/        Checkpoint per puzzle
```

## Strategi Pencarian

| Nama | Tipe | Keterangan | Kecepatan |
|---|---|---|---|
| `sequential` | deterministik | Range dibagi merata antar worker, scan urut | ⚡ tercepat (incremental EC) |
| `stride` | deterministik | Worker N ambil tiap key ke-N (offset N) | ⚡ tercepat (incremental EC) |
| `random` | non-deterministik | Murni acak dalam range | lambat (full scalar mult) |
| `combined` | hybrid | 50% random + 50% sequential per-worker offset (default) | lambat (random path) |

**Tip:** untuk kecepatan maksimal, pakai `--strategy stride`. Strategi deterministik menampilkan ETA pasti; strategi acak menampilkan coverage estimasi.

## Test

```bash
npm test
```

Mencakup: keygen vector, semua generator strategi (no overlap antar worker), parser flag, atomic checkpoint, BSGS solver. Total 19 test.

## Lisensi

[MIT](LICENSE)
