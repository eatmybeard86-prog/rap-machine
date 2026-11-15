// Цепочка обработки голоса в реальном времени (Web Audio API)

// AudioWorklet: два питч-шифтера (основной голос + "дабл") и биткрашер.
const WORKLET_SRC = `
class Shifter {
  constructor(N, win) { this.N = N; this.win = win; this.ph = 0; }
  next(buf, w, ratio) {
    this.ph += (1 - ratio) / this.win;
    this.ph -= Math.floor(this.ph);
    const p1 = this.ph, p2 = (this.ph + 0.5) % 1;
    const g1 = 1 - Math.abs(2 * p1 - 1), g2 = 1 - Math.abs(2 * p2 - 1);
    return this.read(buf, w, p1 * this.win) * g1 + this.read(buf, w, p2 * this.win) * g2;
  }
  read(buf, w, d) {
    const N = this.N;
    let p = w - d; while (p < 0) p += N;
    const i = Math.floor(p), f = p - i;
    const a = buf[i % N], b = buf[(i + 1) % N];
    return a + (b - a) * f;
  }
}
class VoxProc extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'pitch', defaultValue: 1, minValue: 0.1, maxValue: 4, automationRate: 'k-rate' },
      { name: 'dblPitch', defaultValue: 0.5, minValue: 0.1, maxValue: 4, automationRate: 'k-rate' },
      { name: 'dblMix', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'bits', defaultValue: 16, minValue: 1, maxValue: 16, automationRate: 'k-rate' },
      { name: 'down', defaultValue: 1, minValue: 1, maxValue: 64, automationRate: 'k-rate' },
    ];
  }
  constructor() {
    super();
    this.N = 8192; this.buf = new Float32Array(this.N); this.w = 0;
    this.a = new Shifter(this.N, 2048); this.b = new Shifter(this.N, 2400);
    this.hold = 0; this.cnt = 0;
  }
  process(inputs, outputs, params) {
    const inp = inputs[0] && inputs[0][0];
    const out = outputs[0]; if (!out || !out[0]) return true;
    const o = out[0];
    const ratio = params.pitch[0], r2 = params.dblPitch[0], mix2 = params.dblMix[0];
    const bits = params.bits[0], down = Math.max(1, Math.round(params.down[0]));
    const q = Math.pow(2, bits - 1);
    const shiftA = Math.abs(ratio - 1) > 0.0005;
    for (let n = 0; n < o.length; n++) {
      const x = inp ? inp[n] : 0;
      this.w = (this.w + 1) % this.N;
      this.buf[this.w] = x;
      let y = shiftA ? this.a.next(this.buf, this.w, ratio) : x;
      if (mix2 > 0.001) y = y * (1 - mix2 * 0.4) + this.b.next(this.buf, this.w, r2) * mix2;
      if (bits < 15.9) y = Math.round(y * q) / q;
      if (down > 1) { if (this.cnt++ % down === 0) this.hold = y; y = this.hold; }
      o[n] = y;
    }
    for (let c = 1; c < out.length; c++) out[c].set(o);
    return true;
  }
}
registerProcessor('vox-proc', VoxProc);
`;

async function loadWorklet(ctx) {
  // При открытии index.html двойным кликом (file://) blob-URL может не загрузиться — пробуем data-URL
  const urls = [
    () => URL.createObjectURL(new Blob([WORKLET_SRC], { type: 'application/javascript' })),
    () => 'data:application/javascript;charset=utf-8,' + encodeURIComponent(WORKLET_SRC),
  ];
  let lastErr;
  for (const make of urls) {
    try { await ctx.audioWorklet.addModule(make()); return; } catch (e) { lastErr = e; }
  }
  throw lastErr;
}

function distCurve(amount) {
  const k = amount * 2; // 0..200
  const n = 2048, c = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    c[i] = k === 0 ? x : ((1 + k) * x) / (1 + k * Math.abs(x));
  }
  return c;
}

function reverbImpulse(ctx, seconds) {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  }
  return buf;
}

// Описание пульта: каналы (strips), у каждого фейдер + крутилки.
// map: 'lin' | 'log'. neutral — значение при выключенной кнопке ON.
const STRIPS = [
  { id: 'mic', name: 'MIC', color: 'blue', on: true,
    fader: { id: 'gain', label: 'Уровень', min: 0, max: 3, step: 0.01, def: 1, fmt: v => (20 * Math.log10(Math.max(v, 0.001))).toFixed(1) + 'dB' },
    knobs: [{ id: 'lowcut', label: 'LOW CUT', min: 20, max: 1000, def: 80, map: 'log', neutral: 20, fmt: v => Math.round(v) + 'Hz' }] },
  { id: 'pitch', name: 'PITCH', color: 'yellow', on: true,
    fader: { id: 'semi', label: 'Тон', min: -12, max: 12, step: 0.5, def: 0, neutral: 0, fmt: v => (v > 0 ? '+' : '') + v + ' пт' },
    knobs: [{ id: 'fine', label: 'FINE', min: -100, max: 100, def: 0, neutral: 0, fmt: v => Math.round(v) + 'ц' }] },
  { id: 'double', name: 'DOUBLE', color: 'yellow', on: true,
    fader: { id: 'dblMix', label: 'Второй голос', min: 0, max: 1, step: 0.01, def: 0, neutral: 0, fmt: v => Math.round(v * 100) + '%' },
    knobs: [{ id: 'dblSemi', label: 'ТОН 2', min: -24, max: 24, def: -12, step: 1, fmt: v => (v > 0 ? '+' : '') + Math.round(v) + ' пт' }] },
  { id: 'tone', name: 'ТЕМБР', color: 'blue', on: true,
    fader: { id: 'tilt', label: 'Глубже ↔ Ярче', min: -12, max: 12, step: 0.5, def: 0, neutral: 0, fmt: v => (v > 0 ? 'ярче ' : v < 0 ? 'глубже ' : '') + Math.abs(v) },
    knobs: [
      { id: 'low', label: 'LOW', min: -15, max: 15, def: 0, neutral: 0, fmt: v => v.toFixed(1) + 'dB' },
      { id: 'mid', label: 'MID', min: -15, max: 15, def: 0, neutral: 0, fmt: v => v.toFixed(1) + 'dB' },
      { id: 'high', label: 'HIGH', min: -15, max: 15, def: 0, neutral: 0, fmt: v => v.toFixed(1) + 'dB' }] },
  { id: 'robot', name: 'ROBOT', color: 'red', on: true,
    fader: { id: 'ringMix', label: 'Робот', min: 0, max: 1, step: 0.01, def: 0, neutral: 0, fmt: v => Math.round(v * 100) + '%' },
    knobs: [{ id: 'ringFreq', label: 'ЧАСТОТА', min: 5, max: 1500, def: 50, map: 'log', fmt: v => Math.round(v) + 'Hz' }] },
  { id: 'crush', name: 'CRUSH', color: 'red', on: true,
    fader: { id: 'crush', label: 'Биткраш', min: 0, max: 1, step: 0.01, def: 0, neutral: 0, fmt: v => Math.round(16 - v * 14) + 'бит' },
    knobs: [{ id: 'down', label: 'SAMPLE', min: 1, max: 40, def: 1, step: 1, neutral: 1, fmt: v => '÷' + Math.round(v) }] },
  { id: 'dist', name: 'DIST', color: 'red', on: true,
    fader: { id: 'drive', label: 'Перегруз', min: 0, max: 100, step: 1, def: 0, neutral: 0, fmt: v => Math.round(v) + '%' },
    knobs: [{ id: 'distTone', label: 'ТОН', min: 800, max: 16000, def: 8000, map: 'log', neutral: 16000, fmt: v => (v / 1000).toFixed(1) + 'k' }] },
  { id: 'filter', name: 'FILTER', color: 'blue', on: true,
    fader: { id: 'cutoff', label: 'Срез', min: 150, max: 20000, def: 20000, map: 'log', neutral: 20000, fmt: v => v >= 1000 ? (v / 1000).toFixed(1) + 'k' : Math.round(v) },
    knobs: [{ id: 'reso', label: 'RESO', min: 0.5, max: 18, def: 0.7, neutral: 0.7, fmt: v => v.toFixed(1) }] },
  { id: 'chorus', name: 'CHORUS', color: 'yellow', on: true,
    fader: { id: 'chMix', label: 'Хорус', min: 0, max: 1, step: 0.01, def: 0, neutral: 0, fmt: v => Math.round(v * 100) + '%' },
    knobs: [
      { id: 'chRate', label: 'RATE', min: 0.1, max: 8, def: 1.5, map: 'log', fmt: v => v.toFixed(1) + 'Hz' },
      { id: 'chDepth', label: 'DEPTH', min: 0, max: 1, def: 0.5, fmt: v => Math.round(v * 100) + '%' }] },
  { id: 'echo', name: 'ECHO', color: 'blue', on: true,
    fader: { id: 'echoMix', label: 'Эхо', min: 0, max: 1, step: 0.01, def: 0, neutral: 0, fmt: v => Math.round(v * 100) + '%' },
    knobs: [
      { id: 'echoTime', label: 'TIME', min: 0.05, max: 1.2, def: 0.33, fmt: v => Math.round(v * 1000) + 'ms' },
      { id: 'echoFb', label: 'REPEAT', min: 0, max: 0.9, def: 0.35, fmt: v => Math.round(v * 100) + '%' }] },
  { id: 'reverb', name: 'REVERB', color: 'blue', on: true,
    fader: { id: 'revMix', label: 'Ревёрб', min: 0, max: 1, step: 0.01, def: 0, neutral: 0, fmt: v => Math.round(v * 100) + '%' },
    knobs: [{ id: 'revSize', label: 'SIZE', min: 0.3, max: 6, def: 2, fmt: v => v.toFixed(1) + 's' }] },
];

const MASTER = [
  { id: 'vocal', label: 'ГОЛОС', min: 0, max: 2, step: 0.01, def: 1 },
  { id: 'beat', label: 'БИТ', min: 0, max: 1.5, step: 0.01, def: 0.8 },
  { id: 'monitor', label: '🎧 СЛУХ', min: 0, max: 1.5, step: 0.01, def: 0 },
];

const PRESETS = {
  'Чисто': {},
  'Низкий бас': { semi: -4, tilt: -5, low: 4, revMix: 0.12 },
  'Демон': { semi: -7, dblMix: 0.7, dblSemi: -12, tilt: -6, drive: 25, revMix: 0.3, revSize: 3 },
  'Бурундук': { semi: 9, tilt: 4 },
  'Робот': { ringMix: 0.85, ringFreq: 55, chMix: 0.4, chRate: 0.4, crush: 0.2 },
  'Телефон': { lowcut: 450, cutoff: 3200, reso: 2, drive: 30, mid: 6, crush: 0.25 },
  'Радио': { lowcut: 300, cutoff: 5000, drive: 15, mid: 4, high: -4 },
  '8-бит': { crush: 0.82, down: 10, semi: 3 },
  'Пещера': { revMix: 0.7, revSize: 5, echoMix: 0.35, echoTime: 0.45, echoFb: 0.45, tilt: -3 },
  'Трэп-эхо': { echoMix: 0.3, echoTime: 0.22, echoFb: 0.4, revMix: 0.2, high: 3 },
  'Хор': { dblMix: 0.6, dblSemi: 12, chMix: 0.7, chDepth: 0.8, revMix: 0.35 },
  'Монстр': { semi: -12, dblMix: 0.5, dblSemi: -5, drive: 55, ringMix: 0.3, ringFreq: 30, tilt: -8 },
};

class VocalChain {
  constructor(ctx) {
    this.ctx = ctx;
    const c = ctx;
    this.input = c.createGain();
    this.hp = c.createBiquadFilter(); this.hp.type = 'highpass'; this.hp.Q.value = 0.7;
    try {
      this.proc = new AudioWorkletNode(c, 'vox-proc', { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1] });
    } catch (e) {
      // Ворклет недоступен — работаем без питча/краша, но всё остальное (и бит) играет
      console.warn('AudioWorklet недоступен:', e);
      this.proc = c.createGain();
      this.noWorklet = true;
    }
    this.shaper = c.createWaveShaper(); this.shaper.oversample = '4x';
    this.distLp = c.createBiquadFilter(); this.distLp.type = 'lowpass';
    this.distComp = c.createGain();
    this.tiltLo = c.createBiquadFilter(); this.tiltLo.type = 'lowshelf'; this.tiltLo.frequency.value = 700;
    this.tiltHi = c.createBiquadFilter(); this.tiltHi.type = 'highshelf'; this.tiltHi.frequency.value = 1800;
    this.eqLo = c.createBiquadFilter(); this.eqLo.type = 'lowshelf'; this.eqLo.frequency.value = 180;
    this.eqMid = c.createBiquadFilter(); this.eqMid.type = 'peaking'; this.eqMid.frequency.value = 1500; this.eqMid.Q.value = 0.9;
    this.eqHi = c.createBiquadFilter(); this.eqHi.type = 'highshelf'; this.eqHi.frequency.value = 5000;
    this.lp = c.createBiquadFilter(); this.lp.type = 'lowpass';

    // Ring-модулятор (робот)
    this.ringIn = c.createGain();
    this.ringDry = c.createGain(); this.ringWet = c.createGain();
    this.ringMod = c.createGain(); this.ringMod.gain.value = 0;
    this.ringOsc = c.createOscillator(); this.ringOsc.connect(this.ringMod.gain); this.ringOsc.start();
    this.ringOut = c.createGain();
    this.ringIn.connect(this.ringDry).connect(this.ringOut);
    this.ringIn.connect(this.ringMod).connect(this.ringWet).connect(this.ringOut);

    // Хорус
    this.chOut = c.createGain();
    this.chWet = c.createGain();
    this.chDelay = c.createDelay(0.1); this.chDelay.delayTime.value = 0.02;
    this.chLfo = c.createOscillator(); this.chLfoAmt = c.createGain();
    this.chLfo.connect(this.chLfoAmt).connect(this.chDelay.delayTime); this.chLfo.start();
    this.ringOut.connect(this.chOut);
    this.ringOut.connect(this.chDelay).connect(this.chWet).connect(this.chOut);

    this.comp = c.createDynamicsCompressor();
    this.comp.threshold.value = -20; this.comp.ratio.value = 3; this.comp.attack.value = 0.005; this.comp.release.value = 0.15;
    this.makeup = c.createGain(); this.makeup.gain.value = 1.4;

    this.out = c.createGain();
    // Эхо
    this.echoSend = c.createGain(); this.delay = c.createDelay(2); this.fb = c.createGain();
    this.echoLp = c.createBiquadFilter(); this.echoLp.type = 'lowpass'; this.echoLp.frequency.value = 4000;
    this.echoSend.connect(this.delay); this.delay.connect(this.echoLp).connect(this.fb).connect(this.delay);
    this.echoLp.connect(this.out);
    // Ревёрб
    this.revSend = c.createGain(); this.conv = c.createConvolver();
    this.revSend.connect(this.conv).connect(this.out);

    this.input.connect(this.hp).connect(this.proc).connect(this.shaper).connect(this.distLp).connect(this.distComp)
      .connect(this.tiltLo).connect(this.tiltHi).connect(this.eqLo).connect(this.eqMid).connect(this.eqHi)
      .connect(this.lp).connect(this.ringIn);
    this.chOut.connect(this.comp).connect(this.makeup);
    this.makeup.connect(this.out);
    this.makeup.connect(this.echoSend);
    this.makeup.connect(this.revSend);

    this.values = {};
    this.stripOn = {};
    this.revSizeApplied = 0;
  }

  P(name) {
    if (this.noWorklet) return { setTargetAtTime() {}, setValueAtTime() {} };
    return this.proc.parameters.get(name);
  }

  // Эффективное значение с учётом кнопки ON канала
  eff(stripId, p) {
    if (this.stripOn[stripId] === false && p.neutral !== undefined) return p.neutral;
    return this.values[p.id] ?? p.def;
  }

  applyAll() {
    const t = this.ctx.currentTime, s = (param, v) => param.setTargetAtTime(v, t, 0.02);
    const v = {};
    for (const st of STRIPS) for (const p of [st.fader, ...st.knobs]) v[p.id] = this.eff(st.id, p);
    const micOn = this.stripOn.mic !== false;
    s(this.input.gain, micOn ? v.gain : 0);
    s(this.hp.frequency, v.lowcut);
    s(this.P('pitch'), Math.pow(2, (v.semi + v.fine / 100) / 12));
    s(this.P('dblPitch'), Math.pow(2, v.dblSemi / 12));
    s(this.P('dblMix'), v.dblMix);
    this.P('bits').setValueAtTime(16 - v.crush * 14, t);
    this.P('down').setValueAtTime(v.down, t);
    if (this._drive !== v.drive) { this.shaper.curve = distCurve(v.drive); this._drive = v.drive; }
    s(this.distLp.frequency, v.distTone);
    s(this.distComp.gain, 1 / (1 + v.drive / 60));
    s(this.tiltLo.gain, -v.tilt); s(this.tiltHi.gain, v.tilt);
    s(this.eqLo.gain, v.low); s(this.eqMid.gain, v.mid); s(this.eqHi.gain, v.high);
    s(this.lp.frequency, v.cutoff); s(this.lp.Q, v.reso);
    s(this.ringOsc.frequency, v.ringFreq);
    s(this.ringDry.gain, 1 - v.ringMix); s(this.ringWet.gain, v.ringMix * 1.4);
    s(this.chLfo.frequency, v.chRate); s(this.chLfoAmt.gain, 0.002 + v.chDepth * 0.008);
    s(this.chWet.gain, v.chMix);
    s(this.echoSend.gain, v.echoMix); s(this.delay.delayTime, v.echoTime); s(this.fb.gain, v.echoFb);
    s(this.revSend.gain, v.revMix * 1.5);
    if (Math.abs(this.revSizeApplied - v.revSize) > 0.05) {
      clearTimeout(this._revT);
      this._revT = setTimeout(() => { this.conv.buffer = reverbImpulse(this.ctx, v.revSize); this.revSizeApplied = v.revSize; }, 120);
    }
  }
}
