# Phỏm · Tá Lả 🎮

A Vietnamese card game (Rummy family) for 1 human player vs 3 AI opponents, built with vanilla HTML/CSS/JS — no frameworks, no build tools, no npm.

**🕹️ Play it live:** https://linhdangk92-sketch.github.io/Linhsfirstgame/

---

## How to play

Each round, you and three AI players try to form **phỏm** (valid card groups) and discard the rest. The player with the **lowest leftover (rác) total** wins the round.

A valid phỏm is either:
- **Sám cô** — 3 or 4 cards of the same rank (e.g. `5♠ 5♥ 5♦`)
- **Thông** — 3+ consecutive same-suit cards (e.g. `4♠ 5♠ 6♠`)

On your turn you either:
- **Steal** the most recent discard if it completes a phỏm in your hand (the phỏm is immediately laid down face-up), OR
- **Draw** the top card from the deck

Then **discard one card** by dragging it to the center. The round ends after each player has discarded 4 cards.

### Special endings
- **Ù** — your remaining hand is all valid phỏm with zero rác → instant win (+15 to you, −5 to everyone else)
- **Ù Khan** — your starting hand has zero pair/near-phỏm potential → optional instant declare for +15
- **Đền (compensation)** — three triggers that fire when stealing the 4th discard sets up other endings (T1, T2, T3 in the code — banners explain each one in plain English)
- **Móm** — finishing a round with zero phỏm laid down → −4 penalty paid to the winner

**Game winner** = highest cumulative score after the configured number of rounds.

## Start menu

Before each game the start overlay lets you:
- **Type your name** (optional — defaults to "You", 12 chars max)
- **Pick the number of rounds** — 3, 4, 5, 7, or 10
- **Toggle Slow play** — turns off the 20s steal/draw timer and 60s discard timer so you can take all the time you want

Settings persist across "Play Again". Refresh the page to change them.

## How to run locally

Open `index.html` in a browser — no install or build step. The same file is what's deployed to GitHub Pages.

## Features

- **Optimal phỏm-finder** — backtracks across every valid hand partition and picks the one with the lowest rác total (handles tricky overlaps like a `4-5-6` thông competing with `5-5-5` + `6-6-6` sám cô)
- **Multi-option lay-down picker** — when two phỏm partitions tie for optimal, you choose which one to lay down (instead of the game silently picking)
- **Three AI difficulty levels** — Easy, Medium, Hard — randomly rotated across the three AI seats each game so the human isn't always next to the easy one
  - Same phỏm-recognition for all; mistake frequency differs (90% / 75% / 40% optimal)
  - Easy ignores opponent-feed avoidance; Medium and Hard track it
  - Hard declines low-value steals (skips a 3-card phỏm worth <12 rank value unless it completes Ù or a 4-card phỏm)
  - Cards anchoring multiple potential phỏm score higher than isolated cards
- **Card animations** — deal flight, discard slide, steal with center-screen reveal
- **Sound effects** — shuffle, deal, discard, steal, Ù fanfare, Móm wah-wah, round-win arpeggio, game-win grand fanfare; mute toggle in the header
- **Drag-to-discard, drag-to-reorder, auto-sort** by rank or suit
- **Hover-to-fan-out** on opponent piles and your own laid-down phỏm — useful late in a round when piles get clustered
- **Per-player lap-close** — each player closes their own lap when they hit 4 discards; the rotation keeps spinning so laid-down players take *extra turns* (optional steal → draw+discard if still <4 → gửi → otherwise pass)
- **Gửi** — send rác cards to extend opponents' laid-down phỏm during the last lap (Móm players cannot gửi; they pay the full penalty)
- **Đền (compensation) fully implemented** — T1, T2, T3 triggers with center-screen announcements and per-player payment toasts
- **Responsive layout** for desktop, tablet, and large phone (smartphone-portrait <480px is in progress)

## Tech stack

- Vanilla HTML / CSS / JS — no dependencies
- Web Audio API for synthesized sound effects (no audio files)
- CSS Grid + Flexbox for the table layout
- HTML5 drag-and-drop for card moves
- GitHub Pages for hosting (auto-deploys on push to `main`)

## Project structure

```
index.html       — HTML skeleton, loads scripts in order
style.css        — all styling
js/
  constants.js   — RANKS, SUITS, RANK_VALUE, NAME_POOL, AVATAR_MAP, PLAYER_CFG,
                   TOTAL_ROUNDS, SLOW_PLAY
  state.js       — the `state` object (single source of truth)
  audio.js       — Web Audio synthesis for game sound effects
  deck.js        — buildDeck, shuffle
  phom.js        — phỏm validation, partition finder, Ù check, gửi check
  render.js      — DOM rendering, animations, toasts, celebrations
  turns.js       — turn loop, steal/draw/discard, AI logic
  laydown.js     — lay-down, per-player lap-close, gửi step
  scoring.js     — endRound, Ù declaration, Đền paths, game-over
  main.js        — dealRound + start-overlay wiring
rules.md         — full game rules reference (in Vietnamese context)
CLAUDE.md        — dev notes for Claude (gitignored)
TODO.md          — open work items (gitignored)
```

Each JS file can only use globals defined in files above it in the load order.

## Roadmap

- **Smartphone-portrait layout (<480px)** — current responsive design covers desktop, tablet, and large phone; narrow phones need a vertical-stack redesign
- **Hard AI: deeper opponent prediction** — track each opponent's discard pile (suits/ranks they don't want) and stolen cards (patterns they're building) to feed smarter discard choices
- **Easy AI: occasional rookie behaviors** — sometimes skip a stealable card (didn't notice the phỏm)
- **Consolidate `RANK_ORDER` / `RANK_VALUE`** — they currently hold identical data