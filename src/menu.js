import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { bold, cyan, green, yellow, dim, gray } from './ui.js';

export function createPrompt() {
  const rl = readline.createInterface({ input, output });
  return {
    async ask(question, defaultValue = '') {
      const hint = defaultValue !== '' ? dim(` [${defaultValue}]`) : '';
      const ans = (await rl.question(cyan('? ') + question + hint + ' ')).trim();
      return ans === '' ? defaultValue : ans;
    },
    async choose(question, options) {
      console.log(cyan('? ') + question);
      options.forEach((o, i) => {
        console.log('  ' + bold(String(i + 1).padStart(2)) + dim(') ') + o.label);
      });
      while (true) {
        const a = (await rl.question(dim('  pilih nomor: '))).trim();
        const n = Number(a);
        if (n >= 1 && n <= options.length) return options[n - 1].value;
        console.log(yellow('  pilihan tidak valid, coba lagi.'));
      }
    },
    close() { rl.close(); },
  };
}

export function printMenuHeader(puzzleStats) {
  console.log('');
  console.log(cyan('╔══════════════════════════════════════════════════════════╗'));
  console.log(cyan('║  ') + bold('BTC PUZZLE HUNTER v2') + cyan('                                    ║'));
  console.log(cyan('║  ') + dim('multi-worker · checkpointed · scraper') + cyan('                   ║'));
  console.log(cyan('╠══════════════════════════════════════════════════════════╣'));
  console.log(cyan('║  ') + dim(`Target: ${puzzleStats.total} puzzle  · `) +
    yellow(`${puzzleStats.open} terbuka`) + dim(', ') +
    green(`${puzzleStats.solved} terpecahkan`) +
    cyan('              ║'));
  console.log(cyan('╚══════════════════════════════════════════════════════════╝'));
}

export function printMenuOptions() {
  console.log('\n' + bold('Pilih aksi:') + '\n');
  const items = [
    ['1', 'Hunt puzzle      ', dim('(brute-force / BSGS otomatis)')],
    ['2', 'Scrape saldo     ', dim('(snapshot semua wallet target)')],
    ['3', 'Watch mode       ', dim('(monitor saldo real-time)')],
    ['4', 'List puzzle      ', dim('(daftar semua target)')],
    ['5', 'Verify           ', dim('(sanity check sistem)')],
    ['6', 'Help             ', dim('(daftar perintah CLI)')],
    ['0', 'Keluar           ', ''],
  ];
  for (const [n, label, hint] of items) {
    console.log('  ' + bold(n) + dim(')  ') + label + ' ' + hint);
  }
  console.log('');
}
