import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { CountUp, EventLogo, LiveDot } from '@/components/ui';
import type { EventSnapshot } from '@/lib/types';
import { guestUrl } from '@/lib/utils';

export const STAGE_W = 1920;
export const STAGE_H = 1080;

/** Fixed 1920×1080 canvas scaled to any 16:9 screen (1080p, 4K, projectors) — pixel-identical layouts. */
export function Stage({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / STAGE_W, window.innerHeight / STAGE_H));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);
  return (
    <div className="fixed inset-0 overflow-hidden bg-black">
      <div
        className="stage absolute left-1/2 top-1/2 overflow-hidden bg-ink"
        style={{
          width: STAGE_W,
          height: STAGE_H,
          transform: `translate(-50%, -50%) scale(${scale})`,
          transformOrigin: 'center',
        }}
      >
        {children}
      </div>
    </div>
  );
}

export function DisplayHeader({ snap, compact }: { snap: EventSnapshot; compact?: boolean }) {
  const requests = snap.requests.filter((r) => r.status !== 'rejected').length;
  return (
    <header className="flex h-[112px] items-center justify-between px-16">
      <div className="flex items-center gap-5">
        <EventLogo name={snap.event.name} logoUrl={snap.event.logoUrl} size={64} />
        <div>
          <div className="font-display text-[34px] font-black leading-none tracking-tight">{snap.event.name}</div>
          {snap.event.date && !compact && (
            <div className="mt-1.5 text-[16px] font-semibold uppercase tracking-[0.3em] text-white/45">
              {new Date(snap.event.date).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 rounded-full border border-rose-400/40 bg-rose-500/10 px-6 py-2.5">
        <LiveDot className="h-3.5 w-3.5" />
        <span className="font-display text-[20px] font-black tracking-[0.3em] text-rose-100">LIVE</span>
      </div>
      <div className="flex items-center gap-12">
        <Stat label="Requests" value={requests} />
        <Stat label="Votes" value={snap.settings.totalVotes} />
        <Stat label="Guests" value={snap.settings.guestCount} />
        {snap.settings.demo.enabled && (
          <span className="rounded-full border border-amber-300/50 bg-amber-300/10 px-4 py-1.5 text-[15px] font-black tracking-[0.25em] text-amber-200">
            DEMO
          </span>
        )}
      </div>
    </header>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-right">
      <CountUp value={value} className="block font-display text-[40px] font-black leading-none tabular-nums" />
      <div className="mt-1 text-[13px] font-bold uppercase tracking-[0.3em] text-white/45">{label}</div>
    </div>
  );
}

export function QRBlock({ snap, size = 220, vertical = false }: { snap: EventSnapshot; size?: number; vertical?: boolean }) {
  const url = guestUrl(snap.event.id, snap.settings.qrUrl);
  const closed = !snap.settings.submissionsEnabled;
  return (
    <div className={vertical ? 'flex flex-col items-center gap-6 text-center' : 'flex items-center gap-8'}>
      <div className="relative shrink-0 rounded-[28px] bg-gradient-to-br from-primary via-magenta to-cyan p-[3px] shadow-glow-lg">
        <div className="rounded-[25px] bg-white p-4">
          <QRCodeSVG value={url} size={size} level="M" bgColor="#ffffff" fgColor="#080810" />
        </div>
      </div>
      <div>
        <div className="text-[18px] font-bold uppercase tracking-[0.35em] text-white/55">
          {closed ? 'Requests paused' : 'Got a song in mind?'}
        </div>
        <div className="mt-3 font-display text-[42px] font-black leading-[1.02] tracking-tight">
          SCAN.
          <br />
          REQUEST.
          <br />
          <span className="text-gradient-anim">VIBE.</span>
        </div>
      </div>
    </div>
  );
}

const MESSAGES = [
  'YOUR SONG. YOUR MOMENT.',
  "LET'S MAKE SOME NOISE.",
  'THE NEXT HIT COULD BE YOURS.',
  'REQUEST THE SOUNDTRACK OF TONIGHT.',
  'THE CROWD CONTROLS THE VIBE.',
];

export function FooterTicker() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((x) => (x + 1) % MESSAGES.length), 6000);
    return () => clearInterval(t);
  }, []);
  return (
    <footer className="relative flex h-[84px] items-center justify-center overflow-hidden border-t border-white/[0.06]">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/70 to-transparent" />
      <AnimatePresence>
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 24, letterSpacing: '0.6em' }}
          animate={{ opacity: 1, y: 0, letterSpacing: '0.32em' }}
          exit={{ opacity: 0, y: -24 }}
          transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
          className="font-display text-[28px] font-bold text-white/85"
        >
          {MESSAGES[i]}
        </motion.div>
      </AnimatePresence>
    </footer>
  );
}

/** Briefly highlights when a value changes (used for "new leader" moments). */
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
