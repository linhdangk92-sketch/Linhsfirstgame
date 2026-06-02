# Phỏm · Tá Lả

A Vietnamese card game (Rummy family) for 1 human player vs 3 AI opponents, built with vanilla HTML/CSS/JS.

## How to play
- Take turns stealing the discard or drawing from the pile, then discard 1 card
- Form valid **phỏm** (3–4 of a kind, or 3+ consecutive same-suit cards) and lay them down
- Round ends when each player has discarded 4 times — lowest trash (rác) card total wins
- Win condition: highest cumulative score after 4 rounds
- Lose condition: most penalty points (from trash cards, Móm, Đền, Ăn Chốt)

## How to run
- Open `index.html` in a browser — no install or build step needed

## Tech stack
- Vanilla HTML/CSS/JS — everything in `index.html`
- No dependencies

## Project structure
- `index.html` — HTML skeleton, loads all scripts
- `style.css` — all CSS
- `js/` — game logic split by concern (constants → state → deck → phom → render → turns → laydown → scoring → main)
- `rules.md` — full game rules reference
- `CLAUDE.md` — dev instructions for Claude

## Current status
**Phase 4 complete** — Gửi and Ù / Ù Khan detection working.
- Phỏm-finder is **optimal** — backtracks across every valid partition of your hand to pick the one that leaves the LOWEST rác total (handles tricky overlaps like `4-5-6` thông vs `5-5-5` + `6-6-6` sám cô)
- After every discard, phỏm are automatically detected in your hand
- Human sees "Lay Down / Skip" buttons; AI lays down automatically
- After lay-down, Gửi: the human can send rác cards to extend opponents' phỏm; AI does it automatically
- **Móm players cannot Gửi** — zero phỏm laid down means no rác-shrinking; they pay the full penalty
- **Per-player lap-close** — each player closes their own lap when their `discardCount` hits 4: they immediately lay down their phỏm, reveal their hand, and get a gửi step. The rotation keeps spinning so already-laid-down players take *extra turns* (optional steal → draw+discard if still <4 → gửi → otherwise pass)
- **Lay-down on steal** — a successful steal forces immediate lay-down of the phỏm completed by the stolen card (human picks if multiple configurations are possible); other phỏm stay hidden until lap-close
- Round ends only when *all players have laid down AND the draw pile is empty* — those two conditions coincide thanks to the lap-balancing rule
- Round scores: 1st=+6, 2nd=−1, 3rd=−2, last=−3; Móm penalty=−4 paid to winner
- **Đền (compensation)** — three triggers, all routed through Ù-style endings:
  - **T1** (you Ăn Chốt then someone else Ù's): you absorb everyone's −5 (net −15); the other two losers end at 0
  - **T2** (your immediate-next-player has cumulatively stolen 3 of your discards): round ends instantly, stealer is "considered Ù'd" (+15), you pay −15, others end at 0
  - **T3** (you Ù via the stolen card itself): you pay −5 to the player you ăn chốt'd from (your net +10, victim 0, others normal −5)
  - Chain transfer: every new Ăn Chốt overwrites who's liable for T1, so only the most-recent stealer is on the hook
- Ù mid-turn awards +15 to the winner and −5 to everyone else
- **Ù Khan declare button** — at the start of each player's untouched first turn, the game checks if their dealt hand is Ù Khan (zero pairs, zero near-sequences). AI auto-declares; human sees a "Declare Ù Khan! 🏆" button and a "Skip — play normally" button. Same +15 / −5 scoring as Ù, with the elaborate gold-gradient celebration
- Multi-round flow works: up to 4 rounds, then game-over screen with final rankings
- **Game winner gets the Ù Khan celebration** — the elaborate gold-gradient overlay with 30-particle burst fires when the 4 rounds finish, naming the overall winner (or ties)
- **Auto-sort buttons above the hand** — "Sort by Rank" and "Sort by Suit" reorder cards instantly; manual drag-and-drop reordering still works afterwards

**Up next:** AI difficulty differentiation (Easy / Medium / Hard play identically today).
