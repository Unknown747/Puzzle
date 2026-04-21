// Tiny ANSI helpers + redrawable status block. Falls back to plain text
// when stdout is not a TTY (so workflow logs stay readable).

const TTY = process.stdout.isTTY;

const C = {
  reset: TTY ? '\x1b[0m' : '',
  dim: TTY ? '\x1b[2m' : '',
  bold: TTY ? '\x1b[1m' : '',
  cyan: TTY ? '\x1b[36m' : '',
  green: TTY ? '\x1b[32m' : '',
  yellow: TTY ? '\x1b[33m' : '',
  red: TTY ? '\x1b[31m' : '',
  blue: TTY ? '\x1b[34m' : '',
  magenta: TTY ? '\x1b[35m' : '',
  gray: TTY ? '\x1b[90m' : '',
};

export const color = C;

export function bold(s) { return C.bold + s + C.reset; }
export function dim(s) { return C.dim + s + C.reset; }
export function cyan(s) { return C.cyan + s + C.reset; }
export function green(s) { return C.green + s + C.reset; }
export function yellow(s) { return C.yellow + s + C.reset; }
export function red(s) { return C.red + s + C.reset; }
export function gray(s) { return C.gray + s + C.reset; }

export function fmtNum(n) {
  if (typeof n === 'bigint') return n.toLocaleString('en-US');
  return Number(n).toLocaleString('en-US');
}

export function fmtRate(n) {
  if (!isFinite(n) || n <= 0) return '0/s';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'G/s';
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M/s';
  if (n >= 1e3) return (n / 1e3).toFixed(2) + 'k/s';
  return n.toFixed(0) + '/s';
}

export function fmtETA(seconds) {
  if (!isFinite(seconds) || seconds < 0) return '∞';
  const y = seconds / (365.25 * 86400);
  if (y > 1e6) return y.toExponential(2) + ' tahun';
  if (y > 1) return y.toFixed(1) + ' tahun';
  const d = seconds / 86400;
  if (d > 1) return d.toFixed(1) + ' hari';
  const h = seconds / 3600;
  if (h > 1) return h.toFixed(1) + ' jam';
  const m = seconds / 60;
  if (m > 1) return m.toFixed(1) + ' menit';
  return seconds.toFixed(1) + ' detik';
}

export function progressBar(ratio, width = 28) {
  const r = Math.max(0, Math.min(1, ratio));
  const filled = Math.round(r * width);
  const empty = width - filled;
  const bar = C.green + '█'.repeat(filled) + C.gray + '░'.repeat(empty) + C.reset;
  return `[${bar}]`;
}

export function box(title, lines, width = 60) {
  const top = '╔' + '═'.repeat(width - 2) + '╗';
  const bot = '╚' + '═'.repeat(width - 2) + '╝';
  const sep = '╟' + '─'.repeat(width - 2) + '╢';
  const pad = (s) => {
    const visible = s.replace(/\x1b\[[0-9;]*m/g, '');
    const space = Math.max(0, width - 4 - visible.length);
    return '║ ' + s + ' '.repeat(space) + ' ║';
  };
  const out = [C.cyan + top, pad(bold(title)), C.cyan + sep];
  for (const l of lines) out.push(C.cyan + pad(l));
  out.push(C.cyan + bot + C.reset);
  return out.join('\n');
}

/**
 * Redrawable multi-line status block.
 * On TTY: re-renders in place using cursor moves.
 * On non-TTY: prints a single \r-updated line.
 */
export function createLiveBlock() {
  let lastHeight = 0;
  let firstWrite = true;

  return {
    render(lines) {
      if (!TTY) {
        const flat = lines.join(' · ').replace(/\x1b\[[0-9;]*m/g, '');
        process.stdout.write('\r' + flat.padEnd(120) + ' ');
        return;
      }
      let out = '';
      if (!firstWrite && lastHeight > 0) {
        out += `\x1b[${lastHeight}A`; // move up
      }
      for (const l of lines) {
        out += '\x1b[2K' + l + '\n'; // clear line + content
      }
      process.stdout.write(out);
      lastHeight = lines.length;
      firstWrite = false;
    },
    finalize() {
      if (!TTY) process.stdout.write('\n');
    },
  };
}

export function banner(title, subtitle = '') {
  const w = Math.max(title.length, subtitle.length) + 6;
  const line = '═'.repeat(w);
  console.log(C.cyan + '╔' + line + '╗');
  console.log(C.cyan + '║   ' + bold(title) + ' '.repeat(w - title.length - 3) + C.cyan + '║');
  if (subtitle) {
    console.log(C.cyan + '║   ' + dim(subtitle) + ' '.repeat(w - subtitle.length - 3) + C.cyan + '║');
  }
  console.log(C.cyan + '╚' + line + '╝' + C.reset);
}
