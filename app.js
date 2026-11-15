const $ = s => document.querySelector(s);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

const S = {
  ctx: null, chain: null, engine: null, mic: null,
  pattern: null, lines: [], ownLines: null,
  mode: null, // null | 'rehearse' | 'rec'
  recorder: null, recStart: 0, takeNo: 0, shownIdx: null,
};
const values = {};
const stripOn = {};
const ui = {}; // id -> { p, render(v) }

// ---------- Параметры ----------
function toNorm(p, v) {
  if (p.map === 'log') return Math.log(v / p.min) / Math.log(p.max / p.min);
  return (v - p.min) / (p.max - p.min);
}
function fromNorm(p, n) {
  n = clamp(n, 0, 1);
  let v = p.map === 'log' ? p.min * Math.pow(p.max / p.min, n) : p.min + n * (p.max - p.min);
  if (p.step) v = Math.round(v / p.step) * p.step;
  return +v.toFixed(4);
}
const fmt = (p, v) => (p.fmt ? p.fmt(v) : v.toFixed(2));

function setParam(id, v, manual) {
  values[id] = v;
  ui[id] && ui[id].render(v);
  if (manual) document.querySelectorAll('.presets button').forEach(b => b.classList.remove('sel'));
  applyParams();
}

function applyParams() {
  if (!S.ctx) return;
  S.chain.values = values;
  S.chain.stripOn = stripOn;
  S.chain.applyAll();
  const t = S.ctx.currentTime;
  const m = id => (stripOn['m_' + id] === false ? 0 : values[id]);
  S.vocalOut.gain.setTargetAtTime(m('vocal'), t, 0.02);
  S.beatBus.gain.setTargetAtTime(m('beat'), t, 0.02);
  S.monitor.gain.setTargetAtTime(m('monitor'), t, 0.02);
}

// ---------- Пульт ----------
const KNOB_COLORS = ['var(--blue)', 'var(--yellow)', '#e8e8e8'];

function makeKnob(p, color, valEl) {
  const el = document.createElement('div');
  el.className = 'knob';
  el.innerHTML = `<div class="cap" style="--kc:${color}"><i></i></div><label>${p.label}</label>`;
  const cap = el.querySelector('.cap');
  let hideT;
  const showVal = v => {
    valEl.textContent = fmt(p, v); valEl.style.color = '#9cc2ff';
    clearTimeout(hideT);
    hideT = setTimeout(() => { valEl.style.color = ''; valEl.textContent = valEl.dataset.fader; }, 1400);
  };
  ui[p.id] = {
    p, render(v) {
      cap.style.transform = `rotate(${-135 + toNorm(p, v) * 270}deg)`;
      el.title = `${p.label}: ${fmt(p, v)}`;
    },
  };
  let sy, sn;
  el.addEventListener('pointerdown', e => {
    el.setPointerCapture(e.pointerId); sy = e.clientY; sn = toNorm(p, values[p.id]);
  });
  el.addEventListener('pointermove', e => {
    if (!el.hasPointerCapture(e.pointerId)) return;
    const v = fromNorm(p, sn + (sy - e.clientY) / 160);
    setParam(p.id, v, true); showVal(v);
  });
  el.addEventListener('wheel', e => {
    e.preventDefault();
    const v = fromNorm(p, toNorm(p, values[p.id]) - Math.sign(e.deltaY) * 0.03);
    setParam(p.id, v, true); showVal(v);
  }, { passive: false });
  el.addEventListener('dblclick', () => { setParam(p.id, p.def, true); showVal(p.def); });
  return el;
}

function makeFader(p, valEl) {
  const wrap = document.createElement('div');
  wrap.className = 'fader-wrap';
  const inp = document.createElement('input');
  inp.type = 'range'; inp.className = 'fader'; inp.min = 0; inp.max = 1000; inp.step = 1;
  wrap.appendChild(inp);
  ui[p.id] = {
    p, render(v) {
      inp.value = Math.round(toNorm(p, v) * 1000);
      valEl.textContent = valEl.dataset.fader = fmt(p, v);
    },
  };
  inp.addEventListener('input', () => setParam(p.id, fromNorm(p, inp.value / 1000), true));
  inp.addEventListener('dblclick', () => setParam(p.id, p.def, true));
  return wrap;
}

function makeStrip({ id, name, color, knobs = [], fader, master }) {
  const st = document.createElement('div');
  st.className = master ? 'mstrip' : 'strip';
  const val = document.createElement('div'); val.className = 'val';
  const kn = document.createElement('div'); kn.className = 'knobs';
  knobs.forEach((k, i) => kn.appendChild(makeKnob(k, KNOB_COLORS[i % 3], val)));
  const on = document.createElement('button');
  on.className = `onbtn ${color} lit`; on.textContent = master ? 'ON' : 'ON';
  on.title = 'Включить/выключить канал';
  on.addEventListener('click', () => {
    stripOn[id] = stripOn[id] === false;
    on.classList.toggle('lit', stripOn[id]);
    applyParams();
  });
  const scr = document.createElement('div'); scr.className = 'scribble'; scr.textContent = name;
  const fl = document.createElement('div'); fl.className = 'flabel'; fl.textContent = fader.label;
  st.append(kn, on, scr, makeFader(fader, val), val, fl);
  return st;
}

function buildConsole() {
  const strips = $('#strips');
  for (const s of STRIPS) {
    strips.appendChild(makeStrip(s));
    for (const p of [s.fader, ...s.knobs]) values[p.id] = p.def;
  }
  const master = $('#master');
  const meters = master.querySelector('.meters');
  for (const p of MASTER) {
    values[p.id] = p.def;
    master.insertBefore(makeStrip({ id: 'm_' + p.id, name: p.label, color: 'red', fader: { ...p, label: 'мастер', fmt: v => Math.round(v * 100) + '%' }, master: true }), meters);
  }
  for (const id in ui) ui[id].render(values[id]);

  const pr = $('#presets');
  for (const name of Object.keys(PRESETS)) {
    const b = document.createElement('button');
    b.textContent = name;
    b.addEventListener('click', () => applyPreset(name, b));
    pr.appendChild(b);
  }
  pr.firstChild.classList.add('sel');
}

function applyPreset(name, btn) {
  const pre = PRESETS[name];
  for (const s of STRIPS) {
    stripOn[s.id] = true;
    for (const p of [s.fader, ...s.knobs]) {
      if (p.id === 'gain') continue; // уровень микрофона пресет не трогает
      values[p.id] = pre[p.id] ?? p.def;
      ui[p.id].render(values[p.id]);
    }
  }
  document.querySelectorAll('.strip .onbtn').forEach(b => b.classList.add('lit'));
  document.querySelectorAll('.presets button').forEach(b => b.classList.toggle('sel', b === btn));
  applyParams();
}

// ---------- Аудио ----------
async function ensureAudio() {
  if (S.ctx) { if (S.ctx.state === 'suspended') await S.ctx.resume(); return; }
  const ctx = new AudioContext({ latencyHint: 'interactive' });
  S.ctx = ctx;
  await loadWorklet(ctx);
  S.chain = new VocalChain(ctx);
  S.beatBus = ctx.createGain();
  S.vocalOut = ctx.createGain();
  S.monitor = ctx.createGain();
  S.mixBus = ctx.createGain();
  S.recDest = ctx.createMediaStreamDestination();
  S.chain.out.connect(S.vocalOut);
  S.vocalOut.connect(S.mixBus);
  S.beatBus.connect(S.mixBus);
  S.mixBus.connect(S.recDest);
  S.beatBus.connect(ctx.destination);
  S.vocalOut.connect(S.monitor).connect(ctx.destination);
  S.anaV = ctx.createAnalyser(); S.anaV.fftSize = 1024; S.vocalOut.connect(S.anaV);
  S.anaM = ctx.createAnalyser(); S.anaM.fftSize = 1024; S.mixBus.connect(S.anaM);
  S.engine = new BeatEngine(ctx, S.beatBus);
  S.engine.setPattern(S.pattern);
  applyParams();
}

async function ensureMic() {
  if (S.mic) return true;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    S.mic = S.ctx.createMediaStreamSource(stream);
    S.mic.connect(S.chain.input);
    $('#micStatus').textContent = '🎙 микрофон включён';
    $('#micStatus').classList.add('on');
    if (values.monitor === 0 && confirm('Вы в наушниках?\n\nВключить прослушку своего голоса с эффектами в реальном времени?\n(Без наушников из колонок будет фон и свист.)')) {
      setParam('monitor', 0.9);
    }
    return true;
  } catch (e) {
    alert('Нет доступа к микрофону: ' + e.message);
    return false;
  }
}

// ---------- Бит и текст ----------
function newBeat() {
  S.pattern = generateBeat($('#style').value);
  if (S.engine) {
    S.engine.setPattern(S.pattern);
    if (S.mode === 'rehearse') S.engine.start();
  }
  $('#bpmWrap').hidden = true;
  showBeatInfo();
}

function showBeatInfo() {
  const c = S.engine && S.engine.custom;
  $('#beatInfo').textContent = c
    ? `📂 ${c.name} · ${c.bpm} BPM`
    : `${S.pattern.name} · ${S.pattern.bpm} BPM · ${S.pattern.key}`;
}

function getKey() { try { return localStorage.getItem('rm_api_key') || ''; } catch (e) { return ''; } }

async function themedLyrics() {
  const topic = $('#topic').value.trim();
  if (!topic) { S.ownLines = null; newLyrics(); return; }
  const n = +$('#verseLen').value, key = getKey(), btn = $('#btnGenText');
  if (key) {
    btn.disabled = true; btn.textContent = '⏳ Пишу текст…';
    try {
      S.ownLines = await generateLyricsAI(topic, n, key);
    } catch (e) {
      alert('Claude API: ' + e.message + '\nИспользую встроенный генератор.');
      S.ownLines = generateLyrics(n, topic);
    }
    btn.disabled = false; btn.textContent = '✨ Текст по теме';
  } else {
    S.ownLines = generateLyrics(n, topic);
  }
  newLyrics();
}

function renderLyrics(lines) {
  S.lines = lines;
  const box = $('#lyrics');
  box.innerHTML = '';
  for (const l of S.lines) {
    const d = document.createElement('div');
    d.innerHTML = `${l}<span class="prog"><b></b></span>`;
    d.querySelector('.prog').style.visibility = 'hidden';
    d.firstChild.textContent = l;
    box.appendChild(d);
  }
  S.shownIdx = null;
  showLine(-1);
}

function newLyrics() {
  renderLyrics(S.ownLines || generateLyrics(+$('#verseLen').value));
}

function showLine(idx) {
  S.shownIdx = idx;
  const rows = $('#lyrics').children;
  [...rows].forEach((r, i) => {
    r.className = i === idx ? 'active' : i < idx ? 'past' : i <= idx + 2 || (idx < 0 && i < 3) ? 'next' : '';
    r.querySelector('.prog').style.visibility = i === idx ? 'visible' : 'hidden';
  });
  const target = rows[Math.max(0, idx)];
  if (!target) return;
  const vp = $('.lyrics-viewport').clientHeight;
  $('#lyrics').style.transform = `translateY(${vp / 2 - target.offsetTop - target.offsetHeight / 2}px)`;
}

// ---------- Сессия: репетиция / запись ----------
function pickMime() {
  return ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'].find(m => MediaRecorder.isTypeSupported(m));
}

async function startSession(mode) {
  await ensureAudio();
  const micOk = await ensureMic();
  if (mode === 'rec' && !micOk) return;
  stopSession();
  if (!S.lines.length) newLyrics();
  showLine(-1);
  S.engine.start(0.15);
  S.mode = mode;
  if (mode === 'rec') {
    const mime = pickMime();
    const rec = new MediaRecorder(S.recDest.stream, mime ? { mimeType: mime } : undefined);
    const chunks = [];
    const meta = S.engine.custom ? `${S.engine.custom.name} · ${S.engine.bpm} BPM` : `${S.pattern.name} · ${S.pattern.bpm} BPM · ${S.pattern.key}`;
    rec.ondataavailable = e => e.data.size && chunks.push(e.data);
    rec.onstop = () => addTake(new Blob(chunks, { type: rec.mimeType || 'audio/webm' }), meta, (performance.now() - S.recStart) / 1000);
    rec.start(250);
    S.recorder = rec;
    S.recStart = performance.now();
  }
  updateButtons();
}

function stopSession() {
  if (!S.mode) return;
  S.engine.stop();
  const rec = S.recorder;
  if (rec && rec.state !== 'inactive') setTimeout(() => rec.stop(), 350);
  S.recorder = null;
  S.mode = null;
  $('#countdown').textContent = '';
  document.querySelectorAll('#dots i').forEach(d => d.classList.remove('on'));
  $('#barCount').textContent = '—';
  showLine(-1);
  updateButtons();
}

function updateButtons() {
  const rec = S.mode === 'rec', reh = S.mode === 'rehearse';
  $('#btnRec').disabled = rec;
  $('#btnPlay').disabled = rec;
  $('#btnPlay').classList.toggle('active', reh);
  $('#btnStop').disabled = !S.mode;
  $('#btnNewBeat').disabled = rec;
  $('#btnNewText').disabled = rec;
  $('#btnOwnText').disabled = rec;
  $('#recInd').classList.toggle('on', rec);
}

// ---------- Записи ----------
function addTake(blob, meta, secs) {
  S.takeNo++;
  const n = S.takeNo, url = URL.createObjectURL(blob);
  const ext = blob.type.includes('ogg') ? 'ogg' : blob.type.includes('mp4') ? 'm4a' : 'webm';
  const el = document.createElement('div');
  el.className = 'take';
  el.innerHTML = `<div><div class="name">Дубль ${n}</div><div class="meta"></div></div>
    <audio controls src="${url}"></audio>
    <a download="rap-take-${n}.${ext}" href="${url}">⬇ ${ext.toUpperCase()}</a>
    <button>⬇ WAV</button>`;
  el.querySelector('.meta').textContent = `${meta} · ${Math.floor(secs / 60)}:${String(Math.floor(secs % 60)).padStart(2, '0')}`;
  el.querySelector('button').addEventListener('click', async e => {
    e.target.textContent = '…';
    try {
      const buf = await S.ctx.decodeAudioData(await blob.arrayBuffer());
      const a = document.createElement('a');
      a.href = URL.createObjectURL(encodeWav(buf));
      a.download = `rap-take-${n}.wav`;
      a.click();
    } catch (err) { alert('Не удалось сконвертировать: ' + err.message); }
    e.target.textContent = '⬇ WAV';
  });
  const list = $('#takes');
  list.querySelector('.empty')?.remove();
  list.prepend(el);
}

function encodeWav(buf) {
  const ch = buf.numberOfChannels, len = buf.length, sr = buf.sampleRate;
  const dv = new DataView(new ArrayBuffer(44 + len * ch * 2));
  const str = (o, s) => [...s].forEach((c, i) => dv.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); dv.setUint32(4, 36 + len * ch * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, ch, true);
  dv.setUint32(24, sr, true); dv.setUint32(28, sr * ch * 2, true); dv.setUint16(32, ch * 2, true);
  dv.setUint16(34, 16, true); str(36, 'data'); dv.setUint32(40, len * ch * 2, true);
  const data = Array.from({ length: ch }, (_, c) => buf.getChannelData(c));
  let o = 44;
  for (let i = 0; i < len; i++) for (let c = 0; c < ch; c++) {
    const s = clamp(data[c][i], -1, 1);
    dv.setInt16(o, s < 0 ? s * 0x8000 : s * 0x7fff, true); o += 2;
  }
  return new Blob([dv], { type: 'audio/wav' });
}

// ---------- Анимация: текст по тактам, индикаторы ----------
const tbuf = new Float32Array(1024);
function level(an) {
  an.getFloatTimeDomainData(tbuf);
  let pk = 0; for (const x of tbuf) pk = Math.max(pk, Math.abs(x));
  return clamp((20 * Math.log10(pk + 1e-6) + 54) / 54, 0, 1);
}

function frame() {
  requestAnimationFrame(frame);
  if (S.ctx) {
    $('#vuVocal').style.height = level(S.anaV) * 100 + '%';
    $('#vuMix').style.height = level(S.anaM) * 100 + '%';
  }
  if (!S.mode) return;
  const pos = S.engine.position();
  if (pos < 0) return;
  const bpl = S.engine.barsPerLine;
  const intro = bpl; // вступление = длина одной строки
  document.querySelectorAll('#dots i').forEach((d, i) => d.classList.toggle('on', Math.floor(pos * 4) % 4 === i));
  $('#barCount').textContent = `такт ${Math.floor(pos) + 1}`;

  const rel = (pos - intro) / bpl;
  if (rel < 0) {
    $('#countdown').textContent = 4 - Math.floor((pos / intro) * 4);
  } else {
    $('#countdown').textContent = '';
  }
  if (S.mode === 'rec') {
    const s = (performance.now() - S.recStart) / 1000;
    $('#recTime').textContent = `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    if (rel >= S.lines.length + 1 / bpl) { stopSession(); return; } // один такт после последней строки
  }
  let idx = rel < 0 ? -1 : Math.floor(rel);
  if (S.mode === 'rehearse' && idx >= 0) idx %= S.lines.length;
  if (idx >= S.lines.length) idx = S.lines.length - 1;
  if (idx !== S.shownIdx) showLine(idx);
  const row = $('#lyrics').children[idx];
  if (row) row.querySelector('.prog b').style.width = clamp(rel - Math.floor(rel), 0, 1) * 100 + '%';
}

// ---------- События ----------
$('#btnNewBeat').addEventListener('click', newBeat);
$('#style').addEventListener('change', newBeat);
$('#btnPlay').addEventListener('click', () => (S.mode === 'rehearse' ? stopSession() : startSession('rehearse')));
$('#btnRec').addEventListener('click', () => startSession('rec'));
$('#btnStop').addEventListener('click', stopSession);
$('#btnNewText').addEventListener('click', () => { S.ownLines = null; newLyrics(); });
$('#btnGenText').addEventListener('click', themedLyrics);
$('#topic').addEventListener('keydown', e => { if (e.key === 'Enter') themedLyrics(); });
$('#btnKey').classList.toggle('has-key', !!getKey());
$('#btnKey').addEventListener('click', () => {
  const k = prompt('Ключ Claude API (sk-ant-…) для генерации текста нейросетью.\nХранится только в этом браузере. Пусто — удалить ключ и использовать встроенный генератор.', getKey());
  if (k === null) return;
  try { k.trim() ? localStorage.setItem('rm_api_key', k.trim()) : localStorage.removeItem('rm_api_key'); } catch (e) {}
  $('#btnKey').classList.toggle('has-key', !!getKey());
});
$('#verseLen').addEventListener('change', () => { if (!S.ownLines) newLyrics(); });
$('#btnOwnText').addEventListener('click', () => { $('#ownText').value = (S.ownLines || []).join('\n'); $('#textDialog').showModal(); });
$('#textDialog').addEventListener('close', () => {
  if ($('#textDialog').returnValue !== 'ok') return;
  const lines = $('#ownText').value.split('\n').map(s => s.trim()).filter(Boolean);
  S.ownLines = lines.length ? lines : null;
  newLyrics();
});
$('#beatFile').addEventListener('change', async e => {
  const f = e.target.files[0]; if (!f) return;
  await ensureAudio();
  try {
    const buf = await S.ctx.decodeAudioData(await f.arrayBuffer());
    stopSession();
    S.engine.setCustom(buf, +$('#beatBpm').value || 90, f.name.replace(/\.[^.]+$/, ''));
    $('#bpmWrap').hidden = false;
    showBeatInfo();
  } catch (err) { alert('Не удалось открыть файл: ' + err.message); }
  e.target.value = '';
});
$('#beatBpm').addEventListener('change', () => {
  if (S.engine && S.engine.custom) { S.engine.custom.bpm = clamp(+$('#beatBpm').value || 90, 40, 220); showBeatInfo(); }
});
document.addEventListener('keydown', e => {
  if (e.target.matches('input, textarea, select')) return;
  if (e.code === 'Space') { e.preventDefault(); S.mode ? stopSession() : startSession('rehearse'); }
  if (e.code === 'KeyR' && S.mode !== 'rec') startSession('rec');
});

buildConsole();
newBeat();
newLyrics();
requestAnimationFrame(frame);
