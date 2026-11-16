// Projectiles: the player's petal bolts and the enemies' void orbs. Bolts fly straight,
// punch through as many enemies as the player's pierce stat allows (never hitting the same
// enemy twice), and die on the arena wall. Orbs are slower, bigger, and hurt on touch —
// but a dash passes through them unharmed, and they fizzle on the wall.
import { ARENA } from './state.js';
import { hitEnemy, damagePlayer } from './enemies.js';
import { burst } from './particles.js';

/** Advance bolts and orbs one step and resolve every collision. */
export function updateBolts(state, dt) {
  updatePlayerBolts(state, dt);
  updateEnemyOrbs(state, dt);
}

function updatePlayerBolts(state, dt) {
  const bolts = state.bolts;
  const wall = ARENA.wall;
  for (let i = bolts.length - 1; i >= 0; i -= 1) {
    const bolt = bolts[i];
    bolt.life -= dt;
    bolt.x += bolt.vx * dt;
    bolt.y += bolt.vy * dt;
    let dead = bolt.life <= 0 || bolt.x < wall || bolt.x > ARENA.width - wall || bolt.y < wall || bolt.y > ARENA.height - wall;

    if (!dead) {
      for (const enemy of state.enemies) {
        if (enemy.hp <= 0) continue;
        if (bolt.hitSet && bolt.hitSet.has(enemy.id)) continue;
        const dx = enemy.x - bolt.x;
        const dy = enemy.y - bolt.y;
        const rr = enemy.radius + 5;
        if (dx * dx + dy * dy >= rr * rr) continue;
        hitEnemy(state, enemy, bolt.damage, bolt.x - bolt.vx * 0.02, bolt.y - bolt.vy * 0.02);
        burst(state, bolt.x, bolt.y, enemy.color, 3, 90);
        if (bolt.pierce > 0) {
          bolt.pierce -= 1;
          (bolt.hitSet ??= new Set()).add(enemy.id);
        } else {
          dead = true;
        }
        break;
      }
    }

    if (dead) bolts.splice(i, 1);
  }
}

function updateEnemyOrbs(state, dt) {
  const orbs = state.orbs;
  const player = state.player;
  const wall = ARENA.wall;
  for (let i = orbs.length - 1; i >= 0; i -= 1) {
    const orb = orbs[i];
    orb.life -= dt;
    orb.x += orb.vx * dt;
    orb.y += orb.vy * dt;
    let dead = orb.life <= 0 || orb.x < wall || orb.x > ARENA.width - wall || orb.y < wall || orb.y > ARENA.height - wall;
    if (!dead && player.alive && player.invulnTime <= 0) {
      const dx = player.x - orb.x;
      const dy = player.y - orb.y;
      const rr = player.radius + orb.radius;
      if (dx * dx + dy * dy < rr * rr) {
        damagePlayer(state, orb.damage, orb.x - orb.vx * 0.05, orb.y - orb.vy * 0.05);
        dead = true;
      }
    }
    if (dead) {
      burst(state, orb.x, orb.y, '#b46bff', 3, 60);
      orbs.splice(i, 1);
    }
  }
}
