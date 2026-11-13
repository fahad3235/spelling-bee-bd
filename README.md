# Spelling Bee BD

Listen, spell, win — an English spelling game for Bangladeshi learners. Hear a word
(or flash it), type its spelling, and climb the scoreboard. Fully offline, bilingual
(English / বাংলা), no account, no network requests.

## Features

- **Classic Bee (Play)** — rounds of 10 words at Easy / Medium / Hard / Mixed level.
  3 lives, 45 seconds per word. Listen with built-in speech synthesis, or flash the
  word for 2 seconds. Hints reveal the Bangla meaning at half points for that word.
- **Scoring** — Easy 10 · Medium 15 · Hard 20 points per word, +1 per consecutive
  correct answer (streak bonus, capped at +5). A wrong answer, a skip, or running
  out of time costs 1 life. Best score per level is saved.
- **Practice Mode** — no lives, no timer. Spell as many words as you like; correct
  count is tracked for the session.
- **Word List** — all 60 words, searchable in English or Bangla, filterable by level
  and by bookmark. Tap a word to see its Bangla meaning and example sentence; ★ to
  bookmark words for revision.
- **Scores** — best score per level, rounds played, overall accuracy, round history
  (last 20 rounds), JSON export / import, and typed-DELETE erase-all.
- **Bilingual UI** — full English / বাংলা toggle with Bengali digits in Bangla mode.
  Language and progress persist in `localStorage` on the device.

## Word list

60 hand-picked, commonly misspelled English words — 20 per level — each with a short
Bangla meaning and an example sentence with a Bangla translation. The list has zero
overlap with the factory's Vocabulary BD word list (checked in tests).

| Level | Words |
| --- | --- |
| Easy | friend, because, tomorrow, receive, believe, surprise, remember, different, important, children, morning, holiday, garden, family, country, together, question, language, wonderful, listen |
| Medium | necessary, separate, definitely, environment, government, experience, knowledge, library, occasion, restaurant, successful, beginning, calendar, embarrass, recommend, similar, accessible, february, wednesday, business |
| Hard | accommodate, occurrence, conscience, rhythm, pneumonia, questionnaire, sincerely, vacuum, cemetery, fluorescent, guarantee, liaison, millennium, noticeable, parliament, privilege, entrepreneur, bureaucracy, knowledgeable, miscellaneous |

Meanings are short dictionary-style glosses written for learners, not exam answers.

## Stack

- Plain HTML + CSS + JavaScript, no framework, no build step, no network.
- `js/data.js` — the 60-word list (Bengali stored as `\uXXXX` escapes so sources stay pure ASCII).
- `js/core.js` — pure logic: grading, scoring, round flow, timer boundary, stats, backup validation (shared by the app and the Node tests).
- `js/i18n.js` — English / Bangla UI strings (85 keys, parity-checked).
- `js/app.js` — DOM wiring and `localStorage` state.
- `gen.py` — regenerates `js/data.js` and `js/i18n.js` from the UTF-8 source lists (run `python3 gen.py` after editing the word list).

## Prerequisites

Any modern browser. No server, no install. For the Listen button, the device needs a
speech-synthesis voice (built into Android, iOS, Windows and macOS browsers); where no
voice is available the app says so and Flash Word works instead.

## Run locally

```bash
# Option 1: open the file directly
open index.html

# Option 2: serve over HTTP
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Testing

```bash
node --test tests/unit.test.mjs   # 17/17 Node unit tests
node tests/smoke.mjs 1280         # 51/51 headless-Chrome checks (desktop)
node tests/smoke.mjs 390          # 51/51 headless-Chrome checks (mobile)
```

See [TEST_RESULTS.md](TEST_RESULTS.md) for the recorded results.

## Deployment

Static site — publish the repo root with GitHub Pages (main branch, root) or any
static host. No build step and no environment variables.

## Limitations

- Speech synthesis quality and available voices depend on the device and browser;
  pronunciation may differ slightly between devices. Flash Word is the reliable
  fallback.
- Scores, bookmarks and history live only in the browser's `localStorage` — clearing
  browser data erases them (use Export to back up).
- The 45-second timer is per word and pauses only when you answer; switching tabs
  does not pause it.
- Word meanings are short learner glosses, not full dictionary entries.

## Status

Built 2026-11-13 (MUSE Project Factory run #324, 14:00 slot). Complete and verified:
17/17 unit tests, 51/51 headless-Chrome smoke checks at 1280px and 390px, zero
console errors, zero non-file network requests.
