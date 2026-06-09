// ═══════════════════════════════════════════════════════════════════
// TUTORIAL — 9-slide carousel shown to first-time players
// ═══════════════════════════════════════════════════════════════════
// Triggered when the user checks "First time playing? Show me the tutorial"
// on the start overlay. After the user picks a round count, the tutorial
// modal opens. Closes when the user clicks Skip OR finishes the last slide;
// then dealRound() runs.

/* Slide content. Each slide is { title, body, visual? }.
   - title: bold heading shown at the top
   - body:  multi-line plain text; newlines are preserved (white-space:pre-wrap)
   - visual: optional key identifying a custom DOM block to insert below the
     body (e.g. example cards). Only 'phom-examples' is supported today. */
const TUTORIAL_SLIDES = [
  {
    title: 'Welcome to Phỏm · Tá Lả',
    body:
`Phỏm (also called Tá Lả) is a Vietnamese card game similar to Rummy.

You play against 3 AI opponents. Each round, you'll try to form valid card groups (phỏm) and discard the cards that don't fit.

The player with the lowest "leftover" (rác) total wins the round. The player with the highest total score after all rounds wins the game!`,
  },
  {
    title: 'The two types of phỏm',
    body:
`A valid phỏm is one of these two shapes:

📚 Sám cô — 3 or 4 cards of the same rank (any suits)
📏 Thông — 3 or more consecutive cards in the SAME suit

Cards in your hand that don't fit into any phỏm count as rác — penalty points at round end.`,
    visual: 'phom-examples',
  },
  {
    title: 'How a turn works',
    body:
`Your turn has two simple steps:

1️⃣ Either STEAL the most recent discard (only allowed if it completes a phỏm in your hand) OR DRAW the top card from the deck

2️⃣ DISCARD one card (drag it to the center, or tap it)

Each player takes 4 turns per round (until they've made 4 discards).`,
  },
  {
    title: 'The lay-down rule',
    body:
`When you STEAL a card, you must IMMEDIATELY reveal the phỏm you formed with it. The cards become visible to everyone.

Your OTHER phỏm stay hidden in your hand until "lap-close" — the moment after you've made your 4th discard. At that point, all your hidden phỏm get revealed.

So: stealing = public lay-down. Drawing = keep everything secret.`,
  },
  {
    title: 'Móm — finish empty-handed',
    body:
`If you reach the end of a round with ZERO phỏm laid down, you're MÓM (broke).

Penalty: −4 points paid to the round winner.

Try to lay down at least one phỏm every round to avoid this!`,
  },
  {
    title: 'Ù — the instant win',
    body:
`If your remaining hand becomes ALL phỏm with no leftover rác, you Ù — an instant round win!

Your reward: +15 points for you, −5 for everyone else.

Bonus: if your STARTING hand has zero pair/near-phỏm potential (impossible to form any phỏm), you can declare Ù KHAN right away for the same big bonus.`,
  },
  {
    title: 'Gửi — share your scraps',
    body:
`During the LAST LAP (after everyone has laid down their phỏm), you can GỬI:

Send your remaining rác cards to extend opponents' laid-down phỏm. This reduces YOUR rác total — every gửi'd card is one fewer penalty point.

⚠️ Móm players cannot gửi — they're stuck with all their rác as the penalty.`,
  },
  {
    title: 'Đền — the compensation rule',
    body:
`Đền is a special penalty around stealing someone's FINAL (4th) discard — called Ăn Chốt. It's a gamble.

Three Đền triggers:
• T1 — You Ăn Chốt, then someone else Ù → you pay −15
• T2 — You steal 3 of one player's discards → counts as Ù for you, victim pays
• T3 — You Ăn Chốt + then Ù via the stolen card → big bonus

Don't memorize this! The game will show clear banners explaining each Đền when it actually happens.`,
  },
];

/* The 9th slide has two variants: PRACTICE is appended when the tutorial
   opens for the first time (after "First time playing?" was checked), and
   the Next button on that slide launches the on-table practice round.
   TIPS is appended when the rule book button opens the tutorial in
   read-only mode — it's just a quick-tips reference with a "Close" button
   that dismisses without starting anything. */
const TUTORIAL_SLIDE_PRACTICE = {
  title: 'Ready to try a practice round?',
  body:
`Next you'll play a free practice round on the real game table. It does NOT count toward your score — it's just a warm-up.

The game will guide you through:
  1️⃣ Sort your hand by rank
  2️⃣ Drag a card sideways to reorder manually
  3️⃣ Drag a card up to the center to discard
  4️⃣ Where to find the rule book later

Once the guides finish, the real game will start.

Click "Start Practice!" to begin.`,
};

const TUTORIAL_SLIDE_TIPS = {
  title: "You're ready!",
  body:
`Quick tips:

🃏 Drag a card to the center to discard
↕️ Use the "Sort by Rank" / "Sort by Suit" buttons to organize your hand
📖 Click the rule book in the header anytime to re-open this tutorial
🔊 Mute toggle is in the top-right corner of the header
👁️ Hover over opponent piles to fan them out for a closer look

Good luck!`,
};

/* Open the tutorial modal. Calls onComplete() when the user clicks Skip
   OR finishes the last slide. Builds the DOM once and updates content in
   place as the user navigates — keeps the modal lightweight. */
/* Open the tutorial carousel modal.
   onComplete: called when the user finishes the last slide OR clicks Skip.
   options.readonly: when true, the final slide is the static "You're ready!"
     tips slide and the last button reads "Close" (just dismisses). When
     false/omitted (the default), the final slide is the practice-round
     intro and the last button reads "Start Practice!" — main.js handles
     launching the practice round in the onComplete callback. */
function showTutorial(onComplete, options = {}) {
  const readonly = !!options.readonly;
  // Build the active slide list: shared base slides 1-8 + variant slide 9
  const slides = TUTORIAL_SLIDES.concat(
    readonly ? TUTORIAL_SLIDE_TIPS : TUTORIAL_SLIDE_PRACTICE
  );
  let currentSlide = 0;

  // ── Overlay + card scaffolding ──────────────────────────────
  const overlay = document.createElement('div');
  overlay.className = 'tutorial-overlay';

  const card = document.createElement('div');
  card.className = 'tutorial-card';

  const stepBar = document.createElement('div');
  stepBar.className = 'tutorial-stepbar';

  const titleEl = document.createElement('h3');
  titleEl.className = 'tutorial-title';

  const bodyEl = document.createElement('div');
  bodyEl.className = 'tutorial-body';

  const dotsEl = document.createElement('div');
  dotsEl.className = 'tutorial-dots';

  // ── Buttons ─────────────────────────────────────────────────
  const btnRow = document.createElement('div');
  btnRow.className = 'tutorial-buttons';

  const skipBtn = document.createElement('button');
  skipBtn.className = 'tutorial-btn skip';
  skipBtn.textContent = 'Skip';
  skipBtn.addEventListener('click', finish);

  const prevBtn = document.createElement('button');
  prevBtn.className = 'tutorial-btn prev';
  prevBtn.textContent = '← Previous';
  prevBtn.addEventListener('click', () => {
    if (currentSlide > 0) { currentSlide--; render(); }
  });

  const nextBtn = document.createElement('button');
  nextBtn.className = 'tutorial-btn next';
  nextBtn.addEventListener('click', () => {
    if (currentSlide < slides.length - 1) {
      currentSlide++;
      render();
    } else {
      finish();
    }
  });

  btnRow.appendChild(skipBtn);
  btnRow.appendChild(prevBtn);
  btnRow.appendChild(nextBtn);

  card.appendChild(stepBar);
  card.appendChild(titleEl);
  card.appendChild(bodyEl);
  card.appendChild(dotsEl);
  card.appendChild(btnRow);
  overlay.appendChild(card);
  document.body.appendChild(overlay);

  /* Render or re-render the current slide. Called on init and every nav. */
  function render() {
    const slide = slides[currentSlide];

    stepBar.textContent = 'Step ' + (currentSlide + 1) + ' of ' + slides.length;
    titleEl.textContent = slide.title;

    // Body — clear and rebuild so visual blocks don't accumulate
    bodyEl.innerHTML = '';
    const p = document.createElement('p');
    p.textContent = slide.body;
    bodyEl.appendChild(p);

    // Optional visual block per slide. 'phom-examples' = static card row
    // shown on slide 2.
    if (slide.visual === 'phom-examples') {
      bodyEl.appendChild(buildPhomExamples());
    }

    // Dots indicator
    dotsEl.innerHTML = '';
    for (let i = 0; i < slides.length; i++) {
      const dot = document.createElement('span');
      dot.className = 'tutorial-dot' + (i === currentSlide ? ' active' : '');
      dotsEl.appendChild(dot);
    }

    // Button states. Final-slide button text depends on mode:
    //   readonly (rule-book open) → "Close" (just dismisses)
    //   normal  (first-time path) → "Start Practice!" (launches the on-table
    //                               practice via the onComplete callback)
    prevBtn.disabled = currentSlide === 0;
    const isLast = currentSlide === slides.length - 1;
    if (isLast) {
      nextBtn.textContent = readonly ? 'Close' : 'Start Practice!';
    } else {
      nextBtn.textContent = 'Next →';
    }
    nextBtn.disabled = false;

    // Scroll modal back to top when slide changes (helps when content is tall)
    card.scrollTop = 0;
  }

  /* Close the tutorial with a brief fade-out, then run the caller's onComplete. */
  function finish() {
    overlay.classList.add('dismissed');
    setTimeout(() => {
      overlay.remove();
      if (onComplete) onComplete();
    }, 350);
  }

  render();
  /* Trigger the fade-in transition by adding .show on the next frame
     (without this the browser batches the initial styles + .show and the
     transition gets skipped). */
  requestAnimationFrame(() => overlay.classList.add('show'));
}

/* Build the visual block for slide 2: two example phỏm shown as actual
   styled card divs (reuses makeCard from render.js). */
function buildPhomExamples() {
  const wrap = document.createElement('div');
  wrap.className = 'tutorial-cards';

  // Sám cô — 3 of a kind across different suits
  const samcoLabel = document.createElement('div');
  samcoLabel.className = 'tutorial-card-label';
  samcoLabel.textContent = 'Sám cô — three 5s of different suits:';
  wrap.appendChild(samcoLabel);

  const samcoRow = document.createElement('div');
  samcoRow.className = 'tutorial-card-row';
  samcoRow.appendChild(makeCard({ rank: '5', suit: '♠' }));
  samcoRow.appendChild(makeCard({ rank: '5', suit: '♥' }));
  samcoRow.appendChild(makeCard({ rank: '5', suit: '♦' }));
  wrap.appendChild(samcoRow);

  // Thông — 3 consecutive ranks in the same suit
  const thongLabel = document.createElement('div');
  thongLabel.className = 'tutorial-card-label';
  thongLabel.textContent = 'Thông — three consecutive spades:';
  wrap.appendChild(thongLabel);

  const thongRow = document.createElement('div');
  thongRow.className = 'tutorial-card-row';
  thongRow.appendChild(makeCard({ rank: '4', suit: '♠' }));
  thongRow.appendChild(makeCard({ rank: '5', suit: '♠' }));
  thongRow.appendChild(makeCard({ rank: '6', suit: '♠' }));
  wrap.appendChild(thongRow);

  return wrap;
}

// ═══════════════════════════════════════════════════════════════════
// ON-TABLE PRACTICE ROUND + GUIDED TOUR
// ═══════════════════════════════════════════════════════════════════
// After the tutorial carousel closes, the user lands on the REAL game UI
// for a free practice round. The right-side AI (player 3) deals so they
// take one turn and create a discard pile, then it's the human's turn —
// at which point we run a 3-step tour overlaid on the real UI with arrows
// pointing at the Sort button, a hand card, and the AI's discard pile.
//
// The practice doesn't count toward score and ends with a small modal
// that transitions into the real round 1.

/* Tour step definitions. Each step targets one element via CSS selector,
   shows a floating tooltip with text, and waits for the specified event
   on the target to advance.
     - targetSelector: querySelector string for the highlighted element
     - text:           instruction shown in the tooltip
     - event:          DOM event name to listen for ('click', 'dragend',
                       'mouseenter')
     - tooltipPos:     where to place the tooltip relative to the target
                       ('top' | 'bottom' | 'left' | 'right') */
const TUTORIAL_TOUR_STEPS = [
  {
    targetSelector: '#sort-rank',
    text: 'Click "Sort by Rank" to organize your cards by value. Try it now!',
    event: 'click',
    tooltipPos: 'top',
  },
  {
    targetSelector: '#hand-0 .card',
    text: "You can also reorder cards manually — drag any card sideways to move it. Try it!",
    // Fires the instant the drag begins — listening for 'dragend' was
    // unreliable because the existing reorder code in render.js calls
    // renderHumanHand on drop, which destroys the dragged element and
    // prevents dragend from bubbling. dragstart fires BEFORE any of that
    // and bubbles cleanly from the card up to #hand-0.
    event: 'dragstart',
    tooltipPos: 'top',
  },
  {
    targetSelector: '#discard-zone',
    text: 'To end your turn, drag any card up to the center of the table to discard it.',
    // 'drop' fires on the discard zone when the user releases a dragged
    // card on it. After the drop, performDiscard runs in the existing
    // zone.ondrop handler and the AI starts taking turns in the
    // background — that's fine; step 4 overlays the game state.
    event: 'drop',
    tooltipPos: 'top',
  },
  {
    targetSelector: '#rulebook-btn',
    text: 'Forgot a rule? Click the 📖 button anytime to re-open this tutorial. It will stay here so you can come back whenever you need.',
    tooltipPos: 'bottom',
    // No `event` — endStep:true puts a "Got it!" button inside the
    // tooltip; clicking it ends the tour and triggers the Practice
    // Complete modal → real round 1.
    endStep: true,
  },
];

/* Run a guided tour over the real game UI. Steps fire one at a time;
   each waits for the user to perform the specified action on the target
   element before advancing. onComplete is called when all steps are done
   OR the user clicks Skip Tour. */
function runTutorialTour(onComplete) {
  let stepIdx = 0;

  // Persistent DOM elements — created once, repositioned per step
  const tooltip = document.createElement('div');
  tooltip.className = 'tour-tooltip';

  const skipBtn = document.createElement('button');
  skipBtn.className = 'tour-skip-btn';
  skipBtn.type = 'button';
  skipBtn.textContent = 'Skip Tour';
  skipBtn.addEventListener('click', () => finish());

  document.body.appendChild(tooltip);
  document.body.appendChild(skipBtn);

  let currentTarget = null;
  let currentEvent  = null;
  let currentHandler = null;

  /* Show the current step: position the tooltip, mark the target with
     a pulsing outline, and attach the advance listener. */
  function renderStep() {
    const step = TUTORIAL_TOUR_STEPS[stepIdx];
    const target = document.querySelector(step.targetSelector);
    if (!target) {
      // Target missing — skip to next step rather than wedging the tour
      console.warn('Tour target not found:', step.targetSelector);
      advance();
      return;
    }

    currentTarget = target;
    currentEvent  = step.event;
    target.classList.add('tour-target');

    // Fill tooltip content
    tooltip.innerHTML = '';
    const stepLabel = document.createElement('div');
    stepLabel.className = 'tour-step-label';
    stepLabel.textContent =
      'Step ' + (stepIdx + 1) + ' of ' + TUTORIAL_TOUR_STEPS.length;
    const textEl = document.createElement('div');
    textEl.className = 'tour-text';
    textEl.textContent = step.text;
    tooltip.appendChild(stepLabel);
    tooltip.appendChild(textEl);
    tooltip.className = 'tour-tooltip arrow-' + step.tooltipPos + ' show';

    // Final step has no event to wait for — show a "Got it!" button inside
    // the tooltip that ends the tour when clicked.
    if (step.endStep) {
      const gotItBtn = document.createElement('button');
      gotItBtn.className = 'tour-gotit-btn';
      gotItBtn.type = 'button';
      gotItBtn.textContent = 'Got it!';
      gotItBtn.addEventListener('click', advance);
      tooltip.appendChild(gotItBtn);
    }

    // Position the tooltip in the next frame so its width/height are known
    requestAnimationFrame(() => positionTooltip(tooltip, target, step.tooltipPos));

    // Attach the advance listener for action-based steps. Final step
    // (endStep:true) skips this entirely — the Got it! button handles it.
    // For 'dragstart' we listen on the parent .hand container (the event
    // bubbles up) so a drag on ANY card in the hand counts, not just the
    // highlighted one. dragstart also survives the existing reorder
    // code's re-render — it fires BEFORE any DOM mutation happens.
    if (!step.endStep) {
      currentHandler = () => advance();
      const eventTarget = step.event === 'dragstart'
        ? document.getElementById('hand-0')
        : target;
      eventTarget.addEventListener(step.event, currentHandler, { once: true });
    }
  }

  /* Move to the next step, or finish if we're on the last one. */
  function advance() {
    cleanupCurrent();
    stepIdx++;
    if (stepIdx >= TUTORIAL_TOUR_STEPS.length) {
      finish();
    } else {
      // Brief pause so the user sees their action register before the
      // next instruction appears
      setTimeout(renderStep, 350);
    }
  }

  /* Remove the pulse class + event listener for the current step. */
  function cleanupCurrent() {
    if (currentTarget) currentTarget.classList.remove('tour-target');
    if (currentHandler && currentEvent) {
      const eventTarget = currentEvent === 'dragstart'
        ? document.getElementById('hand-0')
        : currentTarget;
      if (eventTarget) eventTarget.removeEventListener(currentEvent, currentHandler);
    }
    currentTarget = currentEvent = currentHandler = null;
  }

  /* Tear down the tour and call onComplete. */
  function finish() {
    cleanupCurrent();
    tooltip.classList.remove('show');
    skipBtn.classList.add('dismissed');
    setTimeout(() => {
      tooltip.remove();
      skipBtn.remove();
      if (onComplete) onComplete();
    }, 250);
  }

  renderStep();
}

/* Position a tooltip relative to its target. `pos` is one of
   'top' | 'bottom' | 'left' | 'right' — describes WHERE THE TOOLTIP SITS
   relative to the target. Clamps to the viewport so it never goes
   off-screen. */
function positionTooltip(tooltip, target, pos) {
  const r = target.getBoundingClientRect();
  const tw = tooltip.offsetWidth;
  const th = tooltip.offsetHeight;
  const margin = 20; // gap between tooltip and target
  let top, left;

  if (pos === 'top') {
    top  = r.top - th - margin;
    left = r.left + r.width / 2 - tw / 2;
  } else if (pos === 'bottom') {
    top  = r.bottom + margin;
    left = r.left + r.width / 2 - tw / 2;
  } else if (pos === 'left') {
    top  = r.top + r.height / 2 - th / 2;
    left = r.left - tw - margin;
  } else { // right
    top  = r.top + r.height / 2 - th / 2;
    left = r.right + margin;
  }

  // Clamp to viewport with a small inset
  const inset = 10;
  top  = Math.max(inset, Math.min(window.innerHeight - th - inset, top));
  left = Math.max(inset, Math.min(window.innerWidth  - tw - inset, left));

  tooltip.style.top  = top + 'px';
  tooltip.style.left = left + 'px';
}

/* Show the small "Practice complete" modal that bridges from the tour
   into the real game. Clicking the button calls onContinue. */
function showPracticeCompleteModal(onContinue) {
  const overlay = document.createElement('div');
  overlay.className = 'tutorial-overlay show'; // reuse modal overlay styling

  const card = document.createElement('div');
  card.className = 'tutorial-card';
  card.style.textAlign = 'center';

  const title = document.createElement('h3');
  title.className = 'tutorial-title';
  title.textContent = '✓ Practice complete!';
  card.appendChild(title);

  const body = document.createElement('div');
  body.className = 'tutorial-body';
  body.innerHTML = '<p>You\'ve got the basics! Ready to start the real game?</p>';
  card.appendChild(body);

  const btnRow = document.createElement('div');
  btnRow.className = 'tutorial-buttons';
  btnRow.style.justifyContent = 'center';

  const startBtn = document.createElement('button');
  startBtn.className = 'tutorial-btn next';
  startBtn.type = 'button';
  startBtn.textContent = 'Start Real Game!';
  startBtn.addEventListener('click', () => {
    overlay.classList.add('dismissed');
    setTimeout(() => { overlay.remove(); onContinue(); }, 300);
  });
  btnRow.appendChild(startBtn);
  card.appendChild(btnRow);

  overlay.appendChild(card);
  document.body.appendChild(overlay);
}

/* Tracks whether the practice round is currently active. dealRound and
   turns.js can check this to suppress scoring + alter dealer if needed.
   Stays true from startPracticeRound until the post-tour modal dismisses. */
let TUTORIAL_PRACTICE_ACTIVE = false;

/* Entry point called after the tutorial modal closes. Deals a free
   practice round with the right-side AI as dealer (so they take one
   turn first, leaving a discard for the hover step to highlight). Once
   the human's turn begins, runs the 3-step tour. After the tour: shows
   the "Practice complete" modal which transitions to the real round 1
   via onPracticeDone. */
function startPracticeRound(onPracticeDone) {
  TUTORIAL_PRACTICE_ACTIVE = true;

  // Force-disable timers during practice so the player can read the
  // instructions at their own pace. Restore the user's choice afterward.
  const savedSlowPlay = SLOW_PLAY;
  SLOW_PLAY = true;

  // Human is the dealer (default round-1 behavior, no override needed).
  // That means the human gets 10 cards and goes first — no steal/draw
  // step required, the tour can jump straight into sort → reorder →
  // discard. No AI plays before the tour starts.
  dealRound();

  // Wait for the human's turn (state.currentTurn === 0 and state.phase
  // not 'scoring' or transitional). Poll briefly — the AI's first
  // discard takes a couple of seconds due to think-pause + animation.
  const waitForHumanTurn = setInterval(() => {
    if (state.currentTurn === 0 &&
        (state.phase === 'steal-prompt' || state.phase === 'discard-prompt')) {
      clearInterval(waitForHumanTurn);
      // Brief delay so the human's hand is fully rendered before the
      // tour overlay tries to find target elements
      setTimeout(() => runTutorialTour(() => {
        // Tour done — show transition modal, then start real game
        showPracticeCompleteModal(() => {
          SLOW_PLAY = savedSlowPlay;
          TUTORIAL_PRACTICE_ACTIVE = false;
          // dealRound with default dealer logic for round 1 (player 0)
          dealRound();
          if (onPracticeDone) onPracticeDone();
        });
      }), 400);
    }
  }, 200);
}