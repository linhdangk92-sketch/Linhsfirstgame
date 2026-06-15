// ═══════════════════════════════════════════════════════════════════
// RENDER — all DOM-building functions; call renderAll() after state changes
// ═══════════════════════════════════════════════════════════════════

/* Build one card DOM element.
   faceDown — show card back (striped); sm — AI hand size;
   xs — discard pile preview size; selectable — hover outline;
   onClick — click callback; playerIdx — sets unique AI card-back colour */
function makeCard(card, { faceDown = false, sm = false, xs = false, selectable = false, onClick = null, playerIdx = null } = {}) {
  const el        = document.createElement('div');
  const isRed     = !faceDown && RED_SUITS.has(card.suit);
  /* back-p1/p2/p3 give each AI player their unique card-back colour */
  const backClass = faceDown && playerIdx !== null && playerIdx > 0 ? 'back-p' + playerIdx : '';
  el.className = [
    'card',
    faceDown   ? 'face-down'  : (isRed ? 'red' : 'black'),
    backClass,
    sm         ? 'sm'         : '',
    xs         ? 'xs'         : '',
    selectable ? 'selectable' : '',
  ].filter(Boolean).join(' ');

  if (!faceDown) {
    el.innerHTML = `
      <div class="c-rank">${card.rank}</div>
      <div class="c-suit">${card.suit}</div>
      <div class="c-mid">${card.suit}</div>
    `;
    if (onClick) {
      el.style.cursor = 'pointer';
      el.addEventListener('click', () => onClick(card, el));
    }
  }

  return el;
}

/* Create a styled button element */
function makeBtn(label, cls, onClick) {
  const btn = document.createElement('button');
  btn.className = 'btn ' + cls;
  btn.textContent = label;
  btn.addEventListener('click', onClick);
  return btn;
}

/* Replace the action-bar contents with the given array of elements */
function renderActionBar(items) {
  const bar = document.getElementById('action-bar');
  bar.innerHTML = '';
  items.forEach(el => bar.appendChild(el));
}

/* Highlight the top card of a player's discard pile as stealable */
function highlightStealable(playerIdx) {
  document.querySelectorAll('.card.stealable').forEach(c => c.classList.remove('stealable'));
  const dp = document.getElementById('dp-' + playerIdx);
  if (!dp) return;
  const cards = dp.querySelectorAll('.card');
  if (cards.length) cards[cards.length - 1].classList.add('stealable');
}

/* Remove stealable highlight from all cards */
function clearStealable() {
  document.querySelectorAll('.card.stealable').forEach(c => c.classList.remove('stealable'));
}

/* Return a new array with the human's hand sorted by rank (A→K), with suit as
   the tiebreaker so identical ranks always sit in a stable order. */
function sortByRank(hand) {
  return [...hand].sort((a, b) => {
    const rankDiff = RANK_VALUE[a.rank] - RANK_VALUE[b.rank];
    if (rankDiff !== 0) return rankDiff;
    return SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit];
  });
}

/* Return a new array with the human's hand sorted by suit (♠ ♣ ♦ ♥), with rank
   as the tiebreaker so within each suit the cards run low→high. */
function sortBySuit(hand) {
  return [...hand].sort((a, b) => {
    const suitDiff = SUIT_ORDER[a.suit] - SUIT_ORDER[b.suit];
    if (suitDiff !== 0) return suitDiff;
    return RANK_VALUE[a.rank] - RANK_VALUE[b.rank];
  });
}

/* Render the human player's hand with drag-and-drop reordering.
   isDiscardPhase — when true, a single click on any card discards it immediately.
   The gap-zones (slim divs between cards) are purely visual: they show the user
   where the card will land. The actual drop-handling lives on the hand container
   so the WHOLE hand area is a forgiving drop target — we figure out which gap
   the cursor is closest to by comparing its X position to each card's center. */
function renderHumanHand(isDiscardPhase) {
  // MULTIPLAYER: the local player isn't always seat 0 — they sit wherever
  // they joined. MY_ABSOLUTE_SEAT defaults to 0 in solo so behavior is
  // unchanged there.
  const localSeat = (typeof MY_ABSOLUTE_SEAT !== 'undefined') ? MY_ABSOLUTE_SEAT : 0;
  const handEl = document.getElementById('hand-' + localSeat);
  handEl.innerHTML = '';
  let dragSrcIdx = null;
  /* Used by the discard-phase fan-out heuristic. We snapshot the cursor X at
     dragstart and compare in dragover — once cursor moves >30px horizontally,
     the player is clearly reordering, so we fan the hand out. Straight-up
     drags (discard intent) never cross the threshold and the hand stays
     compact. Tuned threshold: 30px ≈ half a card visible width. */
  let dragStartX = 0;
  const HAND_FANOUT_DX = 30;

  const hand = state.players[localSeat].hand;

  /* P7: during discard phase, identify the cards that are part of the
     optimal phỏm partition so they can be visually highlighted (green
     glow). Helps the player avoid discarding cards that are already
     "safe" in a complete 3+ card phỏm. Uses Set of card refs for O(1)
     lookup in the render loop below. */
  const phomCardSet = new Set();
  if (isDiscardPhase) {
    const { groups } = findBestPhoms(hand);
    groups.forEach(group => group.forEach(c => phomCardSet.add(c)));
  }

  /* Hide the sort toolbar when the hand has fewer than 6 cards — at that
     size sorting isn't useful (you can scan them at a glance) and the empty
     buttons just add visual noise. Re-evaluated on every render so the
     toolbar reappears once you're back above the threshold. */
  const toolbarEl = document.querySelector('.hand-toolbar');
  if (toolbarEl) toolbarEl.style.display = hand.length < 6 ? 'none' : 'flex';

  /* Wire up the auto-sort buttons above the hand. Using .onclick (rather than
     addEventListener) means each renderHumanHand call simply replaces the
     previous handler — no listener pile-up across re-renders. The buttons live
     in static HTML so they exist before this runs and survive renderHumanHand
     wiping handEl.innerHTML. After auto-sorting, drag-and-drop still works. */
  const sortRankBtn = document.getElementById('sort-rank');
  const sortSuitBtn = document.getElementById('sort-suit');
  if (sortRankBtn) sortRankBtn.onclick = () => {
    state.players[localSeat].hand = sortByRank(state.players[localSeat].hand);
    renderHumanHand(state.phase === 'discard-prompt');
  };
  if (sortSuitBtn) sortSuitBtn.onclick = () => {
    state.players[localSeat].hand = sortBySuit(state.players[localSeat].hand);
    renderHumanHand(state.phase === 'discard-prompt');
  };

  /* Given a cursor X coordinate in viewport pixels, return the gap index the
     cursor is over (0 = before first card, hand.length = after last card).
     We walk the cards left→right and return the first one whose center is
     right of the cursor — meaning "insert before this card". If the cursor is
     past every card, return hand.length (insert at the end). */
  const findGapIdx = (cursorX) => {
    const cardEls = handEl.querySelectorAll('.card');
    for (let i = 0; i < cardEls.length; i++) {
      const r = cardEls[i].getBoundingClientRect();
      if (cursorX < r.left + r.width / 2) return i;
    }
    return cardEls.length;
  };

  /* Highlight the gap-zone with the given index (and clear any old highlight). */
  const highlightGap = (gapIdx) => {
    handEl.querySelectorAll('.gap-zone.drag-over').forEach(g => g.classList.remove('drag-over'));
    const target = handEl.querySelector('.gap-zone[data-gap-idx="' + gapIdx + '"]');
    if (target) target.classList.add('drag-over');
  };

  /* Drag-target handlers on the HAND CONTAINER (not on individual cards/gaps).
     Using property assignment (handEl.ondragover = …) means each re-render
     replaces the previous handler instead of stacking duplicates.
     dragenter + dragover both preventDefault so all browsers (incl. Firefox)
     mark the area as a valid drop zone. */
  handEl.ondragenter = (e) => {
    if (dragSrcIdx === null) return;
    e.preventDefault();
  };

  handEl.ondragover = (e) => {
    if (dragSrcIdx === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    /* Discard-phase fan-out trigger: once the player has moved their cursor
       horizontally by more than HAND_FANOUT_DX, treat that as reorder intent
       and fan the hand out. Straight-up discard drags never cross the
       threshold so the hand stays compact through a discard. Once added,
       the class is only removed when the cursor enters the discard zone
       (see discardZoneEl.ondragover) or the drag ends (dragend). */
    if (isDiscardPhase && !handEl.classList.contains('is-dragging')) {
      if (Math.abs(e.clientX - dragStartX) > HAND_FANOUT_DX) {
        handEl.classList.add('is-dragging');
      }
    }
    highlightGap(findGapIdx(e.clientX));
  };

  handEl.ondrop = (e) => {
    if (dragSrcIdx === null) return;
    e.preventDefault();
    const src      = dragSrcIdx;
    const gapIdx   = findGapIdx(e.clientX);
    /* After removing the source from the array, every gap to its right shifts
       left by 1, so:  gap <= src → insertIdx = gap;  gap > src → insertIdx = gap-1.
       If insertIdx === src, the card lands in its own spot — a no-op. */
    const insertIdx = gapIdx > src ? gapIdx - 1 : gapIdx;
    if (insertIdx !== src) {
      const [moved] = hand.splice(src, 1);
      hand.splice(insertIdx, 0, moved);
    }
    dragSrcIdx = null;
    renderHumanHand(state.phase === 'discard-prompt');
  };

  /* Drag-to-discard drop zone — anchored inside #zone-0 but overflowing
     upward so it covers the entire area between the draw pile and the hand.
     Only active during the discard phase (.discard-mode class + handlers).
     Using .ondragover / .ondrop property assignment so each render replaces
     the previous handler — no listener pile-up across re-renders. */
  const discardZoneEl = document.getElementById('discard-zone');
  if (discardZoneEl) {
    if (isDiscardPhase) {
      discardZoneEl.classList.add('discard-mode');
      discardZoneEl.ondragover = (e) => {
        if (dragSrcIdx === null) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        /* If the player triggered reorder fan-out earlier in this drag but
           is now aiming at the discard zone, collapse the hand back to its
           compact state. The drop will discard the dragged card. */
        handEl.classList.remove('is-dragging');
        discardZoneEl.classList.add('drag-over');
      };
      /* dragleave fires on every child→parent transition too; only clear
         the highlight when the cursor genuinely leaves the zone. */
      discardZoneEl.ondragleave = (e) => {
        if (!discardZoneEl.contains(e.relatedTarget)) {
          discardZoneEl.classList.remove('drag-over');
        }
      };
      discardZoneEl.ondrop = (e) => {
        if (dragSrcIdx === null) return;
        e.preventDefault();
        discardZoneEl.classList.remove('drag-over');
        const card = hand[dragSrcIdx];
        dragSrcIdx = null;
        clearAllTimers();
        performDiscard(localSeat, card);
      };
    } else {
      discardZoneEl.classList.remove('discard-mode');
      discardZoneEl.classList.remove('drag-over');
      discardZoneEl.ondragover = null;
      discardZoneEl.ondragleave = null;
      discardZoneEl.ondrop = null;
    }
  }

  /* Build one gap-zone div. Purely visual — no event handlers. The data-gap-idx
     attribute lets the container's handlers find the right one to highlight. */
  const makeGap = (gapIdx) => {
    const gap = document.createElement('div');
    gap.className = 'gap-zone';
    gap.dataset.gapIdx = gapIdx;
    return gap;
  };

  hand.forEach((card, idx) => {
    /* gap-zone BEFORE this card (visual drop indicator for "insert at idx") */
    handEl.appendChild(makeGap(idx));

    const el = makeCard(card, { selectable: isDiscardPhase });
    /* P7: tag cards that are part of a detected phỏm so the CSS rule
       can apply the green glow. Only set during discard phase since
       phomCardSet is empty otherwise. */
    if (phomCardSet.has(card)) el.classList.add('in-phom');
    el.draggable = true;
    let _wasDragged = false;

    el.addEventListener('dragstart', (e) => {
      dragSrcIdx  = idx;
      dragStartX  = e.clientX;
      _wasDragged = true;
      el.classList.add('dragging');
      /* The "is-dragging" class spreads the hand out (reveals gap zones)
         for sort-by-drag. In discard phase we DEFER it — only adding when
         the cursor moves horizontally past HAND_FANOUT_DX (set in
         handEl.ondragover). That way a clean upward drag (discard intent)
         keeps the hand compact, while a sideways drag (reorder intent)
         triggers the fan-out as soon as the player crosses the threshold. */
      if (!isDiscardPhase) handEl.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move';
      /* setData is REQUIRED in Firefox for drag-and-drop to actually start.
         The payload itself is unused — we read state from dragSrcIdx. */
      e.dataTransfer.setData('text/plain', String(idx));
    });

    el.addEventListener('dragend', () => {
      el.classList.remove('dragging');
      handEl.classList.remove('is-dragging');
      handEl.querySelectorAll('.gap-zone.drag-over').forEach(g => g.classList.remove('drag-over'));
      const discardZoneEl = document.getElementById('discard-zone');
      if (discardZoneEl) discardZoneEl.classList.remove('drag-over');
      dragSrcIdx = null;
      /* brief delay so click event (if it fires) sees _wasDragged = true */
      setTimeout(() => { _wasDragged = false; }, 50);
    });

    // No click-to-discard anymore — discards happen by dragging the card onto
    // the center drop zone (wired below). Click is intentionally inert so a
    // stray click can't accidentally discard the wrong card.

    handEl.appendChild(el);
  });

  /* final gap-zone AFTER the last card (visual indicator for "insert at end") */
  handEl.appendChild(makeGap(hand.length));
}

/* Render all player hands.
   Human uses renderHumanHand (drag-and-drop). Skips human re-render during discard-prompt.
   An AI hand is flipped face-up when the player has individually lap-closed (B4)
   or when the whole round has ended (scoring/gameover). Any revealed hand also
   gets a subtle .hand-revealed outline as a visual cue. */
function renderHands() {
  const revealAll = state.phase === 'scoring' || state.phase === 'gameover';
  // MULTIPLAYER: the LOCAL human is whoever's seat we sit at, not always 0.
  const localSeat = (typeof MY_ABSOLUTE_SEAT !== 'undefined') ? MY_ABSOLUTE_SEAT : 0;

  state.players.forEach((player, idx) => {
    const revealed = revealAll || player.hasLaidDown;
    const handEl   = document.getElementById('hand-' + idx);

    if (idx === localSeat) {
      if (state.phase !== 'discard-prompt') renderHumanHand(false);
    } else {
      handEl.innerHTML = '';
      /* pass playerIdx so each AI gets its unique card-back colour (only matters when face-down) */
      player.hand.forEach(card => {
        handEl.appendChild(makeCard(card, { faceDown: !revealed, sm: true, playerIdx: idx }));
      });
    }

    handEl.classList.toggle('hand-revealed', revealed);
  });
}

/* Render each player's personal discard pile as a small fan of face-up xs cards */
function renderDiscardPiles() {
  state.players.forEach((player, idx) => {
    const el = document.getElementById('dp-' + idx);
    if (!el) return;
    el.innerHTML = '';

    if (player.discardPile.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'dp-empty';
      empty.textContent = '·';
      el.appendChild(empty);
      return;
    }

    player.discardPile.forEach(card => {
      el.appendChild(makeCard(card, { xs: true }));
    });
  });
}

/* Render all laid-down phỏm groups for every player */
function renderPhoms() {
  state.players.forEach((player, idx) => {
    const el = document.getElementById('phoms-' + idx);
    el.innerHTML = '';
    player.laidDown.forEach(group => {
      const g = document.createElement('div');
      g.className = 'phom-group';
      group.forEach(card => g.appendChild(makeCard(card, { xs: true })));
      el.appendChild(g);
    });
  });
}

/* Render draw pile count and hide the visual stack when empty */
function renderPiles() {
  document.getElementById('draw-count').textContent = state.drawPile.length + ' cards';
  document.getElementById('draw-stack').style.visibility =
    state.drawPile.length === 0 ? 'hidden' : 'visible';
}

/* Render header scoreboard and highlight the active player's score cell */
function renderScores() {
  const sb = document.getElementById('scoreboard');
  sb.innerHTML = '';
  PLAYER_CFG.forEach((cfg, idx) => {
    const cell  = document.createElement('div');
    const score = state.players[idx].cumScore;
    cell.className = 'score-cell' + (idx === state.currentTurn ? ' active' : '');
    cell.innerHTML = `
      <div class="s-name">${cfg.name}</div>
      <div class="s-val">${score > 0 ? '+' : ''}${score}</div>
    `;
    sb.appendChild(cell);
  });
  document.getElementById('round-badge').textContent =
    'Round ' + state.roundNumber + ' of ' + TOTAL_ROUNDS;
}

/* Render discard count badges on each player zone; warn at 3 */
function renderDiscardCounts() {
  state.players.forEach((player, idx) => {
    const el    = document.getElementById('dcnt-' + idx);
    const count = player.discardCount;
    el.textContent = PLAYER_CFG[idx].isHuman ? count + ' discards' : count;
    el.className   = 'd-count' + (count >= 3 ? ' warn' : '');
  });
}

/* Add/remove the is-active glow on the current player's zone */
function renderActiveZone() {
  for (let i = 0; i < 4; i++) {
    const z = document.getElementById('zone-' + i);
    if (z) z.classList.toggle('is-active', i === state.currentTurn);
  }
}

/* Master render — call after any state change */
function renderAll() {
  renderHands();
  renderDiscardPiles();
  renderPhoms();
  renderPiles();
  renderScores();
  renderDiscardCounts();
  renderActiveZone();
}

/* Update the status bar text (left side) and optional right-side note */
function setStatus(msg, right = '') {
  document.getElementById('status-msg').textContent   = msg;
  document.getElementById('status-right').textContent = right;
}

/* ── Card-fly animation helpers ──────────────────────────────────
   Shared foundation for P1 (deal), P2 (discard), P3 (steal). The pattern:
   1. Capture the source rect (where the card visually IS now).
   2. Update state + renderAll() — DOM now reflects the destination.
   3. Capture the dest rect, hide the destination card (opacity: 0).
   4. Spawn a "flying" overlay card positioned at source, animate to dest.
   5. On animation complete, reveal the destination card.
   The flyer uses position:fixed (viewport-relative coords from
   getBoundingClientRect) and transform:scale to smoothly resize between
   source and dest sizes. transform-origin:0 0 anchors scaling to the
   top-left so `left`/`top` represent the actual on-screen position. */

/* Get the bounding rect of a specific card in a player's hand. For the
   human (face-up), match by index in state.players[0].hand. For AI hands
   (face-down, identical-looking cards), any visible card works visually. */
function getCardRectInHand(playerIdx, card) {
  const handEl = document.getElementById('hand-' + playerIdx);
  if (!handEl) return null;
  const cardEls = handEl.querySelectorAll('.card');
  if (cardEls.length === 0) return null;
  // MULTIPLAYER: the local face-up player is MY_ABSOLUTE_SEAT, not always 0.
  const localSeat = (typeof MY_ABSOLUTE_SEAT !== 'undefined') ? MY_ABSOLUTE_SEAT : 0;
  if (playerIdx === localSeat) {
    const cardIdx = state.players[localSeat].hand.indexOf(card);
    if (cardIdx >= 0 && cardIdx < cardEls.length) {
      return cardEls[cardIdx].getBoundingClientRect();
    }
    return null;
  }
  // AI / opponent: any face-down card position represents the same visual location
  return cardEls[cardEls.length - 1].getBoundingClientRect();
}

/* P1 deal animation — fly each just-dealt card from the draw-pile center to
   its resting slot in the destination player's hand. Cards deal in round-
   robin order starting from the dealer: dealer gets card 1, next player
   card 1, … around the table, then back to dealer for card 2, etc. The
   dealer ends with one extra card (10 vs. 9) so they get a final extra
   turn at the end of the sequence.
   Returns a Promise that resolves once the last card has landed so the
   caller can chain a "now start the first turn" follow-up. */
function animateDeal(dealerIdx) {
  return new Promise(resolve => {
    // Source: one of the visible cards in the draw stack — pick the top
    // card so the flyer appears to lift off from a real position.
    const sourceEl = document.querySelector('#draw-stack .card');
    if (!sourceEl) { resolve(); return; }
    const sourceRect = sourceEl.getBoundingClientRect();

    // Snapshot each player's hand card elements + hide them immediately.
    // We reveal each card individually as its flyer lands so the deal
    // visibly proceeds one card at a time.
    const cardEls = [0, 1, 2, 3].map(idx => {
      const handEl = document.getElementById('hand-' + idx);
      if (!handEl) return [];
      const els = Array.from(handEl.querySelectorAll('.card'));
      els.forEach(el => { el.style.opacity = '0'; });
      return els;
    });

    const stagger  = 50;  // ms between consecutive deal events
    const duration = 280; // ms per individual card flight
    let dealCount  = 0;

    for (let cardIdx = 0; cardIdx < 10; cardIdx++) {
      for (let offset = 0; offset < 4; offset++) {
        const playerIdx   = (dealerIdx + offset) % 4;
        const targetCount = playerIdx === dealerIdx ? 10 : 9;
        if (cardIdx >= targetCount) continue;

        const destCardEl = cardEls[playerIdx][cardIdx];
        if (!destCardEl) continue;

        const card  = state.players[playerIdx].hand[cardIdx];
        const delay = dealCount * stagger;
        const cardOpts = playerIdx === 0
          ? {}                                              // human: normal, face-up
          : { sm: true, faceDown: true, playerIdx };        // AI: small, face-down (colored back)

        setTimeout(() => {
          const destRect = destCardEl.getBoundingClientRect();
          // P4: soft deal-tick per card so the rapid deal sounds like
          // rapid taps (matches the visual stagger naturally).
          soundDeal();
          animateCardFly(card, sourceRect, destRect, { cardOpts, duration })
            .then(() => { destCardEl.style.opacity = ''; });
        }, delay);

        dealCount++;
      }
    }

    setTimeout(resolve, dealCount * stagger + duration + 50);
  });
}

/* P5 + P3 combined — steal animation with a brief face-up reveal. The
   stolen card lifts off the source pile, scales up to normal size at
   center-screen, pauses ~600ms so the human can clearly read it, then
   flies to the stealer's hand position. The flyer is ALWAYS face-up
   throughout the flight so the player gets to see what was stolen —
   even when the destination is an AI hand (face-down). The destination
   card "flips" to its proper state on landing when its opacity is
   restored by the caller.
   Returns a Promise that resolves when the full sequence completes. */
function animateStealReveal(card, sourceRect, destRect) {
  const stage1Duration = 350; // source → center
  const pauseDuration  = 600; // pause at center
  const stage2Duration = 380; // center → dest

  return new Promise(resolve => {
    const centerW = 96, centerH = 139; // normal-card size
    const centerRect = {
      left:   window.innerWidth  / 2 - centerW / 2,
      top:    window.innerHeight / 2 - centerH / 2,
      width:  centerW,
      height: centerH,
    };

    const flyer = makeCard(card, {});
    flyer.classList.add('flying-card', 'flying-reveal');
    flyer.style.position        = 'fixed';
    flyer.style.left            = sourceRect.left + 'px';
    flyer.style.top             = sourceRect.top  + 'px';
    flyer.style.transformOrigin = '0 0';
    flyer.style.zIndex          = '1100';
    flyer.style.pointerEvents   = 'none';
    flyer.style.margin          = '0';

    document.body.appendChild(flyer);

    const naturalW = flyer.offsetWidth  || centerW;
    const naturalH = flyer.offsetHeight || centerH;

    // Start at source size
    flyer.style.transform = 'scale(' + (sourceRect.width / naturalW) + ', ' +
                                       (sourceRect.height / naturalH) + ')';
    void flyer.offsetWidth;

    // Stage 1: source → center (scale to 1.0)
    flyer.style.transition = 'left ' + stage1Duration + 'ms cubic-bezier(0.4, 0.1, 0.6, 1), ' +
                             'top '  + stage1Duration + 'ms cubic-bezier(0.4, 0.1, 0.6, 1), ' +
                             'transform ' + stage1Duration + 'ms cubic-bezier(0.4, 0.1, 0.6, 1)';
    flyer.style.left      = centerRect.left + 'px';
    flyer.style.top       = centerRect.top  + 'px';
    flyer.style.transform = 'scale(1, 1)';

    // After stage 1 + pause: stage 2 (center → dest)
    setTimeout(() => {
      flyer.style.transition = 'left ' + stage2Duration + 'ms cubic-bezier(0.4, 0.1, 0.6, 1), ' +
                               'top '  + stage2Duration + 'ms cubic-bezier(0.4, 0.1, 0.6, 1), ' +
                               'transform ' + stage2Duration + 'ms cubic-bezier(0.4, 0.1, 0.6, 1)';
      flyer.style.left      = destRect.left + 'px';
      flyer.style.top       = destRect.top  + 'px';
      flyer.style.transform = 'scale(' + (destRect.width / naturalW) + ', ' +
                                         (destRect.height / naturalH) + ')';

      setTimeout(() => {
        flyer.remove();
        resolve();
      }, stage2Duration + 30);
    }, stage1Duration + pauseDuration);
  });
}

/* Animate a flying card overlay from sourceRect to destRect. cardOpts is
   passed straight to makeCard (so the flyer matches the dest card's look:
   normal/sm/xs, face-up/down). Returns a Promise that resolves when the
   animation completes so callers can chain "reveal the dest card" cleanup. */
function animateCardFly(card, sourceRect, destRect, options = {}) {
  const duration = options.duration || 350;
  const cardOpts = options.cardOpts || {};

  return new Promise(resolve => {
    const flyer = makeCard(card, cardOpts);
    flyer.classList.add('flying-card');
    flyer.style.position       = 'fixed';
    flyer.style.left           = sourceRect.left + 'px';
    flyer.style.top            = sourceRect.top  + 'px';
    flyer.style.transformOrigin = '0 0';
    flyer.style.zIndex         = '1100';
    flyer.style.pointerEvents  = 'none';
    flyer.style.margin         = '0'; // override any hand margin-left etc.

    document.body.appendChild(flyer);

    // The flyer's natural size is determined by cardOpts (and matches the
    // destination). Compute the scale that makes it appear at source size
    // initially, and 1.0 at the destination.
    const naturalW = flyer.offsetWidth  || destRect.width;
    const naturalH = flyer.offsetHeight || destRect.height;
    const startSX  = sourceRect.width  / naturalW;
    const startSY  = sourceRect.height / naturalH;
    flyer.style.transform = 'scale(' + startSX + ', ' + startSY + ')';

    /* Force reflow so the initial position/transform are committed before
       we add the transition + final state — otherwise the browser batches
       both and skips the animation. */
    void flyer.offsetWidth;

    flyer.style.transition = 'left ' + duration + 'ms cubic-bezier(0.4, 0.1, 0.6, 1), ' +
                             'top '  + duration + 'ms cubic-bezier(0.4, 0.1, 0.6, 1), ' +
                             'transform ' + duration + 'ms cubic-bezier(0.4, 0.1, 0.6, 1)';
    flyer.style.left      = destRect.left + 'px';
    flyer.style.top       = destRect.top  + 'px';
    flyer.style.transform = 'scale(1, 1)';

    setTimeout(() => {
      flyer.remove();
      resolve();
    }, duration + 30);
  });
}

/* Internal: append a toast pill to a player's .player-info bar, fade it in,
   linger, then fade out + remove. Pure DOM mechanics; styling and per-zone
   direction are handled by the toastClass + the .player-info parent.
   Used by showAnChotToast and showMomToast — keep them sharing one mechanism
   so timing/animation stay consistent and changes only need to be made once. */
function _showPlayerToast(playerIdx, toastClass, text) {
  const pinfo = document.querySelector('#zone-' + playerIdx + ' .player-info');
  if (!pinfo) return;

  // Remove any existing toast of the same kind first (re-entry safety).
  pinfo.querySelectorAll('.' + toastClass).forEach(t => t.remove());

  const toast = document.createElement('div');
  toast.className = toastClass;
  toast.textContent = text;
  pinfo.appendChild(toast);

  // Force layout so the off-screen transform is the starting point of the
  // CSS transition (without this the browser would batch initial + .show
  // styles into one paint and skip the animation).
  void toast.offsetWidth;
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300); // matches transition duration
  }, 1500);
}

/* Show the Ăn Chốt toast next to a specific player's .player-info bar.
   Fires whenever that player steals a final (4th) discard. */
function showAnChotToast(playerIdx) {
  _showPlayerToast(playerIdx, 'an-chot-toast', '⚡ Ăn Chốt!');
}

/* Show the Móm toast next to a specific player's .player-info bar.
   Fires at lap-close when the player has laid down zero phỏm the whole
   round — they take the −4 Móm penalty and pay another +4 to the winner.
   Distinct dark-slate coloring so it's never mistaken for the yellow Ăn Chốt. */
function showMomToast(playerIdx) {
  _showPlayerToast(playerIdx, 'mom-toast', '💀 Móm!');
  // Descending "wah-wah-waaah" so the penalty moment has audible weight too.
  soundMom();
}

/* Show a per-player score-change toast (used by Đền payments). Positive deltas
   get a green pill ("+15"), negative deltas a red pill ("−15"). Zero deltas
   are skipped — no toast for an unaffected player. Uses the en-dash for
   negatives so it reads cleaner than a plain hyphen. */
function showScoreChangeToast(playerIdx, delta) {
  if (delta === 0) return;
  const variant = delta > 0 ? 'gain-toast' : 'loss-toast';
  const text    = (delta > 0 ? '+' : '−') + Math.abs(delta);
  _showPlayerToast(playerIdx, variant, text);
}

/* Show the center-screen Đền toast for T1/T3. label = "Đền T1" / "Đền T3";
   detail = a short human-readable line describing the consequence. The toast
   sits at top: 22% so it doesn't collide with the centered Ù celebration card
   that fires simultaneously. */
function showDenToast(label, detail) {
  const overlay = document.getElementById('den-toast');
  if (!overlay) return;

  overlay.innerHTML = '';

  const labelEl = document.createElement('div');
  labelEl.className = 'den-label';
  labelEl.textContent = '⚡ ' + label + ' ⚡';
  overlay.appendChild(labelEl);

  const detailEl = document.createElement('div');
  detailEl.className = 'den-detail';
  detailEl.textContent = detail;
  overlay.appendChild(detailEl);

  /* Force the .show class to be applied on a separate frame so the entrance
     transition actually runs (same trick as the Ăn Chốt toast above). */
  void overlay.offsetWidth;
  overlay.classList.add('show');

  setTimeout(() => {
    overlay.classList.remove('show');
    setTimeout(() => { overlay.innerHTML = ''; }, 400);
  }, 2500);
}
