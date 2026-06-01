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

  const hand = state.players[0].hand;

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
      _wasDragged = true;
      el.classList.add('dragging');
      handEl.classList.add('is-dragging');
      e.dataTransfer.effectAllowed = 'move';
      /* setData is REQUIRED in Firefox for drag-and-drop to actually start.
         The payload itself is unused — we read state from dragSrcIdx. */
      e.dataTransfer.setData('text/plain', String(idx));
    });

    el.addEventListener('dragend', () => {
      el.classList.remove('dragging');
      handEl.classList.remove('is-dragging');
      handEl.querySelectorAll('.gap-zone.drag-over').forEach(g => g.classList.remove('drag-over'));
      dragSrcIdx = null;
      /* brief delay so click event (if it fires) sees _wasDragged = true */
      setTimeout(() => { _wasDragged = false; }, 50);
    });

    if (isDiscardPhase) {
      el.addEventListener('click', () => {
        if (_wasDragged) return; // drag ended — don't treat as a discard click
        clearAllTimers();
        performDiscard(0, card);
      });
    }

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
