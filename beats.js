// Генератор и проигрыватель битов: всё синтезируется в реальном времени, без сэмплов.

const rnd = (a, b) => a + Math.random() * (b - a);
const ri = (a, b) => Math.floor(rnd(a, b + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const chance = p => Math.random() < p;
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const PROGS = [[0, 5, 2, 6], [0, 3, 4, 0], [0, 6, 5, 6], [0, 3, 5, 4], [0, 5, 3, 4], [0, 0, 5, 6], [0, 2, 3, 4], [0, 5, 0, 4]];
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const deg = (root, d) => root + MINOR[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
const chord = (root, d, n = 3) => Array.from({ length: n }, (_, i) => deg(root, d + i * 2));

// Повторяющийся мелодический рисунок, следующий за аккордом каждого такта
function melody(add, root, prog, { steps, octave, inst, vel = 0.5, bars = 4 }) {
  const idx = steps.map(() => ri(0, 4));
  for (let b = 0; b < bars; b++) {
    const tones = chord(root + octave, prog[b], 5);
    steps.forEach((s, k) => add(b * 16 + s, [inst, tones[idx[k]], vel]));
  }
}

function bassFromKicks(add, kicks, bar, note, opts = {}) {
  kicks.forEach((k, i) => {
    const next = i + 1 < kicks.length ? kicks[i + 1] : 16;
    const glide = opts.glide && chance(opts.glide) ? note + pick([12, 7, -5, 5]) : null;
    add(bar * 16 + k, ['b808', note + (opts.oct && chance(opts.oct) ? 12 : 0), Math.max(1, next - k) * 0.95, glide, opts.vel || 0.9]);
  });
}

const STYLES = {
  boombap: {
    name: 'Boom Bap', bpm: [84, 96], swing: 0.16, barsPerLine: 1,
    gen({ add, root, prog }) {
      const kicks = [...new Set([0, 10, ...[3, 7, 8, 11, 14].filter(() => chance(0.3))])].sort((a, b) => a - b);
      const chordSteps = [0, ...[6, 10].filter(() => chance(0.5))];
      for (let b = 0; b < 4; b++) {
        kicks.forEach(s => add(b * 16 + s, ['kick', s === 0 ? 1 : 0.85]));
        [4, 12].forEach(s => add(b * 16 + s, ['snare', 1]));
        for (let s = 0; s < 16; s += 2) add(b * 16 + s, ['hat', s % 4 ? 0.3 : 0.5, 1]);
        if (chance(0.4)) add(b * 16 + 14, ['ohat', 0.3]);
        if (b === 3) add(b * 16 + 15, ['snare', 0.35]);
        bassFromKicks(add, kicks, b, deg(root, prog[b]), { vel: 0.75 });
        chordSteps.forEach((s, i) => add(b * 16 + s, ['keys', chord(root + 24, prog[b], 4), i ? 2 : 4, i ? 0.3 : 0.45]));
      }
    },
  },
  trap: {
    name: 'Trap', bpm: [132, 150], swing: 0, barsPerLine: 2,
    gen({ add, root, prog }) {
      const kA = [...new Set([0, ...[3, 6, 7, 10, 11, 14].filter(() => chance(0.3))])].sort((a, b) => a - b);
      const kB = [...new Set([0, ...[2, 3, 6, 10, 13].filter(() => chance(0.35))])].sort((a, b) => a - b);
      const hatMode = pick([1, 2]);
      for (let b = 0; b < 4; b++) {
        const kicks = b % 2 ? kB : kA;
        kicks.forEach(s => add(b * 16 + s, ['kick', 1]));
        add(b * 16 + 8, ['snare', 1]); add(b * 16 + 8, ['clap', 0.8]);
        for (let s = 0; s < 16; s += hatMode) {
          const roll = chance(0.14) ? pick([2, 3, 4]) : 1;
          add(b * 16 + s, ['hat', s % 4 ? 0.28 : 0.42, roll]);
        }
        bassFromKicks(add, kicks, b, deg(root, prog[b]), { glide: 0.3 });
        add(b * 16, ['pad', chord(root + 24, prog[b], 3), 16, 0.05]);
      }
      melody(add, root, prog, { steps: [0, 3, 6, 8, 11, 14].filter(() => chance(0.8)), octave: 36, inst: 'bell', vel: 0.35 });
    },
  },
  drill: {
    name: 'Drill', bpm: [138, 146], swing: 0, barsPerLine: 2,
    gen({ add, root, prog }) {
      const hats = [0, 3, 6, 8, 11, 14];
      const kicks = [0, ...[5, 10, 11].filter(() => chance(0.5))].sort((a, b) => a - b);
      for (let b = 0; b < 4; b++) {
        kicks.forEach(s => add(b * 16 + s, ['kick', 0.9]));
        add(b * 16 + 8, ['snare', 1]);
        if (chance(0.6)) add(b * 16 + pick([13, 15]), ['snare', 0.6]);
        hats.forEach(s => add(b * 16 + s, ['hat', 0.35, chance(0.1) ? 3 : 1]));
        const notes = [0, 3, 7, 10].map(s => s);
        const n = deg(root, prog[b]);
        notes.forEach((s, i) => add(b * 16 + s, ['b808', n + (i === 2 ? 12 : 0), 3, chance(0.6) ? n + pick([3, 5, 7, -2]) : null, 0.9]));
      }
      melody(add, root, prog, { steps: [0, 2, 4, 6, 8, 10, 12, 14], octave: 36, inst: 'keys1', vel: 0.28 });
    },
  },
  lofi: {
    name: 'Lo-Fi', bpm: [72, 84], swing: 0.22, barsPerLine: 1, vinyl: true,
    gen({ add, root, prog }) {
      const kicks = [0, 7, 10].filter((s, i) => i === 0 || chance(0.7));
      for (let b = 0; b < 4; b++) {
        kicks.forEach(s => add(b * 16 + s, ['kick', 0.75]));
        add(b * 16 + 4, ['rim', 0.6]); add(b * 16 + 12, ['snare', 0.6]);
        for (let s = 0; s < 16; s += 2) if (chance(0.85)) add(b * 16 + s, ['hat', 0.18, 1]);
        bassFromKicks(add, kicks, b, deg(root, prog[b]), { vel: 0.6 });
        add(b * 16, ['keys', chord(root + 24, prog[b], 4), 14, 0.4]);
      }
      melody(add, root, prog, { steps: [2, 7, 9].filter(() => chance(0.7)), octave: 36, inst: 'keys1', vel: 0.2 });
    },
  },
  gfunk: {
    name: 'G-Funk', bpm: [88, 98], swing: 0.08, barsPerLine: 1,
    gen({ add, root, prog }) {
      const kicks = [0, 7, 10, ...[3, 14].filter(() => chance(0.4))].sort((a, b) => a - b);
      for (let b = 0; b < 4; b++) {
        kicks.forEach(s => add(b * 16 + s, ['kick', 0.95]));
        [4, 12].forEach(s => { add(b * 16 + s, ['clap', 0.8]); add(b * 16 + s, ['snare', 0.5]); });
        for (let s = 0; s < 16; s++) add(b * 16 + s, ['hat', s % 2 ? 0.15 : 0.3, 1]);
        bassFromKicks(add, kicks, b, deg(root, prog[b]), { oct: 0.3, vel: 0.8 });
        [2, 6, 10, 14].forEach(s => add(b * 16 + s, ['keys', chord(root + 24, prog[b], 3), 1, 0.25]));
        const tones = chord(root + 36, prog[b], 5);
        add(b * 16, ['lead', tones[ri(1, 4)], 6]);
        add(b * 16 + 8, ['lead', tones[ri(0, 4)], 7]);
      }
    },
  },
};

function generateBeat(styleKey) {
  if (!STYLES[styleKey]) styleKey = pick(Object.keys(STYLES));
  const S = STYLES[styleKey];
  const root = 33 + ri(0, 11); // A1..G#2
  const prog = pick(PROGS);
  const events = Array.from({ length: 64 }, () => []);
  const add = (s, e) => events[s % 64].push(e);
  S.gen({ add, root, prog });
  return {
    style: styleKey, name: S.name, bpm: ri(...S.bpm), swing: S.swing, barsPerLine: S.barsPerLine,
    vinyl: !!S.vinyl, key: NOTE_NAMES[root % 12] + 'm', events,
  };
}

class BeatEngine {
  constructor(ctx, out) {
    this.ctx = ctx; this.out = out; this.playing = false;
    const len = ctx.sampleRate;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.custom = null; // { buffer, bpm, name }
  }

  get barsPerLine() { return this.custom ? 1 : this.pattern.barsPerLine; }
  get bpm() { return this.custom ? this.custom.bpm : this.pattern.bpm; }
  get barDur() { return (60 / this.bpm) * 4; }

  setPattern(p) { this.pattern = p; this.custom = null; }
  setCustom(buffer, bpm, name) { this.custom = { buffer, bpm, name }; }

  start(delay = 0.1) {
    this.stop(true);
    const c = this.ctx;
    this.bus = c.createGain(); this.bus.connect(this.out);
    this.startTime = c.currentTime + delay;
    this.playing = true;
    if (this.custom) {
      const s = c.createBufferSource(); s.buffer = this.custom.buffer; s.loop = true;
      s.connect(this.bus); s.start(this.startTime); this.customSrc = s;
      return;
    }
    this.sat = c.createWaveShaper(); this.sat.curve = distCurve(12); this.sat.connect(this.bus);
    this.stepDur = 60 / this.pattern.bpm / 4;
    this.step = 0; this.nextTime = this.startTime;
    this.timer = setInterval(() => this.tick(), 25);
    this.tick();
    if (this.pattern.vinyl) this.startVinyl();
  }

  stop(immediate) {
    if (!this.playing) return;
    this.playing = false;
    clearInterval(this.timer);
    const bus = this.bus, t = this.ctx.currentTime;
    bus.gain.setTargetAtTime(0, t, immediate ? 0.01 : 0.05);
    setTimeout(() => bus.disconnect(), 600);
    for (const k of ['customSrc', 'vinylSrc']) {
      if (this[k]) { try { this[k].stop(t + 0.3); } catch (e) {} this[k] = null; }
    }
  }

  position() { // позиция в тактах от старта
    return this.playing ? (this.ctx.currentTime - this.startTime) / this.barDur : -1;
  }

  tick() {
    const ahead = this.ctx.currentTime + 0.15;
    while (this.nextTime < ahead) {
      const swing = this.step % 2 ? this.pattern.swing * this.stepDur : 0;
      const t = this.nextTime + swing;
      for (const [inst, ...args] of this.pattern.events[this.step % 64]) this[inst](t, ...args);
      this.nextTime += this.stepDur;
      this.step++;
    }
  }

  env(t, v, attack, decay, node) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    return g;
  }

  noise(t, type, freq, v, decay, q = 0.7, dest = this.bus) {
    const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter();
    s.buffer = this.noiseBuf; f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = this.env(t, v, 0.001, decay);
    s.connect(f).connect(g).connect(dest);
    s.start(t, Math.random() * 0.5); s.stop(t + decay + 0.05);
  }

  tone(t, type, freq, v, decay, dest = this.bus) {
    const o = this.ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = this.env(t, v, 0.001, decay);
    o.connect(g).connect(dest); o.start(t); o.stop(t + decay + 0.05);
    return o;
  }

  kick(t, v = 1) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(170, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.11);
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
    o.connect(g).connect(this.bus); o.start(t); o.stop(t + 0.45);
    this.noise(t, 'highpass', 3000, v * 0.15, 0.01);
  }
  snare(t, v = 1) {
    this.noise(t, 'highpass', 1400, v * 0.55, 0.18);
    this.noise(t, 'bandpass', 3500, v * 0.3, 0.1, 1);
    this.tone(t, 'triangle', 190, v * 0.45, 0.08);
  }
  clap(t, v = 1) {
    for (let i = 0; i < 3; i++) this.noise(t + i * 0.011, 'bandpass', 1300, v * 0.6, i === 2 ? 0.16 : 0.015, 1.5);
  }
  hat(t, v = 0.3, n = 1) {
    for (let i = 0; i < n; i++) this.noise(t + (i * this.stepDur) / n, 'highpass', 8000, v * 0.5, 0.035);
  }
  ohat(t, v = 0.3) { this.noise(t, 'highpass', 7000, v * 0.5, 0.28); }
  rim(t, v = 0.6) { this.tone(t, 'square', 1700, v * 0.12, 0.02); this.tone(t, 'triangle', 820, v * 0.3, 0.04); }

  b808(t, m, durSteps, glide, v = 0.9) {
    const c = this.ctx, dur = durSteps * this.stepDur, o = c.createOscillator(), g = c.createGain();
    const f = mtof(m);
    o.frequency.setValueAtTime(f, t);
    if (glide) {
      o.frequency.setValueAtTime(f, t + dur * 0.55);
      o.frequency.exponentialRampToValueAtTime(mtof(glide), t + dur * 0.85);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + 0.006);
    g.gain.setValueAtTime(v * 0.85, t + Math.max(0.01, dur - 0.05));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.08);
    o.connect(g).connect(this.sat); o.start(t); o.stop(t + dur + 0.1);
  }

  keys(t, notes, durSteps, v = 0.4) {
    const c = this.ctx, dur = durSteps * this.stepDur;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v / notes.length, t + 0.01);
    g.gain.exponentialRampToValueAtTime((v / notes.length) * 0.4, t + 0.3);
    g.gain.setValueAtTime((v / notes.length) * 0.4, t + dur);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.4);
    lp.connect(g).connect(this.bus);
    for (const m of notes) {
      for (const [type, det] of [['triangle', 0], ['sine', 6]]) {
        const o = c.createOscillator(); o.type = type; o.frequency.value = mtof(m); o.detune.value = det;
        o.connect(lp); o.start(t); o.stop(t + dur + 0.5);
      }
    }
  }
  keys1(t, m, v) { this.keys(t, [m], 1.5, v); }

  bell(t, m, v = 0.35) {
    const c = this.ctx, f = mtof(m);
    const car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain();
    car.frequency.value = f; mod.frequency.value = f * 3.5;
    mg.gain.setValueAtTime(f * 2, t); mg.gain.exponentialRampToValueAtTime(1, t + 0.8);
    mod.connect(mg).connect(car.frequency);
    const g = this.env(t, v * 0.5, 0.002, 1.1);
    car.connect(g).connect(this.bus);
    car.start(t); mod.start(t); car.stop(t + 1.2); mod.stop(t + 1.2);
  }

  lead(t, m, durSteps) {
    const c = this.ctx, dur = durSteps * this.stepDur, f = mtof(m);
    const o = c.createOscillator(); o.type = 'sine';
    const prev = this._leadPrev || f;
    o.frequency.setValueAtTime(prev, t);
    o.frequency.exponentialRampToValueAtTime(f, t + 0.12);
    this._leadPrev = f;
    const lfo = c.createOscillator(), la = c.createGain();
    lfo.frequency.value = 5.5; la.gain.value = f * 0.012;
    lfo.connect(la).connect(o.frequency);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.12, t + 0.06);
    g.gain.setValueAtTime(0.12, t + dur);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.2);
    o.connect(g).connect(this.bus);
    o.start(t); lfo.start(t); o.stop(t + dur + 0.25); lfo.stop(t + dur + 0.25);
  }

  pad(t, notes, durSteps, v = 0.05) {
    const c = this.ctx, dur = durSteps * this.stepDur;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + 0.4);
    g.gain.setValueAtTime(v, t + dur - 0.1);
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.3);
    lp.connect(g).connect(this.bus);
    for (const m of notes) for (const det of [-8, 8]) {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = det;
      o.connect(lp); o.start(t); o.stop(t + dur + 0.4);
    }
  }

  startVinyl() {
    const c = this.ctx, len = c.sampleRate * 3, buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * 0.015 + (Math.random() < 0.0004 ? (Math.random() * 2 - 1) * 0.6 : 0);
    const s = c.createBufferSource(); s.buffer = buf; s.loop = true;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2500; f.Q.value = 0.5;
    s.connect(f).connect(this.bus); s.start(this.startTime);
    this.vinylSrc = s;
  }
}
