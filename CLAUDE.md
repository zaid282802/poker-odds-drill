# CLAUDE.md — Poker Odds Drill

Scopes this folder out of the parent `Local/CLAUDE.md`, which is a Python-backtest ruleset (pytest,
type hints, logging, `config.yaml`). None of that applies here. This is a static web app.

## What this is

A single-file phone trainer for poker odds mental arithmetic. Companion to
`MQF/cerificate & resume/study-guides/Poker_Math_Study_Guide.tex`.

**Live at <https://zaid282802.github.io/poker-odds-drill/>** (GitHub Pages from `main`, repo
`zaid282802/poker-odds-drill`). Push to `main` deploys, about two minutes. HTTPS there, so `sw.js`
registers and the app works offline once loaded.

Seven drills: `outs`, `potodds`, `combos`, `equity`, `callfold`, `bluff`, `market`.

## Hard rules

1. **One file.** Everything lives in `index.html`: one `<style>`, three `<script>` blocks. No
   bundler, no npm, no `package.json`.
2. **Zero external requests.** No Google Fonts, no CDN, no images. System font stack, Unicode suit
   glyphs. Verify with DevTools Network: only the document itself should appear. This is what makes
   it work offline once loaded.
3. **Size cap 60 KB** for `index.html`. Currently about 32 KB.
4. **Dark only.** `color-scheme: dark`, tokens in `:root`. The `data-theme` hook and the blocking
   head script are already there so a light theme is a small addition later, but do not add one
   speculatively.
5. **`node test/node_test.js` and `node test/static_check.js` must both pass before any commit.**
   Run `--seven` after touching `evalCards`, `top5`, `buildTables` or the flush/straight ordering.
6. **Bump `VERSION`** in the engine block AND `STATIC_CACHE` in `sw.js` on every functional change.
   Phones cache aggressively; without the cache bump they keep the old build forever.
7. **No em dashes** in any user-facing string or in the docs.
8. **Every drill needs an `about` block** with `goal`, `how` and `example`. A drill nobody
   understands teaches nothing. `static_check.js` enforces this.
9. **Grade what the method can actually produce.** See the two bugs below.

## Script blocks

| Block | Contains | May touch the DOM |
|---|---|---|
| `<script id="engine">` | card model, `evalCards`, `enumerateEq`, `mcEq`, `countOuts`, and the five graded formulas | no |
| `<script id="drills">` | `DRILLS`, deal generators, tolerances, `explain()` text | no |
| `<script id="ui">` | rendering, grading, keypad, stats, boot, `?test=1` panel | yes |

`test/node_test.js` slices the first two blocks out of `index.html` and requires them, so
**`index.html` is the single source of truth for the engine.** Do not create a second copy. The
first two blocks must stay DOM-free or the harness breaks.

## Things that look like bugs and are not

- **Flush is tested before quads and full house** in `evalCards`. Correct: with at most 7 cards a
  flush cannot coexist with either. Quads need four suits, so 4+5-1 = 8 > 7; and a full house's pair
  would need two cards of the flush suit at the same rank. There is a comment saying this. Leave it.
- **Rank multiplicities come from four bitmasks** (`c1..c4`), not a count array. This is deliberate:
  the array version measured 8.7 microseconds per evaluation, the bitmask version 0.074. Do not
  "simplify" it back.
- **`test/node_test.js` requires a generated temp module instead of using `vm`.** Running the engine
  in a `vm` sandbox costs about 35x, because `POP` and `STRAIGHT_TOP` become sandbox global lookups.
  The full C(52,7) sweep is 7.8 seconds required directly and roughly 19 minutes under `vm`.
- **`U = 45`, not 47**, in the outs drill, because the drill shows villain's hand. Both figures are
  correct answers to different questions and the feedback text says so.
- **`P` is the pot before the bet.** So `EV(call) = E(P+b) - (1-E)b`, and calling 50 into 100 at 40%
  equity is worth 30, not 10. The other convention (pot already includes the bet) gives 10. Keep
  every formula on the same convention as `reqEquity = b/(P+2b)`.
- **The `outs` drill grades P(hit an out), not equity.** This looks like a downgrade and is not.
  Grading equity punished the rule of 2 and 4 that the drill teaches: 63.5% pass, and only 2 to 6%
  at 13 to 15 outs, because outs is a one-card idea while equity includes backdoor and counterfeit
  equity no out covers. Grading P(hit) gives 95.8%, failing only above 12 outs where the heuristic
  genuinely breaks. There is a test asserting the naive rule passes at least 90%. Do not "improve"
  this back to equity. True equity is still shown in the feedback, and the gap is the lesson.
- **`callfold` has one question, the decision.** EV in chips was removed: mental equity estimation
  carries a median 8.9 point error, so the EV answer was achievable only 30.6% of the time, while
  the decision was 94.3% because it only needs the right side of a threshold.
- **Villain is face-up only in `outs`.** Deliberate, and `static_check.js` asserts exactly one place
  renders "villain shows". Dead outs cannot be identified without knowing what beats you. Every
  other drill uses `eqVsRanges` so villain stays hidden, which is the realistic skill.
- **`CLASS_ORDER` was generated by this engine**, not imported. If it is ever regenerated, rebuild it
  from the generator output rather than retyping: hand-transcribing it once dropped `97o` and left
  168 classes weighing 1314 combos. There are tests for both counts now.

## Performance budget

Measured natively on this machine, in the browser expect the same order:

| | |
|---|---|
| `evalCards`, 7 cards | 0.074 us, about 13.5 M/s |
| `mcEq` N=40,000 (preflop drill) | 27 ms |
| `enumerateEq` flop, 990 runouts | 0.20 ms |
| all C(52,5) | 138 ms |
| all C(52,7) | 7.8 s |

If MC 40k ever exceeds 100 ms, something has been de-optimised. The usual cause is making
`evalCards` polymorphic on its first argument: keep passing the `Int32Array` scratch buffers
(`_hb`, `_vb`) on the hot paths.

## Deliberately not here

- No hand-vs-hand preflop lookup table. It would not be exact, since suit interaction moves AA
  against KK by 1.4 points, and generating it takes hours. MC costs 27 ms and zero bytes.
- No opening-range chart. That grades memorisation of somebody's opinion, not arithmetic. It is the
  phase-2 `position` drill if it ever gets built.
- No service worker or `manifest.json` yet. They do nothing over LAN `http://`, since only
  `localhost` is exempt from the secure-origin rule. Add them only alongside a GitHub Pages deploy,
  and then follow the `../News/` convention: versioned `STATIC_CACHE`, bumped on every asset change.

## Phase 2, in order

1. **Adaptive difficulty by archetype.** Not by card instance. Track accuracy per bucket (out count
   band, bet-size band, opponent count, paired vs unpaired board) and oversample the weak buckets.
   The earlier reasoning for skipping spaced repetition, that drills are generated rather than being
   a fixed deck, was wrong: you space-repeat structural archetypes, not specific hands.
2. **Explicit ranges** beyond top-X%, for example `{QQ+, AK}`, so value-to-bluff counting can be
   drilled directly against a polarised range.
3. **Action-to-range inference:** given a line, which hands are still in his range. This is the
   Bayesian updating half that no current drill covers.
4. `position`: hand plus 6-max seat, graded against a standard opening chart.
5. Light theme.
