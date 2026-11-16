// The staged screenshot scenes behind ?shot=start|play|upgrade|end&seed=N. Each scene builds
// a real state and plays the actual rules forward with a simple autopilot, so the frame is a
// moment the game itself produced — never a mock-up — and the same seed always gives the
// same frame. The pilot aims at the nearest spore, keeps its distance, gathers shards, and
// takes the first blessing whenever a draft opens.
import { createState, startRun, updateGame, winGame, SCREEN, STEP } from './state.js';
import { applyUpgrade } from './upgrades.js';

const IDLE_INPUT = { moveX: 0, moveY: 0, aimX: 640, aimY: 200, firing: false, dash: false };

/** The nearest living enemy to a point, or null. */
function nearestEnemy(state, x, y) {
  let best = null;
  let bestDist = Infinity;
  for (const enemy of state.enemies) {
    if (enemy.hp <= 0) continue;
    const d = (enemy.x - x) ** 2 + (enemy.y - y) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = enemy;
    }
  }
  return best;
}

/** One autopilot decision: kite the nearest spore at bolt range, drift to shards otherwise. */
function pilotInput(state) {
  const player = state.player;
  const target = nearestEnemy(state, player.x, player.y);
  const input = { ...IDLE_INPUT, aimX: player.x, aimY: player.y - 100 };
  if (!target) {
    // Nothing to fight: drift toward the nearest shard, or the garden.
    let goal = { x: 640, y: 360 };
    let bestDist = Infinity;
    for (const shard of state.pickups) {
      const d = (shard.x - player.x) ** 2 + (shard.y - player.y) ** 2;
      if (d < bestDist) {
        bestDist = d;
        goal = shard;
      }
    }
    const dx = goal.x - player.x;
    const dy = goal.y - player.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (dist > 24) {
      input.moveX = dx / dist;
      input.moveY = dy / dist;
    }
    return input;
  }
  // Lead the target slightly so bolts land on a moving spore.
  input.aimX = target.x + target.vx * 0.16;
  input.aimY = target.y + target.vy * 0.16;
  input.firing = true;
  const dx = player.x - target.x;
  const dy = player.y - target.y;
  const dist = Math.hypot(dx, dy) || 1;
  const wanted = 235;
  let moveX = 0;
  let moveY = 0;
  if (dist < wanted - 25) {
    moveX = dx / dist;
    moveY = dy / dist;
  } else if (dist > wanted + 60) {
    moveX = -dx / dist;
    moveY = -dy / dist;
  }
  // Strafe while in range so the frame (and the fight) keeps moving.
  moveX += (-dy / dist) * 0.55;
  moveY += (dx / dist) * 0.55;
  const len = Math.hypot(moveX, moveY) || 1;
  input.moveX = moveX / len;
  input.moveY = moveY / len;
  input.dash = dist < 70 && player.dashCooldown <= 0;
  return input;
}

/**
 * Play forward with the pilot for at most `maxSteps`, stopping early when `until` holds.
 * Drafts are auto-taken (first blessing) unless `stopAtDraft` asks to freeze on one.
 */
function playForward(state, maxSteps, until, stopAtDraft = false) {
  for (let i = 0; i < maxSteps; i += 1) {
    if (state.screen === SCREEN.DRAFT) {
      if (stopAtDraft) return;
      applyUpgrade(state, 0);
      continue;
    }
    if (state.screen !== SCREEN.PLAY) return;
    updateGame(state, pilotInput(state), STEP);
    if (until && until(state)) return;
  }
}

/**
 * Build the named scene and return the state to render. 'start' is the title over the quiet
 * garden; 'play' is mid-wave-5 combat (spitters and a brute join by then); 'upgrade' is the
 * first draft; 'end' is the victory.
 */
export function stageShot(name, seed) {
  const state = createState(seed);
  if (name === 'play') {
    startRun(state);
    playForward(state, 60 * 240, (s) => s.wave >= 5 && s.banner === null && s.enemies.length >= 6 && s.bolts.length >= 2 && s.pickups.length >= 2);
    return state;
  }
  if (name === 'upgrade') {
    startRun(state);
    playForward(state, 60 * 120, null, true);
    return state;
  }
  if (name === 'end') {
    startRun(state);
    // A finished run's numbers, then the genuine victory path: winGame() itself fires the
    // score bonus, the banner and the bloom bursts; a few steps let the petals fly.
    state.wave = 10;
    state.kills = 87;
    state.shards = 132;
    state.score = 18450;
    state.runTime = 372.4;
    state.gardenBloom = 10;
    state.player.hp = 64;
    winGame(state);
    for (let i = 0; i < 100; i += 1) updateGame(state, IDLE_INPUT, STEP);
    return state;
  }
  // start (and anything unknown): the title over the ambient garden.
  for (let i = 0; i < 90; i += 1) updateGame(state, IDLE_INPUT, STEP);
  return state;
}
