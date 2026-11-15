// Генератор собственного драм-кита Rap Machine (CC0). Запуск: node tools/make-kit.js
// Весь звук синтезируется математикой — никаких чужих сэмплов.
const fs = require('fs');
const path = require('path');

const SR = 44100;
const KIT = 'rm-pro';
const out = path.join(__dirname, '..', 'kits', KIT);
fs.mkdirSync(out, { recursive: true });

let seed = 12345;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed / 2147483647) * 2 - 1; };
const TAU = Math.PI * 2;
const len = s => Math.floor(s * SR);

function biquad(type, f, q = 0.707) {
  const w = (TAU * f) / SR, c = Math.cos(w), s = Math.sin(w), al = s / (2 * q);
  let b0, b1, b2;
  const a0 = 1 + al, a1 = -2 * c, a2 = 1 - al;
  if (type === 'lp') { b0 = (1 - c) / 2; b1 = 1 - c; b2 = b0; }
  else if (type === 'hp') { b0 = (1 + c) / 2; b1 = -(1 + c); b2 = b0; }
  else { b0 = al; b1 = 0; b2 = -al; } // bandpass
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  return x => {
    const y = (b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x; y2 = y1; y1 = y;
    return y;
  };
}
const sat = (x, d) => Math.tanh(x * d) / Math.tanh(d);

function save(name, a, peak = 0.89) {
  let m = 0; for (const x of a) m = Math.max(m, Math.abs(x));
  const g = m ? peak / m : 1;
  // короткий fade-out, чтобы не было щелчка в конце
  const fade = Math.min(len(0.01), a.length);
  for (let i = 0; i < fade; i++) a[a.length - 1 - i] *= i / fade;
  const buf = Buffer.alloc(44 + a.length * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + a.length * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(a.length * 2, 40);
  a.forEach((x, i) => buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, x * g)) * 32767), 44 + i * 2));
  fs.writeFileSync(path.join(out, name + '.wav'), buf);
  return name + '.wav';
}

function kick({ f0, f1, pd, dec, drive, click, dur = 0.7 }) {
  const a = new Float32Array(len(dur)); let ph = 0;
  const hp = biquad('hp', 2500);
  for (let i = 0; i < a.length; i++) {
    const t = i / SR, f = f1 + (f0 - f1) * Math.exp(-t / pd);
    ph += (TAU * f) / SR;
    let s = Math.sin(ph) * Math.exp(-t / dec) * Math.min(1, t / 0.0015);
    if (t < 0.006) s += hp(rnd()) * click * (1 - t / 0.006);
    a[i] = sat(s, drive);
  }
  return a;
}

function bass808({ dec, drive, punch = 0.8, dur = 2.2 }) {
  const f = 65.406; // C2 = MIDI 36
  const a = new Float32Array(len(dur)); let ph = 0;
  const lp = biquad('lp', 2500);
  for (let i = 0; i < a.length; i++) {
    const t = i / SR;
    ph += (TAU * f * (1 + punch * Math.exp(-t / 0.018))) / SR;
    const env = Math.min(1, t / 0.003) * Math.exp(-t / dec);
    a[i] = lp(sat(Math.sin(ph) * env, drive));
  }
  return a;
}

function snare({ tone = 190, ndec = 0.13, bp = 3200, body = 0.6, dur = 0.4 }) {
  const a = new Float32Array(len(dur)); let ph = 0;
  const b = biquad('bp', bp, 0.7), h = biquad('hp', 1200);
  for (let i = 0; i < a.length; i++) {
    const t = i / SR;
    ph += (TAU * (tone + 60 * Math.exp(-t / 0.01))) / SR;
    const tn = Math.sin(ph) * Math.exp(-t / 0.05) * body;
    const nz = h(b(rnd())) * Math.exp(-t / ndec) * 2.2;
    a[i] = sat(tn + nz, 1.4);
  }
  return a;
}

function clap({ bp = 1300, tail = 0.13, dur = 0.45 }) {
  const a = new Float32Array(len(dur));
  const b = biquad('bp', bp, 1.1);
  const hits = [0, 0.011, 0.022, 0.031];
  for (let i = 0; i < a.length; i++) {
    const t = i / SR; let env = 0;
    for (const h of hits) if (t >= h) env = Math.max(env, Math.exp(-(t - h) / 0.0035));
    if (t >= 0.031) env = Math.max(env, 0.7 * Math.exp(-(t - 0.031) / tail));
    a[i] = b(rnd()) * env;
  }
  return a;
}

function hat({ dec, bright = 1, dur }) {
  const a = new Float32Array(len(dur || dec * 6 + 0.02));
  const freqs = [205.3, 304.4, 369.6, 522.7, 540, 800].map(f => f * 1.7 * bright);
  const ph = freqs.map(() => 0);
  const h = biquad('hp', 7000), b = biquad('bp', 10500, 0.8);
  for (let i = 0; i < a.length; i++) {
    const t = i / SR; let s = 0;
    freqs.forEach((f, k) => { ph[k] += (TAU * f) / SR; s += Math.sign(Math.sin(ph[k])); });
    s = s / 6 + rnd() * 0.5;
    a[i] = h(b(s)) * Math.exp(-t / dec);
  }
  return a;
}

function cowbell() {
  const a = new Float32Array(len(0.6)); let p1 = 0, p2 = 0;
  const b = biquad('bp', 850, 1.2);
  for (let i = 0; i < a.length; i++) {
    const t = i / SR;
    p1 += (TAU * 540) / SR; p2 += (TAU * 800) / SR;
    const s = Math.sign(Math.sin(p1)) + Math.sign(Math.sin(p2));
    a[i] = b(s) * (0.7 * Math.exp(-t / 0.06) + 0.3 * Math.exp(-t / 0.35));
  }
  return a;
}

function rim() {
  const a = new Float32Array(len(0.12)); const h = biquad('hp', 3000);
  for (let i = 0; i < a.length; i++) {
    const t = i / SR;
    a[i] = Math.sin(TAU * 1700 * t) * Math.exp(-t / 0.007) + 0.6 * Math.sin(TAU * 820 * t) * Math.exp(-t / 0.02) + h(rnd()) * 0.4 * Math.exp(-t / 0.004);
  }
  return a;
}

function bell({ ratio, index, dec, dur = 2 }) {
  const f = 523.25; // C5 = MIDI 72
  const a = new Float32Array(len(dur)); let pc = 0, pm = 0;
  for (let i = 0; i < a.length; i++) {
    const t = i / SR;
    pm += (TAU * f * ratio) / SR;
    const mod = Math.sin(pm) * index * Math.exp(-t / 0.35);
    pc += (TAU * f) / SR;
    a[i] = Math.sin(pc + mod) * Math.exp(-t / dec) * Math.min(1, t / 0.002);
  }
  return a;
}

const files = { kick: [], snare: [], clap: [], hat: [], ohat: [], '808': [], cowbell: [], rim: [], bell: [] };
files.kick.push(save('kick_punch', kick({ f0: 230, f1: 52, pd: 0.03, dec: 0.22, drive: 2.5, click: 0.6 })));
files.kick.push(save('kick_deep', kick({ f0: 170, f1: 44, pd: 0.055, dec: 0.4, drive: 1.6, click: 0.25 })));
files.kick.push(save('kick_hard', kick({ f0: 260, f1: 50, pd: 0.022, dec: 0.3, drive: 5, click: 0.8 })));
files['808'].push(save('808_clean', bass808({ dec: 0.9, drive: 1.3 })));
files['808'].push(save('808_dirty', bass808({ dec: 1.0, drive: 4.5 })));
files['808'].push(save('808_long', bass808({ dec: 1.6, drive: 2.2, punch: 1.2, dur: 3 })));
files.snare.push(save('snare_crack', snare({ tone: 200, ndec: 0.11, bp: 3500 })));
files.snare.push(save('snare_fat', snare({ tone: 175, ndec: 0.18, bp: 2400, body: 0.9 })));
files.clap.push(save('clap_tight', clap({ bp: 1400, tail: 0.1 })));
files.clap.push(save('clap_wide', clap({ bp: 1100, tail: 0.2 })));
files.hat.push(save('hat_tick', hat({ dec: 0.025 })));
files.hat.push(save('hat_bright', hat({ dec: 0.04, bright: 1.25 })));
files.ohat.push(save('ohat', hat({ dec: 0.28, dur: 0.9 })));
files.cowbell.push(save('cowbell', cowbell()));
files.rim.push(save('rim', rim()));
files.bell.push(save('bell_glass', bell({ ratio: 2, index: 1.6, dec: 0.9 })));
files.bell.push(save('bell_fm', bell({ ratio: 3.5, index: 3, dec: 0.7 })));

fs.writeFileSync(path.join(out, 'LICENSE.txt'),
  'Rap Machine Pro Kit — synthesized by tools/make-kit.js.\nCC0 1.0 Universal: public domain, free for any use, no attribution required.\n');

const index = [{ name: 'RM Pro (свой кит)', path: `kits/${KIT}/`, files, roots: { '808': 36, cowbell: 73, bell: 72 } }];
fs.writeFileSync(path.join(__dirname, '..', 'kits', 'index.json'), JSON.stringify(index, null, 2));
console.log('Kit written to', out, Object.values(files).flat().length, 'files');
