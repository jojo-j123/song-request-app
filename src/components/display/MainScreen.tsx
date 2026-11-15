import { AnimatePresence, motion } from 'framer-motion';
import { Crown, Flame, Heart, Radio } from 'lucide-react';
import { Visualizer } from '@/components/fx';
import { Artwork, CountUp, Equalizer } from '@/components/ui';
import type { Palette } from '@/lib/palette';
import { leaderOf, nowPlayingOf, queueOf, trendingOf } from '@/lib/selectors';
import type { EventSnapshot, SongRequest } from '@/lib/types';
import { cn, rem } from '@/lib/utils';
import { BeatPulse, Bump, DisplayHeader, FooterMarquee, QRCard, useChanged, useStage, Vinyl, VotePops } from './shared';

/** Shrinks long titles so they stay on two lines. Sizes are design px. */
export const fitTitle = (t: string, base: number) =>
  t.length > 34 ? base * 0.6 : t.length > 22 ? base * 0.74 : t.length > 14 ? base * 0.88 : base;

/** Card colour wash in the song's colours. */
export const wash = (p: Palette | null | undefined) => {
  const a = p ? p[0] : 'var(--c-primary)';
  const b = p ? p[1] : 'var(--c-magenta)';
  return `radial-gradient(70% 110% at 6% 35%, rgb(${a} / 0.5), transparent 70%), radial-gradient(55% 95% at 100% 0%, rgb(${b} / 0.32), transparent 70%)`;
};

export function MainScreen({ snap, palette }: { snap: EventSnapshot; palette: Palette | null }) {
  const { portrait, H } = useStage();
  const playing = nowPlayingOf(snap.requests);
  const leader = leaderOf(snap.requests);
  const queue = queueOf(snap.requests);
  const runnerUp = leader ? trendingOf(snap.requests).find((r) => r.id !== leader.id) ?? null : null;
  const showNames = snap.settings.showRequesterNames;
  const maxVotes = Math.max(1, ...queue.map((r) => r.voteCount));

  if (portrait) {
    // everything above/below the queue has a fixed height → the queue takes whatever is left
    const rows = Math.max(2, Math.min(9, Math.floor((H - 1420) / 97.6)));
    return (
      <div className="relative flex h-full flex-col">
        <DisplayHeader snap={snap} />
        <div className="flex min-h-0 flex-1 flex-col gap-6 px-10 py-6">
          <NowPlayingCard req={playing} showNames={showNames} palette={palette} />
          <LeaderCard req={leader} runnerUp={runnerUp} votingEnabled={snap.settings.votingEnabled} round={snap.settings.votingRound} className="h-[13rem] shrink-0" />
          <UpNext list={queue.slice(0, rows)} total={queue.length} leaderId={leader?.id} showNames={showNames} maxVotes={maxVotes} className="min-h-0 flex-1" />
          <QRCard snap={snap} steps className="shrink-0" />
        </div>
        <FooterMarquee />
      </div>
    );
  }

  return (
    <div className="relative flex h-full flex-col">
      <DisplayHeader snap={snap} />
      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_40.5rem] gap-10 px-16 pb-7 pt-3">
        <div className="flex min-h-0 flex-col gap-7">
          <NowPlayingCard req={playing} showNames={showNames} palette={palette} />
          <LeaderCard req={leader} runnerUp={runnerUp} votingEnabled={snap.settings.votingEnabled} round={snap.settings.votingRound} className="min-h-0 flex-1" />
        </div>
        <div className="flex min-h-0 flex-col gap-7">
          {/* taller-than-16:9 screens (e.g. 16:10 laptops) fit an extra row */}
          <UpNext list={queue.slice(0, 5 + Math.floor((H - 1080) / 97.6))} total={queue.length} leaderId={leader?.id} showNames={showNames} maxVotes={maxVotes} />
          <QRCard snap={snap} className="mt-auto" />
        </div>
      </div>
      <FooterMarquee />
    </div>
  );
}

/* ------------------------------------------------------------ now playing */
/** Cover art with a record sliding out from behind it; the cover kicks with the beat. */
export function DiscArt({ req, palette, size }: { req: SongRequest; palette: Palette | null; size: number }) {
  const glow = `radial-gradient(closest-side, rgb(${palette ? palette[0] : 'var(--c-primary)'} / 0.6), transparent)`;
  return (
    <div className="relative shrink-0" style={{ width: rem(size * 1.4), height: rem(size) }}>
      <motion.div
        className="absolute right-0 top-0 aspect-square h-full p-[2.5%]"
        initial={{ x: '-40%', rotate: -140, opacity: 0 }}
        animate={{ x: '0%', rotate: 0, opacity: 1 }}
        transition={{ duration: 1.2, delay: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
      >
        <Vinyl palette={palette} />
      </motion.div>
      <BeatPulse className="absolute left-0 top-0 aspect-square h-full" amount={0.028}>
        <div className="absolute -inset-[14%] rounded-full" style={{ background: glow }} />
        <Artwork url={req.artworkUrl} seed={req.songTitle} label={req.songTitle} className="relative h-full w-full shadow-2xl" rounded="rounded-[1.75rem]" />
      </BeatPulse>
    </div>
  );
}

function NowPlayingCard({ req, showNames, palette }: { req: SongRequest | null; showNames: boolean; palette: Palette | null }) {
  const { portrait } = useStage();
  return (
    <div className={cn('card-frame relative shrink-0 overflow-hidden rounded-[2.5rem]', portrait ? 'h-[29.5rem]' : 'h-[30rem]')}>
      <AnimatePresence initial={false}>
        {req ? (
          <motion.div
            key={req.id}
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 1.04 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <div className="absolute inset-0" style={{ background: wash(palette) }} />
            <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/25 to-transparent" />
            <div className={cn('relative flex h-full items-start', portrait ? 'gap-8 p-8' : 'gap-10 p-10')}>
              <DiscArt req={req} palette={palette} size={portrait ? 300 : 304} />
              <div className="min-w-0 flex-1 pt-1">
                <div className="flex items-center gap-4">
                  <Equalizer bars={5} className="h-8" barClass="w-2" />
                  <span className="font-display text-[1.25rem] font-black tracking-[0.35em] text-cyan">NOW PLAYING</span>
                </div>
                <div
                  className="glow-title mt-4 line-clamp-2 font-display font-black leading-[1.05] tracking-tight"
                  style={{ fontSize: rem(fitTitle(req.songTitle, portrait ? 58 : 72)) }}
                  dir="auto"
                >
                  {req.songTitle}
                </div>
                <div className="mt-2 truncate text-[2.125rem] font-semibold text-white/70" dir="auto">
                  {req.artist}
                </div>
                {showNames && (
                  <div className="mt-5 inline-flex max-w-full items-center gap-3 rounded-full border border-white/15 bg-white/[0.08] px-5 py-2.5 text-[1.375rem]">
                    <Heart className="h-6 w-6 shrink-0 fill-magenta text-magenta" />
                    <span className="shrink-0 text-white/60">Requested by</span>
                    <span className="truncate font-bold" dir="auto">
                      {req.guestName}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <div className={cn('absolute bottom-6 h-[5.5rem]', portrait ? 'inset-x-8' : 'inset-x-10')}>
              <Visualizer bars={portrait ? 54 : 88} symmetric palette={palette} />
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="idle"
            className={cn('absolute inset-0 flex items-center', portrait ? 'flex-col justify-center gap-4 p-8 text-center' : 'justify-between gap-8 p-12')}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="absolute inset-0" style={{ background: wash(null) }} />
            <div className="relative min-w-0">
              <div className="font-display text-[1.25rem] font-black tracking-[0.35em] text-cyan">THE STAGE IS SET</div>
              <div className={cn('mt-4 font-display font-black leading-[1] tracking-tight', portrait ? 'text-[4rem]' : 'whitespace-nowrap text-[4.75rem]')}>
                THE NEXT HIT
                <br />
                <span className="text-gradient-anim glow-text">IS YOURS.</span>
              </div>
              <div className="mt-5 text-[1.625rem] text-white/60">Scan the code. Request your song. Watch it happen.</div>
            </div>
            <div className={cn('relative shrink-0', portrait ? 'h-[15rem] w-[15rem]' : 'h-[24rem] w-[24rem]')}>
              <Visualizer variant="ring" bars={96} inner={0.5} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ----------------------------------------------------------------- leader */
function LeaderCard({
  req,
  runnerUp,
  votingEnabled,
  round,
  className,
}: {
  req: SongRequest | null;
  runnerUp: SongRequest | null;
  votingEnabled: boolean;
  round: number;
  className?: string;
}) {
  const { u, portrait } = useStage();
  const changed = useChanged(req?.id ?? null, 3400);
  const lead = req && runnerUp ? req.voteCount - runnerUp.voteCount : 0;
  const share = req && runnerUp ? req.voteCount / Math.max(1, req.voteCount + runnerUp.voteCount) : 1;
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-[2.5rem] border transition-[box-shadow,border-color] duration-700',
        changed ? 'border-amber-300/80 shadow-[0_0_7rem_-1rem_rgba(251,191,36,0.8)]' : 'border-amber-300/25',
        className,
      )}
      style={{ background: 'linear-gradient(115deg, rgba(251,191,36,0.2), rgb(var(--c-magenta) / 0.16) 48%, transparent 85%), rgba(15,15,30,0.8)' }}
    >
      <AnimatePresence>
        {changed && (
          <motion.div
            key="sweep"
            initial={{ x: '-120%' }}
            animate={{ x: '320%' }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.3, ease: 'easeInOut' }}
            className="absolute inset-y-0 z-10 w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/30 to-transparent"
          />
        )}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {req ? (
          <motion.div
            key={req.id}
            className={cn('absolute inset-0 flex items-center', portrait ? 'gap-6 px-7' : 'gap-8 px-9')}
            initial={{ opacity: 0, y: 44 * u, scale: 0.94 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -44 * u, scale: 0.94 }}
            transition={{ type: 'spring', stiffness: 140, damping: 18 }}
          >
            <div className="relative shrink-0">
              <Artwork
                url={req.artworkUrl}
                seed={req.songTitle}
                label={req.songTitle}
                className={portrait ? 'h-[9.5rem] w-[9.5rem]' : 'h-[11.5rem] w-[11.5rem]'}
                rounded="rounded-[1.6rem]"
              />
              <div className="absolute -left-4 -top-5 grid h-14 w-14 -rotate-12 place-items-center rounded-2xl bg-gradient-to-br from-amber-200 to-amber-500 text-ink shadow-[0_0.5rem_1.5rem_rgba(251,191,36,0.5)]">
                <Crown className="h-8 w-8" strokeWidth={2.5} />
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <div className="inline-flex items-center gap-2.5 rounded-full bg-amber-300/15 px-4 py-1.5 font-display text-[1rem] font-black tracking-[0.3em] text-amber-200">
                <Flame className="h-5 w-5 fill-amber-300/40" /> LIVE LEADER
              </div>
              <div className="mt-2.5 truncate font-display font-black leading-tight" style={{ fontSize: rem(fitTitle(req.songTitle, portrait ? 40 : 48)) }} dir="auto">
                {req.songTitle}
              </div>
              <div className="truncate text-[1.625rem] text-white/65" dir="auto">
                {req.artist} <span className="text-white/30">·</span> <span className="text-white/50">{req.guestName}</span>
              </div>
              {runnerUp && (
                <div className="mt-3 flex items-center gap-4">
                  <div className="h-2 min-w-[4rem] flex-1 overflow-hidden rounded-full bg-white/10">
                    <motion.div
                      className="h-full rounded-full bg-gradient-to-r from-amber-300 to-magenta"
                      animate={{ width: `${share * 100}%` }}
                      transition={{ type: 'spring', stiffness: 60, damping: 16 }}
                    />
                  </div>
                  <div className="max-w-[60%] truncate text-[1.125rem] text-white/55">
                    {lead > 0 ? (
                      <>
                        <b className="text-amber-200">+{lead}</b> ahead of
                      </>
                    ) : (
                      'neck and neck with'
                    )}{' '}
                    <span className="font-semibold text-white/85" dir="auto">
                      {runnerUp.songTitle}
                    </span>
                  </div>
                </div>
              )}
            </div>
            <div className="relative shrink-0 text-center">
              <VotePops value={req.voteCount} className="left-1/2 top-3" />
              <Bump value={req.voteCount}>
                <CountUp
                  value={req.voteCount}
                  className={cn('block font-display font-black leading-none text-gradient-gold tabular-nums', portrait ? 'text-[5rem]' : 'text-[6.5rem]')}
                />
              </Bump>
              <div className="mt-1 text-[1rem] font-bold uppercase tracking-[0.35em] text-white/50">votes</div>
            </div>
          </motion.div>
        ) : (
          <motion.div key="none" className="absolute inset-0 flex items-center gap-8 px-9" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="grid h-[8.5rem] w-[8.5rem] shrink-0 place-items-center rounded-[1.75rem] border border-white/10 bg-white/[0.05]">
              <Flame className="h-16 w-16 fill-magenta/30 text-magenta" />
            </div>
            <div className="min-w-0">
              <div className={cn('font-display font-black leading-tight', portrait ? 'text-[2.25rem]' : 'text-[2.75rem]')}>THE CROWD CHOOSES</div>
              <div className="mt-2 text-[1.5rem] text-white/55">
                {votingEnabled ? `Round ${round} is open — vote for your favourite on your phone.` : 'Voting opens soon.'}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {changed && req && (
          <motion.div
            key="stamp"
            initial={{ scale: 2.4, opacity: 0, rotate: -18 }}
            animate={{ scale: 1, opacity: 1, rotate: -8 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: 'spring', stiffness: 260, damping: 16 }}
            className="absolute right-[12rem] top-4 z-20 rounded-xl border-[0.2rem] border-amber-300 bg-ink/80 px-4 py-1.5 font-display text-[1.25rem] font-black tracking-[0.2em] text-amber-300"
          >
            NEW LEADER!
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ---------------------------------------------------------------- up next */
function UpNext({
  list,
  total,
  leaderId,
  showNames,
  maxVotes,
  className,
}: {
  list: SongRequest[];
  total: number;
  leaderId?: string;
  showNames: boolean;
  maxVotes: number;
  className?: string;
}) {
  const { u } = useStage();
  return (
    <div className={className}>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3 font-display text-[1.5rem] font-black tracking-[0.3em]">
          <Radio className="h-7 w-7 text-cyan" /> UP NEXT
        </div>
        {total > 0 && (
          <div className="rounded-full border border-white/10 bg-white/[0.06] px-4 py-1 text-[1rem] font-semibold text-white/55">
            <b className="text-white/85">{total}</b> in the queue
          </div>
        )}
      </div>
      <div className="flex flex-col gap-[0.7rem]">
        <AnimatePresence initial={false}>
          {list.map((r, i) => {
            const top = r.id === leaderId;
            return (
              <motion.div
                layout
                key={r.id}
                initial={{ opacity: 0, x: 90 * u, scale: 0.92 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: -70 * u, scale: 0.92 }}
                transition={{ type: 'spring', stiffness: 170, damping: 22 }}
                className={cn(
                  'relative flex h-[5.4rem] shrink-0 items-center gap-5 overflow-hidden rounded-[1.5rem] border px-4',
                  top ? 'border-amber-300/55 bg-amber-300/[0.09]' : 'border-white/[0.09] bg-white/[0.045]',
                )}
              >
                {/* heat bar: how this song is doing against the front-runner */}
                <motion.div
                  className={cn('absolute bottom-0 left-0 h-[0.22rem] rounded-full', top ? 'bg-gradient-to-r from-amber-300 to-magenta' : 'bg-gradient-to-r from-primary via-magenta to-cyan')}
                  animate={{ width: `${Math.max(r.voteCount > 0 ? 4 : 0, (r.voteCount / maxVotes) * 100)}%` }}
                  transition={{ type: 'spring', stiffness: 70, damping: 18 }}
                />
                <div className={cn('w-8 shrink-0 text-center font-display text-[1.625rem] font-black', top ? 'text-amber-300' : 'text-white/30')}>{i + 1}</div>
                <Artwork url={r.artworkUrl} seed={r.songTitle} label={r.songTitle} className="h-[3.9rem] w-[3.9rem]" rounded="rounded-[1rem]" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[1.5rem] font-bold leading-tight" dir="auto">
                    {r.songTitle}
                  </div>
                  <div className="truncate text-[1.125rem] text-white/50" dir="auto">
                    {r.artist}
                    {showNames && <span className="text-white/35"> · {r.guestName}</span>}
                  </div>
                </div>
                <div className="relative flex min-w-[5.25rem] shrink-0 items-center justify-end gap-2 pr-1">
                  <VotePops value={r.voteCount} className="right-7 top-1" />
                  {top ? <Crown className="h-6 w-6 text-amber-300" /> : <Heart className="h-5 w-5 fill-magenta/80 text-magenta" />}
                  <Bump value={r.voteCount}>
                    <CountUp value={r.voteCount} className="font-display text-[1.875rem] font-black tabular-nums" />
                  </Bump>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {list.length === 0 && (
          <div className="grid h-[12rem] place-items-center rounded-[1.75rem] border border-dashed border-white/15 text-[1.375rem] text-white/45">
            The queue is waiting for your requests
          </div>
        )}
      </div>
    </div>
  );
}
