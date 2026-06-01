// ═══════════════════════════════════════════════════════════════════
// PHOM — validation and detection of valid phỏm combinations
// ═══════════════════════════════════════════════════════════════════

/* Sám Cô: 3 or 4 cards of the same rank, any suits */
function isSamCo(cards) {
  return cards.length >= 3 && cards.length <= 4 &&
    cards.every(c => c.rank === cards[0].rank);
}

/* Thông / Sảnh: 3+ consecutive ranks of the SAME suit. Ace is low only. */
function isThong(cards) {
  if (cards.length < 3) return false;
  if (!cards.every(c => c.suit === cards[0].suit)) return false;
  const orders = cards.map(c => RANK_ORDER[c.rank]).sort((a, b) => a - b);
  for (let i = 1; i < orders.length; i++) {
    if (orders[i] !== orders[i - 1] + 1) return false;
  }
  return true;
}

/* Returns true if the array of cards forms a valid phỏm.
   - Sám cô: 3 or 4 cards of the same rank (naturally capped at 4 by isSamCo
     because there are only 4 cards of each rank in the deck).
   - Thông: 3+ consecutive same-suit cards. No upper cap — a laid-down thông
     can grow via gửi up to 13 cards (A→K within one suit).
   Most callers pass 3 or 4 cards; canGui (B6) can pass an extended laid-down
   phỏm plus one more card. */
function isValidPhom(cards) {
  if (cards.length < 3) return false;
  return isSamCo(cards) || isThong(cards);
}

/* Returns true if stealing `card` would complete any phỏm with cards in `hand` */
function canSteal(card, hand) {
  for (let i = 0; i < hand.length; i++) {
    for (let j = i + 1; j < hand.length; j++) {
      if (isValidPhom([card, hand[i], hand[j]])) return true;
      for (let k = j + 1; k < hand.length; k++) {
        if (isValidPhom([card, hand[i], hand[j], hand[k]])) return true;
      }
    }
  }
  return false;
}

/* Returns every distinct valid phỏm configuration that includes `card` plus 2 or 3 cards
   from `hand`. Used after a successful steal — the player must lay down ONE of these.
   May return multiple options when the stolen card fits more than one possible phỏm. */
function findStealPhoms(card, hand) {
  const groups = [];
  // 3-card phỏm: stolen card + 2 from hand
  for (const combo of combinations(hand, 2)) {
    if (isValidPhom([card, ...combo])) groups.push([card, ...combo]);
  }
  // 4-card phỏm: stolen card + 3 from hand
  for (const combo of combinations(hand, 3)) {
    if (isValidPhom([card, ...combo])) groups.push([card, ...combo]);
  }
  return groups;
}

/* Returns all k-element subsets of arr as an array of arrays */
function combinations(arr, k) {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [head, ...tail] = arr;
  return [
    ...combinations(tail, k - 1).map(c => [head, ...c]),
    ...combinations(tail, k),
  ];
}

/* Greedy phỏm finder — tries 4-card groups first (harder to form → higher priority),
   then 3-card groups. Repeats until no more valid groups can be found.
   Returns { groups: [[...cards], ...], rac: [...cards] } */
function findBestPhoms(hand) {
  const remaining = [...hand];
  const groups    = [];

  let found = true;
  while (found) {
    found = false;
    for (const size of [4, 3]) {
      for (const combo of combinations(remaining, size)) {
        if (isValidPhom(combo)) {
          groups.push(combo);
          combo.forEach(c => {
            const i = remaining.indexOf(c);
            if (i !== -1) remaining.splice(i, 1);
          });
          found = true;
          break;
        }
      }
      if (found) break;
    }
  }

  return { groups, rac: remaining };
}

// ── Ù Detection ───────────────────────────────────────────────────

/* Backtracking check: can the entire `cards` array be partitioned into valid phỏm
   with nothing left over? Tries all groupings, not just the greedy order.
   Used for Ù detection where correctness matters more than speed. */
function canPartitionIntoPhoms(cards) {
  if (cards.length === 0) return true;
  if (cards.length < 3)   return false;
  const [first, ...rest] = cards;
  for (const size of [3, 4]) {
    for (const combo of combinations(rest, size - 1)) {
      const group     = [first, ...combo];
      const remaining = rest.filter(c => !combo.includes(c));
      if (isValidPhom(group) && canPartitionIntoPhoms(remaining)) return true;
    }
  }
  return false;
}

/* Returns true if the player's hand can be fully partitioned into valid phỏm (Ù condition) */
function checkU(hand) {
  if (hand.length < 3) return false;
  return canPartitionIntoPhoms(hand);
}

/* Returns true if the hand has zero pairs and no same-suit cards within 2 ranks
   of each other — meaning no phỏm or near-phỏm is possible (Ù Khan condition) */
function isUKhan(hand) {
  for (let i = 0; i < hand.length; i++) {
    for (let j = i + 1; j < hand.length; j++) {
      const a = hand[i], b = hand[j];
      if (a.rank === b.rank) return false;
      if (a.suit === b.suit && Math.abs(RANK_ORDER[a.rank] - RANK_ORDER[b.rank]) <= 2)
        return false;
    }
  }
  return true;
}

// ── Gửi Detection ─────────────────────────────────────────────────

/* Returns true if `card` can be legally added to `phomGroup` to extend it.
   The 4-card cap no longer applies once a phỏm has been laid down — thông can
   grow at either end up to 13 cards; sám cô is still naturally capped at 4
   (only 4 cards per rank exist). isValidPhom enforces the right shape. */
function canGui(card, phomGroup) {
  return isValidPhom([...phomGroup, card]);
}
