// WebAudio synth: procedural SFX + ambient music. No external assets.
class AudioEngine {
  constructor() {
    this.ctx = null; this.master = null; this.musicGain = null; this.sfxGain = null;
    this.musicVol = 0.35; this.sfxVol = 0.5; this.enabled = true;
    this.musicTimer = null; this.lastSfx = {};
  }
  init() {
    if (this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain(); this.master.gain.value = 0.9; this.master.connect(this.ctx.destination);
    this.musicGain = this.ctx.createGain(); this.musicGain.gain.value = this.musicVol; this.musicGain.connect(this.master);
    this.sfxGain = this.ctx.createGain(); this.sfxGain.gain.value = this.sfxVol; this.sfxGain.connect(this.master);
  }
  resume() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); }
  setMusicVol(v) { this.musicVol = v; if (this.musicGain) this.musicGain.gain.value = v; }
  setSfxVol(v) { this.sfxVol = v; if (this.sfxGain) this.sfxGain.gain.value = v; }

  tone(freq, dur, type = 'sine', vol = 0.3, dest = null, slideTo = null) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this.sfxGain); o.start(t); o.stop(t + dur + 0.02);
  }
  noise(dur, vol = 0.3, filterFreq = 1200) {
    if (!this.ctx || !this.enabled) return;
    const t = this.ctx.currentTime;
    const n = this.ctx.createBufferSource();
    const buf = this.ctx.createBuffer(1, this.ctx.sampleRate * dur, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    n.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filterFreq;
    const g = this.ctx.createGain(); g.gain.value = vol;
    n.connect(f); f.connect(g); g.connect(this.sfxGain); n.start(t);
  }
  // throttle identical sfx so swarms don't blow out the mix
  throttle(name, ms = 40) { const now = performance.now(); if (this.lastSfx[name] && now - this.lastSfx[name] < ms) return false; this.lastSfx[name] = now; return true; }

  sfx(name) {
    if (!this.ctx || !this.enabled) return;
    switch (name) {
      case 'shoot': if (this.throttle('shoot', 55)) this.tone(620, 0.08, 'square', 0.08, null, 320); break;
      case 'hit': if (this.throttle('hit', 30)) this.noise(0.05, 0.06, 2200); break;
      case 'pickup': this.tone(880, 0.07, 'triangle', 0.12, null, 1320); break;
      case 'gem': if (this.throttle('gem', 45)) this.tone(1040, 0.05, 'sine', 0.08, null, 1500); break;
      case 'levelup': this.tone(523, 0.12, 'triangle', 0.2); this.tone(784, 0.18, 'triangle', 0.2); setTimeout(() => this.tone(1046, 0.2, 'triangle', 0.2), 90); break;
      case 'hurt': this.tone(200, 0.18, 'sawtooth', 0.2, null, 80); this.noise(0.12, 0.12, 800); break;
      case 'explode': this.noise(0.3, 0.25, 600); this.tone(90, 0.3, 'sawtooth', 0.18, null, 40); break;
      case 'crit': this.tone(1200, 0.1, 'square', 0.12, null, 600); break;
      case 'boss': this.tone(70, 0.8, 'sawtooth', 0.3, null, 50); this.noise(0.8, 0.2, 400); break;
      case 'chest': this.tone(660, 0.1, 'triangle', 0.2); setTimeout(() => this.tone(880, 0.1, 'triangle', 0.2), 80); setTimeout(() => this.tone(1320, 0.2, 'triangle', 0.2), 160); break;
      case 'evolve': for (let i = 0; i < 5; i++) setTimeout(() => this.tone(523 + i * 130, 0.15, 'triangle', 0.18), i * 70); break;
      case 'rift': this.tone(140, 0.5, 'sine', 0.2, null, 700); this.noise(0.5, 0.1, 2000); break;
      case 'death': this.tone(330, 0.5, 'sawtooth', 0.25, null, 60); this.noise(0.5, 0.2, 500); break;
      case 'select': this.tone(700, 0.05, 'square', 0.08, null, 900); break;
      case 'revive': for (let i = 0; i < 4; i++) setTimeout(() => this.tone(440 + i * 220, 0.18, 'sine', 0.18), i * 90); break;
    }
  }

  // Simple generative ambient loop per biome.
  startMusic(track) {
    this.stopMusic();
    if (!this.ctx) return;
    const scales = {
      crypt: [196, 233, 261, 311, 349], forest: [220, 261, 293, 349, 392],
      inferno: [174, 207, 233, 277, 311], frost: [261, 293, 329, 392, 440],
      void: [146, 174, 207, 233, 277], menu: [261, 329, 392, 440, 523]
    };
    const scale = scales[track] || scales.menu;
    let step = 0;
    const bass = this.ctx.createGain(); bass.gain.value = 0.5; bass.connect(this.musicGain);
    const play = () => {
      if (!this.enabled) return;
      const note = scale[step % scale.length];
      this.tone(note, 0.9, 'triangle', 0.12, this.musicGain, note);
      if (step % 4 === 0) this.tone(note / 2, 1.4, 'sine', 0.16, this.musicGain);
      if (step % 8 === 6) this.tone(note * 1.5, 0.5, 'sine', 0.06, this.musicGain);
      step++;
    };
    play();
    this.musicTimer = setInterval(play, 520);
  }
  stopMusic() { if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; } }
}
export const Audio = new AudioEngine();
