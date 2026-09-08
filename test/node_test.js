/**
 * Gold tests for the Poker Odds Drill engine.
 *
 *   node test/node_test.js            5-card enumeration + all fast checks (~2 s)
 *   node test/node_test.js --seven    adds the full C(52,7) enumeration (~20 s)
 *
 * The engine is not duplicated here: it is sliced out of <script id="engine">
 * in index.html, written to a throwaway module and required, so index.html stays
 * the single source of truth. (Running it via `vm` instead costs ~35x, because
 * POP/STRAIGHT_TOP become sandbox global lookups. Do not switch back to vm.)
 */
'use strict';
const fs = require('fs');
const path = require('path');

const HTML = path.join(__dirname, '..', 'index.html');
const src = fs.readFileSync(HTML, 'utf8');
const m = src.match(/<script id="engine">([\s\S]*?)<\/script>/);
if (!m) { console.error('could not find <script id="engine"> in index.html'); process.exit(1); }

const drillsBlock = src.match(/<script id="drills">([\s\S]*?)<\/script>/);
if (!drillsBlock) { console.error('could not find <script id="drills"> in index.html'); process.exit(1); }

const EXPORTS = ['buildTables', 'evalCards', 'countOuts', 'enumerateEq', 'mcEq', 'equity',
                 'mulberry32', 'seedFrom', 'cardStr', 'catOf', 'ahead',
                 'reqEquity', 'mdf', 'alpha', 'bluffShare', 'evCall', 'RANKS', 'SUITS', 'VERSION',
                 'DRILLS', 'dealDistinct', 'pickPot', 'pickBet',
                 'CLASS_ORDER', 'rangeCombos', 'rangeEdge', 'classCombos', 'eqVsRanges', 'comboCount',
                 'expandRange', 'parseRange', 'expandToken', 'deadOuts'];
const TMP = path.join(__dirname, '.engine.gen.js');
fs.writeFileSync(TMP, m[1] + '\n' + drillsBlock[1] + '\nmodule.exports={' + EXPORTS.join(',') + '};\n');
process.on('exit', () => { try { fs.unlinkSync(TMP); } catch (e) {} });

const E = require(TMP);
E.buildTables();
const { evalCards, countOuts, enumerateEq, mcEq, mulberry32, cardStr,
        reqEquity, mdf, alpha, bluffShare, evCall, RANKS, DRILLS } = E;

let pass = 0, fail = 0;
function t(name, cond, note) {
  cond ? pass++ : fail++;
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${note ? '   ' + note : ''}`);
}
function H(s) {
  return s.trim().split(/\s+/).map(x =>
    (RANKS.indexOf(x[0].toUpperCase()) << 2) | 'shdc'.indexOf(x[1].toLowerCase()));
}
const ev = s => { const h = H(s); return evalCards(h, h.length); };
const CATS = ['high card', 'pair', 'two pair', 'trips', 'straight', 'flush', 'full house', 'quads', 'str8 flush'];

// ---------------------------------------------------------------- 5-card gold
console.log('\n--- all C(52,5) five-card hands ---');
{
  const t0 = Date.now(), counts = new Array(9).fill(0), buf = new Int32Array(5);
  for (let a = 0; a < 52; a++) { buf[0] = a;
    for (let b = a + 1; b < 52; b++) { buf[1] = b;
      for (let c = b + 1; c < 52; c++) { buf[2] = c;
        for (let d = c + 1; d < 52; d++) { buf[3] = d;
          for (let e = d + 1; e < 52; e++) { buf[4] = e;
            counts[evalCards(buf, 5) >>> 20]++;
  }}}}}
  const want = [1302540, 1098240, 123552, 54912, 10200, 5108, 3744, 624, 40];
  let total = 0;
  for (let i = 0; i < 9; i++) { total += counts[i]; t(`5-card ${CATS[i]}`, counts[i] === want[i], `${counts[i]} vs ${want[i]}`); }
  t('5-card total = C(52,5) = 2,598,960', total === 2598960, `${total}   [${Date.now() - t0} ms]`);
}

// ---------------------------------------------------------------- 7-card gold
if (process.argv.includes('--seven')) {
  console.log('\n--- all C(52,7) seven-card hands (slow) ---');
  const t0 = Date.now(), counts = new Array(9).fill(0), buf = new Int32Array(7);
  for (let a = 0; a < 52; a++) { buf[0] = a;
    for (let b = a + 1; b < 52; b++) { buf[1] = b;
      for (let c = b + 1; c < 52; c++) { buf[2] = c;
        for (let d = c + 1; d < 52; d++) { buf[3] = d;
          for (let e = d + 1; e < 52; e++) { buf[4] = e;
            for (let f = e + 1; f < 52; f++) { buf[5] = f;
              for (let g = f + 1; g < 52; g++) { buf[6] = g;
                counts[evalCards(buf, 7) >>> 20]++;
  }}}}}}}
  const want = [23294460, 58627800, 31433400, 6461620, 6180020, 4047644, 3473184, 224848, 41584];
  let total = 0;
  for (let i = 0; i < 9; i++) { total += counts[i]; t(`7-card ${CATS[i]}`, counts[i] === want[i], `${counts[i]} vs ${want[i]}`); }
  t('7-card total = C(52,7) = 133,784,560', total === 133784560, `${total}   [${((Date.now() - t0) / 1000).toFixed(1)} s]`);
} else {
  console.log('\n(skipping C(52,7) gold test; pass --seven to run it)');
}

// ---------------------------------------------------------------- ordering
console.log('\n--- hand ordering ---');
t('trip 3s beat trip 2s', ev('3s 3h 3d 2s 2h') > ev('2s 2h 2d 3s 3h'));
t('wheel < six-high straight', ev('As 2h 3d 4s 5h') < ev('2s 3h 4d 5s 6h'));
t('flush beats straight', ev('As Ks Qs Js 9s') > ev('2s 3h 4d 5s 6h'));
t('AAKK2 beats AAQQJ', ev('As Ah Ks Kh 2d') > ev('As Ah Qs Qh Jd'));
t('quads beat full house', ev('As Ah Ad Ac 2d') > ev('As Ah Ad Ks Kh'));
t('straight flush beats quads', ev('As Ks Qs Js Ts') > ev('As Ah Ad Ac Kd'));
t('wheel flush is a straight flush', (ev('As 2s 3s 4s 5s') >>> 20) === 8);
t('royal is the top straight flush', ev('As Ks Qs Js Ts') > ev('Ks Qs Js Ts 9s'));
t('7 cards: three pairs -> two pair, Q kicker',
  (ev('As Ah Ks Kh 2s 2h Qd') >>> 20) === 2 && ((ev('As Ah Ks Kh 2s 2h Qd') & 0xf00) >> 8) === 10);
t('7 cards: trips + pair -> full house', (ev('As Ah Ad Ks Kh 2c 3d') >>> 20) === 6);
t('7 cards: two trips -> full house, higher trips on top',
  (ev('As Ah Ad Ks Kh Kd 2c') >>> 20) === 6 && ((ev('As Ah Ad Ks Kh Kd 2c') & 0xf0000) >> 16) === 12);
t('6-card flush takes the top five', ev('As Ks Qs Js 9s 8s') === ev('As Ks Qs Js 9s'));
t('flush beats trips (7 cards)', (ev('Ah Kh Qh Jh 9h Ks Kd') >>> 20) === 5);
t('kicker matters: AK > AQ on the same pair', ev('As Ah Kd 7c 5s') > ev('As Ah Qd 7c 5s'));

// ---------------------------------------------------------------- outs
console.log('\n--- outs and exact equity ---');
{
  const hero = H('Ah Kh'), vil = H('Qs Qd'), board = H('Qh 7h 2c');
  const o = countOuts(hero, vil, board);
  t('Ah Kh on Qh 7h 2c vs QsQd -> 8 outs', o.length === 8, o.map(cardStr).join(' '));
  t('the 2h is dead (gives villain queens full)', o.indexOf(H('2h')[0]) < 0);

  const eq = enumerateEq(hero, vil, board);
  t('990 runouts enumerated', eq.n === 990, `${eq.n}`);

  // Three different numbers, and the gap between them is the whole lesson.
  // 36.36% = P(complete the flush)          <- what the rule of 4 estimates
  // 32.73% = P(hit one of the 8 CLEAN outs) <- the 2h gives villain queens full
  // 25.56% = actual equity                  <- villain redraws to a boat/quads
  // Verified independently by exhaustive enumeration in Python: 253 win, 0 tie, 737 lose.
  const closed45 = 1 - (36 * 35) / (45 * 44);   // any of 9 hearts, U=45
  const clean45  = 1 - (37 * 36) / (45 * 44);   // any of the 8 clean hearts
  const closed47 = 1 - (38 * 37) / (47 * 46);   // any of 9 hearts, villain unknown
  t('P(complete flush), U=45, is 36.36%', Math.abs(closed45 - 0.363636) < 1e-6, (closed45 * 100).toFixed(2) + '%');
  t('P(hit one of 8 clean outs) is 32.73%', Math.abs(clean45 - 0.327273) < 1e-6, (clean45 * 100).toFixed(2) + '%');
  t('P(complete flush), U=47 (villain unknown), is 34.97%', Math.abs(closed47 - 0.349676) < 1e-6, (closed47 * 100).toFixed(2) + '%');
  t('the two U conventions differ by 1.4 points', Math.abs(closed45 - closed47) > 0.013,
    `${((closed45 - closed47) * 100).toFixed(2)} points apart`);
  t('exact equity is 25.56% (253/990), well below all three',
    eq.win === 253 && eq.tie === 0 && eq.lose === 737 && Math.abs(eq.eq - 253 / 990) < 1e-12,
    `win ${eq.win} tie ${eq.tie} lose ${eq.lose} -> ${(eq.eq * 100).toFixed(2)}%`);
  t('equity is strictly below the clean-outs figure (villain redraws)', eq.eq < clean45 - 0.05,
    `${(eq.eq * 100).toFixed(2)}% vs ${(clean45 * 100).toFixed(2)}%`);
}
{
  const s = enumerateEq(H('Ah Kh'), H('As Ks'), H('7d 4c 2d'));
  t('symmetric AhKh vs AsKs: win == lose, eq exactly 0.5', s.win === s.lose && s.eq === 0.5,
    `win ${s.win} lose ${s.lose} tie ${s.tie}`);
}
{
  const s = enumerateEq(H('7c 2d'), H('7h 2s'), H('Ad Kc Qh'));
  t('symmetric 72 vs 72: eq exactly 0.5', s.eq === 0.5, `win ${s.win} lose ${s.lose} tie ${s.tie}`);
}
{
  const turn = enumerateEq(H('Ah Kh'), H('Qs Qd'), H('Qh 7h 2c 3s'));
  t('turn enumerates 44 runouts', turn.n === 44, `${turn.n}`);
  const o = countOuts(H('Ah Kh'), H('Qs Qd'), H('Qh 7h 2c 3s'));
  t('turn: equity equals outs/44 exactly', Math.abs(turn.eq - o.length / 44) < 1e-12,
    `${o.length}/44 = ${(o.length / 44 * 100).toFixed(2)}%`);
}

// ---------------------------------------------------------------- preflop MC
console.log('\n--- preflop equities (MC, N=200k, se <= 0.11pp) ---');
{
  const cases = [
    ['As Ah', 'Ks Kh', 0.8264, 'AA v KK, both suits shared'],
    ['As Ah', 'Ks Kd', 0.8195, 'AA v KK, one suit shared'],
    ['As Ah', 'Kd Kc', 0.8126, 'AA v KK, no suit shared'],
    ['As Ks', 'Qh Qd', 0.4621, 'AKs v QQ'],
    ['As Kh', 'Qh Qd', 0.4284, 'AKo v QQ'],
    ['As Kh', 'Kd Qc', 0.7417, 'AKo v KQo, dominated'],
    ['As Kh', '7d 2c', 0.6700, 'AKo v 72o'],
    ['Qs Qh', '7d 7c', 0.8026, 'QQ v 77'],
    ['As Kh', 'Ad Ac', 0.0743, 'AKo v AA'],
  ];
  let i = 0;
  for (const [a, b, want, label] of cases) {
    const r = mcEq(H(a), H(b), [], 200000, mulberry32(1000 + i * 97));
    t(`${label} ~ ${(want * 100).toFixed(2)}%`, Math.abs(r.eq - want) < 0.005,
      `got ${(r.eq * 100).toFixed(2)}%  (se ${(r.se * 100).toFixed(3)}pp)`);
    i++;
  }
  const mirror = mcEq(H('As Kh'), H('Ad Kc'), [], 200000, mulberry32(5));
  t('AKo v AKo is a near-certain chop', Math.abs(mirror.eq - 0.5) < 0.004, (mirror.eq * 100).toFixed(2) + '%');
}

// ---------------------------------------------------------------- arithmetic
console.log('\n--- the graded arithmetic ---');
t('req(100,50) = 25%', Math.abs(reqEquity(100, 50) - 0.25) < 1e-12);
t('req(100,100) = 33.33%', Math.abs(reqEquity(100, 100) - 1 / 3) < 1e-12);
t('req(100,33.33) = 20%', Math.abs(reqEquity(100, 100 / 3) - 0.2) < 1e-12);
t('mdf(100,100) = 50%', Math.abs(mdf(100, 100) - 0.5) < 1e-12);
t('mdf(100,50) = 66.67%', Math.abs(mdf(100, 50) - 2 / 3) < 1e-12);
t('alpha(100,100) = 50%', Math.abs(alpha(100, 100) - 0.5) < 1e-12);
t('alpha + mdf = 1 for every size',
  [0.25, 1 / 3, 0.5, 2 / 3, 0.75, 1, 1.5, 2].every(f => Math.abs(alpha(100, 100 * f) + mdf(100, 100 * f) - 1) < 1e-12));
t('bluff share == required equity for every size (the identity)',
  [0.25, 1 / 3, 0.5, 2 / 3, 0.75, 1, 1.5, 2].every(f => Math.abs(bluffShare(100, 100 * f) - reqEquity(100, 100 * f)) < 1e-12));
// P is the pot BEFORE the bet, so calling 50 into 100 wins 150 and risks 50:
// 0.4*150 - 0.6*50 = 30.  (Under the other convention, where the quoted pot
// already includes villain's bet, the same spot reads 0.4*100 - 0.6*50 = 10.
// The whole app uses P = pot before the bet, matching req = b/(P+2b).)
t('evCall(0.4,100,50) = 30, P = pot before the bet', Math.abs(evCall(0.4, 100, 50) - 30) < 1e-12,
  `${evCall(0.4, 100, 50)}`);
t('evCall == E(P+2b) - b', [0.2, 0.4, 0.6, 0.85].every(E => Math.abs(evCall(E, 120, 80) - (E * (120 + 160) - 80)) < 1e-9));
t('evCall is zero exactly at the required equity',
  [[100, 50], [120, 80], [250, 175]].every(([P, b]) => Math.abs(evCall(reqEquity(P, b), P, b)) < 1e-9));

// ---------------------------------------------------------------- drills
console.log('\n--- every drill generates, asks and explains (200 hands each) ---');
{
  for (const id of Object.keys(DRILLS)) {
    const d = DRILLS[id], g = mulberry32(20260908);
    let bad = null, nq = 0, slowest = 0;
    for (let i = 0; i < 200 && !bad; i++) {
      const t0 = Date.now();
      const st = d.generate(g);
      slowest = Math.max(slowest, Date.now() - t0);
      if (!st) { bad = 'generate() returned null'; break; }
      const qs = d.questions(st);
      if (!qs.length) { bad = 'no questions'; break; }
      nq = qs.length;
      for (const q of qs) {
        if (q.answer === undefined || q.answer === null) { bad = 'answer missing'; break; }
        if (!['int', 'choice', 'market'].includes(q.kind)) { bad = 'unknown kind ' + q.kind; break; }
        if (q.kind !== 'choice' && !Number.isFinite(q.answer)) { bad = 'answer not finite: ' + q.answer; break; }
        if (q.kind === 'choice' && q.choices.indexOf(q.answer) < 0) { bad = 'answer not among choices'; break; }
        if (q.kind !== 'choice' && (q.answer < 0 || q.answer > 100) && /equity|chance|share|market/i.test(q.prompt)) {
          bad = 'percentage answer out of 0-100: ' + q.answer; break;
        }
        if (!Number.isFinite(q.tol) || q.tol < 0) { bad = 'bad tolerance'; break; }
      }
      if (bad) break;
      const ex = d.explain(st);
      if (typeof ex !== 'string' || ex.length < 20) { bad = 'explain() too short'; break; }
      if (/undefined|NaN|Infinity/.test(ex)) { bad = 'explain() contains ' + ex.match(/undefined|NaN|Infinity/)[0]; break; }
      // every drill must be able to teach itself
      const a = d.about;
      if (!a || !a.goal || !a.how || !a.example) { bad = 'about block incomplete'; break; }
      if (/undefined|NaN/.test(a.goal + a.how + a.example)) { bad = 'about text malformed'; break; }
    }
    t(`drill ${id}`, bad === null, bad || `${nq} question(s), worst deal ${slowest} ms`);
  }

  // the two arithmetic drills must agree with the closed forms, over many deals
  const g2 = mulberry32(99);
  let okPot = true, okBluff = true;
  for (let i = 0; i < 500; i++) {
    const a = DRILLS.potodds.generate(g2);
    if (Math.abs(DRILLS.potodds.questions(a)[0].answer - Math.round(reqEquity(a.P, a.b) * 1000) / 10) > 1e-9) okPot = false;
    const b = DRILLS.bluff.generate(g2), qs = DRILLS.bluff.questions(b);
    if (Math.abs(qs[0].answer - Math.round(bluffShare(b.P, b.b) * 1000) / 10) > 1e-9) okBluff = false;
    if (Math.abs(qs[1].answer - Math.round(mdf(b.P, b.b) * 1000) / 10) > 1e-9) okBluff = false;
  }
  t('potodds answers match b/(P+2b) over 500 deals', okPot);
  t('bluff answers match b/(P+2b) and P/(P+b) over 500 deals', okBluff);

  // outs drill invariants: villain must be ahead, outs in range, equity exact,
  // and Q2 must grade P(hit an out), which is what the rule of 2 and 4 estimates.
  const g3 = mulberry32(1234);
  let okOuts = true, note = '';
  for (let i = 0; i < 200; i++) {
    const st = DRILLS.outs.generate(g3), o = st.outs.length, U = st.U, two = st.board.length === 3;
    if (o < 2 || o > 15) { okOuts = false; note = 'outs out of range: ' + o; break; }
    if (E.ahead(st.hero, st.vil, st.board) >= 0) { okOuts = false; note = 'villain not ahead'; break; }
    if (st.eq.method !== 'exact') { okOuts = false; note = 'equity not exact'; break; }
    if (U !== 52 - 4 - st.board.length) { okOuts = false; note = 'U wrong'; break; }
    const want = two ? 1 - ((U - o) * (U - o - 1)) / (U * (U - 1)) : o / U;
    if (Math.abs(DRILLS.outs.questions(st)[1].answer - Math.round(want * 1000) / 10) > 1e-9) {
      okOuts = false; note = 'Q2 is not exact P(hit an out)'; break;
    }
  }
  t('outs: villain ahead, 2-15 outs, U correct, Q2 grades exact P(hit)', okOuts, note);

  // The heuristic the drill teaches must actually pass the drill. This is the
  // regression guard for the grading bug found in review: grading Q2 against
  // true equity instead of P(hit) dropped the naive rule to 63.5% correct.
  {
    const g = mulberry32(20260908);
    let n = 0, okRule = 0;
    for (let i = 0; i < 1200; i++) {
      const st = DRILLS.outs.generate(g); if (!st) continue;
      const o = st.outs.length, two = st.board.length === 3;
      const rule = two ? 4 * o : 2 * o;
      const q2 = DRILLS.outs.questions(st)[1];
      n++;
      if (Math.abs(rule - q2.answer) <= q2.tol) okRule++;
    }
    const rate = 100 * okRule / n;
    t('the naive rule of 2 and 4 passes the outs drill at least 90% of the time',
      rate >= 90, `${rate.toFixed(1)}% over ${n} deals`);
  }

  // callfold is one question now: the decision. EV in chips was removed because
  // it passed only 30.6% with mental estimation (median equity error 8.9pp).
  const g4 = mulberry32(555);
  let okCF = true, cfNote = '';
  for (let i = 0; i < 120; i++) {
    const st = DRILLS.callfold.generate(g4), qs = DRILLS.callfold.questions(st);
    if (qs.length !== 1) { okCF = false; cfNote = 'expected exactly one question'; break; }
    const shouldCall = st.eq.eq > reqEquity(st.P, st.b);
    if (qs[0].answer !== (shouldCall ? 'Call' : 'Fold')) { okCF = false; cfNote = 'decision disagrees with equity vs price'; break; }
    if (Math.sign(evCall(st.eq.eq, st.P, st.b)) !== (shouldCall ? 1 : -1)) { okCF = false; cfNote = 'EV sign disagrees'; break; }
    if (Math.abs(st.eq.eq - st.req) < 0.035) { okCF = false; cfNote = 'spot too close to the threshold to be fair'; break; }
  }
  t('callfold: one question, decision and EV sign agree, no knife-edge spots', okCF, cfNote);


  // ranges
  {
    const dead = [];
    t('CLASS_ORDER has all 169 classes', E.CLASS_ORDER.length === 169);
    const w = l => l.length === 2 ? 6 : (l[2] === 's' ? 4 : 12);
    t('the 169 classes weigh 1326 combos', E.CLASS_ORDER.reduce((s, l) => s + w(l), 0) === 1326);
    t('AA is the strongest class', E.CLASS_ORDER[0] === 'AA');
    t('32o is the weakest class', E.CLASS_ORDER[168] === '32o');
    t('rangeCombos(100) is every combo', E.rangeCombos(100, dead).length === 1326);
    const top5 = E.rangeCombos(5, dead);
    t('top 5% is about 66 combos', top5.length >= 60 && top5.length <= 80, `${top5.length}`);
    // blockers must remove combos
    const withAce = E.rangeCombos(10, [(12 << 2) | 0, (12 << 2) | 1]);
    t('holding two aces shrinks a top-10% range', withAce.length < E.rangeCombos(10, dead).length,
      `${withAce.length} vs ${E.rangeCombos(10, dead).length}`);
    // a strong hand must beat a wide range more often than a tight one
    const H2 = s => H(s);
    const vsWide = E.eqVsRanges(H2('As Ah'), [E.rangeCombos(50, H2('As Ah'))], [], 20000, mulberry32(1));
    const vsTight = E.eqVsRanges(H2('As Ah'), [E.rangeCombos(5, H2('As Ah'))], [], 20000, mulberry32(2));
    t('AA does better against a wide range than a tight one', vsWide.eq > vsTight.eq,
      `${(vsWide.eq * 100).toFixed(1)}% vs ${(vsTight.eq * 100).toFixed(1)}%`);
    t('AA against top 50% is 80-88%', vsWide.eq > 0.80 && vsWide.eq < 0.88, `${(vsWide.eq * 100).toFixed(1)}%`);
    // more opponents must lower equity
    const pool = () => E.rangeCombos(30, H2('As Ks'));
    const one1 = E.eqVsRanges(H2('As Ks'), [pool()], [], 20000, mulberry32(3));
    const three = E.eqVsRanges(H2('As Ks'), [pool(), pool(), pool()], [], 20000, mulberry32(4));
    t('equity falls with more opponents', three.eq < one1.eq - 0.05,
      `1 villain ${(one1.eq * 100).toFixed(1)}%  ->  3 villains ${(three.eq * 100).toFixed(1)}%`);
    t('multiway equity stays positive and sane', three.eq > 0.15 && three.eq < 0.60, `${(three.eq * 100).toFixed(1)}%`);
  }

  // combo counting
  {
    const { comboCount } = E;
    const R = r => RANKS.indexOf(r);
    t('unblocked pair is 6 combos', comboCount(R('7'), R('7'), 2, []) === 6);
    t('unblocked any-suit AK is 16', comboCount(R('A'), R('K'), 2, []) === 16);
    t('unblocked offsuit AK is 12', comboCount(R('A'), R('K'), 0, []) === 12);
    t('unblocked suited AK is 4', comboCount(R('A'), R('K'), 1, []) === 4);
    // the Gemini worked example: K on board plus K in hand leaves 8 combos of AK
    const seen = H('Ks 7h 2d Kd Qd');
    t('AK with two kings gone is 8 combos', comboCount(R('A'), R('K'), 2, seen) === 8,
      `${comboCount(R('A'), R('K'), 2, seen)}`);
    t('77 with one seven gone is 3 combos', comboCount(R('7'), R('7'), 2, seen) === 3,
      `${comboCount(R('7'), R('7'), 2, seen)}`);
    t('suited AK with the Kd gone is 3 combos', comboCount(R('A'), R('K'), 1, H('Kd')) === 3);
    t('a rank fully on board gives 0 combos of that pair', comboCount(R('K'), R('K'), 2, H('Ks Kh Kd Kc')) === 0);
  }
}

  // explicit range notation
  {
    const eq2 = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    t('QQ+ expands to QQ KK AA', eq2(E.expandRange('QQ+'), ['QQ', 'KK', 'AA']));
    t('AK expands to both suited and offsuit', eq2(E.expandRange('AK'), ['AKs', 'AKo']));
    t('AJs+ expands to AJs AQs AKs', eq2(E.expandRange('AJs+'), ['AJs', 'AQs', 'AKs']));
    t('KTo+ expands to KTo KJo KQo', eq2(E.expandRange('KTo+'), ['KTo', 'KJo', 'KQo']));
    t('76s expands to itself', eq2(E.expandRange('76s'), ['76s']));
    t('a comma list unions and dedupes', eq2(E.expandRange('QQ+, AK, QQ'), ['QQ', 'KK', 'AA', 'AKs', 'AKo']));
    t('rank order does not matter', eq2(E.expandRange('KA'), E.expandRange('AK')));
    t('garbage tokens are ignored', E.expandRange('zz, AK').join(' ') === 'AKs AKo');
    t('QQ+ is 18 combos unblocked', E.parseRange('QQ+', []).length === 18);
    // Qs and Qh gone leaves only QdQc for the queens: C(2,2) + 6 + 6 = 13
    t('QQ+ with two queens gone is 13', E.parseRange('QQ+', H('Qs Qh')).length === 13,
      `${E.parseRange('QQ+', H('Qs Qh')).length}`);
    t('{QQ+, AK} is 34 combos unblocked', E.parseRange('QQ+, AK', []).length === 34,
      `${E.parseRange('QQ+, AK', []).length}`);
  }

  // the polar drill: value/bluff counting and the call decision must be consistent
  {
    const g5 = mulberry32(4242);
    let bad = null, over = 0, under = 0, n = 0;
    for (let i = 0; i < 150 && !bad; i++) {
      const st = DRILLS.polar.generate(g5);
      if (!st) { bad = 'generate returned null'; break; }
      const qs = DRILLS.polar.questions(st);
      n++;
      if (qs[0].answer !== st.val) { bad = 'Q1 is not the value-combo count'; break; }
      if (st.val + st.blf + st.tie !== st.tot) { bad = 'combo counts do not sum to the total'; break; }
      if (st.val < 3 || st.blf < 3) { bad = 'not a real bluff-catch spot'; break; }
      const eqCheck = (st.blf + st.tie / 2) / st.tot;
      if (Math.abs(eqCheck - st.eqv) > 1e-12) { bad = 'equity does not follow from the counts'; break; }
      const shouldCall = st.eqv > st.req;
      if (qs[1].answer !== (shouldCall ? 'Call' : 'Fold')) { bad = 'decision disagrees with equity vs price'; break; }
      if (Math.abs(st.eqv - st.req) < 0.04) { bad = 'spot too close to the threshold'; break; }
      // over-bluffing must imply calling is right, and vice versa
      const overB = st.bluffShareReal > st.bluffShareBal;
      if (overB !== shouldCall) { bad = `over-bluffing (${overB}) disagrees with call (${shouldCall})`; break; }
      overB ? over++ : under++;
    }
    t('polar: counts sum, equity follows, decision follows', bad === null, bad || `${n} deals`);
    t('polar: over-bluffing implies call, under-bluffing implies fold', bad === null,
      `${over} over / ${under} under`);
    t('polar generates both over and under-bluffing spots', over > 10 && under > 10);
  }

  // adaptive bucketing
  {
    const ids = Object.keys(DRILLS);
    t('every drill exposes bucket()', ids.every(id => typeof DRILLS[id].bucket === 'function'),
      ids.length + ' drills');
    const g6 = mulberry32(31);
    let allStrings = true, seen = {};
    for (const id of ids) {
      for (let i = 0; i < 25; i++) {
        const st = DRILLS[id].generate(g6);
        if (!st) continue;
        const b = DRILLS[id].bucket(st);
        if (typeof b !== 'string' || !b.length) { allStrings = false; }
        (seen[id] = seen[id] || new Set()).add(b);
      }
    }
    t('bucket() always returns a non-empty string', allStrings);
    const multi = ids.filter(id => seen[id] && seen[id].size > 1);
    t('most drills produce more than one bucket, so adaptation has something to steer',
      multi.length >= 5, `${multi.length}/${ids.length}: ` +
      ids.map(id => id + '=' + (seen[id] ? seen[id].size : 0)).join(' '));
  }

  // dead outs
  {
    const dead = E.deadOuts(H('Ah Kh'), H('Qs Qd'), H('Qh 7h 2c'));
    const live = countOuts(H('Ah Kh'), H('Qs Qd'), H('Qh 7h 2c'));
    t('the 2h is a dead out, not a live one',
      dead.some(c => c === H('2h')[0]) && !live.some(c => c === H('2h')[0]));
    t('live and dead outs never overlap', !dead.some(c => live.indexOf(c) >= 0));
  }

// ---------------------------------------------------------------- summary
console.log(`\n${fail === 0 ? 'ALL PASS' : fail + ' FAILED'}   ${pass}/${pass + fail}\n`);
process.exit(fail === 0 ? 0 : 1);
