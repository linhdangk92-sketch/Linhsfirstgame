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

/* ── Background music (Mario-style chiptune, multi-song) ────────
   Three distinct songs, one per round, rotating: round 1 → song 0,
   round 2 → song 1, round 3 → song 2, round 4 → song 0, etc.

   Each song has 3 verses — A (intro, mellow), B (peak, energetic),
   C (outro, descending) — that play back-to-back-to-back and loop:
   A → B → C → A → B → C → ...

   Each verse is 4 bars at 144 BPM = 6.4 seconds, so one full A-B-C
   cycle is ~19.2s. Verses share the chiptune feel but differ in
   melodic contour, pitch range, and bass density so the music feels
   like it's evolving (not monotone).

   All synthesized in the browser via Web Audio API — no external files. */

let _musicActive    = false;  // true while the note-scheduling loop is running
let _musicMuted     = false;  // user-controlled — gates startMusic()
let _musicTimer     = null;   // setTimeout handle for the next verse iteration
let _musicGain      = null;   // master GainNode for all music (separate from SFX)
let _currentSongIdx = 0;      // which SONGS entry is active
let _currentVerseIdx = 0;     // which verse within the current song (0/1/2)

const MUSIC_MASTER_GAIN = 0.04;
const MELODY_VOLUME     = 0.13;
const BASS_VOLUME       = 0.10;

// Note durations at 144 BPM (one beat = 60/144 ≈ 0.417s)
const N8 = 0.20;  // eighth note
const N4 = 0.40;  // quarter note
const N2 = 0.80;  // half note

// Named pitch constants so the song data reads as notes, not Hz blobs.
// Octaves 3-6 cover the range we use.
const C3 = 130.81, D3 = 146.83, E3 = 164.81, F3 = 174.61, G3 = 196.00, A3 = 220.00, B3 = 246.94;
const C4 = 261.63, D4 = 293.66, E4 = 329.63, F4 = 349.23, G4 = 392.00, A4 = 440.00, B4 = 493.88;
const C5 = 523.25, D5 = 587.33, E5 = 659.25, F5 = 698.46, G5 = 783.99, A5 = 880.00, B5 = 987.77;
const C6 = 1046.50, D6 = 1174.66, E6 = 1318.51, F6 = 1396.91, G6 = 1567.98, A6 = 1760.00;

/* Each verse: { melody: [[freq, dur], ...], bass: [[freq, dur], ...] }.
   Total of melody durations === total of bass durations === 6.4s. */
const SONGS = [
  /* ── SONG 0 — Cheerful C major (round 1, 4, 7, 10) ─────────── */
  {
    verses: [
      // Verse A — bouncy arpeggios up and down
      {
        melody: [
          [C5,N8],[E5,N8],[G5,N8],[C6,N8], [B5,N8],[G5,N8],[E5,N8],[C5,N8],
          [A4,N8],[C5,N8],[E5,N8],[G5,N8], [A5,N8],[C6,N4],[0,N8],
          [B5,N8],[A5,N8],[G5,N8],[F5,N8], [E5,N8],[D5,N8],[C5,N8],[B4,N8],
          [D5,N8],[E5,N8],[G5,N4], [E5,N4],[C5,N4],
        ],
        bass: [
          [C3,N2],[G3,N2], [F3,N2],[C4,N2],
          [G3,N2],[D4,N2], [C3,N2],[G3,N2],
        ],
      },
      // Verse B — higher pitched, more energy, denser melody
      {
        melody: [
          [C6,N8],[D6,N8],[E6,N8],[D6,N8], [C6,N8],[D6,N8],[E6,N8],[G6,N8],
          [F6,N8],[E6,N8],[D6,N8],[C6,N8], [B5,N8],[A5,N8],[G5,N8],[E5,N8],
          [C6,N8],[E6,N8],[G6,N8],[E6,N8], [D6,N8],[F6,N8],[A6,N8],[F6,N8],
          [E6,N8],[C6,N8],[G5,N4], [C5,N4],[C5,N4],
        ],
        bass: [
          [C3,N2],[C4,N2], [G3,N2],[G4,N2],
          [F3,N2],[C4,N2], [C3,N2],[G3,N2],
        ],
      },
      // Verse C — descending resolution, longer notes
      {
        melody: [
          [G5,N8],[F5,N8],[E5,N8],[D5,N8], [C5,N8],[B4,N8],[A4,N8],[G4,N8],
          [F4,N8],[G4,N8],[A4,N8],[G4,N8], [F4,N8],[E4,N8],[D4,N8],[C4,N8],
          [D5,N8],[E5,N8],[F5,N8],[G5,N8], [A5,N8],[B5,N8],[C6,N4],
          [G5,N4],[E5,N4],[C5,N2],
        ],
        bass: [
          [C3,1.6], [G3,1.6],
          [F3,1.6], [C3,1.6],
        ],
      },
    ],
  },

  /* ── SONG 1 — Atmospheric A minor (round 2, 5, 8) ──────────── */
  {
    verses: [
      // Verse A — gentle minor arpeggios
      {
        melody: [
          [A4,N8],[C5,N8],[E5,N8],[A5,N8], [E5,N8],[C5,N8],[A4,N8],[G4,N8],
          [F4,N8],[A4,N8],[C5,N8],[F5,N8], [C5,N8],[A4,N8],[F4,N8],[E4,N8],
          [G4,N8],[B4,N8],[D5,N8],[G5,N8], [D5,N8],[B4,N8],[G4,N8],[E4,N8],
          [F4,N8],[A4,N8],[E5,N4], [C5,N4],[A4,N4],
        ],
        bass: [
          [A3,N2],[E4,N2], [F3,N2],[C4,N2],
          [G3,N2],[D4,N2], [A3,N2],[E4,N2],
        ],
      },
      // Verse B — peak, busier minor melody
      {
        melody: [
          [A5,N8],[C6,N8],[E6,N8],[A5,N8], [G5,N8],[E5,N8],[C5,N8],[A4,N8],
          [F5,N8],[A5,N8],[D6,N8],[F6,N8], [E6,N8],[D6,N8],[C6,N8],[A5,N8],
          [G5,N8],[B5,N8],[D6,N8],[G6,N8], [F6,N8],[D6,N8],[B5,N8],[G5,N8],
          [E6,N8],[C6,N8],[A5,N4], [E5,N4],[A4,N4],
        ],
        bass: [
          [A3,N2],[E4,N2], [F3,N2],[C4,N2],
          [G3,N2],[D4,N2], [E3,N2],[A3,N2],
        ],
      },
      // Verse C — wind-down, descending
      {
        melody: [
          [A5,N8],[G5,N8],[F5,N8],[E5,N8], [D5,N8],[C5,N8],[B4,N8],[A4,N8],
          [C5,N8],[B4,N8],[A4,N8],[G4,N8], [F4,N8],[E4,N8],[D4,N8],[C4,N8],
          [D4,N8],[E4,N8],[F4,N8],[G4,N8], [A4,N8],[B4,N8],[C5,N4],
          [E5,N4],[C5,N4],[A4,N2],
        ],
        bass: [
          [A3,1.6], [F3,1.6],
          [E3,1.6], [A3,1.6],
        ],
      },
    ],
  },

  /* ── SONG 2 — Pentatonic G major (round 3, 6, 9) ───────────── */
  {
    verses: [
      // Verse A — gentle pentatonic intro
      {
        melody: [
          [G4,N8],[A4,N8],[B4,N8],[D5,N8], [E5,N8],[D5,N8],[B4,N8],[A4,N8],
          [G4,N8],[B4,N8],[D5,N8],[G5,N8], [E5,N8],[D5,N8],[B4,N8],[G4,N8],
          [D5,N8],[E5,N8],[G5,N8],[A5,N8], [B5,N8],[A5,N8],[G5,N8],[E5,N8],
          [D5,N8],[G4,N8],[B4,N4], [D5,N4],[G4,N4],
        ],
        bass: [
          [G3,N2],[D4,N2], [G3,N2],[D4,N2],
          [E3,N2],[B3,N2], [G3,N2],[D4,N2],
        ],
      },
      // Verse B — peak, bright pentatonic runs up high
      {
        melody: [
          [G5,N8],[A5,N8],[B5,N8],[D6,N8], [E6,N8],[D6,N8],[B5,N8],[A5,N8],
          [G5,N8],[D6,N8],[E6,N8],[G6,N8], [E6,N8],[D6,N8],[B5,N8],[G5,N8],
          [A5,N8],[B5,N8],[D6,N8],[E6,N8], [G6,N8],[E6,N8],[D6,N8],[B5,N8],
          [A5,N4],[G5,N4], [E5,N4],[D5,N4],
        ],
        bass: [
          [G3,N2],[B3,N2], [D4,N2],[G4,N2],
          [E4,N2],[B3,N2], [D4,N2],[G3,N2],
        ],
      },
      // Verse C — descending end with long notes
      {
        melody: [
          [G6,N8],[E6,N8],[D6,N8],[B5,N8], [A5,N8],[G5,N8],[E5,N8],[D5,N8],
          [B5,N8],[A5,N8],[G5,N8],[E5,N8], [D5,N8],[B4,N8],[A4,N8],[G4,N8],
          [A4,N8],[B4,N8],[D5,N8],[E5,N8], [G5,N8],[E5,N8],[D5,N8],[B4,N8],
          [G4,N2], [D4,N2],
        ],
        bass: [
          [G3,1.6], [D3,1.6],
          [G3,1.6], [G3,1.6],
        ],
      },
    ],
  },
];

/* Called from main.js dealRound whenever a new round begins. Picks the
   song for this round (rotating modulo SONGS.length). Only resets the
   verse cursor when the song ACTUALLY CHANGES — that way round 1 (which
   sets the song before the very first verse has finished) doesn't double
   up Verse A, and rounds that loop back to the same song (e.g. round 4
   returns to song 0) keep cycling instead of restarting. */
function setSongForRound(roundNumber) {
  if (!SONGS.length) return;
  const newIdx = (roundNumber - 1) % SONGS.length;
  if (newIdx !== _currentSongIdx) {
    _currentSongIdx  = newIdx;
    _currentVerseIdx = 0;
  }
}

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

/* Schedule one verse of the active song, then setTimeout the next
   verse to fire ~50ms before this one ends. Advancing the verse index
   here means each iteration plays the NEXT verse in the A→B→C cycle.
   If setSongForRound() reset things in between, the next iteration
   automatically picks up the new song. */
function scheduleLoop(startTime) {
  if (!_musicActive || _musicMuted) return;
  const ctx = ensureAudioContext();
  if (!ctx) return;

  const song  = SONGS[_currentSongIdx];
  const verse = song.verses[_currentVerseIdx];

  // Melody voice — accumulator advances per note (rests advance time
  // but don't schedule an oscillator).
  let mt = startTime;
  verse.melody.forEach(([freq, dur]) => {
    if (freq > 0) playSquareNote(freq, mt, dur, MELODY_VOLUME);
    mt += dur;
  });

  // Bass voice — independent timeline, same start time so they sync
  let bt = startTime;
  verse.bass.forEach(([freq, dur]) => {
    if (freq > 0) playSquareNote(freq, bt, dur, BASS_VOLUME);
    bt += dur;
  });

  // Advance to the next verse in the A→B→C cycle (wraps back to A)
  _currentVerseIdx = (_currentVerseIdx + 1) % song.verses.length;

  const loopEnd = Math.max(mt, bt);
  // Schedule the next verse slightly before this one ends so there's
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
