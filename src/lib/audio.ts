/**
 * Shared audio-reactive engine for every visual on the LED display.
 *
 * Two sources feed the same output (64 frequency bands + bass/beat/energy):
 *  - LIVE: the display computer's microphone (opt-in, one click). The signal is analysed on this
 *    device only — nothing is recorded, stored or sent anywhere, and it is never played back.
 *  - SYNTH: a musical-looking generator (124 BPM kick + moving bands) used when the mic is off,
 *    denied, or the room is silent, so the screen never looks dead.
 *
 * Consumers call `audio.frame(t)` from their own requestAnimationFrame loop; the engine computes at
 * most once per frame no matter how many visuals are running, so everything pulses in unison.
 */
import { useEffect, useState } from 'react';

export type MicState = 'off' | 'on' | 'denied' | 'unsupported';

const BANDS = 64;
const MIC_PREF = 'encore:display-mic';

class AudioEngine {
  readonly levels = new Float32Array(BANDS);
  readonly peaks = new Float32Array(BANDS);
  /** 0..1 — low-end energy. */
  bass = 0;
  /** 0..1 — overall loudness. */
  energy = 0;
  /** Jumps to ~1 on each kick and decays: drive pulses with it. */
  beat = 0;
  mic: MicState = 'off';

  private last = 0;
  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private buf: Uint8Array | null = null;
  private stream: MediaStream | null = null;
  private raw = new Float32Array(BANDS);
  private gain = 0.3;
  private avgBass = 0;
  private lastBeat = 0;
  private quietFor = 0;
  private subs = new Set<() => void>();

  subscribe(fn: () => void) {
    this.subs.add(fn);
    return () => {
      this.subs.delete(fn);
    };
  }
  private emit() {
    this.subs.forEach((f) => f());
  }

  /** Advance the engine. `now` is a requestAnimationFrame timestamp (ms). */
  frame(now: number) {
    if (now - this.last < 6) return;
    const dt = this.last ? Math.min(0.1, (now - this.last) / 1000) : 0.016;
    this.last = now;
    let live = false;
    if (this.mic === 'on' && this.analyser && this.buf) live = this.readMic(dt, now);
    if (!live) this.synth(now / 1000, this.mic === 'on' ? 0.4 : 1);
    let sum = 0;
    for (let i = 0; i < BANDS; i++) {
      const v = this.levels[i];
      sum += v;
      this.peaks[i] = Math.max(v, this.peaks[i] - dt * 0.5);
    }
    this.energy = sum / BANDS;
    this.bass = (this.levels[0] + this.levels[1] + this.levels[2] + this.levels[3] + this.levels[4] + this.levels[5]) / 6;
  }

  private synth(t: number, amp: number) {
    const beatLen = 60 / 124;
    const ph = t % beatLen;
    const kick = Math.exp(-ph * 9);
    const accent = Math.floor(t / beatLen) % 4 === 0 ? 1 : 0.78;
    for (let i = 0; i < BANDS; i++) {
      const f = i / BANDS;
      const target =
        (0.1 +
          0.44 * Math.abs(Math.sin(t * (1.3 + f * 2.7) + i * 0.7)) * (1 - f * 0.45) +
          0.46 * kick * accent * (1 - f) * (1 - f) +
          0.1 * Math.abs(Math.sin(t * 7.1 + i * 1.9))) *
        amp;
      this.levels[i] += (Math.min(1, target) - this.levels[i]) * 0.26;
    }
    this.beat = kick * accent * amp;
  }

  private readMic(dt: number, now: number): boolean {
    const analyser = this.analyser!;
    const buf = this.buf!;
    analyser.getByteFrequencyData(buf);
    const bins = buf.length;
    const hzPerBin = this.ctx!.sampleRate / 2 / bins;
    let frameMax = 0;
    for (let i = 0; i < BANDS; i++) {
      // log-spaced bands, 40 Hz → 12 kHz
      const f0 = 40 * Math.pow(300, i / BANDS);
      const f1 = 40 * Math.pow(300, (i + 1) / BANDS);
      const b0 = Math.max(1, Math.floor(f0 / hzPerBin));
      const b1 = Math.min(bins - 1, Math.max(b0, Math.ceil(f1 / hzPerBin)));
      let s = 0;
      for (let b = b0; b <= b1; b++) s += buf[b];
      const v = (s / (b1 - b0 + 1) / 255) * (1 + (i / BANDS) * 1.2); // tilt: highs carry less energy
      this.raw[i] = v;
      if (v > frameMax) frameMax = v;
    }
    this.quietFor = frameMax < 0.05 ? this.quietFor + dt : 0;
    if (this.quietFor > 2.5) return false; // silent room → idle animation instead of a flat line

    // slow auto-gain so a quiet bar and a loud club both fill the screen
    this.gain = Math.max(0.2, this.gain * (1 - dt * 0.1), frameMax);
    for (let i = 0; i < BANDS; i++) {
      const v = Math.min(1, Math.pow(this.raw[i] / this.gain, 1.3));
      this.levels[i] += (v - this.levels[i]) * (v > this.levels[i] ? 0.55 : 0.2);
    }
    let bassNow = 0;
    for (let i = 0; i < 7; i++) bassNow += this.raw[i];
    bassNow = bassNow / 7 / this.gain;
    this.avgBass += (bassNow - this.avgBass) * Math.min(1, dt * 1.6);
    if (bassNow > this.avgBass * 1.2 + 0.04 && now - this.lastBeat > 230) {
      this.beat = 1;
      this.lastBeat = now;
    } else {
      this.beat *= Math.exp(-dt * 7);
    }
    return true;
  }

  get wantsMic() {
    try {
      return localStorage.getItem(MIC_PREF) === '1';
    } catch {
      return false;
    }
  }

  /** Start listening to the room. Must normally be called from a click. */
  async enableMic(): Promise<boolean> {
    if (this.mic === 'on') return true;
    if (!navigator.mediaDevices?.getUserMedia) {
      this.mic = 'unsupported';
      this.emit();
      return false;
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
        video: false,
      });
      const AC: typeof AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AC();
      await this.ctx.resume().catch(() => undefined);
      if (this.ctx.state !== 'running') throw new Error('audio context blocked');
      const src = this.ctx.createMediaStreamSource(this.stream);
      this.analyser = this.ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.analyser.smoothingTimeConstant = 0.6;
      this.analyser.minDecibels = -85;
      this.analyser.maxDecibels = -18;
      src.connect(this.analyser); // analysis only — never connected to the speakers
      this.buf = new Uint8Array(this.analyser.frequencyBinCount);
      this.mic = 'on';
      this.quietFor = 0;
      try {
        localStorage.setItem(MIC_PREF, '1');
      } catch {
        /* private mode */
      }
      this.emit();
      return true;
    } catch (e: any) {
      this.teardown();
      this.mic = e?.name === 'NotAllowedError' || e?.name === 'SecurityError' ? 'denied' : 'off';
      this.emit();
      return false;
    }
  }

  disableMic() {
    this.teardown();
    this.mic = 'off';
    try {
      localStorage.removeItem(MIC_PREF);
    } catch {
      /* ignore */
    }
    this.emit();
  }

  private teardown() {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.ctx?.close().catch(() => undefined);
    this.stream = null;
    this.ctx = null;
    this.analyser = null;
    this.buf = null;
  }
}

export const audio = new AudioEngine();

/** React binding for the mic state (for the operator's toggle button). */
export function useMicState(): MicState {
  const [state, setState] = useState<MicState>(audio.mic);
  useEffect(() => audio.subscribe(() => setState(audio.mic)), []);
  return state;
}
