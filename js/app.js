/* Spelling Bee BD - DOM wiring. Plain script, no framework, fully offline. */
(function () {
  'use strict';

  var WORDS = window.BEE_DATA.WORDS;
  var STRINGS = window.BEE_I18N.STRINGS;
  var C = window.BEE_CORE;

  var $ = function (id) { return document.getElementById(id); };

  // ---------- state ----------
  function loadState() {
    try {
      var raw = localStorage.getItem(C.STORAGE_KEY);
      if (!raw) return C.defaultState();
      var s = JSON.parse(raw);
      var err = C.validateState(s);
      if (err) return C.defaultState();
      return s;
    } catch (e) { return C.defaultState(); }
  }
  var state = loadState();
  function save() {
    try { localStorage.setItem(C.STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* storage full/blocked */ }
  }

  // ---------- i18n ----------
  function t(key) {
    var entry = STRINGS[key];
    if (!entry) return key;
    return entry[state.lang] || entry.en;
  }
  function num(n) { return C.fmtNum(n, state.lang); }

  var TEXT_IDS = {
    appTitle: 'appTitle', tagline: 'tagline',
    tabBtnPlay: 'tabPlay', tabBtnPractice: 'tabPractice',
    tabBtnWords: 'tabWords', tabBtnScores: 'tabScores',
    playSetupTitle: 'tabPlay', roundOfText: 'roundOf',
    levelLabel: 'levelLabel', playStartBtn: 'startRound',
    pointsNote: 'levelPoints', howTitle: 'howTitle',
    how1: 'how1', how2: 'how2', how3: 'how3', how4: 'how4',
    livesLabel: 'livesLabel', scoreLabel: 'scoreLabel', streakLabel: 'streakLabel',
    listenBtn: 'listenBtn', flashBtn: 'flashBtn', flashNote: 'flashNote',
    audioNote: 'audioNote', hintBtn: 'hintBtn',
    typeLabel: 'typePlaceholder', submitBtn: 'submitBtn', skipBtn: 'skipBtn',
    nextBtn: 'nextBtn', seeResultsBtn: 'seeResultsBtn',
    resultTitle: 'roundOver', newBest: 'newBest',
    finalScoreLabel: 'finalScore', accuracyLabel: 'accuracyLabel',
    bestStreakLabel: 'bestStreakLabel', missedLabel: 'missedLabel',
    noneMissed: 'noneMissed', playAgainBtn: 'playAgainBtn',
    practiceTitle: 'practiceTitle', practiceLevelLabel: 'levelLabel',
    practiceStartBtn: 'practiceStart', practiceListenBtn: 'listenBtn',
    practiceFlashBtn: 'flashBtn', practiceFlashNote: 'flashNote',
    practiceTypeLabel: 'typePlaceholder', practiceSubmitBtn: 'submitBtn',
    practiceNextBtn: 'practiceNext',
    wordsTitle: 'wordsTitle', bookmarkHint: 'bookmarkHint',
    wordsEmpty: 'emptyWords', scoresTitle: 'scoresTitle',
    roundsPlayedLabel: 'roundsPlayed', totalAccuracyLabel: 'totalAccuracy',
    historyTitle: 'historyTitle', historyEmpty: 'noHistory',
    exportBtn: 'exportBtn', importBtn: 'importBtn', eraseBtn: 'eraseBtn',
    eraseConfirm: 'eraseConfirm', footerText: 'footer'
  };

  function applyI18n() {
    document.documentElement.lang = state.lang === 'bn' ? 'bn' : 'en';
    Object.keys(TEXT_IDS).forEach(function (id) {
      var el = $(id);
      if (el) el.textContent = t(TEXT_IDS[id]);
    });
    $('langBtn').textContent = state.lang === 'bn' ? 'English' : 'বাংলা';
    // level option labels (both selects)
    [['playLevel', 'level'], ['practiceLevel', 'level']].forEach(function (pair) {
      var sel = $(pair[0]);
      if (!sel) return;
      var labels = { easy: t('levelEasy'), medium: t('levelMedium'), hard: t('levelHard'), mixed: t('levelMixed') };
      Array.prototype.forEach.call(sel.options, function (opt) { opt.textContent = labels[opt.value] || opt.value; });
    });
    $('wordLevel').options[0].textContent = t('filterAll');
    $('wordLevel').options[1].textContent = t('levelEasy');
    $('wordLevel').options[2].textContent = t('levelMedium');
    $('wordLevel').options[3].textContent = t('levelHard');
    $('filterAllBtn').textContent = t('filterAll');
    $('filterBmBtn').textContent = t('filterBookmarked');
    $('spellInput').placeholder = t('typePlaceholder');
    $('practiceInput').placeholder = t('typePlaceholder');
    $('wordSearch').placeholder = t('searchPlaceholder');
    $('eraseInput').placeholder = 'DELETE';
    renderWords();
    renderScores();
    if (round) renderHud();
  }

  $('langBtn').addEventListener('click', function () {
    state.lang = state.lang === 'bn' ? 'en' : 'bn';
    save();
    applyI18n();
  });

  // ---------- tabs ----------
  document.querySelectorAll('.tab').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.tab').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      var tab = btn.getAttribute('data-tab');
      document.querySelectorAll('.panel').forEach(function (p) { p.classList.add('hidden'); });
      $('tab-' + tab).classList.remove('hidden');
      if (tab === 'words') renderWords();
      if (tab === 'scores') renderScores();
    });
  });

  // ---------- speech + flash ----------
  function speak(word) {
    if (!('speechSynthesis' in window)) {
      $('audioNote').classList.remove('hidden');
      return false;
    }
    try {
      window.speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(word);
      u.lang = 'en-US';
      u.rate = 0.8;
      window.speechSynthesis.speak(u);
      $('audioNote').classList.add('hidden');
      return true;
    } catch (e) {
      $('audioNote').classList.remove('hidden');
      return false;
    }
  }

  function flashWord(el, noteEl, word) {
    el.textContent = word;
    el.classList.remove('hidden');
    if (noteEl) noteEl.classList.remove('hidden');
    setTimeout(function () { el.classList.add('hidden'); }, 2000);
  }

  // ---------- PLAY ----------
  var round = null;       // { level, state, timerId, startedAt, answered }
  var roundRecorded = false;

  function currentWord() {
    if (!round) return null;
    return round.state.words[round.state.index] || null;
  }

  function renderHud() {
    if (!round) return;
    var s = round.state;
    $('playProgress').textContent = t('roundWordCount') + ' ' + num(Math.min(s.index + 1, s.words.length)) +
      ' ' + t('ofLabel') + ' ' + num(s.words.length);
    $('playLives').textContent = num(Math.max(s.lives, 0));
    $('playScore').textContent = num(s.score);
    $('playStreak').textContent = num(s.streak);
  }

  function clearTimer() {
    if (round && round.timerId) { clearInterval(round.timerId); round.timerId = null; }
  }

  function startTimer() {
    clearTimer();
    round.startedAt = Date.now();
    var limitMs = C.TIME_PER_WORD_S * 1000;
    var tick = function () {
      if (!round || round.answered) return;
      var left = Math.max(0, Math.ceil((limitMs - (Date.now() - round.startedAt)) / 1000));
      var el = $('playTimer');
      el.textContent = left + 's';
      el.classList.toggle('low', left <= 10);
      if (left <= 0) {
        clearTimer();
        finishWord('timeout', '');
      }
    };
    tick();
    round.timerId = setInterval(tick, 250);
  }

  function presentWord() {
    var w = currentWord();
    if (!w) return;
    round.answered = false;
    $('spellInput').value = '';
    $('spellInput').disabled = false;
    $('submitBtn').disabled = false;
    $('skipBtn').disabled = false;
    $('hintBtn').disabled = false;
    $('hintText').classList.add('hidden');
    $('hintText').textContent = '';
    $('flashWord').classList.add('hidden');
    $('flashNote').classList.add('hidden');
    $('playFeedback').classList.add('hidden');
    $('playFeedback').textContent = '';
    $('nextBtn').classList.add('hidden');
    $('seeResultsBtn').classList.add('hidden');
    $('playTimer').classList.remove('low');
    renderHud();
    speak(w.en);
    startTimer();
    $('spellInput').focus();
  }

  function feedbackHtml(ok, msgKey, word) {
    var fb = $('playFeedback');
    fb.className = 'feedback ' + (ok ? 'ok' : 'bad');
    fb.innerHTML = '';
    var msg = document.createElement('span');
    msg.textContent = t(msgKey);
    fb.appendChild(msg);
    if (word) {
      var wEl = document.createElement('span');
      wEl.className = 'fb-word';
      wEl.textContent = word.en;
      fb.appendChild(wEl);
      var mEl = document.createElement('span');
      mEl.className = 'fb-mean';
      mEl.textContent = t('meaningLabel') + ': ' + word.bn + ' — ' + t('exampleLabel') + ': ' + word.ex + ' (' + word.exBn + ')';
      fb.appendChild(mEl);
    }
    fb.classList.remove('hidden');
  }

  function finishWord(outcome, answer) {
    if (!round || round.answered) return;
    round.answered = true;
    clearTimer();
    var w = currentWord();
    if (!w) return;
    var res = C.applyAnswer(round.state, w, answer, outcome);
    $('spellInput').disabled = true;
    $('submitBtn').disabled = true;
    $('skipBtn').disabled = true;
    $('hintBtn').disabled = true;
    if (res.correct) {
      feedbackHtml(true, 'correctMsg', w);
    } else if (outcome === 'timeout') {
      feedbackHtml(false, 'timeoutMsg', w);
    } else if (outcome === 'skip') {
      feedbackHtml(false, 'skippedMsg', w);
    } else {
      feedbackHtml(false, 'wrongMsg', w);
    }
    renderHud();
    if (round.state.finished) {
      $('seeResultsBtn').classList.remove('hidden');
    } else {
      $('nextBtn').classList.remove('hidden');
    }
  }

  function showResults() {
    clearTimer();
    var s = round.state;
    var prevBest = state.best[round.level] || 0;
    var isNewBest = s.score > prevBest && s.score > 0;
    if (!roundRecorded) {
      state = C.recordRound(state, round.level, {
        score: s.score, correct: s.correct, asked: s.asked, bestStreak: s.bestStreak, missed: s.missed
      });
      save();
      roundRecorded = true;
    }
    $('playGame').classList.add('hidden');
    $('playResult').classList.remove('hidden');
    $('resultTitle').textContent = s.lives <= 0 ? t('noLives') : t('roundOver');
    $('newBest').classList.toggle('hidden', !isNewBest);
    $('resultScore').textContent = num(s.score);
    $('resultAccuracy').textContent = num(C.accuracy(s.correct, s.asked)) + '%';
    $('resultStreak').textContent = num(s.bestStreak);
    var list = $('resultMissed');
    list.innerHTML = '';
    $('noneMissed').classList.toggle('hidden', s.missed.length !== 0);
    s.missed.forEach(function (id) {
      var w = WORDS.find(function (x) { return x.id === id; });
      if (!w) return;
      var li = document.createElement('li');
      var b = document.createElement('b');
      b.textContent = w.en;
      li.appendChild(b);
      li.appendChild(document.createTextNode(' — ' + w.bn + ' · ' + w.ex));
      list.appendChild(li);
    });
    renderScores();
  }

  $('playStartBtn').addEventListener('click', function () {
    var level = $('playLevel').value;
    var words = C.buildRound(WORDS, level, null);
    round = { level: level, state: C.newRoundState(words), timerId: null, startedAt: 0, answered: false };
    roundRecorded = false;
    $('playSetup').classList.add('hidden');
    $('playResult').classList.add('hidden');
    $('playGame').classList.remove('hidden');
    presentWord();
  });

  $('spellForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var ans = $('spellInput').value;
    if (!ans.trim()) return;
    finishWord('correct', ans);
  });

  $('skipBtn').addEventListener('click', function () { finishWord('skip', ''); });

  $('listenBtn').addEventListener('click', function () {
    var w = currentWord();
    if (w) speak(w.en);
  });

  $('flashBtn').addEventListener('click', function () {
    var w = currentWord();
    if (w) flashWord($('flashWord'), $('flashNote'), w.en);
  });

  $('hintBtn').addEventListener('click', function () {
    var w = currentWord();
    if (!w || !round || round.answered) return;
    round.state.hintUsed = true;
    var h = $('hintText');
    h.textContent = t('hintUsed') + w.bn;
    h.classList.remove('hidden');
    $('hintBtn').disabled = true;
  });

  $('nextBtn').addEventListener('click', presentWord);
  $('seeResultsBtn').addEventListener('click', showResults);
  $('playAgainBtn').addEventListener('click', function () {
    $('playResult').classList.add('hidden');
    $('playSetup').classList.remove('hidden');
    round = null;
  });

  // ---------- PRACTICE ----------
  var practice = null; // { pool, index, correct, asked }

  function practiceNextWord() {
    if (!practice) return;
    if (practice.index >= practice.pool.length) {
      practice.pool = C.shuffleCopy(practice.pool, Math.random);
      practice.index = 0;
    }
    practice.current = practice.pool[practice.index];
    $('practiceInput').value = '';
    $('practiceInput').disabled = false;
    $('practiceSubmitBtn').disabled = false;
    $('practiceFeedback').classList.add('hidden');
    $('practiceFeedback').textContent = '';
    $('practiceNextBtn').classList.add('hidden');
    $('practiceFlashWord').classList.add('hidden');
    $('practiceFlashNote').classList.add('hidden');
    $('practiceCount').textContent = t('practiceDone') + ' ' + num(practice.asked) + ' · ' +
      num(practice.correct) + ' ' + t('practiceCorrect');
    speak(practice.current.en);
    $('practiceInput').focus();
  }

  $('practiceStartBtn').addEventListener('click', function () {
    var level = $('practiceLevel').value;
    var pool = C.shuffleCopy(C.wordsForLevel(WORDS, level), Math.random);
    practice = { pool: pool, index: 0, correct: 0, asked: 0, current: null };
    $('practiceSetup').classList.add('hidden');
    $('practiceGame').classList.remove('hidden');
    practiceNextWord();
  });

  $('practiceForm').addEventListener('submit', function (e) {
    e.preventDefault();
    if (!practice || !practice.current) return;
    var ans = $('practiceInput').value;
    if (!ans.trim()) return;
    var w = practice.current;
    var ok = C.isCorrect(w, ans);
    practice.asked += 1;
    state.practiceAsked = (state.practiceAsked || 0) + 1;
    if (ok) {
      practice.correct += 1;
      state.practiceCorrect = (state.practiceCorrect || 0) + 1;
    }
    save();
    $('practiceInput').disabled = true;
    $('practiceSubmitBtn').disabled = true;
    var fb = $('practiceFeedback');
    fb.className = 'feedback ' + (ok ? 'ok' : 'bad');
    fb.innerHTML = '';
    var msg = document.createElement('span');
    msg.textContent = ok ? t('correctMsg') : t('wrongMsg');
    fb.appendChild(msg);
    var wEl = document.createElement('span');
    wEl.className = 'fb-word';
    wEl.textContent = w.en;
    fb.appendChild(wEl);
    var mEl = document.createElement('span');
    mEl.className = 'fb-mean';
    mEl.textContent = t('meaningLabel') + ': ' + w.bn + ' — ' + t('exampleLabel') + ': ' + w.ex + ' (' + w.exBn + ')';
    fb.appendChild(mEl);
    fb.classList.remove('hidden');
    $('practiceCount').textContent = t('practiceDone') + ' ' + num(practice.asked) + ' · ' +
      num(practice.correct) + ' ' + t('practiceCorrect');
    $('practiceNextBtn').classList.remove('hidden');
  });

  $('practiceListenBtn').addEventListener('click', function () {
    if (practice && practice.current) speak(practice.current.en);
  });
  $('practiceFlashBtn').addEventListener('click', function () {
    if (practice && practice.current) flashWord($('practiceFlashWord'), $('practiceFlashNote'), practice.current.en);
  });
  $('practiceNextBtn').addEventListener('click', function () {
    practice.index += 1;
    practiceNextWord();
  });

  // ---------- WORD LIST ----------
  var wordFilter = 'all';
  document.querySelectorAll('[data-filter]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      wordFilter = btn.getAttribute('data-filter');
      document.querySelectorAll('[data-filter]').forEach(function (b) { b.classList.toggle('active', b === btn); });
      renderWords();
    });
  });
  $('wordSearch').addEventListener('input', renderWords);
  $('wordLevel').addEventListener('change', renderWords);

  function renderWords() {
    var list = $('wordList');
    if (!list) return;
    var rows = C.filterWords(WORDS, $('wordSearch').value, $('wordLevel').value, wordFilter, state.bookmarks);
    list.innerHTML = '';
    $('wordsEmpty').classList.toggle('hidden', rows.length !== 0);
    $('wordsCount').textContent = num(rows.length) + ' / ' + num(WORDS.length) + ' ' + t('tabWords');
    rows.forEach(function (w) {
      var row = document.createElement('div');
      row.className = 'word-row';
      var head = document.createElement('button');
      head.className = 'w-head';
      head.type = 'button';
      var en = document.createElement('span');
      en.className = 'w-en';
      en.textContent = w.en;
      var lv = document.createElement('span');
      lv.className = 'w-level ' + w.level;
      lv.textContent = t('level' + w.level.charAt(0).toUpperCase() + w.level.slice(1));
      var bm = document.createElement('span');
      bm.className = 'w-bm';
      bm.textContent = state.bookmarks.indexOf(w.id) !== -1 ? '★' : '☆';
      bm.title = 'bookmark';
      head.appendChild(en);
      head.appendChild(lv);
      head.appendChild(bm);
      var body = document.createElement('div');
      body.className = 'w-body hidden';
      var m = document.createElement('p');
      m.textContent = t('meaningLabel') + ': ' + w.bn;
      var ex = document.createElement('p');
      ex.textContent = t('exampleLabel') + ': ' + w.ex + ' (' + w.exBn + ')';
      body.appendChild(m);
      body.appendChild(ex);
      head.addEventListener('click', function (e) {
        if (e.target === bm) {
          state.bookmarks = C.toggleId(state.bookmarks, w.id);
          save();
          renderWords();
          return;
        }
        body.classList.toggle('hidden');
      });
      row.appendChild(head);
      row.appendChild(body);
      list.appendChild(row);
    });
  }

  // ---------- SCORES ----------
  function renderScores() {
    $('bestEasy').textContent = num(state.best.easy || 0);
    $('bestMedium').textContent = num(state.best.medium || 0);
    $('bestHard').textContent = num(state.best.hard || 0);
    $('bestMixed').textContent = num(state.best.mixed || 0);
    $('statRounds').textContent = num(state.rounds || 0);
    $('statAccuracy').textContent = num(C.accuracy(state.totalCorrect, state.totalAsked)) + '%';
    var list = $('historyList');
    list.innerHTML = '';
    $('historyEmpty').classList.toggle('hidden', state.history.length !== 0);
    state.history.forEach(function (h) {
      var li = document.createElement('li');
      var left = document.createElement('span');
      left.textContent = h.date + ' · ' + t('level' + h.level.charAt(0).toUpperCase() + h.level.slice(1));
      var right = document.createElement('span');
      right.textContent = t('scoreLabel') + ' ' + num(h.score) + ' · ' + num(h.correct) + '/' + num(h.asked) +
        ' · 🔥 ' + num(h.bestStreak || 0);
      li.appendChild(left);
      li.appendChild(right);
      list.appendChild(li);
    });
  }

  $('exportBtn').addEventListener('click', function () {
    var blob = new Blob([JSON.stringify({ app: 'spelling-bee-bd', version: 1, exportedAt: new Date().toISOString(), state: state }, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'spelling-bee-bd-backup.json';
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
    $('dataMsg').textContent = t('exportedAt') + ': ' + new Date().toLocaleDateString();
  });

  $('importBtn').addEventListener('click', function () { $('importFile').click(); });
  $('importFile').addEventListener('change', function () {
    var file = $('importFile').files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(reader.result);
        if (!data || data.app !== 'spelling-bee-bd' || !data.state) throw new Error('bad app');
        var err = C.validateState(data.state);
        if (err) throw new Error(err);
        state = data.state;
        save();
        applyI18n();
        $('dataMsg').textContent = t('importOk');
      } catch (e) {
        $('dataMsg').textContent = t('importBad');
      }
      $('importFile').value = '';
    };
    reader.readAsText(file);
  });

  $('eraseBtn').addEventListener('click', function () {
    $('eraseBox').classList.remove('hidden');
    $('eraseInput').value = '';
    $('eraseInput').focus();
  });
  $('eraseCancelBtn').addEventListener('click', function () {
    $('eraseBox').classList.add('hidden');
    $('dataMsg').textContent = t('eraseCancel');
  });
  $('eraseConfirmBtn').addEventListener('click', function () {
    if ($('eraseInput').value.trim() !== 'DELETE') {
      $('dataMsg').textContent = t('eraseConfirm');
      return;
    }
    state = C.defaultState();
    save();
    $('eraseBox').classList.add('hidden');
    applyI18n();
    $('dataMsg').textContent = t('eraseDone');
  });

  // ---------- init ----------
  applyI18n();
  window.BEE_APP = {
    getState: function () { return state; },
    getRound: function () { return round; },
    getPractice: function () { return practice; }
  };
})();
