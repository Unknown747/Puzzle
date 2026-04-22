import { loadConfig } from './config.js';

function resolveSecret(value) {
  if (!value) return '';
  const m = String(value).match(/^\$\{?([A-Z0-9_]+)\}?$/);
  if (m) return process.env[m[1]] ?? '';
  return value;
}

function fmtFound(rec) {
  return [
    '🎯 *KEY DITEMUKAN*',
    `Puzzle  : #${rec.puzzle}`,
    `Address : \`${rec.address}\``,
    `Privkey : \`${rec.privateKeyHex}\``,
    rec.wif ? `WIF     : \`${rec.wif}\`` : null,
    rec.method ? `Metode  : ${rec.method}` : null,
    rec.foundAt ? `Waktu   : ${rec.foundAt}` : null,
  ].filter(Boolean).join('\n');
}

async function sendTelegram(rec, cfg) {
  const token = resolveSecret(cfg.botToken);
  const chatId = resolveSecret(cfg.chatId);
  if (!token || !chatId) {
    return { ok: false, skipped: true, reason: 'botToken/chatId belum di-set' };
  }
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: fmtFound(rec),
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!r.ok) return { ok: false, reason: `HTTP ${r.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

async function sendWebhook(rec, cfg) {
  const url = resolveSecret(cfg.url);
  if (!url) return { ok: false, skipped: true };
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(rec),
      signal: AbortSignal.timeout(10_000),
    });
    return { ok: r.ok, reason: r.ok ? null : `HTTP ${r.status}` };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

function beep(times = 3) {
  for (let i = 0; i < times; i++) process.stdout.write('\x07');
}

export async function notifyFound(rec) {
  const n = (loadConfig().notify) ?? {};
  const out = {};
  if (n.beep !== false) beep(n.beepTimes ?? 3);
  if (n.telegram?.enabled) out.telegram = await sendTelegram(rec, n.telegram);
  if (n.webhook?.enabled) out.webhook = await sendWebhook(rec, n.webhook);
  return out;
}
