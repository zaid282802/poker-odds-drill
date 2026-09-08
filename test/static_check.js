/**
 * Static checks on index.html that do not need a browser.
 *
 *   node test/static_check.js
 *
 * Syntax-checks every script block, confirms every element the UI reaches for
 * exists, checks tag balance, and enforces the house rules from CLAUDE.md
 * (no external requests, no em dashes, under the size cap, every drill teachable).
 */
'use strict';
const fs = require('fs');
const path = require('path');

const HTML = path.join(__dirname, '..', 'index.html');
const src = fs.readFileSync(HTML, 'utf8');
let ok = true;
const P = (c, m) => { if (!c) ok = false; console.log('  ' + (c ? 'PASS' : 'FAIL') + '  ' + m); };

// 1. syntax-check every script block without executing it
const blocks = [...src.matchAll(/<script(?: id="([^"]+)")?>([\s\S]*?)<\/script>/g)];
console.log('script blocks: ' + blocks.map(b => b[1] || '(head)').join(', '));
for (const b of blocks) {
  try { new Function(b[2]); P(true, 'syntax  ' + (b[1] || '(head)')); }
  catch (e) { P(false, 'syntax  ' + (b[1] || '(head)') + '  ->  ' + e.message); }
}

// 2. every element the UI reaches for must exist in the markup
const ids = new Set([...src.matchAll(/\bid="([A-Za-z][\w-]*)"/g)].map(m => m[1]));
const refs = new Set([...src.matchAll(/getElementById\('([^']+)'\)/g)].map(m => m[1]));
for (const m of src.matchAll(/\$\('([^']+)'\)/g)) refs.add(m[1]);
console.log('');
console.log('declared:   ' + [...ids].join(' '));
console.log('referenced: ' + [...refs].join(' '));
const missing = [...refs].filter(r => !ids.has(r));
P(missing.length === 0, 'every referenced element exists' + (missing.length ? ': missing ' + missing.join(', ') : ''));

// 3. tag balance for container elements
console.log('');
for (const tag of ['html', 'head', 'body', 'style', 'script', 'div', 'header', 'select', 'table', 'thead', 'tbody', 'pre', 'h2']) {
  const open = (src.match(new RegExp('<' + tag + '(?=[\\s>])', 'g')) || []).length;
  const close = (src.match(new RegExp('</' + tag + '>', 'g')) || []).length;
  if (open || close) P(open === close, '<' + tag + '> balanced (' + open + '/' + close + ')');
}

// 4. house rules
console.log('');
const bytes = Buffer.byteLength(src);
P((src.match(/—/g) || []).length === 0, 'no em dashes');
// Look for actual external fetches, not the word "http" in a comment.
const extPatterns = [
  /\bsrc\s*=\s*["']https?:/i, /\bhref\s*=\s*["']https?:/i,
  /@import\s+(?:url\()?["']?https?:/i, /\burl\(\s*["']?https?:/i,
  /\bfetch\s*\(\s*["']https?:/i, /new\s+(?:XMLHttpRequest|WebSocket|EventSource)\b/i,
  /\bimportScripts\s*\(/i
];
const extHit = extPatterns.filter(p => p.test(src));
P(extHit.length === 0, 'no external requests' + (extHit.length ? ': matched ' + extHit[0] : ''));
P(bytes < 60000, 'under the 60 KB cap (' + bytes + ' bytes, ' + (100 * bytes / 60000).toFixed(0) + '% used)');
P(/<meta name="viewport"[^>]*width=device-width/.test(src), 'mobile viewport meta present');
P(/apple-mobile-web-app-capable/.test(src), 'iOS standalone meta present');
P(/env\(safe-area-inset-bottom\)/.test(src), 'keypad respects the safe area');
P(/<script id="engine">/.test(src) && /<script id="drills">/.test(src) && /<script id="ui">/.test(src),
  'the three named script blocks are present (node_test.js slices two of them)');

// 5. every drill must be able to teach itself
console.log('');
const dblock = (src.match(/<script id="drills">[\s\S]*?<\/script>/) || [''])[0];
const drillIds = [...dblock.matchAll(/^(\w+):\{$/gm)].map(m => m[1]);
P(drillIds.length >= 5, drillIds.length + ' drills defined: ' + drillIds.join(', '));
const aboutCount = (dblock.match(/^  about:\{$/gm) || []).length;
P(aboutCount === drillIds.length, 'every drill has an about block (' + aboutCount + '/' + drillIds.length + ')');
for (const k of ['goal', 'how', 'example']) {
  const n = (dblock.match(new RegExp('^    ' + k + ':', 'gm')) || []).length;
  P(n === drillIds.length, 'every about block defines ' + k + ' (' + n + '/' + drillIds.length + ')');
}
// the villain-face-up crutch must be confined to the outs drill
const faceUp = (src.match(/villain shows/g) || []).length;
P(faceUp === 1, 'only one place renders villain face-up (' + faceUp + ')');

// 6. things the review flagged, guarded so they cannot silently return
console.log('');
P(/Chance you hit at least one out/.test(dblock),
  'outs Q2 asks for P(hit an out), not equity (the grading bug from review)');
P(!/EV of calling, in chips/.test(dblock),
  'callfold no longer grades EV in chips (only 30.6% achievable mentally)');
P(/kind:'market'/.test(dblock), 'the market drill exists (bid/ask, the SIG format)');
P(/comboCount/.test(src), 'combo counting with blockers exists');
P(/eqVsRanges/.test(src), 'equity against ranges exists, so villain can stay hidden');
P(/transition:opacity/.test(src), 'there is at least one transition (change blindness)');
P(/class="bar"/.test(src) || /barHtml/.test(src), 'the equity bar visual exists');
P(/deadOuts/.test(src), 'dead outs are computed and shown struck through');
P(/TARGETS=/.test(src), 'per-drill target times exist (the drill is timed)');

console.log('');
console.log(ok ? 'STATIC CHECKS PASS' : 'STATIC CHECKS FAILED');
process.exit(ok ? 0 : 1);
