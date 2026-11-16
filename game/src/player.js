// The Bloomkeeper: movement with a little inertia, a dash with brief invulnerability, aim
// from the mouse, and the petal-bolt gun. Firing, dashing and orbiting shield petals are all
// resolved here; the bolts themselves live in bullets.js.
import { ARENA } from './state.js';
import { burst } from './particles.js';

const ACCEL = 2400;
const FRICTION = 7.5;
const DASH_SPEED = 940;
const DASH_SECONDS = 0.16;
const BOLT_SPEED = 760;

/** Spawn one petal bolt from the player's nose toward (aimX, aimY) with a spread angle. */
function fireBolt(state, aimX, aimY, spread) {
  const player = state.player;
  const base = Math.atan2(aimY - player.y, aimX - player.x);
  const angle = base + spread;
  state.bolts.push({
    x: player.x + Math.cos(base) * (player.radius + 6),
    y: player.y + Math.sin(base) * (player.radius + 6),
    vx: Math.cos(angle) * BOLT_SPEED,
    vy: Math.sin(angle) * BOLT_SPEED,
    damage: player.damage,
    pierce: player.pierce,
    life: 0.9,
    hitSet: null,
  });
  player.muzzle = 0.05;
  state.stats.shotsFired += 1;
}

/** Advance the player one step from the input: move, dash, aim, fire, orbit petals. */
export function updatePlayer(state, input, dt) {
  const player = state.player;
  if (!player.alive) return;

  player.fireCooldown -= dt;
  player.dashCooldown = Math.max(0, player.dashCooldown - dt);
  player.invulnTime = Math.max(0, player.invulnTime - dt);
  player.hurtFlash = Math.max(0, player.hurtFlash - dt * 5);
  player.muzzle = Math.max(0, player.muzzle - dt);

  // Dash: a burst along the movement direction (or the aim, standing still), untouchable
  // while it lasts, with a petal trail.
  if (input.dash && player.dashCooldown <= 0 && player.dashTime <= 0) {
    let dx = input.moveX;
    let dy = input.moveY;
    if (dx === 0 && dy === 0) {
      dx = Math.cos(player.angle);
      dy = Math.sin(player.angle);
    }
    const len = Math.hypot(dx, dy) || 1;
    player.vx = (dx / len) * DASH_SPEED;
    player.vy = (dy / len) * DASH_SPEED;
    player.dashTime = DASH_SECONDS;
    player.dashCooldown = player.dashCooldownMax;
    player.invulnTime = Math.max(player.invulnTime, DASH_SECONDS + 0.08);
    state.events.push('dash');
    burst(state, player.x, player.y, '#39d5e8', 10, 120);
  }

  if (player.dashTime > 0) {
    player.dashTime -= dt;
  } else {
    player.vx += input.moveX * ACCEL * dt;
    player.vy += input.moveY * ACCEL * dt;
    const drag = Math.max(0, 1 - FRICTION * dt);
    if (input.moveX === 0) player.vx *= drag;
    if (input.moveY === 0) player.vy *= drag;
    const speed = Math.hypot(player.vx, player.vy);
    if (speed > player.speed) {
      player.vx = (player.vx / speed) * player.speed;
      player.vy = (player.vy / speed) * player.speed;
    }
  }

  player.x += player.vx * dt;
  player.y += player.vy * dt;
  const wall = ARENA.wall + player.radius;
  player.x = Math.min(ARENA.width - wall, Math.max(wall, player.x));
  player.y = Math.min(ARENA.height - wall, Math.max(wall, player.y));

  player.angle = Math.atan2(input.aimY - player.y, input.aimX - player.x);

  // Fire: hold mouse or Space. Multiple projectiles fan out symmetrically.
  if (input.firing && player.fireCooldown <= 0) {
    player.fireCooldown = 1 / player.fireRate;
    const count = player.projectiles;
    for (let i = 0; i < count; i += 1) {
      const spread = count === 1 ? 0 : (i - (count - 1) / 2) * 0.09;
      fireBolt(state, input.aimX, input.aimY, spread);
    }
    state.events.push('shoot');
  }

  updateOrbitPetals(state, dt);
}

/**
 * The orbiting petal shield (an upgrade): petals circle the ship and bite any enemy they
 * touch, each enemy at most twice a second per petal ring. Positions are derived from
 * state.time, so render.js draws exactly what collides here.
 */
export function orbitPetalPositions(state) {
  const player = state.player;
  const positions = [];
  const count = player.orbitPetals;
  const radius = 46;
  for (let i = 0; i < count; i += 1) {
    const angle = state.time * 2.6 + (i / count) * Math.PI * 2;
    positions.push({ x: player.x + Math.cos(angle) * radius, y: player.y + Math.sin(angle) * radius });
  }
  return positions;
}

function updateOrbitPetals(state, dt) {
  const player = state.player;
  if (player.orbitPetals <= 0) return;
  state.orbitClock = (state.orbitClock ?? 0) - dt;
  if (state.orbitClock > 0) return;
  state.orbitClock = 0.22;
  // Petals mark the damage on the enemy; enemies.js applies it on its next step, so kills,
  // splits and shard drops all resolve in exactly one place.
  for (const pos of orbitPetalPositions(state)) {
    for (const enemy of state.enemies) {
      const dx = enemy.x - pos.x;
      const dy = enemy.y - pos.y;
      if (dx * dx + dy * dy < (enemy.radius + 11) * (enemy.radius + 11)) {
        enemy.pendingDamage = (enemy.pendingDamage ?? 0) + player.damage * 0.7;
        enemy.flash = 0.08;
      }
    }
  }
}
