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

/* Build player config — called fresh each game so names rotate.
   Seat order (clockwise): 0=You/bottom, 1=Medium/left, 2=Hard/top, 3=Easy/right */
function buildPlayerCfg() {
  const [med, hard, easy] = pickNames(3);
  return [
    { name: 'You',  isHuman: true,  difficulty: null,     zoneId: 'zone-0' },
    { name: med,    isHuman: false, difficulty: 'medium', zoneId: 'zone-1' },
    { name: hard,   isHuman: false, difficulty: 'hard',   zoneId: 'zone-2' },
    { name: easy,   isHuman: false, difficulty: 'easy',   zoneId: 'zone-3' },
  ];
}

/* Global player config — reassigned at the start of each game */
let PLAYER_CFG = buildPlayerCfg();
