# Phỏm (Tá Lả) — Complete Game Rules & Scoring Reference
> Paste this entire document into Claude Code as your game specification.

---

## Overview

Phỏm (also called Tá Lả) is a Vietnamese card game in the Rummy family.
- **Players:** 2–4 (best at 3–4)
- **Deck:** Standard 52-card deck, no Jokers
- **Objective:** Form valid card combinations called **phỏm**, minimize leftover "trash" cards (rác), and score the highest cumulative points across rounds.

---

## Card Values

Used for **trash card (rác) point calculation** at end of round:

| Card | Points |
|------|--------|
| A    | 1      |
| 2–9  | Face value (2=2, 3=3 … 9=9) |
| 10   | 10     |
| J    | 11     |
| Q    | 12     |
| K    | 13     |

> ⚠️ Unlike many Rummy variants, J/Q/K are NOT all worth 10 — they are worth 11/12/13 respectively. This makes high-rank trash cards very costly.

---

## What is a Phỏm?

A **phỏm** is a valid set of **3 or more cards** of one of two types:

### 1. Three/Four of a Kind (Sám Cô)
- 3 or 4 cards of the **same rank**, any suits
- Example: 4♠ 4♦ 4♥ or K♠ K♣ K♦ K♥

### 2. Straight Flush (Thông / Sảnh)
- 3 or more **consecutive ranks** of the **same suit**
- Example: 4♣ 5♣ 6♣ or 6♥ 7♥ 8♥ 9♥ 10♥
- Ace is LOW only: A-2-3 is valid, Q-K-A is NOT valid

### Invalid combinations:
- Mixed suits in a straight (must be same suit)
- Fewer than 3 cards
- More than 4 cards in a single phỏm

---

## Glossary of Key Terms

| Term | Meaning |
|------|---------|
| **Phỏm** | A valid 3+ card combination (straight flush or same rank) |
| **Rác (Bài Rác)** | Leftover cards in hand that don't belong to any phỏm |
| **Nọc** | The draw pile — remaining cards after dealing, placed face-down in the center |
| **Ù** | A perfect win — all cards form phỏm, zero rác remaining |
| **Ù Khan** | A special case: after the deal, a player's hand has NO pairs, NO potential phỏm combinations whatsoever — declared immediately |
| **Móm / Cháy** | Finishing a round with zero phỏm laid down — a heavy penalty |
| **Ăn Chốt** | On the final turn, a player discards and another player steals (ăn) that card |
| **Gửi** | On the final turn, if your rác card can extend another player's already laid-down phỏm, you may "send" it there — it no longer counts as rác |
| **Đền** | A penalty triggered when: (a) you steal a card on the final turn and someone later goes Ù, OR (b) you had 3 consecutive cards stolen from you. The player who caused the situation must compensate |
| **Tái** | After laying down phỏm, if another player gets their card stolen (ăn chốt), a "replay" turn is triggered and you may lay down again |

---

## Setup

1. Shuffle the 52-card deck.
2. Determine the dealer (randomly or the previous round's winner).
3. Deal cards clockwise:
   - The **dealer** (or previous winner) receives **10 cards** and plays first
   - All other players receive **9 cards** each
4. All remaining cards go face-down in the center as the **draw pile (nọc)**.
5. No card is pre-flipped — the first player leads by discarding from their hand.

---

## Turn Structure

Play proceeds **clockwise**. The dealer (10 cards) goes first.

### Each Turn:

**Step 1 — Steal or Draw**
- If the previous player just discarded, you may **steal** that card IF it completes a phỏm in your hand (see Stealing section).
- If you don't steal, draw **1 card** from the top of the draw pile (nọc).

**Step 2 — Discard**
- Play **1 card** face-up to the discard area.

**Step 3 — Lay Down (only at specific moments)**
- **After a successful steal** (Step 1), you must lay down the phỏm that includes the stolen card. See *Stealing*.
- **At lap-close** (your 4th discard during the last lap), you lay down all remaining valid phỏm and reveal your rác. See *Round End*.
- Otherwise, any organic phỏm you hold from drawing or the deal stays hidden in your hand. Other players can't see it.
- Once laid down, those cards are safe and not counted as rác at scoring.

Repeat until someone goes **Ù** or the round-end condition is triggered.

---

## Stealing (Ăn Bài) — The Core Mechanic

When a player discards, the **next player clockwise** may steal it to complete a phỏm. If they don't want it, the player after them may steal, and so on.

### Key Rules:
- You can only steal a card if it **completes a phỏm** with cards already in your hand
- Only the **top discard** (most recently played card) can be stolen
- Stealing replaces your draw step — you do not also draw from the pile
- After stealing, you still must discard 1 card

### After a Steal: Lay Down the Completed Phỏm

Because the steal had to complete a phỏm, you must **immediately lay down** that phỏm (including the stolen card) face-up in front of you. This applies in **any lap**, not just the last one.

- If the stolen card could complete more than one possible phỏm, you choose which one to lay down.
- **Only the stolen-completed phỏm gets revealed.** The rest of your hand — including any organic phỏm you may already hold from the deal or from drawing — stays hidden until lap-close in the last lap.
- After laying down the stolen-completed phỏm, you still discard 1 card from your remaining hand.

### Card Pile Balancing After a Steal:
When a player steals, the discard piles are rebalanced so each player has an equal number of played cards per turn. Specifically: one card from the next player's discard pile is moved to balance the count after the steal.

> Example: Before the steal, each player has 3 cards in their discard pile. After the steal, the stealer's pile is short by 1. One card from the next-to-play player's pile is moved over to balance: resulting in equal piles, and the next player has one fewer in their pile.

---

## Round End — Per-Player Lap-Close

The round ends when **two conditions are both met**: every player has laid down their hand AND the draw pile is empty. Because of the lap-balancing rule (see *Stealing*), these two conditions naturally coincide on the same turn.

### Lap-close — when a player discards their 4th card

Each player closes their lap individually — there is no synchronized cascade.

1. They discard their 4th card normally.
2. They **immediately lay down** any remaining valid phỏm from their hand. (Phỏm completed by earlier steals were already laid down at the moment of the steal.)
3. If they have laid down **zero phỏm for the entire round** (none organically now, and none stolen-completed earlier), they're flagged **Móm** for scoring — they still proceed through the rest of the sequence.
4. They **reveal** any remaining rác cards face-up in their hand zone with a subtle "revealed" outline.
5. They have a **gửi opportunity** for any revealed rác that fits another already-laid-down phỏm. The lap-4 starter has nothing to gửi to (they're first); every subsequent lap-closer can gửi to whoever went before them. See the *Gửi* section.
6. Play passes to the next player. The 4th discard is still stealable like any other.

### Stealing the 4th discard

The 4th discard is treated the same as any other discard:
- The next player may steal it if it completes a phỏm.
- If stolen, the lap-balancing rule applies — the `starterIdx` shifts one step forward and discard counts rebalance via the N-formula.
- The original starter therefore becomes the **new closer** and will reappear in the rotation for an "extra turn."

### Extra turns — when the rotation returns to a laid-down player

A laid-down player still participates in the rotation. An extra turn proceeds in this order:

1. **Optional steal** of the previous player's discard if it would complete a phỏm in their (revealed) hand — rare in practice, but allowed.
2. **Draw + discard** if their `discardCount < 4` (because lap-balancing decremented it from a steal). The player draws one card from the pile, then discards any card from their hand (the drawn card or any of their revealed rác). The discard is itself stealable. *Edge case*: if the pile is empty in this slot, fall back to discarding a rác card directly.
3. **Gửi opportunity** at the end of the turn — send any revealed rác that fits another laid-down phỏm. See the *Gửi* section.
4. If none of the above had any effect, the turn passes. The human sees an explicit **Pass** button to confirm.

> Because each extra turn draws from the pile, the math works out: across the round, the 15 draws (or fewer when steals replace draws) exactly drain the pile by the time every player has reached `discardCount = 4`.

### Why both end conditions coincide

Each normal turn uses one draw OR one steal (a steal doesn't draw and instead shifts the starter forward). Over the lap-balanced 16 total discards, that consumes exactly the 15 cards in the draw pile (the dealer's first discard is "free" — no draw needed). So by the time the final 4th discard lands, the pile is exactly empty and every player has already laid down.

### Instant end via Ù

The round ends immediately if any player declares **Ù** at any moment during play. See the *Ù* section.

> When **ăn chốt** is implemented, it will also trigger a **Tái** (replay turn) giving laid-down players an extra chance to lay down or gửi again.

---

## Gửi (Sending Cards to Another's Phỏm)

**Gửi** lets a laid-down player send one of their revealed rác cards onto another player's already laid-down phỏm. A sent card no longer counts as rác for scoring.

A card can be gửi if it legally extends the receiving phỏm:
- **Sám cô** — the card matches the existing rank (a 3-of-a-kind grows into a 4-of-a-kind).
- **Thông** — the card is the next consecutive rank in the same suit, at **either end** of the run. A 5♠-6♠-7♠ can be extended by a 4♠ (low side) or an 8♠ (high side). Ace is low only — A♠-2♠-3♠ is fine but Q♠-K♠-A♠ is not.

**Once a phỏm has been laid down, the 4-card maximum no longer applies.** A laid-down thông can keep growing as long as eligible cards come in — in theory all the way from A to K in a single suit. (A sám cô still caps at 4, because only four cards of each rank exist.)

### When gửi happens

Gửi only happens **during the last lap** (i.e., once at least one player has lap-closed). It runs at the **very end of a lap-close or extra turn**, after the player has discarded their rác card and laid down their phỏm. At that moment, the player checks their revealed rác for any cards that legally extend a phỏm laid down by a player who has **already lap-closed**, and may send **as many eligible cards as they have**, one at a time.

> **Lap-closed targets only.** Phỏm laid down mid-game from a steal (B2) are *not* gửi targets while their owner is still mid-round. Only once that owner lap-closes do their phỏm become eligible. This keeps the rule consistent with the example below — the lap-4 starter genuinely has no one to gửi to at their lap-close moment, regardless of any earlier B2 steal-lay-downs.

> **Móm players cannot gửi.** A player who finishes the round with zero phỏm laid down (Móm) does not get a gửi opportunity. They keep every rác card and pay the full penalty. Without this rule, a Móm player could trim their rác total by sending cards onto opponents' phỏm, weakening the punishment Móm is designed to deliver.

This means:
- The **first player to lay down** (the lap-4 starter) has no one to gửi to — no other player has lap-closed yet. They get no gửi opportunity at lap-close.
- The **second** to lay down can gửi to the first.
- The **third** can gửi to the first two.
- The **closer** (last to lay down) can gửi to everyone who came before.
- An **extra turn** (granted when a steal during the last lap shifts the starter) also ends with a gửi opportunity — even for the first-to-lay-down, who finally has lap-closed phỏm to send to.

AI players send any eligible card automatically; the human gets a list of buttons — one per valid send — and a Done button when finished.

---

## Ăn Chốt & Đền (Final Turn Steals & Penalties)

**Ăn Chốt:** On a player's final discard turn, if another player steals that card, the discarding player has been "ăn chốt."

**Đền (Compensation) is triggered if:**
1. A player steals on the final turn (ăn chốt), and then someone else goes **Ù** — the ăn chốt player must pay the Đền penalty
2. A player has **3 consecutive cards stolen** from them during the round

**Đền chain:** If player A ăn chốt, then player B (who comes after A) also ăn chốt, player B takes over the Đền responsibility from player A.

---

## Ù (Perfect Win)

A player goes **Ù** when every card remaining in their hand forms a valid phỏm — zero rác left over. The round ends immediately.

### When Ù is checked

The game checks for Ù **at every moment the hand composition changes**:
- After drawing a card.
- After stealing a card.
- After gửi-ing a rác card to another player's phỏm.
- After discarding (if the discarded card was the player's last rác).

### Types

- **Normal Ù** — achieved mid-round by drawing, stealing, gửi-ing, or discarding into pure phỏm.
- **Ù Khan** — declared right after the deal when a player's hand has zero pairs and zero potential phỏm combinations whatsoever. A "lucky misery" hand.

### Scoring

- The Ù player earns **+15 points**.
- Every other player **loses 5 points**.

### Celebration

When Ù is declared, the game shows a large center-screen overlay with the winning player's name and an emoji burst, then auto-fades into the scoring screen. **Ù Khan** uses a more elaborate version — longer duration, larger burst, distinct styling — to mark the rarer event.

---

## Scoring System

### Card Point Values (for rác calculation)
A=1, 2=2 … 10=10, J=11, Q=12, K=13

### End-of-Round Rankings
At the end of each round, players are ranked 1st through last (Bét) based on:
1. **Lowest rác point total** wins
2. **Tie-break:** whoever laid down their phỏm first ranks higher

### Points Awarded Per Round

| Placement / Condition | Points |
|-----------------------|--------|
| 1st place (Nhất) | **+6** |
| 2nd place (Nhì) | **−1** |
| 3rd place (Ba) | **−2** |
| Last place (Bét) | **−3** |
| Ăn Chốt (stole the final discard) | **+4** |
| Got Ăn Chốt'd (your final discard was stolen) | **−4** |
| Ù or Ù Khan (perfect win) | **+15** (each other player loses 5) |
| Móm / Cháy (zero phỏm laid down) | **−4** (paid to the 1st place winner) |

### Cumulative Score
Points accumulate across rounds. The player with the **highest total score** at the end of all agreed rounds wins.

---

## Quick Reference Card

```
SETUP:         52 cards, 2–4 players. Dealer gets 10 cards and goes first. Others get 9.
TURN:          Steal last discard OR draw from pile → Discard 1 → Optionally lay down phỏm
PHỎM TYPES:   Same rank (3–4 cards) | Consecutive same suit (3+ cards)
ROUND ENDS:    When all players have laid down AND draw pile is empty | Instant on Ù
Ù:             All cards form phỏm, zero rác → instant win, +15pts, others −5pts each
SCORING:       Rank by rác total → 1st=+6, 2nd=−1, 3rd=−2, Last=−3
MÓM:           Zero phỏm laid down → −4pts to winner
ĂN CHỐT:      Steal final discard → +4pts | Getting stolen → −4pts
CARD VALUES:   A=1, 2–10=face, J=11, Q=12, K=13
ACE:           Always low — A-2-3 valid, Q-K-A invalid
GỬI:           Send rác card to extend another's laid-down phỏm → not counted as rác
```

---

## Implementation Notes for Developers

### State to track per player:
- `hand`: array of cards (face-down to others; face-up after lap-close as "revealed rác")
- `laidDown`: array of phỏm arrays
- `discardPile`: personal discard pile (physical cards on table, for display)
- `discardCount`: how many discards this player has made (drives lap-close at 4 and lap-balancing)
- `hasLaidDown`: boolean — has this player closed their lap?
- `isMom`: boolean — did they lay down zero phỏm?
- `ateChot`: boolean — did they steal the final discard?
- `gotChot`: boolean — was their final discard stolen?

### State to track globally:
- `drawPile`: remaining deck
- `lastDiscard`: the card available to steal
- `currentTurnIndex`: whose turn it is
- `starterIdx`: who holds the "starter" role for the current lap (shifts forward on every steal)
- `roundNumber`, `cumulativeScores`

### Key functions to implement:
- `isValidPhom(cards[])` → boolean (check sám cô or straight flush)
- `canSteal(card, hand[])` → boolean (does it complete any phom in hand?)
- `checkU(hand[])` → boolean (can the entire hand partition into valid phỏm?)
- `layDownAtLapClose(playerIdx)` → called when this player's 4th discard lands; immediately lays down phỏm + reveals hand
- `calculateRac(hand[], laidDown[])` → sum of non-phom card values
- `canGui(racCard, otherPlayerPhom[])` → boolean (can extend their phom?)
- `scoreRound(players[])` → assign +/− points based on ranking + special conditions

### Suggested game loop:
```
dealRound()
→ if any hand has Ù Khan → declare immediately, skip to scoreRound()
→ playTurns() loop:
   • normal turn: steal-or-draw → discard → check Ù
   • on 4th discard: lay down phỏm + reveal hand → gửi opportunity (empty for the very first to lay down)
   • on extra turn (player already laid down):
     – forced rác discard if discardCount < 4
     – optional steal + optional gửi → check Ù after each
   • check Ù after every hand-changing action (draw, steal, gửi, discard)
   • end as soon as: all laid down AND draw pile empty, OR Ù declared
→ scoreRound() [rank players, apply bonuses/penalties]
→ nextRound()
```