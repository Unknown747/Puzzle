import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseFlags } from '../src/index.js';

test('parseFlags: value flag', () => {
  const f = parseFlags(['--puzzle', '20', '--strategy', 'stride']);
  assert.equal(f.puzzle, '20');
  assert.equal(f.strategy, 'stride');
});

test('parseFlags: boolean flag tidak menelan flag berikutnya', () => {
  const f = parseFlags(['--no-resume', '--puzzle', '5']);
  assert.equal(f['no-resume'], true);
  assert.equal(f.puzzle, '5');
});

test('parseFlags: trailing boolean flag', () => {
  const f = parseFlags(['--puzzle', '5', '--no-resume']);
  assert.equal(f['no-resume'], true);
});

test('parseFlags: ignore positional args', () => {
  const f = parseFlags(['extra', '--puzzle', '5', 'tail']);
  assert.equal(f.puzzle, '5');
});
