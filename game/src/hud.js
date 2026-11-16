// The heads-up display and the upgrade draft cards: everything the player reads while the
// arena stays visible underneath. Text is deliberately big and high-contrast — the bounty
// judge reads screenshots shrunk to a contact sheet, and a player mid-swarm needs the same
// clarity. The draft card rectangles live here so render.js draws exactly what main.js
// hit-tests for clicks.
import { ARENA, FINAL_WAVE } from './state.js';

/** The three draft cards, centred in a row; shared by the renderer and click handling. */
export const DRAFT_CARDS = (() => {
  const width = 308;
  const height = 216;
  const gap = 26;
  const total = width * 3 + gap * 2;
  const y = 300;
  return [0, 1, 2].map((i) => ({
    x: (ARENA.width - total) / 2 + i * (width + gap),
    y,
    width,
    height,
  }));
})();

/** Format seconds as m:ss for the run timer and end screens. */
export function formatTime(seconds) {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

function bar(ctx, x, y, width, height, fraction, fill, back = 'rgba(10,8,24,0.72)') {
  ctx.fillStyle = back;
  ctx.fillRect(x, y, width, height);
  ctx.fillStyle = fill;
  ctx.fillRect(x + 2, y + 2, Math.max(0, (width - 4) * Math.min(1, fraction)), height - 4);
  ctx.strokeStyle = 'rgba(220,225,255,0.5)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x, y, width, height);
}

/** The in-play HUD: health, dash, wave, score, shards, timer, and the boss bar. */
export function drawHud(ctx, state, muted) {
  const player = state.player;
  ctx.textBaseline = 'alphabetic';

  // Health, top-left, with the number inside the bar.
  const hpFraction = player.hp / player.maxHp;
  bar(ctx, 24, 22, 264, 24, hpFraction, hpFraction > 0.3 ? '#59e35f' : '#ff5f6e');
  ctx.fillStyle = '#ffffff';
  ctx.font = '700 16px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(`HP ${Math.ceil(player.hp)} / ${player.maxHp}`, 34, 40);

  // Dash readiness under the health bar: full and bright means ready.
  const dashFraction = 1 - player.dashCooldown / player.dashCooldownMax;
  bar(ctx, 24, 54, 150, 12, dashFraction, dashFraction >= 1 ? '#39d5e8' : '#2a6d7d');
  ctx.fillStyle = dashFraction >= 1 ? '#aef3ff' : '#7d8aa0';
  ctx.font = '700 12px system-ui, sans-serif';
  ctx.fillText(dashFraction >= 1 ? 'DASH READY (SHIFT)' : 'DASH…', 182, 65);

  // Wave and remaining hostiles, top-centre.
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 30px system-ui, sans-serif';
  ctx.fillText(`WAVE ${Math.max(1, state.wave)} / ${FINAL_WAVE}`, ARENA.width / 2, 46);
  const remaining = state.enemies.length + state.spawnQueue.length;
  ctx.font = '600 15px system-ui, sans-serif';
  ctx.fillStyle = '#c9cdea';
  ctx.fillText(remaining > 0 ? `${remaining} spores remain` : 'the garden breathes…', ARENA.width / 2, 70);

  // Score, shards and time, top-right.
  ctx.textAlign = 'right';
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 26px system-ui, sans-serif';
  ctx.fillText(String(state.score), ARENA.width - 24, 42);
  ctx.font = '700 17px system-ui, sans-serif';
  ctx.fillStyle = '#ffd94d';
  ctx.fillText(`◆ ${state.shards} shards`, ARENA.width - 24, 68);
  ctx.fillStyle = '#c9cdea';
  ctx.font = '600 15px system-ui, sans-serif';
  ctx.fillText(formatTime(state.runTime), ARENA.width - 24, 92);

  // The Voidheart's health, a wide bar under the wave counter.
  if (state.boss && state.boss.hp > 0) {
    const boss = state.boss;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e3b3ff';
    ctx.font = '800 16px system-ui, sans-serif';
    ctx.fillText('♥ THE VOIDHEART ♥', ARENA.width / 2, 102);
    bar(ctx, ARENA.width / 2 - 260, 110, 520, 16, boss.hp / boss.maxHp, '#c44dff');
  }

  // Controls reminder, bottom-left, small but legible; mute state bottom-right.
  ctx.textAlign = 'left';
  ctx.fillStyle = 'rgba(180,188,220,0.75)';
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.fillText('WASD move · mouse aim · hold click / Space fire · Shift dash · P pause', 24, ARENA.height - 16);
  if (muted) {
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffb3ba';
    ctx.fillText('MUTED (M)', ARENA.width - 24, ARENA.height - 16);
  }
}

/** Wrap a string to a pixel width, returning the lines. */
export function wrapText(ctx, text, maxWidth) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const word of words) {
    const trial = line === '' ? word : `${line} ${word}`;
    if (ctx.measureText(trial).width > maxWidth && line !== '') {
      lines.push(line);
      line = word;
    } else {
      line = trial;
    }
  }
  if (line !== '') lines.push(line);
  return lines;
}

/** The draft overlay: heading and the three blessing cards from DRAFT_CARDS. */
export function drawDraft(ctx, state) {
  ctx.fillStyle = 'rgba(5,4,16,0.66)';
  ctx.fillRect(0, 0, ARENA.width, ARENA.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.font = '800 40px system-ui, sans-serif';
  ctx.fillText('THE GARDEN OFFERS A BLESSING', ARENA.width / 2, 218);
  ctx.fillStyle = '#ffd94d';
  ctx.font = '700 19px system-ui, sans-serif';
  ctx.fillText(`Wave ${state.wave} cleared — choose one (keys 1 · 2 · 3 or click)`, ARENA.width / 2, 252);

  if (!state.draft) return;
  state.draft.choices.forEach((upgrade, i) => {
    const card = DRAFT_CARDS[i];
    ctx.fillStyle = 'rgba(16,14,34,0.95)';
    ctx.fillRect(card.x, card.y, card.width, card.height);
    ctx.strokeStyle = upgrade.color;
    ctx.lineWidth = 3;
    ctx.strokeRect(card.x, card.y, card.width, card.height);
    // A petal sigil in the blessing's colour.
    ctx.save();
    ctx.translate(card.x + card.width / 2, card.y + 52);
    ctx.fillStyle = upgrade.color;
    for (let p = 0; p < 5; p += 1) {
      ctx.save();
      ctx.rotate((p / 5) * Math.PI * 2);
      ctx.beginPath();
      ctx.ellipse(0, -17, 8, 17, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#0b0918';
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = '#ffffff';
    ctx.font = '800 23px system-ui, sans-serif';
    ctx.fillText(upgrade.name, card.x + card.width / 2, card.y + 116);
    ctx.fillStyle = '#c9cdea';
    ctx.font = '600 15.5px system-ui, sans-serif';
    const lines = wrapText(ctx, upgrade.desc, card.width - 36);
    lines.forEach((line, n) => ctx.fillText(line, card.x + card.width / 2, card.y + 146 + n * 21));
    ctx.fillStyle = upgrade.color;
    ctx.font = '800 17px system-ui, sans-serif';
    ctx.fillText(`[ ${i + 1} ]`, card.x + card.width / 2, card.y + card.height - 14);
  });
}
