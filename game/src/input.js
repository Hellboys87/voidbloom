// Keyboard and mouse input: a held-keys set, the mouse position in arena coordinates, and a
// small queue of one-shot actions (confirm, pause, dash, restart, draft picks). main.js reads
// the continuous state every step and drains the action queue every frame, so no key press is
// ever lost between frames and nothing depends on event timing inside the simulation.

/** One-shot action bits returned by takeActions(). */
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_DASH = 4;
export const ACTION_RESTART = 8;
export const ACTION_MUTE = 16;
/** Draft picks ride in bits 5..7 as (pick index + 1) << 5; see takeDraftPick(). */

const DRAFT_KEYS = ['Digit1', 'Digit2', 'Digit3'];

/**
 * Attach input listeners to the canvas and window. Returns the live input object the loop
 * reads: continuous movement/aim/firing for the simulation, plus queued one-shot actions.
 */
export function createInput(canvas) {
  const keys = new Set();
  const input = {
    mouseX: 640,
    mouseY: 300,
    mouseDown: false,
    actions: 0,
    draftPick: -1,
    clickX: -1,
    clickY: -1,
    clicked: false,

    /** Movement as a unit vector from WASD / arrow keys. */
    moveVector() {
      let x = 0;
      let y = 0;
      if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
      if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
      if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
      if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
      if (x !== 0 && y !== 0) {
        x *= Math.SQRT1_2;
        y *= Math.SQRT1_2;
      }
      return { x, y };
    },

    /** Firing is the mouse button held, or Space held. */
    firing() {
      return input.mouseDown || keys.has('Space');
    },

    /** Drain the one-shot action bits queued since the last frame. */
    takeActions() {
      const actions = input.actions;
      input.actions = 0;
      return actions;
    },

    /** Drain a draft pick: a number key 1-3, or -1 for none. */
    takeDraftPick() {
      const pick = input.draftPick;
      input.draftPick = -1;
      return pick;
    },

    /** Drain a mouse click (arena coordinates) for menus and draft cards. */
    takeClick() {
      const click = { x: input.clickX, y: input.clickY, hit: input.clicked };
      input.clicked = false;
      return click;
    },
  };

  function toArena(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas.height,
    };
  }

  window.addEventListener('keydown', (event) => {
    if (event.code === 'Space' || event.code.startsWith('Arrow')) event.preventDefault();
    if (event.repeat) return;
    keys.add(event.code);
    if (event.code === 'Enter' || event.code === 'Space') input.actions |= ACTION_CONFIRM;
    if (event.code === 'KeyP' || event.code === 'Escape') input.actions |= ACTION_PAUSE;
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') input.actions |= ACTION_DASH;
    if (event.code === 'KeyR') input.actions |= ACTION_RESTART;
    if (event.code === 'KeyM') input.actions |= ACTION_MUTE;
    const draftIndex = DRAFT_KEYS.indexOf(event.code);
    if (draftIndex !== -1) input.draftPick = draftIndex;
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousemove', (event) => {
    const point = toArena(event);
    input.mouseX = point.x;
    input.mouseY = point.y;
  });
  canvas.addEventListener('mousedown', (event) => {
    const point = toArena(event);
    input.mouseX = point.x;
    input.mouseY = point.y;
    if (event.button === 0) {
      input.mouseDown = true;
      input.clickX = point.x;
      input.clickY = point.y;
      input.clicked = true;
      input.actions |= ACTION_CONFIRM;
    }
    if (event.button === 2) input.actions |= ACTION_DASH;
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) input.mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return input;
}
