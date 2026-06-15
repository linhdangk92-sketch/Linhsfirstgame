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
// Lobby holds the humans + their seats. Session 2 limitation: ONLY the
// host (seat 0) is treated as a real human for game logic. Guest humans
// keep their name on the seat pill but are AI-controlled (host's
// browser plays their turn). Session 3 will add real interactivity for
// guests (DOM rotation + action protocol via Firebase).
function buildMultiplayerPlayerCfg(lobbyPlayers) {
  const cfg = [null, null, null, null];
  const difficulties = ['easy', 'medium', 'hard'].sort(() => Math.random() - 0.5);
  let diffIdx = 0;

  // Place all joined players first (host stays human, guests become AI)
  Object.values(lobbyPlayers).forEach(p => {
    if (p.seat === 0) {
      cfg[0] = {
        name:       p.name,
        isHuman:    true,
        difficulty: null,
        zoneId:     'zone-0',
      };
    } else {
      // Guest human → AI-controlled with their nickname for now
      cfg[p.seat] = {
        name:       p.name,
        isHuman:    false,
        difficulty: difficulties[diffIdx % difficulties.length],
        zoneId:     'zone-' + p.seat,
      };
      diffIdx++;
    }
  });

  // Fill remaining empty seats with random AI from the name pool
  const emptyCount = cfg.filter(c => c === null).length;
  if (emptyCount > 0) {
    const aiNames = pickNames(emptyCount);
    let aiIdx = 0;
    for (let i = 0; i < 4; i++) {
      if (cfg[i] === null) {
        cfg[i] = {
          name:       aiNames[aiIdx],
          isHuman:    false,
          difficulty: difficulties[diffIdx % difficulties.length],
          zoneId:     'zone-' + i,
        };
        aiIdx++;
        diffIdx++;
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
