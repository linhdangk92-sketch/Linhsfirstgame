// ═══════════════════════════════════════════════════════════════════
// MAIN — deal a round and kick off the game
// ═══════════════════════════════════════════════════════════════════

/* Reset and deal a fresh round.
   Round 1: human (player 0) is always dealer.
   Round 2+: the winner of the previous round deals.
   The dealer receives 10 cards and plays first; everyone else gets 9. */
function dealRound() {
  // Pick new AI names and update avatars at the start of each game
  if (state.roundNumber === 1) {
    PLAYER_CFG = buildPlayerCfg();
    [0, 1, 2, 3].forEach(i => {
      const nameEl   = document.getElementById('pname-'  + i);
      const avatarEl = document.getElementById('avatar-' + i);
      if (nameEl)   nameEl.textContent   = PLAYER_CFG[i].name;
      if (avatarEl) avatarEl.textContent = AVATAR_MAP[PLAYER_CFG[i].name] || '🃏';
    });
  }

  const deck = shuffle(buildDeck());
  // P4: shuffle sound effect (three soft hisses)
  soundShuffle();

  state.players.forEach(p => {
    p.hand         = [];
    p.laidDown     = [];
    p.hasLaidDown  = false;
    p.discardPile  = [];
    p.discardCount  = 0;
    p.roundScore   = 0;
    p.isMom        = true;
    p.stolenStreak = 0;
    p.firstTurn    = true;
    p.lapClosedAt  = 0;
  });

  // Đền state resets — most-recent Ăn Chốt event + any pending T3/T2 markers
  state.denLiable        = null;
  state.pendingTrigger3  = null;
  state.pendingT2        = null;
  state.lapCloseCounter  = 0;

  // Dealer = winner of previous round; P0 for round 1.
  const dealerIdx = state.roundNumber === 1 ? 0 : state.lastWinnerIdx;

  state.lastDiscard           = null;
  state.phase                 = 'playing';
  state.currentTurn           = dealerIdx;
  state.stealHappenedThisTurn = false;
  state.selectedDiscardCard   = null;
  state.starterIdx            = dealerIdx;  // dealer is the lap-1 starter
  state.isLastLap             = false;      // set true in B4 when the first player hits discardCount=4

  // Dealer gets 10 cards; everyone else gets 9
  for (let i = 0; i < 10; i++) state.players[dealerIdx].hand.push(deck.pop());
  for (let p = 0; p < 4; p++) {
    if (p === dealerIdx) continue;
    for (let i = 0; i < 9; i++) state.players[p].hand.push(deck.pop());
  }

  state.drawPile = deck;

  renderAll();
  const dealerLabel = dealerIdx === 0
    ? 'You are the dealer — pick a card to discard.'
    : PLAYER_CFG[dealerIdx].name + ' is the dealer — they discard first.';
  setStatus('Round ' + state.roundNumber + ' · Dealing…');

  /* P1 deal animation — fly each card from the draw stack to its resting
     slot. Defer startTurn until the last card has landed; otherwise the
     first turn could begin mid-deal and feel chaotic. Ù Khan check still
     happens per-player at the start of THEIR first turn (in startTurn). */
  animateDeal(dealerIdx).then(() => {
    setStatus('Round ' + state.roundNumber + ' · ' + dealerLabel);
    setTimeout(() => startTurn(), 400);
  });
}

// ── Start ─────────────────────────────────────────────────────────
dealRound();
