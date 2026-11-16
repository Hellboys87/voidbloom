// The whole mutable game state and the fixed-step update that advances it. One state object
// holds everything — player, enemies, bolts, orbs, shards, particles, the wave director, the
// draft, the screen — and updateGame() moves it forward by exactly one step, calling the
// one-job modules for each part. Nothing here touches the DOM or the clock: the same seed and
// the same inputs always produce the same run, which is what makes the staged scenes exact.
import { createRng } from './rng.js';
import { updatePlayer } from './player.js';
import { updateEnemies, damagePlayer } from './enemies.js';
import { updateBolts } from './bullets.js';
import { updateParticles, updateShards, burst, floatText } from './particles.js';
import { updateWaves, startWave } from './waves.js';
import { openDraft } from './upgrades.js';

/** The arena, in logical pixels; the canvas is exactly this size. */
export const ARENA = { width: 1280, height: 720, wall: 26 };
/** One simulation step: a sixtieth of a second. */
export const STEP = 1 / 60;
/** The last wave; clearing it (by killing the Voidheart) wins the game. */
export const FINAL_WAVE = 10;

/** Screens the game can be on. */
export const SCREEN = {
  TITLE: 'title',
  PLAY: 'play',
  DRAFT: 'draft',
  PAUSED: 'paused',
  VICTORY: 'victory',
  OVER: 'over',
};

/** A fresh player: the Bloomkeeper seed-ship at the arena's centre. */
function createPlayer() {
  return {
    x: ARENA.width / 2,
    y: ARENA.height / 2 + 120,
    vx: 0,
    vy: 0,
    radius: 14,
    angle: -Math.PI / 2,
    hp: 100,
    maxHp: 100,
    speed: 265,
    fireRate: 5.2,
    fireCooldown: 0,
    damage: 11,
    projectiles: 1,
    pierce: 0,
    magnet: 95,
    orbitPetals: 0,
    regen: 0,
    dashCooldownMax: 2.1,
    dashCooldown: 0,
    dashTime: 0,
    invulnTime: 0,
    hurtFlash: 0,
    muzzle: 0,
    alive: true,
  };
}

/** Create the full state for a run (and for the title screen's ambient arena). */
export function createState(seed) {
  return {
    rng: createRng(seed),
    screen: SCREEN.TITLE,
    time: 0,
    runTime: 0,
    wave: 0,
    score: 0,
    shards: 0,
    kills: 0,
    player: createPlayer(),
    enemies: [],
    bolts: [],
    orbs: [],
    pickups: [],
    particles: [],
    texts: [],
    spawnQueue: [],
    spawnTimer: 0,
    waveState: 'idle', // idle | spawning | fighting | cleared
    banner: null, // { title, sub, time, ttl }
    draft: null, // { choices: [upgrade, upgrade, upgrade] }
    boss: null,
    shake: 0,
    events: [], // sound/event names for main.js to drain: 'shoot', 'die', ...
    stats: { shotsFired: 0, damageDealt: 0 },
    gardenBloom: 0, // 0..FINAL_WAVE, how many rings of the central flower have opened
  };
}

/** Reset the state for a new run from the title or an end screen. */
export function startRun(state) {
  state.player = createPlayer();
  state.enemies.length = 0;
  state.bolts.length = 0;
  state.orbs.length = 0;
  state.pickups.length = 0;
  state.particles.length = 0;
  state.texts.length = 0;
  state.spawnQueue.length = 0;
  state.wave = 0;
  state.score = 0;
  state.shards = 0;
  state.kills = 0;
  state.runTime = 0;
  state.boss = null;
  state.draft = null;
  state.gardenBloom = 0;
  state.stats = { shotsFired: 0, damageDealt: 0 };
  startWave(state, 1);
  state.screen = SCREEN.PLAY;
}

/** Show a centre banner (wave announcements, warnings) for a few seconds. */
export function showBanner(state, title, sub, ttl = 2.4) {
  state.banner = { title, sub, time: 0, ttl };
}

/**
 * Advance the game by one fixed step. `input` is { moveX, moveY, aimX, aimY, firing, dash }
 * with dash true only on the step the dash was pressed. Draft, pause and end screens freeze
 * the world (particles still settle so screenshots and transitions stay alive).
 */
export function updateGame(state, input, dt) {
  state.time += dt;
  if (state.banner) {
    state.banner.time += dt;
    if (state.banner.time >= state.banner.ttl) state.banner = null;
  }
  state.shake = Math.max(0, state.shake - dt * 26);
  updateParticles(state, dt);

  if (state.screen !== SCREEN.PLAY) return;

  state.runTime += dt;
  const player = state.player;

  updateWaves(state, dt);
  updatePlayer(state, input, dt);
  updateEnemies(state, dt);
  updateBolts(state, dt);
  updateShards(state, dt);

  if (player.regen > 0 && player.alive) {
    player.hp = Math.min(player.maxHp, player.hp + player.regen * dt);
  }

  // Wave cleared: everything spawned is dead and nothing is left to come.
  if (
    state.waveState === 'fighting' &&
    state.spawnQueue.length === 0 &&
    state.enemies.length === 0
  ) {
    state.waveState = 'cleared';
    state.gardenBloom = Math.max(state.gardenBloom, state.wave);
    if (state.wave >= FINAL_WAVE) {
      winGame(state);
    } else {
      state.score += 250 * state.wave;
      showBanner(state, `WAVE ${state.wave} BLOOMED`, 'choose a blessing', 1.6);
      openDraft(state);
    }
  }

  if (!player.alive && state.screen === SCREEN.PLAY) {
    state.screen = SCREEN.OVER;
    state.events.push('defeat');
    burst(state, player.x, player.y, '#39d5e8', 42, 260);
    burst(state, player.x, player.y, '#ffd94d', 24, 180);
  }
}

/** The Voidheart is dead and the wave is clear: the garden blooms. */
export function winGame(state) {
  state.screen = SCREEN.VICTORY;
  state.score += 2500;
  state.events.push('victory');
  showBanner(state, 'THE GARDEN BLOOMS', '', 3.5);
  for (let i = 0; i < 5; i += 1) {
    const angle = (i / 5) * Math.PI * 2 + state.rng.range(0, 0.5);
    burst(
      state,
      ARENA.width / 2 + Math.cos(angle) * 190,
      ARENA.height / 2 + Math.sin(angle) * 130,
      ['#ffd94d', '#ff5fa2', '#7be382', '#39d5e8'][i % 4],
      26,
      220,
    );
  }
}

/** Hurt the player from an enemy or an orb, honouring dash invulnerability. */
export function hurtPlayer(state, amount, fromX, fromY) {
  damagePlayer(state, amount, fromX, fromY);
}

/** Floating score text helper used across modules. */
export function awardScore(state, x, y, points) {
  state.score += points;
  floatText(state, x, y - 10, `+${points}`, '#ffe9a3', 15);
}
