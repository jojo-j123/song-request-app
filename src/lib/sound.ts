/**
 * Synthesised UI sound effects (WebAudio). No audio files, no copyrighted material.
 * Muted by default; browsers require one user gesture before audio can start.
 */
type Sfx = 'request' | 'tick' | 'go' | 'reveal' | 'winner' | 'whoosh' | 'vote';

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  enabled = false;
  volume = 0.6;

  get unlocked() {
    return this.ctx?.state === 'running';
  }

  private ensure() {
    if (!this.ctx) {
      const AC = window.AudioContext || (window as any).webkitAudioContext;
      if (!AC) return null;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume * 0.5;
      this.master.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  async unlock() {
    const ctx = this.ensure();
    if (ctx && ctx.state !== 'running') await ctx.resume().catch(() => undefined);
    return this.unlocked;
  }

  configure(enabled: boolean, volume: number) {
    this.enabled = enabled;
    this.volume = volume;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(volume * 0.5, this.ctx.currentTime, 0.05);
  }

  private tone(freq: number, start: number, dur: number, type: OscillatorType = 'sine', gain = 0.3, slideTo?: number) {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, ctx.currentTime + start);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + start + dur);
    g.gain.setValueAtTime(0.0001, ctx.currentTime + start);
    g.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + start + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
    o.connect(g).connect(this.master!);
    o.start(ctx.currentTime + start);
    o.stop(ctx.currentTime + start + dur + 0.05);
  }

  private noise(start: number, dur: number, from = 400, to = 6000, gain = 0.25) {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.2;
    f.frequency.setValueAtTime(from, ctx.currentTime + start);
    f.frequency.exponentialRampToValueAtTime(to, ctx.currentTime + start + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, ctx.currentTime + start);
    g.gain.exponentialRampToValueAtTime(gain, ctx.currentTime + start + dur * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + start + dur);
    src.connect(f).connect(g).connect(this.master!);
    src.start(ctx.currentTime + start);
  }

  play(s: Sfx) {
    if (!this.enabled || !this.unlocked || !this.ctx) return;
    switch (s) {
      case 'request':
        this.tone(880, 0, 0.25, 'triangle', 0.25);
        this.tone(1320, 0.09, 0.35, 'triangle', 0.2);
        break;
      case 'vote':
        this.tone(1200, 0, 0.12, 'sine', 0.12);
        break;
      case 'tick':
        this.tone(220, 0, 0.18, 'square', 0.12, 110);
        this.tone(880, 0, 0.08, 'sine', 0.15);
        break;
      case 'go':
        this.tone(440, 0, 0.5, 'sawtooth', 0.12, 880);
        break;
      case 'whoosh':
        this.noise(0, 0.9, 300, 5000, 0.2);
        break;
      case 'reveal':
        this.noise(0, 0.6, 200, 8000, 0.3);
        this.tone(55, 0.55, 1.2, 'sine', 0.6, 40);
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.6 + i * 0.04, 1.4, 'triangle', 0.12));
        break;
      case 'winner':
        [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, i * 0.09, 0.6, 'triangle', 0.18));
        this.tone(65, 0, 1, 'sine', 0.4, 45);
        break;
    }
  }
}

export const sound = new SoundEngine();
