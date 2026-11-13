/* Spelling Bee BD - headless-Chrome smoke tests via raw CDP (no deps).
   Run: node tests/smoke.mjs [width]   (default 1280; pass 390 for mobile)
   Uses the Playwright-cached headless_shell. Serves the app over file:// */
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SHELL = path.join(process.env.HOME, '.cache/ms-playwright/chromium_headless_shell-1187/chrome-linux/headless_shell');
const WIDTH = parseInt(process.argv[2] || '1280', 10);
const HEIGHT = 900;
const PORT = 9336;

let failures = [];
let checks = 0;
function check(name, cond, extra = '') {
  checks++;
  if (cond) console.log('  PASS ' + name);
  else { failures.push(name + (extra ? ' — ' + extra : '')); console.log('  FAIL ' + name + (extra ? ' — ' + extra : '')); }
}

const chrome = spawn(SHELL, [
  '--headless=new', '--no-sandbox', '--disable-gpu',
  `--remote-debugging-port=${PORT}`, `--window-size=${WIDTH},${HEIGHT}`,
  'about:blank'
], { stdio: 'ignore' });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getWsUrl() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      const j = await res.json();
      return j.webSocketDebuggerUrl;
    } catch { await sleep(250); }
  }
  throw new Error('CDP did not start');
}

async function main() {
  const browserWs = new WebSocket(await getWsUrl());
  await new Promise((res, rej) => { browserWs.onopen = res; browserWs.onerror = rej; });
  let msgId = 0;
  const pending = new Map();
  const events = [];
  browserWs.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
    else if (m.method) events.push(m);
  };
  const send = (method, params = {}) => new Promise((res) => {
    const id = ++msgId;
    pending.set(id, res);
    browserWs.send(JSON.stringify({ id, method, params }));
  });

  const target = await send('Target.createTarget', { url: 'about:blank' });
  const targetId = target.result.targetId;
  const attached = await send('Target.attachToTarget', { targetId, flatten: true });
  const sessionId = attached.result.sessionId;
  const sendS = (method, params = {}) => new Promise((res) => {
    const id = ++msgId;
    pending.set(id, res);
    browserWs.send(JSON.stringify({ id, sessionId, method, params }));
  });

  await sendS('Runtime.enable');
  await sendS('Page.enable');
  await sendS('Network.enable');
  await sendS('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: WIDTH <= 500 });

  const consoleErrors = [];
  const pageErrors = [];
  const extRequests = [];
  const origOnMessage = browserWs.onmessage;
  browserWs.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.sessionId === sessionId && m.method === 'Runtime.exceptionThrown') {
      pageErrors.push(m.params.exceptionDetails.text + ' ' + (m.params.exceptionDetails.exception?.description || ''));
    }
    if (m.sessionId === sessionId && m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
      consoleErrors.push(m.params.args.map((a) => a.value || a.description || '').join(' '));
    }
    if (m.sessionId === sessionId && m.method === 'Network.requestWillBeSent') {
      const url = m.params.request.url;
      if (!url.startsWith('file://') && !url.startsWith('data:') && !url.startsWith('blob:') && !url.startsWith('chrome')) {
        extRequests.push(url);
      }
    }
    origOnMessage(ev);
  };

  const evalJs = async (expr) => {
    const r = await sendS('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true });
    if (r.result?.exceptionDetails) throw new Error('eval failed: ' + JSON.stringify(r.result.exceptionDetails));
    return r.result?.result?.value;
  };

  const fileUrl = 'file://' + path.join(ROOT, 'index.html');
  await sendS('Page.navigate', { url: fileUrl });
  await sleep(1200);

  console.log(`== smoke @ ${WIDTH}px ==`);

  const typeAnswer = async (inputId, text) => {
    await evalJs(`(function(){ const el = document.getElementById('${inputId}'); el.value = ${JSON.stringify(text)}; el.dispatchEvent(new Event('input')); })()`);
  };
  const roundWord = async () => await evalJs(`window.BEE_APP.getRound().state.words[window.BEE_APP.getRound().state.index].en`);

  check('page title', (await evalJs('document.title')).includes('Spelling Bee BD'));
  check('h1 renders', (await evalJs(`document.querySelector('h1').textContent`)) === 'Spelling Bee BD');
  check('4 tabs present', (await evalJs(`document.querySelectorAll('.tab').length`)) === 4);
  check('setup panel visible, game hidden', (await evalJs(`!document.getElementById('playSetup').classList.contains('hidden') && document.getElementById('playGame').classList.contains('hidden')`)) === true);
  check('no horizontal overflow (setup)', (await evalJs('document.documentElement.scrollWidth')) <= WIDTH + 1,
    'scrollWidth=' + (await evalJs('document.documentElement.scrollWidth')));

  // --- start an Easy round; word 1 correct ---
  await evalJs(`document.getElementById('playStartBtn').click()`);
  await sleep(300);
  check('game panel shows after start', (await evalJs(`document.getElementById('playGame').classList.contains('hidden')`)) === false);
  check('progress Word 1 of 10', (await evalJs(`document.getElementById('playProgress').textContent`)).includes('1 of 10'),
    await evalJs(`document.getElementById('playProgress').textContent`));
  check('3 lives at start', (await evalJs(`document.getElementById('playLives').textContent`)) === '3');
  check('timer shows seconds', /^\d+s$/.test(await evalJs(`document.getElementById('playTimer').textContent`)),
    await evalJs(`document.getElementById('playTimer').textContent`));

  // flash word shows the current word, then hides
  await evalJs(`document.getElementById('flashBtn').click()`);
  await sleep(150);
  const flashed = await evalJs(`document.getElementById('flashWord').textContent`);
  check('flash reveals current word', flashed === (await roundWord()), flashed);
  await sleep(2100);
  check('flash hides after 2s', (await evalJs(`document.getElementById('flashWord').classList.contains('hidden')`)) === true);

  // word 1: correct spelling
  await typeAnswer('spellInput', await roundWord());
  await evalJs(`document.getElementById('submitBtn').click()`);
  await sleep(200);
  check('correct feedback says Correct', (await evalJs(`document.getElementById('playFeedback').textContent`)).includes('Correct'),
    await evalJs(`document.getElementById('playFeedback').textContent`));
  check('feedback shows meaning', (await evalJs(`document.getElementById('playFeedback').textContent`)).includes('Meaning'),
    await evalJs(`document.getElementById('playFeedback').textContent`));
  check('score is 10 after first easy word', (await evalJs(`window.BEE_APP.getRound().state.score`)) === 10);
  check('next button appears', (await evalJs(`document.getElementById('nextBtn').classList.contains('hidden')`)) === false);

  // word 2: wrong answer
  await evalJs(`document.getElementById('nextBtn').click()`);
  await sleep(200);
  await typeAnswer('spellInput', 'zzzzwrong');
  await evalJs(`document.getElementById('submitBtn').click()`);
  await sleep(200);
  check('wrong feedback names correct spelling', (await evalJs(`document.getElementById('playFeedback').textContent`)).includes('Wrong'),
    await evalJs(`document.getElementById('playFeedback').textContent`));
  check('lives drop to 2 after wrong', (await evalJs(`window.BEE_APP.getRound().state.lives`)) === 2);

  // word 3: skip
  await evalJs(`document.getElementById('nextBtn').click()`);
  await sleep(200);
  await evalJs(`document.getElementById('skipBtn').click()`);
  await sleep(200);
  check('skip feedback says Skipped', (await evalJs(`document.getElementById('playFeedback').textContent`)).includes('Skipped'));
  check('lives drop to 1 after skip', (await evalJs(`window.BEE_APP.getRound().state.lives`)) === 1);

  // word 4: hint then correct (hint halves: 10 -> 5)
  await evalJs(`document.getElementById('nextBtn').click()`);
  await sleep(200);
  await evalJs(`document.getElementById('hintBtn').click()`);
  await sleep(150);
  check('hint reveals Bangla meaning', (await evalJs(`document.getElementById('hintText').textContent.length`)) > 3,
    await evalJs(`document.getElementById('hintText').textContent`));
  await typeAnswer('spellInput', await roundWord());
  await evalJs(`document.getElementById('submitBtn').click()`);
  await sleep(200);
  check('hint-correct scores 5 (halved)', (await evalJs(`window.BEE_APP.getRound().state.score`)) === 15);

  // words 5-10: all correct; streak bonuses 11,12,13,14,15,15 -> total 95
  for (let i = 0; i < 6; i++) {
    await evalJs(`document.getElementById('nextBtn').click()`);
    await sleep(150);
    await typeAnswer('spellInput', await roundWord());
    await evalJs(`document.getElementById('submitBtn').click()`);
    await sleep(150);
  }
  check('final score 95 (10+5+11+12+13+14+15+15)', (await evalJs(`window.BEE_APP.getRound().state.score`)) === 95);
  check('see-results button appears', (await evalJs(`document.getElementById('seeResultsBtn').classList.contains('hidden')`)) === false);
  await evalJs(`document.getElementById('seeResultsBtn').click()`);
  await sleep(250);
  check('result panel shows', (await evalJs(`document.getElementById('playResult').classList.contains('hidden')`)) === false);
  check('result score 95', (await evalJs(`document.getElementById('resultScore').textContent`)) === '95',
    await evalJs(`document.getElementById('resultScore').textContent`));
  check('result accuracy 80%', (await evalJs(`document.getElementById('resultAccuracy').textContent`)) === '80%',
    await evalJs(`document.getElementById('resultAccuracy').textContent`));
  check('2 missed words listed', (await evalJs(`document.querySelectorAll('#resultMissed li').length`)) === 2);
  check('new best badge shows', (await evalJs(`document.getElementById('newBest').classList.contains('hidden')`)) === false);
  check('best easy saved 95', (await evalJs(`JSON.parse(localStorage.getItem('spelling-bee-bd-v1')).best.easy`)) === 95);
  check('rounds saved 1', (await evalJs(`JSON.parse(localStorage.getItem('spelling-bee-bd-v1')).rounds`)) === 1);

  // --- practice mode: correct answer, count updates ---
  await evalJs(`document.querySelector('[data-tab="practice"]').click()`);
  await sleep(200);
  await evalJs(`document.getElementById('practiceStartBtn').click()`);
  await sleep(250);
  const pWord = await evalJs(`window.BEE_APP.getPractice().current.en`);
  await typeAnswer('practiceInput', pWord);
  await evalJs(`document.getElementById('practiceSubmitBtn').click()`);
  await sleep(200);
  check('practice correct feedback', (await evalJs(`document.getElementById('practiceFeedback').textContent`)).includes('Correct'));
  check('practice count shows 1 correct', (await evalJs(`document.getElementById('practiceCount').textContent`)).includes('1'),
    await evalJs(`document.getElementById('practiceCount').textContent`));

  // --- word list: search, expand, bookmark filter ---
  await evalJs(`document.querySelector('[data-tab="words"]').click()`);
  await sleep(200);
  check('word list shows 60 rows', (await evalJs(`document.querySelectorAll('#wordList .word-row').length`)) === 60);
  await evalJs(`(function(){ const s = document.getElementById('wordSearch'); s.value = 'rhythm'; s.dispatchEvent(new Event('input')); })()`);
  await sleep(200);
  check('search "rhythm" narrows to 1', (await evalJs(`document.querySelectorAll('#wordList .word-row').length`)) === 1);
  check('expand shows Bangla meaning', await evalJs(`(function(){
    document.querySelector('#wordList .word-row .w-head').click();
    return document.querySelector('#wordList .word-row .w-body').textContent.includes('ছন্দ');
  })()`));
  await evalJs(`(function(){ const s = document.getElementById('wordSearch'); s.value = 'zzzz'; s.dispatchEvent(new Event('input')); })()`);
  await sleep(200);
  check('no-match shows empty state', (await evalJs(`document.getElementById('wordsEmpty').classList.contains('hidden')`)) === false);
  await evalJs(`(function(){ const s = document.getElementById('wordSearch'); s.value = ''; s.dispatchEvent(new Event('input')); document.querySelector('#wordList .word-row .w-bm').click(); })()`);
  await sleep(250);
  check('bookmark persists (1)', (await evalJs(`JSON.parse(localStorage.getItem('spelling-bee-bd-v1')).bookmarks.length`)) === 1);
  await evalJs(`document.querySelector('[data-filter="bookmarked"]').click()`);
  await sleep(200);
  check('bookmarked filter shows 1', (await evalJs(`document.querySelectorAll('#wordList .word-row').length`)) === 1);

  // --- language toggle ---
  await evalJs(`document.getElementById('langBtn').click()`);
  await sleep(250);
  check('BN toggle changes title', (await evalJs(`document.querySelector('h1').textContent`)) === 'স্পেলিং বি বিডি',
    await evalJs(`document.querySelector('h1').textContent`));
  check('BN digits in best score', /[০-৯]/.test(await evalJs(`document.getElementById('bestEasy').textContent`)),
    await evalJs(`document.getElementById('bestEasy').textContent`));
  check('lang persists in localStorage', (await evalJs(`JSON.parse(localStorage.getItem('spelling-bee-bd-v1')).lang`)) === 'bn');
  await evalJs(`document.getElementById('langBtn').click()`);
  await sleep(200);
  check('toggle back to English', (await evalJs(`document.querySelector('h1').textContent`)) === 'Spelling Bee BD');

  // --- scores tab + reload persistence ---
  await evalJs(`document.querySelector('[data-tab="scores"]').click()`);
  await sleep(200);
  check('scores best easy 95', (await evalJs(`document.getElementById('bestEasy').textContent`)) === '95');
  check('scores rounds 1', (await evalJs(`document.getElementById('statRounds').textContent`)) === '1');
  check('scores accuracy 80%', (await evalJs(`document.getElementById('statAccuracy').textContent`)) === '80%');
  check('history lists 1 round', (await evalJs(`document.querySelectorAll('#historyList li').length`)) === 1);
  await sendS('Page.navigate', { url: fileUrl });
  await sleep(1000);
  check('best survives reload', (await evalJs(`JSON.parse(localStorage.getItem('spelling-bee-bd-v1')).best.easy`)) === 95);
  check('no horizontal overflow after reload', (await evalJs('document.documentElement.scrollWidth')) <= WIDTH + 1);

  // --- error / network hygiene ---
  check('zero console errors', consoleErrors.length === 0, consoleErrors.join(' | '));
  check('zero page exceptions', pageErrors.length === 0, pageErrors.join(' | '));
  check('zero non-file network requests', extRequests.length === 0, extRequests.join(', '));

  console.log(`\n${checks - failures.length}/${checks} checks passed${failures.length ? ', FAILURES:\n- ' + failures.join('\n- ') : ''}`);

  browserWs.close();
  chrome.kill();
  process.exit(failures.length ? 1 : 0);
}

main().catch((e) => { console.error('SMOKE CRASH:', e); chrome.kill(); process.exit(1); });
