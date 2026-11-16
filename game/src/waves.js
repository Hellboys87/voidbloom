// The wave director: what each of the ten waves sends, how fast it arrives, and how the
// spores scale as the void pushes harder. Waves are lists of enemy kinds shuffled by the
// run's seeded RNG and dealt out a few at a time from the arena's edges; wave 10 replaces
// the list with the Voidheart and a slow trickle of mites.
import { spawnEnemy, edgeSpawnPoint } from './enemies.js';
import { showBanner } from './state.js';

/** Composition of each wave, by enemy kind. Wave 10 is the boss (handled in startWave). */
const WAVE_LISTS = [
  null,
  ['mite', 'mite', 'mite', 'mite', 'mite', 'mite'],
  ['mite', 'mite', 'mite', 'mite', 'dasher', 'mite', 'mite', 'dasher'],
  ['mite', 'mite', 'splitter', 'mite', 'dasher', 'mite', 'splitter', 'mite', 'mite'],
  ['splitter', 'mite', 'brute', 'dasher', 'mite', 'mite', 'splitter', 'dasher', 'mite'],
  ['spitter', 'mite', 'mite', 'dasher', 'splitter', 'spitter', 'mite', 'brute', 'mite', 'dasher'],
  ['dasher', 'spitter', 'mite', 'splitter', 'brute', 'mite', 'dasher', 'spitter', 'mite', 'splitter', 'mite'],
  ['brute', 'spitter', 'dasher', 'mite', 'splitter', 'spitter', 'dasher', 'mite', 'brute', 'mite', 'dasher', 'splitter'],
  ['spitter', 'brute', 'dasher', 'splitter', 'spitter', 'mite', 'dasher', 'brute', 'splitter', 'spitter', 'mite', 'dasher', 'mite'],
  ['brute', 'dasher', 'spitter', 'splitter', 'brute', 'dasher', 'spitter', 'mite', 'splitter', 'dasher', 'brute', 'spitter', 'mite', 'dasher'],
  [],
];

/** Enemy health/speed scaling for a wave: the void pushes a little harder every wave. */
function waveScale(wave) {
  return { hp: 1 + (wave - 1) * 0.16, speed: 1 + (wave - 1) * 0.03 };
}

/** Begin a wave: queue its enemies (shuffled), or summon the Voidheart on wave 10. */
export function startWave(state, wave) {
  state.wave = wave;
  state.waveState = 'spawning';
  state.spawnTimer = 0.9;
  state.spawnQueue.length = 0;

  if (wave >= 10) {
    const boss = spawnEnemy(state, 'boss', 640, 190, 1, 1);
    state.boss = boss;
    for (const kind of ['mite', 'mite', 'mite', 'mite']) state.spawnQueue.push(kind);
    showBanner(state, 'WAVE 10 — THE VOIDHEART', 'destroy it and the garden blooms', 3.2);
    state.events.push('boss');
    return;
  }

  const list = WAVE_LISTS[wave] ?? WAVE_LISTS[9];
  const queue = [...list];
  for (let i = queue.length - 1; i > 0; i -= 1) {
    const j = Math.floor(state.rng.next() * (i + 1));
    [queue[i], queue[j]] = [queue[j], queue[i]];
  }
  state.spawnQueue.push(...queue);
  const names = {
    1: 'the first spores drift in',
    4: 'something big moves in the dark',
    5: 'the void learns to spit',
  };
  showBanner(state, `WAVE ${wave}`, names[wave] ?? 'the void pushes harder', 2.2);
  state.events.push('wave');
}

/** Deal out the spawn queue a few at a time; the wave is 'fighting' once all are in play. */
export function updateWaves(state, dt) {
  if (state.waveState !== 'spawning') return;
  state.spawnTimer -= dt;
  if (state.spawnTimer > 0) return;
  const scale = waveScale(state.wave);
  const batch = state.wave >= 7 ? 3 : 2;
  for (let n = 0; n < batch && state.spawnQueue.length > 0; n += 1) {
    const kind = state.spawnQueue.shift();
    const point = edgeSpawnPoint(state);
    spawnEnemy(state, kind, point.x, point.y, scale.hp, scale.speed);
  }
  state.spawnTimer = state.spawnQueue.length > 0 ? 0.85 : 0;
  if (state.spawnQueue.length === 0) state.waveState = 'fighting';
}
