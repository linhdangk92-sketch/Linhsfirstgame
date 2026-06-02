// ═══════════════════════════════════════════════════════════════════
// LAYDOWN — lay-down phỏm and round-end cascade
// ═══════════════════════════════════════════════════════════════════

// ── Locking In Phỏm ──────────────────────────────────────────────

/* Move the given groups of cards from the player's hand into their laidDown pile.
   Sets isMom=false because they've successfully put down at least one phỏm. */
function lockInPhoms(playerIdx, groups) {
  const player = state.players[playerIdx];
  groups.forEach(group => {
    group.forEach(card => {
      const i = player.hand.indexOf(card);
      if (i !== -1) player.hand.splice(i, 1);
    });
    player.laidDown.push(group);
  });
  if (groups.length > 0) player.isMom = false;
}

// ── Lay-down on Steal (B2) ────────────────────────────────────────

/* After a successful steal, the player must immediately lay down the phỏm
   that includes the stolen card. Per rules.md: only the stolen-completed
   phỏm gets revealed; any organic phỏm in the rest of the hand stays hidden
   until lap-close.

   AI: auto-picks the largest available phỏm.
   Human: if only one config is possible, auto-picks; otherwise prompts to choose.
   Calls onDone() once the lay-down is complete. */
function layDownStolenPhom(playerIdx, stolenCard, onDone) {
  const player = state.players[playerIdx];
  // The stolen card was already pushed onto the hand by performSteal.
  // Strip it out so findStealPhoms doesn't see it twice.
  const handMinusStolen = player.hand.filter(c => c !== stolenCard);
  const options = findStealPhoms(stolenCard, handMinusStolen);

  if (options.length === 0) {
    // Safety net: canSteal() must have returned true for performSteal to fire,
    // so this branch shouldn't be reachable. Log and continue anyway.
    console.warn('Steal succeeded but findStealPhoms returned no options — skipping forced lay-down');
    onDone();
    return;
  }

  // Sort largest-first so AI naturally picks the 4-card option when one exists.
  options.sort((a, b) => b.length - a.length);

  // Auto-pick: AI always, or human when there's only one config.
  if (options.length === 1 || !PLAYER_CFG[playerIdx].isHuman) {
    const chosen = options[0];
    lockInPhoms(playerIdx, [chosen]);
    renderAll();
    setStatus(PLAYER_CFG[playerIdx].name + ' lays down ' +
              chosen.map(c => c.rank + c.suit).join(' '));
    setTimeout(onDone, 600);
    return;
  }

  // Multiple configs — human picks which phỏm to lay down.
  state.phase = 'steal-laydown-prompt';
  setStatus('Stole ' + stolenCard.rank + stolenCard.suit + ' — pick which phỏm to lay down');

  const btns = options.map(group =>
    makeBtn(
      group.map(c => c.rank + c.suit).join(' '),
      'btn-laydown',
      () => {
        lockInPhoms(playerIdx, [group]);
        renderAll();
        renderActionBar([]);
        state.phase = 'playing';
        onDone();
      }
    )
  );

  renderActionBar(btns);
}

// ── Human Lay-Down UI ─────────────────────────────────────────────

/* Show the human a lay-down choice in the action bar.
   Automatically detects any valid phỏm in their hand using findBestPhoms.
   isCascade=true means the round is ending — they must confirm before moving on.
   onDone() is called when they finish (laid down or skipped). */
function showHumanLayDownChoice(playerIdx, isCascade, onDone) {
  state.phase = 'laydown-prompt';
  const { groups } = findBestPhoms(state.players[playerIdx].hand);

  if (groups.length === 0) {
    // No valid phỏm found in hand
    if (isCascade) {
      // During round-end cascade the human must explicitly confirm before we move on
      setStatus('You have no phỏm — you are Móm!');
      renderActionBar([makeBtn('Confirm (No Phỏm)', 'btn-draw', () => {
        renderActionBar([]);
        state.phase = 'playing';
        onDone();
      })]);
    } else {
      // During normal play, nothing to do — silently advance
      state.phase = 'playing';
      onDone();
    }
    return;
  }

  // Build a compact text label listing each detected phỏm group
  const label = document.createElement('span');
  label.style.cssText = 'font-size:0.7rem; color:#1A4731; font-weight:700; white-space:nowrap;';
  label.textContent = groups.map(g => '[' + g.map(c => c.rank + c.suit).join(' ') + ']').join('  ');

  const btnLay = makeBtn('Lay Down', 'btn-laydown', () => {
    lockInPhoms(playerIdx, groups);
    renderAll();
    renderActionBar([]);
    state.phase = 'playing';
    onDone();
  });

  // During cascade the skip button just says "Done" (no phỏm to lay down)
  const btnSkip = makeBtn(isCascade ? 'Done' : 'Skip', 'btn-draw', () => {
    renderActionBar([]);
    state.phase = 'playing';
    onDone();
  });

  setStatus(
    isCascade
      ? 'Round ending — lay down your phỏm!'
      : 'Phỏm found! Lay down or skip.'
  );
  renderActionBar([label, btnLay, btnSkip]);
}

// ── After-Discard Gate ────────────────────────────────────────────

/* True when every player has lap-closed AND made at least 4 discards.
   This is the round-end gate — accounts for lap-balancing that may have
   temporarily knocked a laid-down player's count below 4. */
function allPlayersDone() {
  return state.players.every(p => p.hasLaidDown && p.discardCount >= DISCARD_PILE_LIMIT);
}

/* Called after every discard instead of advancing the turn directly.
   Three branches:
   (a) Not-yet-laid-down player hits 4 → first-time lap-close (B4).
   (b) Already-laid-down player just discarded → extra-turn gửi step (B5).
   (c) Normal discard during laps 1–3 → just advance to the next player. */
function afterDiscard(playerIdx) {
  const player = state.players[playerIdx];

  // (a) First-time lap-close.
  if (!player.hasLaidDown && player.discardCount === DISCARD_PILE_LIMIT) {
    setStatus(PLAYER_CFG[playerIdx].name + ' hits 4 discards — lap-close!');
    setTimeout(() => {
      runLapClose(playerIdx, () => {
        if (allPlayersDone()) endRound();
        else advanceTurn();
      });
    }, 700);
    return;
  }

  // (b) Extra-turn discard from a laid-down player (forced rác or post-steal).
  // Run the gửi step then check round-end.
  if (player.hasLaidDown) {
    setTimeout(() => {
      handleGuiStep(playerIdx, () => {
        if (allPlayersDone()) endRound();
        else advanceTurn();
      });
    }, 400);
    return;
  }

  // (c) Normal discard: just advance.
  if (PLAYER_CFG[playerIdx].isHuman) {
    advanceTurn();
  } else {
    setTimeout(() => advanceTurn(), 400);
  }
}

// ── Gửi (Sending Rác to Another's Phỏm) ─────────────────────────

/* Collect all gửi opportunities for playerIdx.
   A gửi is valid when a card in this player's hand can legally extend another
   player's already laid-down phỏm group (per canGui).
   Gated to the last lap only — returns [] during laps 1–3.
   Also gated to lap-closed targets only — B2 steal-lay-down phỏm from laps
   1–3 are not gửi-able. Only phỏm of players who have lap-closed count.
   Móm players (zero phỏm laid down themselves) cannot gửi — they keep all
   their rác and take the full Móm penalty. Without this gate, a Móm player
   could shrink their rác total by extending opponents' phỏm, softening the
   punishment that Móm is meant to deliver.
   Returns array of { card, targetIdx, groupIdx } objects. */
function findGuiOptions(playerIdx) {
  if (!state.isLastLap) return [];
  if (state.players[playerIdx].isMom) return [];

  const options  = [];
  const racCards = state.players[playerIdx].hand;

  state.players.forEach((other, targetIdx) => {
    if (targetIdx === playerIdx) return;
    if (!other.hasLaidDown) return;
    other.laidDown.forEach((group, groupIdx) => {
      racCards.forEach(card => {
        if (canGui(card, group)) {
          options.push({ card, targetIdx, groupIdx });
        }
      });
    });
  });

  return options;
}

/* Execute a single gửi: move `card` from playerIdx's hand into targetIdx's phỏm
   group. Returns true if this gửi triggered Ù (the player's hand became pure
   phỏm or had its last rác removed), so callers can short-circuit. */
function applyGui(playerIdx, card, targetIdx, groupIdx) {
  const hand = state.players[playerIdx].hand;
  const i    = hand.indexOf(card);
  if (i !== -1) hand.splice(i, 1);
  state.players[targetIdx].laidDown[groupIdx].push(card);

  // B7: hand composition changed — check Ù.
  return checkAndHandleU(playerIdx);
}

/* AI sends every eligible rác card to an opponent's phỏm — one at a time,
   with a 600ms pause and a status message per send so users can see each gửi
   land before the next. Re-checks after each send because one gửi can make
   another invalid. Calls onDone(uDeclared) when no options remain — uDeclared
   is true if any gửi triggered Ù (caller must skip its own onDone since
   declareU is taking over). */
function aiGui(playerIdx, onDone) {
  function sendNext() {
    const opts = findGuiOptions(playerIdx);
    if (opts.length === 0) {
      onDone(false);
      return;
    }
    const { card, targetIdx, groupIdx } = opts[0];
    setStatus(PLAYER_CFG[playerIdx].name + ' gửi ' + card.rank + card.suit +
              ' → ' + PLAYER_CFG[targetIdx].name);
    const uDeclared = applyGui(playerIdx, card, targetIdx, groupIdx);
    renderAll();
    if (uDeclared) {
      onDone(true);
      return;
    }
    setTimeout(sendNext, 600);
  }
  sendNext();
}

/* Show a human gửi prompt. Each button sends one rác card to a specific phỏm group.
   Refreshes the buttons after each gửi so the list stays accurate.
   onDone() is called when no more options remain or the human clicks Done. */
function showHumanGuiChoice(playerIdx, onDone) {
  function refresh() {
    const opts = findGuiOptions(playerIdx);

    if (opts.length === 0) {
      renderActionBar([]);
      state.phase = 'playing';
      onDone();
      return;
    }

    state.phase = 'gui-prompt';

    const label = document.createElement('span');
    label.style.cssText = 'font-size:0.7rem; color:#1A4731; font-weight:600;';
    label.textContent   = 'Gửi:';

    const btns = opts.map(({ card, targetIdx, groupIdx }) =>
      makeBtn(
        card.rank + card.suit + ' → ' + PLAYER_CFG[targetIdx].name,
        'btn-gui',
        () => {
          // B7: if the gửi triggered Ù, declareU takes over — skip the refresh.
          if (applyGui(playerIdx, card, targetIdx, groupIdx)) { renderAll(); return; }
          renderAll();
          refresh();
        }
      )
    );

    const doneBtn = makeBtn('Done', 'btn-draw', () => {
      renderActionBar([]);
      state.phase = 'playing';
      onDone();
    });

    setStatus('You can gửi cards to extend other players\' phỏm!');
    renderActionBar([label, ...btns, doneBtn]);
  }

  refresh();
}

/* Run the gửi step for one player. Human sees interactive buttons; AI sends
   any eligible cards automatically. Used by both lap-close (B4) and extra
   turns (B5). The AI branch narrates each send one-at-a-time via aiGui's
   internal pacing. If a gửi triggered Ù, skip onDone — declareU handles
   round-end. */
function handleGuiStep(playerIdx, onDone) {
  if (PLAYER_CFG[playerIdx].isHuman) {
    showHumanGuiChoice(playerIdx, onDone);
  } else {
    aiGui(playerIdx, (uDeclared) => {
      if (uDeclared) return;
      setTimeout(onDone, 600);
    });
  }
}

// ── Per-Player Lap-Close (B4) ─────────────────────────────────────

/* One player closes their lap individually (no synchronized cascade).
   Triggered from afterDiscard when the discarder's discardCount hits 4.
   Sequence per rules.md: lay down remaining phỏm → reveal hand → gửi → onDone.
   Phỏm completed by earlier steals are already in `laidDown` from B2.

   For the human player, when there's a phỏm to lay down, we show a
   confirmation panel listing exactly which cards will land on the table —
   so a surprise auto-lay-down (e.g. the old greedy picking a thông over a
   pair of sám cô) can't catch them off guard. AI auto-confirms; a Móm human
   also auto-advances since there's nothing to review. */
function runLapClose(playerIdx, onDone) {
  const player = state.players[playerIdx];
  const cfg    = PLAYER_CFG[playerIdx];

  // First lap-close in the round flips the global into "last lap" mode.
  state.isLastLap = true;

  // Detect ALL equally-optimal phỏm partitions. P6: if the human has more
  // than one tie, they get to pick which one to lay down. Otherwise the
  // single optimal is used (matches the previous findBestPhoms behavior).
  const allBest       = findAllBestPhoms(player.hand);
  const defaultGroups = allBest[0].groups;

  /* The actual lock-in + reveal + gửi step. Takes the CHOSEN partition's
     groups (or the default first one for AI / single-option / Móm-human). */
  const finalize = (chosenGroups) => {
    if (chosenGroups.length > 0) lockInPhoms(playerIdx, chosenGroups);

    // Reveal the hand. renderHands flips face-down → face-up via player.hasLaidDown.
    player.hasLaidDown = true;
    // Stamp the order of this lap-close so endRound can rank Móm players
    // ("1st Móm" closed first, "2nd Móm" closed later, etc.).
    player.lapClosedAt = ++state.lapCloseCounter;
    renderAll();

    const summary = chosenGroups.length > 0
      ? chosenGroups.map(g => '[' + g.map(c => c.rank + c.suit).join(' ') + ']').join(' ')
      : (player.laidDown.length === 0 ? '(Móm — no phỏm)' : '(no remaining phỏm)');
    setStatus(cfg.name + ' lap-closes ' + summary);

    // Móm callout: if they finished the round without laying down a single
    // phỏm (no organic phỏm now AND no stolen-completed phỏm earlier), pop a
    // dark-slate toast next to their zone so the penalty moment is visible.
    if (player.isMom) showMomToast(playerIdx);

    // Gửi opportunity — empty for the first lap-closer when no other phỏm exists yet.
    setTimeout(() => handleGuiStep(playerIdx, onDone), 800);
  };

  // P6: human with multiple equally-optimal partitions → show one button
  // per option. The player picks; that partition is what gets laid down.
  if (cfg.isHuman && allBest.length > 1) {
    state.phase = 'laydown-prompt';
    setStatus('Lap-close! ' + allBest.length + ' equally good ways to lay down — pick one.');

    const btns = allBest.map((option) => {
      const labelText = option.groups.map(
        g => '[' + g.map(c => c.rank + c.suit).join(' ') + ']'
      ).join(' ');
      return makeBtn(
        labelText,
        'btn-laydown',
        () => {
          renderActionBar([]);
          state.phase = 'playing';
          finalize(option.groups);
        }
      );
    });

    renderActionBar(btns);
    return;
  }

  // Single optimal partition (or AI, or Móm, or empty hand) → just lay it
  // down automatically. No confirmation needed when there's no choice to
  // make — the picker UI only shows when there's an actual ambiguity to
  // resolve (handled above when allBest.length > 1).
  finalize(defaultGroups);
}

