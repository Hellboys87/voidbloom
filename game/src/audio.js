// All sound is synthesized with WebAudio — no audio files. A tiny synth plays the effects
// (petal shots, hits, deaths, pickups, dashes, stingers) and a quiet two-oscillator pad loops
// underneath. The context is created lazily on the first user gesture, as browsers require;
// M or setMuted() silences everything. Every effect is a few oscillators with envelopes, so
// the whole soundscape costs no assets and no network.

/** Create the sound engine. Call unlock() from a click or key handler before expecting sound. */
export function createAudio() {
  let ctx = null;
  let master = null;
  let padGain = null;
  let muted = false;
  let lastShotAt = 0;

  function unlock() {
    if (ctx) {
      if (ctx.state === 'suspended') void ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? window.webkitAudioContext;
    if (!Ctor) return;
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
    startPad();
  }

  /** A slow indigo pad: two detuned triangles through a lowpass, breathing on an LFO. */
  function startPad() {
    padGain = ctx.createGain();
    padGain.gain.value = 0.05;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 420;
    for (const freq of [55, 55.4, 110.2]) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      osc.connect(filter);
      osc.start();
    }
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.02;
    lfo.connect(lfoGain);
    lfoGain.connect(padGain.gain);
    lfo.start();
    filter.connect(padGain);
    padGain.connect(master);
  }

  /** One enveloped tone; the building block of every effect. */
  function tone(freqFrom, freqTo, seconds, type, volume, delay = 0) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqFrom, t0);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqTo), t0 + seconds);
    gain.gain.setValueAtTime(volume, t0);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + seconds);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + seconds + 0.02);
  }

  /** A burst of filtered noise for deaths and dashes. */
  function noise(seconds, volume, freq, delay = 0) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + delay;
    const length = Math.max(1, Math.floor(ctx.sampleRate * seconds));
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(t0);
  }

  /** Play a named game event ('shoot', 'hit', 'die', 'pickup', 'dash', ...). */
  function play(name) {
    if (!ctx || muted) return;
    switch (name) {
      case 'shoot': {
        const now = performance.now();
        if (now - lastShotAt < 45) return; // a stream of bolts needs one voice, not fifty
        lastShotAt = now;
        tone(880, 420, 0.07, 'square', 0.05);
        break;
      }
      case 'hit':
        tone(300, 180, 0.05, 'square', 0.06);
        break;
      case 'die':
        tone(520, 60, 0.22, 'sawtooth', 0.1);
        noise(0.18, 0.08, 900);
        break;
      case 'split':
        tone(340, 700, 0.12, 'square', 0.07);
        break;
      case 'pickup':
        tone(1180, 1560, 0.06, 'sine', 0.07);
        break;
      case 'dash':
        noise(0.14, 0.1, 1600);
        tone(220, 660, 0.12, 'sine', 0.04);
        break;
      case 'hurt':
        tone(160, 70, 0.2, 'sawtooth', 0.16);
        noise(0.12, 0.1, 300);
        break;
      case 'orb':
        tone(240, 140, 0.12, 'sine', 0.05);
        break;
      case 'upgrade':
        tone(523, 523, 0.1, 'sine', 0.1);
        tone(659, 659, 0.1, 'sine', 0.1, 0.09);
        tone(784, 1046, 0.18, 'sine', 0.12, 0.18);
        break;
      case 'wave':
        tone(392, 392, 0.12, 'triangle', 0.12);
        tone(587, 587, 0.2, 'triangle', 0.12, 0.11);
        break;
      case 'boss':
        tone(98, 49, 0.7, 'sawtooth', 0.16);
        tone(147, 73, 0.7, 'square', 0.08, 0.05);
        break;
      case 'victory':
        for (const [i, f] of [523, 659, 784, 1046].entries()) tone(f, f, 0.24, 'triangle', 0.12, i * 0.13);
        break;
      case 'defeat':
        for (const [i, f] of [392, 330, 262, 196].entries()) tone(f, f * 0.94, 0.3, 'triangle', 0.12, i * 0.16);
        break;
      default:
        break;
    }
  }

  return {
    unlock,
    play,
    setMuted(value) {
      muted = value;
      if (master && ctx) master.gain.setTargetAtTime(value ? 0 : 0.5, ctx.currentTime, 0.02);
    },
    isMuted() {
      return muted;
    },
  };
}
