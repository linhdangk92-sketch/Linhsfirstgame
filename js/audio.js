// ═══════════════════════════════════════════════════════════════════
// AUDIO — Web Audio API synthesis for game sound effects (P4)
// ═══════════════════════════════════════════════════════════════════
// Self-contained: no external sound files, just synth via OscillatorNode
// and filtered noise via BufferSourceNode. Browsers block audio until a
// user gesture — the AudioContext stays suspended on page load and gets
// resumed inside ensureAudioContext() (called from every sound trigger).

let _audioCtx   = null;
let _audioMuted = false;

/* Lazily create + resume the AudioContext. Returns null on browsers that
   don't support Web Audio (very rare in 2026). */
function ensureAudioContext() {
  if (!_audioCtx) {
    try {
      _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) { return null; }
  }
  if (_audioCtx.state === 'suspended') {
    _audioCtx.resume().catch(() => {});
  }
  return _audioCtx;
}

function setAudioMuted(muted) { _audioMuted = muted; }
function isAudioMuted()       { return _audioMuted; }

/* Play a tone with optional pitch glide. */
function playTone(freq, duration, options = {}) {
  if (_audioMuted) return;
  const ctx = ensureAudioContext();
  if (!ctx) return;

  const vol  = options.volume !== undefined ? options.volume : 0.12;
  const type = options.type   || 'sine';
  const now  = ctx.currentTime;

  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);
  if (options.freqEnd !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(options.freqEnd, now + duration);
  }

  /* ADSR-ish envelope — quick attack, exponential decay so notes don't click. */
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(vol, now + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + duration + 0.02);
}

/* Play filtered white noise — used for shuffle and card-flick effects. */
function playNoise(duration, options = {}) {
  if (_audioMuted) return;
  const ctx = ensureAudioContext();
  if (!ctx) return;

  const vol        = options.volume     !== undefined ? options.volume     : 0.08;
  const filterFreq = options.filterFreq || 1800;
  const now        = ctx.currentTime;

  const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data   = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

  const source = ctx.createBufferSource();
  source.buffer = buffer;

  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = filterFreq;
  filter.Q.value = 1.5;

  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(vol, now + 0.004);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  source.connect(filter);
  filter.connect(gain);
  gain.connect(ctx.destination);

  source.start(now);
}

/* ── Game sound effects ─────────────────────────────────────────── */

/* Shuffle — three quick hisses, like riffling a deck. Volume bumped from
   the original 0.04-0.06 so the effect actually registers. */
function soundShuffle() {
  playNoise(0.20, { volume: 0.14, filterFreq: 3200 });
  setTimeout(() => playNoise(0.22, { volume: 0.12, filterFreq: 2400 }), 130);
  setTimeout(() => playNoise(0.20, { volume: 0.11, filterFreq: 2800 }), 290);
}

/* Deal — single thud per card landing. Called from animateDeal once per
   card so the rapid stagger sounds like rapid dealing. Volume bumped from
   0.05 so each tick is clearly audible. */
function soundDeal() {
  playNoise(0.05, { volume: 0.11, filterFreq: 1200 });
}

/* Discard — two-tone downward "drop", evoking a card flipping onto a pile. */
function soundDiscard() {
  playTone(420, 0.10, { volume: 0.10, type: 'triangle' });
  setTimeout(() => playTone(280, 0.12, { volume: 0.08, type: 'triangle' }), 55);
}

/* Steal — rising sawtooth sweep, sneaky "swipe" feel. */
function soundSteal() {
  playTone(520, 0.20, { volume: 0.10, type: 'sawtooth', freqEnd: 880 });
}

/* Ù fanfare — three ascending triangle-wave notes (C5 → E5 → G5). */
function soundU() {
  playTone(523, 0.16, { volume: 0.12, type: 'triangle' });
  setTimeout(() => playTone(659, 0.16, { volume: 0.12, type: 'triangle' }), 120);
  setTimeout(() => playTone(784, 0.35, { volume: 0.14, type: 'triangle' }), 240);
}

/* Móm — three descending sawtooth tones with a downward glide on each note,
   evoking the classic "wah-wah-waaaah" failure trumpet. Played when a player
   ends the round with zero phỏm laid down (Móm penalty). */
function soundMom() {
  playTone(330, 0.18, { volume: 0.10, type: 'sawtooth', freqEnd: 260 });
  setTimeout(() => playTone(260, 0.20, { volume: 0.10, type: 'sawtooth', freqEnd: 210 }), 200);
  setTimeout(() => playTone(210, 0.45, { volume: 0.12, type: 'sawtooth', freqEnd: 150 }), 430);
}

/* Round-win — bright four-note triangle arpeggio (C5 → E5 → G5 → C6).
   Lighter and shorter than soundU so a normal round-end win feels celebratory
   but clearly less momentous than a full Ù. */
function soundRoundWin() {
  playTone(523, 0.12, { volume: 0.11, type: 'triangle' });
  setTimeout(() => playTone(659, 0.12, { volume: 0.11, type: 'triangle' }), 90);
  setTimeout(() => playTone(784, 0.12, { volume: 0.12, type: 'triangle' }), 180);
  setTimeout(() => playTone(1046, 0.30, { volume: 0.13, type: 'triangle' }), 270);
}

/* Game-win — grand five-note ascending fanfare (C5 → E5 → G5 → C6 → E6)
   ending on a long sustained top note. Reserved for the final overall game
   winner; longer and louder than soundRoundWin to feel like the biggest tier. */
function soundGameWin() {
  playTone(523, 0.14, { volume: 0.12, type: 'triangle' });
  setTimeout(() => playTone(659, 0.14, { volume: 0.12, type: 'triangle' }), 110);
  setTimeout(() => playTone(784, 0.14, { volume: 0.13, type: 'triangle' }), 220);
  setTimeout(() => playTone(1046, 0.16, { volume: 0.14, type: 'triangle' }), 330);
  setTimeout(() => playTone(1318, 0.65, { volume: 0.16, type: 'triangle' }), 470);
}

/* ── Background music (Mario-style chiptune) ────────────────────
   A bouncy 4-bar loop (~6.4s) in C major at 144 BPM. Two voices:
     • Melody — square-wave eighth notes doing arpeggios + scale runs
     • Bass   — square-wave half notes alternating root and fifth
   Square waves give the classic NES timbre; the staccato envelope on
   each note (5ms attack, sustain for 75% of the duration, 20% release)
   creates the punchy "chip" articulation. Master gain is intentionally
   low (~4%) so the loop sits gently underneath the SFX layer.
   All synthesized in the browser via Web Audio API — no external files. */

let _musicActive = false;  // true while the note-scheduling loop is running
let _musicMuted  = false;  // user-controlled — gates startMusic()
let _musicTimer  = null;   // setTimeout handle for the next loop iteration
let _musicGain   = null;   // master GainNode for all music (separate from SFX)

const MUSIC_MASTER_GAIN = 0.04;
const MELODY_VOLUME     = 0.13;
const BASS_VOLUME       = 0.10;

// Note durations at 144 BPM (one beat = 60/144 ≈ 0.417s)
const N8 = 0.20;  // eighth note
const N4 = 0.40;  // quarter note
const N2 = 0.80;  // half note

/* Melody — 4 bars of bouncy C-major movement. Each entry is
   [frequencyHz, durationSec]; frequency 0 is a rest. Total length per
   bar = 1.6s (= 8 × N8) so the loop is exactly 6.4s. */
const MARIO_MELODY = [
  // Bar 1 — C-major arpeggio up and back down
  [523.25, N8], [659.25, N8], [783.99, N8], [1046.50, N8],
  [987.77, N8], [783.99, N8], [659.25, N8], [523.25, N8],
  // Bar 2 — stepwise climb to high C, then a beat of rest
  [440.00, N8], [523.25, N8], [659.25, N8], [783.99, N8],
  [880.00, N8], [1046.50, N4], [0, N8],
  // Bar 3 — descending C-major scale
  [987.77, N8], [880.00, N8], [783.99, N8], [698.46, N8],
  [659.25, N8], [587.33, N8], [523.25, N8], [493.88, N8],
  // Bar 4 — resolve back to tonic with a held cadence
  [587.33, N8], [659.25, N8], [783.99, N4],
  [659.25, N4], [523.25, N4],
];

/* Bass — root and fifth alternating, two half notes per bar. */
const MARIO_BASS = [
  [130.81, N2], [196.00, N2],  // Bar 1: C3 → G3
  [174.61, N2], [261.63, N2],  // Bar 2: F3 → C4
  [196.00, N2], [293.66, N2],  // Bar 3: G3 → D4
  [130.81, N2], [196.00, N2],  // Bar 4: C3 → G3
];

/* Start the music loop. No-op if already playing or if the user has
   muted music. Creates the master gain node lazily on first call. */
function startMusic() {
  if (_musicActive || _musicMuted) return;
  const ctx = ensureAudioContext();
  if (!ctx) return;

  _musicActive = true;

  if (!_musicGain) {
    _musicGain = ctx.createGain();
    _musicGain.gain.value = MUSIC_MASTER_GAIN;
    _musicGain.connect(ctx.destination);
  }

  scheduleLoop(ctx.currentTime);
}

/* Schedule one full pass of the melody + bass arrays, then setTimeout
   the next pass to fire ~50ms before this one ends. Using Web Audio's
   precise startTime for each note keeps the rhythm locked instead of
   drifting (which it would if each note used its own setTimeout). */
function scheduleLoop(startTime) {
  if (!_musicActive || _musicMuted) return;
  const ctx = ensureAudioContext();
  if (!ctx) return;

  // Melody voice — accumulator advances per note (rests advance time
  // but don't schedule an oscillator).
  let mt = startTime;
  MARIO_MELODY.forEach(([freq, dur]) => {
    if (freq > 0) playSquareNote(freq, mt, dur, MELODY_VOLUME);
    mt += dur;
  });

  // Bass voice — independent timeline, same start time so they sync
  let bt = startTime;
  MARIO_BASS.forEach(([freq, dur]) => {
    if (freq > 0) playSquareNote(freq, bt, dur, BASS_VOLUME);
    bt += dur;
  });

  const loopEnd = Math.max(mt, bt);
  // Schedule the next loop slightly before this one ends so there's
  // no audible gap between iterations.
  const delaySec = (loopEnd - ctx.currentTime) - 0.05;
  _musicTimer = setTimeout(() => scheduleLoop(loopEnd), Math.max(0, delaySec * 1000));
}

/* Schedule a single square-wave note at absolute startTime, with a
   staccato envelope (quick attack → sustain → quick release). The
   release ends slightly before the next note starts, leaving a tiny
   silence that gives the chiptune its bouncy articulation. */
function playSquareNote(freq, startTime, duration, volume) {
  const ctx = ensureAudioContext();
  if (!ctx || !_musicGain) return;

  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'square';
  osc.frequency.value = freq;

  const releaseStart = startTime + duration * 0.75;
  const noteEnd      = startTime + duration * 0.95;
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(volume, startTime + 0.005);
  gain.gain.setValueAtTime(volume, releaseStart);
  gain.gain.linearRampToValueAtTime(0, noteEnd);

  osc.connect(gain);
  gain.connect(_musicGain);

  osc.start(startTime);
  osc.stop(noteEnd + 0.02);
}

/* Halt the note-scheduling loop. Any notes already scheduled with the
   audio context will still sound (the loop pre-schedules ~6 seconds at
   a time) but no new iterations queue. */
function stopMusic() {
  _musicActive = false;
  if (_musicTimer) {
    clearTimeout(_musicTimer);
    _musicTimer = null;
  }
}

function setMusicMuted(muted) {
  _musicMuted = muted;
  if (muted) {
    stopMusic();
  } else if (_audioCtx) {
    // Only auto-start if the audio context already exists (i.e. the user
    // has already gestured). Otherwise let main.js call startMusic later.
    startMusic();
  }
}

function isMusicMuted() { return _musicMuted; }

/* ── Mute toggle ────────────────────────────────────────────────── */

/* Wire up the mute button (added in index.html). The first click also
   counts as a user gesture so it'll unlock the AudioContext if it was
   still suspended on load. */
const _muteBtn = document.getElementById('mute-btn');
if (_muteBtn) {
  _muteBtn.addEventListener('click', () => {
    setAudioMuted(!isAudioMuted());
    _muteBtn.textContent = isAudioMuted() ? '🔇' : '🔊';
    _muteBtn.title = isAudioMuted() ? 'Sound off — click to turn on' : 'Sound on — click to mute';
    /* Trigger an empty tone to "tap" the audio context awake on the first
       interaction (no-op if already running or muted). */
    if (!isAudioMuted()) ensureAudioContext();
  });
}

/* Wire up the music toggle. Independent of the SFX mute — players can
   mix and match (music off + SFX on, both off, etc.). */
const _musicBtn = document.getElementById('music-btn');
if (_musicBtn) {
  _musicBtn.addEventListener('click', () => {
    ensureAudioContext(); // unlock + create ctx if it doesn't exist yet
    setMusicMuted(!isMusicMuted());
    _musicBtn.textContent = isMusicMuted() ? '🔇' : '🎵';
    _musicBtn.title = isMusicMuted()
      ? 'Music off — click to play'
      : 'Music on — click to mute';
  });
}
