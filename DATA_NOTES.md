# DATA_NOTES.md — Spelling Bee BD (run #324)

## Word list provenance

- 60 words hand-picked by the factory worker: commonly misspelled English words
  (the classic "most misspelled words" sets used in spelling bees and school
  spelling lists), split 20/20/20 across Easy / Medium / Hard by spelling
  difficulty (silent letters, double letters, -ible/-able endings, loanwords).
- Each word carries a short Bangla gloss and one short example sentence with a
  Bangla translation, written for learners. Glosses are dictionary-style, not
  exam answers; the footer and README say so.
- **Zero overlap with vocabulary-bd** (the factory's other English-word app,
  run #323, built the same day): verified programmatically — the unit test
  `word list: no overlap with vocabulary-bd word list` diffs this list against
  `builds/vocabulary-bd/js/data.js` and fails on any shared word. Three early
  candidates (beautiful, answer, available) were dropped for exactly this reason
  and replaced with wonderful, listen and accessible.

## What is NOT claimed

- No per-bank, per-exam or official word list is used; this is a practice game,
  not a syllabus.
- No audio files are bundled: pronunciation comes from the device's built-in
  speech synthesis, which varies by device. Flash Word is the deterministic
  fallback and is what the smoke tests exercise.
- Scores are local-only; there is no server leaderboard.
