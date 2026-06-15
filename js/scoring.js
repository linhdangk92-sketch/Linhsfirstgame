// ═══════════════════════════════════════════════════════════════════
// SCORING — round-end ranking and cumulative score updates
// ═══════════════════════════════════════════════════════════════════

/* Placement points: index = finishing rank (0=1st, 1=2nd, 2=3rd, 3=last) */
const PLACE_POINTS = [6, -1, -2, -3];

/* Plain-language labels for the three Đền paths — used by the immediate
   center-screen Đền banner. T1/T2/T3 are kept as internal trigger codes;
   only these strings are shown to the player. */
const DEN_LABELS = {
  T1: 'Đền — Stolen Final & Opponent Ù',
  T2: 'Đền — Triple Steal Out',
  T3: 'Đền — Ù via Stolen Card',
};

/* Small ordinal helper for "1st Móm", "2nd Móm", … Only needs to handle 1–4
   since the game has 4 players. */
function ordinal(n) {
  if (n === 1) return '1st';
  if (n === 2) return '2nd';
  if (n === 3) return '3rd';
  return n + 'th';
}

/* B8: animated celebration overlay shown when a player declares Ù or Ù Khan.
   Regular Ù: peach/cream card, ~2.5s auto-fade. Ù Khan: bigger gold-gradient
   card with a pulsing glow and larger particle burst, ~4s. The overlay has
   pointer-events: none so the Next Round button underneath is clickable
   throughout the animation.
   customText — optional; when provided, overrides the default "X has Ù! / X has
   Ù KHAN!" text. Used by the end-of-game winner celebration which reuses these
   Ù Khan visuals but needs different wording. */
function showUCelebration(playerName, isKhan, customText = null) {
  const overlay = document.getElementById('u-celebration');
  if (!overlay) return;

  overlay.innerHTML = '';

  // Winner card
  const text = document.createElement('div');
  text.className = 'u-celeb-text' + (isKhan ? ' khan' : '');
  text.textContent = customText !== null
    ? customText
    : (playerName + (isKhan ? ' has Ù KHAN! 🏆' : ' has Ù! 🎉'));
  overlay.appendChild(text);

  // Emoji burst — Ù Khan gets more particles from a larger emoji set.
  const emojis = isKhan
    ? ['🎉', '🃏', '⭐', '🎊', '💫', '🏆', '👑', '✨']
    : ['🎉', '🃏', '🎊', '⭐'];
  const count = isKhan ? 30 : 16;

  for (let i = 0; i < count; i++) {
    const particle = document.createElement('span');
    particle.className = 'u-particle';
    particle.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    /* Distribute particles around the full circle with some jitter so the
       burst looks organic instead of perfectly radial. */
    const angle    = (i / count) * 2 * Math.PI + Math.random() * 0.5;
    const distance = 200 + Math.random() * 300;
    particle.style.setProperty('--dx', Math.cos(angle) * distance + 'px');
    particle.style.setProperty('--dy', Math.sin(angle) * distance + 'px');
    particle.style.animationDelay = (Math.random() * 0.3) + 's';
    overlay.appendChild(particle);
  }

  overlay.classList.add('show');

  const duration = isKhan ? 4000 : 2500;
  setTimeout(() => {
    overlay.classList.remove('show');
    /* Clear DOM nodes after the fade completes so they don't accumulate. */
    setTimeout(() => { overlay.innerHTML = ''; }, 400);
  }, duration);
}

/* Round-win celebration — tier 1 (small) of the celebration hierarchy.
   Used at normal round-end (lowest rác total wins). Shorter, less elaborate
   than the Ù overlay so it doesn't feel like an instant-win. */
function showRoundWinCelebration(playerName, roundNumber, points, isHuman) {
  const overlay = document.getElementById('u-celebration');
  if (!overlay) return;

  overlay.innerHTML = '';

  const text = document.createElement('div');
  text.className = 'u-celeb-text round';
  const label = isHuman ? 'You win' : playerName + ' wins';
  text.textContent = '🏆 ' + label + ' round ' + roundNumber + '! +' + points + ' pts';
  overlay.appendChild(text);

  const emojis = ['🏆', '🥇', '🎉', '⭐'];
  const count  = 8;
  for (let i = 0; i < count; i++) {
    const particle = document.createElement('span');
    particle.className = 'u-particle';
    particle.textContent = emojis[Math.floor(Math.random() * emojis.length)];
    const angle    = (i / count) * 2 * Math.PI + Math.random() * 0.5;
    const distance = 150 + Math.random() * 200;
    particle.style.setProperty('--dx', Math.cos(angle) * distance + 'px');
    particle.style.setProperty('--dy', Math.sin(angle) * distance + 'px');
    particle.style.animationDelay = (Math.random() * 0.3) + 's';
    overlay.appendChild(particle);
  }

  overlay.classList.add('show');

  setTimeout(() => {
    overlay.classList.remove('show');
    setTimeout(() => { overlay.innerHTML = ''; }, 400);
  }, 1800);
}

/* Declare Ù (or Ù Khan if isKhan=true) for playerIdx.
   Three scoring branches per the Đền rules:
   • T3 (state.pendingTrigger3 matches the winner): the stolen card itself
     completed the winner's Ù. Winner +15 − 5 = +10, victim 0, others −5.
   • T1 (state.denLiable.stealerIdx !== playerIdx): someone OTHER than the
     winner is on the Đền hook. Winner +15, Đền-payer −15, others 0.
   • Normal Ù: winner +15, everyone else −5.
   The flow: lay down winner's hand → compute per-player round scores → fire
   Đền banner + per-player payment toasts (if Đền) → Ù/Khan celebration →
   recap modal (deferred) → user clicks "Add to Scoreboard" → scoreboard
   visually updates and Next Round button appears. cumScore IS updated
   immediately so internal state stays consistent; only renderScores() is
   deferred to the recap dismissal. */
function declareU(playerIdx, isKhan = false) {
  state.phase = 'scoring';
  const label = isKhan ? 'Ù Khan' : 'Ù';
  const name  = PLAYER_CFG[playerIdx].name;

  // Lay down the winner's entire hand (all phỏm, zero rác)
  const { groups } = findBestPhoms(state.players[playerIdx].hand);
  lockInPhoms(playerIdx, groups);
  renderAll();

  const t3  = state.pendingTrigger3;
  const isT3 = t3 && t3.winnerIdx === playerIdx;
  const isT1 = !isT3 && state.denLiable && state.denLiable.stealerIdx !== playerIdx;

  // Compute per-player round score (this round's delta only) so the recap
  // can show one clean total per row and per-player payment toasts can fire.
  const roundScores = [0, 0, 0, 0];
  let denPayerIdx   = null; // for T1
  let denVictimIdx  = null; // for T3 or T1

  if (isT3) {
    // T3: winner +10 net, victim 0, others −5.
    roundScores[playerIdx]    = 10;
    roundScores[t3.victimIdx] = 0;
    denVictimIdx = t3.victimIdx;
    state.players.forEach((_, i) => {
      if (i !== playerIdx && i !== t3.victimIdx) roundScores[i] = -5;
    });
  } else if (isT1) {
    // T1: winner +15, Đền-payer −15, others 0.
    denPayerIdx  = state.denLiable.stealerIdx;
    denVictimIdx = state.denLiable.victimIdx;
    roundScores[playerIdx]    = 15;
    roundScores[denPayerIdx]  = -15;
    // Other 2 players stay at 0 (already initialised)
  } else {
    // Normal Ù: winner +15, others −5.
    roundScores[playerIdx] = 15;
    state.players.forEach((_, i) => { if (i !== playerIdx) roundScores[i] = -5; });
  }

  // Apply to state. cumScore + roundScore updated; renderScores is deferred.
  state.players.forEach((p, i) => {
    p.roundScore = roundScores[i];
    p.cumScore  += roundScores[i];
  });

  // Clean up Đền state so it doesn't leak into the next round / Ù path
  state.pendingTrigger3 = null;
  state.denLiable       = null;

  state.lastWinnerIdx = playerIdx;
  state.phase = 'scoring';
  // Multiplayer: publish Ù state so guests see the cumScore updates and
  // revealed hands sync. Recap modal stays host-only in Session 2.
  if (typeof publishGameStateAsync === 'function') publishGameStateAsync();

  setStatus(name + ' wins with ' + label + '!');

  // Immediate Đền announcement (only for T1/T3): center-screen banner with
  // short tag + plain-English reason. Normal Ù skips this — the celebration
  // overlay carries the moment on its own.
  if (isT3) {
    showDenToast(DEN_LABELS.T3,
      name + " Ù'd using " + PLAYER_CFG[denVictimIdx].name + "'s stolen final discard");
  } else if (isT1) {
    showDenToast(DEN_LABELS.T1,
      PLAYER_CFG[denPayerIdx].name + " stole " + PLAYER_CFG[denVictimIdx].name +
      "'s final discard, then " + name + " Ù'd");
  }

  // Per-player payment toasts on each affected zone (green for gain, red for
  // loss). Zero deltas are silently skipped by the helper.
  state.players.forEach((_, i) => showScoreChangeToast(i, roundScores[i]));

  // P4: ascending 3-note fanfare
  soundU();

  // B8: celebration overlay — distinct visuals for Ù vs Ù Khan.
  showUCelebration(name, isKhan);

  // Recap modal fires AFTER the celebration finishes fading. Khan is longer
  // (4s) than regular Ù (2.5s); +400ms buffer lets the Đền banner (2.5s)
  // and Ù card both settle out before the recap card pops in.
  const celebrationDur = isKhan ? 4000 : 2500;
  setTimeout(() => {
    const breakdown = state.players.map((p, i) => {
      /* The T3 victim ends at net 0 (their −5 Ù loss + 5 Đền refund). Show
         a "Đền refund −5+5" tag on their row so the 0 isn't ambiguous. */
      const isT3Victim = isT3 && t3 && i === t3.victimIdx;
      return {
        idx:    i,
        name:   PLAYER_CFG[i].name,
        total:  roundScores[i],
        isMom:  false, // Ù paths don't apply Móm penalty — skip the tag
        tag:    isT3Victim ? 'Đền refund −5+5' : null,
      };
    }).sort((a, b) => b.total - a.total);

    showRoundRecap(state.roundNumber, breakdown, () => {
      renderScores();
      const isLastRound = state.roundNumber >= TOTAL_ROUNDS;
      renderActionBar([makeBtn(
        isLastRound ? 'See Final Results' : 'Next Round →',
        'btn-laydown',
        () => { isLastRound ? showGameOver() : (state.roundNumber++, dealRound()); }
      )]);
    });
  }, celebrationDur + 400);
}

/* Đền Trigger 2 — the immediate-next-player has cumulatively stolen 3 of the
   victim's discards. Fires AFTER the stealer's normal post-steal flow
   (lay-down stolen phỏm + discard) so the sequence reads: steal → lay-down
   → discard → Ù reveal → Đền reveal. cumScore updated immediately;
   renderScores deferred to the recap "Add to Scoreboard" click.

   Visual sequence:
     t=0     Ù Khan celebration ("considered Ù via Triple Steal!")  ~4s
     t=4s    Đền banner + per-player payment toasts                 ~2.5s
     t=~7s   Recap modal */
function declareTriggerTwo(stealerIdx, victimIdx) {
  state.phase = 'scoring';

  const stealerName = PLAYER_CFG[stealerIdx].name;
  const victimName  = PLAYER_CFG[victimIdx].name;

  // T2 round-score deltas: stealer +15, victim −15, others 0
  const roundScores = [0, 0, 0, 0];
  roundScores[stealerIdx] = 15;
  roundScores[victimIdx]  = -15;

  state.players.forEach((p, i) => {
    p.roundScore = roundScores[i];
    p.cumScore  += roundScores[i];
  });

  // Clean up Đền state so a stale denLiable can't leak into the next round
  state.pendingTrigger3 = null;
  state.denLiable       = null;

  // Stealer (who "Ù'd") deals the next round
  state.lastWinnerIdx = stealerIdx;
  state.phase = 'scoring';
  // Multiplayer: publish T2 outcome (revealed hands + score deltas).
  if (typeof publishGameStateAsync === 'function') publishGameStateAsync();

  setStatus('⚡ Đền T2!  ' + stealerName + ' (considered Ù)');

  // P4: ascending 3-note fanfare for the T2 "considered Ù"
  soundU();

  // Stage 1 — Ù Khan celebration. Khan-style (gold/pulsing/30-particle).
  // Đền is NOT mentioned in this celebration text; it gets its own reveal
  // in stage 2 so the player can absorb each event clearly.
  showUCelebration(stealerName, true,
    stealerName + ' is considered Ù via Triple Steal! 🏆');

  // Stage 2 — after the ~4s Khan celebration fades, fire the Đền banner +
  // per-player payment toasts. This is the "now you see what they pay" beat.
  setTimeout(() => {
    showDenToast(DEN_LABELS.T2,
      stealerName + ' stole 3 of ' + victimName + "'s discards — counts as Ù");
    state.players.forEach((_, i) => showScoreChangeToast(i, roundScores[i]));
  }, 4000);

  // Stage 3 — after the ~2.5s Đền banner fades, show the recap modal.
  setTimeout(() => {
    const breakdown = state.players.map((p, i) => ({
      idx:    i,
      name:   PLAYER_CFG[i].name,
      total:  roundScores[i],
      isMom:  false, // T2 doesn't apply Móm penalty
    })).sort((a, b) => b.total - a.total);

    showRoundRecap(state.roundNumber, breakdown, () => {
      renderScores();
      const isLastRound = state.roundNumber >= TOTAL_ROUNDS;
      renderActionBar([makeBtn(
        isLastRound ? 'See Final Results' : 'Next Round →',
        'btn-laydown',
        () => { isLastRound ? showGameOver() : (state.roundNumber++, dealRound()); }
      )]);
    });
  }, 4000 + 2500 + 400);
}

/* Called when all players have laid down. Ranks players by rác total, applies
   placement points + Móm penalty, then shows a recap modal as the reveal
   step. cumScore is updated immediately (so state stays consistent) but
   renderScores() is deferred until the user clicks the "Add to Scoreboard"
   button on the recap — that's the visual "your score lands now" moment. */
function endRound() {
  state.phase = 'scoring';
  renderActionBar([]); // clear any lingering buttons from the round

  // Reveal all AI hands now that the round is over so players can see opponents' rác
  renderAll();

  // Cards still in hand after lay-down = rác (trash) = penalty points
  const results = state.players.map((p, i) => ({
    idx:          i,
    name:         PLAYER_CFG[i].name,
    racTotal:     p.hand.reduce((sum, c) => sum + RANK_VALUE[c.rank], 0),
    isMom:        p.isMom,
    lapClosedAt:  p.lapClosedAt,
  }));

  /* Sort: non-Móm players first (ranked by rác ascending); Móm players ALWAYS
     sink to the bottom regardless of rác count. Among Móm players, lap-close
     order breaks the tie — whoever lap-closed first is "1st Móm" and gets the
     less-bad placement; whoever closed later becomes "2nd Móm" (or 3rd, etc.)
     and ends up in the last-place slot. */
  results.sort((a, b) => {
    if (a.isMom !== b.isMom) return a.isMom ? 1 : -1;
    if (a.isMom)             return a.lapClosedAt - b.lapClosedAt;
    return a.racTotal - b.racTotal;
  });

  /* Tag each Móm player with their position WITHIN the Móm group (1, 2, …)
     so the summary and recap can show "1st Móm", "2nd Móm", etc. */
  let momIdx = 0;
  results.forEach(r => {
    if (r.isMom) {
      momIdx++;
      r.momPosition = momIdx;
    }
  });

  const winnerIdx = results[0].idx;
  const momCount  = results.filter(r => r.isMom).length;

  /* Compute the per-player round score INCLUDING all bonuses, so the recap
     can show one clean total per row. The winner picks up +4 per Móm player.
     Note: NO per-Ăn-Chốt scoring at round-end — all Ăn Chốt consequences are
     routed through Đền (declareU branches / declareTriggerTwo) which
     short-circuit endRound, so a round that reaches here had no Đền. */
  results.forEach((r, rank) => {
    let total = PLACE_POINTS[rank];
    if (r.isMom)             total -= 4;
    if (r.idx === winnerIdx) total += momCount * 4;
    r.total = total;
    // Apply to state immediately — renderScores is deferred to the modal click.
    state.players[r.idx].roundScore = total;
    state.players[r.idx].cumScore  += total;
  });

  state.lastWinnerIdx = winnerIdx;
  state.phase = 'scoring';
  // Multiplayer: publish so guests see round-end state (revealed hands,
  // updated cumScores). Their browsers won't show the recap modal in
  // Session 2 — that's a host-only UI.
  if (typeof publishGameStateAsync === 'function') publishGameStateAsync();

  // Status bar gets the textual summary (always visible behind the modal).
  // Móm players show "Nth Móm" (rác doesn't determine their position so
  // showing the number would be misleading); non-Móm players show their rác.
  const summary = results.map((r, rank) =>
    (rank + 1) + '. ' + r.name + ' — ' +
    (r.isMom ? ordinal(r.momPosition) + ' Móm' : r.racTotal + ' rác')
  ).join('  ·  ');
  setStatus('Round ' + state.roundNumber + ' over!  ' + summary);

  // Bright four-note arpeggio when a normal round-end win is revealed.
  // Lighter than soundU so it doesn't compete with the Ù fanfare.
  soundRoundWin();

  // The reveal: modal with the breakdown + "Add to Scoreboard" button.
  // Clicking the button calls renderScores (scoreboard finally updates) and
  // surfaces the Next Round button.
  showRoundRecap(state.roundNumber, results, () => {
    renderScores();

    const isLastRound = state.roundNumber >= TOTAL_ROUNDS;
    renderActionBar([makeBtn(
      isLastRound ? 'See Final Results' : 'Next Round →',
      'btn-laydown',
      () => {
        if (isLastRound) {
          showGameOver();
        } else {
          state.roundNumber++;
          dealRound();
        }
      }
    )]);
  });
}

/* Round-end recap modal — center-screen card listing each player's rác total,
   Móm tag, and round score change. The user must click "Add to Scoreboard"
   to dismiss; on dismiss, onContinue fires (which is where the scoreboard
   actually updates and the Next Round button appears). The 1st-place row
   gets a gold-highlighted border so the winner stands out. */
function showRoundRecap(roundNum, results, onContinue) {
  const overlay = document.createElement('div');
  overlay.className = 'recap-overlay';

  const card = document.createElement('div');
  card.className = 'recap-card';

  const title = document.createElement('div');
  title.className = 'recap-title';
  title.textContent = 'Round ' + roundNum + ' Results';
  card.appendChild(title);

  const list = document.createElement('div');
  list.className = 'recap-list';

  results.forEach((r, rank) => {
    const row = document.createElement('div');
    row.className = 'recap-row' + (rank === 0 ? ' winner' : '');

    const rankEl = document.createElement('span');
    rankEl.className = 'recap-rank';
    rankEl.textContent = (rank + 1) + '.';

    const nameEl = document.createElement('span');
    nameEl.className = 'recap-name';
    nameEl.textContent = r.name;

    const tagsEl = document.createElement('span');
    tagsEl.className = 'recap-tags';
    /* The tag column shows a row-specific note. The caller can set r.tag
       directly for custom text (e.g., "Đền refund −5+5" on the T3 victim
       row). If no custom tag, fall back to "Nth Móm" for Móm players. */
    let tagText = r.tag || '';
    if (!tagText && r.isMom) tagText = ordinal(r.momPosition) + ' Móm';
    tagsEl.textContent = tagText;

    const scoreEl = document.createElement('span');
    scoreEl.className = 'recap-score ' +
      (r.total > 0 ? 'positive' : (r.total < 0 ? 'negative' : ''));
    scoreEl.textContent = (r.total > 0 ? '+' : '') + r.total;

    row.appendChild(rankEl);
    row.appendChild(nameEl);
    row.appendChild(tagsEl);
    row.appendChild(scoreEl);

    list.appendChild(row);
  });
  card.appendChild(list);

  const btn = makeBtn('Add to Scoreboard', 'btn-laydown', () => {
    overlay.classList.remove('show');
    setTimeout(() => overlay.remove(), 300);
    onContinue();
  });
  btn.classList.add('recap-btn');
  card.appendChild(btn);

  overlay.appendChild(card);
  document.body.appendChild(overlay);

  /* Force layout before adding .show so the pop-in animation runs (without
     this the browser batches initial + .show styles and skips the transition). */
  void overlay.offsetWidth;
  overlay.classList.add('show');
}

/* Show the final game-over screen with cumulative scores and a Play Again button.
   The overall game winner gets the elaborate Ù Khan celebration overlay
   (biggest tier in the celebration hierarchy) since winning the whole game is
   the rarest, most-elevated event. Ties get a "tied for the win" variant. */
function showGameOver() {
  state.phase = 'gameover';

  const ranked = state.players
    .map((p, i) => ({ name: PLAYER_CFG[i].name, score: p.cumScore }))
    .sort((a, b) => b.score - a.score);

  const summary = ranked.map((p, i) =>
    (i + 1) + '. ' + p.name + ': ' + (p.score >= 0 ? '+' : '') + p.score
  ).join('  ·  ');

  setStatus('Game over!  Final scores — ' + summary);

  // Identify the winner(s) — multiple players can tie on cumulative score.
  const topScore = ranked[0].score;
  const winners  = ranked.filter(p => p.score === topScore);
  const winText  = winners.length === 1
    ? winners[0].name + ' WINS THE GAME! 🏆'
    : winners.map(w => w.name).join(' & ') + ' TIE FOR THE WIN! 🏆';
  // Grand five-note fanfare — the biggest sound for the biggest moment.
  soundGameWin();
  // isKhan=true → reuse the Ù Khan visuals (gold gradient, pulsing glow, 30-particle burst, 4s).
  showUCelebration(winners[0].name, true, winText);

  renderActionBar([makeBtn('Play Again', 'btn-laydown', () => {
    state.roundNumber = 1;
    state.players.forEach(p => { p.cumScore = 0; });
    dealRound();
  })]);
}
