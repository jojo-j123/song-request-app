/**
 * Full-screen cinematic moments. Each one sits on an opaque backdrop with rotating light rays
 * (drawn on a tiny canvas) and adapts to landscape and portrait stages.
 */
import { AnimatePresence, motion } from 'framer-motion';
import { Cake, Crown, Dices, Gift, Heart, Sparkles, Swords, Zap } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Aurora, Confetti, ParticleField, Visualizer } from '@/components/fx';
import { Artwork, CountUp } from '@/components/ui';
import { useNow } from '@/hooks/useEvent';
import { usePalette, type Palette } from '@/lib/palette';
import { sound } from '@/lib/sound';
import type { Battle, DisplayCommand, EventSnapshot, SongRequest } from '@/lib/types';
import { cn, rem } from '@/lib/utils';
import { fitTitle } from './MainScreen';
import { SpinningDisc } from './Screens';
import { BeatPulse, Bump, useStage, VotePops } from './shared';

export const MOMENT_DURATION: Record<string, (c: DisplayCommand) => number> = {
  countdown: (c) => (Number(c.payload.duration) || 3) + 12.5,
  fame: () => 12,
  hype: () => 8,
  dedication: () => 14,
  birthday: () => 13,
  surprise: () => 12,
  clear: () => 0,
};

const GOLD: Palette = ['251 191 36', '236 72 153'];

/** Largest one-line font size (design px) for a display-font string within `maxW` design px. */
const fitLine = (text: string, base: number, maxW: number, ratio = 0.84) => Math.min(base, maxW / Math.max(1, text.length * ratio));

function Backdrop({ children, palette, intensity = 1 }: { children: ReactNode; palette?: Palette | null; intensity?: number }) {
  return (
    <motion.div className="absolute inset-0 z-50 overflow-hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.7 }}>
      <div className="absolute inset-0 bg-ink" />
      <Aurora mode="burst" palette={palette} intensity={intensity} />
      <ParticleField density={1.3} energy={1.8} waves={false} />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(0,0,0,0.72)_100%)]" />
      <div className="relative z-10 h-full">{children}</div>
    </motion.div>
  );
}

/** Expanding ring from the centre of its (relative) parent. */
function Shock({ className, delay = 0, size = 30 }: { className?: string; delay?: number; size?: number }) {
  return (
    <span
      className={cn('shock pointer-events-none absolute left-1/2 top-1/2 rounded-full border-[0.3rem] opacity-0', className)}
      style={{ width: `${size}rem`, height: `${size}rem`, marginLeft: `${-size / 2}rem`, marginTop: `${-size / 2}rem`, animationDelay: `${delay}s` }}
    />
  );
}

/* ============================================================ COUNTDOWN */
function useShuffle(pool: string[], running: boolean, ms = 85) {
  const [name, setName] = useState(pool[0] ?? '');
  const key = pool.join('|');
  useEffect(() => {
    if (!running || pool.length < 2) return;
    const t = setInterval(() => setName(pool[Math.floor(Math.random() * pool.length)]), ms);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, key, ms]);
  return name;
}

export function CountdownReveal({
  cmd,
  req,
  showNames,
  names,
  logoUrl,
}: {
  /** Event logo, shown as the opening card of the countdown. */
  logoUrl?: string | null;
  cmd: DisplayCommand;
  req: SongRequest | undefined;
  showNames: boolean;
  /** Guests in the running — their names flicker while the crowd waits. */
  names: string[];
}) {
  const { portrait, W } = useStage();
  const palette = usePalette(req);
  const now = useNow(100);
  const D = Math.max(1, Number(cmd.payload.duration) || 3);
  const t = (now - new Date(cmd.triggeredAt).getTime()) / 1000;
  const INTRO = 1.6;
  const phase = t < INTRO ? 'intro' : t < INTRO + D ? 'count' : 'reveal';
  const n = Math.max(1, D - Math.floor(t - INTRO));
  const shuffled = useShuffle(names, phase !== 'reveal');
  const last = useRef('');
  useEffect(() => {
    const key = phase === 'count' ? `c${n}` : phase;
    if (key === last.current) return;
    last.current = key;
    if (phase === 'intro') sound.play('whoosh');
    else if (phase === 'count') sound.play('tick');
    else sound.play('reveal');
  }, [phase, n]);
  const guest = req?.guestName.toUpperCase() ?? '';

  return (
    <Backdrop palette={phase === 'reveal' ? palette : null}>
      <AnimatePresence>
        {phase === 'intro' && (
          <motion.div key="intro" className="absolute inset-0 flex flex-col items-center justify-center gap-10" exit={{ opacity: 0, scale: 1.25 }} transition={{ duration: 0.4 }}>
            {logoUrl && (
              <motion.img
                src={logoUrl}
                alt=""
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6 }}
                className="h-[13rem] w-auto max-w-[70%] object-contain"
              />
            )}
            <motion.div
              initial={{ letterSpacing: '1.2em', opacity: 0 }}
              animate={{ letterSpacing: '0.4em', opacity: 1 }}
              transition={{ duration: 1.3 }}
              className={cn('whitespace-nowrap pl-[0.4em] font-display font-black text-white/90', portrait ? 'text-[3.25rem]' : 'text-[4.25rem]')}
            >
              WHO'S NEXT?
            </motion.div>
          </motion.div>
        )}
        {phase === 'count' && (
          <motion.div
            key={`n${n}`}
            className="absolute inset-0 grid place-items-center"
            initial={{ scale: 2.3, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.45, opacity: 0 }}
            transition={{ duration: 0.5, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <Shock className="border-magenta/80" size={34} />
            <Shock className="border-cyan/70" size={34} delay={0.14} />
            <div className="rgb-split font-display font-black leading-none tabular-nums" style={{ fontSize: rem(portrait ? 500 : 540) }}>
              {n}
            </div>
          </motion.div>
        )}
        {phase !== 'reveal' && showNames && names.length > 1 && (
          <motion.div key="shuffle" className="absolute inset-x-0 bottom-[11%] flex justify-center" initial={{ opacity: 0, y: '40%' }} animate={{ opacity: 1, y: '0%' }} exit={{ opacity: 0 }}>
            <div className="card-solid flex items-center gap-4 rounded-full py-3 pl-6 pr-9 font-display text-[2rem] font-black">
              <Dices className="h-9 w-9 shrink-0 text-cyan" />
              <span className="min-w-[13rem] text-center" dir="auto">
                {shuffled}
              </span>
            </div>
          </motion.div>
        )}
        {phase === 'reveal' && req && (
          <motion.div
            key="reveal"
            className={cn('absolute inset-0 flex items-center', portrait ? 'flex-col justify-center gap-8 px-10 text-center' : 'gap-16 px-24')}
            exit={{ opacity: 0 }}
          >
            <motion.div className="absolute inset-0 bg-white" initial={{ opacity: 0.95 }} animate={{ opacity: 0 }} transition={{ duration: 0.7 }} />
            <Confetti burstKey={cmd.id} count={220} />
            <motion.div
              className="relative shrink-0"
              initial={{ scale: 0.25, rotate: -200, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 70, damping: 13 }}
            >
              <SpinningDisc req={req} palette={palette} size={portrait ? 760 : 700} energy={1.3} />
            </motion.div>
            <div className="relative min-w-0 flex-1">
              <motion.div
                initial={{ opacity: 0, y: '60%' }}
                animate={{ opacity: 1, y: '0%' }}
                transition={{ delay: 0.35 }}
                className="font-display text-[1.75rem] font-black tracking-[0.45em] text-cyan"
              >
                UP NEXT
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: '30%' }}
                animate={{ opacity: 1, y: '0%' }}
                transition={{ delay: 0.5, duration: 0.8 }}
                className="glow-title mt-5 line-clamp-3 font-display font-black leading-[1.02] tracking-tight"
                style={{ fontSize: rem(fitTitle(req.songTitle, portrait ? 92 : 116)) }}
                dir="auto"
              >
                {req.songTitle}
              </motion.div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="mt-4 truncate text-[2.875rem] font-semibold text-white/70" dir="auto">
                {req.artist}
              </motion.div>
              {showNames && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 1.6, type: 'spring', stiffness: 130, damping: 12 }}
                  className={cn('mt-12 font-display font-black leading-[1.15]', portrait ? 'origin-center' : 'origin-left')}
                >
                  <div className="text-[2.75rem] text-white/90">THIS ONE IS FROM</div>
                  <div
                    className="whitespace-nowrap text-gradient-anim"
                    style={{ fontSize: rem(fitLine(guest + '!', 88, portrait ? W - 120 : W - 1020)) }}
                    dir="auto"
                  >
                    {guest}!
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Backdrop>
  );
}

/* ============================================================ WALL OF FAME */
const FAME_LINES = ['YOU MADE THE NIGHT!', 'THE CROWD PICKED YOUR SONG!', "TONIGHT'S SOUNDTRACK HERO!", 'THIS MOMENT BELONGS TO YOU!'];

export function WallOfFameMoment({ cmd, req }: { cmd: DisplayCommand; req: SongRequest | undefined }) {
  const { portrait, W } = useStage();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const line: string = useMemo(() => cmd.payload.message || FAME_LINES[Math.floor(Math.random() * FAME_LINES.length)], [cmd.id]);
  useEffect(() => sound.play('winner'), [cmd.id]);
  if (!req) return null;
  return (
    <Backdrop palette={GOLD} intensity={0.9}>
      <Confetti burstKey={cmd.id} count={220} />
      {/* spotlight cone */}
      <motion.div
        className="absolute left-1/2 top-[-12rem] h-[100rem] w-[60rem]"
        style={{
          x: '-50%',
          transformOrigin: '50% 0%',
          background:
            'conic-gradient(from 180deg at 50% 0%, transparent 160deg, rgba(255,240,200,0.16) 174deg, rgba(255,240,200,0.3) 180deg, rgba(255,240,200,0.16) 186deg, transparent 200deg)',
        }}
        initial={{ opacity: 0, rotate: -14 }}
        animate={{ opacity: 1, rotate: [-14, 9, -4, 0] }}
        transition={{ duration: 2.4 }}
      />
      <div className="relative flex h-full flex-col items-center justify-center px-10 text-center">
        <motion.div initial={{ opacity: 0, y: '-60%' }} animate={{ opacity: 1, y: '0%' }} className="flex items-center gap-4 font-display text-[1.875rem] font-black tracking-[0.5em] text-amber-200">
          <Crown className="h-11 w-11 fill-amber-300/30" /> WALL OF FAME
        </motion.div>
        <motion.div
          initial={{ scale: 0.4, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3, type: 'spring', stiffness: 90, damping: 12 }}
          className="mt-8 whitespace-nowrap font-display font-black leading-[1.1] text-gradient-gold"
          style={{ fontSize: rem(fitLine(req.guestName, portrait ? 150 : 170, W - 160, 0.74)), filter: 'drop-shadow(0 0 1.5rem rgba(251,191,36,0.45))' }}
          dir="auto"
        >
          {req.guestName}
        </motion.div>
        <motion.div
          initial={{ opacity: 0, letterSpacing: '0.7em' }}
          animate={{ opacity: 1, letterSpacing: '0.12em' }}
          transition={{ delay: 0.9, duration: 1 }}
          className={cn('mt-8 font-display font-black leading-tight', portrait ? 'text-[2.5rem]' : 'text-[3.375rem]')}
        >
          {line}
        </motion.div>
        <motion.div
          initial={{ opacity: 0, y: '40%' }}
          animate={{ opacity: 1, y: '0%' }}
          transition={{ delay: 1.4 }}
          className="card-solid mt-12 flex max-w-full items-center gap-7 rounded-[2.25rem] p-5 pr-11"
        >
          <Artwork url={req.artworkUrl} seed={req.songTitle} label={req.songTitle} className="h-[9.5rem] w-[9.5rem]" rounded="rounded-[1.6rem]" />
          <div className="min-w-0 text-left">
            <div className="truncate text-[2.625rem] font-black" dir="auto">
              {req.songTitle}
            </div>
            <div className="truncate text-[1.875rem] text-white/60" dir="auto">
              {req.artist}
            </div>
          </div>
        </motion.div>
      </div>
    </Backdrop>
  );
}

/* ============================================================ HYPE */
export function HypeMoment({ cmd }: { cmd: DisplayCommand }) {
  const { portrait, W, u } = useStage();
  useEffect(() => sound.play('reveal'), [cmd.id]);
  const text: string = (cmd.payload.message || "LET'S MAKE SOME NOISE!").toUpperCase();
  const words = text.split(/\s+/).filter(Boolean);
  const longest = Math.max(...words.map((w) => w.length));
  const crowd = words.length > 7 ? 0.55 : words.length > 4 ? 0.78 : 1;
  const size = Math.min(portrait ? 150 : 176, (W - 200) / (longest * 0.9)) * (portrait ? Math.min(1, crowd + 0.15) : crowd);
  return (
    <Backdrop>
      <Confetti burstKey={cmd.id} count={260} />
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute left-1/2 top-1/2 -ml-[14rem] -mt-[14rem] h-[28rem] w-[28rem] rounded-full border-[0.2rem] border-cyan/60"
          initial={{ scale: 0, opacity: 1 }}
          animate={{ scale: 6, opacity: 0 }}
          transition={{ duration: 2.2, delay: i * 0.5, repeat: Infinity, repeatDelay: 0.3 }}
        />
      ))}
      <motion.div
        className="relative flex h-full flex-col items-center justify-center px-10"
        animate={{ x: [0, -16 * u, 13 * u, -8 * u, 5 * u, 0], y: [0, 8 * u, -6 * u, 3 * u, 0, 0] }}
        transition={{ delay: 0.32, duration: 0.5 }}
      >
        <BeatPulse amount={0.18}>
          <Zap className="mb-4 h-24 w-24 fill-amber-300 text-amber-300" style={{ filter: 'drop-shadow(0 0 1.5rem rgba(251,191,36,0.8))' }} />
        </BeatPulse>
        <div className="flex max-w-full flex-wrap justify-center gap-x-[0.35em] text-center font-display font-black leading-[1.02]" style={{ fontSize: rem(size) }}>
          {words.map((w, i) => (
            <motion.span
              key={i}
              initial={{ scale: 3.2, opacity: 0, rotate: i % 2 ? 9 : -9 }}
              animate={{ scale: [3.2, 0.88, 1.06, 1], opacity: 1, rotate: 0 }}
              transition={{ delay: 0.15 + i * 0.16, duration: 0.6 }}
              className={i === words.length - 1 ? 'text-gradient-anim' : 'rgb-split text-white'}
            >
              {w}
            </motion.span>
          ))}
        </div>
        <motion.div className={cn('mt-10 h-[8.5rem]', portrait ? 'w-[58rem]' : 'w-[86rem]')} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}>
          <Visualizer variant="mirror" bars={portrait ? 60 : 90} energy={1.5} symmetric />
        </motion.div>
      </motion.div>
    </Backdrop>
  );
}

/* ============================================================ DEDICATION */
export function DedicationMoment({ cmd, req }: { cmd: DisplayCommand; req?: SongRequest }) {
  const { portrait, W } = useStage();
  useEffect(() => sound.play('whoosh'), [cmd.id]);
  const p = cmd.payload;
  const title: string | undefined = p.songTitle || req?.songTitle;
  const artist: string | undefined = p.artist || req?.artist;
  const from: string | undefined = p.from || req?.guestName;
  const to: string | undefined = p.to || req?.dedicatedTo || undefined;
  const message: string | undefined = p.message || req?.message || undefined;
  return (
    <Backdrop>
      <div className="flex h-full flex-col items-center justify-center px-14 text-center">
        <BeatPulse amount={0.16}>
          <Heart className="h-28 w-28 fill-magenta text-magenta" style={{ filter: 'drop-shadow(0 0 2rem rgb(var(--c-magenta)))' }} />
        </BeatPulse>
        <motion.div
          initial={{ opacity: 0, y: '60%' }}
          animate={{ opacity: 1, y: '0%' }}
          transition={{ delay: 0.3 }}
          className="mt-7 font-display text-[1.75rem] font-black tracking-[0.5em] text-white/60"
        >
          A DEDICATION
        </motion.div>
        {to && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.6, duration: 0.8 }}
            className="mt-7 max-w-full font-display font-black leading-[1.05]"
            style={{ fontSize: rem(fitLine(`For ${to}`, portrait ? 92 : 116, (W - 160) * (portrait ? (to.length > 9 ? 1.9 : 1) : to.length > 22 ? 1.9 : 1), 0.74)) }}
          >
            For{' '}
            <span className="text-gradient-anim glow-text" dir="auto">
              {to}
            </span>
          </motion.div>
        )}
        {message && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.4, duration: 1.2 }}
            className={cn('mt-9 max-w-[82rem] italic leading-snug text-white/85', portrait ? 'text-[2.75rem]' : 'text-[2.875rem]')}
            dir="auto"
          >
            “{message}”
          </motion.div>
        )}
        {from && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2 }} className="mt-7 text-[2.125rem] text-white/60">
            with love,{' '}
            <span className="font-bold text-white" dir="auto">
              {from}
            </span>
          </motion.div>
        )}
        {title && (
          <motion.div
            initial={{ opacity: 0, y: '40%' }}
            animate={{ opacity: 1, y: '0%' }}
            transition={{ delay: 2.6 }}
            className="card-solid mt-12 flex max-w-full items-center gap-6 rounded-[1.9rem] p-5 pr-10"
          >
            <Artwork url={req?.artworkUrl} seed={title} label={title} className="h-24 w-24" rounded="rounded-[1.25rem]" />
            <div className="min-w-0 text-left">
              <div className="truncate text-[2.25rem] font-black" dir="auto">
                {title}
              </div>
              <div className="truncate text-[1.625rem] text-white/60" dir="auto">
                {artist}
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </Backdrop>
  );
}

/* ============================================================ BIRTHDAY */
export function BirthdayMoment({ cmd }: { cmd: DisplayCommand }) {
  const { portrait, W, H, u } = useStage();
  useEffect(() => sound.play('winner'), [cmd.id]);
  const name: string = String(cmd.payload.name || 'YOU').toUpperCase();
  return (
    <Backdrop palette={GOLD}>
      <Confetti burstKey={cmd.id} count={320} />
      <Confetti burstKey={cmd.id + '-2'} count={200} />
      {Array.from({ length: 14 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute bottom-[-11rem] h-[8.5rem] w-[6.5rem] rounded-[50%]"
          style={{
            left: `${(i * 7.3) % 96}%`,
            background: ['rgb(var(--c-primary))', 'rgb(var(--c-magenta))', 'rgb(var(--c-cyan))', '#FBBF24'][i % 4],
            boxShadow: 'inset -0.9rem -1.1rem 1.9rem rgba(0,0,0,0.25)',
          }}
          animate={{ y: -(H + 400) * u, x: [0, 30 * u, -20 * u, 10 * u] }}
          transition={{ duration: 7 + (i % 5), delay: (i % 7) * 0.4, ease: 'easeOut' }}
        />
      ))}
      <div className="relative flex h-full flex-col items-center justify-center px-10 text-center">
        <motion.div initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 120 }}>
          <Cake className="h-32 w-32 text-amber-300" style={{ filter: 'drop-shadow(0 0 1.5rem rgba(251,191,36,0.7))' }} />
        </motion.div>
        <motion.div
          initial={{ opacity: 0, letterSpacing: '0.9em' }}
          animate={{ opacity: 1, letterSpacing: '0.28em' }}
          transition={{ delay: 0.3, duration: 1 }}
          className={cn('mt-7 whitespace-nowrap pl-[0.28em] font-display font-black', portrait ? 'text-[3.25rem]' : 'text-[4rem]')}
        >
          HAPPY BIRTHDAY
        </motion.div>
        <motion.div
          initial={{ scale: 0.3, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.8, type: 'spring', stiffness: 80, damping: 10 }}
          className="mt-3 whitespace-nowrap font-display font-black leading-[1.1] text-gradient-gold"
          style={{ fontSize: rem(fitLine(name, portrait ? 190 : 210, W - 140)), filter: 'drop-shadow(0 0 1.5rem rgba(251,191,36,0.45))' }}
          dir="auto"
        >
          {name}
        </motion.div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.8 }}
          className={cn('mt-9 max-w-[82rem] text-white/85', portrait ? 'text-[2.25rem]' : 'text-[2.625rem]')}
          dir="auto"
        >
          {cmd.payload.message || 'The whole room is celebrating you tonight!'}
        </motion.div>
      </div>
    </Backdrop>
  );
}

/* ============================================================ SURPRISE */
export function SurpriseMoment({ cmd }: { cmd: DisplayCommand }) {
  const { portrait } = useStage();
  const now = useNow(100);
  const t = (now - new Date(cmd.triggeredAt).getTime()) / 1000;
  const revealed = t > 3.2;
  const done = useRef(false);
  useEffect(() => {
    sound.play('whoosh');
  }, [cmd.id]);
  useEffect(() => {
    if (revealed && !done.current) {
      done.current = true;
      sound.play('reveal');
    }
  }, [revealed]);
  const message = String(cmd.payload.message || 'THE NEXT ROUND IS ON THE DJ!');
  const base = portrait ? 86 : 108;
  return (
    <Backdrop intensity={revealed ? 1 : 0.45}>
      {revealed && <Confetti burstKey={cmd.id} count={240} />}
      <div className="relative flex h-full flex-col items-center justify-center px-12 text-center">
        <AnimatePresence>
          {!revealed ? (
            <motion.div key="box" className="absolute flex flex-col items-center" exit={{ scale: 3, opacity: 0 }} transition={{ duration: 0.45 }}>
              <motion.div animate={{ rotate: [0, -8, 8, -12, 12, -6, 6, 0], scale: [1, 1.05, 1, 1.1, 1, 1.15, 1.22] }} transition={{ duration: 3, ease: 'easeIn' }}>
                <Gift className="h-56 w-56 text-magenta" style={{ filter: 'drop-shadow(0 0 2.5rem rgb(var(--c-magenta)))' }} />
              </motion.div>
              <div className={cn('mt-10 whitespace-nowrap font-display font-black tracking-[0.4em] text-white/75', portrait ? 'text-[2rem]' : 'text-[2.75rem]')}>
                SOMETHING'S COMING…
              </div>
            </motion.div>
          ) : (
            <motion.div key="msg" className="relative" initial={{ scale: 0.2, opacity: 0, rotate: -10 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 100, damping: 11 }}>
              <Shock className="border-cyan/70" size={40} />
              <Sparkles className="mx-auto h-20 w-20 text-cyan" />
              <div className="mt-5 font-display text-[2.25rem] font-black tracking-[0.45em] text-cyan">{cmd.payload.title || 'SURPRISE!'}</div>
              <div
                className="mt-7 max-w-[100rem] font-display font-black leading-[1.04] text-gradient-anim glow-text"
                style={{ fontSize: rem(message.length > 60 ? base * 0.62 : message.length > 34 ? base * 0.8 : base) }}
                dir="auto"
              >
                {message}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Backdrop>
  );
}

/* ============================================================ CROWD VOTE */
export function CrowdVoteOverlay({ battle, snap }: { battle: Battle; snap: EventSnapshot }) {
  const { portrait } = useStage();
  const now = useNow(250);
  const left = Math.max(0, Math.ceil((new Date(battle.endsAt).getTime() - now) / 1000));
  const ended = battle.status === 'ended' || left === 0;
  const songs = battle.requestIds.map((id) => snap.requests.find((r) => r.id === id));
  const tallies = battle.requestIds.map((id) => battle.tallies[id] ?? 0);
  const total = tallies[0] + tallies[1] || 1;
  const winnerId = battle.winnerId ?? (tallies[1] > tallies[0] ? battle.requestIds[1] : battle.requestIds[0]);
  const prevTotal = useRef(total);
  useEffect(() => {
    if (total > prevTotal.current) sound.play('vote');
    prevTotal.current = total;
  }, [total]);
  const tickKey = left <= 5 ? left : 99;
  useEffect(() => {
    if (ended) sound.play('winner');
    else if (tickKey <= 5 && tickKey > 0) sound.play('tick');
  }, [ended, tickKey]);

  return (
    <Backdrop>
      {ended && <Confetti burstKey={battle.id} count={240} />}
      <div className={cn('flex h-full flex-col', portrait ? 'px-10 py-12' : 'px-20 py-12')}>
        <div className={cn('flex items-center justify-between gap-6', portrait && 'flex-col')}>
          <div className={cn('flex items-center gap-5 font-display font-black tracking-[0.25em]', portrait ? 'text-[2.75rem]' : 'text-[2.75rem]')}>
            <Swords className="h-12 w-12 text-cyan" /> CROWD VOTE
          </div>
          <AnimatePresence initial={false}>
            {ended ? (
              <motion.div
                key="end"
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className={cn('whitespace-nowrap font-display font-black tracking-[0.16em] text-amber-300', portrait ? 'text-[2.125rem]' : 'text-[2.5rem]')}
              >
                THE CROWD HAS SPOKEN
              </motion.div>
            ) : (
              <motion.div
                key="timer"
                exit={{ opacity: 0 }}
                className={cn('rounded-full border-[0.15rem] px-10 py-2 font-display text-[3.75rem] font-black leading-[1.2] tabular-nums', left <= 5 ? 'border-rose-400 text-rose-300' : 'border-white/25')}
                animate={left <= 5 ? { scale: [1, 1.1, 1] } : { scale: 1 }}
                transition={{ duration: 0.5, repeat: left <= 5 ? Infinity : 0 }}
              >
                {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className={cn('relative mt-9 grid min-h-0 flex-1', portrait ? 'grid-rows-2 gap-16' : 'grid-cols-2 gap-28')}>
          <BeatPulse
            amount={0.1}
            className={cn(
              'absolute z-10 grid h-36 w-36 place-items-center rounded-full bg-gradient-to-br from-primary to-magenta font-display text-[3.25rem] font-black shadow-glow-lg',
              portrait ? 'left-1/2 top-1/2 -ml-[4.5rem] -mt-[4.5rem]' : 'left-1/2 top-[40%] -ml-[4.5rem] -mt-[4.5rem]',
            )}
          >
            VS
          </BeatPulse>
          {songs.map((s, i) => {
            if (!s) return <div key={i} />;
            const pct = Math.round((tallies[i] / total) * 100);
            const isWinner = ended && s.id === winnerId;
            const isLoser = ended && s.id !== winnerId;
            return (
              <motion.div
                key={s.id}
                animate={{ scale: isWinner ? 1.04 : isLoser ? 0.92 : 1, opacity: isLoser ? 0.35 : 1 }}
                transition={{ type: 'spring', stiffness: 80, damping: 14 }}
                className={cn(
                  'relative flex min-h-0 min-w-0 rounded-[3rem]',
                  portrait ? 'items-center gap-8 p-8' : 'flex-col items-center p-10',
                  isWinner ? 'neon-border card-solid' : 'card-frame',
                  isLoser && 'grayscale',
                )}
              >
                {isWinner && (
                  <motion.div
                    initial={{ y: '-80%', opacity: 0, rotate: -30 }}
                    animate={{ y: '0%', opacity: 1, rotate: 12 }}
                    className="absolute -right-5 -top-9 z-10"
                  >
                    <Crown className="h-20 w-20 fill-amber-300/30 text-amber-300" style={{ filter: 'drop-shadow(0 0 1.2rem rgba(251,191,36,0.8))' }} />
                  </motion.div>
                )}
                <Artwork
                  url={s.artworkUrl}
                  seed={s.songTitle}
                  label={s.songTitle}
                  className={portrait ? 'h-[23rem] w-[23rem]' : 'h-[20rem] w-[20rem]'}
                  rounded="rounded-[2.25rem]"
                />
                <div className={cn('flex min-w-0 flex-col', portrait ? 'flex-1 self-stretch justify-center' : 'mt-7 w-full flex-1 items-center')}>
                  <div className={cn('max-w-full font-display font-black', portrait ? 'line-clamp-2 text-[2.75rem] leading-[1.1]' : 'truncate text-center text-[2.875rem]')} dir="auto">
                    {s.songTitle}
                  </div>
                  <div className="max-w-full truncate text-[1.875rem] text-white/60" dir="auto">
                    {s.artist}
                  </div>
                  <div className={cn('w-full', portrait ? 'mt-8' : 'mt-auto pt-6')}>
                    <div className="flex items-end justify-between">
                      <div className="relative">
                        <VotePops value={tallies[i]} className="left-1/2 top-2" />
                        <Bump value={tallies[i]}>
                          <CountUp value={tallies[i]} className="font-display text-[4.5rem] font-black leading-none tabular-nums" />
                        </Bump>
                      </div>
                      <div className="font-display text-[3rem] font-black leading-none text-white/70 tabular-nums">{pct}%</div>
                    </div>
                    <div className="mt-4 h-6 overflow-hidden rounded-full bg-white/10">
                      <motion.div
                        className={cn('h-full rounded-full', i === 0 ? 'bg-gradient-to-r from-primary to-magenta' : 'bg-gradient-to-r from-secondary to-cyan')}
                        animate={{ width: `${pct}%` }}
                        transition={{ type: 'spring', stiffness: 60, damping: 15 }}
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
        {!ended && (
          <div className={cn('mt-8 text-center font-display font-bold tracking-[0.26em] text-white/65', portrait ? 'text-[1.5rem]' : 'text-[1.875rem]')}>
            VOTE NOW ON YOUR PHONE — SCAN THE QR CODE
          </div>
        )}
      </div>
    </Backdrop>
  );
}
