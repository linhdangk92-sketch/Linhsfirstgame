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

  // Subscribe to status — when host sets it to 'playing', show a
  // "coming soon" placeholder inside the lobby (Session 2 will wire the
  // actual synced game start; for now we keep the lobby visible so the
  // empty game table underneath isn't exposed).
  const statusRef = _firebaseDB.ref('games/' + _mpRoomCode + '/status');
  _mpStatusListener = statusRef.on('value', (snapshot) => {
    console.log('[MP] status listener FIRED — status=', snapshot.val());
    if (snapshot.val() === 'playing') {
      showLobbyComingSoonMessage();
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
// Flips the status to 'playing' in Firebase. The status listener on
// every connected client triggers showLobbyComingSoonMessage() which
// replaces the lobby content with a placeholder (Session 2 will swap
// this for the actual synced game start).
async function startMultiplayerGame() {
  if (!_mpIsHost || !_mpRoomCode) return;
  const statusRef = _firebaseDB.ref('games/' + _mpRoomCode + '/status');
  try {
    await statusRef.set('playing');
  } catch (err) {
    console.error('[MP] startMultiplayerGame WRITE FAILED:', err);
    alert('Failed to start game: ' + err.message);
  }
}

// ── Placeholder shown when status flips to 'playing' ──────────
// Replaces the lobby card content with a "coming soon" message instead
// of closing the modal — closing would expose the empty game table
// underneath. Once Session 2 wires real gameplay sync, this is replaced
// by actually dealing cards and showing the synced game.
function showLobbyComingSoonMessage() {
  const card = document.querySelector('.lobby-card');
  if (!card) return;
  card.innerHTML = '';

  const title = document.createElement('h2');
  title.className = 'lobby-title';
  title.textContent = 'Game starting!';
  card.appendChild(title);

  const msg = document.createElement('div');
  msg.style.cssText = 'text-align:center; padding: 18px 0; color: #1A4731;';
  msg.innerHTML =
    '<p style="font-size:1rem; margin: 0 0 10px;">🚧 Multiplayer gameplay sync isn\'t wired up yet.</p>' +
    '<p style="font-size:0.85rem; color:rgba(26,71,49,0.65); margin: 0 0 18px;">Coming in the next session! For now, refresh the page to play again.</p>';
  card.appendChild(msg);

  const btnRow = document.createElement('div');
  btnRow.className = 'lobby-buttons';
  const refreshBtn = document.createElement('button');
  refreshBtn.className = 'lobby-btn start';
  refreshBtn.type = 'button';
  refreshBtn.textContent = 'Refresh';
  refreshBtn.addEventListener('click', () => window.location.reload());
  btnRow.appendChild(refreshBtn);
  card.appendChild(btnRow);
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
