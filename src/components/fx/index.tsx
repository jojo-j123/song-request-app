/**
 * Canvas effects for the display + guest backgrounds.
 *
 * Performance rules (learned the hard way on iOS Safari):
 *  - no CSS `filter: blur()` / `backdrop-filter` on large layers — soft light is drawn on a tiny
 *    canvas and stretched instead (free blur, ~150 KB of GPU memory instead of ~100 MB);
 *  - no canvas `shadowBlur` — glows are a second, wider, translucent pass;
 *  - bitmaps are capped on phones/tablets.
 */
import { memo, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { audio } from '@/lib/audio';
import type { BackgroundTheme } from '@/lib/types';
import type { Palette } from '@/lib/palette';

const TAU = Math.PI * 2;

const isSmallDevice = () =>
  typeof navigator !== 'undefined' && (/iPad|iPhone|iPod|Android/.test(navigator.userAgent) || navigator.maxTouchPoints > 1);

const readTriplet = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(`--c-${name}`).trim() || '139 92 246';
const rgba = (triplet: string, a: number) => `rgba(${triplet.split(/\s+/).join(',')},${a})`;

/** Theme colours [primary, secondary, magenta, cyan], re-read every 2s so admin changes apply live. */
const themeCache = { at: -1e9, c: ['139 92 246', '59 130 246', '236 72 153', '34 211 238'] };
function themeColors(nowMs: number) {
  if (nowMs - themeCache.at > 2000) {
    themeCache.at = nowMs;
    themeCache.c = ['primary', 'secondary', 'magenta', 'cyan'].map(readTriplet);
  }
  return themeCache.c;
}

type Draw = (ctx: CanvasRenderingContext2D, w: number, h: number, t: number, dt: number) => void;

/**
 * Canvas render loop sized to its element.
 * `fixedLongSide` renders into a tiny bitmap (long side = N px) that CSS stretches to full size.
 */
function useCanvasLoop(draw: Draw, opts: { dprCap?: number; fps?: number; fixedLongSide?: number } = {}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;
  const { dprCap = 1.5, fps = 60, fixedLongSide } = opts;
  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d', { alpha: true })!;
    const small = isSmallDevice();
    const frameMs = 1000 / (small ? Math.min(fps, 30) : fps);
    let w = 0;
    let h = 0;
    let raf = 0;
    let last = 0;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;
      if (fixedLongSide) {
        const k = fixedLongSide / Math.max(r.width, r.height);
        w = Math.max(8, Math.round(r.width * k));
        h = Math.max(8, Math.round(r.height * k));
        canvas.width = w;
        canvas.height = h;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        return;
      }
      w = r.width;
      h = r.height;
      const maxPx = small ? 1100 : 3840;
      let dpr = Math.min(window.devicePixelRatio || 1, small ? 1 : dprCap);
      if (w * dpr > maxPx) dpr = maxPx / w;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (t - last < frameMs - 2) return;
      const dt = last ? Math.min(0.1, (t - last) / 1000) : 0.016;
      last = t;
      if (!w || !h) return;
      audio.frame(t);
      drawRef.current(ctx, w, h, t / 1000, dt);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [dprCap, fps, fixedLongSide]);
  return ref;
}

const parse = (triplet: string) => triplet.split(/\s+/).map(Number);
const fmt = (c: number[]) => `${Math.round(c[0])} ${Math.round(c[1])} ${Math.round(c[2])}`;

/* ---------------------------------------------------------------- Aurora */
/**
 * The room's light: drifting colour clouds, stage rays and bokeh, pulsing with the music.
 * `burst` mode draws rotating light rays from the centre (used behind cinematic moments).
 */
export const Aurora = memo(function Aurora({
  palette,
  mode = 'ambient',
  rays = true,
  bokeh = false,
  intensity = 1,
  className,
}: {
  palette?: Palette | null;
  mode?: 'ambient' | 'burst';
  rays?: boolean;
  bokeh?: boolean;
  intensity?: number;
  className?: string;
}) {
  const palRef = useRef(palette);
  palRef.current = palette;
  const accent = useRef<number[][] | null>(null);
  const ref = useCanvasLoop(
    (ctx, w, h, t, dt) => {
      const cols = themeColors(t * 1000);
      // ease towards the current song's colours
      const target = palRef.current ? palRef.current.map(parse) : [parse(cols[2]), parse(cols[0])];
      if (!accent.current) accent.current = target.map((c) => [...c]);
      const k = 1 - Math.exp(-dt * 1.4);
      for (let i = 0; i < 2; i++) for (let j = 0; j < 3; j++) accent.current[i][j] += (target[i][j] - accent.current[i][j]) * k;
      const A = fmt(accent.current[0]);
      const B = fmt(accent.current[1]);
      const beat = audio.beat;
      const en = audio.energy;
      const m = Math.max(w, h);

      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';

      if (mode === 'burst') {
        const cx = w / 2;
        const cy = h / 2;
        const R = Math.hypot(w, h) * 0.6;
        const n = 14;
        const rot = t * 0.2;
        for (let i = 0; i < n; i++) {
          const a0 = rot + (i / n) * TAU;
          const half = (TAU / n) * (0.24 + beat * 0.1);
          const col = i % 2 ? A : B;
          const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
          g.addColorStop(0, rgba(col, (0.17 + beat * 0.09) * intensity));
          g.addColorStop(0.55, rgba(col, 0.055 * intensity));
          g.addColorStop(1, rgba(col, 0));
          ctx.fillStyle = g;
          // three nested wedges → soft-edged beams instead of hard pixel steps
          for (const k2 of [1, 0.64, 0.32]) {
            ctx.beginPath();
            ctx.moveTo(cx, cy);
            ctx.arc(cx, cy, R, a0 - half * k2, a0 + half * k2);
            ctx.closePath();
            ctx.fill();
          }
        }
        const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, m * (0.34 + beat * 0.05));
        core.addColorStop(0, rgba(A, 0.5 * intensity));
        core.addColorStop(1, rgba(A, 0));
        ctx.fillStyle = core;
        ctx.fillRect(0, 0, w, h);
        return;
      }

      // colour clouds: [colour, x, y, radius, speedX, speedY, phase]
      const blobs: Array<[string, number, number, number, number, number, number]> = [
        [cols[0], 0.18, 0.28, 0.5, 0.11, 0.17, 0],
        [cols[1], 0.84, 0.18, 0.44, 0.13, 0.09, 1.7],
        [A, 0.72, 0.84, 0.52, 0.09, 0.12, 3.1],
        [cols[3], 0.26, 0.9, 0.38, 0.15, 0.07, 4.4],
        [B, 0.5, 0.5, 0.34, 0.07, 0.13, 5.2],
      ];
      for (const [c, bx, by, br, s1, s2, ph] of blobs) {
        const x = (bx + Math.sin(t * s1 + ph) * 0.16) * w;
        const y = (by + Math.cos(t * s2 + ph * 1.3) * 0.14) * h;
        const r = br * m * (1 + beat * 0.05 + en * 0.1);
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, rgba(c, (0.36 + en * 0.1) * intensity));
        g.addColorStop(1, rgba(c, 0));
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }

      if (rays) {
        // stage lights sweeping down from the rig
        const rayCols = [cols[3], A, cols[1], B];
        for (let k2 = 0; k2 < 4; k2++) {
          const x0 = w * (0.14 + 0.24 * k2);
          const sway = Math.sin(t * (0.16 + k2 * 0.03) + k2 * 2.1) * 0.42;
          const len = h * 1.3;
          const tipX = x0 + Math.sin(sway) * len;
          const spread = m * 0.085;
          const g = ctx.createLinearGradient(x0, 0, tipX, len);
          g.addColorStop(0, rgba(rayCols[k2], (0.2 + beat * 0.1) * intensity));
          g.addColorStop(0.75, rgba(rayCols[k2], 0.03 * intensity));
          g.addColorStop(1, rgba(rayCols[k2], 0));
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.moveTo(x0 - m * 0.006, -h * 0.05);
          ctx.lineTo(x0 + m * 0.006, -h * 0.05);
          ctx.lineTo(tipX + spread, len);
          ctx.lineTo(tipX - spread, len);
          ctx.closePath();
          ctx.fill();
        }
      }

      if (bokeh) {
        for (let i = 0; i < 12; i++) {
          const sx = (Math.sin(i * 12.9898) * 43758.5453) % 1;
          const sy = (Math.sin(i * 78.233) * 12543.123) % 1;
          const x = (Math.abs(sx) + Math.sin(t * 0.05 + i) * 0.04) * w;
          const y = ((((Math.abs(sy) - t * (0.006 + (i % 4) * 0.003)) % 1) + 1) % 1) * h;
          const r = m * (0.025 + (i % 5) * 0.012);
          const g = ctx.createRadialGradient(x, y, 0, x, y, r);
          const c = [cols[0], cols[2], cols[3], A][i % 4];
          g.addColorStop(0, rgba(c, 0.16 * intensity));
          g.addColorStop(0.7, rgba(c, 0.1 * intensity));
          g.addColorStop(1, rgba(c, 0));
          ctx.fillStyle = g;
          ctx.fillRect(x - r, y - r, r * 2, r * 2);
        }
      }
    },
    { fps: 30, fixedLongSide: mode === 'burst' ? 480 : 256 },
  );
  return <canvas ref={ref} className={cn('pointer-events-none absolute inset-0 h-full w-full', className)} />;
});

/* ------------------------------------------------------------- Particles */
export const ParticleField = memo(function ParticleField({
  density = 1,
  waves = true,
  className,
  energy = 1,
}: {
  density?: number;
  waves?: boolean;
  className?: string;
  energy?: number;
}) {
  const parts = useRef<Array<{ x: number; y: number; z: number; vx: number; vy: number; hue: number }>>([]);
  const ref = useCanvasLoop(
    (ctx, w, h, t) => {
      const colors = themeColors(t * 1000);
      const unit = Math.min(2.5, Math.max(0.7, Math.max(w, h) / 1920));
      const target = Math.round(((w * h) / 14000 / (unit * unit)) * density);
      const P = parts.current;
      while (P.length < target)
        P.push({
          x: Math.random() * w,
          y: Math.random() * h,
          z: Math.random(),
          vx: (Math.random() - 0.5) * 0.15,
          vy: -0.1 - Math.random() * 0.35,
          hue: Math.floor(Math.random() * 4),
        });
      if (P.length > target) P.length = target;
      ctx.clearRect(0, 0, w, h);
      const beat = audio.beat;

      if (waves) {
        // flowing sound-wave ribbons that swell with the music
        const mid = h * 0.62;
        const swell = 0.75 + audio.energy * 0.9;
        for (let k = 0; k < 4; k++) {
          ctx.beginPath();
          const amp = (h * 0.05 + k * h * 0.012) * energy * swell;
          for (let x = 0; x <= w; x += 12 * unit) {
            const y =
              mid +
              Math.sin((x / unit) * 0.004 + t * (0.6 + k * 0.15) + k) * amp +
              Math.sin((x / unit) * 0.011 - t * 1.1 + k * 2) * amp * 0.35;
            x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
          }
          ctx.strokeStyle = rgba(colors[[0, 2, 3, 1][k]], 0.22 - k * 0.035);
          ctx.lineWidth = 2 * unit;
          ctx.stroke();
        }
      }

      ctx.globalCompositeOperation = 'lighter';
      const speed = unit * energy * (1 + beat * 1.6);
      for (const p of P) {
        p.x += p.vx * (0.5 + p.z) * speed;
        p.y += p.vy * (0.5 + p.z) * speed;
        if (p.y < -10) {
          p.y = h + 10;
          p.x = Math.random() * w;
        }
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;
        const r = (0.6 + p.z * 2.2) * unit;
        const tw = 0.35 + 0.65 * Math.abs(Math.sin(t * (0.5 + p.z) + p.x));
        ctx.fillStyle = rgba(colors[[0, 2, 3, 1][p.hue]], 0.25 + p.z * 0.5 * tw);
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, TAU);
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'source-over';
    },
    { dprCap: 1.25, fps: 60 },
  );
  return <canvas ref={ref} className={cn('pointer-events-none absolute inset-0 h-full w-full', className)} />;
});

/* ------------------------------------------------------------ Visualizer */
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  if ((ctx as any).roundRect) (ctx as any).roundRect(x, y, w, h, rr);
  else ctx.rect(x, y, w, h);
  ctx.fill();
}

/**
 * Spectrum driven by the shared audio engine (live mic or synth).
 *  - bars:   classic spectrum with falling peak caps (+ optional reflection)
 *  - mirror: bars centred vertically
 *  - ring:   radial bars around a disc; `inner` = inner radius as a fraction of the half-size
 */
export const Visualizer = memo(function Visualizer({
  bars = 64,
  className,
  variant = 'bars',
  energy = 1,
  palette,
  symmetric = false,
  peaks = true,
  reflect = false,
  inner = 0.62,
}: {
  bars?: number;
  className?: string;
  variant?: 'bars' | 'ring' | 'mirror';
  energy?: number;
  palette?: Palette | null;
  symmetric?: boolean;
  peaks?: boolean;
  reflect?: boolean;
  inner?: number;
}) {
  const palRef = useRef(palette);
  palRef.current = palette;
  const ref = useCanvasLoop(
    (ctx, w, h, t) => {
      const cols = themeColors(t * 1000);
      const pal = palRef.current;
      const [c0, c1, c2] = pal ? [pal[0], cols[2], pal[1]] : [cols[0], cols[2], cols[3]];
      const L = audio.levels;
      const P = audio.peaks;
      const N = L.length;
      const sample = (arr: Float32Array, f: number) => {
        const x = Math.min(0.999, Math.max(0, f)) * (N - 1);
        const a = Math.floor(x);
        return Math.min(1, (arr[a] + (arr[a + 1] - arr[a]) * (x - a)) * energy);
      };
      // band position 0..1 for bar i (symmetric = bass in the middle, mirrored outwards)
      const pos = (i: number) => (symmetric ? Math.abs(i - (bars - 1) / 2) / ((bars - 1) / 2) : i / (bars - 1)) * 0.92;

      ctx.clearRect(0, 0, w, h);
      const grad = (x0: number, y0: number, x1: number, y1: number) => {
        const g = ctx.createLinearGradient(x0, y0, x1, y1);
        g.addColorStop(0, rgba(c0, 1));
        g.addColorStop(0.5, rgba(c1, 1));
        g.addColorStop(1, rgba(c2, 1));
        return g;
      };

      if (variant === 'ring') {
        const cx = w / 2;
        const cy = h / 2;
        const half = Math.min(w, h) / 2;
        const r0 = half * inner;
        const maxLen = half * 0.97 - r0;
        const lw = Math.max(1.5, ((TAU * r0) / bars) * 0.5);
        ctx.lineCap = 'round';
        ctx.strokeStyle = grad(cx - half, cy - half, cx + half, cy + half);
        // halo that breathes with the kick
        ctx.globalAlpha = 0.25 + audio.beat * 0.35;
        ctx.lineWidth = lw * 0.6;
        ctx.beginPath();
        ctx.arc(cx, cy, r0 - lw * 1.4, 0, TAU);
        ctx.stroke();
        for (let pass = 0; pass < 2; pass++) {
          ctx.globalAlpha = pass === 0 ? 0.22 : 1;
          ctx.lineWidth = pass === 0 ? lw * 2.4 : lw;
          for (let i = 0; i < bars; i++) {
            // mirrored left/right, bass at the bottom
            const frac = i / bars;
            const a = frac * TAU + Math.PI / 2;
            const v = sample(L, (1 - Math.abs(frac * 2 - 1)) * 0.92);
            const len = maxLen * (0.06 + v * 0.94);
            ctx.beginPath();
            ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
            ctx.lineTo(cx + Math.cos(a) * (r0 + len), cy + Math.sin(a) * (r0 + len));
            ctx.stroke();
          }
        }
        ctx.globalAlpha = 1;
        return;
      }

      const slot = w / bars;
      const bw = Math.max(1.5, slot * 0.6);
      const off = (slot - bw) / 2;
      const mirror = variant === 'mirror';
      const base = mirror ? h / 2 : reflect ? h * 0.74 : h;
      const maxH = mirror ? h / 2 - 2 : base - bw * 1.4;
      ctx.fillStyle = grad(0, 0, w, 0);
      for (let pass = 0; pass < 2; pass++) {
        // pass 0 = soft glow (wider + translucent), pass 1 = crisp bars
        ctx.globalAlpha = pass === 0 ? 0.2 : 1;
        const grow = pass === 0 ? bw * 0.55 : 0;
        for (let i = 0; i < bars; i++) {
          const bh = Math.max(bw, sample(L, pos(i)) * maxH);
          const x = i * slot + off;
          if (mirror) roundRect(ctx, x - grow, base - bh - grow, bw + grow * 2, bh * 2 + grow * 2, bw);
          else roundRect(ctx, x - grow, base - bh - grow, bw + grow * 2, bh + grow, bw / 2 + grow);
        }
      }
      if (peaks && !mirror) {
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        const cap = Math.max(2, bw * 0.3);
        for (let i = 0; i < bars; i++) {
          const ph = Math.max(bw, sample(P, pos(i)) * maxH);
          roundRect(ctx, i * slot + off, base - ph - cap * 2.2, bw, cap, cap / 2);
        }
      }
      if (reflect && !mirror) {
        ctx.fillStyle = grad(0, 0, w, 0);
        ctx.globalAlpha = 0.14;
        for (let i = 0; i < bars; i++) {
          const bh = Math.max(bw, sample(L, pos(i)) * maxH) * 0.32;
          roundRect(ctx, i * slot + off, base + bw * 0.5, bw, bh, bw / 2);
        }
      }
      ctx.globalAlpha = 1;
    },
    { dprCap: 1.5 },
  );
  return <canvas ref={ref} className={cn('h-full w-full', className)} />;
});

/* ------------------------------------------------------------ Atmosphere */
export function Atmosphere({
  theme = 'aurora',
  particles = true,
  density = 1,
  energy = 1,
  waves = true,
  grain = true,
  palette,
  calm = false,
}: {
  theme?: BackgroundTheme;
  particles?: boolean;
  density?: number;
  energy?: number;
  waves?: boolean;
  grain?: boolean;
  palette?: Palette | null;
  /** Quieter light for screens people read and type on (guest phone, setup pages): no stage rays, dimmer clouds. */
  calm?: boolean;
}) {
  const minimal = theme === 'minimal';
  const level = (minimal ? 0.35 : theme === 'nebula' ? 1.15 : 1) * (calm ? 0.5 : 1);
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,#17172e_0%,#080810_62%)]" />
      <Aurora palette={palette} rays={theme === 'aurora' && !calm} bokeh={theme === 'nebula'} intensity={level} />
      {theme === 'grid' && <div className="grid-floor" />}
      {particles && <ParticleField density={minimal ? density * 0.5 : density} energy={energy} waves={waves && !minimal} />}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_45%,rgba(0,0,0,0.6)_100%)]" />
      {grain && <div className="grain-layer" />}
    </div>
  );
}

/* --------------------------------------------------------------- Confetti */
export function Confetti({ burstKey, count = 160, className }: { burstKey: string | number; count?: number; className?: string }) {
  const parts = useRef<Array<{ x: number; y: number; vx: number; vy: number; r: number; vr: number; c: string; s: number; life: number }>>([]);
  const lastKey = useRef<string | number | null>(null);
  const ref = useCanvasLoop(
    (ctx, w, h, t) => {
      const unit = Math.min(2.5, Math.max(0.6, Math.max(w, h) / 1920));
      if (lastKey.current !== burstKey) {
        lastKey.current = burstKey;
        const cols = themeColors(t * 1000)
          .map((x) => rgba(x, 1))
          .concat(['#ffffff', '#FBBF24']);
        for (let i = 0; i < count; i++) {
          const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
          const sp = 8 + Math.random() * 14;
          parts.current.push({
            x: w / 2 + (Math.random() - 0.5) * w * 0.3,
            y: h * 0.75,
            vx: Math.cos(a) * sp * (w / 1200),
            vy: Math.sin(a) * sp * (h / 700),
            r: Math.random() * Math.PI,
            vr: (Math.random() - 0.5) * 0.3,
            c: cols[i % cols.length],
            s: (5 + Math.random() * 9) * unit,
            life: 1,
          });
        }
      }
      ctx.clearRect(0, 0, w, h);
      const P = parts.current;
      const g = 0.28 * (h / 1080);
      for (let i = P.length - 1; i >= 0; i--) {
        const p = P[i];
        p.vy += g;
        p.vx *= 0.99;
        p.x += p.vx;
        p.y += p.vy;
        p.r += p.vr;
        p.life -= 0.004;
        if (p.y > h + 40 || p.life <= 0) {
          P.splice(i, 1);
          continue;
        }
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.globalAlpha = Math.min(1, p.life * 2);
        ctx.fillStyle = p.c;
        ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        ctx.restore();
      }
    },
    { dprCap: 1 },
  );
  return <canvas ref={ref} className={cn('pointer-events-none absolute inset-0 h-full w-full', className)} />;
}
