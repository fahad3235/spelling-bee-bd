# TEST_RESULTS.md — Spelling Bee BD (run #324)

## Unit tests (Node, no DOM)

Command: `node --test tests/unit.test.mjs`
Result: **17/17 pass, 0 fail**

Covered: word list (60 words, 20 per level, unique ids/words, valid fields);
zero overlap with vocabulary-bd's 90-word list; grading (case-insensitive,
whitespace-trimmed); scoring (10/15/20 base, streak bonus capped at +5, hint
halves with floor); round building (10 words, level pools, deterministic with
seed); round flow (correct grows score+streak, wrong/skip/timeout cost a life
and reset streak, 3 misses end the round, finishing 10 words ends the round);
timer boundary (44s no, 45s yes); accuracy rounding (1/3 = 33%, 2/3 = 67%);
recordRound (best kept on lower score, history capped at 20); state validation
rejections; filterWords (level, bookmark tab, EN/BN query); toggleId; i18n
parity (85 keys EN/BN, no empties); Bengali digit mapping; generated JS is
pure ASCII.

Repairs: 1 test-side fix — cross-realm `deepStrictEqual` on vm-loaded arrays
failed on prototype mismatch; assertions now spread vm arrays into test-realm
arrays first. No app bugs found by the unit tests.

## Smoke tests (headless Chrome, raw CDP, file://)

Command: `node tests/smoke.mjs 1280` and `node tests/smoke.mjs 390`
Result: **51/51 pass at 1280px, 51/51 pass at 390px**

Covered: title/h1/tabs render; setup panel visible, game hidden; no overflow;
start round (progress "1 of 10", 3 lives, timer "45s"); flash word reveals the
current word and hides after 2s; correct answer → "Correct" feedback with
meaning, score 10; wrong answer → feedback names the correct spelling, lives
3 → 2; skip → "Skipped" feedback, lives 2 → 1; hint reveals Bangla meaning and
halves that word's points (score 15 after word 4); full 10-word round finishing
at score 95 (10+5+11+12+13+14+15+15), accuracy 80%, 2 missed words listed,
new-best badge, best easy 95 and rounds 1 saved; practice mode correct answer
and count update; word list 60 rows, search "rhythm" → 1, expand shows Bangla
"ছন্দ", "zzzz" → empty state, bookmark persists and filter shows 1; language
toggle → "স্পেলিং বি বিডি" title, Bengali digits in best score, lang persisted,
toggle back to English; scores tab (best 95, rounds 1, accuracy 80%, 1 history
row); best survives reload; no horizontal overflow at either width; zero
console errors, zero page exceptions, zero non-file network requests at both
widths.

No repair cycles needed for the smoke tests — first run green at both widths.
