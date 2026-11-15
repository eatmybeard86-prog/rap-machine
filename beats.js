// Генератор и проигрыватель битов. Ударные и 808 — из сэмпл-кита (если выбран) или синтез.

const rnd = (a, b) => a + Math.random() * (b - a);
const ri = (a, b) => Math.floor(rnd(a, b + 1));
const pick = a => a[Math.floor(Math.random() * a.length)];
const chance = p => Math.random() < p;
const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
const MINOR = [0, 2, 3, 5, 7, 8, 10];
const PROGS = [[0, 5, 2, 6], [0, 3, 4, 0], [0, 6, 5, 6], [0, 3, 5, 4], [0, 5, 3, 4], [0, 0, 5, 6], [0, 2, 3, 4], [0, 5, 0, 4], [0, 0, 3, 3]];
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const deg = (root, d) => root + MINOR[((d % 7) + 7) % 7] + 12 * Math.floor(d / 7);
const chord = (root, d, n = 3) => Array.from({ length: n }, (_, i) => deg(root, d + i * 2));
const sortU = a => [...new Set(a)].sort((x, y) => x - y);

// Повторяющийся мелодический рисунок (хук), следующий за аккордом каждого такта
function melody(add, root, prog, { steps, octave, inst, vel = 0.5, accent = 0 }) {
  const idx = steps.map(() => ri(0, 4));
  for (let b = 0; b < 4; b++) {
    const tones = chord(root + octave, prog[b], 5);
    steps.forEach((s, k) => add(b * 16 + s, [inst, tones[idx[k]], k === 0 ? vel + accent : vel]));
  }
}

function bassFromKicks(add, kicks, bar, note, opts = {}) {
  kicks.forEach((k, i) => {
    const next = i + 1 < kicks.length ? kicks[i + 1] : 16;
    const glide = opts.glide && chance(opts.glide) ? note + pick([12, 7, -5, 5, 3]) : null;
    const len = opts.short ? Math.min(2, next - k) : Math.max(1, next - k) * 0.95;
    add(bar * 16 + k, ['b808', note + (opts.oct && chance(opts.oct) ? 12 : 0), len, glide, opts.vel || 0.9]);
  });
}

function hats(add, b, { every = 2, vel = 0.3, rolls = 0, steps }) {
  const list = steps || Array.from({ length: 16 / every }, (_, i) => i * every);
  for (const s of list) add(b * 16 + s, ['hat', (s % 4 ? vel * 0.75 : vel) * rnd(0.85, 1), chance(rolls) ? pick([2, 3, 4, 6]) : 1]);
}

const STYLES = {
  boombap: {
    name: 'Boom Bap', bpm: [84, 96], swing: 0.16, barsPerLine: 1, sat: 10, duck: 0.2,
    gen({ add, root, prog }) {
      const kicks = sortU([0, 10, ...[3, 7, 8, 11, 14].filter(() => chance(0.3))]);
      const chordSteps = [0, ...[6, 10].filter(() => chance(0.5))];
      for (let b = 0; b < 4; b++) {
        kicks.forEach(s => add(b * 16 + s, ['kick', s === 0 ? 1 : 0.85]));
        [4, 12].forEach(s => add(b * 16 + s, ['snare', 1]));
        hats(add, b, { every: 2, vel: 0.45 });
        if (chance(0.4)) add(b * 16 + 14, ['ohat', 0.3]);
        if (b === 3) add(b * 16 + 15, ['snare', 0.35]);
        bassFromKicks(add, kicks, b, deg(root, prog[b]), { vel: 0.75 });
        chordSteps.forEach((s, i) => add(b * 16 + s, ['keys', chord(root + 24, prog[b], 4), i ? 2 : 4, i ? 0.3 : 0.45]));
      }
    },
  },
  trap: {
    name: 'Trap', bpm: [132, 150], swing: 0, barsPerLine: 2, sat: 25, duck: 0.45,
    gen({ add, root, prog }) {
      const kA = sortU([0, ...[3, 6, 7, 10, 11, 14].filter(() => chance(0.3))]);
      const kB = sortU([0, ...[2, 3, 6, 10, 13].filter(() => chance(0.35))]);
      const every = pick([1, 2]);
      for (let b = 0; b < 4; b++) {
        const kicks = b % 2 ? kB : kA;
        kicks.forEach(s => add(b * 16 + s, ['kick', 1]));
        add(b * 16 + 8, ['snare', 1]); add(b * 16 + 8, ['clap', 0.8]);
        hats(add, b, { every, vel: 0.42, rolls: 0.14 });
        bassFromKicks(add, kicks, b, deg(root, prog[b]), { glide: 0.3 });
        add(b * 16, ['pad', chord(root + 24, prog[b], 3), 16, 0.05]);
      }
      melody(add, root, prog, { steps: [0, 3, 6, 8, 11, 14].filter(() => chance(0.8)), octave: 36, inst: 'bell', vel: 0.35 });
    },
  },
  phonk: {
    name: 'Phonk', bpm: [130, 150], swing: 0, barsPerLine: 2, sat: 70, duck: 0.55,
    gen({ add, root, prog }) {
      const kicks = sortU([0, 10, ...[3, 7, 14].filter(() => chance(0.35))]);
      const motif = pick([[0, 3, 6, 8, 10, 12, 14], [0, 2, 4, 6, 8, 10, 12, 14], [0, 3, 6, 9, 12, 14]]);
      const idx = motif.map(() => ri(0, 4));
      for (let b = 0; b < 4; b++) {
        kicks.forEach(s => add(b * 16 + s, ['kick', 1]));
        add(b * 16 + 8, ['snare', 0.9]); add(b * 16 + 8, ['clap', 0.75]);
        hats(add, b, { every: 2, vel: 0.35, rolls: 0.08 });
        if (chance(0.5)) add(b * 16 + 14, ['ohat', 0.3]);
        bassFromKicks(add, kicks, b, deg(root, prog[b]), { glide: 0.25, vel: 0.95 });
        const tones = chord(root + 36, prog[b], 5);
        motif.forEach((s, k) => add(b * 16 + s, ['cowbell', tones[idx[k]], k % 2 ? 0.3 : 0.45]));
      }
    },
  },
  drill: {
    name: 'Drill', bpm: [138, 146], swing: 0, barsPerLine: 2, sat: 35, duck: 0.4,
    gen({ add, root, prog }) {
      const kicks = sortU([0, ...[5, 10, 11].filter(() => chance(0.5))]);
      for (let b = 0; b < 4; b++) {
        kicks.forEach(s => add(b * 16 + s, ['kick', 0.9]));
        add(b * 16 + 8, ['snare', 1]);
        if (chance(0.6)) add(b * 16 + pick([13, 15]), ['snare', 0.6]);
        hats(add, b, { steps: [0, 3, 6, 8, 11, 14], vel: 0.4, rolls: 0.1 });
        const n = deg(root, prog[b]);
        [0, 3, 7, 10].forEach((s, i) => add(b * 16 + s, ['b808', n + (i === 2 ? 12 : 0), 3, chance(0.6) ? n + pick([3, 5, 7, -2]) : null, 0.9]));
      }
      melody(add, root, prog, { steps: [0, 2, 4, 6, 8, 10, 12, 14], octave: 36, inst: 'keys1', vel: 0.28 });
    },
  },
  rage: {
    name: 'Rage', bpm: [150, 165], swing: 0, barsPerLine: 2, sat: 80, duck: 0.65,
    gen({ add, root, prog }) {
      const kicks = sortU([0, 10, ...[6, 13, 14].filter(() => chance(0.4))]);
      const stabs = pick([[0, 3, 6, 10, 12], [0, 3, 6, 8, 11, 14], [0, 4, 7, 10, 13]]);
      for (let b = 0; b < 4; b++) {
        kicks.forEach(s => add(b * 16 + s, ['kick', 1]));
        add(b * 16 + 8, ['snare', 1]); add(b * 16 + 8, ['clap', 0.9]);
        hats(add, b, { every: 1, vel: 0.35, rolls: 0.15 });
        bassFromKicks(add, kicks, b, deg(root, prog[b]), { glide: 0.35, vel: 1 });
        const ch = chord(root + 36, prog[b], 3);
        stabs.forEach(s => add(b * 16 + s, ['saw', ch, 2, 0.22]));
      }
    },
  },
  plugg: {
    name: 'Plugg', bpm: [140, 155], swing: 0, barsPerLine: 2, sat: 8, duck: 0.3,
    gen({ add, root, prog }) {
      const kicks = sortU([0, ...[7, 11, 14].filter(() => chance(0.4))]);
      for (let b = 0; b < 4; b++) {
        kicks.forEach(s => add(b * 16 + s, ['kick', 0.85]));
        add(b * 16 + 8, ['snare', 0.85]);
        hats(add, b, { every: 2, vel: 0.3, rolls: 0.12 });
        bassFromKicks(add, kicks, b, deg(root, prog[b]), { glide: 0.5, vel: 0.8 });
        add(b * 16, ['pad', chord(root + 24, prog[b], 4), 16, 0.04]);
      }
      melody(add, root, prog, { steps: [0, 2, 4, 7, 10, 12].filter(() => chance(0.85)), octave: 36, inst: 'bell', vel: 0.32 });
      melody(add, root, prog, { steps: [6, 14], octave: 48, inst: 'bell', vel: 0.15 });
    },
  },
  jersey: {
    name: 'Jersey Club', bpm: [138, 145], swing: 0, barsPerLine: 2, sat: 20, duck: 0.4,
    gen({ add, root, prog }) {
      const kA = [0, 4, 8, 11, 14], kB = [0, 3, 6, 8, 12];
      for (let b = 0; b < 4; b++) {
        (b % 2 ? kB : kA).forEach(s => add(b * 16 + s, ['kick', 1]));
        [4, 12].forEach(s => add(b * 16 + s, ['clap', 0.85]));
        hats(add, b, { steps: [2, 6, 10, 14], vel: 0.35 });
        [3, 11].forEach(s => chance(0.6) && add(b * 16 + s, ['squeak', 0.3]));
        bassFromKicks(add, b % 2 ? kB : kA, b, deg(root, prog[b]), { short: true, vel: 0.7 });
      }
      melody(add, root, prog, { steps: [0, 2, 6, 8, 12], octave: 36, inst: 'bell', vel: 0.3 });
    },
  },
  brfunk: {
    name: 'Brazil Funk', bpm: [128, 136], swing: 0.05, barsPerLine: 2, sat: 85, duck: 0.5,
    gen({ add, root, prog }) {
      const kicks = [0, 3, 6, 10, 13];
      for (let b = 0; b < 4; b++) {
        kicks.forEach(s => add(b * 16 + s, ['kick', 1]));
        [4, 12].forEach(s => add(b * 16 + s, ['clap', 0.9]));
        [2, 7, 11, 15].forEach(s => add(b * 16 + s, ['rim', 0.55]));
        hats(add, b, { every: 2, vel: 0.25 });
        bassFromKicks(add, kicks, b, deg(root, prog[b]), { short: true, vel: 1 });
        if (chance(0.6)) [6, 14].forEach(s => add(b * 16 + s, ['cowbell', deg(root + 36, prog[b] + 4), 0.3]));
      }
    },
  },
  lofi: {
    name: 'Lo-Fi', bpm: [72, 84], swing: 0.22, barsPerLine: 1, vinyl: true, sat: 5, duck: 0.15,
    gen({ add, root, prog }) {
      const kicks = [0, 7, 10].filter((s, i) => i === 0 || chance(0.7));
      for (let b = 0; b < 4; b++) {
        kicks.forEach(s => add(b * 16 + s, ['kick', 0.75]));
        add(b * 16 + 4, ['rim', 0.6]); add(b * 16 + 12, ['snare', 0.6]);
        for (let s = 0; s < 16; s += 2) if (chance(0.85)) add(b * 16 + s, ['hat', 0.25, 1]);
        bassFromKicks(add, kicks, b, deg(root, prog[b]), { vel: 0.6 });
        add(b * 16, ['keys', chord(root + 24, prog[b], 4), 14, 0.4]);
      }
      melody(add, root, prog, { steps: [2, 7, 9].filter(() => chance(0.7)), octave: 36, inst: 'keys1', vel: 0.2 });
    },
  },
  gfunk: {
    name: 'G-Funk', bpm: [88, 98], swing: 0.08, barsPerLine: 1, sat: 12, duck: 0.25,
    gen({ add, root, prog }) {
      const kicks = sortU([0, 7, 10, ...[3, 14].filter(() => chance(0.4))]);
      for (let b = 0; b < 4; b++) {
        kicks.forEach(s => add(b * 16 + s, ['kick', 0.95]));
        [4, 12].forEach(s => { add(b * 16 + s, ['clap', 0.8]); add(b * 16 + s, ['snare', 0.5]); });
        hats(add, b, { every: 1, vel: 0.3 });
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
    vinyl: !!S.vinyl, sat: S.sat ?? 12, duck: S.duck ?? 0.3, key: NOTE_NAMES[root % 12] + 'm', events,
  };
}

// ---------- Сэмпл-киты ----------
const KIT_CATS = ['kick', 'snare', 'clap', 'hat', 'ohat', '808', 'cowbell', 'rim', 'bell'];
const DEFAULT_ROOTS = { '808': 36, cowbell: 73, bell: 72 };

function categorize(name) {
  const n = name.toLowerCase();
  if (/808|sub|bass/.test(n)) return '808';
  if (/open|ohh|\boh\b|ohat|o-hat|crash|ride/.test(n)) return 'ohat';
  if (/hat|hh|hihat|hi-hat/.test(n)) return 'hat';
  if (/kick|kck|\bbd\b|bassdrum/.test(n)) return 'kick';
  if (/clap|clp/.test(n)) return 'clap';
  if (/snare|snr|\bsd\b/.test(n)) return 'snare';
  if (/cowbell|cow/.test(n)) return 'cowbell';
  if (/bell|pluck|chime/.test(n)) return 'bell';
  if (/rim|perc|shaker|tamb/.test(n)) return 'rim';
  return null;
}

async function decodeAll(entries) { // entries: [{cat, data:ArrayBuffer}]
  const dc = new OfflineAudioContext(1, 1, 44100);
  const all = {};
  await Promise.all(entries.map(async e => {
    try {
      const buf = await dc.decodeAudioData(e.data);
      (all[e.cat] = all[e.cat] || []).push(buf);
    } catch (err) { console.warn('Не удалось декодировать', e.name, err); }
  }));
  return all;
}

function makeKit(name, all, roots) {
  const kit = { name, all, roots: { ...DEFAULT_ROOTS, ...(roots || {}) }, cur: {} };
  kit.reroll = () => { for (const c of Object.keys(all)) kit.cur[c] = pick(all[c]); };
  kit.reroll();
  kit.count = Object.values(all).reduce((n, a) => n + a.length, 0);
  return kit;
}

async function loadKitFromIndex(entry) {
  const list = [];
  for (const [cat, files] of Object.entries(entry.files)) for (const f of files) list.push({ cat, name: f, url: entry.path + f });
  const entries = await Promise.all(list.map(async x => ({ ...x, data: await (await fetch(x.url)).arrayBuffer() })));
  return makeKit(entry.name, await decodeAll(entries), entry.roots);
}

async function loadKitFromFiles(fileList, name) {
  const files = [...fileList].filter(f => /\.(wav|mp3|ogg|flac|aif|aiff|m4a)$/i.test(f.name));
  const byCat = {};
  for (const f of files) {
    const cat = categorize((f.webkitRelativePath || '') + '/' + f.name);
    if (cat) (byCat[cat] = byCat[cat] || []).push(f);
  }
  const entries = [];
  for (const [cat, fs] of Object.entries(byCat)) {
    // из больших паков берём до 24 случайных звуков на категорию
    const chosen = fs.length > 24 ? fs.sort(() => Math.random() - 0.5).slice(0, 24) : fs;
    for (const f of chosen) entries.push({ cat, name: f.name, data: await f.arrayBuffer() });
  }
  return makeKit(name, await decodeAll(entries));
}

// ---------- Движок ----------
const DRUM_LOW = new Set(['kick', 'b808', 'snare', 'clap']);

class BeatEngine {
  constructor(ctx, out) {
    this.ctx = ctx; this.out = out; this.playing = false;
    const len = ctx.sampleRate;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    this.custom = null; // { buffer, bpm, name }
    this.kit = null;
    this.introBars = 0;
  }

  get barsPerLine() { return this.custom ? 1 : this.pattern.barsPerLine; }
  get bpm() { return this.custom ? this.custom.bpm : this.pattern.bpm; }
  get barDur() { return (60 / this.bpm) * 4; }

  setPattern(p) { this.pattern = p; this.custom = null; if (this.kit) this.kit.reroll(); }
  setCustom(buffer, bpm, name) { this.custom = { buffer, bpm, name }; }
  setKit(kit) { this.kit = kit; }

  start(delay = 0.1) {
    this.stop(true);
    const c = this.ctx;
    this.bus = c.createGain(); this.bus.gain.value = 0.7; this.bus.connect(this.out);
    this.startTime = c.currentTime + delay;
    this.playing = true;
    if (this.custom) {
      const s = c.createBufferSource(); s.buffer = this.custom.buffer; s.loop = true;
      s.connect(this.bus); s.start(this.startTime); this.customSrc = s;
      return;
    }
    // drumBus — ударные; musicBus (808, мелодия) проходит через сайдчейн-«качалку» от бочки
    this.drumBus = c.createGain(); this.drumBus.connect(this.bus);
    this.duckG = c.createGain(); this.duckG.connect(this.bus);
    this.musicBus = c.createGain(); this.musicBus.connect(this.duckG);
    this.sat = c.createWaveShaper(); this.sat.curve = distCurve(this.pattern.sat); this.sat.oversample = '2x';
    this.satOut = c.createGain(); this.satOut.gain.value = 1 / (1 + this.pattern.sat / 80);
    this.sat.connect(this.satOut).connect(this.duckG);
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

  position() { return this.playing ? (this.ctx.currentTime - this.startTime) / this.barDur : -1; }

  tick() {
    const ahead = this.ctx.currentTime + 0.15;
    while (this.nextTime < ahead) {
      const swing = this.step % 2 ? this.pattern.swing * this.stepDur : 0;
      const t = this.nextTime + swing;
      const bar = Math.floor(this.step / 16), sib = this.step % 16;
      const rel = bar - this.introBars;
      for (const [inst, ...args] of this.pattern.events[this.step % 64]) {
        // Аранжировка: вступление без бочки/808/снейра — они «падают» вместе с первой строкой текста
        if (rel < 0 && DROP(inst)) continue;
        // Каждые 8 тактов — брейк: вторая половина такта без бочки и 808
        if (rel >= 0 && rel % 8 === 7 && sib >= 8 && (inst === 'kick' || inst === 'b808')) continue;
        this[inst](t, ...args);
      }
      if (rel >= 0 && rel % 8 === 7 && sib >= 8 && sib % 2 === 0) this.snare(t, 0.25 + (sib - 8) * 0.06); // сбивка перед следующей частью
      this.nextTime += this.stepDur;
      this.step++;
    }
  }

  // Проигрывание сэмпла из кита. Возвращает source или null, если в ките нет такой категории.
  samp(t, cat, v, { rate = 1, dest, dur } = {}) {
    const buf = this.kit && this.kit.cur[cat];
    if (!buf) return null;
    const s = this.ctx.createBufferSource(), g = this.ctx.createGain();
    s.buffer = buf; s.playbackRate.value = rate; g.gain.value = v;
    s.connect(g).connect(dest || this.drumBus);
    s.start(t);
    if (dur) {
      g.gain.setValueAtTime(v, t + dur);
      g.gain.linearRampToValueAtTime(0, t + dur + 0.06);
      s.stop(t + dur + 0.08);
    }
    return s;
  }

  duck(t) {
    const amt = this.pattern.duck || 0;
    if (!amt) return;
    const g = this.duckG.gain;
    g.setTargetAtTime(1 - amt, t, 0.004);
    g.setTargetAtTime(1, t + 0.03, 0.09);
  }

  env(t, v, attack, decay) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    return g;
  }

  noise(t, type, freq, v, decay, q = 0.7, dest = this.drumBus) {
    const c = this.ctx, s = c.createBufferSource(), f = c.createBiquadFilter();
    s.buffer = this.noiseBuf; f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = this.env(t, v, 0.001, decay);
    s.connect(f).connect(g).connect(dest);
    s.start(t, Math.random() * 0.5); s.stop(t + decay + 0.05);
  }

  tone(t, type, freq, v, decay, dest = this.drumBus) {
    const o = this.ctx.createOscillator(); o.type = type; o.frequency.value = freq;
    const g = this.env(t, v, 0.001, decay);
    o.connect(g).connect(dest); o.start(t); o.stop(t + decay + 0.05);
    return o;
  }

  kick(t, v = 1) {
    this.duck(t);
    if (this.samp(t, 'kick', v)) return;
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.frequency.setValueAtTime(170, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.11);
    g.gain.setValueAtTime(v, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
    o.connect(g).connect(this.drumBus); o.start(t); o.stop(t + 0.45);
    this.noise(t, 'highpass', 3000, v * 0.15, 0.01);
  }
  snare(t, v = 1) {
    if (this.samp(t, 'snare', v * 0.8)) return;
    this.noise(t, 'highpass', 1400, v * 0.55, 0.18);
    this.noise(t, 'bandpass', 3500, v * 0.3, 0.1, 1);
    this.tone(t, 'triangle', 190, v * 0.45, 0.08);
  }
  clap(t, v = 1) {
    if (this.samp(t, 'clap', v * 0.8)) return;
    for (let i = 0; i < 3; i++) this.noise(t + i * 0.011, 'bandpass', 1300, v * 0.6, i === 2 ? 0.16 : 0.015, 1.5);
  }
  hat(t, v = 0.3, n = 1) {
    for (let i = 0; i < n; i++) {
      const ti = t + (i * this.stepDur) / n, vi = n > 1 ? v * (0.6 + 0.4 * (i / n)) : v;
      if (!this.samp(ti, 'hat', vi * 0.7)) this.noise(ti, 'highpass', 8000, vi * 0.5, 0.035);
    }
  }
  ohat(t, v = 0.3) { if (!this.samp(t, 'ohat', v * 0.6, { dur: 0.35 })) this.noise(t, 'highpass', 7000, v * 0.5, 0.28); }
  rim(t, v = 0.6) {
    if (this.samp(t, 'rim', v * 0.7)) return;
    this.tone(t, 'square', 1700, v * 0.12, 0.02); this.tone(t, 'triangle', 820, v * 0.3, 0.04);
  }
  squeak(t, v = 0.3) {
    const o = this.ctx.createOscillator();
    o.frequency.setValueAtTime(1700, t); o.frequency.exponentialRampToValueAtTime(2700, t + 0.06);
    const g = this.env(t, v * 0.25, 0.005, 0.07);
    o.connect(g).connect(this.drumBus); o.start(t); o.stop(t + 0.1);
  }

  b808(t, m, durSteps, glide, v = 0.9) {
    const dur = durSteps * this.stepDur;
    const root = this.kit && this.kit.roots['808'];
    const s = this.samp(t, '808', v, { rate: Math.pow(2, (m - root) / 12), dest: this.sat, dur });
    if (s) {
      if (glide) {
        s.playbackRate.setValueAtTime(Math.pow(2, (m - root) / 12), t + dur * 0.55);
        s.playbackRate.exponentialRampToValueAtTime(Math.pow(2, (glide - root) / 12), t + dur * 0.85);
      }
      return;
    }
    const c = this.ctx, o = c.createOscillator(), g = c.createGain();
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

  cowbell(t, m, v = 0.4) {
    const root = this.kit && this.kit.roots.cowbell;
    if (this.samp(t, 'cowbell', v * 0.7, { rate: Math.pow(2, (m - root) / 12), dest: this.musicBus })) return;
    const c = this.ctx, f = mtof(m), bp = c.createBiquadFilter();
    bp.type = 'bandpass'; bp.frequency.value = f * 1.3; bp.Q.value = 1.4;
    const g = this.env(t, v * 0.35, 0.001, 0.3);
    bp.connect(g).connect(this.musicBus);
    for (const k of [1, 1.48]) {
      const o = c.createOscillator(); o.type = 'square'; o.frequency.value = f * k;
      o.connect(bp); o.start(t); o.stop(t + 0.35);
    }
  }

  bell(t, m, v = 0.35) {
    const root = this.kit && this.kit.roots.bell;
    if (this.samp(t, 'bell', v * 0.6, { rate: Math.pow(2, (m - root) / 12), dest: this.musicBus, dur: 1.2 })) return;
    const c = this.ctx, f = mtof(m);
    const car = c.createOscillator(), mod = c.createOscillator(), mg = c.createGain();
    car.frequency.value = f; mod.frequency.value = f * 3.5;
    mg.gain.setValueAtTime(f * 2, t); mg.gain.exponentialRampToValueAtTime(1, t + 0.8);
    mod.connect(mg).connect(car.frequency);
    const g = this.env(t, v * 0.5, 0.002, 1.1);
    car.connect(g).connect(this.musicBus);
    car.start(t); mod.start(t); car.stop(t + 1.2); mod.stop(t + 1.2);
  }

  keys(t, notes, durSteps, v = 0.4) {
    const c = this.ctx, dur = durSteps * this.stepDur;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1800;
    const g = c.createGain(), n = notes.length;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v / n, t + 0.01);
    g.gain.exponentialRampToValueAtTime((v / n) * 0.4, t + 0.3);
    g.gain.setValueAtTime((v / n) * 0.4, t + dur);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.4);
    lp.connect(g).connect(this.musicBus);
    for (const m of notes) {
      for (const [type, det] of [['triangle', 0], ['sine', 6]]) {
        const o = c.createOscillator(); o.type = type; o.frequency.value = mtof(m); o.detune.value = det;
        o.connect(lp); o.start(t); o.stop(t + dur + 0.5);
      }
    }
  }
  keys1(t, m, v) { this.keys(t, [m], 1.5, v); }

  // Rage-суперсо: 5 расстроенных пил на ноту
  saw(t, notes, durSteps, v = 0.22) {
    const c = this.ctx, dur = durSteps * this.stepDur;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 2;
    lp.frequency.setValueAtTime(5000, t); lp.frequency.exponentialRampToValueAtTime(1800, t + dur);
    const g = c.createGain(), amp = v / notes.length / 2.5;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(amp, t + 0.008);
    g.gain.setValueAtTime(amp * 0.8, t + dur);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.15);
    lp.connect(g).connect(this.musicBus);
    for (const m of notes) for (const det of [-24, -11, 0, 11, 24]) {
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(m); o.detune.value = det;
      o.connect(lp); o.start(t); o.stop(t + dur + 0.2);
    }
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
    o.connect(g).connect(this.musicBus);
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
    lp.connect(g).connect(this.musicBus);
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
function DROP(inst) { return DRUM_LOW.has(inst); }
