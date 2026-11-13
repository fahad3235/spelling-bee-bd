/* Spelling Bee BD - Node unit tests (no DOM).
   Run: node --test tests/unit.test.mjs */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function load(rel, names) {
  const ctx = { console };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), ctx);
  const out = {};
  for (const n of names) out[n] = vm.runInContext(n, ctx);
  return out;
}

const { WORDS } = load('js/data.js', ['WORDS']);
const { STRINGS } = load('js/i18n.js', ['STRINGS']);
const { BEE_CORE: C } = load('js/core.js', ['BEE_CORE']);

test('word list: 60 words, 20 per level, unique ids/words, valid fields', () => {
  assert.equal(WORDS.length, 60);
  for (const lv of ['easy', 'medium', 'hard']) {
    assert.equal(WORDS.filter((w) => w.level === lv).length, 20, lv);
  }
  assert.deepEqual([...C.validateWords(WORDS)], []);
  const ens = new Set(WORDS.map((w) => w.en));
  assert.equal(ens.size, 60);
});

test('word list: no overlap with vocabulary-bd word list', () => {
  const vocab = fs.readFileSync(
    path.join(process.env.HOME, 'workspace/muse-project-factory/builds/vocabulary-bd/js/data.js'), 'utf8');
  const vocabWords = new Set([...vocab.matchAll(/"en": "([a-z]+)"/g)].map((m) => m[1]));
  const overlap = WORDS.filter((w) => vocabWords.has(w.en)).map((w) => w.en);
  assert.deepEqual([...overlap], []);
});

test('grading: case-insensitive, trims whitespace', () => {
  const w = WORDS.find((x) => x.en === 'necessary');
  assert.equal(C.isCorrect(w, 'necessary'), true);
  assert.equal(C.isCorrect(w, 'Necessary'), true);
  assert.equal(C.isCorrect(w, '  necessary  '), true);
  assert.equal(C.isCorrect(w, 'neccessary'), false);
  assert.equal(C.isCorrect(w, ''), false);
});

test('scoring: base points per level, streak bonus capped at +5, hint halves', () => {
  const easy = WORDS.find((w) => w.level === 'easy');
  const med = WORDS.find((w) => w.level === 'medium');
  const hard = WORDS.find((w) => w.level === 'hard');
  assert.equal(C.pointsFor(easy, 1, false), 10);
  assert.equal(C.pointsFor(med, 1, false), 15);
  assert.equal(C.pointsFor(hard, 1, false), 20);
  assert.equal(C.pointsFor(easy, 3, false), 12); // streak 3 -> +2
  assert.equal(C.pointsFor(easy, 10, false), 15); // capped +5
  assert.equal(C.pointsFor(med, 2, true), 8); // (15+1)/2 floor
  assert.equal(C.pointsFor(hard, 1, true), 10);
});

test('round building: 10 words, level pools, deterministic with seed', () => {
  const r1 = C.buildRound(WORDS, 'easy', 42);
  const r2 = C.buildRound(WORDS, 'easy', 42);
  assert.equal(r1.length, 10);
  assert.ok(r1.every((w) => w.level === 'easy'));
  assert.deepEqual(r1.map((w) => w.id), r2.map((w) => w.id));
  const r3 = C.buildRound(WORDS, 'easy', 43);
  assert.notDeepEqual(r1.map((w) => w.id), r3.map((w) => w.id));
  const mixed = C.buildRound(WORDS, 'mixed', 7);
  assert.equal(mixed.length, 10);
  assert.ok(new Set(mixed.map((w) => w.level)).size > 1);
});

test('round flow: correct answers grow score+streak; wrong loses a life and resets streak', () => {
  const words = C.buildRound(WORDS, 'easy', 1);
  const st = C.newRoundState(words);
  assert.equal(st.lives, 3);
  const r1 = C.applyAnswer(st, words[0], words[0].en, 'correct');
  assert.equal(r1.correct, true);
  assert.equal(r1.points, 10);
  assert.equal(st.score, 10);
  assert.equal(st.streak, 1);
  const r2 = C.applyAnswer(st, words[1], words[1].en, 'correct');
  assert.equal(r2.points, 11); // streak 2 -> +1
  assert.equal(st.streak, 2);
  const r3 = C.applyAnswer(st, words[2], 'wrong', 'correct');
  assert.equal(r3.correct, false);
  assert.equal(st.lives, 2);
  assert.equal(st.streak, 0);
  assert.deepEqual([...st.missed], [words[2].id]);
  assert.equal(st.asked, 3);
  assert.equal(st.correct, 2);
});

test('round flow: skip and timeout cost a life; 3 misses end the round', () => {
  const words = C.buildRound(WORDS, 'medium', 5);
  const st = C.newRoundState(words);
  C.applyAnswer(st, words[0], '', 'skip');
  assert.equal(st.lives, 2);
  C.applyAnswer(st, words[1], '', 'timeout');
  assert.equal(st.lives, 1);
  C.applyAnswer(st, words[2], 'nope', 'correct');
  assert.equal(st.lives, 0);
  assert.equal(st.finished, true);
  assert.deepEqual([...st.missed], [words[0].id, words[1].id, words[2].id]);
});

test('round flow: finishing all 10 words ends the round; hint halves that word', () => {
  const words = C.buildRound(WORDS, 'hard', 9);
  const st = C.newRoundState(words);
  st.hintUsed = true;
  const r = C.applyAnswer(st, words[0], words[0].en, 'correct');
  assert.equal(r.points, 10); // 20 halved
  for (let i = 1; i < 10; i++) C.applyAnswer(st, words[i], words[i].en, 'correct');
  assert.equal(st.finished, true);
  assert.equal(st.index, 10);
  assert.equal(st.correct, 10);
  assert.equal(C.accuracy(st.correct, st.asked), 100);
});

test('timer: 45s per word boundary', () => {
  assert.equal(C.isTimedOut(1000, 1000 + 44 * 1000), false);
  assert.equal(C.isTimedOut(1000, 1000 + 45 * 1000), true);
  assert.equal(C.isTimedOut(1000, 1000 + 60 * 1000), true);
});

test('accuracy: 0 asked -> 0, rounding', () => {
  assert.equal(C.accuracy(0, 0), 0);
  assert.equal(C.accuracy(7, 10), 70);
  assert.equal(C.accuracy(1, 3), 33);
  assert.equal(C.accuracy(2, 3), 67);
});

test('state: recordRound updates best, totals, history (capped at 20)', () => {
  let s = C.defaultState();
  s = C.recordRound(s, 'easy', { score: 50, correct: 5, asked: 10, bestStreak: 3, missed: [] });
  assert.equal(s.rounds, 1);
  assert.equal(s.best.easy, 50);
  assert.equal(s.totalCorrect, 5);
  assert.equal(s.totalAsked, 10);
  assert.equal(s.history.length, 1);
  s = C.recordRound(s, 'easy', { score: 30, correct: 3, asked: 10, bestStreak: 2, missed: [] });
  assert.equal(s.best.easy, 50); // lower score does not replace best
  for (let i = 0; i < 25; i++) {
    s = C.recordRound(s, 'mixed', { score: i, correct: 1, asked: 1, bestStreak: 1, missed: [] });
  }
  assert.equal(s.history.length, 20);
  assert.equal(C.validateState(s), null);
});

test('state validation rejects bad shapes', () => {
  assert.notEqual(C.validateState(null), null);
  assert.notEqual(C.validateState({ ...C.defaultState(), lang: 'fr' }), null);
  assert.notEqual(C.validateState({ ...C.defaultState(), bookmarks: ['x'] }), null);
  assert.notEqual(C.validateState({ ...C.defaultState(), history: [{ score: 'x' }] }), null);
  assert.equal(C.validateState(C.defaultState()), null);
});

test('filterWords: level, bookmark tab, EN/BN query', () => {
  assert.equal(C.filterWords(WORDS, '', 'all', 'all', []).length, 60);
  assert.equal(C.filterWords(WORDS, '', 'easy', 'all', []).length, 20);
  assert.equal(C.filterWords(WORDS, 'rhythm', 'all', 'all', []).length, 1);
  assert.equal(C.filterWords(WORDS, 'ছন্দ', 'all', 'all', []).length, 1);
  assert.equal(C.filterWords(WORDS, '', 'all', 'bookmarked', [1, 2]).length, 2);
  assert.equal(C.filterWords(WORDS, 'zzzz', 'all', 'all', []).length, 0);
});

test('toggleId adds then removes', () => {
  assert.deepEqual(C.toggleId([], 5), [5]);
  assert.deepEqual(C.toggleId([5], 5), []);
  assert.deepEqual(C.toggleId([1, 2], 3), [1, 2, 3]);
});

test('i18n: parity across EN/BN, no empty strings', () => {
  const keys = Object.keys(STRINGS);
  assert.ok(keys.length >= 60, 'keys: ' + keys.length);
  for (const k of keys) {
    assert.equal(typeof STRINGS[k].en, 'string', k);
    assert.equal(typeof STRINGS[k].bn, 'string', k);
    assert.ok(STRINGS[k].en.length > 0, k);
    assert.ok(STRINGS[k].bn.length > 0, k);
  }
});

test('i18n: Bengali digits', () => {
  assert.equal(C.toBnDigits('123'), '১২৩');
  assert.equal(C.toBnDigits('45s'), '৪৫s');
  assert.equal(C.fmtNum(10, 'bn'), '১০');
  assert.equal(C.fmtNum(10, 'en'), '10');
});

test('generated JS is pure ASCII (push-safe)', () => {
  for (const rel of ['js/data.js', 'js/i18n.js']) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.ok(!/[^\x00-\x7F]/.test(src), rel + ' contains non-ASCII');
  }
});
