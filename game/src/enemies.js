// The void spores: six kinds, each with its own shape, colour and behaviour, plus the
// Voidheart boss. This module owns enemy definitions, spawning, per-kind movement, contact
// damage, taking damage (hit flash, knockback, floating numbers) and dying (score, shards,
// splitter children, boss defeat). waves.js decides what to spawn; bullets.js calls
// hitEnemy() when a petal bolt lands.
import { ARENA } from './state.js';
import { burst, dropShards, floatText } from './particles.js';

/** Enemy kind table: base stats before the per-wave scaling waves.js applies. */
export const ENEMY_KINDS = {
  mite: { radius: 12, hp: 14, speed: 112, contact: 10, score: 50, shards: 1, color: '#ff4fd8' },
  mini: { radius: 8, hp: 6, speed: 148, contact: 6, score: 25, shards: 0, color: '#ff8ae2' },
  dasher: { radius: 13, hp: 22, speed: 74, contact: 12, score: 80, shards: 1, color: '#ff9435' },
  splitter: { radius: 19, hp: 34, speed: 62, contact: 12, score: 90, shards: 2, color: '#59e35f' },
  brute: { radius: 27, hp: 120, speed: 40, contact: 20, score: 160, shards: 3, color: '#9a5cff' },
  spitter: { radius: 14, hp: 26, speed: 82, contact: 10, score: 110, shards: 2, color: '#35c8ff' },
  boss: { radius: 46, hp: 1500, speed: 30, contact: 24, score: 2000, shards: 12, color: '#c44dff' },
};

let nextEnemyId = 1;

/** Create an enemy of a kind at a position, scaled by hpScale/speedScale for the wave. */
export function spawnEnemy(state, kind, x, y, hpScale = 1, speedScale = 1) {
  const base = ENEMY_KINDS[kind];
  const enemy = {
    id: nextEnemyId++,
    kind,
    x,
    y,
    vx: 0,
    vy: 0,
    radius: base.radius,
    hp: base.hp * hpScale,
    maxHp: base.hp * hpScale,
    speed: base.speed * speedScale,
    contact: base.contact,
    score: base.score,
    shardCount: base.shards,
    color: base.color,
    flash: 0,
    knockX: 0,
    knockY: 0,
    pendingDamage: 0,
    // Per-kind behaviour clocks, all in seconds.
    stateTime: state.rng.range(0, 0.4),
    mode: 'chase', // dasher: chase | telegraph | lunge | recover
    lungeX: 0,
    lungeY: 0,
    fireTimer: state.rng.range(1.2, 2.4),
    ringTimer: 2.2,
    spiralTimer: 0,
    spiralAngle: 0,
    summonTimer: 5,
    wobble: state.rng.range(0, Math.PI * 2),
  };
  state.enemies.push(enemy);
  burst(state, x, y, '#3a2b5e', 6, 60);
  return enemy;
}

/** A random point just inside an arena edge, away from the player's immediate reach. */
export function edgeSpawnPoint(state) {
  const rng = state.rng;
  const side = rng.int(0, 3);
  const m = ARENA.wall + 24;
  if (side === 0) return { x: rng.range(m, ARENA.width - m), y: m };
  if (side === 1) return { x: rng.range(m, ARENA.width - m), y: ARENA.height - m };
  if (side === 2) return { x: m, y: rng.range(m, ARENA.height - m) };
  return { x: ARENA.width - m, y: rng.range(m, ARENA.height - m) };
}

function steer(enemy, targetX, targetY, speed, dt) {
  const dx = targetX - enemy.x;
  const dy = targetY - enemy.y;
  const dist = Math.hypot(dx, dy) || 1;
  enemy.vx = (dx / dist) * speed;
  enemy.vy = (dy / dist) * speed;
  enemy.x += enemy.vx * dt;
  enemy.y += enemy.vy * dt;
}

/** The dasher's rhythm: close in, pause with a telegraphed aim line, lunge, recover. */
function updateDasher(state, enemy, player, dt) {
  enemy.stateTime -= dt;
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const dist = Math.hypot(dx, dy) || 1;
  if (enemy.mode === 'chase') {
    steer(enemy, player.x, player.y, enemy.speed, dt);
    if (dist < 330 && enemy.stateTime <= 0) {
      enemy.mode = 'telegraph';
      enemy.stateTime = 0.5;
      enemy.lungeX = dx / dist;
      enemy.lungeY = dy / dist;
    }
  } else if (enemy.mode === 'telegraph') {
    enemy.lungeX = dx / dist;
    enemy.lungeY = dy / dist;
    if (enemy.stateTime <= 0) {
      enemy.mode = 'lunge';
      enemy.stateTime = 0.34;
      state.events.push('orb');
    }
  } else if (enemy.mode === 'lunge') {
    enemy.x += enemy.lungeX * 640 * dt;
    enemy.y += enemy.lungeY * 640 * dt;
    if (enemy.stateTime <= 0) {
      enemy.mode = 'recover';
      enemy.stateTime = 1.5;
    }
  } else {
    steer(enemy, player.x, player.y, enemy.speed * 0.4, dt);
    if (enemy.stateTime <= 0) enemy.mode = 'chase';
  }
}

/** The spitter keeps its distance and lobs slow void orbs at the player. */
function updateSpitter(state, enemy, player, dt) {
  const dx = player.x - enemy.x;
  const dy = player.y - enemy.y;
  const dist = Math.hypot(dx, dy) || 1;
  const wanted = 300;
  const dir = dist > wanted + 30 ? 1 : dist < wanted - 30 ? -1 : 0;
  enemy.x += (dx / dist) * enemy.speed * dir * dt + Math.cos(state.time * 1.7 + enemy.wobble) * 14 * dt;
  enemy.y += (dy / dist) * enemy.speed * dir * dt + Math.sin(state.time * 1.7 + enemy.wobble) * 14 * dt;
  enemy.fireTimer -= dt;
  if (enemy.fireTimer <= 0 && dist < 560) {
    enemy.fireTimer = 2.3;
    state.orbs.push({
      x: enemy.x,
      y: enemy.y,
      vx: (dx / dist) * 195,
      vy: (dy / dist) * 195,
      radius: 6,
      damage: 12,
      life: 4,
    });
    state.events.push('orb');
  }
}

/** The Voidheart: drifts toward the garden's heart, sheds bullet rings and spirals, summons mites. */
function updateBoss(state, enemy, player, dt) {
  const cx = ARENA.width / 2;
  const cy = ARENA.height / 2;
  steer(enemy, cx + Math.cos(state.time * 0.23) * 130, cy + Math.sin(state.time * 0.31) * 80, enemy.speed, dt);

  enemy.ringTimer -= dt;
  if (enemy.ringTimer <= 0) {
    enemy.ringTimer = 2.7;
    const count = 14;
    const offset = state.rng.range(0, Math.PI * 2);
    for (let i = 0; i < count; i += 1) {
      const angle = offset + (i / count) * Math.PI * 2;
      state.orbs.push({
        x: enemy.x + Math.cos(angle) * (enemy.radius + 8),
        y: enemy.y + Math.sin(angle) * (enemy.radius + 8),
        vx: Math.cos(angle) * 132,
        vy: Math.sin(angle) * 132,
        radius: 6,
        damage: 12,
        life: 5,
      });
    }
    state.events.push('orb');
  }

  // Below two-thirds health the spiral joins in.
  if (enemy.hp < enemy.maxHp * 0.66) {
    enemy.spiralTimer -= dt;
    if (enemy.spiralTimer <= 0) {
      enemy.spiralTimer = 0.14;
      enemy.spiralAngle += 0.62;
      for (const sign of [0, Math.PI]) {
        const angle = enemy.spiralAngle + sign;
        state.orbs.push({
          x: enemy.x + Math.cos(angle) * (enemy.radius + 6),
          y: enemy.y + Math.sin(angle) * (enemy.radius + 6),
          vx: Math.cos(angle) * 165,
          vy: Math.sin(angle) * 165,
          radius: 5,
          damage: 10,
          life: 4,
        });
      }
    }
  }

  enemy.summonTimer -= dt;
  if (enemy.summonTimer <= 0) {
    enemy.summonTimer = 6.5;
    if (state.enemies.length < 9) {
      for (let i = 0; i < 2; i += 1) {
        const angle = state.rng.range(0, Math.PI * 2);
        spawnEnemy(state, 'mite', enemy.x + Math.cos(angle) * 80, enemy.y + Math.sin(angle) * 80, 1.4, 1.05);
      }
      floatText(state, enemy.x, enemy.y - enemy.radius - 14, 'THE VOIDHEART CALLS', '#e3b3ff', 17);
    }
  }
}

/** Advance every enemy one step, then resolve contact damage and deaths. */
export function updateEnemies(state, dt) {
  const player = state.player;
  const wall = ARENA.wall;

  for (const enemy of state.enemies) {
    enemy.flash = Math.max(0, enemy.flash - dt);
    if (enemy.pendingDamage > 0) {
      const amount = enemy.pendingDamage;
      enemy.pendingDamage = 0;
      applyDamage(state, enemy, amount, player.x, player.y, 40);
    }
    if (enemy.hp <= 0) continue;

    switch (enemy.kind) {
      case 'dasher':
        updateDasher(state, enemy, player, dt);
        break;
      case 'spitter':
        updateSpitter(state, enemy, player, dt);
        break;
      case 'boss':
        updateBoss(state, enemy, player, dt);
        break;
      default: {
        // mites, minis, splitters, brutes: straight at the player, with a wobble so the
        // swarm breathes instead of marching in a line.
        const wob = Math.sin(state.time * 3 + enemy.wobble) * 18;
        steer(enemy, player.x + Math.cos(enemy.wobble) * wob, player.y + Math.sin(enemy.wobble) * wob, enemy.speed, dt);
        break;
      }
    }

    // Knockback decays into the position.
    enemy.x += enemy.knockX * dt;
    enemy.y += enemy.knockY * dt;
    enemy.knockX *= Math.max(0, 1 - 9 * dt);
    enemy.knockY *= Math.max(0, 1 - 9 * dt);

    enemy.x = Math.min(ARENA.width - wall - 4, Math.max(wall + 4, enemy.x));
    enemy.y = Math.min(ARENA.height - wall - 4, Math.max(wall + 4, enemy.y));

    // Contact: touching the player hurts, unless the player is dashing or just hurt.
    if (player.alive && player.invulnTime <= 0) {
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const rr = player.radius + enemy.radius;
      if (dx * dx + dy * dy < rr * rr) {
        damagePlayer(state, enemy.contact, enemy.x, enemy.y);
        enemy.knockX -= (dx || 1) * 6;
        enemy.knockY -= (dy || 1) * 6;
      }
    }
  }

  // Deaths resolve after movement so a splitter's children never move on their birth step.
  for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
    const enemy = state.enemies[i];
    if (enemy.hp > 0) continue;
    state.enemies.splice(i, 1);
    killEnemy(state, enemy);
  }
}

/** Damage the player, with knockback away from the source and a brief grace period. */
export function damagePlayer(state, amount, fromX, fromY) {
  const player = state.player;
  if (!player.alive || player.invulnTime > 0) return;
  player.hp -= amount;
  player.hurtFlash = 1;
  player.invulnTime = 0.55;
  state.shake = Math.min(14, state.shake + 7);
  const dx = player.x - fromX;
  const dy = player.y - fromY;
  const dist = Math.hypot(dx, dy) || 1;
  player.vx += (dx / dist) * 260;
  player.vy += (dy / dist) * 260;
  state.events.push('hurt');
  burst(state, player.x, player.y, '#ff5f6e', 8, 150);
  if (player.hp <= 0) {
    player.hp = 0;
    player.alive = false;
  }
}

/** A petal bolt (or an orbiting petal's mark) lands: flash, knockback, number, maybe death. */
export function hitEnemy(state, enemy, amount, fromX, fromY) {
  applyDamage(state, enemy, amount, fromX, fromY, 130);
  state.events.push('hit');
}

/** Shared damage path: numbers, flash, knockback scaled by size; death is resolved later. */
function applyDamage(state, enemy, amount, fromX, fromY, knock) {
  if (enemy.hp <= 0) return;
  enemy.hp -= amount;
  enemy.flash = 0.09;
  state.stats.damageDealt += amount;
  floatText(state, enemy.x, enemy.y - enemy.radius - 4, String(Math.round(amount)), '#ffffff', enemy.kind === 'boss' ? 19 : 14);
  const dx = enemy.x - fromX;
  const dy = enemy.y - fromY;
  const dist = Math.hypot(dx, dy) || 1;
  const resist = enemy.kind === 'brute' || enemy.kind === 'boss' ? 0.18 : 1;
  enemy.knockX += (dx / dist) * knock * resist;
  enemy.knockY += (dy / dist) * knock * resist;
  if (enemy.kind === 'boss') state.events.push('hit');
}

/** Death: score, shards, particles, a splitter's children, the boss's last burst. */
function killEnemy(state, enemy) {
  state.kills += 1;
  state.score += enemy.score;
  floatText(state, enemy.x, enemy.y - enemy.radius - 16, `+${enemy.score}`, '#ffe9a3', 15);
  burst(state, enemy.x, enemy.y, [enemy.color, '#ffffff'], enemy.kind === 'boss' ? 70 : 14, enemy.kind === 'boss' ? 320 : 190);
  dropShards(state, enemy.x, enemy.y, enemy.shardCount);
  state.events.push(enemy.kind === 'splitter' ? 'split' : 'die');
  if (enemy.kind === 'splitter') {
    for (const sign of [-1, 1]) {
      const child = spawnEnemy(state, 'mini', enemy.x + sign * 14, enemy.y + sign * 6, 1, 1);
      child.knockX = sign * 160;
    }
  }
  if (enemy.kind === 'boss') {
    state.boss = null;
    state.shake = 16;
    burst(state, enemy.x, enemy.y, ['#ffd94d', '#ff5fa2', '#7be382'], 60, 260);
    // The heart's summoned spores unravel with it: mark them dead and the death pass in
    // updateEnemies resolves their score and shards like any other kill.
    for (const other of state.enemies) {
      if (other !== enemy && other.hp > 0) other.hp = 0;
    }
  }
}
