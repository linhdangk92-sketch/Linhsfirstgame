// ═══════════════════════════════════════════════════════════════════
// MAIN — deal a round and kick off the game
// ═══════════════════════════════════════════════════════════════════

/* Reset and deal a fresh round.
   Round 1: human (player 0) is always dealer.
   Round 2+: the winner of the previous round deals.
   The dealer receives 10 cards and plays first; everyone else gets 9. */
function dealRound(dealerOverride = null) {
  // Pick new AI names and update avatars at the start of each game.
  // S2: preserve any custom human name across "Play Again" by re-applying it
  // after buildPlayerCfg (which always resets the human slot to 'You').
  if (state.roundNumber === 1) {
    const previousHumanName = PLAYER_CFG[0] && PLAYER_CFG[0].name;
    PLAYER_CFG = buildPlayerCfg();
    if (previousHumanName && previousHumanName !== 'You') {
      PLAYER_CFG[0].name = previousHumanName;
    }
    [0, 1, 2, 3].forEach(i => {
      const nameEl   = document.getElementById('pname-'  + i);
      const avatarEl = document.getElementById('avatar-' + i);
      if (nameEl)   nameEl.textContent   = PLAYER_CFG[i].name;
      // The human always wears the 🎮 emoji regardless of custom name —
      // AVATAR_MAP only has entries for 'You' + AI names from the pool.
      if (avatarEl) {
        avatarEl.textContent = PLAYER_CFG[i].isHuman
          ? '🎮'
          : (AVATAR_MAP[PLAYER_CFG[i].name] || '🃏');
      }
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

  // Dealer = winner of previous round; P0 for round 1. The tutorial
  // practice round overrides this to player 3 so an AI plays first and
  // creates a discard pile for the tour's hover step.
  const dealerIdx = dealerOverride !== null
    ? dealerOverride
    : (state.roundNumber === 1 ? 0 : state.lastWinnerIdx);

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
// Gate the first deal behind a round-count pick on the start-overlay (S1).
// The button click ALSO satisfies the browser's "user gesture" requirement
// that unlocks the AudioContext — without it, round-1 shuffle/deal sounds
// would be silently dropped.
const _startOverlay = document.getElementById('start-overlay');
if (_startOverlay) {
  const roundBtns = _startOverlay.querySelectorAll('.round-btn');
  const nameInput = document.getElementById('player-name-input');
  const slowInput = document.getElementById('slow-play-input');
  const tutInput  = document.getElementById('tutorial-input');
  let started = false; // guard against double-clicks during the 400ms fade
  roundBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      if (started) return;
      started = true;
      // Update the global TOTAL_ROUNDS from the button's data attribute.
      // scoring.js reads this at every round-end to decide game-over.
      TOTAL_ROUNDS = parseInt(btn.dataset.rounds, 10);
      // S2: trim + fall back to 'You' if blank. Browser caps length at 12 via
      // the maxlength attribute. textContent (used in the render path) escapes
      // any HTML the user types, so no XSS risk.
      const typedName = (nameInput && nameInput.value || '').trim();
      if (typedName) PLAYER_CFG[0].name = typedName;
      // S3: capture the slow-play preference. turns.js checks SLOW_PLAY when
      // deciding whether to start the steal/draw and discard timers.
      SLOW_PLAY = !!(slowInput && slowInput.checked);
      const showTut = !!(tutInput && tutInput.checked);
      _startOverlay.classList.add('dismissed');
      setTimeout(() => _startOverlay.remove(), 400);
      // Tap the audio context awake so shuffle/deal sounds play on round 1.
      if (typeof ensureAudioContext === 'function') ensureAudioContext();
      // If "First time" was checked, run the tutorial carousel first.
      // After the carousel closes, run the on-table practice round (with
      // its 3-step guided tour); the real round 1 deals once the practice
      // is done. If "First time" wasn't checked, deal round 1 immediately.
      if (showTut && typeof showTutorial === 'function') {
        showTutorial(() => {
          if (typeof startPracticeRound === 'function') {
            startPracticeRound();
          } else {
            dealRound();
          }
        });
      } else {
        dealRound();
      }
    });
  });
} else {
  // Fallback in case the overlay element was removed
  dealRound();
}

// Rule-book button in the header — re-opens the tutorial carousel in
// read-only mode (last slide is "You're ready!" tips, last button is
// just "Close"). Safe to click anytime; the modal floats above the
// game with no state side-effects.
const _rulebookBtn = document.getElementById('rulebook-btn');
if (_rulebookBtn) {
  _rulebookBtn.addEventListener('click', () => {
    if (typeof showTutorial === 'function') {
      showTutorial(null, { readonly: true });
    }
  });
}
