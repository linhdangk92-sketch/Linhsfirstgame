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
  const handEl = document.getElementById('hand-0');
  handEl.innerHTML = '';
  let dragSrcIdx = null;
  /* Used by the discard-phase fan-out heuristic. We snapshot the cursor X at
     dragstart and compare in dragover — once cursor moves >30px horizontally,
     the player is clearly reordering, so we fan the hand out. Straight-up
     drags (discard intent) never cross the threshold and the hand stays
     compact. Tuned threshold: 30px ≈ half a card visible width. */
  let dragStartX = 0;
  const HAND_FANOUT_DX = 30;

  const hand = state.players[0].hand;

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
    state.players[0].hand = sortByRank(state.players[0].hand);
    renderHumanHand(state.phase === 'discard-prompt');
  };
  if (sortSuitBtn) sortSuitBtn.onclick = () => {
    state.players[0].hand = sortBySuit(state.players[0].hand);
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
        performDiscard(0, card);
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

  state.players.forEach((player, idx) => {
    const revealed = revealAll || player.hasLaidDown;
    const handEl   = document.getElementById('hand-' + idx);

    if (idx === 0) {
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
