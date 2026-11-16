// Particles, floating combat text, and the gold light shards enemies drop. Particles are pure
// decoration with a fixed cap; floating texts carry damage numbers and score popups; shards
// are the run's currency — they drift, glow, and fly to the player once inside the magnet
// radius, which is what makes killing feel like gathering.

const MAX_PARTICLES = 420;
const MAX_TEXTS = 40;
const SHARD_FLY_SPEED = 620;

/** A burst of sparks/petals at a point, in one colour (or an array of colours). */
export function burst(state, x, y, colors, count, speed) {
  const list = Array.isArray(colors) ? colors : [colors];
  for (let i = 0; i < count; i += 1) {
    if (state.particles.length >= MAX_PARTICLES) return;
    const angle = state.rng.range(0, Math.PI * 2);
    const velocity = state.rng.range(speed * 0.25, speed);
    const life = state.rng.range(0.3, 0.8);
    state.particles.push({
      x,
      y,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity,
      life,
      ttl: life,
      size: state.rng.range(2, 5),
      color: list[i % list.length],
      drag: 3.2,
    });
  }
}

/** A soft ring of slow motes, used for spawns, pickups and the garden's bloom. */
export function puff(state, x, y, color, count = 10) {
  burst(state, x, y, color, count, 70);
}

/** A floating text that rises and fades (damage numbers, +score, shard counts). */
export function floatText(state, x, y, text, color = '#ffffff', size = 16) {
  if (state.texts.length >= MAX_TEXTS) state.texts.shift();
  state.texts.push({
    x: x + state.rng.range(-6, 6),
    y,
    text,
    color,
    size,
    life: 0.85,
    ttl: 0.85,
  });
}

/** Drop gold shards where an enemy died; they settle, then wait to be gathered. */
export function dropShards(state, x, y, count) {
  for (let i = 0; i < count; i += 1) {
    const angle = state.rng.range(0, Math.PI * 2);
    const dist = state.rng.range(6, 42);
    state.pickups.push({
      x: x + Math.cos(angle) * dist,
      y: y + Math.sin(angle) * dist,
      vx: Math.cos(angle) * 60,
      vy: Math.sin(angle) * 60,
      age: 0,
      value: 1,
    });
  }
}

/** Advance particles and floating texts; both fade on their own clocks. */
export function updateParticles(state, dt) {
  const particles = state.particles;
  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const p = particles[i];
    p.life -= dt;
    if (p.life <= 0) {
      particles.splice(i, 1);
      continue;
    }
    const drag = Math.max(0, 1 - p.drag * dt);
    p.vx *= drag;
    p.vy *= drag;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
  const texts = state.texts;
  for (let i = texts.length - 1; i >= 0; i -= 1) {
    const t = texts[i];
    t.life -= dt;
    t.y -= 34 * dt;
    if (t.life <= 0) texts.splice(i, 1);
  }
}

/**
 * Advance shards: friction first, then the magnet — inside the player's magnet radius a
 * shard homes in, faster the closer it gets; touching the player collects it (+1 shard,
 * +15 score, a sparkle and a chime every few pickups).
 */
export function updateShards(state, dt) {
  const player = state.player;
  const pickups = state.pickups;
  for (let i = pickups.length - 1; i >= 0; i -= 1) {
    const s = pickups[i];
    s.age += dt;
    const dx = player.x - s.x;
    const dy = player.y - s.y;
    const dist = Math.hypot(dx, dy) || 1;
    if (player.alive && dist < player.magnet) {
      const pull = SHARD_FLY_SPEED * (1.15 - dist / player.magnet);
      s.vx = (dx / dist) * pull;
      s.vy = (dy / dist) * pull;
    } else {
      s.vx *= Math.max(0, 1 - 4 * dt);
      s.vy *= Math.max(0, 1 - 4 * dt);
    }
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    if (player.alive && dist < player.radius + 10) {
      pickups.splice(i, 1);
      state.shards += s.value;
      state.score += 15;
      if (state.shards % 4 === 0) state.events.push('pickup');
      puff(state, s.x, s.y, '#ffd94d', 3);
    }
  }
}
