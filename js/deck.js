// ═══════════════════════════════════════════════════════════════════
// DECK — build and shuffle a standard 52-card deck
// ═══════════════════════════════════════════════════════════════════

/* Build a fresh unshuffled 52-card deck as {rank, suit} objects */
function buildDeck() {
  const deck = [];
  for (const suit of SUITS)
    for (const rank of RANKS)
      deck.push({ rank, suit });
  return deck;
}

/* Fisher-Yates in-place shuffle — randomises the array and returns it */
function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
