# Poker Odds Drill

A single-file trainer for the thing strong players do at the table: see your cards and a board, and
produce a defensible equity, pot-odds and EV judgement in seconds using mental arithmetic.

It deals a situation, you estimate, it grades you against the exact number and shows the method that
gets there. No accounts, no network, no build step. One HTML file.

The theory behind every drill is in `Poker_Math_Study_Guide.pdf`
(`MQF/cerificate & resume/study-guides/`).

## The five drills

| Drill | You are shown | You answer | Graded against |
|---|---|---|---|
| Outs and equity | your hand, the board, villain's hand face-up | outs, then your equity % | exact count; exact enumeration of all 990 (flop) or 44 (turn) runouts |
| Pot odds | pot and bet size | equity needed to call | `b/(P+2b)` |
| Call or fold | full spot with pot and bet | Call/Fold, then EV in chips | `E > b/(P+2b)`; `E(P+b) - (1-E)b` |
| Preflop matchups | two hands face-up | your equity % | Monte Carlo, N=40,000, standard error about 0.25 points |
| Bluff frequency and MDF | pot and your bet | bluff share of your range, then his MDF | `b/(P+2b)`; `P/(P+b)` |

Tolerances: outs and the Call/Fold decision are exact, equity is plus or minus 3 points, the
arithmetic drills plus or minus 2 points, EV plus or minus 5% of the final pot.

**`P` is the pot before the bet.** So calling 50 into 100 wins 150 and risks 50. Required equity is
`b/(P+2b)`, and `EV(call) = E(P+b) - (1-E)b`. The other convention, where the quoted pot already
includes villain's bet, gives different-looking numbers for the same spot.

## Run it on your laptop

```powershell
cd "C:\Users\moham\Documents\MQF\projects\Local\Poker"
python -m http.server 8000
```

Then open <http://localhost:8000/>. Opening `index.html` directly as a file works too.

## Run it on your phone

Same Wi-Fi network as the laptop.

1. Serve on all interfaces, not just loopback:

   ```powershell
   cd "C:\Users\moham\Documents\MQF\projects\Local\Poker"
   python -m http.server 8000 --bind 0.0.0.0
   ```

2. Find the laptop's LAN address:

   ```powershell
   ipconfig
   ```

   Look under **Wireless LAN adapter Wi-Fi** for **IPv4 Address**, something like `192.168.1.42`.

3. On the phone, open `http://192.168.1.42:8000/`.

4. Windows Firewall will usually prompt the first time. Allow Python on **Private** networks. If no
   prompt appears and the phone cannot connect, add the rule once from an admin PowerShell:

   ```powershell
   New-NetFirewallRule -DisplayName PokerDrill -Direction Inbound -Protocol TCP `
     -LocalPort 8000 -Action Allow -Profile Private
   ```

5. Add to Home Screen so it opens without browser chrome:
   - **iOS Safari**: Share, then Add to Home Screen. Opens standalone.
   - **Android Chrome**: three dots, then Add to Home screen. Opens as a shortcut in Chrome.

### What LAN mode does not give you

Offline use. A service worker will not register over plain `http://` to an IP address, because only
`localhost` is exempt from the secure-origin rule. So over Wi-Fi the laptop has to be awake and
serving. Everything else works, and nothing is fetched from the internet at any point.

If you want it fully offline and independent of the laptop, push this folder to GitHub Pages the way
`../News/` is published. HTTPS comes free, and then a small `sw.js` plus `manifest.json` will make it
installable. `index.html` itself does not change.

`python -m http.server` sends no cache headers, so after editing the file, kill the server, restart
it, and reopen the app on the phone.

## Tests

```powershell
node test/node_test.js            # about 2 seconds
node test/node_test.js --seven    # adds the full C(52,7) sweep, about 20 seconds
```

The harness slices the `<script id="engine">` and `<script id="drills">` blocks out of `index.html`
and runs them directly, so there is no second copy of the engine to drift.

What it proves:

- Every one of the **2,598,960** five-card hands is categorised correctly, and the ten category
  counts match the known frequencies exactly.
- With `--seven`, every one of the **133,784,560** seven-card hands as well. This is the real proof
  that best-five-of-seven selection is right.
- Hand ordering: the wheel is the lowest straight, a wheel flush is still a straight flush, flush
  beats trips with seven cards, kickers break ties correctly, and so on.
- Deterministic outs: A&hearts;K&hearts; on Q&hearts;7&hearts;2&clubs; against Q&spades;Q&diams; is
  exactly 8 outs, because the 2&hearts; gives villain queens full.
- Nine exact preflop matchups, including that **AA against KK is 82.64% / 81.95% / 81.26%** for two,
  one and zero shared suits. Suits are worth 1.4 points, which is why there is no lookup table in
  here: the 169 hand classes do not determine hand-versus-hand equity.
- All five drills generate, ask and explain cleanly over 200 deals each, with their invariants held.

In the browser, `?test=1` runs the same style of checks in-page:
<http://localhost:8000/?test=1>. Run this on the phone once too.

## The number that surprises people

A&hearts;K&hearts; on Q&hearts;7&hearts;2&clubs; against Q&spades;Q&diams; has three different
"probabilities", and the drills grade the last one:

| | |
|---|---|
| 36.36% | chance of completing the flush, `1 - C(36,2)/C(45,2)`. What the rule of 4 estimates. |
| 32.73% | chance of hitting one of the **8 clean** outs. The 2&hearts; is dead. |
| **25.56%** | actual equity, 253 of 990 runouts. Villain fills up or makes quads on 116 of the 360 boards where you do make the flush. |

Hitting your out is not the same as winning the hand. The rule of 4 is answering a different
question from the one you care about.

Note also that this uses `U = 45` unseen cards, because the drill shows you villain's hand. The
textbook rule of 2 and 4 assumes `U = 47`, villain unknown, which reads 34.97% instead of 36.36%.

## Conventions

Static single file, no build step, no external requests, dark only. Details in `CLAUDE.md`.
