/* Spelling Bee BD - pure logic (no DOM). Shared by the app and the Node tests.
   UMD-style: attaches to window.BEE_CORE in the browser, module.exports in Node. */
(function (root) {
  'use strict';

  var LEVELS = ['easy', 'medium', 'hard'];
  var BASE_POINTS = { easy: 10, medium: 15, hard: 20 };
  var ROUND_WORDS = 10;
  var START_LIVES = 3;
  var TIME_PER_WORD_S = 45;
  var MAX_STREAK_BONUS = 5;
  var HINT_FACTOR = 0.5;
  var STORAGE_KEY = 'spelling-bee-bd-v1';
  var MAX_HISTORY = 20;

  function normalize(s) {
    return String(s == null ? '' : s).trim().toLowerCase().replace(/\s+/g, ' ');
  }

  function isCorrect(word, answer) {
    return normalize(answer) === normalize(word.en);
  }

  function pointsFor(word, streakAfter, hintUsed) {
    // streakAfter = consecutive-correct count including this answer (>=1).
    var base = BASE_POINTS[word.level] || 10;
    var bonus = Math.min(Math.max(streakAfter - 1, 0), MAX_STREAK_BONUS);
    var pts = base + bonus;
    if (hintUsed) pts = Math.floor(pts * HINT_FACTOR);
    return pts;
  }

  function validateWords(words) {
    var errors = [];
    if (!Array.isArray(words)) return ['words is not an array'];
    var ids = new Set();
    var ens = new Set();
    words.forEach(function (w, i) {
      if (typeof w.id !== 'number') errors.push('word[' + i + '] missing numeric id');
      if (ids.has(w.id)) errors.push('duplicate id ' + w.id);
      ids.add(w.id);
      if (!w.en || !/^[a-z]+$/.test(w.en)) errors.push('word[' + i + '] bad en: ' + w.en);
      if (ens.has(w.en)) errors.push('duplicate en ' + w.en);
      ens.add(w.en);
      if (LEVELS.indexOf(w.level) === -1) errors.push('word[' + i + '] bad level: ' + w.level);
      if (!w.bn || typeof w.bn !== 'string') errors.push('word[' + i + '] missing bn');
      if (!w.ex || typeof w.ex !== 'string') errors.push('word[' + i + '] missing ex');
      if (!w.exBn || typeof w.exBn !== 'string') errors.push('word[' + i + '] missing exBn');
    });
    LEVELS.forEach(function (lv) {
      var n = words.filter(function (w) { return w.level === lv; }).length;
      if (n === 0) errors.push('no words at level ' + lv);
    });
    return errors;
  }

  function wordsForLevel(words, level) {
    if (level === 'mixed') return words.slice();
    return words.filter(function (w) { return w.level === level; });
  }

  // Deterministic shuffle (mulberry32) so tests can reproduce a round.
  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffleCopy(arr, rand) {
    var out = arr.slice();
    for (var i = out.length - 1; i > 0; i--) {
      var j = Math.floor(rand() * (i + 1));
      var t = out[i]; out[i] = out[j]; out[j] = t;
    }
    return out;
  }

  function buildRound(words, level, seed) {
    var pool = wordsForLevel(words, level);
    if (pool.length === 0) return [];
    var rand = mulberry32(seed == null ? (Date.now() % 2147483647) : seed);
    var shuffled = shuffleCopy(pool, rand);
    var picked = [];
    var guard = 0;
    while (picked.length < Math.min(ROUND_WORDS, pool.length) && guard < 1000) {
      guard++;
      var w = shuffled[(picked.length + guard - 1) % shuffled.length];
      if (picked.indexOf(w) === -1) picked.push(w);
    }
    return picked.slice(0, Math.min(ROUND_WORDS, pool.length));
  }

  function newRoundState(wordList) {
    return {
      words: wordList,
      index: 0,
      score: 0,
      lives: START_LIVES,
      streak: 0,
      bestStreak: 0,
      correct: 0,
      asked: 0,
      hintUsed: false,
      finished: wordList.length === 0,
      missed: [] // word ids answered wrong / skipped / timed out
    };
  }

  // Apply one answer. outcome: 'correct' | 'wrong' | 'skip' | 'timeout'.
  // Returns { state, points, correct, message } (state mutated in place).
  function applyAnswer(state, word, answer, outcome) {
    var res = { points: 0, correct: false, outcome: outcome };
    state.asked += 1;
    if (outcome === 'correct' && isCorrect(word, answer)) {
      state.streak += 1;
      if (state.streak > state.bestStreak) state.bestStreak = state.streak;
      res.points = pointsFor(word, state.streak, state.hintUsed);
      state.score += res.points;
      state.correct += 1;
      res.correct = true;
    } else {
      state.streak = 0;
      state.lives -= 1;
      if (state.missed.indexOf(word.id) === -1) state.missed.push(word.id);
      res.outcome = outcome === 'correct' ? 'wrong' : outcome;
    }
    state.index += 1;
    state.hintUsed = false;
    if (state.index >= state.words.length || state.lives <= 0) state.finished = true;
    return res;
  }

  function isTimedOut(startedAtMs, nowMs) {
    return nowMs - startedAtMs >= TIME_PER_WORD_S * 1000;
  }

  function accuracy(correct, asked) {
    if (!asked) return 0;
    return Math.round((correct / asked) * 100);
  }

  function defaultState() {
    return {
      lang: 'en',
      bookmarks: [],
      best: { easy: 0, medium: 0, hard: 0, mixed: 0 },
      rounds: 0,
      totalCorrect: 0,
      totalAsked: 0,
      practiceCorrect: 0,
      practiceAsked: 0,
      history: []
    };
  }

  function validateState(s) {
    if (!s || typeof s !== 'object') return 'state must be an object';
    if (s.lang !== 'en' && s.lang !== 'bn') return 'bad lang';
    if (!Array.isArray(s.bookmarks) || s.bookmarks.some(function (x) { return typeof x !== 'number'; })) return 'bad bookmarks';
    if (!s.best || typeof s.best !== 'object') return 'bad best';
    if (LEVELS.concat(['mixed']).some(function (k) { return typeof s.best[k] !== 'number' || s.best[k] < 0; })) return 'bad best values';
    if (typeof s.rounds !== 'number' || s.rounds < 0) return 'bad rounds';
    if (typeof s.totalCorrect !== 'number' || typeof s.totalAsked !== 'number') return 'bad totals';
    if (!Array.isArray(s.history)) return 'bad history';
    for (var i = 0; i < s.history.length; i++) {
      var h = s.history[i];
      if (!h || typeof h !== 'object' || typeof h.score !== 'number' || typeof h.correct !== 'number' ||
          typeof h.asked !== 'number' || LEVELS.concat(['mixed']).indexOf(h.level) === -1) {
        return 'bad history[' + i + ']';
      }
    }
    return null;
  }

  function recordRound(state, level, result) {
    // result: { score, correct, asked, bestStreak, missed }
    var next = JSON.parse(JSON.stringify(state));
    next.rounds += 1;
    next.totalCorrect += result.correct;
    next.totalAsked += result.asked;
    if (result.score > (next.best[level] || 0)) next.best[level] = result.score;
    next.history.unshift({
      date: new Date().toISOString().slice(0, 10),
      level: level,
      score: result.score,
      correct: result.correct,
      asked: result.asked,
      bestStreak: result.bestStreak
    });
    if (next.history.length > MAX_HISTORY) next.history.length = MAX_HISTORY;
    return next;
  }

  function filterWords(words, query, level, tab, bookmarks) {
    var q = normalize(query);
    return words.filter(function (w) {
      if (level && level !== 'all' && w.level !== level) return false;
      if (tab === 'bookmarked' && bookmarks.indexOf(w.id) === -1) return false;
      if (!q) return true;
      return w.en.indexOf(q) !== -1 || normalize(w.bn).indexOf(q) !== -1;
    });
  }

  function toggleId(list, id) {
    var out = list.slice();
    var i = out.indexOf(id);
    if (i === -1) out.push(id); else out.splice(i, 1);
    return out;
  }

  var BN_DIGITS = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  function toBnDigits(s) {
    return String(s).replace(/[0-9]/g, function (d) { return BN_DIGITS[+d]; });
  }
  function fmtNum(n, lang) {
    var s = String(n);
    return lang === 'bn' ? toBnDigits(s) : s;
  }

  var api = {
    LEVELS: LEVELS, BASE_POINTS: BASE_POINTS, ROUND_WORDS: ROUND_WORDS,
    START_LIVES: START_LIVES, TIME_PER_WORD_S: TIME_PER_WORD_S,
    STORAGE_KEY: STORAGE_KEY, MAX_HISTORY: MAX_HISTORY,
    normalize: normalize, isCorrect: isCorrect, pointsFor: pointsFor,
    validateWords: validateWords, wordsForLevel: wordsForLevel,
    shuffleCopy: shuffleCopy, mulberry32: mulberry32, buildRound: buildRound,
    newRoundState: newRoundState, applyAnswer: applyAnswer,
    isTimedOut: isTimedOut, accuracy: accuracy,
    defaultState: defaultState, validateState: validateState,
    recordRound: recordRound, filterWords: filterWords, toggleId: toggleId,
    toBnDigits: toBnDigits, fmtNum: fmtNum
  };

  root.BEE_CORE = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
