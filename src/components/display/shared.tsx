/**
 * Shared building blocks for the LED display.
 *
 * SCALING: the stage is designed in "design pixels" (1920×1080 landscape, 1080×1920 portrait) and
 * scaled by setting the root font size, so every size in display components is in rem
 * (1rem = 16 design px). Plain layout — no CSS zoom, no transform scale — which keeps GPU memory
 * proportional to the real screen and behaves the same in every browser.
 */
import { AnimatePresence, motion } from 'framer-motion';
import { createContext, Fragment, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Heart, Music2, Sparkle, Users } from 'lucide-react';
import { CountUp, EventLogo, LiveDot } from '@/components/ui';
import { audio } from '@/lib/audio';
import type { Palette } from '@/lib/palette';
import type { EventSnapshot } from '@/lib/types';
import { cn, guestUrl, publicBaseUrl, rem } from '@/lib/utils';

/* ------------------------------------------------------------------ Stage */
export interface StageInfo {
  portrait: boolean;
  /**
   * Stage size in design px. The base is 1920×1080 (landscape) or 1080×1920 (portrait); one side
   * grows to match the real screen so odd aspect ratios are filled instead of letterboxed:
   * landscape up to 2560 wide (21:9) or 1240 tall (16:10), portrait up to 2400 tall (phones) or
   * 1280 wide. Layouts never get *less* room than the base size.
   */
  W: number;
  H: number;
  /** Real px per design px (use to scale JS-driven motion offsets). */
  u: number;
}
const StageCtx = createContext<StageInfo>({ portrait: false, W: 1920, H: 1080, u: 1 });
export const useStage = () => useContext(StageCtx);

/** Header / footer heights in design px (layouts that position things manually rely on these). */
export const HEADER_L = 104;
export const HEADER_P = 232;
export const FOOTER_H = 84;

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

function measure(): StageInfo {
  const vw = Math.max(1, window.innerWidth);
  const vh = Math.max(1, window.innerHeight);
  let W: number;
  let H: number;
  const portrait = vh > vw;
  if (portrait) {
    // vertical screens (LED totems, phones)
    if (vh / vw >= 16 / 9) {
      W = 1080;
      H = clamp(Math.round((vh / vw) * 1080), 1920, 2400);
    } else {
      H = 1920;
      W = clamp(Math.round((vw / vh) * 1920), 1080, 1280);
    }
  } else if (vw / vh >= 16 / 9) {
    H = 1080;
    W = clamp(Math.round((vw / vh) * 1080), 1920, 2560);
  } else {
    W = 1920;
    H = clamp(Math.round((vh / vw) * 1920), 1080, 1240);
  }
  return { portrait, W, H, u: Math.min(vw / W, vh / H) };
}

const isSmallDevice = () =>
  typeof navigator !== 'undefined' && (/iPad|iPhone|iPod|Android/.test(navigator.userAgent) || navigator.maxTouchPoints > 1);

export function Stage({ children, background }: { children: ReactNode; background?: ReactNode }) {
  const [info, setInfo] = useState(measure);
  const original = useRef<string | null>(null);

  // Set the scale before first paint.
  useLayoutEffect(() => {
    const root = document.documentElement;
    if (original.current === null) original.current = root.style.fontSize;
    root.style.fontSize = `${16 * info.u}px`;
  }, [info.u]);
  useEffect(
    () => () => {
      document.documentElement.style.fontSize = original.current ?? '';
    },
    [],
  );
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const fit = () => {
      clearTimeout(t);
      t = setTimeout(() => setInfo(measure()), 120);
    };
    window.addEventListener('resize', fit);
    window.addEventListener('orientationchange', fit);
    return () => {
      clearTimeout(t);
      window.removeEventListener('resize', fit);
      window.removeEventListener('orientationchange', fit);
    };
  }, []);

  return (
    <StageCtx.Provider value={info}>
      <div className="fixed inset-0 flex items-center justify-center overflow-hidden bg-ink">
        {/* the room's light fills the whole screen, including any letterbox bars */}
        {background}
        <div
          className="stage relative shrink-0 overflow-hidden"
          data-portrait={info.portrait ? '1' : undefined}
          data-lite={isSmallDevice() ? '1' : undefined}
          style={{ width: rem(info.W), height: rem(info.H) }}
        >
          {children}
        </div>
      </div>
    </StageCtx.Provider>
  );
}

/* ------------------------------------------------------------------ hooks */
/** True for `ms` after `value` changes (not on first render). */
export function useChanged<T>(value: T, ms = 2500) {
  const prev = useRef(value);
  const [changed, setChanged] = useState(false);
  useEffect(() => {
    if (prev.current !== value && prev.current !== undefined && prev.current !== null) {
      setChanged(true);
      const t = setTimeout(() => setChanged(false), ms);
      prev.current = value;
      return () => clearTimeout(t);
    }
    prev.current = value;
  }, [value, ms]);
  return changed;
}

/** Cycles through a list of strings. */
export function useRotating(items: string[], ms = 6000) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => x + 1), ms);
    return () => clearInterval(t);
  }, [ms]);
  return items[i % items.length];
}

/* -------------------------------------------------------- micro-reactions */
/** Floating "+N ♥" each time a vote count goes up — the crowd sees its taps land on the big screen. */
export function VotePops({ value, className, small }: { value: number; className?: string; small?: boolean }) {
  const { u } = useStage();
  const prev = useRef(value);
  const seq = useRef(0);
  const [pops, setPops] = useState<Array<{ id: number; d: number; x: number }>>([]);
  useEffect(() => {
    const d = value - prev.current;
    prev.current = value;
    if (d <= 0 || d > 99) return;
    const id = ++seq.current;
    setPops((p) => [...p.slice(-2), { id, d, x: (Math.random() - 0.5) * 36 }]);
    setTimeout(() => setPops((p) => p.filter((x) => x.id !== id)), 1100);
  }, [value]);
  return (
    <span className={cn('pointer-events-none absolute z-20', className)} aria-hidden>
      {pops.map((p) => (
        <span key={p.id} className="absolute bottom-0 left-0 -translate-x-1/2">
          <motion.span
            initial={{ opacity: 0, y: 0, x: p.x * u, scale: 0.5 }}
            animate={{ opacity: [0, 1, 1, 0], y: -78 * u, scale: [0.5, 1.3, 1, 0.9] }}
            transition={{ duration: 1.05, times: [0, 0.15, 0.7, 1], ease: 'easeOut' }}
            className={cn('flex items-center gap-1 whitespace-nowrap font-display font-black text-pink-300', small ? 'text-[1.125rem]' : 'text-[1.5rem]')}
            style={{ textShadow: '0 0 0.6em rgb(var(--c-magenta) / 0.9)' }}
          >
            +{p.d}
            <Heart className="h-[1.1em] w-[1.1em] fill-current" />
          </motion.span>
        </span>
      ))}
    </span>
  );
}

/** Pops its children whenever `value` increases. */
export function Bump({ value, children, className }: { value: number; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef(value);
  useEffect(() => {
    const up = value > prev.current;
    prev.current = value;
    if (up)
      ref.current?.animate?.([{ transform: 'scale(1)' }, { transform: 'scale(1.22)' }, { transform: 'scale(1)' }], {
        duration: 380,
        easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      });
  }, [value]);
  return (
    <span ref={ref} className={cn('inline-block', className)}>
      {children}
    </span>
  );
}

/** Scales (or fades) its content with the kick drum. Keep usage to a handful of elements. */
export function BeatPulse({
  children,
  amount = 0.03,
  mode = 'scale',
  className,
  style,
}: {
  children?: ReactNode;
  amount?: number;
  mode?: 'scale' | 'opacity';
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let raf = 0;
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop);
      audio.frame(t);
      const el = ref.current;
      if (!el) return;
      if (mode === 'scale') el.style.transform = `scale(${(1 + audio.beat * amount).toFixed(4)})`;
      else el.style.opacity = Math.min(1, 1 - amount + audio.beat * amount).toFixed(3);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [amount, mode]);
  return (
    <div ref={ref} className={className} style={{ willChange: mode === 'scale' ? 'transform' : 'opacity', ...style }}>
      {children}
    </div>
  );
}

/** A spinning record with a label in the song's colours. Fills its parent (which must be square). */
export function Vinyl({ palette, className }: { palette?: Palette | null; className?: string }) {
  const a = palette ? `rgb(${palette[0]})` : 'rgb(var(--c-primary))';
  const b = palette ? `rgb(${palette[1]})` : 'rgb(var(--c-magenta))';
  return (
    <div className={cn('relative h-full w-full overflow-hidden rounded-full shadow-[0_1rem_3rem_rgba(0,0,0,0.65)] ring-[0.12rem] ring-white/20', className)}>
      <div className="vinyl-grooves animate-spin-slow absolute inset-0 rounded-full">
        <div className="absolute inset-[31%] rounded-full" style={{ background: `conic-gradient(${a}, ${b}, ${a})` }} />
        <div className="absolute inset-[47%] rounded-full bg-ink ring-1 ring-white/25" />
      </div>
      {/* the reflection stays put while the record turns */}
      <div className="vinyl-sheen absolute inset-0 rounded-full" />
    </div>
  );
}

/* ----------------------------------------------------------------- header */
function LivePill({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-3 rounded-full border border-rose-400/45 bg-rose-500/[0.12] px-6 py-2.5', className)}>
      <LiveDot className="h-3.5 w-3.5" />
      <span className="font-display text-[1.25rem] font-black leading-none tracking-[0.3em] text-rose-100">LIVE</span>
      <span className="flex h-5 items-end gap-[0.2rem]" aria-hidden>
        {[0, 1, 2, 3].map((i) => (
          <span
            key={i}
            className="eq-bar h-full w-[0.25rem] rounded-full bg-rose-300"
            style={{ animationDelay: `${i * 0.19}s`, animationDuration: `${0.7 + ((i * 37) % 50) / 100}s` }}
          />
        ))}
      </span>
    </div>
  );
}

const DemoBadge = () => (
  <span className="rounded-full border border-amber-300/50 bg-amber-300/10 px-4 py-1.5 text-[0.9375rem] font-black tracking-[0.25em] text-amber-200">
    DEMO
  </span>
);

export function DisplayHeader({ snap }: { snap: EventSnapshot }) {
  const { portrait } = useStage();
  const stats = [
    { label: 'Requests', value: snap.requests.filter((r) => r.status !== 'rejected').length, Icon: Music2, tint: 'text-cyan' },
    { label: 'Votes', value: snap.settings.totalVotes, Icon: Heart, tint: 'text-pink-400' },
    { label: 'Guests', value: snap.settings.guestCount, Icon: Users, tint: 'text-violet-300' },
  ];
  const date =
    snap.event.date &&
    new Date(snap.event.date).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
  const demo = snap.settings.demo.enabled;
  // with an uploaded logo, the logo leads and the event name steps back
  const branded = !!snap.event.logoUrl;

  if (portrait)
    return (
      <header className="relative z-10 flex shrink-0 flex-col justify-between px-10 pb-1 pt-8" style={{ height: rem(HEADER_P) }}>
        <div className="flex items-center justify-between gap-6">
          <div className="flex min-w-0 items-center gap-5">
            <EventLogo name={snap.event.name} logoUrl={snap.event.logoUrl} size={branded ? 104 : 76} />
            <div className="min-w-0">
              <div className={cn('truncate font-display font-black leading-[1.15] tracking-tight', branded ? 'text-[1.75rem] text-white/85' : 'text-[2.5rem]')} dir="auto">
                {snap.event.name}
              </div>
              {date && <div className="text-[1.125rem] font-semibold uppercase tracking-[0.28em] text-white/45">{date}</div>}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {demo && <DemoBadge />}
            <LivePill />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {stats.map(({ label, value, Icon, tint }) => (
            <div key={label} className="card-frame flex items-center gap-4 rounded-[1.5rem] px-5 py-3.5">
              <Icon className={cn('h-9 w-9 shrink-0', tint)} />
              <div className="min-w-0">
                <Bump value={value}>
                  <CountUp value={value} className="block font-display text-[2.25rem] font-black leading-none tabular-nums" />
                </Bump>
                <div className="mt-1 text-[0.9375rem] font-bold uppercase tracking-[0.24em] text-white/45">{label}</div>
              </div>
            </div>
          ))}
        </div>
      </header>
    );

  return (
    <header className="relative z-10 flex shrink-0 items-center justify-between gap-8 px-16" style={{ height: rem(HEADER_L) }}>
      <div className="flex min-w-0 max-w-[36%] items-center gap-5">
        <EventLogo name={snap.event.name} logoUrl={snap.event.logoUrl} size={branded ? 88 : 62} />
        <div className="min-w-0">
          <div className={cn('truncate font-display font-black leading-[1.15] tracking-tight', branded ? 'text-[1.5rem] text-white/85' : 'text-[2.125rem]')} dir="auto">
            {snap.event.name}
          </div>
          {date && <div className="text-[0.9375rem] font-semibold uppercase tracking-[0.3em] text-white/45">{date}</div>}
        </div>
      </div>
      <LivePill className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" />
      <div className="flex shrink-0 items-center gap-7">
        {stats.map(({ label, value, Icon, tint }) => (
          <div key={label} className="flex items-center gap-3">
            <div className="grid h-[3.25rem] w-[3.25rem] place-items-center rounded-2xl border border-white/10 bg-white/[0.06]">
              <Icon className={cn('h-6 w-6', tint)} />
            </div>
            <div>
              <Bump value={value}>
                <CountUp value={value} className="block font-display text-[2.125rem] font-black leading-none tabular-nums" />
              </Bump>
              <div className="mt-1 text-[0.8125rem] font-bold uppercase tracking-[0.28em] text-white/45">{label}</div>
            </div>
          </div>
        ))}
        {demo && <DemoBadge />}
      </div>
    </header>
  );
}

/* --------------------------------------------------------------------- QR */
function QRTile({ url, size }: { url: string; size: number }) {
  const corners = [
    '-left-[0.55rem] -top-[0.55rem] rounded-tl-[1.1rem] border-l-[0.3rem] border-t-[0.3rem]',
    '-right-[0.55rem] -top-[0.55rem] rounded-tr-[1.1rem] border-r-[0.3rem] border-t-[0.3rem]',
    '-bottom-[0.55rem] -left-[0.55rem] rounded-bl-[1.1rem] border-b-[0.3rem] border-l-[0.3rem]',
    '-bottom-[0.55rem] -right-[0.55rem] rounded-br-[1.1rem] border-b-[0.3rem] border-r-[0.3rem]',
  ];
  return (
    <div className="qr-attn relative shrink-0" style={{ width: rem(size), height: rem(size) }}>
      {corners.map((c, i) => (
        <span key={c} className={cn('qr-corner absolute h-9 w-9 border-cyan', c)} style={{ animationDelay: `${i * 0.2}s` }} />
      ))}
      <div className="h-full w-full rounded-[1.5rem] bg-gradient-to-br from-primary via-magenta to-cyan p-[0.22rem] shadow-glow-lg">
        <div className="relative h-full w-full overflow-hidden rounded-[1.3rem] bg-white p-[6.5%]">
          <QRCodeSVG value={url} size={256} level="M" bgColor="#ffffff" fgColor="#080810" style={{ width: '100%', height: '100%' }} />
          <div className="qr-scan absolute inset-x-[5%] h-[0.2rem] rounded-full" />
        </div>
      </div>
    </div>
  );
}

function shortGuestUrl(snap: EventSnapshot) {
  const override = snap.settings.qrUrl?.trim();
  const full = override || `${publicBaseUrl()}/g/${encodeURIComponent(snap.event.id)}`;
  return full.replace(/^https?:\/\//, '').replace(/\/$/, '');
}

export function QRCard({
  snap,
  variant = 'row',
  size = 208,
  steps = false,
  className,
}: {
  snap: EventSnapshot;
  variant?: 'row' | 'stack' | 'mini';
  /** QR size in design px. */
  size?: number;
  /** Show the 1-2-3 "how it works" strip (row variant, when there is room). */
  steps?: boolean;
  className?: string;
}) {
  const url = guestUrl(snap.event.id, snap.settings.qrUrl);
  const closed = !snap.settings.submissionsEnabled || snap.event.status === 'ended';
  const eyebrow = useRotating(
    closed ? ['Requests are paused', 'Voting is still open'] : ['Got a song in mind?', 'Vote for your favourite', 'No app needed'],
    5200,
  );

  if (variant === 'mini')
    return (
      <div className={cn('card-solid flex items-center gap-5 rounded-[1.75rem] p-4 pr-7', className)}>
        <QRTile url={url} size={size} />
        <div>
          <div className="text-[0.9375rem] font-bold uppercase tracking-[0.3em] text-white/50">{closed ? 'Vote now' : 'Your turn'}</div>
          <div className="mt-1 font-display text-[1.625rem] font-black leading-[1.1]">
            SCAN TO
            <br />
            <span className="text-gradient-anim">{closed ? 'VOTE' : 'REQUEST'}</span>
          </div>
        </div>
      </div>
    );

  const stack = variant === 'stack';
  return (
    <div className={cn('card-frame relative overflow-hidden rounded-[2.25rem] p-7', className)}>
      <div className="absolute -right-24 -top-28 h-80 w-80 rounded-full bg-[radial-gradient(closest-side,rgb(var(--c-magenta)/0.38),transparent)]" />
      <div className="absolute -bottom-28 -left-24 h-72 w-72 rounded-full bg-[radial-gradient(closest-side,rgb(var(--c-cyan)/0.2),transparent)]" />
      <div className={cn('relative flex items-center', stack ? 'flex-col gap-7 text-center' : 'gap-9')}>
        <QRTile url={url} size={size} />
        <div className="min-w-0">
          <div className="relative h-[1.6rem] overflow-hidden text-[1rem] font-bold uppercase tracking-[0.2em] text-white/60">
            <AnimatePresence initial={false}>
              <motion.div
                key={eyebrow}
                className={cn('absolute inset-0 whitespace-nowrap', stack && 'text-center')}
                initial={{ y: '100%', opacity: 0 }}
                animate={{ y: '0%', opacity: 1 }}
                exit={{ y: '-100%', opacity: 0 }}
                transition={{ duration: 0.45 }}
              >
                {eyebrow}
              </motion.div>
            </AnimatePresence>
          </div>
          <div className="mt-3 font-display text-[2.75rem] font-black leading-[1.02] tracking-tight">
            SCAN.
            <br />
            REQUEST.
            <br />
            <span className="text-gradient-anim">VIBE.</span>
          </div>
          <div className={cn('mt-3 truncate font-mono text-[1rem] text-white/45', stack && 'mx-auto max-w-full')}>{shortGuestUrl(snap)}</div>
        </div>
        {steps && !stack && (
          <div className="ml-auto flex shrink-0 flex-col gap-3">
            {(closed ? ['Scan the code', 'Browse the queue', 'Vote it to the top'] : ['Scan the code', 'Pick your song', 'Vote it to the top']).map((t, i) => (
              <div key={t} className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/[0.06] py-2.5 pl-2.5 pr-6">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-magenta font-display text-[1.125rem] font-black">
                  {i + 1}
                </span>
                <span className="whitespace-nowrap text-[1.25rem] font-semibold text-white/85">{t}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- footer */
const MESSAGES = [
  'YOUR SONG. YOUR MOMENT.',
  "LET'S MAKE SOME NOISE.",
  'THE NEXT HIT COULD BE YOURS.',
  'REQUEST THE SOUNDTRACK OF TONIGHT.',
  'THE CROWD CONTROLS THE VIBE.',
];

/** Kinetic ticker: alternating solid / outlined phrases scrolling forever. */
export function FooterMarquee() {
  return (
    <footer className="relative z-10 flex shrink-0 items-center overflow-hidden border-t border-white/[0.07] bg-[#0b0b16]" style={{ height: rem(FOOTER_H) }}>
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/80 to-transparent" />
      <div className="marquee-track items-center whitespace-nowrap font-display text-[1.75rem] font-black tracking-[0.16em]">
        {[0, 1].map((half) => (
          <div key={half} className="flex shrink-0 items-center" aria-hidden={half === 1}>
            {MESSAGES.map((m, i) => (
              <Fragment key={m}>
                <span className={i % 2 ? 'text-stroke' : 'text-white/90'}>{m}</span>
                <Sparkle className="mx-10 h-7 w-7 shrink-0 fill-magenta text-magenta" />
              </Fragment>
            ))}
          </div>
        ))}
      </div>
      <div className="pointer-events-none absolute inset-y-0 left-0 w-40 bg-gradient-to-r from-[#0b0b16] to-transparent" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-40 bg-gradient-to-l from-[#0b0b16] to-transparent" />
    </footer>
  );
}
