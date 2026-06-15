// ═══════════════════════════════════════════════════════════════════
// MULTIPLAYER — Firebase-backed lobby + game-state sync
// ═══════════════════════════════════════════════════════════════════
// Session 1 scope: LOBBY ONLY. The host creates a room, friends join
// via the room code, everyone sees the live list of joined players,
// and the host can click "Start Game". Actual gameplay sync (turns,
// cards, discards, etc.) will be wired in the next session.
//
// Firebase Realtime Database paths used here:
//   /games/{roomCode}/
//     ├── host:       <playerId>    (who created the room)
//     ├── status:     'lobby' | 'playing' | 'ended'
//     ├── roundCount: <number>      (chosen by host when creating)
//     ├── createdAt:  <serverTimestamp>
//     └── players: {
//           <playerId>: { name, seat, joinedAt }
//         }

// ── Player identity ────────────────────────────────────────────
// One persistent ID per browser, stored in localStorage so refreshing
// the page doesn't kick you out of your seat. The timestamp + random
// suffix makes collisions effectively impossible across friends.
function getOrCreatePlayerId() {
  let id = localStorage.getItem('phomPlayerId');
  if (!id) {
    id = 'p_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('phomPlayerId', id);
  }
  return id;
}

// ── Room code generation ──────────────────────────────────────
// 6 characters from a confusable-character-free alphabet (no I/O/1/0
// to avoid "is that a one or an I?" mistakes when typing). 32^6 = ~1B
// combinations, so collisions are extremely rare for personal use.
function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// ── Module state ─────────────────────────────────────────────
let _mpRoomCode      = null;   // current room code, null if not in a game
let _mpPlayerId      = null;   // this browser's persistent ID
let _mpIsHost        = false;  // true if I created this room
let _mpPlayersListener  = null;  // Firebase listener handle for players
let _mpStatusListener   = null;  // Firebase listener handle for status

// ── Host flow: create a new game ─────────────────────────────
// Generates a room code, writes initial lobby state to Firebase, then
// opens the lobby modal. The host gets seat 0 by convention.
async function createGame(playerName, roundCount) {
  _mpPlayerId = getOrCreatePlayerId();
  _mpRoomCode = generateRoomCode();
  _mpIsHost   = true;

  console.log('[MP] createGame — room=' + _mpRoomCode + ' host=' + _mpPlayerId + ' name=' + playerName);

  const gameRef = _firebaseDB.ref('games/' + _mpRoomCode);
  try {
    await gameRef.set({
      host:       _mpPlayerId,
      status:     'lobby',
      roundCount: roundCount,
      createdAt:  firebase.database.ServerValue.TIMESTAMP,
      players: {
        [_mpPlayerId]: {
          name:     playerName,
          seat:     0,
          joinedAt: firebase.database.ServerValue.TIMESTAMP,
        }
      }
    });
    console.log('[MP] createGame — initial write OK');
  } catch (err) {
    console.error('[MP] createGame WRITE FAILED:', err);
    alert('Failed to create game: ' + err.message + '\n\nLikely Firebase rules are blocking writes. Check the database rules in Firebase console.');
    return;
  }

  openLobbyModal();
}

// ── Guest flow: join an existing game ────────────────────────
// Looks up the room, picks the next empty seat, writes the player to
// Firebase. Returns false if the room is missing, full, or already
// in progress — caller should show an error and let user try again.
async function joinGame(code, playerName) {
  _mpPlayerId = getOrCreatePlayerId();
  _mpRoomCode = code.toUpperCase();
  _mpIsHost   = false;

  console.log('[MP] joinGame — room=' + _mpRoomCode + ' guest=' + _mpPlayerId + ' name=' + playerName);

  const gameRef = _firebaseDB.ref('games/' + _mpRoomCode);
  let game;
  try {
    const snapshot = await gameRef.once('value');
    game = snapshot.val();
  } catch (err) {
    console.error('[MP] joinGame READ FAILED:', err);
    alert('Failed to read game: ' + err.message + '\n\nLikely Firebase rules are blocking reads.');
    return false;
  }

  console.log('[MP] joinGame — fetched game:', game);

  if (!game) {
    alert('Game not found! Check the code and try again.');
    return false;
  }
  if (game.status !== 'lobby') {
    alert('That game has already started — too late to join.');
    return false;
  }

  // Find the lowest-numbered empty seat (1-3 — host always has seat 0)
  const takenSeats = Object.values(game.players || {}).map(p => p.seat);
  let mySeat = -1;
  for (let i = 1; i < 4; i++) {
    if (!takenSeats.includes(i)) { mySeat = i; break; }
  }
  if (mySeat === -1) {
    alert('That lobby is full (4 humans max).');
    return false;
  }

  console.log('[MP] joinGame — claiming seat ' + mySeat);

  try {
    await gameRef.child('players/' + _mpPlayerId).set({
      name:     playerName,
      seat:     mySeat,
      joinedAt: firebase.database.ServerValue.TIMESTAMP,
    });
    console.log('[MP] joinGame — write OK, opening lobby');
  } catch (err) {
    console.error('[MP] joinGame WRITE FAILED:', err);
    alert('Failed to join game: ' + err.message);
    return false;
  }

  openLobbyModal();
  return true;
}

// ── Lobby modal ──────────────────────────────────────────────
// Renders the room code + live player list. Subscribes to Firebase
// listeners so the list updates in real time as people join or leave.
function openLobbyModal() {
  const modal = document.getElementById('lobby-modal');
  modal.classList.add('show');

  // Display the room code immediately so the host can share it
  document.getElementById('lobby-room-code').textContent = _mpRoomCode;

  // Subscribe to players list — re-renders whenever anyone joins/leaves
  const playersRef = _firebaseDB.ref('games/' + _mpRoomCode + '/players');
  console.log('[MP] openLobbyModal — attaching players listener at games/' + _mpRoomCode + '/players');
  _mpPlayersListener = playersRef.on('value', (snapshot) => {
    const val = snapshot.val() || {};
    console.log('[MP] players listener FIRED — players=', val);
    renderLobbyPlayers(val);
  }, (err) => {
    console.error('[MP] players listener ERROR:', err);
    alert('Lobby sync error: ' + err.message);
  });

  // Subscribe to status — when host sets it to 'playing', every client
  // (host + guests) runs transitionToMultiplayerGame: the host deals
  // and publishes initial state, guests subscribe and render.
  const statusRef = _firebaseDB.ref('games/' + _mpRoomCode + '/status');
  _mpStatusListener = statusRef.on('value', (snapshot) => {
    console.log('[MP] status listener FIRED — status=', snapshot.val());
    if (snapshot.val() === 'playing') {
      transitionToMultiplayerGame();
    }
  });

  // Only the host sees the Start button — guests just wait
  const startBtn = document.getElementById('lobby-start-btn');
  startBtn.style.display = _mpIsHost ? '' : 'none';
}

// Render the four seat rows. Each row shows either a joined player's
// name (with a "(you)" tag if it's me, and "(host)" tag if applicable)
// or a placeholder for an empty seat ("[ Empty — AI will fill ]").
function renderLobbyPlayers(players) {
  const listEl = document.getElementById('lobby-player-list');
  listEl.innerHTML = '';

  // Index players by their seat number for easy lookup
  const seatsByIdx = {};
  Object.entries(players).forEach(([pid, p]) => {
    seatsByIdx[p.seat] = { pid, ...p };
  });

  for (let seat = 0; seat < 4; seat++) {
    const row = document.createElement('div');
    row.className = 'lobby-seat';
    const player = seatsByIdx[seat];
    if (player) {
      const isMe = player.pid === _mpPlayerId;
      const isHost = seat === 0;
      const nameSpan = document.createElement('span');
      nameSpan.className = 'lobby-seat-name';
      nameSpan.textContent = '🎮 ' + player.name;
      row.appendChild(nameSpan);
      if (isHost) {
        const hostTag = document.createElement('span');
        hostTag.className = 'lobby-seat-tag host';
        hostTag.textContent = 'host';
        row.appendChild(hostTag);
      }
      if (isMe) {
        const youTag = document.createElement('span');
        youTag.className = 'lobby-seat-tag you';
        youTag.textContent = 'you';
        row.appendChild(youTag);
      }
    } else {
      row.classList.add('empty');
      const ph = document.createElement('span');
      ph.className = 'lobby-seat-name';
      ph.textContent = '🤖 Empty — will be AI';
      row.appendChild(ph);
    }
    listEl.appendChild(row);
  }
}

// ── Start game (host only) ──────────────────────────────────
// Writes the final PLAYER_CFG (humans from lobby + AI fill) FIRST,
// then flips the status to 'playing'. The order matters — guests need
// playerCfg available when they react to the status change, otherwise
// they'd race the host's write and get null.
async function startMultiplayerGame() {
  if (!_mpIsHost || !_mpRoomCode) return;
  try {
    const snap = await _firebaseDB.ref('games/' + _mpRoomCode).once('value');
    const lobby = snap.val();
    if (!lobby) {
      alert('Lobby data missing — cannot start.');
      return;
    }
    const cfg = buildMultiplayerPlayerCfg(lobby.players);
    console.log('[MP] startMultiplayerGame — built playerCfg:', cfg);
    await _firebaseDB.ref('games/' + _mpRoomCode + '/playerCfg').set(cfg);
    await _firebaseDB.ref('games/' + _mpRoomCode + '/status').set('playing');
  } catch (err) {
    console.error('[MP] startMultiplayerGame WRITE FAILED:', err);
    alert('Failed to start game: ' + err.message);
  }
}

// ═══════════════════════════════════════════════════════════════════
// SESSION 2 — game state sync
// ═══════════════════════════════════════════════════════════════════
// Architecture: "turn ownership" model
//   • Every browser holds a full copy of the game state, synced via
//     Firebase at /games/{code}/gameState.
//   • Whoever's turn it is drives that turn on their browser using the
//     existing local game logic (turns.js, laydown.js, etc.).
//   • For AI seats, the host's browser runs the AI.
//   • After any state mutation, the active browser calls
//     publishGameStateAsync() which writes the new state to Firebase.
//   • All other browsers subscribe and update + re-render on each push.
//
// State serialization: we explicitly list every field of `state` and
// every per-player field below. Firebase doesn't allow undefined values
// or NaN, so we normalize null/0 defaults on read-back.

// Multiplayer-game globals — read by turns.js, render.js, etc.
let IS_MULTIPLAYER_GAME = false;
let MY_ABSOLUTE_SEAT    = 0;       // my seat (0-3). In solo, always 0.
let _mpGameStateListener = null;
let _mpLastSeenTurn      = -1;     // tracks turn changes for the driver
let _mpPublishPending    = false;  // debounce flag for publishStateAsync

// ── Serialization ────────────────────────────────────────────
// Convert the live `state` object into a JSON-safe shape for Firebase.
function serializeGameState() {
  return {
    roundNumber:     state.roundNumber,
    currentTurn:     state.currentTurn,
    phase:           state.phase || 'playing',
    lastDiscard:     state.lastDiscard || null,
    starterIdx:      state.starterIdx,
    isLastLap:       !!state.isLastLap,
    denLiable:       state.denLiable || null,
    pendingTrigger3: state.pendingTrigger3 || null,
    pendingT2:       state.pendingT2 || null,
    lapCloseCounter: state.lapCloseCounter || 0,
    lastWinnerIdx:   state.lastWinnerIdx == null ? 0 : state.lastWinnerIdx,
    stealHappenedThisTurn: !!state.stealHappenedThisTurn,
    drawPile:        (state.drawPile || []).map(c => ({ rank: c.rank, suit: c.suit })),
    players: state.players.map(p => ({
      hand:         (p.hand || []).map(c => ({ rank: c.rank, suit: c.suit })),
      laidDown:     (p.laidDown || []).map(group => group.map(c => ({ rank: c.rank, suit: c.suit }))),
      discardPile:  (p.discardPile || []).map(c => ({ rank: c.rank, suit: c.suit })),
      discardCount: p.discardCount || 0,
      roundScore:   p.roundScore || 0,
      cumScore:     p.cumScore || 0,
      isMom:        !!p.isMom,
      hasLaidDown:  !!p.hasLaidDown,
      lapClosedAt:  p.lapClosedAt || 0,
      stolenStreak: p.stolenStreak || 0,
      firstTurn:    !!p.firstTurn,
    })),
  };
}

// Apply a Firebase-received state snapshot into the live `state`.
// Firebase converts empty arrays to null on read, so we coerce back.
function applyGameState(s) {
  if (!s) return;
  state.roundNumber     = s.roundNumber;
  state.currentTurn     = s.currentTurn;
  state.phase           = s.phase;
  state.lastDiscard     = s.lastDiscard || null;
  state.starterIdx      = s.starterIdx;
  state.isLastLap       = !!s.isLastLap;
  state.denLiable       = s.denLiable || null;
  state.pendingTrigger3 = s.pendingTrigger3 || null;
  state.pendingT2       = s.pendingT2 || null;
  state.lapCloseCounter = s.lapCloseCounter || 0;
  state.lastWinnerIdx   = s.lastWinnerIdx || 0;
  state.stealHappenedThisTurn = !!s.stealHappenedThisTurn;
  state.drawPile        = s.drawPile || [];
  (s.players || []).forEach((sp, i) => {
    const p = state.players[i];
    if (!p || !sp) return;
    p.hand         = sp.hand        || [];
    // laidDown is an array of arrays — handle the case where Firebase
    // stored it as an object with numeric keys (happens for sparse arrays).
    p.laidDown     = Array.isArray(sp.laidDown) ? sp.laidDown : Object.values(sp.laidDown || {});
    p.discardPile  = sp.discardPile || [];
    p.discardCount = sp.discardCount || 0;
    p.roundScore   = sp.roundScore || 0;
    p.cumScore     = sp.cumScore || 0;
    p.isMom        = !!sp.isMom;
    p.hasLaidDown  = !!sp.hasLaidDown;
    p.lapClosedAt  = sp.lapClosedAt || 0;
    p.stolenStreak = sp.stolenStreak || 0;
    p.firstTurn    = !!sp.firstTurn;
  });
}

// ── Publishing (debounced) ───────────────────────────────────
// Many places in the game logic mutate state synchronously then call
// each other (e.g. performDiscard → afterDiscard → advanceTurn). We
// only want to publish ONCE per microtick batch — otherwise we'd spam
// Firebase with intermediate snapshots that other clients also have
// to process. queueMicrotask defers the write until the call stack
// unwinds, so all synchronous mutations land in one publish.
function publishGameStateAsync() {
  if (!IS_MULTIPLAYER_GAME || !_mpRoomCode) return;
  if (_mpPublishPending) return;
  _mpPublishPending = true;
  queueMicrotask(() => {
    _mpPublishPending = false;
    const s = serializeGameState();
    _firebaseDB.ref('games/' + _mpRoomCode + '/gameState').set(s).catch(err => {
      console.error('[MP] publishGameState FAILED:', err);
    });
  });
}

// ── Subscribing (all clients) ────────────────────────────────
// On every Firebase state update: apply, render, then ask the driver
// whether the local browser should run startTurn for the active player.
// The driver gate prevents non-active browsers from executing turn
// logic (they just spectate the rendered state).
function subscribeToGameState() {
  if (!_mpRoomCode) return;
  const ref = _firebaseDB.ref('games/' + _mpRoomCode + '/gameState');
  _mpGameStateListener = ref.on('value', (snapshot) => {
    const s = snapshot.val();
    if (!s) return;
    console.log('[MP] gameState update — currentTurn=' + s.currentTurn + ' phase=' + s.phase);
    applyGameState(s);
    renderAll();
    // Only fire the turn driver when currentTurn actually changes,
    // so within-turn mid-step publishes don't re-trigger startTurn.
    if (state.currentTurn !== _mpLastSeenTurn) {
      _mpLastSeenTurn = state.currentTurn;
      // Small delay so render lands before any interactive UI appears
      setTimeout(driveTurn, 50);
    }
  });
}

// Decide whether THIS browser should drive the current turn.
// - Human seat → only the local player drives
// - AI seat   → only the host drives
function driveTurn() {
  if (!IS_MULTIPLAYER_GAME) return;
  const cfg = PLAYER_CFG[state.currentTurn];
  if (!cfg) return;
  if (cfg.isHuman) {
    if (state.currentTurn === MY_ABSOLUTE_SEAT) {
      startTurn();
    }
  } else if (_mpIsHost) {
    startTurn();
  }
}

// ── Build PLAYER_CFG from lobby ──────────────────────────────
// Lobby holds the humans + their seats. Each human stays isHuman:true
// so their turn waits for their own browser to act (via the startTurn
// gate + driveTurn). Empty seats are filled with AI bots controlled
// by the host's browser.
function buildMultiplayerPlayerCfg(lobbyPlayers) {
  const cfg = [null, null, null, null];
  Object.values(lobbyPlayers).forEach(p => {
    cfg[p.seat] = {
      name:       p.name,
      isHuman:    true,
      difficulty: null,
      zoneId:     'zone-' + p.seat,
    };
  });
  const emptyCount = cfg.filter(c => c === null).length;
  if (emptyCount > 0) {
    const aiNames = pickNames(emptyCount);
    const difficulties = ['easy', 'medium', 'hard'].sort(() => Math.random() - 0.5);
    let aiIdx = 0;
    for (let i = 0; i < 4; i++) {
      if (cfg[i] === null) {
        cfg[i] = {
          name:       aiNames[aiIdx],
          isHuman:    false,
          difficulty: difficulties[aiIdx % difficulties.length],
          zoneId:     'zone-' + i,
        };
        aiIdx++;
      }
    }
  }
  return cfg;
}

// ── Game start transition ────────────────────────────────────
// Fires on every client (host + guests) when the host flips status to
// 'playing'. By this point the host has already written PLAYER_CFG to
// Firebase (in startMultiplayerGame), so we just read everything and
// proceed. Both host and guest subscribe to state; only the host calls
// dealRound (which publishes the initial dealt state — guests receive
// it through the subscription).
async function transitionToMultiplayerGame() {
  console.log('[MP] transitionToMultiplayerGame — isHost=' + _mpIsHost);
  IS_MULTIPLAYER_GAME = true;

  const snap = await _firebaseDB.ref('games/' + _mpRoomCode).once('value');
  const data = snap.val();
  if (!data || !data.playerCfg) {
    console.error('[MP] transition aborted — game or playerCfg missing');
    return;
  }

  TOTAL_ROUNDS = data.roundCount || 4;
  PLAYER_CFG   = data.playerCfg;

  const myLobby = (data.players || {})[_mpPlayerId];
  MY_ABSOLUTE_SEAT = myLobby ? myLobby.seat : 0;
  console.log('[MP] my seat is ' + MY_ABSOLUTE_SEAT);

  applyPlayerCfgToDom();
  setupLocalView();          // rotate DOM so I'm at the bottom
  closeLobbyModal();
  subscribeToGameState();

  if (_mpIsHost) {
    dealRound();
  }
}

// Push PLAYER_CFG names + avatars into the existing DOM elements
// (pname-0, avatar-0, etc.). dealRound normally does this for round 1
// in solo mode, but in multi we need it set BEFORE the deal so the
// UI is correct from the first render.
function applyPlayerCfgToDom() {
  [0, 1, 2, 3].forEach(i => {
    const nameEl   = document.getElementById('pname-'  + i);
    const avatarEl = document.getElementById('avatar-' + i);
    if (nameEl)   nameEl.textContent   = PLAYER_CFG[i].name;
    if (avatarEl) {
      avatarEl.textContent = PLAYER_CFG[i].isHuman
        ? '🎮'
        : (AVATAR_MAP[PLAYER_CFG[i].name] || '🃏');
    }
  });
}

// ── DOM rotation — put MY zone at the bottom ─────────────────
// At multiplayer game start, do one-time DOM surgery so the local
// player always sees themselves at the bottom of the table with full
// controls (action bar, sort toolbar, draggable hand, discard zone).
//
// What changes:
//   1. dp-1 + phoms-1 (and dp-3 + phoms-3) move out of #center's side
//      panels and into their respective zone divs as inline dp-phoms-row.
//      All 4 zones now have a uniform structure: player-info, hand-N,
//      and dp-phoms-row inline.
//   2. The bottom-only elements (#action-bar, .hand-toolbar, #discard-zone)
//      move from zone-0 into zone-MY_ABSOLUTE_SEAT.
//   3. The "sm-hand" class is swapped: removed from hand-MY, added to
//      hand-0 (so the local player's hand renders full-size and the
//      original host slot becomes a regular opponent slot).
//   4. Zone CSS classes (bottom / left / top / right) are reassigned
//      based on each seat's local position relative to MY_ABSOLUTE_SEAT.
//      The existing grid-area CSS positions zones based on these classes.
//
// All element IDs (hand-N, dp-N, phoms-N) STAY tied to their absolute
// seat — render code that does document.getElementById('hand-1') still
// works, the element has just been re-parented into a different zone.
function setupLocalView() {
  const center = document.getElementById('center');

  // Helper to build either an inline dp-phoms-row (for top/bottom zones)
  // or a center side-panel (for left/right zones). The internal structure
  // is the same (discard-section + phom-section); only the wrapper class
  // and flex direction differ.
  function buildDpPhomsContainer(dp, phoms, wrapperClass, isSideWithPhomsClass) {
    const wrap = document.createElement('div');
    wrap.className = wrapperClass;

    const dSec = document.createElement('div');
    dSec.className = 'panel-section discard-section';
    const dLab = document.createElement('div');
    dLab.className = 'section-label';
    dLab.textContent = 'Discards';
    dSec.appendChild(dLab);
    dSec.appendChild(dp);

    const pSec = document.createElement('div');
    pSec.className = 'panel-section phom-section';
    const pLab = document.createElement('div');
    pLab.className = 'section-label';
    pLab.textContent = 'Phỏm';
    pSec.appendChild(pLab);
    if (isSideWithPhomsClass) phoms.classList.add('side-phoms');
    else                      phoms.classList.remove('side-phoms');
    pSec.appendChild(phoms);

    wrap.appendChild(dSec);
    wrap.appendChild(pSec);
    return wrap;
  }

  // 1. Save references to every dp + phoms BEFORE detaching them.
  //    Once we remove them from the DOM, getElementById would return
  //    null on the subsequent loop and we'd silently skip every seat.
  const dpEls    = {};
  const phomsEls = {};
  for (let abs = 0; abs < 4; abs++) {
    dpEls[abs]    = document.getElementById('dp-'    + abs);
    phomsEls[abs] = document.getElementById('phoms-' + abs);
  }

  // 2. Detach every dp + phoms from their current parents so we can
  //    re-place each in its correct container.
  for (let abs = 0; abs < 4; abs++) {
    const dp    = dpEls[abs];
    const phoms = phomsEls[abs];
    if (dp    && dp.parentNode)    dp.parentNode.removeChild(dp);
    if (phoms && phoms.parentNode) phoms.parentNode.removeChild(phoms);
  }
  // Wipe the empty dp-phoms-row + side-panel wrappers so we can rebuild
  // cleanly without leftover empty containers.
  document.querySelectorAll('.dp-phoms-row').forEach(r => r.remove());
  document.querySelectorAll('#center .side-panel').forEach(p => p.remove());

  // 3. Place each dp + phoms based on its LOCAL position.
  //    Local 0 (bottom) and 2 (top): inline dp-phoms-row inside the zone.
  //    Local 1 (left) and 3 (right): #center side-panel.
  //    This mirrors the original solo layout exactly — keeps left/right
  //    zones narrow so the grid rows don't overflow.
  const pile = center.querySelector('.pile-wrap');
  for (let abs = 0; abs < 4; abs++) {
    const local = (abs - MY_ABSOLUTE_SEAT + 4) % 4;
    const dp    = dpEls[abs];
    const phoms = phomsEls[abs];
    if (!dp || !phoms) continue;

    if (local === 0 || local === 2) {
      // Inline in the zone (bottom or top)
      const zone = document.getElementById('zone-' + abs);
      if (zone) {
        const row = buildDpPhomsContainer(dp, phoms, 'dp-phoms-row', false);
        zone.appendChild(row);
      }
    } else {
      // Side panel in #center (left or right)
      const panel = buildDpPhomsContainer(dp, phoms, 'side-panel', true);
      if (local === 1) {
        // local-left → left side of center (before pile)
        if (pile) center.insertBefore(panel, pile);
        else      center.appendChild(panel);
      } else {
        // local-right → right side of center (after pile)
        center.appendChild(panel);
      }
    }
  }

  // 2. Rebuild each zone's child order based on whether it's the local
  //    bottom (has full controls) or a non-bottom (just player-info,
  //    hand, dp-phoms-row). appendChild moves existing nodes — event
  //    listeners survive.
  const actionBar   = document.getElementById('action-bar');
  const handToolbar = document.querySelector('.hand-toolbar');
  const discardZone = document.getElementById('discard-zone');

  for (let abs = 0; abs < 4; abs++) {
    const zone = document.getElementById('zone-' + abs);
    if (!zone) continue;
    const playerInfo = zone.querySelector('.player-info');
    const hand       = document.getElementById('hand-' + abs);
    const dpPhomsRow = zone.querySelector('.dp-phoms-row');
    const isBottom = (abs === MY_ABSOLUTE_SEAT);

    // Re-append in desired order. Each appendChild moves the node to
    // the end of `zone`. Order = original zone-0 (bottom) layout for
    // local-bottom, or the non-bottom layout for everything else.
    if (isBottom) {
      if (actionBar)   zone.appendChild(actionBar);
      if (dpPhomsRow)  zone.appendChild(dpPhomsRow);
      if (handToolbar) zone.appendChild(handToolbar);
      if (hand)        zone.appendChild(hand);
      if (discardZone) zone.appendChild(discardZone);
      if (playerInfo)  zone.appendChild(playerInfo);
    } else {
      if (playerInfo)  zone.appendChild(playerInfo);
      if (hand)        zone.appendChild(hand);
      if (dpPhomsRow)  zone.appendChild(dpPhomsRow);
    }
  }

  // 3. Swap the sm-hand class so MY hand renders full-size and the old
  //    zone-0 hand becomes small (face-down).
  if (MY_ABSOLUTE_SEAT !== 0) {
    const myHand    = document.getElementById('hand-' + MY_ABSOLUTE_SEAT);
    const seat0Hand = document.getElementById('hand-0');
    if (myHand)    myHand.classList.remove('sm-hand');
    if (seat0Hand) seat0Hand.classList.add('sm-hand');
  }

  // 4. Assign zone position classes (bottom / left / top / right) based
  //    on each absolute seat's local position relative to me.
  const posByLocal = ['bottom', 'left', 'top', 'right'];
  for (let abs = 0; abs < 4; abs++) {
    const local = (abs - MY_ABSOLUTE_SEAT + 4) % 4;
    const zone = document.getElementById('zone-' + abs);
    if (!zone) continue;
    zone.classList.remove('bottom', 'left', 'top', 'right');
    zone.classList.add(posByLocal[local]);
  }
}

// ── Leave the lobby ─────────────────────────────────────────
// Removes this player from the room. If the host leaves, the entire
// game record is deleted so guests don't get stranded in a zombie
// lobby (they'll see the player list empty out and can leave too).
async function leaveLobby() {
  if (!_mpRoomCode || !_mpPlayerId) return;

  if (_mpIsHost) {
    // Host quitting wipes the whole room
    const gameRef = _firebaseDB.ref('games/' + _mpRoomCode);
    await gameRef.remove();
  } else {
    // Guest quitting just removes their own player entry
    const myRef = _firebaseDB.ref('games/' + _mpRoomCode + '/players/' + _mpPlayerId);
    await myRef.remove();
  }

  closeLobbyModal();
  // Reload the page so the user is back at the fresh start overlay
  window.location.reload();
}

// ── Close + cleanup ─────────────────────────────────────────
function closeLobbyModal() {
  const modal = document.getElementById('lobby-modal');
  modal.classList.remove('show');

  // Detach Firebase listeners to avoid leaks + duplicate firings
  if (_mpRoomCode) {
    if (_mpPlayersListener) {
      _firebaseDB.ref('games/' + _mpRoomCode + '/players').off('value', _mpPlayersListener);
      _mpPlayersListener = null;
    }
    if (_mpStatusListener) {
      _firebaseDB.ref('games/' + _mpRoomCode + '/status').off('value', _mpStatusListener);
      _mpStatusListener = null;
    }
  }
}

// ── Copy room code to clipboard ────────────────────────────
// Convenience for the host so they can paste the code into chat
// instead of reading it out loud.
function copyRoomCodeToClipboard() {
  if (!_mpRoomCode) return;
  navigator.clipboard.writeText(_mpRoomCode).then(() => {
    const btn = document.getElementById('lobby-copy-btn');
    const orig = btn.textContent;
    btn.textContent = '✓ Copied!';
    setTimeout(() => { btn.textContent = orig; }, 1500);
  }).catch(() => {
    // Clipboard API can fail on http:// or older browsers — fall back
    // to a textarea + execCommand which works almost everywhere.
    const tmp = document.createElement('textarea');
    tmp.value = _mpRoomCode;
    document.body.appendChild(tmp);
    tmp.select();
    document.execCommand('copy');
    tmp.remove();
  });
}

// ── Wire lobby modal buttons ──────────────────────────────
const _lobbyCopyBtn  = document.getElementById('lobby-copy-btn');
const _lobbyStartBtn = document.getElementById('lobby-start-btn');
const _lobbyLeaveBtn = document.getElementById('lobby-leave-btn');
if (_lobbyCopyBtn)  _lobbyCopyBtn.addEventListener('click',  copyRoomCodeToClipboard);
if (_lobbyStartBtn) _lobbyStartBtn.addEventListener('click', startMultiplayerGame);
if (_lobbyLeaveBtn) _lobbyLeaveBtn.addEventListener('click', leaveLobby);
