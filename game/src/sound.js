// Coral Keys — synthesised sound.
//
// No audio files: every sound is made with the Web Audio API, so the
// game loads nothing over the network. The context is created lazily on
// the first user gesture (browsers block audio before that).

let ctx = null;
let master = null;
let engineOsc = null;
let engineGain = null;
let sirenOsc = null;
let sirenGain = null;
let sirenTimer = null;
let musicTimer = null;
let musicStep = 0;

function ensure() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.35;
  master.connect(ctx.destination);
  return ctx;
}

export function unlockAudio() {
  const c = ensure();
  if (c && c.state === 'suspended') c.resume();
}

function noiseBuffer(seconds = 0.3) {
  const c = ensure();
  const buf = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function blip(freq, dur, type = 'sine', vol = 0.3, slideTo = null) {
  const c = ensure();
  if (!c) return;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, c.currentTime);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, c.currentTime + dur);
  g.gain.setValueAtTime(vol, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + dur);
  o.connect(g);
  g.connect(master);
  o.start();
  o.stop(c.currentTime + dur);
}

export function playGunshot() {
  const c = ensure();
  if (!c) return;
  const src = c.createBufferSource();
  src.buffer = noiseBuffer(0.18);
  const filter = c.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1800;
  const g = c.createGain();
  g.gain.setValueAtTime(0.6, c.currentTime);
  g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.18);
  src.connect(filter);
  filter.connect(g);
  g.connect(master);
  src.start();
}

export function playPunch() {
  blip(120, 0.12, 'sine', 0.5, 60);
}

export function playPickup() {
  blip(660, 0.09, 'sine', 0.3);
  setTimeout(() => blip(990, 0.12, 'sine', 0.3), 80);
}

export function playCash() {
  blip(880, 0.08, 'triangle', 0.3);
  setTimeout(() => blip(1174, 0.08, 'triangle', 0.3), 70);
  setTimeout(() => blip(1568, 0.14, 'triangle', 0.3), 140);
}

export function playHorn() {
  blip(370, 0.25, 'square', 0.15, 370);
}

// Engine hum: one sawtooth whose pitch follows the car's speed.
export function setEngine(speedRatio, active) {
  const c = ensure();
  if (!c) return;
  if (!active) {
    if (engineOsc) {
      try { engineOsc.stop(); } catch { /* already stopped */ }
      engineOsc = null;
      engineGain = null;
    }
    return;
  }
  if (!engineOsc) {
    engineOsc = c.createOscillator();
    engineGain = c.createGain();
    engineOsc.type = 'sawtooth';
    engineGain.gain.value = 0.05;
    const filter = c.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 900;
    engineOsc.connect(filter);
    filter.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
  }
  engineOsc.frequency.setValueAtTime(55 + speedRatio * 140, c.currentTime);
  engineGain.gain.setValueAtTime(0.03 + speedRatio * 0.06, c.currentTime);
}

// Two-tone police siren while any cruiser is chasing.
export function setSiren(on) {
  const c = ensure();
  if (!c) return;
  if (!on) {
    if (sirenTimer) clearInterval(sirenTimer);
    sirenTimer = null;
    if (sirenOsc) {
      try { sirenOsc.stop(); } catch { /* already stopped */ }
      sirenOsc = null;
      sirenGain = null;
    }
    return;
  }
  if (sirenOsc) return;
  sirenOsc = c.createOscillator();
  sirenGain = c.createGain();
  sirenOsc.type = 'sine';
  sirenOsc.frequency.value = 700;
  sirenGain.gain.value = 0.045;
  sirenOsc.connect(sirenGain);
  sirenGain.connect(master);
  sirenOsc.start();
  let high = true;
  sirenTimer = setInterval(() => {
    if (!sirenOsc) return;
    high = !high;
    sirenOsc.frequency.setValueAtTime(high ? 950 : 700, c.currentTime);
  }, 420);
}

// A lazy bassline loop: root notes of a tiny progression, one per beat.
const BASSLINE = [55, 55, 65.41, 49];
export function startMusic() {
  const c = ensure();
  if (!c || musicTimer) return;
  musicTimer = setInterval(() => {
    if (document.hidden) return;
    const freq = BASSLINE[musicStep % BASSLINE.length];
    musicStep++;
    blip(freq, 0.42, 'triangle', 0.12);
    if (musicStep % 2 === 0) blip(freq * 2, 0.1, 'sine', 0.05);
  }, 430);
}

export function stopMusic() {
  if (musicTimer) clearInterval(musicTimer);
  musicTimer = null;
}
