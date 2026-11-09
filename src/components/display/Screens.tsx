import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import { Crown, Heart, Mic2, Star, Trophy } from 'lucide-react';
import { useMemo } from 'react';
import { Visualizer } from '@/components/fx';
import { Artwork, CountUp, Equalizer } from '@/components/ui';
import { leaderboardOf, nowPlayingOf, playedOf, queueOf } from '@/lib/selectors';
import type { EventSnapshot, SongRequest } from '@/lib/types';
import { cn, hashString } from '@/lib/utils';
import { DisplayHeader, FooterTicker, QRBlock } from './shared';

/* ============================================================ NOW PLAYING */
export function NowPlayingScreen({ snap }: { snap: EventSnapshot }) {
  const req = nowPlayingOf(snap.requests);
  const next = queueOf(snap.requests)[0];
  return (
    <div className="relative flex h-full flex-col">
      <DisplayHeader snap={snap} compact />
      <AnimatePresence mode="wait">
        {req ? (
          <motion.div
            key={req.id}
            initial={{ opacity: 0, scale: 1.05, filter: 'blur(30px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, filter: 'blur(30px)' }}
            transition={{ duration: 1.1 }}
            className="relative grid flex-1 grid-cols-[760px_1fr] items-center gap-20 px-24"
          >
            <div className="absolute inset-0 -z-0 opacity-40">
              <Artwork url={req.artworkUrl} seed={req.songTitle} className="h-full w-full scale-150 blur-[120px]" rounded="" />
            </div>
            <div className="relative grid h-[760px] w-[760px] place-items-center">
              <div className="absolute inset-0">
                <Visualizer variant="ring" bars={120} energy={1.15} />
              </div>
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 40, repeat: Infinity, ease: 'linear' }} className="absolute h-[480px] w-[480px] rounded-full border border-dashed border-white/15" />
              <Artwork url={req.artworkUrl} seed={req.songTitle} label={req.songTitle} className="relative h-[420px] w-[420px] shadow-[0_40px_120px_-20px_rgba(0,0,0,0.9)]" rounded="rounded-[40px]" />
            </div>
            <div className="relative min-w-0">
              <div className="flex items-center gap-4">
                <Equalizer bars={6} className="h-10" barClass="w-2.5" />
                <span className="font-display text-[26px] font-black tracking-[0.4em] text-cyan">NOW PLAYING</span>
              </div>
              <div className="mt-8 line-clamp-3 font-display font-black leading-[0.98] tracking-tight glow-text" style={{ fontSize: req.songTitle.length > 24 ? 92 : 128 }}>
                {req.songTitle}
              </div>
              <div className="mt-6 text-[48px] font-semibold text-white/70">{req.artist}</div>
              {snap.settings.showRequesterNames && (
                <div className="mt-12 inline-flex items-center gap-4 rounded-full border border-white/15 bg-white/[0.06] px-8 py-4 text-[32px]">
                  <Heart className="h-8 w-8 fill-magenta text-magenta" />
                  <span className="text-white/60">This one is from</span>
                  <span className="font-bold text-gradient">{req.guestName}</span>
                </div>
              )}
              {req.dedicatedTo && (
                <div className="mt-6 text-[28px] text-white/60">
                  Dedicated to <span className="font-bold text-white">{req.dedicatedTo}</span>
                </div>
              )}
              {next && (
                <div className="mt-14 flex items-center gap-5 text-[24px] text-white/50">
                  <span className="font-bold uppercase tracking-[0.3em]">Up next</span>
                  <Artwork url={next.artworkUrl} seed={next.songTitle} className="h-14 w-14" rounded="rounded-xl" />
                  <span className="truncate font-semibold text-white/80">
                    {next.songTitle} — {next.artist}
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        ) : (
          <motion.div key="idle" className="grid flex-1 place-items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
            <div className="glass rounded-[48px] p-14">
              <QRBlock snap={snap} size={300} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <FooterTicker />
    </div>
  );
}

/* ============================================================ REQUEST WALL */
const COLS = 5;
const ROWS = 4;
const WALL_W = 1920 - 440; // right side reserved for the QR panel
const CELL_W = WALL_W / COLS;
const CELL_H = (1080 - 112 - 84) / ROWS;

export function RequestWallScreen({ snap }: { snap: EventSnapshot }) {
  const items = useMemo(
    () =>
      queueOf(snap.requests)
        .concat(snap.requests.filter((r) => r.status === 'playing'))
        .sort((a, b) => b.voteCount - a.voteCount || b.requestedAt.localeCompare(a.requestedAt))
        .slice(0, COLS * ROWS),
    [snap.requests],
  );
  // cells ordered from centre outwards → most popular songs take centre stage
  const cells = useMemo(() => {
    const all: Array<{ c: number; r: number; d: number }> = [];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        all.push({ c, r, d: Math.hypot(c - 2, (r - 1.5) * 1.4) });
      }
    return all.sort((a, b) => a.d - b.d);
  }, []);
  const max = Math.max(1, ...items.map((r) => r.voteCount));

  return (
    <div className="relative flex h-full flex-col">
      <DisplayHeader snap={snap} compact />
      <div className="relative flex-1">
        <LayoutGroup>
          <AnimatePresence>
            {items.map((r, i) => {
              const cell = cells[i];
              if (!cell) return null;
              const h = hashString(r.id);
              const jx = ((h % 30) - 15) * 0.8;
              const jy = (((h >> 4) % 30) - 15) * 1.0;
              const scale = 0.85 + 0.22 * (r.voteCount / max);
              return (
                <motion.div
                  key={r.id}
                  layout
                  initial={{ opacity: 0, scale: 0.2, x: 900 - cell.c * CELL_W, y: -400, rotate: -20 }}
                  animate={{ opacity: 1, scale, x: 0, y: 0, rotate: ((h >> 8) % 10) - 5 }}
                  exit={{ opacity: 0, scale: 0.3, filter: 'blur(12px)' }}
                  transition={{ type: 'spring', stiffness: 60, damping: 14 }}
                  className="absolute"
                  style={{
                    left: 20 + cell.c * CELL_W + CELL_W / 2 - 120 + jx,
                    top: cell.r * CELL_H + CELL_H / 2 - 60 + jy,
                    zIndex: Math.round(scale * 100),
                  }}
                >
                  <div className="animate-float" style={{ animationDelay: `${-(h % 6000) / 1000}s`, animationDuration: `${5 + (h % 4)}s` }}>
                    <WallCard r={r} hot={r.voteCount === max && max > 0} />
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </LayoutGroup>
        <div className="absolute right-12 top-1/2 z-[200] -translate-y-1/2">
          <div className="glass-strong rounded-[32px] p-6">
            <QRBlock snap={snap} size={150} vertical />
          </div>
        </div>
        {items.length === 0 && (
          <div className="absolute inset-0 grid place-items-center text-[36px] font-display font-black text-white/40">Requests will appear here live</div>
        )}
      </div>
      <FooterTicker />
    </div>
  );
}

function WallCard({ r, hot }: { r: SongRequest; hot: boolean }) {
  return (
    <div
      className={cn(
        'glass-strong flex w-[240px] items-center gap-3 rounded-[24px] p-3 shadow-2xl',
        hot && 'neon-border shadow-glow-lg',
        r.status === 'playing' && 'ring-2 ring-cyan/70',
      )}
    >
      <Artwork url={r.artworkUrl} seed={r.songTitle} label={r.songTitle} className="h-[76px] w-[76px]" rounded="rounded-[16px]" />
      <div className="min-w-0 flex-1">
        <div className="line-clamp-2 text-[18px] font-bold leading-tight">{r.songTitle}</div>
        <div className="truncate text-[15px] text-white/55">{r.artist}</div>
        <div className="mt-1.5 flex items-center justify-between text-[14px]">
          <span className="truncate text-white/45">{r.guestName}</span>
          <span className="flex items-center gap-1 font-bold">
            <Heart className="h-4 w-4 fill-magenta text-magenta" />
            <CountUp value={r.voteCount} />
          </span>
        </div>
      </div>
    </div>
  );
}

/* ============================================================ LEADERBOARD */
export function LeaderboardScreen({ snap }: { snap: EventSnapshot }) {
  const lb = leaderboardOf(snap.requests);
  const top = lb.topSongs.slice(0, 7);
  const maxV = Math.max(1, ...top.map((r) => r.voteCount));
  const fame = playedOf(snap.requests).slice(0, 6);
  return (
    <div className="relative flex h-full flex-col">
      <DisplayHeader snap={snap} compact />
      <div className="grid flex-1 grid-cols-[1000px_1fr] gap-12 px-16 pb-6 pt-2">
        <div className="glass flex flex-col rounded-[40px] p-10">
          <div className="flex items-center gap-4 font-display text-[28px] font-black tracking-[0.25em]">
            <Trophy className="h-8 w-8 text-amber-300" /> THE CROWD'S TOP SONGS
          </div>
          <LayoutGroup>
            <div className="mt-8 flex flex-1 flex-col gap-3.5">
              {top.map((r, i) => (
                <motion.div layout key={r.id} transition={{ type: 'spring', stiffness: 120, damping: 20 }} className="relative flex h-[76px] items-center gap-5 overflow-hidden rounded-[20px] bg-white/[0.04] px-4">
                  <motion.div
                    className={cn('absolute inset-y-0 left-0', i === 0 ? 'bg-gradient-to-r from-amber-300/35 to-magenta/20' : 'bg-gradient-to-r from-primary/30 to-magenta/10')}
                    animate={{ width: `${(r.voteCount / maxV) * 100}%` }}
                    transition={{ type: 'spring', stiffness: 60, damping: 16 }}
                  />
                  <div className={cn('relative w-10 text-center font-display text-[30px] font-black', i === 0 ? 'text-amber-300' : 'text-white/40')}>{i + 1}</div>
                  <Artwork url={r.artworkUrl} seed={r.songTitle} label={r.songTitle} className="relative h-[56px] w-[56px]" rounded="rounded-[14px]" />
                  <div className="relative min-w-0 flex-1">
                    <div className="truncate text-[24px] font-bold">{r.songTitle}</div>
                    <div className="truncate text-[17px] text-white/55">
                      {r.artist} · {r.guestName}
                    </div>
                  </div>
                  <CountUp value={r.voteCount} className="relative font-display text-[34px] font-black tabular-nums" />
                </motion.div>
              ))}
              {!top.length && <div className="grid flex-1 place-items-center text-[26px] text-white/40">Votes will rank the songs here</div>}
            </div>
          </LayoutGroup>
        </div>
        <div className="flex min-h-0 flex-col gap-6">
          <div className="grid grid-cols-2 gap-6">
            <Highlight icon={<Star className="h-7 w-7 text-amber-300" />} label="Most popular song" value={lb.mostPopular?.songTitle ?? '—'} sub={lb.mostPopular ? `${lb.mostPopular.voteCount} votes` : ''} />
            <Highlight icon={<Mic2 className="h-7 w-7 text-cyan" />} label="Most requested artist" value={lb.topArtist?.name ?? '—'} sub={lb.topArtist ? `${lb.topArtist.count} requests` : ''} />
          </div>
          <div className="grid flex-1 grid-cols-2 gap-6">
            <GuestList title="SOUNDTRACK HEROES" subtitle="songs played" list={lb.heroes} />
            <GuestList title="CROWD FAVOURITES" subtitle="votes received" list={lb.mostVoted} />
          </div>
          <div className="glass rounded-[32px] p-6">
            <div className="mb-4 flex items-center gap-3 font-display text-[18px] font-black tracking-[0.3em] text-white/60">
              <Crown className="h-5 w-5 text-amber-300" /> WALL OF FAME
            </div>
            <div className="flex gap-4">
              {fame.map((r) => (
                <div key={r.id} className="w-[110px] text-center">
                  <Artwork url={r.artworkUrl} seed={r.songTitle} label={r.songTitle} className="h-[110px] w-[110px]" rounded="rounded-[18px]" />
                  <div className="mt-2 truncate text-[15px] font-bold">{r.guestName}</div>
                </div>
              ))}
              {!fame.length && <div className="text-[20px] text-white/40">Played requests earn a spot here.</div>}
            </div>
          </div>
        </div>
      </div>
      <FooterTicker />
    </div>
  );
}

function Highlight({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="neon-border glass rounded-[32px] p-6">
      <div className="flex items-center gap-3 text-[15px] font-bold uppercase tracking-[0.3em] text-white/50">
        {icon} {label}
      </div>
      <AnimatePresence mode="wait">
        <motion.div key={value} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} className="mt-4 truncate font-display text-[36px] font-black">
          {value}
        </motion.div>
      </AnimatePresence>
      <div className="mt-1 text-[18px] text-white/50">{sub}</div>
    </div>
  );
}

function GuestList({ title, subtitle, list }: { title: string; subtitle: string; list: Array<{ key: string; name: string; count: number }> }) {
  return (
    <div className="glass flex min-h-0 flex-col rounded-[32px] p-6">
      <div className="font-display text-[18px] font-black tracking-[0.3em] text-white/70">{title}</div>
      <LayoutGroup>
        <div className="mt-4 space-y-2.5">
          {list.slice(0, 5).map((g, i) => (
            <motion.div layout key={g.key} className="flex items-center gap-4 rounded-[16px] bg-white/[0.04] px-4 py-2.5">
              <span className={cn('w-6 font-display text-[22px] font-black', i === 0 ? 'text-amber-300' : 'text-white/35')}>{i + 1}</span>
              <span className="flex-1 truncate text-[22px] font-semibold">{g.name}</span>
              <span className="font-display text-[24px] font-black tabular-nums">{g.count}</span>
            </motion.div>
          ))}
          {!list.length && <div className="text-[18px] text-white/40">No data yet</div>}
        </div>
      </LayoutGroup>
      <div className="mt-auto pt-3 text-right text-[13px] uppercase tracking-[0.3em] text-white/35">{subtitle}</div>
    </div>
  );
}
