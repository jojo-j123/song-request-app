import { AnimatePresence, motion } from 'framer-motion';
import { Cake, Crown, Gift, Heart, Sparkles, Swords, Zap } from 'lucide-react';
import { useEffect, useMemo, useRef } from 'react';
import { Confetti, ParticleField, Visualizer } from '@/components/fx';
import { Artwork, CountUp } from '@/components/ui';
import { useNow } from '@/hooks/useEvent';
import { sound } from '@/lib/sound';
import type { Battle, DisplayCommand, EventSnapshot, SongRequest } from '@/lib/types';
import { cn } from '@/lib/utils';

export const MOMENT_DURATION: Record<string, (c: DisplayCommand) => number> = {
  countdown: (c) => (Number(c.payload.duration) || 3) + 12.5,
  fame: () => 12,
  hype: () => 8,
  dedication: () => 14,
  birthday: () => 13,
  surprise: () => 12,
  clear: () => 0,
};

function Backdrop({ children, tone = 'dark' }: { children: React.ReactNode; tone?: 'dark' | 'magenta' | 'gold' }) {
  return (
    <motion.div
      className="absolute inset-0 z-50 overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, filter: 'blur(20px)' }}
      transition={{ duration: 0.8 }}
    >
      <div className="absolute inset-0 bg-ink" />
      <div
        className={cn(
          'absolute inset-0',
          tone === 'dark' && 'bg-[radial-gradient(circle_at_50%_60%,rgb(var(--c-primary)/0.35),transparent_60%)]',
          tone === 'magenta' && 'bg-[radial-gradient(circle_at_50%_50%,rgb(var(--c-magenta)/0.4),transparent_65%)]',
          tone === 'gold' && 'bg-[radial-gradient(circle_at_50%_40%,rgba(251,191,36,0.3),transparent_60%)]',
        )}
      />
      <div className="beam" style={{ left: '8%', animationDuration: '6s' }} />
      <div className="beam" style={{ left: '70%', animationDuration: '7s', animationDelay: '-2s' }} />
      <ParticleField density={1.6} energy={1.8} waves />
      <div className="relative z-10 h-full">{children}</div>
    </motion.div>
  );
}

/* ============================================================ COUNTDOWN */
export function CountdownReveal({ cmd, req, showNames }: { cmd: DisplayCommand; req: SongRequest | undefined; showNames: boolean }) {
  const now = useNow(100);
  const D = Math.max(1, Number(cmd.payload.duration) || 3);
  const t = (now - new Date(cmd.triggeredAt).getTime()) / 1000;
  const INTRO = 1.6;
  const phase = t < INTRO ? 'intro' : t < INTRO + D ? 'count' : 'reveal';
  const n = Math.max(1, D - Math.floor(t - INTRO));
  const last = useRef<string>('');
  useEffect(() => {
    const key = phase === 'count' ? `c${n}` : phase;
    if (key === last.current) return;
    last.current = key;
    if (phase === 'intro') sound.play('whoosh');
    else if (phase === 'count') sound.play('tick');
    else sound.play('reveal');
  }, [phase, n]);

  return (
    <Backdrop>
      <AnimatePresence mode="wait">
        {phase === 'intro' && (
          <motion.div key="intro" className="grid h-full place-items-center" exit={{ opacity: 0 }}>
            <motion.div
              initial={{ letterSpacing: '1.4em', opacity: 0 }}
              animate={{ letterSpacing: '0.5em', opacity: 1 }}
              transition={{ duration: 1.4 }}
              className="font-display text-[44px] font-black text-white/80"
            >
              WHO'S NEXT?
            </motion.div>
          </motion.div>
        )}
        {phase === 'count' && (
          <motion.div
            key={`n${n}`}
            className="grid h-full place-items-center"
            initial={{ scale: 2.4, opacity: 0, filter: 'blur(30px)' }}
            animate={{ scale: 1, opacity: 1, filter: 'blur(0px)' }}
            exit={{ scale: 0.4, opacity: 0, filter: 'blur(20px)' }}
            transition={{ duration: 0.55, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <div className="relative">
              <motion.div
                className="absolute left-1/2 top-1/2 h-[620px] w-[620px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[6px] border-magenta/60"
                initial={{ scale: 0.6, opacity: 1 }}
                animate={{ scale: 1.5, opacity: 0 }}
                transition={{ duration: 1 }}
              />
              <div className="font-display text-[520px] font-black leading-none text-gradient glow-text tabular-nums">{n}</div>
            </div>
          </motion.div>
        )}
        {phase === 'reveal' && req && (
          <motion.div key="reveal" className="relative grid h-full grid-cols-[640px_1fr] items-center gap-24 px-32">
            <motion.div className="absolute inset-0 bg-white" initial={{ opacity: 0.9 }} animate={{ opacity: 0 }} transition={{ duration: 0.7 }} />
            <Confetti burstKey={cmd.id} count={220} />
            <motion.div
              initial={{ scale: 0.3, rotateY: 180, opacity: 0 }}
              animate={{ scale: 1, rotateY: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 70, damping: 13 }}
              className="relative"
              style={{ perspective: 1200 }}
            >
              <div className="absolute -inset-16">
                <Visualizer variant="ring" bars={110} energy={1.3} />
              </div>
              <div className="absolute -inset-8 rounded-[60px] bg-gradient-to-br from-primary via-magenta to-cyan opacity-60 blur-3xl" />
              <Artwork url={req.artworkUrl} seed={req.songTitle} label={req.songTitle} className="relative h-[560px] w-[560px]" rounded="rounded-[48px]" />
            </motion.div>
            <div className="min-w-0">
              <motion.div initial={{ opacity: 0, x: 60 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 }} className="font-display text-[26px] font-black tracking-[0.45em] text-cyan">
                UP NEXT
              </motion.div>
              <motion.div
                initial={{ opacity: 0, y: 40, filter: 'blur(14px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ delay: 0.5, duration: 0.8 }}
                className="mt-6 line-clamp-3 font-display font-black leading-[0.98] tracking-tight glow-text"
                style={{ fontSize: req.songTitle.length > 24 ? 86 : 118 }}
              >
                {req.songTitle}
              </motion.div>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="mt-5 text-[46px] font-semibold text-white/70">
                {req.artist}
              </motion.div>
              {showNames && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 1.6, type: 'spring', stiffness: 120 }}
                  className="mt-14 font-display font-black leading-tight"
                  style={{ fontSize: req.guestName.length > 14 ? 46 : 60 }}
                >
                  THIS ONE IS FROM <span className="whitespace-nowrap text-gradient-anim">{req.guestName.toUpperCase()}!</span>
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
  const line = useMemo(() => cmd.payload.message || FAME_LINES[Math.floor(Math.random() * FAME_LINES.length)], [cmd.id]);
  useEffect(() => sound.play('winner'), [cmd.id]);
  if (!req) return null;
  return (
    <Backdrop tone="gold">
      <Confetti burstKey={cmd.id} count={200} />
      {/* spotlight cone */}
      <motion.div
        className="absolute left-1/2 top-[-200px] h-[1400px] w-[900px] -translate-x-1/2"
        style={{ background: 'conic-gradient(from 180deg at 50% 0%, transparent 160deg, rgba(255,240,200,0.18) 175deg, rgba(255,240,200,0.28) 180deg, rgba(255,240,200,0.18) 185deg, transparent 200deg)' }}
        initial={{ opacity: 0, rotate: -12 }}
        animate={{ opacity: 1, rotate: [-12, 8, -4, 0] }}
        transition={{ duration: 2.4 }}
      />
      <div className="relative flex h-full flex-col items-center justify-center text-center">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4 font-display text-[28px] font-black tracking-[0.5em] text-amber-200">
          <Crown className="h-10 w-10" /> WALL OF FAME
        </motion.div>
        <motion.div initial={{ scale: 0.4, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.3, type: 'spring', stiffness: 90, damping: 12 }} className="mt-10 font-display text-[150px] font-black leading-none text-gradient-anim glow-text">
          {req.guestName}
        </motion.div>
        <motion.div initial={{ opacity: 0, letterSpacing: '0.8em' }} animate={{ opacity: 1, letterSpacing: '0.2em' }} transition={{ delay: 0.9, duration: 1 }} className="mt-8 font-display text-[54px] font-black">
          {line}
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 1.4 }} className="glass-strong mt-14 flex items-center gap-8 rounded-[36px] p-6 pr-12">
          <Artwork url={req.artworkUrl} seed={req.songTitle} label={req.songTitle} className="h-[150px] w-[150px]" rounded="rounded-[26px]" />
          <div className="text-left">
            <div className="text-[44px] font-black">{req.songTitle}</div>
            <div className="text-[30px] text-white/60">{req.artist}</div>
          </div>
        </motion.div>
      </div>
    </Backdrop>
  );
}

/* ============================================================ HYPE */
export function HypeMoment({ cmd }: { cmd: DisplayCommand }) {
  useEffect(() => sound.play('reveal'), [cmd.id]);
  const text: string = cmd.payload.message || "LET'S MAKE SOME NOISE!";
  const words = text.split(' ');
  return (
    <Backdrop tone="magenta">
      <Confetti burstKey={cmd.id} count={260} />
      {[0, 1, 2, 3].map((i) => (
        <motion.div
          key={i}
          className="absolute left-1/2 top-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-cyan/60"
          initial={{ scale: 0, opacity: 1 }}
          animate={{ scale: 6, opacity: 0 }}
          transition={{ duration: 2.2, delay: i * 0.45, repeat: Infinity, repeatDelay: 0.4 }}
        />
      ))}
      <div className="flex h-full flex-col items-center justify-center">
        <Zap className="mb-6 h-24 w-24 fill-amber-300 text-amber-300 drop-shadow-[0_0_40px_rgba(251,191,36,0.8)]" />
        <div className="flex max-w-[1700px] flex-wrap justify-center gap-x-10 text-center">
          {words.map((w, i) => (
            <motion.span
              key={i}
              initial={{ scale: 3, opacity: 0, rotate: i % 2 ? 8 : -8, filter: 'blur(20px)' }}
              animate={{ scale: [3, 0.9, 1.05, 1], opacity: 1, rotate: 0, filter: 'blur(0px)' }}
              transition={{ delay: 0.2 + i * 0.18, duration: 0.7 }}
              className={cn('font-display text-[170px] font-black leading-[1]', i === words.length - 1 ? 'text-gradient-anim glow-text' : 'text-white')}
            >
              {w}
            </motion.span>
          ))}
        </div>
        <motion.div className="mt-12 h-[140px] w-[1400px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }}>
          <Visualizer variant="mirror" bars={90} energy={1.6} />
        </motion.div>
      </div>
    </Backdrop>
  );
}

/* ============================================================ DEDICATION */
export function DedicationMoment({ cmd, req }: { cmd: DisplayCommand; req?: SongRequest }) {
  useEffect(() => sound.play('whoosh'), [cmd.id]);
  const p = cmd.payload;
  const title = p.songTitle || req?.songTitle;
  const artist = p.artist || req?.artist;
  const from = p.from || req?.guestName;
  const to = p.to || req?.dedicatedTo;
  const message = p.message || req?.message;
  return (
    <Backdrop tone="magenta">
      <div className="flex h-full flex-col items-center justify-center px-24 text-center">
        <motion.div animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 1.2, repeat: Infinity }}>
          <Heart className="h-28 w-28 fill-magenta text-magenta drop-shadow-[0_0_50px_rgb(var(--c-magenta))]" />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="mt-8 font-display text-[28px] font-black tracking-[0.5em] text-white/60">
          A DEDICATION
        </motion.div>
        {to && (
          <motion.div initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.6, duration: 0.8 }} className="mt-8 font-display text-[110px] font-black leading-none">
            For <span className="text-gradient-anim glow-text">{to}</span>
          </motion.div>
        )}
        {message && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4, duration: 1.2 }} className="mt-10 max-w-[1300px] text-[46px] italic leading-snug text-white/85">
            “{message}”
          </motion.div>
        )}
        {from && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2 }} className="mt-8 text-[34px] text-white/60">
            with love, <span className="font-bold text-white">{from}</span>
          </motion.div>
        )}
        {title && (
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 2.6 }} className="glass-strong mt-14 flex items-center gap-6 rounded-[30px] p-5 pr-10">
            <Artwork url={req?.artworkUrl} seed={title} label={title} className="h-24 w-24" rounded="rounded-[20px]" />
            <div className="text-left">
              <div className="text-[36px] font-black">{title}</div>
              <div className="text-[26px] text-white/60">{artist}</div>
            </div>
          </motion.div>
        )}
      </div>
    </Backdrop>
  );
}

/* ============================================================ BIRTHDAY */
export function BirthdayMoment({ cmd }: { cmd: DisplayCommand }) {
  useEffect(() => sound.play('winner'), [cmd.id]);
  const name: string = cmd.payload.name || 'YOU';
  return (
    <Backdrop tone="gold">
      <Confetti burstKey={cmd.id} count={320} />
      <Confetti burstKey={cmd.id + '-2'} count={200} />
      {Array.from({ length: 14 }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute bottom-[-160px] h-[130px] w-[100px] rounded-[50%]"
          style={{
            left: `${(i * 7.3) % 100}%`,
            background: ['rgb(var(--c-primary))', 'rgb(var(--c-magenta))', 'rgb(var(--c-cyan))', '#FBBF24'][i % 4],
            boxShadow: 'inset -14px -18px 30px rgba(0,0,0,0.25)',
          }}
          animate={{ y: -1500, x: [0, 30, -20, 10] }}
          transition={{ duration: 7 + (i % 5), delay: (i % 7) * 0.4, ease: 'easeOut' }}
        />
      ))}
      <div className="flex h-full flex-col items-center justify-center text-center">
        <motion.div initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 120 }}>
          <Cake className="h-32 w-32 text-amber-300 drop-shadow-[0_0_40px_rgba(251,191,36,0.7)]" />
        </motion.div>
        <motion.div initial={{ opacity: 0, letterSpacing: '1em' }} animate={{ opacity: 1, letterSpacing: '0.35em' }} transition={{ delay: 0.3, duration: 1 }} className="mt-8 font-display text-[64px] font-black">
          HAPPY BIRTHDAY
        </motion.div>
        <motion.div initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.8, type: 'spring', stiffness: 80, damping: 10 }} className="mt-4 font-display text-[200px] font-black leading-none text-gradient-anim glow-text">
          {name}
        </motion.div>
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.8 }} className="mt-10 max-w-[1300px] text-[42px] text-white/80">
          {cmd.payload.message || 'The whole room is celebrating you tonight!'}
        </motion.div>
      </div>
    </Backdrop>
  );
}

/* ============================================================ SURPRISE */
export function SurpriseMoment({ cmd }: { cmd: DisplayCommand }) {
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
  return (
    <Backdrop>
      {revealed && <Confetti burstKey={cmd.id} count={240} />}
      <div className="flex h-full flex-col items-center justify-center text-center">
        <AnimatePresence mode="wait">
          {!revealed ? (
            <motion.div key="box" exit={{ scale: 3, opacity: 0, filter: 'blur(30px)' }} transition={{ duration: 0.5 }} className="flex flex-col items-center">
              <motion.div animate={{ rotate: [0, -8, 8, -12, 12, -6, 6, 0], scale: [1, 1.05, 1, 1.1, 1, 1.15, 1.2] }} transition={{ duration: 3, ease: 'easeIn' }}>
                <Gift className="h-56 w-56 text-magenta drop-shadow-[0_0_60px_rgb(var(--c-magenta))]" />
              </motion.div>
              <div className="mt-10 font-display text-[44px] font-black tracking-[0.5em] text-white/70">SOMETHING'S COMING…</div>
            </motion.div>
          ) : (
            <motion.div key="msg" initial={{ scale: 0.2, opacity: 0, rotate: -10 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 100, damping: 11 }} className="px-24">
              <Sparkles className="mx-auto h-20 w-20 text-cyan" />
              <div className="mt-6 font-display text-[36px] font-black tracking-[0.45em] text-cyan">{cmd.payload.title || 'SURPRISE!'}</div>
              <div className="mt-8 max-w-[1600px] font-display text-[110px] font-black leading-[1.02] text-gradient-anim glow-text">
                {cmd.payload.message || 'THE NEXT ROUND IS ON THE DJ!'}
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
  useEffect(() => {
    if (ended) sound.play('winner');
    else if (left <= 5 && left > 0) sound.play('tick');
  }, [ended, left <= 5 ? left : 99]);

  return (
    <Backdrop>
      {ended && <Confetti burstKey={battle.id} count={240} />}
      <div className="flex h-full flex-col px-20 py-14">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-5 font-display text-[44px] font-black tracking-[0.25em]">
            <Swords className="h-12 w-12 text-cyan" /> CROWD VOTE
          </div>
          <AnimatePresence mode="wait">
            {ended ? (
              <motion.div key="end" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="font-display text-[40px] font-black tracking-[0.2em] text-amber-300">
                THE CROWD HAS SPOKEN
              </motion.div>
            ) : (
              <motion.div
                key="timer"
                className={cn('rounded-full border-2 px-10 py-3 font-display text-[64px] font-black tabular-nums', left <= 5 ? 'border-rose-400 text-rose-300' : 'border-white/20')}
                animate={left <= 5 ? { scale: [1, 1.1, 1] } : {}}
                transition={{ duration: 0.5, repeat: Infinity }}
              >
                {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        <div className="relative mt-10 grid flex-1 grid-cols-2 gap-24">
          <div className="absolute left-1/2 top-[38%] z-10 grid h-40 w-40 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-gradient-to-br from-primary to-magenta font-display text-[60px] font-black shadow-glow-lg">
            VS
          </div>
          {songs.map((s, i) => {
            if (!s) return <div key={i} />;
            const pct = Math.round((tallies[i] / total) * 100);
            const isWinner = ended && s.id === winnerId;
            const isLoser = ended && s.id !== winnerId;
            return (
              <motion.div
                key={s.id}
                animate={{ scale: isWinner ? 1.06 : isLoser ? 0.9 : 1, opacity: isLoser ? 0.35 : 1, filter: isLoser ? 'grayscale(0.8)' : 'grayscale(0)' }}
                transition={{ type: 'spring', stiffness: 80, damping: 14 }}
                className={cn('relative flex flex-col items-center rounded-[48px] p-10', isWinner ? 'neon-border bg-amber-300/[0.07]' : 'glass')}
              >
                {isWinner && (
                  <motion.div initial={{ y: -60, opacity: 0, rotate: -20 }} animate={{ y: 0, opacity: 1, rotate: 0 }} className="absolute -top-14">
                    <Crown className="h-24 w-24 fill-amber-300/30 text-amber-300 drop-shadow-[0_0_30px_rgba(251,191,36,0.8)]" />
                  </motion.div>
                )}
                <Artwork url={s.artworkUrl} seed={s.songTitle} label={s.songTitle} className="h-[340px] w-[340px]" rounded="rounded-[36px]" />
                <div className="mt-8 max-w-full truncate text-center font-display text-[46px] font-black">{s.songTitle}</div>
                <div className="text-[30px] text-white/60">{s.artist}</div>
                <div className="mt-auto w-full pt-8">
                  <div className="flex items-end justify-between">
                    <CountUp value={tallies[i]} className="font-display text-[72px] font-black leading-none tabular-nums" />
                    <div className="font-display text-[48px] font-black text-white/70 tabular-nums">{pct}%</div>
                  </div>
                  <div className="mt-4 h-6 overflow-hidden rounded-full bg-white/10">
                    <motion.div
                      className={cn('h-full rounded-full', i === 0 ? 'bg-gradient-to-r from-primary to-magenta' : 'bg-gradient-to-r from-secondary to-cyan')}
                      animate={{ width: `${pct}%` }}
                      transition={{ type: 'spring', stiffness: 60, damping: 15 }}
                    />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
        {!ended && <div className="mt-8 text-center font-display text-[30px] font-bold tracking-[0.3em] text-white/60">VOTE NOW ON YOUR PHONE — SCAN THE QR CODE</div>}
      </div>
    </Backdrop>
  );
}
