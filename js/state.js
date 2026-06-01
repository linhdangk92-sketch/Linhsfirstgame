// ═══════════════════════════════════════════════════════════════════
// STATE — single source of truth for all game data
// ═══════════════════════════════════════════════════════════════════

const state = {
  roundNumber:  1,
  currentTurn:  0,
  phase:        'dealing', // dealing | playing | steal-prompt | discard-prompt | steal-laydown-prompt | laydown-prompt | laydown | gui-prompt | scoring | gameover

  drawPile:     [],
  lastDiscard:  null,      // card available to steal (top of previous player's discard pile)

  stealHappenedThisTurn: false, // tracks whether current player stole this turn
  selectedDiscardCard:   null,  // the card the human has clicked to discard
  starterIdx:            0,     // index of the player holding the "starter" role for the current lap
  isLastLap:             false, // flips true the moment the first player hits discardCount=4 (start of round-end phase)
  lastWinnerIdx:         0,     // index of the player who won the previous round — dealer of the next round

  players: Array(4).fill(null).map(() => ({
    hand:         [],
    laidDown:     [],      // array of phom groups (each group = array of cards)
    hasLaidDown:  false,   // true once this player has gone through lap-close (laid down + revealed hand)
    discardPile:  [],      // physical cards on the table (for display)
    discardCount:  0,      // true number of discards made — used for cascade trigger and badge
    cumScore:      0,
    roundScore:    0,
    isMom:        true,    // no phom laid down yet (Móm penalty applies at round end)
    ateChot:      false,   // stole the final discard
    gotChot:      false,   // had their final discard stolen
    denOrder:      0,      // Đền chain: 0=none, higher=later in chain
    stolenStreak:  0,      // consecutive steals FROM this player (Đền triggers at 3)
  })),
};
