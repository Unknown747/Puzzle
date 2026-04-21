import fs from 'node:fs';
import path from 'node:path';

const DIR = 'data/checkpoints';

function file(puzzle) {
  return path.join(DIR, `puzzle-${puzzle}.json`);
}

export function load(puzzle) {
  const f = file(puzzle);
  if (!fs.existsSync(f)) return null;
  try {
    return JSON.parse(fs.readFileSync(f, 'utf8'));
  } catch {
    return null;
  }
}

export function save(puzzle, data) {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(file(puzzle), JSON.stringify(data, null, 2));
}

export function clear(puzzle) {
  const f = file(puzzle);
  if (fs.existsSync(f)) fs.unlinkSync(f);
}
