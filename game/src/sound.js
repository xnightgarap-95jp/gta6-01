// Coral Keys — all sound is synthesised with WebAudio.
//
// No audio files are shipped: the engine hum, sirens, gunshots, punches
// and the bassline are oscillators and filtered noise built at run time.
// The audio context starts on the first user gesture (a browser rule);
// until then every call is a safe no-op.

export class SoundBank {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.musicTimer = 0;
    this.musicStep = 0;
    this.muted = false;
  }

  // Call from a click / keydown handler. Safe to call repeatedly.
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      // Engine: a low sawtooth whose pitch follows the car speed.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      this.engineOsc.connect(this.engineGain);
      this.engineGain.connect(this.master);
      this.engineOsc.start();
      // Siren: a sine that wails between two notes.
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'sine';
      this.sirenOsc.frequency.value = 700;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain);
      this.sirenGain.connect(this.master);
      this.sirenOsc.start();
    } catch {
      this.ctx = null;
    }
  }

  setEngine(speedRatio) {
    if (!this.ctx || !this.engineOsc) return;
    const t = this.ctx.currentTime;
    this.engineOsc.frequency.setTargetAtTime(55 + speedRatio * 130, t, 0.08);
    this.engineGain.gain.setTargetAtTime(speedRatio > 0.02 ? 0.05 + speedRatio * 0.05 : 0, t, 0.1);
  }

  setSiren(on, time) {
    if (!this.ctx || !this.sirenOsc) return;
    const t = this.ctx.currentTime;
    this.sirenGain.gain.setTargetAtTime(on ? 0.035 : 0, t, 0.2);
    if (on) this.sirenOsc.frequency.setTargetAtTime(660 + 220 * Math.sin(time * 2.4), t, 0.05);
  }

  // A short burst of filtered noise: gunshots, punches, crashes.
  burst(freq, dur, vol) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(t);
  }

  // A single note: blips, pickups, UI clicks.
  blip(freq, dur, vol, type = 'square') {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(vol, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  gunshot() {
    this.burst(2400, 0.16, 0.5);
  }
  punch() {
    this.burst(300, 0.12, 0.4);
  }
  crash() {
    this.burst(500, 0.3, 0.5);
  }
  pickup() {
    this.blip(880, 0.12, 0.25);
    setTimeout(() => this.blip(1320, 0.16, 0.25), 90);
  }
  missionDone() {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.blip(f, 0.22, 0.3, 'triangle'), i * 120));
  }
  busted() {
    [392, 330, 262].forEach((f, i) => setTimeout(() => this.blip(f, 0.3, 0.3, 'triangle'), i * 180));
  }

  // A lazy bassline: one note every 0.42 s, root notes of a minor groove.
  updateMusic(dt, playing) {
    if (!this.ctx || !playing) return;
    this.musicTimer += dt;
    if (this.musicTimer < 0.42) return;
    this.musicTimer = 0;
    const roots = [55, 55, 65.41, 49];
    const note = roots[this.musicStep % roots.length];
    this.musicStep += 1;
    this.blip(note, 0.36, 0.12, 'triangle');
    if (this.musicStep % 4 === 2) this.blip(note * 1.5, 0.2, 0.07, 'sine');
  }
}
