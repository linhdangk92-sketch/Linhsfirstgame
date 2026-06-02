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

  // Đền (Compensation) state — tracked globally because at most ONE player is
  // ever liable at a time (chain transfers overwrite the previous one).
  denLiable:        null, // { stealerIdx, victimIdx } of the most recent Ăn Chốt event, or null
  pendingTrigger3:  null, // { winnerIdx, victimIdx } when the stolen card immediately completes the stealer's Ù

  // Lap-close ordering — used by endRound to rank Móm players against each
  // other (rác total doesn't matter for Móm; the one who lap-closed FIRST is
  // "1st Móm", next is "2nd Móm", etc.). Per-player lapClosedAt is set when
  // their runLapClose finalize() runs.
  lapCloseCounter:  0,

  players: Array(4).fill(null).map(() => ({
    hand:         [],
    laidDown:     [],      // array of phom groups (each group = array of cards)
    hasLaidDown:  false,   // true once this player has gone through lap-close (laid down + revealed hand)
    discardPile:  [],      // physical cards on the table (for display)
    discardCount:  0,      // true number of discards made — used for cascade trigger and badge
    cumScore:      0,
    roundScore:    0,
    isMom:        true,    // no phom laid down yet (Móm penalty applies at round end)
    stolenStreak:  0,      // cumulative steals FROM this player BY their immediate-next-player only — Đền T2 triggers at 3
    firstTurn:    true,    // false once this player has had startTurn called on them once — used to gate the Ù Khan declare window
    lapClosedAt:   0,      // monotonically-increasing tag set when this player lap-closes; 0 means hasn't lap-closed yet
  })),
};
