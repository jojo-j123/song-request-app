import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { Crown, Flame, Heart, Radio } from 'lucide-react';
import { Visualizer } from '@/components/fx';
import { Artwork, CountUp, Equalizer } from '@/components/ui';
import { leaderOf, nowPlayingOf, queueOf } from '@/lib/selectors';
import type { EventSnapshot, SongRequest } from '@/lib/types';
import { cn } from '@/lib/utils';
import { DisplayHeader, FooterTicker, QRBlock, useChanged } from './shared';

const titleSize = (t: string, base: number) => (t.length > 34 ? base * 0.62 : t.length > 22 ? base * 0.78 : base);

export function MainScreen({ snap }: { snap: EventSnapshot }) {
  const playing = nowPlayingOf(snap.requests);
  const leader = leaderOf(snap.requests);
  const upNext = queueOf(snap.requests).slice(0, 5);
  const showNames = snap.settings.showRequesterNames;

  return (
    <div className="relative flex h-full flex-col">
      <DisplayHeader snap={snap} />
      <div className="grid min-h-0 flex-1 grid-cols-[1120px_1fr] gap-12 px-16 pb-8 pt-4">
        <div className="flex min-h-0 flex-col gap-8">
          <NowPlayingCard req={playing} showNames={showNames} />
          <LeaderCard req={leader} votingEnabled={snap.settings.votingEnabled} round={snap.settings.votingRound} />
        </div>
        <div className="flex min-h-0 flex-col gap-8">
          <UpNext list={upNext} leaderId={leader?.id} showNames={showNames} />
          <div className="glass relative mt-auto overflow-hidden rounded-[36px] p-8">
            <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-magenta/25 blur-3xl" />
            <QRBlock snap={snap} size={200} />
          </div>
        </div>
      </div>
      <FooterTicker />
    </div>
  );
}

function NowPlayingCard({ req, showNames }: { req: SongRequest | null; showNames: boolean }) {
  return (
    <div className="glass neon-border relative h-[480px] overflow-hidden rounded-[40px]">
      <AnimatePresence mode="wait">
        {req ? (
          <motion.div
            key={req.id}
            initial={{ opacity: 0, scale: 1.04, filter: 'blur(20px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.97, filter: 'blur(20px)' }}
            transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
            className="absolute inset-0"
          >
            {/* blurred artwork wash */}
            <div className="absolute inset-0 opacity-50">
              <Artwork url={req.artworkUrl} seed={req.songTitle} className="h-full w-full scale-125 blur-[80px]" rounded="" />
            </div>
            <div className="absolute inset-0 bg-gradient-to-r from-ink/90 via-ink/60 to-ink/30" />
            <div className="relative flex h-full items-center gap-12 p-10 pb-[120px]">
              <motion.div
                initial={{ rotateY: -25, x: -30 }}
                animate={{ rotateY: 0, x: 0 }}
                transition={{ duration: 1.1, ease: [0.2, 0.8, 0.2, 1] }}
                className="relative"
                style={{ perspective: 1000 }}
              >
                <div className="absolute -inset-6 rounded-[40px] bg-gradient-to-br from-primary/60 to-magenta/60 opacity-60 blur-2xl" />
                <Artwork url={req.artworkUrl} seed={req.songTitle} label={req.songTitle} className="relative h-[300px] w-[300px] shadow-2xl" rounded="rounded-[28px]" />
              </motion.div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-4">
                  <Equalizer bars={5} className="h-8" barClass="w-2" />
                  <span className="font-display text-[20px] font-black tracking-[0.35em] text-cyan">NOW PLAYING</span>
                </div>
                <div
                  className="mt-5 line-clamp-2 font-display font-black leading-[1.02] tracking-tight glow-text"
                  style={{ fontSize: titleSize(req.songTitle, 76) }}
                >
                  {req.songTitle}
                </div>
                <div className="mt-3 truncate text-[36px] font-semibold text-white/70">{req.artist}</div>
                {showNames && (
                  <div className="mt-6 inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/[0.06] px-5 py-2.5 text-[22px]">
                    <Heart className="h-6 w-6 fill-magenta text-magenta" />
                    <span className="text-white/60">Requested by</span>
                    <span className="font-bold">{req.guestName}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="absolute inset-x-10 bottom-6 h-[90px] opacity-90">
              <Visualizer bars={72} />
            </div>
          </motion.div>
        ) : (
          <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 grid grid-cols-[1fr_420px] items-center p-12">
            <div>
              <div className="font-display text-[20px] font-black tracking-[0.35em] text-cyan">THE STAGE IS SET</div>
              <div className="mt-5 whitespace-nowrap font-display text-[76px] font-black leading-[0.98] tracking-tight">
                THE NEXT HIT
                <br />
                <span className="text-gradient-anim glow-text">IS YOURS.</span>
              </div>
              <div className="mt-6 text-[26px] text-white/60">Scan the code. Request your song. Watch it happen.</div>
            </div>
            <div className="h-[420px] w-[420px]">
              <Visualizer variant="ring" bars={96} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function LeaderCard({ req, votingEnabled, round }: { req: SongRequest | null; votingEnabled: boolean; round: number }) {
  const changed = useChanged(req?.id ?? null, 3000);
  return (
    <div
      className={cn(
        'relative flex-1 overflow-hidden rounded-[40px] border transition-[box-shadow,border-color] duration-700',
        changed ? 'border-amber-300/70 shadow-[0_0_120px_-20px_rgba(251,191,36,0.8)]' : 'border-white/10',
      )}
      style={{ background: 'linear-gradient(120deg, rgb(var(--c-primary)/0.22), rgb(var(--c-magenta)/0.14) 50%, rgba(255,255,255,0.03))' }}
    >
      <AnimatePresence>
        {changed && (
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: '120%' }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.2, ease: 'easeInOut' }}
            className="absolute inset-y-0 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent"
          />
        )}
      </AnimatePresence>
      <div className="relative flex h-full items-center gap-10 px-10">
        <AnimatePresence mode="popLayout">
          {req ? (
            <motion.div
              key={req.id}
              initial={{ opacity: 0, y: 40, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -40, scale: 0.9 }}
              transition={{ type: 'spring', stiffness: 140, damping: 18 }}
              className="flex min-w-0 flex-1 items-center gap-9"
            >
              <Artwork url={req.artworkUrl} seed={req.songTitle} label={req.songTitle} className="h-[190px] w-[190px] shadow-2xl" rounded="rounded-[26px]" />
              <div className="min-w-0 flex-1">
                <div className="inline-flex items-center gap-3 rounded-full bg-amber-300/15 px-4 py-1.5 font-display text-[17px] font-black tracking-[0.3em] text-amber-200">
                  <Crown className="h-5 w-5" /> LIVE LEADER
                </div>
                <div className="mt-4 truncate font-display font-black leading-tight" style={{ fontSize: titleSize(req.songTitle, 50) }}>
                  {req.songTitle}
                </div>
                <div className="mt-1 truncate text-[28px] text-white/65">
                  {req.artist} <span className="text-white/35">·</span> <span className="text-white/50">{req.guestName}</span>
                </div>
              </div>
              <div className="text-center">
                <CountUp value={req.voteCount} className="block font-display text-[110px] font-black leading-none text-gradient glow-text tabular-nums" />
                <div className="mt-1 text-[16px] font-bold uppercase tracking-[0.35em] text-white/50">votes</div>
              </div>
            </motion.div>
          ) : (
            <motion.div key="none" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-8">
              <div className="grid h-[150px] w-[150px] place-items-center rounded-[28px] border border-white/10 bg-white/[0.04]">
                <Flame className="h-16 w-16 text-magenta" />
              </div>
              <div>
                <div className="font-display text-[44px] font-black">THE CROWD CHOOSES</div>
                <div className="mt-2 text-[24px] text-white/55">
                  {votingEnabled ? `Round ${round} is open — vote for your favourite on your phone.` : 'Voting opens soon.'}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function UpNext({ list, leaderId, showNames }: { list: SongRequest[]; leaderId?: string; showNames: boolean }) {
  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-3 font-display text-[24px] font-black tracking-[0.3em]">
          <Radio className="h-6 w-6 text-cyan" /> UP NEXT
        </div>
        <div className="text-[15px] font-bold uppercase tracking-[0.3em] text-white/40">votes</div>
      </div>
      <LayoutGroup>
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {list.map((r, i) => (
              <motion.div
                layout
                key={r.id}
                initial={{ opacity: 0, x: 80, scale: 0.9, filter: 'blur(8px)' }}
                animate={{ opacity: 1, x: 0, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, x: -60, scale: 0.9 }}
                transition={{ type: 'spring', stiffness: 160, damping: 22 }}
                className={cn(
                  'flex h-[86px] items-center gap-5 rounded-[24px] border px-4',
                  r.id === leaderId ? 'border-amber-300/50 bg-amber-300/[0.08]' : 'border-white/[0.07] bg-white/[0.035]',
                )}
              >
                <div className="w-8 text-center font-display text-[26px] font-black text-white/30">{i + 1}</div>
                <Artwork url={r.artworkUrl} seed={r.songTitle} label={r.songTitle} className="h-[62px] w-[62px]" rounded="rounded-[16px]" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[24px] font-bold leading-tight">{r.songTitle}</div>
                  <div className="truncate text-[18px] text-white/50">
                    {r.artist}
                    {showNames && <span className="text-white/35"> · {r.guestName}</span>}
                  </div>
                </div>
                <div className="flex min-w-[64px] items-center justify-end gap-2 pr-2">
                  {r.id === leaderId && <Crown className="h-5 w-5 text-amber-300" />}
                  <CountUp value={r.voteCount} className="font-display text-[30px] font-black tabular-nums" />
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {list.length === 0 && (
            <div className="grid h-[200px] place-items-center rounded-[28px] border border-dashed border-white/10 text-[22px] text-white/40">
              The queue is waiting for your requests
            </div>
          )}
        </div>
      </LayoutGroup>
    </div>
  );
}
