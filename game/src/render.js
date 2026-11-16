// Everything drawn: the indigo arena and its starfield, the garden at its heart, every
// entity with its own silhouette, and the title / pause / draft / end screens. Rendering is
// strictly a read of the state — it never mutates the simulation, and its only randomness is
// a private starfield stream, so the simulation stays deterministic. Text is big and bright:
// screenshots are judged shrunk, and players read the HUD mid-swarm.
import { ARENA, SCREEN } from './state.js';
import { createRng } from './rng.js';
import { orbitPetalPositions } from './player.js';
import { drawHud, drawDraft, formatTime } from './hud.js';

const CX = ARENA.width / 2;
const CY = ARENA.height / 2;

/** Create the renderer bound to a canvas; precomputes the starfield once. */
export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const starRng = createRng(987654321);
  const stars = [];
  for (let i = 0; i < 150; i += 1) {
    stars.push({
      x: starRng.range(0, ARENA.width),
      y: starRng.range(0, ARENA.height),
      r: starRng.range(0.6, 1.9),
      phase: starRng.range(0, Math.PI * 2),
    });
  }

  /** Draw the whole frame for the state's current screen. */
  function draw(state, muted) {
    ctx.save();
    if (state.shake > 0.2) {
      const s = state.shake;
      ctx.translate(Math.sin(state.time * 91) * s * 0.5, Math.cos(state.time * 113) * s * 0.5);
    }
    drawBackground(state);
    drawGarden(state);
    drawPickups(state);
    drawOrbs(state);
    drawEnemies(state);
    if (state.screen !== SCREEN.OVER) drawPlayer(state);
    drawBolts(state);
    drawParticles(state);
    drawTexts(state);
    ctx.restore();

    if (state.screen === SCREEN.PLAY || state.screen === SCREEN.DRAFT || state.screen === SCREEN.PAUSED) {
      drawHud(ctx, state, muted);
    }
    if (state.banner && state.screen === SCREEN.PLAY) drawBanner(state);
    if (state.screen === SCREEN.TITLE) drawTitle(state);
    if (state.screen === SCREEN.DRAFT) drawDraft(ctx, state);
    if (state.screen === SCREEN.PAUSED) drawPaused(state);
    if (state.screen === SCREEN.VICTORY) drawEndScreen(state, true);
    if (state.screen === SCREEN.OVER) drawEndScreen(state, false);
    if (state.screen === SCREEN.PLAY) drawDangerVignette(state);
  }

  function drawBackground(state) {
    const gradient = ctx.createRadialGradient(CX, CY, 80, CX, CY, 760);
    gradient.addColorStop(0, '#171233');
    gradient.addColorStop(0.55, '#0d0a22');
    gradient.addColorStop(1, '#060512');
    ctx.fillStyle = gradient;
    ctx.fillRect(-20, -20, ARENA.width + 40, ARENA.height + 40);
    for (const star of stars) {
      const twinkle = 0.45 + 0.4 * Math.sin(state.time * 1.3 + star.phase);
      ctx.fillStyle = `rgba(190,200,255,${twinkle.toFixed(3)})`;
      ctx.fillRect(star.x, star.y, star.r, star.r);
    }
    // The arena wall: a double ring the spores cannot cross.
    ctx.strokeStyle = 'rgba(88,80,180,0.85)';
    ctx.lineWidth = 3;
    ctx.strokeRect(ARENA.wall, ARENA.wall, ARENA.width - ARENA.wall * 2, ARENA.height - ARENA.wall * 2);
    ctx.strokeStyle = 'rgba(50,42,110,0.5)';
    ctx.lineWidth = 10;
    ctx.strokeRect(ARENA.wall - 7, ARENA.wall - 7, ARENA.width - (ARENA.wall - 7) * 2, ARENA.height - (ARENA.wall - 7) * 2);
  }

  /** The garden itself: a flower at the centre that opens one ring per cleared wave. */
  function drawGarden(state) {
    const bloom = state.screen === SCREEN.VICTORY ? 10 : state.gardenBloom;
    const glow = ctx.createRadialGradient(CX, CY, 4, CX, CY, 120 + bloom * 9);
    glow.addColorStop(0, 'rgba(255,120,190,0.20)');
    glow.addColorStop(1, 'rgba(255,120,190,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(CX - 230, CY - 230, 460, 460);
    ctx.save();
    ctx.translate(CX, CY);
    const rings = Math.max(1, bloom);
    for (let ring = 0; ring < rings; ring += 1) {
      const petals = 6 + ring * 2;
      const radius = 13 + ring * 11;
      const size = 9 + ring * 2.5;
      ctx.fillStyle = ring % 2 === 0 ? 'rgba(255,95,162,0.85)' : 'rgba(255,170,90,0.85)';
      for (let i = 0; i < petals; i += 1) {
        const angle = (i / petals) * Math.PI * 2 + ring * 0.4 + state.time * 0.05 * (ring % 2 === 0 ? 1 : -1);
        ctx.save();
        ctx.rotate(angle);
        ctx.beginPath();
        ctx.ellipse(radius, 0, size, size * 0.45, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
    ctx.fillStyle = '#ffd94d';
    ctx.beginPath();
    ctx.arc(0, 0, 8 + bloom, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawPickups(state) {
    for (const shard of state.pickups) {
      const pulse = 1 + 0.18 * Math.sin(state.time * 6 + shard.x);
      ctx.save();
      ctx.translate(shard.x, shard.y);
      ctx.rotate(state.time * 2 + shard.y * 0.05);
      ctx.scale(pulse, pulse);
      ctx.fillStyle = '#ffd94d';
      ctx.shadowColor = '#ffd94d';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(0, -7);
      ctx.lineTo(5, 0);
      ctx.lineTo(0, 7);
      ctx.lineTo(-5, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.shadowBlur = 0;
  }

  function drawOrbs(state) {
    for (const orb of state.orbs) {
      ctx.fillStyle = '#b46bff';
      ctx.shadowColor = '#b46bff';
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, orb.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2a1050';
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, orb.radius * 0.45, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }

  function drawEnemies(state) {
    for (const enemy of state.enemies) {
      if (enemy.kind === 'dasher' && enemy.mode === 'telegraph') {
        ctx.save();
        ctx.strokeStyle = `rgba(255,90,60,${0.35 + 0.3 * Math.sin(state.time * 30)})`;
        ctx.lineWidth = 3;
        ctx.setLineDash([10, 8]);
        ctx.beginPath();
        ctx.moveTo(enemy.x, enemy.y);
        ctx.lineTo(enemy.x + enemy.lungeX * 330, enemy.y + enemy.lungeY * 330);
        ctx.stroke();
        ctx.restore();
      }
      ctx.save();
      ctx.translate(enemy.x, enemy.y);
      const flash = enemy.flash > 0;
      const body = flash ? '#ffffff' : enemy.color;
      switch (enemy.kind) {
        case 'mite':
        case 'mini':
          drawSpiky(body, enemy.radius, 8, state.time * 2 + enemy.wobble);
          break;
        case 'dasher': {
          const p = state.player;
          const facing = enemy.mode === 'chase' || enemy.mode === 'recover'
            ? Math.atan2(p.y - enemy.y, p.x - enemy.x)
            : Math.atan2(enemy.lungeY, enemy.lungeX);
          ctx.rotate(facing);
          ctx.fillStyle = body;
          ctx.beginPath();
          ctx.moveTo(enemy.radius + 5, 0);
          ctx.lineTo(-enemy.radius, -enemy.radius * 0.8);
          ctx.lineTo(-enemy.radius * 0.4, 0);
          ctx.lineTo(-enemy.radius, enemy.radius * 0.8);
          ctx.closePath();
          ctx.fill();
          break;
        }
        case 'splitter':
          ctx.fillStyle = body;
          for (let i = 0; i < 5; i += 1) {
            const a = (i / 5) * Math.PI * 2 + state.time * 1.2;
            ctx.beginPath();
            ctx.arc(Math.cos(a) * enemy.radius * 0.5, Math.sin(a) * enemy.radius * 0.5, enemy.radius * 0.52, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.fillStyle = flash ? '#ffffff' : '#1d5c22';
          ctx.beginPath();
          ctx.arc(0, 0, enemy.radius * 0.34, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'brute':
          ctx.rotate(state.time * 0.4);
          ctx.fillStyle = body;
          ctx.beginPath();
          for (let i = 0; i < 6; i += 1) {
            const a = (i / 6) * Math.PI * 2;
            const px = Math.cos(a) * enemy.radius;
            const py = Math.sin(a) * enemy.radius;
            if (i === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
          ctx.strokeStyle = flash ? '#ffffff' : '#d9c6ff';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.arc(0, 0, enemy.radius * 0.55, 0, Math.PI * 2);
          ctx.stroke();
          break;
        case 'spitter':
          ctx.rotate(state.time * 1.5);
          ctx.fillStyle = body;
          ctx.beginPath();
          ctx.moveTo(0, -enemy.radius - 3);
          ctx.lineTo(enemy.radius + 3, 0);
          ctx.lineTo(0, enemy.radius + 3);
          ctx.lineTo(-enemy.radius - 3, 0);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#062a3d';
          ctx.beginPath();
          ctx.arc(0, 0, 5, 0, Math.PI * 2);
          ctx.fill();
          break;
        case 'boss':
          drawBossHeart(state, enemy, flash);
          break;
        default:
          ctx.fillStyle = body;
          ctx.beginPath();
          ctx.arc(0, 0, enemy.radius, 0, Math.PI * 2);
          ctx.fill();
      }
      ctx.restore();
      // A thin health sliver on anything tougher than a mite.
      if (enemy.maxHp >= 30 && enemy.hp < enemy.maxHp) {
        const w = enemy.radius * 2;
        ctx.fillStyle = 'rgba(8,6,20,0.7)';
        ctx.fillRect(enemy.x - enemy.radius, enemy.y - enemy.radius - 10, w, 4);
        ctx.fillStyle = enemy.kind === 'boss' ? '#c44dff' : '#ff8ae2';
        ctx.fillRect(enemy.x - enemy.radius, enemy.y - enemy.radius - 10, w * Math.max(0, enemy.hp / enemy.maxHp), 4);
      }
    }
  }

  function drawSpiky(color, radius, spikes, rotation) {
    ctx.fillStyle = color;
    ctx.beginPath();
    for (let i = 0; i < spikes * 2; i += 1) {
      const a = rotation + (i / (spikes * 2)) * Math.PI * 2;
      const r = i % 2 === 0 ? radius + 4 : radius * 0.62;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(20,4,24,0.55)';
    ctx.beginPath();
    ctx.arc(0, 0, radius * 0.34, 0, Math.PI * 2);
    ctx.fill();
  }

  /** The Voidheart: a great pulsing heart with a bright core and a spiked crown. */
  function drawBossHeart(state, enemy, flash) {
    const pulse = 1 + 0.07 * Math.sin(state.time * 4.2);
    const r = enemy.radius * pulse;
    ctx.fillStyle = flash ? '#ffffff' : '#751f9e';
    ctx.beginPath();
    for (let i = 0; i < 7; i += 1) {
      const a = -Math.PI / 2 + (i / 6 - 0.5) * 1.9;
      const px = Math.cos(a) * (r + 12);
      const py = Math.sin(a) * (r + 12) - 6;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.fill();
    ctx.fillStyle = flash ? '#ffffff' : '#c44dff';
    ctx.shadowColor = '#c44dff';
    ctx.shadowBlur = 26;
    ctx.beginPath();
    ctx.moveTo(0, r * 0.92);
    ctx.bezierCurveTo(-r * 1.35, -r * 0.1, -r * 0.62, -r * 1.12, 0, -r * 0.42);
    ctx.bezierCurveTo(r * 0.62, -r * 1.12, r * 1.35, -r * 0.1, 0, r * 0.92);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffd94d';
    ctx.beginPath();
    ctx.arc(0, 0, 9 + 3 * Math.sin(state.time * 6), 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPlayer(state) {
    const player = state.player;
    // Orbiting shield petals first, under the ship.
    for (const pos of orbitPetalPositions(state)) {
      ctx.save();
      ctx.translate(pos.x, pos.y);
      ctx.rotate(state.time * 5);
      ctx.fillStyle = '#ff4fd8';
      ctx.beginPath();
      ctx.ellipse(0, 0, 10, 5.5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.save();
    ctx.translate(player.x, player.y);
    if (player.invulnTime > 0 && player.dashTime <= 0) {
      ctx.strokeStyle = `rgba(140,240,255,${0.35 + 0.25 * Math.sin(state.time * 24)})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, player.radius + 7, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.rotate(player.angle);
    // Petal fins behind the hull.
    ctx.fillStyle = '#ff5fa2';
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.rotate(side * 2.35);
      ctx.beginPath();
      ctx.ellipse(-6, 0, 12, 5, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    // Hull: a cyan seed with a bright core.
    const hull = ctx.createRadialGradient(-3, -3, 2, 0, 0, player.radius + 3);
    hull.addColorStop(0, '#bffcff');
    hull.addColorStop(0.45, '#39d5e8');
    hull.addColorStop(1, '#14707f');
    ctx.fillStyle = player.hurtFlash > 0.4 ? '#ffffff' : hull;
    ctx.beginPath();
    ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#083642';
    ctx.beginPath();
    ctx.moveTo(player.radius + 7, 0);
    ctx.lineTo(player.radius - 4, -5.5);
    ctx.lineTo(player.radius - 4, 5.5);
    ctx.closePath();
    ctx.fill();
    if (player.muzzle > 0) {
      ctx.fillStyle = 'rgba(255,240,170,0.9)';
      ctx.beginPath();
      ctx.moveTo(player.radius + 9, 0);
      ctx.lineTo(player.radius + 22, -4.5);
      ctx.lineTo(player.radius + 22, 4.5);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawBolts(state) {
    for (const bolt of state.bolts) {
      ctx.save();
      ctx.translate(bolt.x, bolt.y);
      ctx.rotate(Math.atan2(bolt.vy, bolt.vx));
      ctx.fillStyle = '#ffe3f1';
      ctx.shadowColor = '#ff5fa2';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.ellipse(0, 0, 8, 3.6, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.shadowBlur = 0;
  }

  function drawParticles(state) {
    for (const p of state.particles) {
      const alpha = Math.max(0, p.life / p.ttl);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  function drawTexts(state) {
    ctx.textAlign = 'center';
    for (const t of state.texts) {
      ctx.globalAlpha = Math.max(0, t.life / t.ttl);
      ctx.fillStyle = t.color;
      ctx.font = `800 ${t.size}px system-ui, sans-serif`;
      ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  /** Centre banner for wave announcements, fading in and out over its lifetime. */
  function drawBanner(state) {
    const banner = state.banner;
    const fade = Math.min(1, banner.time / 0.25, (banner.ttl - banner.time) / 0.4);
    ctx.save();
    ctx.globalAlpha = Math.max(0, fade);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 46px system-ui, sans-serif';
    ctx.fillText(banner.title, CX, 168);
    if (banner.sub) {
      ctx.fillStyle = '#ffd94d';
      ctx.font = '700 21px system-ui, sans-serif';
      ctx.fillText(banner.sub, CX, 202);
    }
    ctx.restore();
  }

  /** Red edges closing in when the Bloomkeeper is nearly dead. */
  function drawDangerVignette(state) {
    const player = state.player;
    if (!player.alive || player.hp / player.maxHp > 0.3) return;
    const alpha = 0.16 + 0.12 * Math.sin(state.time * 6);
    const gradient = ctx.createRadialGradient(CX, CY, 240, CX, CY, 720);
    gradient.addColorStop(0, 'rgba(255,30,50,0)');
    gradient.addColorStop(1, `rgba(255,30,50,${alpha.toFixed(3)})`);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, ARENA.width, ARENA.height);
    if (player.hurtFlash > 0) {
      ctx.fillStyle = `rgba(255,40,60,${(player.hurtFlash * 0.1).toFixed(3)})`;
      ctx.fillRect(0, 0, ARENA.width, ARENA.height);
    }
  }

  function drawTitle(state) {
    ctx.fillStyle = 'rgba(5,4,16,0.45)';
    ctx.fillRect(0, 0, ARENA.width, ARENA.height);
    ctx.textAlign = 'center';
    const titleGradient = ctx.createLinearGradient(0, 120, 0, 230);
    titleGradient.addColorStop(0, '#aef3ff');
    titleGradient.addColorStop(0.5, '#39d5e8');
    titleGradient.addColorStop(1, '#ff5fa2');
    ctx.fillStyle = titleGradient;
    ctx.font = '900 104px system-ui, sans-serif';
    ctx.fillText('VOIDBLOOM', CX, 218);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 24px system-ui, sans-serif';
    ctx.fillText('You are the Bloomkeeper — a seed-ship defending the last garden in the void.', CX, 268);
    ctx.fillStyle = '#c9cdea';
    ctx.font = '600 20px system-ui, sans-serif';
    ctx.fillText('Survive 10 waves of void spores. On the last wave, destroy the Voidheart and the garden blooms.', CX, 300);

    ctx.font = '700 21px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    const lines = [
      'WASD / arrows — move        Mouse — aim',
      'Hold click / Space — fire petal bolts        Shift / right-click — dash',
      'Gather gold shards · choose a blessing after every wave · P pause · M mute',
    ];
    lines.forEach((line, i) => ctx.fillText(line, CX, 420 + i * 34));

    const pulse = 0.7 + 0.3 * Math.sin(state.time * 4);
    ctx.globalAlpha = pulse;
    ctx.fillStyle = '#ffd94d';
    ctx.font = '800 30px system-ui, sans-serif';
    ctx.fillText('CLICK OR PRESS ENTER TO PLAY', CX, 580);
    ctx.globalAlpha = 1;
  }

  function drawPaused(state) {
    void state;
    ctx.fillStyle = 'rgba(5,4,16,0.6)';
    ctx.fillRect(0, 0, ARENA.width, ARENA.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 56px system-ui, sans-serif';
    ctx.fillText('PAUSED', CX, 340);
    ctx.fillStyle = '#c9cdea';
    ctx.font = '700 21px system-ui, sans-serif';
    ctx.fillText('Press P or Esc to return to the garden', CX, 386);
  }

  /** Victory and defeat share one layout: the verdict, then the run's numbers. */
  function drawEndScreen(state, victory) {
    ctx.fillStyle = victory ? 'rgba(10,20,10,0.55)' : 'rgba(16,4,10,0.62)';
    ctx.fillRect(0, 0, ARENA.width, ARENA.height);
    ctx.textAlign = 'center';
    ctx.fillStyle = victory ? '#7be382' : '#ff5f6e';
    ctx.font = '900 72px system-ui, sans-serif';
    ctx.fillText(victory ? 'THE GARDEN BLOOMS' : 'THE GARDEN WITHERS', CX, 218);
    ctx.fillStyle = '#ffffff';
    ctx.font = '700 23px system-ui, sans-serif';
    ctx.fillText(
      victory
        ? 'The Voidheart is shattered and colour floods the void. You kept the garden alive.'
        : `The spores overran the garden on wave ${state.wave}. The next seed is already waiting.`,
      CX,
      262,
    );

    const stats = [
      ['SCORE', String(state.score)],
      ['TIME', formatTime(state.runTime)],
      ['WAVE REACHED', `${state.wave} / 10`],
      ['SPORES FELLED', String(state.kills)],
      ['SHARDS GATHERED', String(state.shards)],
    ];
    ctx.font = '800 30px system-ui, sans-serif';
    stats.forEach(([label, value], i) => {
      const y = 336 + i * 44;
      ctx.fillStyle = '#c9cdea';
      ctx.textAlign = 'right';
      ctx.fillText(label, CX - 24, y);
      ctx.fillStyle = '#ffd94d';
      ctx.textAlign = 'left';
      ctx.fillText(value, CX + 24, y);
    });

    const pulse = 0.7 + 0.3 * Math.sin(state.time * 4);
    ctx.globalAlpha = pulse;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.font = '800 26px system-ui, sans-serif';
    ctx.fillText('PRESS R OR CLICK TO PLAY AGAIN', CX, 620);
    ctx.globalAlpha = 1;
  }

  return { draw };
}
