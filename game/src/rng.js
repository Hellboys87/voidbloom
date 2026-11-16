// The seeded random source: a mulberry32 generator. Every random choice the simulation makes
// (spawns, drops, draft picks, particle jitter) draws from one of these, so a run — and every
// staged screenshot scene — is fully determined by its seed. Rendering-only decoration uses
// its own generator and never touches the simulation's stream.

/** Create a deterministic random generator from a 32-bit seed. */
export function createRng(seed) {
  let state = seed >>> 0;
  if (state === 0) state = 0x9e3779b9;
  /** Next float in [0, 1). */
  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    /** Float in [min, max). */
    range(min, max) {
      return min + next() * (max - min);
    },
    /** Integer in [min, max] inclusive. */
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    /** True with probability p. */
    chance(p) {
      return next() < p;
    },
    /** A random element of a non-empty array. */
    pick(items) {
      return items[Math.floor(next() * items.length)];
    },
  };
}
