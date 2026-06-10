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
  const orders = cards.map(c => RANK_VALUE[c.rank]).sort((a, b) => a - b);
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

/* Returns every distinct valid phỏm configuration that includes `card` plus 2+
   cards from `hand`. Used after a successful steal — the player must lay down
   ONE of these. May return multiple options when the stolen card fits more
   than one possible phỏm. Sizes covered: 3 up to hand.length+1 (capped at 13)
   so a stolen card that completes a 5- or 6-card thông gives the player the
   full-length lay-down option, not just smaller subsets. */
function findStealPhoms(card, hand) {
  const groups = [];
  const maxGroupSize = Math.min(hand.length + 1, 13);
  for (let size = 3; size <= maxGroupSize; size++) {
    for (const combo of combinations(hand, size - 1)) {
      if (isValidPhom([card, ...combo])) groups.push([card, ...combo]);
    }
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

/* Optimal phỏm finder — explores every legal way to partition the hand into
   phỏm + leftover and returns the partition with the LOWEST rác point total.
   Replaces an earlier greedy version that could miss the best answer when two
   possible phỏm overlapped — e.g. hand contains both a 4-5-6 thông (in one
   suit) and 5-5-5 + 6-6-6 sám cô (where the 5 and 6 in the thông are reused
   for the sám cô). Greedy locked in the thông and threw away the sám cô; this
   version sees both options and picks 5-5-5 + 6-6-6 because it leaves only
   the 4 as rác.

   Algorithm: backtracking with two anti-explosion tricks —
   • Canonicalization: at every recursion step, any phỏm we extract MUST
     include the first card of `remaining`. The first card either goes into
     a phỏm or is locked as rác. This makes each unique partition visited
     exactly once instead of once per ordering.
   • Prune: if `racSoFar` already meets/exceeds the best rác value found so
     far, we can't improve from this branch — return early.

   Returns { groups: [[...cards], ...], rac: [...cards] }. */
function findBestPhoms(hand) {
  return findAllBestPhoms(hand)[0];
}

/* P6: like findBestPhoms but returns EVERY equally-optimal partition (i.e.
   every partition with the same minimum rác value), in canonical search
   order. The first entry is what findBestPhoms returns. When the hand has
   only one optimal partition, the array has length 1.

   Used by the human lay-down UI so the player can pick between tied
   configurations — e.g., a single 5 that could fit into either a sám cô
   (5♠5♣5♦) or a thông (4♠5♠6♠) where total rác is the same either way.

   Algorithm is the same backtracking as findBestPhoms but the prune is
   `>` (strictly worse) instead of `>=`, so equal candidates are explored
   instead of discarded. Canonical "first card must be in extracted group
   or locked as rác" still visits each unique partition exactly once. */
function findAllBestPhoms(hand) {
  const sumValues = arr => arr.reduce((s, c) => s + RANK_VALUE[c.rank], 0);

  // Start empty — `search` will populate allBest as it explores. The previous
  // code pre-seeded an "all-rác" partition here, which caused duplicate
  // entries when the hand has no valid phỏm (the search reaches the same
  // partition and pushes it again as a tie), making allBest.length === 2 and
  // triggering the multi-option picker UI for no reason.
  let allBest    = [];
  let bestRacVal = Infinity;

  function search(remaining, racSoFar, groups) {
    const racValSoFar = sumValues(racSoFar);
    if (racValSoFar > bestRacVal) return; // strictly worse — prune

    if (remaining.length === 0) {
      if (racValSoFar < bestRacVal) {
        bestRacVal = racValSoFar;
        allBest = [{ groups: groups.slice(), rac: racSoFar.slice() }];
      } else if (racValSoFar === bestRacVal) {
        allBest.push({ groups: groups.slice(), rac: racSoFar.slice() });
      }
      return;
    }

    const first = remaining[0];
    const rest  = remaining.slice(1);

    /* Try every possible phỏm size from 3 up to the remaining cards
       count, capped at 13 (max possible thông spans A→K in one suit;
       sám cô caps naturally at 4 since there are 4 of each rank). The
       previous code only tried sizes 3 and 4, which silently downgraded
       a 5-card thông like 7♠8♠9♠10♠J♠ into a 4-card thông + 1 rác. */
    const maxGroupSize = Math.min(rest.length + 1, 13);
    for (let size = 3; size <= maxGroupSize; size++) {
      for (const combo of combinations(rest, size - 1)) {
        const group = [first, ...combo];
        if (isValidPhom(group)) {
          const next = rest.filter(c => !combo.includes(c));
          search(next, racSoFar, [...groups, group]);
        }
      }
    }

    search(rest, [...racSoFar, first], groups);
  }

  search(hand.slice(), [], []);
  return allBest;
}

// ── Ù Detection ───────────────────────────────────────────────────

/* Backtracking check: can the entire `cards` array be partitioned into valid phỏm
   with nothing left over? Tries all groupings, not just the greedy order.
   Used for Ù detection where correctness matters more than speed. */
function canPartitionIntoPhoms(cards) {
  if (cards.length === 0) return true;
  if (cards.length < 3)   return false;
  const [first, ...rest] = cards;
  /* Try every possible phỏm size from 3 up to the remaining cards count
     (capped at 13). Previously only tried sizes 3 and 4, which missed
     Ù detection on hands like a clean 5-card thông or larger. */
  const maxGroupSize = Math.min(cards.length, 13);
  for (let size = 3; size <= maxGroupSize; size++) {
    for (const combo of combinations(rest, size - 1)) {
      const group     = [first, ...combo];
      const remaining = rest.filter(c => !combo.includes(c));
      if (isValidPhom(group) && canPartitionIntoPhoms(remaining)) return true;
    }
  }
  return false;
}

/* Returns true if the player's hand can be fully partitioned into valid phỏm (Ù condition).
   An empty hand counts as Ù too — that case happens when a player has
   gửi'd away their last remaining rác card during the extra-turn step.
   Zero cards = zero rác, which is the Ù condition.
   A hand of 1 or 2 cards can't form any phỏm and isn't Ù either. */
function checkU(hand) {
  if (hand.length === 0) return true;   // all rác sent away — Ù
  if (hand.length < 3)   return false;  // 1 or 2 leftover cards can't form phỏm
  return canPartitionIntoPhoms(hand);
}

/* Returns true if the hand has zero pairs and no same-suit cards within 2 ranks
   of each other — meaning no phỏm or near-phỏm is possible (Ù Khan condition) */
function isUKhan(hand) {
  for (let i = 0; i < hand.length; i++) {
    for (let j = i + 1; j < hand.length; j++) {
      const a = hand[i], b = hand[j];
      if (a.rank === b.rank) return false;
      if (a.suit === b.suit && Math.abs(RANK_VALUE[a.rank] - RANK_VALUE[b.rank]) <= 2)
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
