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

  state.players.forEach(p => {
    p.hand         = [];
    p.laidDown     = [];
    p.hasLaidDown  = false;
    p.discardPile  = [];
    p.discardCount  = 0;
    p.roundScore   = 0;
    p.isMom        = true;
    p.ateChot      = false;
    p.gotChot      = false;
    p.denOrder     = 0;
    p.stolenStreak = 0;
  });

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
  setStatus('Round ' + state.roundNumber + ' · ' + dealerLabel);

  // Check every player for Ù Khan right after the deal — before any turns.
  // Ù Khan: a hand with zero pairs and zero near-sequences (completely hopeless).
  // The first player found with Ù Khan declares immediately and wins the round.
  const uKhanIdx = [0, 1, 2, 3].find(i => isUKhan(state.players[i].hand));
  if (uKhanIdx !== undefined) {
    setStatus(PLAYER_CFG[uKhanIdx].name + ' has Ù Khan! Round over before it starts!');
    setTimeout(() => declareU(uKhanIdx, true), 900);
  } else {
    setTimeout(() => startTurn(), 400);
  }
}

// ── Start ─────────────────────────────────────────────────────────
dealRound();
