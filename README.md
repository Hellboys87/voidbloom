# VOIDBLOOM

**Defend the last garden in the void.** You are the Bloomkeeper, a small seed-ship holding a
single flowering garden against ten waves of void spores. Gather the gold light shards the
fallen drop, take a blessing after every wave, and on the final wave destroy the
**Voidheart** — then the garden blooms.

An original 2D arena-survival game for the make.fun bounty *Make the best game*
(best-game-01), written as plain static files: HTML5 canvas, ES modules, no build step, no
network, no external assets. All art is drawn in code; all sound is synthesized live with
WebAudio.

## Controls

| Input | Action |
| --- | --- |
| WASD / arrow keys | Move |
| Mouse | Aim |
| Hold left mouse / Space | Fire petal bolts |
| Shift / right-click | Dash (brief invulnerability, cooldown) |
| 1 / 2 / 3 or click a card | Choose a blessing in the upgrade draft |
| P / Esc | Pause |
| M | Mute |
| R / click | Restart from the victory or defeat screen |

## How a run works

- **Waves.** Ten waves of spores spawn from the arena's edges in growing numbers and mixes;
  health and speed scale slightly each wave. The garden at the centre opens one ring of
  petals for every wave cleared.
- **Enemies.** Chaser mites (magenta, hunt you down), dashers (orange, pause and telegraph a
  lunge), splitters (green, burst into two minis), brutes (violet, slow and very tough, from
  wave 4), spitters (cyan, keep their distance and lob void orbs, from wave 5) — and on wave
  10 the **Voidheart**: a great pulsing heart that sheds radial bullet rings, spiral shots
  below two-thirds health, and summoned mites.
- **Shards.** Kills drop gold light shards that drift, then fly to you inside your magnet
  radius. Shards are score and proof of a good harvest.
- **Upgrade draft.** Clearing a wave pauses the game and offers three blessings — fire rate,
  damage, +1 projectile, move speed, max HP and healing, faster dash, wider magnet, piercing
  bolts, an orbiting petal shield, regeneration. All stack, so every run grows its own build.
- **Win / lose.** Destroy the Voidheart on wave 10 to bloom the garden (victory screen with
  score, time, waves, kills, shards). If your HP reaches zero the garden withers — same stats,
  and R restarts at once.

Feedback everywhere: particles on hits and deaths, floating damage numbers, hit flash,
knockback, muzzle flash, screen shake, a low-HP vignette that pulses as you near death, wave
banners, and a procedural soundscape (shots, hits, pickups, dashes, stingers, a quiet pad).

## Run it locally

```sh
node serve.ts            # serves game/ at http://localhost:8080
# or: node serve.ts --port 8901
```

Then open the address in desktop Chrome and click to play. Any static file server pointed at
`game/` works just as well.

Deterministic staged scenes (used for the screenshots in `screenshots/`) come from the
starter's convention: `?shot=start|play|upgrade|end&seed=1`, described in `shots.json`. The
simulation runs on a fixed 1/60 s timestep with a seeded RNG, decoupled from rendering, so a
seed always produces the same run and the same frame.

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to the output directory and writes
`dossier.json` there with `buildDossier` from the vendored `vendor/makefun-game.ts`
(byte-for-byte the kit's copy). Run twice, the bytes are identical.

## File structure

```
main.ts                  the hand-in program: copy game/ + screenshots/, write dossier.json
serve.ts                 tiny local static server for game/ (development only)
shots.json               the staged screenshot scenes
vendor/makefun-game.ts   the kit's dossier library, unchanged
game/
  index.html             the page: canvas, styles, screen-reader status line
  src/
    main.js              boot, the fixed-step loop, screen flow, sound-event draining
    state.js             the whole game state and the one-step update that advances it
    input.js             keyboard/mouse state and the one-shot action queue
    rng.js               the seeded mulberry32 generator behind all simulation randomness
    audio.js             the WebAudio synth: every effect plus the pad loop
    player.js            the Bloomkeeper: movement, dash, firing, orbiting petal shield
    enemies.js           the six spore kinds and the Voidheart: behaviour, damage, death
    bullets.js           petal bolts and void orbs, with piercing and collisions
    particles.js         particles, floating combat text, and the gold shard pickups
    waves.js             the wave director: compositions, spawn pacing, scaling
    upgrades.js          the blessing pool and the between-wave draft
    render.js            all drawing: arena, garden, entities, title/pause/end screens
    hud.js               the in-play HUD, the boss bar, and the draft cards
    shots.js             the deterministic staged scenes behind ?shot=
screenshots/             four real renders of the game (cover first)
```

## License

MIT — see `LICENSE`.
