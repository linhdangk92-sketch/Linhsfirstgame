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
