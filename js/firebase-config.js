// ═══════════════════════════════════════════════════════════════════
// FIREBASE — connection setup for multiplayer
// ═══════════════════════════════════════════════════════════════════
// Loaded after the Firebase SDK CDN scripts in index.html. Initializes
// the SDK with our project's config and exposes a global `_firebaseDB`
// that multiplayer.js uses for all reads/writes.
//
// These config values are NOT secrets — they're meant to be embedded
// in client-side JS. Security comes from database rules in the Firebase
// console (currently in test mode for development — open read/write).

const firebaseConfig = {
  apiKey: "AIzaSyCsL4tat2qG1zJCP_ewpuaiCC4EkhcdOXw",
  authDomain: "phom-game-multiplayer.firebaseapp.com",
  databaseURL: "https://phom-game-multiplayer-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "phom-game-multiplayer",
  storageBucket: "phom-game-multiplayer.firebasestorage.app",
  messagingSenderId: "242751279245",
  appId: "1:242751279245:web:f58d43f3fc9e848f6892c4",
};

// The compat SDK exposes a global `firebase` object — initialize once
// at module load. Subsequent files reference `_firebaseDB` for all
// Realtime Database operations.
firebase.initializeApp(firebaseConfig);
const _firebaseDB = firebase.database();
