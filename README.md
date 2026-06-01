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
- After every discard, phỏm are automatically detected in your hand
- Human sees "Lay Down / Skip" buttons; AI lays down automatically
- After lay-down, Gửi: the human can send rác cards to extend opponents' phỏm; AI does it automatically
- **Móm players cannot Gửi** — zero phỏm laid down means no rác-shrinking; they pay the full penalty
- Round-end cascade triggers when every player has discarded 4 times (the lap-balancing rule keeps all four discard counts synchronized through steals)
- All players lay down their phỏm in turn order, then scores are calculated and all AI hands are revealed
- Round scores: 1st=+6, 2nd=−1, 3rd=−2, last=−3; Móm penalty=−4 paid to winner
- Ù mid-turn (and Ù Khan at deal time) awards +15 to the winner and −5 to everyone else
- Multi-round flow works: up to 4 rounds, then game-over screen with final rankings
- **Game winner gets the Ù Khan celebration** — the elaborate gold-gradient overlay with 30-particle burst fires when the 4 rounds finish, naming the overall winner (or ties)
- **Auto-sort buttons above the hand** — "Sort by Rank" and "Sort by Suit" reorder cards instantly; manual drag-and-drop reordering still works afterwards

**Up next:** Phase 5 — Ăn Chốt and Đền scoring, plus AI difficulty differentiation.
