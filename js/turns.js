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
  const canDoSteal = canSteal(disc, state.players[0].hand);
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

/* Show Steal and Draw buttons with a 5-second countdown.
   The Steal button is disabled when the card doesn't complete any phỏm. */
function showStealDrawUI(canDoSteal, disc) {
  state.phase = 'steal-prompt';

  // Build timer bar UI
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

  const btnSteal = makeBtn('Steal', 'btn-steal', () => {
    clearAllTimers(); clearStealable();
    performSteal(0);
  });
  if (!canDoSteal) {
    btnSteal.disabled = true;
    btnSteal.title    = 'This card doesn\'t complete any phỏm in your hand';
  }

  const btnDraw = makeBtn('Draw', 'btn-draw', () => {
    clearAllTimers(); clearStealable();
    performDraw(0);
  });

  renderActionBar([wrap, btnSteal, btnDraw]);

  // Start 20-second countdown; auto-draw on expiry
  let timeLeft = 20;
  fill.style.width = '100%';
  label.textContent = timeLeft + 's';
  setTimeout(() => { fill.style.width = '0%'; }, 30); // trigger CSS transition

  setStatus(
    canDoSteal
      ? 'Steal the ' + disc.rank + disc.suit + ' or draw?'
      : disc.rank + disc.suit + ' doesn\'t help your hand — draw from the pile?',
    timeLeft + 's'
  );

  timers.steal = setInterval(() => {
    timeLeft--;
    label.textContent = timeLeft + 's';
    setStatus(document.getElementById('status-msg').textContent, timeLeft + 's');
    if (timeLeft <= 0) {
      clearInterval(timers.steal); timers.steal = null;
      clearStealable();
      performDraw(0); // auto-draw when timer expires
    }
  }, 1000);
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

  // Ăn Chốt detection: snapshot the victim's discardCount BEFORE we decrement it.
  // If they were already at 4 (the lap-close threshold), the card we're about to
  // steal IS their "final" (4th) discard — stealing it triggers Ăn Chốt for us
  // and "got chốt'd" for them. Captured here so the lap-balancing logic below
  // doesn't muddle the reading.
  const victimWasAtFinal = state.players[prevIdx].discardCount === DISCARD_PILE_LIMIT;

  // Step 1: physically remove the card from the stolen-from player's pile
  const prevPile = state.players[prevIdx].discardPile;
  const ci = prevPile.indexOf(card);
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
  // important). When it hits 3, T2 fires and the round ends instantly.
  if (playerIdx === (prevIdx + 1) % 4) {
    state.players[prevIdx].stolenStreak++;
    if (state.players[prevIdx].stolenStreak >= 3) {
      const stealerName = PLAYER_CFG[playerIdx].name;
      const victimName  = PLAYER_CFG[prevIdx].name;
      setStatus(stealerName + ' steals ' + card.rank + card.suit +
                ' — ⚡ Đền T2! 3 from ' + victimName + ' — round ends!');
      state.phase = 'playing';
      renderAll();
      setTimeout(() => declareTriggerTwo(playerIdx, prevIdx), 700);
      return;
    }
  }

  const anChotTag = victimWasAtFinal ? '  ⚡ Ăn Chốt!' : '';
  setStatus(PLAYER_CFG[playerIdx].name + ' steals ' + card.rank + card.suit + '!' + anChotTag);
  state.phase = 'playing';
  renderAll();

  if (checkAndHandleU(playerIdx)) return; // Ù — round ends, no discard needed

  // B2: mandatory lay-down of the phỏm completed by the stolen card.
  // Small delay so the "steals X" status message has time to register.
  setTimeout(() => {
    layDownStolenPhom(playerIdx, card, () => {
      if (PLAYER_CFG[playerIdx].isHuman) {
        showDiscardUI();
      } else {
        setTimeout(() => aiDiscard(playerIdx), 600);
      }
    });
  }, 500);
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

  if (checkAndHandleU(playerIdx)) return; // Ù — round ends, no discard needed

  if (PLAYER_CFG[playerIdx].isHuman) {
    showDiscardUI();
  } else {
    setTimeout(() => aiDiscard(playerIdx), 550);
  }
}

// ── Discard ───────────────────────────────────────────────────────

/* Switch to discard phase: human's hand becomes click-to-discard.
   A 60-second timer auto-discards on expiry. */
function showDiscardUI() {
  state.phase = 'discard-prompt';
  renderActionBar([]);
  renderHumanHand(true); // cards become clickable; each click calls performDiscard directly

  let timeLeft = 60;
  setStatus('Drag a card to the center to discard it.', timeLeft + 's');

  timers.discard = setInterval(() => {
    timeLeft--;
    setStatus('Drag a card to the center to discard it.', timeLeft + 's');
    if (timeLeft <= 0) {
      clearInterval(timers.discard); timers.discard = null;
      performDiscard(0, aiBestDiscard(state.players[0].hand, 'easy'));
    }
  }, 1000);
}

/* Perform the discard for any player: update piles and discard count,
   set lastDiscard, then hand off to afterDiscard() for lay-down check. */
function performDiscard(playerIdx, card) {
  clearAllTimers();
  renderActionBar([]);
  state.phase = 'playing';

  const player = state.players[playerIdx];

  // Remove the card from the player's hand
  const idx = player.hand.indexOf(card);
  if (idx !== -1) player.hand.splice(idx, 1);

  // Put it in their personal discard pile and increment the true discard count
  player.discardPile.push(card);
  player.discardCount++;

  // This card is now available for the next player to steal
  state.lastDiscard         = card;
  state.selectedDiscardCard = null;

  setStatus(PLAYER_CFG[playerIdx].name + ' discards ' + card.rank + card.suit + '.');
  renderAll();

  // B7: if this discard was the last rác, the remaining hand is pure phỏm — Ù.
  if (checkAndHandleU(playerIdx)) return;

  // afterDiscard() checks for round-end cascade and optional lay-down
  setTimeout(() => afterDiscard(playerIdx), 420);
}

// ── Advance Turn ──────────────────────────────────────────────────

/* Move clockwise to the next player and start their turn */
function advanceTurn() {
  state.currentTurn = (state.currentTurn + 1) % 4;
  startTurn();
}

// ── AI Logic ─────────────────────────────────────────────────────

/* AI turn: steal if it completes a phỏm, otherwise draw.
   Special case: the very first turn of the round when the AI is the dealer —
   `lastDiscard` is still null, they already have 10 cards from the deal, and
   they should just discard (no draw). */
function runAiTurn() {
  const playerIdx = state.currentTurn;
  const player    = state.players[playerIdx];
  const disc      = state.lastDiscard;

  if (!disc) {
    aiDiscard(playerIdx);
    return;
  }

  if (canSteal(disc, player.hand)) {
    performSteal(playerIdx);
  } else {
    performDraw(playerIdx);
  }
}

/* After AI draws/steals, pick the best card to discard */
function aiDiscard(playerIdx) {
  const card = aiBestDiscard(state.players[playerIdx].hand, PLAYER_CFG[playerIdx].difficulty);
  performDiscard(playerIdx, card);
}

/* Heuristic: discard the highest-value card that is NOT part of a pair
   or a 2-card near-sequence (same suit, adjacent rank).
   Full strategic AI comes in Phase 6. */
function aiBestDiscard(hand, difficulty) {
  const useful = new Set();

  for (let i = 0; i < hand.length; i++) {
    for (let j = i + 1; j < hand.length; j++) {
      const a = hand[i], b = hand[j];
      // Same rank → potential sám cô
      if (a.rank === b.rank) { useful.add(i); useful.add(j); }
      // Adjacent rank, same suit → potential thông
      if (a.suit === b.suit && Math.abs(RANK_ORDER[a.rank] - RANK_ORDER[b.rank]) === 1) {
        useful.add(i); useful.add(j);
      }
    }
  }

  // Discard the highest-value non-useful card
  const racs = hand
    .map((card, i) => ({ card, i, val: RANK_VALUE[card.rank] }))
    .filter(({ i }) => !useful.has(i))
    .sort((a, b) => b.val - a.val);

  if (racs.length > 0) return racs[0].card;

  // Fallback: all cards are in pairs/sequences — discard highest value overall
  return hand.slice().sort((a, b) => RANK_VALUE[b.rank] - RANK_VALUE[a.rank])[0];
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
      const card = aiBestDiscard(player.hand, cfg.difficulty);
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
  const player     = state.players[0];
  const disc       = state.lastDiscard;
  const canDoSteal = disc && canSteal(disc, player.hand);
  const countShort = player.discardCount < DISCARD_PILE_LIMIT;
  const canDraw    = countShort && state.drawPile.length > 0;
  const canRacFallback = countShort && state.drawPile.length === 0 && player.hand.length > 0;
  const guiOptions = findGuiOptions(0);

  const items = [];

  if (canDoSteal) {
    items.push(makeBtn('Steal ' + disc.rank + disc.suit, 'btn-steal', () => {
      clearStealable();
      performSteal(0);
    }));
    highlightStealable((state.currentTurn - 1 + 4) % 4);
  }

  if (canDraw) {
    items.push(makeBtn('Draw', 'btn-draw', () => {
      clearStealable();
      performDraw(0);
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
      handleGuiStep(0, finishHumanExtraTurn);
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
