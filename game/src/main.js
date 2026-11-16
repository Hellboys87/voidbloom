// Boot and the one loop. The simulation advances in fixed 1/60 s steps from an accumulator
// (several steps in a slow frame, none in a fast one) and the renderer paints the state every
// animation frame, so play feels identical on any display. This module owns the screen flow —
// title, play, pause, the upgrade draft, victory and defeat — drains the sound events the
// simulation queued, and wires clicks on the draft cards to the same picks as keys 1-3.
//
// ?seed=N fixes the run's randomness. ?shot=start|play|upgrade|end (with &seed=N) stages a
// deterministic scene from shots.js instead of running the loop, paints it twice and sets
// window.__shotReady for the screenshot harness.
import { createState, startRun, updateGame, SCREEN, STEP } from './state.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_DASH, ACTION_RESTART, ACTION_MUTE } from './input.js';
import { createRenderer } from './render.js';
import { createAudio } from './audio.js';
import { applyUpgrade } from './upgrades.js';
import { DRAFT_CARDS } from './hud.js';
import { stageShot } from './shots.js';

const MAX_FRAME = 0.25; // a longer stall (hidden tab) is dropped, not replayed

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);

if (shot) {
  const sceneState = stageShot(shot, seed);
  let painted = 0;
  const paint = () => {
    renderer.draw(sceneState, false);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  };
  requestAnimationFrame(paint);
} else {
  runGame();
}

function runGame() {
  const state = createState(seed);
  const input = createInput(canvas);
  const audio = createAudio();
  let muted = false;
  let accumulator = 0;
  let last = performance.now();
  let screenSince = performance.now();
  let dashQueued = false;

  function announce(message) {
    status.textContent = message;
  }

  function setScreen(next) {
    state.screen = next;
    screenSince = performance.now();
  }

  function beginRun() {
    startRun(state);
    screenSince = performance.now();
    announce('Playing. Wave 1. Survive ten waves and destroy the Voidheart.');
  }

  /** Sound events the simulation queued during its steps, played once each. */
  function drainEvents() {
    for (const name of state.events) audio.play(name);
    state.events.length = 0;
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      muted = !muted;
      audio.setMuted(muted);
    }
    if (actions & ACTION_DASH) dashQueued = true;

    const click = input.takeClick();
    const screen = state.screen;

    if (screen === SCREEN.TITLE) {
      if (actions & ACTION_CONFIRM) beginRun();
      return;
    }
    if (screen === SCREEN.PLAY) {
      if (actions & ACTION_PAUSE) {
        setScreen(SCREEN.PAUSED);
        announce('Paused.');
      }
      return;
    }
    if (screen === SCREEN.PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        setScreen(SCREEN.PLAY);
        announce('Playing.');
      }
      return;
    }
    if (screen === SCREEN.DRAFT) {
      let pick = input.takeDraftPick();
      if (pick < 0 && click.hit && state.draft) {
        pick = DRAFT_CARDS.findIndex(
          (card) => click.x >= card.x && click.x <= card.x + card.width && click.y >= card.y && click.y <= card.y + card.height,
        );
      }
      if (pick >= 0 && state.draft) {
        applyUpgrade(state, pick);
        screenSince = performance.now();
        announce(`Blessing taken. Wave ${state.wave}.`);
      }
      return;
    }
    // Victory or defeat: R, Enter or a click restarts — but not on the same click that
    // landed the final blow, so the end screen always gets a moment to be seen.
    if (performance.now() - screenSince > 600 && (actions & (ACTION_RESTART | ACTION_CONFIRM))) {
      beginRun();
    }
  }

  function stepOnce() {
    if (state.screen === SCREEN.PLAY) {
      const move = input.moveVector();
      updateGame(
        state,
        {
          moveX: move.x,
          moveY: move.y,
          aimX: input.mouseX,
          aimY: input.mouseY,
          firing: input.firing(),
          dash: dashQueued,
        },
        STEP,
      );
      dashQueued = false;
      if (state.screen === SCREEN.OVER) {
        screenSince = performance.now();
        announce(`Game over. Score ${state.score}. Press R to play again.`);
      } else if (state.screen === SCREEN.VICTORY) {
        screenSince = performance.now();
        announce(`Victory. Score ${state.score}. Press R to play again.`);
      } else if (state.screen === SCREEN.DRAFT) {
        screenSince = performance.now();
        announce(`Wave ${state.wave} cleared. Choose a blessing: keys 1, 2 or 3, or click a card.`);
      }
    } else if (state.screen !== SCREEN.PAUSED) {
      // Title, draft and end screens keep their particles and banners moving.
      updateGame(state, { moveX: 0, moveY: 0, aimX: 0, aimY: 0, firing: false, dash: false }, STEP);
    }
    drainEvents();
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    while (accumulator >= STEP) {
      stepOnce();
      accumulator -= STEP;
      if (state.screen === SCREEN.PAUSED) {
        accumulator = 0;
        break;
      }
    }
    renderer.draw(state, muted);
  }

  // Any first gesture unlocks the audio context, as browsers require.
  const unlock = () => audio.unlock();
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);

  // Leaving the tab pauses a running game rather than letting the swarm feed unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && state.screen === SCREEN.PLAY) {
      setScreen(SCREEN.PAUSED);
      announce('Paused.');
    }
  });

  announce('VOIDBLOOM. Click or press Enter to play.');
  requestAnimationFrame(frame);
}
