// VOIDBLOOM's hand-in program (Node 22, standard library only). The game itself is the static
// files under game/ — plain ES modules a desktop browser loads offline, no build step and no
// network. This program copies game/ and screenshots/ from beside this file into the output
// directory and writes dossier.json there with the vendored make.fun library, exactly as the
// best-game-01 rules require. The grader runs it twice and both runs must write the same bytes.
//
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The scorer's own caps, mirrored from the kit so a local run refuses what the scorer would:
// at most 4 screenshots of at most 256 KiB, at most 993 files and 48 MiB under game/, no path
// under game/ over 1000 bytes, and the dossier's source text capped at 160 KiB.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
