// ═══════════════════════════════════════════════════════════════════
// CONSTANTS — card definitions, scoring values, player config
// ═══════════════════════════════════════════════════════════════════

const RANKS     = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];
const SUITS     = ['♠','♣','♦','♥'];
const RED_SUITS = new Set(['♦','♥']);

/* Point value of each rank for rác (trash) penalty */
const RANK_VALUE = {A:1,'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,J:11,Q:12,K:13};

/* Numeric rank order for straight-flush validation */
const RANK_ORDER = {A:1,'2':2,'3':3,'4':4,'5':5,'6':6,'7':7,'8':8,'9':9,'10':10,J:11,Q:12,K:13};

/* Numeric suit order — used by the human hand's "Sort by Suit" button and as a
   tiebreaker when sorting by rank. Order matches the SUITS array above. */
const SUIT_ORDER = {'♠':0, '♣':1, '♦':2, '♥':3};

const TOTAL_ROUNDS       = 4;
const DISCARD_PILE_LIMIT = 4; // personal discard pile at 4 → lay-down phase begins

/* Pool of one-word funny AI names — 3 picked at random each game */
const NAME_POOL = [
  'Chaos',   'Fury',     'Oracle',  'Goblin',   'Ghost',
  'Fridge',  'Tofu',     'Panic',   'Grandpa',  'Vampire',
  'Blunder', 'Noodle',   'Lucky',   'Obvious',  'Rager',
  'Zombie',  'Snitch',   'Yolo',    'Disaster', 'Menace',
];

/* Maps each player name to a fun emoji shown in their avatar bubble */
const AVATAR_MAP = {
  'You':     '🎮',
  'Chaos':   '🔥', 'Fury':    '⚡', 'Oracle':  '🔮', 'Goblin':  '👺',
  'Ghost':   '👻', 'Fridge':  '🧊', 'Tofu':    '🧸', 'Panic':   '😱',
  'Grandpa': '👴', 'Vampire': '🧛', 'Blunder': '🤦', 'Noodle':  '🍜',
  'Lucky':   '🍀', 'Obvious': '🙄', 'Rager':   '😤', 'Zombie':  '🧟',
  'Snitch':  '🤫', 'Yolo':    '🤙', 'Disaster':'💥', 'Menace':  '😈',
};

/* Pick n unique names at random from the pool */
function pickNames(n) {
  const pool   = [...NAME_POOL];
  const picked = [];
  for (let i = 0; i < n; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    picked.push(pool.splice(idx, 1)[0]);
  }
  return picked;
}

/* Build player config — called fresh each game so names AND difficulty
   placement rotate. Seats are fixed (0=You/bottom, 1=left, 2=top, 3=right)
   but which AI difficulty lands in which seat is shuffled per game, so
   the easy AI isn't always to the right of the human.

   Important: this function is called once at module-load time (the
   `let PLAYER_CFG = buildPlayerCfg()` line at the bottom of this file),
   which runs BEFORE deck.js loads. So the shuffle has to be inlined here
   — we can't depend on the global `shuffle` function from deck.js yet. */
function buildPlayerCfg() {
  const names = pickNames(3);
  const difficulties = ['easy', 'medium', 'hard'];
  // Fisher-Yates shuffle, inlined.
  for (let i = difficulties.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [difficulties[i], difficulties[j]] = [difficulties[j], difficulties[i]];
  }
  return [
    { name: 'You',    isHuman: true,  difficulty: null,            zoneId: 'zone-0' },
    { name: names[0], isHuman: false, difficulty: difficulties[0], zoneId: 'zone-1' },
    { name: names[1], isHuman: false, difficulty: difficulties[1], zoneId: 'zone-2' },
    { name: names[2], isHuman: false, difficulty: difficulties[2], zoneId: 'zone-3' },
  ];
}

/* Global player config — reassigned at the start of each game */
let PLAYER_CFG = buildPlayerCfg();
