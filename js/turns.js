// ═══════════════════════════════════════════════════════════════════
// TURNS — steal/draw/discard loop for human and AI players
// ═══════════════════════════════════════════════════════════════════

// ── Timer Management ─────────────────────────────────────────────

const timers = { steal: null, discard: null };

/* Cancel all running countdown timers */
function clearAllTimers() {
  if (timers.steal)   { clearInterval(timers.steal);   timers.steal   = null; }
  if (timers.discard) { clearInterval(timers.discard); timers.discard = null; }
}

// ── Turn Entry Point ──────────────────────────────────────────────

/* Called at the start of every player's turn */
function startTurn() {
  // Tutorial practice round: once the human has discarded (step 3) and
  // the turn advances to an AI, FREEZE — return before scheduling any
  // AI think-pause setTimeout. Without this, the AI's queued runAiTurn
  // would fire ~850ms later and (potentially) leak into the real round
  // 1 that dealRound() starts when the user clicks "Start Real Game".
  if (typeof TUTORIAL_PRACTICE_ACTIVE !== 'undefined'
      && TUTORIAL_PRACTICE_ACTIVE
      && !PLAYER_CFG[state.currentTurn].isHuman) {
    return;
  }
  // Multiplayer gate: only the active human (or host for AI) drives the
  // turn. Other browsers just spectate the rendered state — they'll get
  // the next state update via the Firebase listener when this turn ends.
  if (typeof IS_MULTIPLAYER_GAME !== 'undefined' && IS_MULTIPLAYER_GAME) {
    const cfg = PLAYER_CFG[state.currentTurn];
    const shouldDrive = cfg.isHuman
      ? state.currentTurn === MY_ABSOLUTE_SEAT
      : _mpIsHost;
    if (!shouldDrive) return;
  }
  clearAllTimers();
  clearStealable();
  state.stealHappenedThisTurn = false;
  state.selectedDiscardCard   = null;
  /* T3 window closes when a new turn begins. If the previous turn's
     ăn chốt-er didn't Ù during that turn, the T3 marker expires — they're
     off the T3 hook. (state.denLiable still tracks them for T1 in case
     someone ELSE Ù's later in the round.) */
  state.pendingTrigger3       = null;
  renderActionBar([]);
  renderScores();
  renderActiveZone();

  // B5: laid-down players take extra turns (restricted actions).
  if (state.players[state.currentTurn].hasLaidDown) {
    startExtraTurn();
    return;
  }

  // Ù Khan declare window — only on each player's untouched first turn.
  // firstTurn flips to false here so the check never re-fires for the same
  // player (their hand changes after their first draw/discard anyway, but
  // this gate is the authoritative way to close the window).
  const player = state.players[state.currentTurn];
  if (player.firstTurn) {
    player.firstTurn = false;
    if (isUKhan(player.hand)) {
      if (PLAYER_CFG[state.currentTurn].isHuman) {
        showHumanUKhanPrompt();
      } else {
        // AI auto-declares — no choice involved, the bonus is always worth taking.
        setStatus(PLAYER_CFG[state.currentTurn].name + ' has Ù Khan! 🏆 Round over!');
        setTimeout(() => declareU(state.currentTurn, true), 900);
      }
      return;
    }
  }

  const cfg = PLAYER_CFG[state.currentTurn];
  if (cfg.isHuman) {
    startHumanTurn();
  } else {
    setStatus(cfg.name + ' is thinking…');
    setTimeout(() => runAiTurn(), 850);
  }
}

/* Human turn: if there's a stealable card, show steal/draw choice;
   if not (first turn of the round), go straight to discard. */
function startHumanTurn() {
  const disc = state.lastDiscard;
  if (!disc) {
    setStatus('Your turn — pick a card to discard.');
    showDiscardUI();
    return;
  }
  const prevIdx    = (state.currentTurn - 1 + 4) % 4;
  // MULTIPLAYER: check steal-ability against MY hand, not seat 0's.
  // For a guest at seat 1/2/3, state.players[0].hand is the host's hand
  // — using that would say "you can steal" only when the HOST could,
  // never when the guest actually has matching cards.
  const localSeat  = (typeof MY_ABSOLUTE_SEAT !== 'undefined') ? MY_ABSOLUTE_SEAT : 0;
  const canDoSteal = canSteal(disc, state.players[localSeat].hand);
  highlightStealable(prevIdx);
  showStealDrawUI(canDoSteal, disc);
}

/* Human's Ù Khan choice. Their dealt hand has zero pairs and zero near-sequences
   (impossible to make any phỏm) — they can declare to win the round (+15) or
   skip and play normally. Clicking Skip drops them into the regular turn flow;
   the firstTurn flag was already flipped in startTurn, so this opportunity
   never re-appears for them later in the round. */
function showHumanUKhanPrompt() {
  state.phase = 'ukhan-prompt';
  setStatus('Your hand is Ù Khan! Zero phỏm possible — declare for +15, or skip to play normally.');

  const declareBtn = makeBtn('Declare Ù Khan! 🏆', 'btn-laydown', () => {
    renderActionBar([]);
    declareU(0, true);
  });

  const skipBtn = makeBtn('Skip — play normally', 'btn-draw', () => {
    renderActionBar([]);
    state.phase = 'playing';
    startHumanTurn();
  });

  renderActionBar([declareBtn, skipBtn]);
}

// ── Steal / Draw ──────────────────────────────────────────────────

/* Show Steal and Draw buttons with a 20-second countdown.
   The Steal button is disabled when the card doesn't complete any phỏm.
   S3: when SLOW_PLAY is on, the countdown bar is omitted and no auto-draw
   interval is started — the prompt waits for the human to click. */
function showStealDrawUI(canDoSteal, disc) {
  state.phase = 'steal-prompt';

  // MULTIPLAYER: use MY_ABSOLUTE_SEAT so a guest at seat 1/2/3 acts on
  // their own seat. In solo mode MY_ABSOLUTE_SEAT defaults to 0.
  const localSeat = (typeof MY_ABSOLUTE_SEAT !== 'undefined') ? MY_ABSOLUTE_SEAT : 0;

  const btnSteal = makeBtn('Steal', 'btn-steal', () => {
    clearAllTimers(); clearStealable();
    performSteal(localSeat);
  });
  if (!canDoSteal) {
    btnSteal.disabled = true;
    btnSteal.title    = 'This card doesn\'t complete any phỏm in your hand';
  }

  const btnDraw = makeBtn('Draw', 'btn-draw', () => {
    clearAllTimers(); clearStealable();
    performDraw(localSeat);
  });

  const promptMsg = canDoSteal
    ? 'Steal the ' + disc.rank + disc.suit + ' or draw?'
    : disc.rank + disc.suit + ' doesn\'t help your hand — draw from the pile?';

  // S3: in slow-play mode, skip the timer bar + interval entirely.
  if (SLOW_PLAY) {
    renderActionBar([btnSteal, btnDraw]);
    setStatus(promptMsg);
    return;
  }

  // Normal mode — build the timer bar and run the 20s auto-draw countdown.
  const wrap  = document.createElement('div');
  wrap.className = 'steal-timer-wrap';
  const track = document.createElement('div');
  track.className = 'steal-timer-track';
  const fill  = document.createElement('div');
  fill.className = 'steal-timer-fill';
  const label = document.createElement('div');
  label.className = 'steal-timer-label';
  track.appendChild(fill);
  wrap.appendChild(track);
  wrap.appendChild(label);

  renderActionBar([wrap, btnSteal, btnDraw]);

  let timeLeft = 20;
  fill.style.width = '100%';
  label.textContent = timeLeft + 's';
  setTimeout(() => { fill.style.width = '0%'; }, 30); // trigger CSS transition

  setStatus(promptMsg, timeLeft + 's');

  timers.steal = setInterval(() => {
    timeLeft--;
    label.textContent = timeLeft + 's';
    setStatus(document.getElementById('status-msg').textContent, timeLeft + 's');
    if (timeLeft <= 0) {
      clearInterval(timers.steal); timers.steal = null;
      clearStealable();
      performDraw(localSeat); // auto-draw when timer expires
    }
  }, 1000);
}

/* A3-2/3: Hard-only opponent-hand inference. Returns a delta added to the
   `oppWeight` of `card` in aiBestDiscard, based on what the NEXT player's
   visible activity suggests about their hand.

   Positive delta = riskier to discard (likely useful to them).
   Negative delta = safer to discard (clearly not their target).

   Signals:
   • RISK: card sits 2 ranks from a same-suit endpoint of an opponent's
     laid-down thông. The 1-rank extension is already covered by canGui
     (in the existing oppWeight loop). The 2-rank-gap case is NOT covered
     by canGui because [R1-2, R1, R2, R3] isn't a valid phỏm shape — but
     opponent might hold the bridge card R1-1 and steal-then-form
     [R1-2, R1-1, R1] as a new thông. (Steal-pattern inference, part 2.)
   • SAFE: opponent dumped 2+ cards of this rank → unlikely to be collecting
     sám cô of this rank.
   • SAFE: opponent dumped 3+ cards in this suit → suit is "dead" for them;
     stealing one more of this suit gains them little. (Discard-pile
     inference, part 3.)

   Only called when difficulty === 'hard'. Medium / Easy ignore inference —
   that's how Hard AI feels meaningfully smarter than the others. */
function inferOppInterest(card, nextPlayerIdx) {
  const opp = state.players[nextPlayerIdx];
  let delta = 0;

  // RISK: bridge-extension of an existing thông (2-rank gap from endpoint)
  opp.laidDown.forEach(group => {
    if (group.length < 3) return;
    if (!group.every(c => c.suit === card.suit)) return; // thông must match suit
    const ranks  = group.map(c => RANK_VALUE[c.rank]).sort((a, b) => a - b);
    const lo     = ranks[0];
    const hi     = ranks[ranks.length - 1];
    const myRank = RANK_VALUE[card.rank];
    if (myRank === lo - 2 || myRank === hi + 2) delta += 1;
  });

  // SAFE: same-rank dumps in opponent's discard pile
  const sameRankDumps = opp.discardPile.filter(c => c.rank === card.rank).length;
  if (sameRankDumps >= 2) delta -= 1;

  // SAFE: same-suit dumps in opponent's discard pile (suit "dead")
  const sameSuitDumps = opp.discardPile.filter(c => c.suit === card.suit).length;
  if (sameSuitDumps >= 3) delta -= 1;

  return delta;
}

/* A3: Hard AI steal decision — should we actually accept this steal?
   The default flow always steals when canSteal returns true, but a stolen
   small-value phỏm forces a public lay-down (revealing structure to opponents)
   AND triggers the lap-balancing cost — both of which can outweigh the tiny
   rác gain from a phỏm like 234 or AAA.

   Rule:
   • Ù-completing steal → always (winning the round trumps everything).
   • 4-card phỏm → always (more cards locked, more rác saved, harder to revoke).
   • 3-card phỏm with rank-value sum ≥ 12 → always (e.g. 345, 456, JJJ, KKK).
   • Otherwise (e.g. 234 = 9, AAA = 3, 222 = 6, 333 = 9) → skip and draw instead.

   Medium and Easy always steal when canSteal allows — they don't run through
   this filter. That preserves the distinct feel of the three difficulties. */
function hardShouldSteal(card, hand) {
  // Ù-completing steal: the 10-card post-steal hand fully partitions into phỏm
  // and would Ù immediately via checkAndHandleU in performSteal.
  if (checkU([...hand, card])) return true;

  // Find every phỏm the stolen card could complete; AI would lay down the
  // biggest (most cards) one — sort that way and inspect [0].
  const options = findStealPhoms(card, hand);
  if (options.length === 0) return false; // defensive — canSteal should have guarded this
  options.sort((a, b) => b.length - a.length);
  const best = options[0];

  if (best.length === 4) return true; // 4-card lock-in always worth it

  // 3-card phỏm — apply the rank-value threshold.
  const valueSum = best.reduce((s, c) => s + RANK_VALUE[c.rank], 0);
  return valueSum >= 12;
}

/* Check if playerIdx has Ù (all cards form valid phỏm, zero rác left over).
   If so, announce it and start the Ù end sequence. Returns true to signal the
   caller to stop — no discard step should follow a Ù. Clears the action bar so
   no lingering button (gửi, Done, Steal, etc.) can be clicked during the
   ~700ms gap before declareU takes over. */
function checkAndHandleU(playerIdx) {
  if (!checkU(state.players[playerIdx].hand)) return false;
  setStatus(PLAYER_CFG[playerIdx].name + ' has Ù! 🎉');
  renderActionBar([]);
  renderAll();
  setTimeout(() => declareU(playerIdx, false), 700);
  return true;
}

/* The current player steals the last discarded card into their hand.
   Then runs the lap-balancing rule to keep all discard counts in sync. */
function performSteal(playerIdx) {
  const card    = state.lastDiscard;
  const prevIdx = (playerIdx - 1 + 4) % 4;

  // P3 animation — capture the source rect (the stolen card in the source
  // pile) BEFORE the state change removes it. The dest rect is captured
  // after renderAll() further down.
  const sourcePileEl  = document.getElementById('dp-' + prevIdx);
  const sourceCardEl  = sourcePileEl && sourcePileEl.lastElementChild;
  const stealSourceRect = sourceCardEl && sourceCardEl.classList.contains('card')
    ? sourceCardEl.getBoundingClientRect() : null;

  // Ăn Chốt detection: snapshot the victim's discardCount BEFORE we decrement it.
  // If they were already at 4 (the lap-close threshold), the card we're about to
  // steal IS their "final" (4th) discard — stealing it triggers Ăn Chốt for us
  // and "got chốt'd" for them. Captured here so the lap-balancing logic below
  // doesn't muddle the reading.
  const victimWasAtFinal = state.players[prevIdx].discardCount === DISCARD_PILE_LIMIT;

  // Step 1: physically remove the card from the stolen-from player's pile.
  // Use cardIndexInArray (VALUE equality on rank+suit) instead of indexOf
  // — multiplayer applyGameState re-instantiates card objects from
  // Firebase so reference equality between `card` (a previous state.lastDiscard)
  // and the cards in prevPile no longer holds. Without this, the card
  // stays in the pile AND lands in the stealer's hand → duplicate card.
  const prevPile = state.players[prevIdx].discardPile;
  const ci = cardIndexInArray(prevPile, card);
  if (ci !== -1) prevPile.splice(ci, 1);
  state.players[prevIdx].discardCount--;   // they lost one discard

  // Step 2: balancing — count players strictly between the current starter and the stealer.
  // Formula: N = (stealerIdx - starterIdx - 1 + 4) % 4
  // N = 0 → stealer is right after starter → no card movement needed
  // N > 0 → move the starter's most recent discard to the stolen-from player's pile,
  //          and shift the discard counts accordingly (stolen-from nets zero, starter absorbs -1)
  const N = (playerIdx - state.starterIdx - 1 + 4) % 4;
  if (N > 0) {
    const starterPile = state.players[state.starterIdx].discardPile;
    if (starterPile.length > 0) {
      // Move the starter's most recently discarded card to the stolen-from player's pile
      const moved = starterPile.splice(starterPile.length - 1, 1)[0];
      state.players[prevIdx].discardPile.push(moved);
    }
    state.players[state.starterIdx].discardCount--;  // starter absorbs the cost
    state.players[prevIdx].discardCount++;            // stolen-from player nets zero
  }

  // Step 3: starter role shifts one step clockwise after every steal
  state.starterIdx = (state.starterIdx + 1) % 4;

  // Step 4: give the stolen card to the stealer
  state.players[playerIdx].hand.push(card);
  state.lastDiscard           = null;
  state.stealHappenedThisTurn = true;

  // Step 5: Đền bookkeeping for an Ăn Chốt steal (4th-discard steal).
  // - state.denLiable tracks the MOST RECENT ăn chốt-er and the player they
  //   stole from. The chain transfer rule is handled by simply overwriting:
  //   if a later steal is also an ăn chốt, the new stealer becomes liable and
  //   the previous one is automatically off the hook.
  // - state.pendingTrigger3 is set UNCONDITIONALLY whenever ăn chốt happens
  //   and is scoped to the stealer's CURRENT TURN. The marker is cleared in
  //   startTurn when the next player's turn begins, so the T3 window is
  //   "this turn only". If the stealer Ù's at any point during this turn —
  //   the typical flow is steal → lay-down stolen phỏm → discard → Ù — T3
  //   fires. (Earlier the marker required Ù to fire instantly from the
  //   10-card hand, which almost never happens in practice since Ù requires
  //   a discard.)
  if (victimWasAtFinal) {
    state.denLiable       = { stealerIdx: playerIdx, victimIdx: prevIdx };
    state.pendingTrigger3 = { winnerIdx: playerIdx, victimIdx: prevIdx };
    // Visual: small yellow pill next to the stealer's zone for ~1.5s
    showAnChotToast(playerIdx);
  }

  // Step 6: T2 streak — increment the victim's "stolen by immediate-next-player"
  // counter ONLY when this stealer IS the victim's immediate-next-player
  // (which is the current code's only-stealable-by-next-player flow today, but
  // future code might allow further-down-the-rotation steals so the guard is
  // important). When it hits 3, T2 is MARKED PENDING — we let the stealer
  // complete their normal post-steal turn (lay-down stolen phỏm + discard
  // their last rác) before firing T2. performDiscard picks up the pending
  // marker and triggers declareTriggerTwo after the discard lands. This way
  // the player-facing sequence is: triple steal → lay-down → discard → Ù
  // reveal → Đền reveal.
  if (playerIdx === (prevIdx + 1) % 4) {
    state.players[prevIdx].stolenStreak++;
    if (state.players[prevIdx].stolenStreak >= 3) {
      state.pendingT2 = { stealerIdx: playerIdx, victimIdx: prevIdx };
    }
  }

  const anChotTag = victimWasAtFinal ? '  ⚡ Ăn Chốt!' : '';
  const tripleTag = state.pendingT2 && state.pendingT2.stealerIdx === playerIdx
                  ? '  ⚡ Triple Steal — Đền T2 pending!' : '';
  setStatus(PLAYER_CFG[playerIdx].name + ' steals ' + card.rank + card.suit + '!' +
            anChotTag + tripleTag);
  state.phase = 'playing';
  renderAll();
  // Multiplayer: publish so spectators see the steal land in real time.
  if (typeof publishGameStateAsync === 'function') publishGameStateAsync();

  // P4: rising-sweep "swipe" sound for the steal
  soundSteal();

  // P3 + P5 steal animation with face-up reveal. The stolen card flies
  // from the source pile up to center-screen (scaling to full size),
  // pauses ~600ms so the human can clearly see what was stolen, then
  // continues to the stealer's hand position. Destination card is hidden
  // during the entire flight and revealed on landing — for AI hands that
  // produces a visible "flip" from face-up reveal to face-down hand card.
  if (stealSourceRect) {
    const handEl  = document.getElementById('hand-' + playerIdx);
    const cardEls = handEl ? handEl.querySelectorAll('.card') : [];
    const destCardEl = cardEls[cardEls.length - 1];
    if (destCardEl) {
      const destRect = destCardEl.getBoundingClientRect();
      destCardEl.style.opacity = '0';
      animateStealReveal(card, stealSourceRect, destRect)
        .then(() => { destCardEl.style.opacity = ''; });
    }
  }

  // Natural-Ù check happens here only if T2 isn't pending. If T2 is pending,
  // it takes precedence — the round will end via declareTriggerTwo after the
  // stealer's normal post-steal discard.
  if (!state.pendingT2 || state.pendingT2.stealerIdx !== playerIdx) {
    if (checkAndHandleU(playerIdx)) return; // Ù — round ends, no discard needed
  }

  // B2: mandatory lay-down of the phỏm completed by the stolen card.
  // Wait long enough for the P3+P5 reveal animation to play out (~1330ms
  // total: 350ms source→center + 600ms pause + 380ms center→dest) so the
  // lay-down UI doesn't appear over the steal reveal. When no animation
  // ran (no source rect captured), use the original short pause instead.
  const layDownDelay = stealSourceRect ? 1400 : 500;
  setTimeout(() => {
    layDownStolenPhom(playerIdx, card, () => {
      if (PLAYER_CFG[playerIdx].isHuman) {
        showDiscardUI();
      } else {
        setTimeout(() => aiDiscard(playerIdx), 600);
      }
    });
  }, layDownDelay);
}

/* The current player draws the top card from the draw pile */
function performDraw(playerIdx) {
  if (state.drawPile.length > 0) {
    const card = state.drawPile.pop();
    state.players[playerIdx].hand.push(card);
    if (PLAYER_CFG[playerIdx].isHuman) {
      setStatus('You drew ' + card.rank + card.suit + ' — pick a card to discard.');
    }
  } else {
    setStatus(PLAYER_CFG[playerIdx].name + ' — draw pile empty.');
  }
  state.phase = 'playing';
  renderAll();
  // Multiplayer: publish so spectators see the draw pile shrink and
  // the drawer's hand grow (face-down to them).
  if (typeof publishGameStateAsync === 'function') publishGameStateAsync();

  if (checkAndHandleU(playerIdx)) return; // Ù — round ends, no discard needed

  if (PLAYER_CFG[playerIdx].isHuman) {
    showDiscardUI();
  } else {
    setTimeout(() => aiDiscard(playerIdx), 550);
  }
}

// ── Discard ───────────────────────────────────────────────────────

/* Switch to discard phase: human's hand becomes click-to-discard.
   A 60-second timer auto-discards on expiry. S3: in slow-play mode the timer
   is skipped and the prompt simply waits for a drag-to-discard. */
function showDiscardUI() {
  state.phase = 'discard-prompt';
  renderActionBar([]);
  renderHumanHand(true); // cards become clickable; each click calls performDiscard directly

  if (SLOW_PLAY) {
    setStatus('Drag a card to the center to discard it.');
    return;
  }

  let timeLeft = 60;
  setStatus('Drag a card to the center to discard it.', timeLeft + 's');

  timers.discard = setInterval(() => {
    timeLeft--;
    setStatus('Drag a card to the center to discard it.', timeLeft + 's');
    if (timeLeft <= 0) {
      clearInterval(timers.discard); timers.discard = null;
      const seat = (typeof MY_ABSOLUTE_SEAT !== 'undefined') ? MY_ABSOLUTE_SEAT : 0;
      performDiscard(seat, aiBestDiscard(state.players[seat].hand, 'easy', seat));
    }
  }, 1000);
}

/* Perform the discard for any player: update piles and discard count,
   set lastDiscard, then hand off to afterDiscard() for lay-down check. */
function performDiscard(playerIdx, card) {
  clearAllTimers();
  renderActionBar([]);
  state.phase = 'playing';

  // P2 animation — capture the source rect (card in hand) BEFORE the state
  // change removes it. The dest rect is captured after renderAll() below.
  const sourceRect = getCardRectInHand(playerIdx, card);

  const player = state.players[playerIdx];

  // Remove the card from the player's hand — VALUE equality (multiplayer
  // applyGameState swaps card references, so indexOf-by-reference can fail
  // to find the card and leave a duplicate in the hand).
  const idx = cardIndexInArray(player.hand, card);
  // Grab the actual hand-resident object (not the parameter, which may be
  // a stale pre-update reference) so the discard pile holds the same
  // {rank, suit} the hand just released.
  const actualCard = idx !== -1 ? player.hand[idx] : card;
  if (idx !== -1) player.hand.splice(idx, 1);

  // Put it in their personal discard pile and increment the true discard count
  player.discardPile.push(actualCard);
  player.discardCount++;

  // This card is now available for the next player to steal
  state.lastDiscard         = card;
  state.selectedDiscardCard = null;

  setStatus(PLAYER_CFG[playerIdx].name + ' discards ' + card.rank + card.suit + '.');
  renderAll();

  // P4: two-tone "drop" sound for the discard
  soundDiscard();

  // P2 animation — fly the card from the hand position to its new spot in
  // the discard pile. The destination card was just added to dp-N as the
  // last child; hide it during flight then reveal on completion.
  if (sourceRect) {
    const destPileEl = document.getElementById('dp-' + playerIdx);
    const destCardEl = destPileEl && destPileEl.lastElementChild;
    if (destCardEl && destCardEl.classList.contains('card')) {
      const destRect = destCardEl.getBoundingClientRect();
      destCardEl.style.opacity = '0';
      animateCardFly(card, sourceRect, destRect, {
        cardOpts: { xs: true },
        duration: 320,
      }).then(() => { destCardEl.style.opacity = ''; });
    }
  }

  // T2 takes priority over natural Ù — if the 3-streak condition was triggered
  // earlier in this stealer's turn, fire T2 now (after they've completed the
  // normal steal → lay-down → discard sequence). The "considered Ù" + Đền
  // reveal happens inside declareTriggerTwo. T3 marker is also cleared
  // since T2 supersedes any pending T3.
  if (state.pendingT2 && state.pendingT2.stealerIdx === playerIdx) {
    const { stealerIdx, victimIdx } = state.pendingT2;
    state.pendingT2       = null;
    state.pendingTrigger3 = null;
    setTimeout(() => declareTriggerTwo(stealerIdx, victimIdx), 700);
    return;
  }

  // B7: if this discard was the last rác, the remaining hand is pure phỏm — Ù.
  if (checkAndHandleU(playerIdx)) return;

  // Multiplayer: publish the discard so spectators see it animate.
  // The actual turn-advance publish happens later inside advanceTurn.
  if (typeof publishGameStateAsync === 'function') publishGameStateAsync();

  // afterDiscard() checks for round-end cascade and optional lay-down
  setTimeout(() => afterDiscard(playerIdx), 420);
}

// ── Advance Turn ──────────────────────────────────────────────────

/* Move clockwise to the next player and start their turn */
function advanceTurn() {
  state.currentTurn = (state.currentTurn + 1) % 4;
  // Multiplayer: publish the turn change, then the state listener on
  // every browser fires driveTurn which calls startTurn on the right
  // one. Skip the local startTurn here — the listener will trigger it.
  if (typeof IS_MULTIPLAYER_GAME !== 'undefined' && IS_MULTIPLAYER_GAME) {
    if (typeof publishGameStateAsync === 'function') publishGameStateAsync();
    return;
  }
  startTurn();
}

// ── AI Logic ─────────────────────────────────────────────────────

/* AI turn: steal if it completes a phỏm, otherwise draw.
   Special case: the very first turn of the round when the AI is the dealer —
   `lastDiscard` is still null, they already have 10 cards from the deal, and
   they should just discard (no draw).

   A3: Hard AI runs the steal through hardShouldSteal — a low-value 3-card
   phỏm may be skipped in favor of a fresh deck draw. Medium and Easy always
   accept any valid steal (unchanged). */
function runAiTurn() {
  // Belt-and-suspenders gate for tutorial practice mode. startTurn
  // already prevents AI runAiTurn from being scheduled, but if any
  // path manages to reach here during practice, bail out.
  if (typeof TUTORIAL_PRACTICE_ACTIVE !== 'undefined' && TUTORIAL_PRACTICE_ACTIVE) {
    return;
  }
  const playerIdx = state.currentTurn;
  const player    = state.players[playerIdx];
  const cfg       = PLAYER_CFG[playerIdx];
  const disc      = state.lastDiscard;

  if (!disc) {
    aiDiscard(playerIdx);
    return;
  }

  if (canSteal(disc, player.hand)) {
    if (cfg.difficulty === 'hard' && !hardShouldSteal(disc, player.hand)) {
      performDraw(playerIdx);
    } else {
      performSteal(playerIdx);
    }
  } else {
    performDraw(playerIdx);
  }
}

/* After AI draws/steals, pick the best card to discard */
function aiDiscard(playerIdx) {
  const card = aiBestDiscard(state.players[playerIdx].hand, PLAYER_CFG[playerIdx].difficulty, playerIdx);
  performDiscard(playerIdx, card);
}

/* Pick a card to discard. Three difficulty-specific behaviors layer on top
   of the shared scoring: (1) whether opponent-feed avoidance is considered
   (Medium + Hard); (2) whether opponent-hand inference is considered
   (Hard only — A3-2/3); (3) the probability of picking the top-scored card
   vs. making a "mistake" (a random non-optimal pick).

   Scoring components per card in hand (A2: per-card WEIGHTS rather than
   binary flags — a card that participates in multiple potential phỏm is
   worth proportionally more than one that participates in just one):

   ownWeight — number of "phỏm-forming partnerships" this card has, where a
     partnership is any other hand card that matches one of these patterns
     (recognized by ALL difficulties):
       • same rank (potential sám cô)
       • same suit, adjacent rank (potential thông)
       • same suit, 2-rank gap (potential thông via the missing middle card)
     PLUS: +1 for each of the AI's OWN laid-down phỏm that this card could
     extend via gửi at round end.
     Example: a 5♠ paired with 5♥, 5♦, 4♠, AND 6♠ has ownWeight = 4 — losing
     it would collapse multiple potential phỏm at once.

   oppWeight — number of OPPONENT laid-down phỏm this card could extend via
     gửi (Medium + Hard only — Easy skips this and plays purely self-focused).
     A card that could feed three opponent groups is much riskier to discard
     than one that could only feed one.

   keepScore = ownWeight * 2 + oppWeight * 1. Higher = keep, lower = safer to
   discard. Own contributions count double because they directly build YOUR
   score, while opp-feed only avoids giving away rác. Tiebreak: higher value
   goes first (dump high-rác cards ahead of low-rác).

   Mistake model — probability of picking the top-scored card:
     hard   : 90% optimal, 10% random non-optimal
     medium : 75% optimal, 25% random non-optimal
     easy   : 40% optimal, 60% random non-optimal (own-only scoring) */
function aiBestDiscard(hand, difficulty, playerIdx) {
  // ─── Step 1: ownWeight per card — count phỏm-forming partnerships ──
  // Each matching pair contributes +1 to BOTH cards' weights, so a hand-card
  // that's central to many potential phỏm naturally accumulates a higher
  // weight than one with a single pairing.
  const ownWeight = new Array(hand.length).fill(0);
  for (let i = 0; i < hand.length; i++) {
    for (let j = i + 1; j < hand.length; j++) {
      const a   = hand[i], b = hand[j];
      const dRk = Math.abs(RANK_VALUE[a.rank] - RANK_VALUE[b.rank]);
      const sameRank = a.rank === b.rank;
      const sameSuitNear = a.suit === b.suit && (dRk === 1 || dRk === 2);
      if (sameRank || sameSuitNear) { ownWeight[i]++; ownWeight[j]++; }
    }
  }
  // Own laid-down extensions — +1 per OWN group this card could gửi to.
  if (playerIdx !== undefined && state.players[playerIdx]) {
    state.players[playerIdx].laidDown.forEach(group => {
      hand.forEach((card, i) => { if (canGui(card, group)) ownWeight[i]++; });
    });
  }

  // ─── Step 2: oppWeight per card (skipped for Easy) ───────────────
  // +1 per OPPONENT group this card could extend via gửi. A card that could
  // feed multiple opponent phỏm is proportionally riskier to discard.
  const oppWeight = new Array(hand.length).fill(0);
  if (difficulty !== 'easy' && playerIdx !== undefined) {
    state.players.forEach((p, pIdx) => {
      if (pIdx === playerIdx) return; // skip self — that's ownWeight's job
      p.laidDown.forEach(group => {
        hand.forEach((card, i) => { if (canGui(card, group)) oppWeight[i]++; });
      });
    });
  }

  // ─── Step 2b: A3-2/3 inference layer — Hard only ─────────────────
  // Look at the NEXT player's laid-down phỏm and discard pile to detect
  // steal-pattern signals (cards they're likely collecting) and dump
  // signals (cards they've clearly abandoned). Adjust oppWeight up or down
  // per card. The deltas are small (+1 risk, −1 safety each) so the
  // existing canGui-based scoring still dominates; this is a refinement.
  if (difficulty === 'hard' && playerIdx !== undefined) {
    const nextPlayerIdx = (playerIdx + 1) % 4;
    hand.forEach((card, i) => {
      oppWeight[i] += inferOppInterest(card, nextPlayerIdx);
    });
  }

  // ─── Step 3: score + sort ─────────────────────────────────────────
  // Own counts double — building our own phỏm is worth more than just
  // blocking an opponent's gửi. The 2:1 ratio matches the previous binary
  // weights (ownUseful=2 vs oppFeed=1) so difficulty tuning still holds.
  const scored = hand.map((card, i) => ({
    card, i,
    value:     RANK_VALUE[card.rank],
    keepScore: ownWeight[i] * 2 + oppWeight[i],
  }));
  scored.sort((a, b) => {
    if (a.keepScore !== b.keepScore) return a.keepScore - b.keepScore; // safer first
    return b.value - a.value;                                          // dump high-rác first
  });

  // ─── Step 4: probabilistic pick ──────────────────────────────────
  const pOptimal = { hard: 0.9, medium: 0.75, easy: 0.4 }[difficulty] || 0.9;
  if (scored.length === 1 || Math.random() < pOptimal) {
    return scored[0].card; // optimal pick
  }
  const rest = scored.slice(1);
  return rest[Math.floor(Math.random() * rest.length)].card; // random non-optimal mistake
}

// ── Extra Turns (B5) ──────────────────────────────────────────────

/* A laid-down player still participates in the rotation but takes restricted
   extra turns. Order per rules.md: optional steal → forced rác discard if
   discardCount<4 → gửi → otherwise pass. Routes by player type. */
function startExtraTurn() {
  const cfg = PLAYER_CFG[state.currentTurn];
  if (cfg.isHuman) {
    startHumanExtraTurn();
  } else {
    setStatus(cfg.name + ' (extra turn)…');
    setTimeout(() => runAiExtraTurn(), 700);
  }
}

/* AI extra turn: walk the sequence and act on the first applicable step.
   Each branch routes through performSteal / performDraw / performDiscard,
   which all chain into afterDiscard → handleGuiStep → round-end check or advance. */
function runAiExtraTurn() {
  // Same tutorial-practice freeze as runAiTurn — no AI extra-turn
  // activity while the practice round is wrapping up.
  if (typeof TUTORIAL_PRACTICE_ACTIVE !== 'undefined' && TUTORIAL_PRACTICE_ACTIVE) {
    return;
  }
  const playerIdx = state.currentTurn;
  const player    = state.players[playerIdx];
  const cfg       = PLAYER_CFG[playerIdx];
  const disc      = state.lastDiscard;

  // Step 1: optional steal (rare since hand is revealed rác)
  if (disc && canSteal(disc, player.hand)) {
    performSteal(playerIdx);
    return;
  }

  // Step 2: if count<4, draw + discard. performDraw chains into aiDiscard.
  // Pile-empty edge case falls back to forced rác discard from the revealed hand.
  if (player.discardCount < DISCARD_PILE_LIMIT) {
    if (state.drawPile.length > 0) {
      performDraw(playerIdx);
      return;
    }
    if (player.hand.length > 0) {
      const card = aiBestDiscard(player.hand, cfg.difficulty, playerIdx);
      performDiscard(playerIdx, card);
      return;
    }
  }

  // Step 3: no discard needed — run the gửi step then advance/end
  handleGuiStep(playerIdx, () => {
    if (allPlayersDone()) endRound();
    else advanceTurn();
  });
}

/* Human extra turn UI. Shows a Steal button if applicable, plus one of:
   (a) Draw button (when discardCount<4 and pile has cards) → performDraw chains
       into the standard discard UI,
   (b) clickable hand for forced rác discard (pile-empty edge case),
   (c) Continue button (steal or gửi available, no forced action), or
   (d) Pass button (nothing actionable). */
function startHumanExtraTurn() {
  // MULTIPLAYER: use MY_ABSOLUTE_SEAT so a guest's extra turn references
  // their own seat. In solo, MY_ABSOLUTE_SEAT defaults to 0.
  const seat = (typeof MY_ABSOLUTE_SEAT !== 'undefined') ? MY_ABSOLUTE_SEAT : 0;
  const player     = state.players[seat];
  const disc       = state.lastDiscard;
  const canDoSteal = disc && canSteal(disc, player.hand);
  const countShort = player.discardCount < DISCARD_PILE_LIMIT;
  const canDraw    = countShort && state.drawPile.length > 0;
  const canRacFallback = countShort && state.drawPile.length === 0 && player.hand.length > 0;
  const guiOptions = findGuiOptions(seat);

  const items = [];

  if (canDoSteal) {
    items.push(makeBtn('Steal ' + disc.rank + disc.suit, 'btn-steal', () => {
      clearStealable();
      performSteal(seat);
    }));
    highlightStealable((state.currentTurn - 1 + 4) % 4);
  }

  if (canDraw) {
    items.push(makeBtn('Draw', 'btn-draw', () => {
      clearStealable();
      performDraw(seat);
    }));
    setStatus('Extra turn — ' + (canDoSteal ? 'steal or draw + discard' : 'must draw and discard'));
  } else if (canRacFallback) {
    state.phase = 'discard-prompt';
    setStatus('Extra turn — pile empty, click a rác in your hand to discard');
    renderHumanHand(true);
  } else if (canDoSteal || guiOptions.length > 0) {
    setStatus(canDoSteal
              ? 'Extra turn — steal, or skip to gửi'
              : 'Extra turn — gửi opportunity available');
    items.push(makeBtn(canDoSteal ? 'Skip steal' : 'Continue', 'btn-draw', () => {
      clearStealable();
      handleGuiStep(seat, finishHumanExtraTurn);
    }));
  } else {
    setStatus('Extra turn — nothing to do, pass?');
    items.push(makeBtn('Pass', 'btn-draw', finishHumanExtraTurn));
  }

  renderActionBar(items);
}

/* Called when the human is finished with their extra turn — either via the
   Pass/Continue button or after gửi completes. */
function finishHumanExtraTurn() {
  if (allPlayersDone()) endRound();
  else advanceTurn();
}
