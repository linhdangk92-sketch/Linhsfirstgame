// ═══════════════════════════════════════════════════════════════════
// SCORING — round-end ranking and cumulative score updates
// ═══════════════════════════════════════════════════════════════════

/* Placement points: index = finishing rank (0=1st, 1=2nd, 2=3rd, 3=last) */
const PLACE_POINTS = [6, -1, -2, -3];

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
   Awards +15 to the winner and −5 to every other player, then shows the round-end screen.
   The winner's hand is all phỏm — lay it all down so it's visible on the table. */
function declareU(playerIdx, isKhan = false) {
  state.phase = 'scoring';
  const label = isKhan ? 'Ù Khan' : 'Ù';

  // Lay down the winner's entire hand (all phỏm, zero rác)
  const { groups } = findBestPhoms(state.players[playerIdx].hand);
  lockInPhoms(playerIdx, groups);
  renderAll();

  // +15 for winner, −5 for everyone else
  state.players[playerIdx].cumScore += 15;
  state.players.forEach((p, i) => { if (i !== playerIdx) p.cumScore -= 5; });

  // Ù winner deals next round
  state.lastWinnerIdx = playerIdx;

  renderScores();

  const name = PLAYER_CFG[playerIdx].name;
  setStatus(name + ' wins with ' + label + '!  +15 pts · everyone else −5 pts.');

  // B8: celebration overlay — distinct visuals for Ù vs Ù Khan.
  showUCelebration(name, isKhan);

  const isLastRound = state.roundNumber >= TOTAL_ROUNDS;
  renderActionBar([makeBtn(
    isLastRound ? 'See Final Results' : 'Next Round →',
    'btn-laydown',
    () => { isLastRound ? showGameOver() : (state.roundNumber++, dealRound()); }
  )]);
}

/* Called when all players have laid down. Ranks players by rác total,
   applies placement points + Móm penalty, then shows results. */
function endRound() {
  state.phase = 'scoring';

  // Reveal all AI hands now that the round is over so players can see opponents' rác
  renderAll();

  // Cards still in hand after lay-down = rác (trash) = penalty points
  const results = state.players.map((p, i) => ({
    idx:      i,
    name:     PLAYER_CFG[i].name,
    racTotal: p.hand.reduce((sum, c) => sum + RANK_VALUE[c.rank], 0),
    isMom:    p.isMom,
  }));

  // Sort ascending by rác — lowest rác = 1st place
  results.sort((a, b) => a.racTotal - b.racTotal);

  // Apply placement points to cumulative scores
  results.forEach((r, rank) => {
    state.players[r.idx].roundScore = PLACE_POINTS[rank];
    state.players[r.idx].cumScore  += PLACE_POINTS[rank];
  });

  // Móm penalty: each Móm player loses 4 pts and pays them to the 1st-place winner
  const winner = results[0];
  results.forEach(r => {
    if (r.isMom) {
      state.players[r.idx].cumScore      -= 4;
      state.players[winner.idx].cumScore += 4;
    }
  });

  // 1st-place finisher deals the next round
  state.lastWinnerIdx = winner.idx;

  renderScores();

  // Build a summary line: "1. You — 3 rác  ·  2. Chaos — 11 rác (Móm)  · …"
  const summary = results.map((r, rank) =>
    (rank + 1) + '. ' + r.name + ' — ' + r.racTotal + ' rác' + (r.isMom ? ' (Móm)' : '')
  ).join('  ·  ');

  setStatus('Round ' + state.roundNumber + ' over!  ' + summary);

  // Round-win celebration overlay — tier 1 (smaller than Ù).
  // Total round points for the winner = placement (+6) + 4 per Móm player.
  const momCount     = results.filter(r => r.isMom).length;
  const winnerPoints = PLACE_POINTS[0] + momCount * 4;
  showRoundWinCelebration(winner.name, state.roundNumber, winnerPoints, winner.idx === 0);

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
  // isKhan=true → reuse the Ù Khan visuals (gold gradient, pulsing glow, 30-particle burst, 4s).
  showUCelebration(winners[0].name, true, winText);

  renderActionBar([makeBtn('Play Again', 'btn-laydown', () => {
    state.roundNumber = 1;
    state.players.forEach(p => { p.cumScore = 0; });
    dealRound();
  })]);
}
