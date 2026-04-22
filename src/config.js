import fs from 'node:fs';

const DEFAULTS = {
  hunt: {
    strategy: 'combined',
    workers: null,
    durationSec: 0,
    addressMode: 'compressed',
    resume: true,
    reportEveryMs: 500,
    checkpointMs: 10000,
  },
  bsgs: { mBaby: 1048576 },
  scrape: {
    concurrency: 1,
    delayMs: 250,
    cacheTtlMs: 60000,
    retryTries: 4,
    retryBaseMs: 600,
  },
  watch: { intervalSec: 60, rotateMaxBytes: 10 * 1024 * 1024 },
  notify: {
    beep: true,
    beepTimes: 3,
    telegram: {
      enabled: false,
      botToken: '${TELEGRAM_BOT_TOKEN}',
      chatId: '${TELEGRAM_CHAT_ID}',
    },
    webhook: {
      enabled: false,
      url: '${NOTIFY_WEBHOOK_URL}',
    },
  },
};

function isPlainObject(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

function deepMerge(a, b) {
  if (!isPlainObject(b)) return b ?? a;
  const out = { ...a };
  for (const k of Object.keys(b)) {
    out[k] = isPlainObject(a?.[k]) && isPlainObject(b[k])
      ? deepMerge(a[k], b[k])
      : b[k];
  }
  return out;
}

let cached = null;

export function loadConfig(file = 'config.json') {
  if (cached) return cached;
  if (!fs.existsSync(file)) {
    cached = DEFAULTS;
    return cached;
  }
  try {
    const user = JSON.parse(fs.readFileSync(file, 'utf8'));
    cached = deepMerge(DEFAULTS, user);
  } catch (e) {
    console.error(`config.json parse error: ${e.message} — pakai default`);
    cached = DEFAULTS;
  }
  return cached;
}

export function getDefaults() {
  return DEFAULTS;
}
