import { memo, useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { BackgroundTheme } from '@/lib/types';

const css = (name: string) =>
  typeof window === 'undefined'
    ? '139 92 246'
    : getComputedStyle(document.documentElement).getPropertyValue(`--c-${name}`).trim() || '139 92 246';
const rgba = (triplet: string, a: number) => `rgba(${triplet.split(/\s+/).join(',')},${a})`;

/** Runs a canvas render loop sized to its parent, pausing when the tab is hidden. */
function useCanvasLoop(
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number, t: number) => void,
  opts: { dprCap?: number; fps?: number } = {},
) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawRef = useRef(draw);
  drawRef.current = draw;
  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext('2d', { alpha: true })!;
    let w = 0;
    let h = 0;
    let raf = 0;
    let last = 0;
    const frameMs = 1000 / (opts.fps ?? 60);
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, opts.dprCap ?? 1.5);
      w = r.width;
      h = r.height;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    resize();
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      if (t - last < frameMs - 1) return;
      last = t;
      drawRef.current(ctx, w, h, t / 1000);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [opts.dprCap, opts.fps]);
  return ref;
}

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
  const colors = useRef<string[]>([]);
  const ref = useCanvasLoop((ctx, w, h, t) => {
    if (!colors.current.length || Math.floor(t) % 5 === 0) colors.current = ['primary', 'magenta', 'cyan', 'secondary'].map(css);
    const target = Math.round((w * h) / 14000 * density);
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

    if (waves) {
      // flowing sound-wave ribbons
      const mid = h * 0.62;
      for (let k = 0; k < 4; k++) {
        ctx.beginPath();
        const amp = (h * 0.05 + k * h * 0.012) * energy;
        for (let x = 0; x <= w; x += 12) {
          const y =
            mid +
            Math.sin(x * 0.004 + t * (0.6 + k * 0.15) + k) * amp +
            Math.sin(x * 0.011 - t * 1.1 + k * 2) * amp * 0.35;
          x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.strokeStyle = rgba(colors.current[k % 4], 0.22 - k * 0.035);
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    ctx.globalCompositeOperation = 'lighter';
    for (const p of P) {
      p.x += p.vx * (0.5 + p.z) * energy;
      p.y += p.vy * (0.5 + p.z) * energy;
      if (p.y < -10) {
        p.y = h + 10;
        p.x = Math.random() * w;
      }
      if (p.x < -10) p.x = w + 10;
      if (p.x > w + 10) p.x = -10;
      const r = 0.6 + p.z * 2.2;
      const tw = 0.35 + 0.65 * Math.abs(Math.sin(t * (0.5 + p.z) + p.x));
      ctx.fillStyle = rgba(colors.current[p.hue], 0.25 + p.z * 0.5 * tw);
      ctx.beginPath();
      ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';
  }, { dprCap: 1.25, fps: 60 });
  return <canvas ref={ref} className={cn('pointer-events-none absolute inset-0 h-full w-full', className)} />;
});

/* ------------------------------------------------------------ Visualizer */
export const Visualizer = memo(function Visualizer({
  bars = 64,
  className,
  variant = 'bars',
  energy = 1,
}: {
  bars?: number;
  className?: string;
  variant?: 'bars' | 'ring' | 'mirror';
  energy?: number;
}) {
  const levels = useRef<number[]>([]);
  const ref = useCanvasLoop((ctx, w, h, t) => {
    const [p, m, c] = ['primary', 'magenta', 'cyan'].map(css);
    const L = levels.current;
    while (L.length < bars) L.push(0);
    // synthetic but musical: beat pulse + per-band noise
    const beat = Math.pow(Math.max(0, Math.sin(t * Math.PI * 2 * 2.03)), 8);
    for (let i = 0; i < bars; i++) {
      const f = i / bars;
      const target =
        (0.18 +
          0.42 * Math.abs(Math.sin(t * (1.3 + f * 2.7) + i * 0.7)) * (1 - f * 0.45) +
          0.3 * beat * (1 - f) +
          0.1 * Math.abs(Math.sin(t * 7.1 + i * 1.9))) *
        energy;
      L[i] += (Math.min(1, target) - L[i]) * 0.22;
    }
    ctx.clearRect(0, 0, w, h);
    const grad = (x0: number, y0: number, x1: number, y1: number) => {
      const g = ctx.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, rgba(p, 0.95));
      g.addColorStop(0.55, rgba(m, 0.95));
      g.addColorStop(1, rgba(c, 0.95));
      return g;
    };
    ctx.shadowBlur = 18;
    ctx.shadowColor = rgba(m, 0.6);
    if (variant === 'ring') {
      const cx = w / 2;
      const cy = h / 2;
      const r0 = Math.min(w, h) * 0.3;
      ctx.strokeStyle = grad(0, 0, w, h);
      ctx.lineCap = 'round';
      ctx.lineWidth = Math.max(2, (Math.PI * 2 * r0) / bars / 2.2);
      for (let i = 0; i < bars; i++) {
        const a = (i / bars) * Math.PI * 2 + t * 0.15;
        const len = r0 * 0.15 + L[i] * r0 * 0.55;
        ctx.beginPath();
        ctx.moveTo(cx + Math.cos(a) * r0, cy + Math.sin(a) * r0);
        ctx.lineTo(cx + Math.cos(a) * (r0 + len), cy + Math.sin(a) * (r0 + len));
        ctx.stroke();
      }
    } else {
      const gap = Math.max(2, w / bars / 4);
      const bw = w / bars - gap;
      ctx.fillStyle = grad(0, 0, w, 0);
      for (let i = 0; i < bars; i++) {
        const x = i * (bw + gap) + gap / 2;
        const bh = Math.max(3, L[i] * (variant === 'mirror' ? h / 2 : h));
        const y = variant === 'mirror' ? h / 2 - bh / 2 : h - bh;
        ctx.beginPath();
        (ctx as any).roundRect ? (ctx as any).roundRect(x, y, bw, bh, bw / 2) : ctx.rect(x, y, bw, bh);
        ctx.fill();
      }
    }
    ctx.shadowBlur = 0;
  }, { dprCap: 1.5 });
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
}: {
  theme?: BackgroundTheme;
  particles?: boolean;
  density?: number;
  energy?: number;
  waves?: boolean;
  grain?: boolean;
}) {
  return (
    <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', grain && 'grain')} aria-hidden>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,#14142a_0%,#080810_60%)]" />
      {theme !== 'minimal' && <div className="aurora" />}
      {(theme === 'aurora' || theme === 'nebula') && (
        <>
          <div className="beam" style={{ left: '12%', animationDelay: '-3s' }} />
          <div className="beam" style={{ left: '62%', animationDelay: '-9s', animationDuration: '18s' }} />
        </>
      )}
      {theme === 'grid' && <div className="grid-floor" />}
      {theme === 'nebula' && (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgb(var(--c-magenta)/0.35),transparent_55%)]" />
      )}
      {particles && <ParticleField density={density} energy={energy} waves={waves} />}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.65)_100%)]" />
    </div>
  );
}

/* --------------------------------------------------------------- Confetti */
export function Confetti({ burstKey, count = 160, className }: { burstKey: string | number; count?: number; className?: string }) {
  const parts = useRef<Array<{ x: number; y: number; vx: number; vy: number; r: number; vr: number; c: string; s: number; life: number }>>([]);
  const lastKey = useRef<string | number | null>(null);
  const ref = useCanvasLoop((ctx, w, h) => {
    if (lastKey.current !== burstKey) {
      lastKey.current = burstKey;
      const cols = ['primary', 'magenta', 'cyan', 'secondary'].map(css).map((x) => rgba(x, 1)).concat(['#ffffff', '#FBBF24']);
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
          s: 5 + Math.random() * 9,
          life: 1,
        });
      }
    }
    ctx.clearRect(0, 0, w, h);
    const P = parts.current;
    for (let i = P.length - 1; i >= 0; i--) {
      const p = P[i];
      p.vy += 0.28;
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
  }, { dprCap: 1 });
  return <canvas ref={ref} className={cn('pointer-events-none absolute inset-0 h-full w-full', className)} />;
}
