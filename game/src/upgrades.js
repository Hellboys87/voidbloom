// The upgrade draft: between waves the game pauses and offers three blessings, drawn from
// this pool by the run's seeded RNG. Every blessing stacks, so a build emerges over the run —
// split bolts with piercing, a ring of orbiting petals, a dash that is always ready. main.js
// reads the draft from the state and applies the pick with applyUpgrade().
import { SCREEN, showBanner } from './state.js';
import { startWave } from './waves.js';
import { burst } from './particles.js';

/** The blessing pool. `apply` mutates the player (or state) when the card is chosen. */
export const UPGRADES = [
  {
    id: 'rapid-petals',
    name: 'Rapid Petals',
    color: '#39d5e8',
    desc: '+25% fire rate. The Bloomkeeper throws petals faster.',
    apply(p) { p.fireRate *= 1.25; },
  },
  {
    id: 'heavy-petals',
    name: 'Heavy Petals',
    color: '#ff5fa2',
    desc: '+35% bolt damage. Each petal lands harder.',
    apply(p) { p.damage *= 1.35; },
  },
  {
    id: 'split-bloom',
    name: 'Split Bloom',
    color: '#ffd94d',
    desc: '+1 projectile per shot, fanned out beside the others.',
    apply(p) { p.projectiles += 1; },
  },
  {
    id: 'swift-roots',
    name: 'Swift Roots',
    color: '#7be382',
    desc: '+12% move speed. Dodge like wind through grass.',
    apply(p) { p.speed *= 1.12; },
  },
  {
    id: 'deep-roots',
    name: 'Deep Roots',
    color: '#59e35f',
    desc: '+25 max HP and heal 40 now. Roots drink deep.',
    apply(p) { p.maxHp += 25; p.hp = Math.min(p.maxHp, p.hp + 40); },
  },
  {
    id: 'quick-dash',
    name: 'Quick Dash',
    color: '#35c8ff',
    desc: 'Dash recharges 30% faster. The void cannot hold you.',
    apply(p) { p.dashCooldownMax *= 0.7; },
  },
  {
    id: 'wide-magnet',
    name: 'Wide Magnet',
    color: '#ffb347',
    desc: '+60% shard magnet radius. Light finds its way home.',
    apply(p) { p.magnet *= 1.6; },
  },
  {
    id: 'piercing-thorns',
    name: 'Piercing Thorns',
    color: '#ff9435',
    desc: 'Bolts pierce +1 enemy instead of dying on the first.',
    apply(p) { p.pierce += 1; },
  },
  {
    id: 'orbit-petal',
    name: 'Orbit Petal',
    color: '#ff4fd8',
    desc: '+1 orbiting petal shield that bites what it touches.',
    apply(p) { p.orbitPetals = Math.min(5, p.orbitPetals + 1); },
  },
  {
    id: 'morning-dew',
    name: 'Morning Dew',
    color: '#9ae6ff',
    desc: 'Regenerate +0.9 HP every second, forever.',
    apply(p) { p.regen += 0.9; },
  },
];

/** Draw three distinct blessings for the draft, weighted away from capped ones. */
export function drawDraft(state) {
  const pool = UPGRADES.filter((u) => u.id !== 'orbit-petal' || state.player.orbitPetals < 5);
  const choices = [];
  const bag = [...pool];
  while (choices.length < 3 && bag.length > 0) {
    const index = Math.floor(state.rng.next() * bag.length);
    choices.push(bag.splice(index, 1)[0]);
  }
  return choices;
}

/** Pause the run and open the draft for the wave just cleared. */
export function openDraft(state) {
  state.draft = { choices: drawDraft(state) };
  state.screen = SCREEN.DRAFT;
}

/** Apply the chosen blessing, close the draft, and start the next wave. */
export function applyUpgrade(state, index) {
  if (!state.draft || index < 0 || index >= state.draft.choices.length) return;
  const upgrade = state.draft.choices[index];
  upgrade.apply(state.player, state);
  state.draft = null;
  state.events.push('upgrade');
  burst(state, state.player.x, state.player.y, upgrade.color, 22, 170);
  showBanner(state, upgrade.name.toUpperCase(), 'blessing taken', 1.4);
  state.screen = SCREEN.PLAY;
  startWave(state, state.wave + 1);
}
