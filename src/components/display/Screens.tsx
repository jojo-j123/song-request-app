import { AnimatePresence, motion } from 'framer-motion';
import { Crown, Heart, Mic2, Star, Trophy } from 'lucide-react';
import { useMemo, useRef } from 'react';
import { Visualizer } from '@/components/fx';
import { Artwork, CountUp, Equalizer } from '@/components/ui';
import type { Palette } from '@/lib/palette';
import { leaderboardOf, nowPlayingOf, playedOf, queueOf } from '@/lib/selectors';
import type { EventSnapshot, SongRequest } from '@/lib/types';
import { cn, hashString, rem } from '@/lib/utils';
import { fitTitle } from './MainScreen';
import { BeatPulse, Bump, DisplayHeader, FOOTER_H, FooterMarquee, HEADER_L, HEADER_P, QRCard, useStage, VotePops } from './shared';

/* ============================================================ NOW PLAYING */
/** Giant outlined song title drifting behind everything — festival-poster energy. */
function KineticTitle({ text }: { text: string }) {
  const { W } = useStage();
  const t = text.toUpperCase();
  const fontPx = 190;
  const unitW = t.length * fontPx * 0.8 + fontPx * 0.9; // rough width of one copy + gap (design px)
  const copies = Math.max(1, Math.ceil((W + 200) / unitW));
  const row = (reverse: boolean, pos: string) => (
    <div className={cn('absolute inset-x-0 overflow-hidden', pos)}>
      <div
        className={cn('marquee-track text-stroke-soft font-display font-black leading-none', reverse && 'reverse')}
        style={{ fontSize: rem(fontPx), ['--marquee-s' as string]: `${Math.round((copies * unitW) / 55)}s` }}
      >
        {[0, 1].map((half) => (
          <div key={half} className="flex shrink-0">
            {Array.from({ length: copies }).map((_, i) => (
              <span key={i} className="whitespace-nowrap pr-[0.9em]">
                {t}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
  return (
    <div className="pointer-events-none absolute inset-0 opacity-[0.14]" aria-hidden>
      {row(false, 'top-[3%]')}
      {row(true, 'bottom-[3%]')}
    </div>
  );
}

/** The cover as a slowly spinning record, wrapped in a live spectrum ring. */
export function SpinningDisc({ req, palette, size, energy = 1.1 }: { req: SongRequest; palette: Palette | null; size: number; energy?: number }) {
  const glow = `radial-gradient(closest-side, rgb(${palette ? palette[0] : 'var(--c-primary)'} / 0.55), transparent)`;
  return (
    <div className="relative shrink-0" style={{ width: rem(size), height: rem(size) }}>
      <div className="absolute inset-[8%] rounded-full" style={{ background: glow }} />
      <div className="absolute inset-0">
        <Visualizer variant="ring" bars={120} inner={0.6} palette={palette} energy={energy} />
      </div>
      <BeatPulse className="absolute inset-[21.5%]" amount={0.03}>
        <div className="animate-spin-slower relative h-full w-full overflow-hidden rounded-full shadow-[0_2.5rem_6rem_-1rem_rgba(0,0,0,0.9)] ring-[0.4rem] ring-white/10">
          <Artwork url={req.artworkUrl} seed={req.songTitle} label={req.songTitle} className="h-full w-full" rounded="rounded-full" />
        </div>
        <div className="absolute inset-[45%] rounded-full bg-ink ring-[0.3rem] ring-white/15" />
      </BeatPulse>
    </div>
  );
}

export function NowPlayingScreen({ snap, palette }: { snap: EventSnapshot; palette: Palette | null }) {
  const { portrait } = useStage();
  const req = nowPlayingOf(snap.requests);
  const next = queueOf(snap.requests)[0];
  return (
    <div className="relative flex h-full flex-col">
      <DisplayHeader snap={snap} />
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <AnimatePresence initial={false}>
          {req ? (
            <motion.div
              key={req.id}
              className="absolute inset-0"
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.1 }}
            >
              <KineticTitle text={req.songTitle} />
              <div className={cn('relative flex h-full items-center', portrait ? 'flex-col justify-center gap-6 px-10 pb-4 text-center' : 'gap-12 px-16')}>
                <SpinningDisc req={req} palette={palette} size={portrait ? 800 : 740} />
                <div className={cn('flex min-w-0 flex-col', portrait ? 'w-full items-center' : 'h-full flex-1 py-7')}>
                  <div className={cn('flex min-w-0 flex-col', portrait ? 'w-full items-center' : 'flex-1 justify-center')}>
                  <div className="flex items-center gap-4">
                    <Equalizer bars={6} className="h-10" barClass="w-2.5" />
                    <span className="font-display text-[1.625rem] font-black tracking-[0.4em] text-cyan">NOW PLAYING</span>
                  </div>
                  <div
                    className="glow-title mt-6 line-clamp-3 font-display font-black leading-[1.02] tracking-tight"
                    style={{ fontSize: rem(fitTitle(req.songTitle, portrait ? 96 : 124)) }}
                    dir="auto"
                  >
                    {req.songTitle}
                  </div>
                  <div className="mt-4 max-w-full truncate text-[3rem] font-semibold text-white/70" dir="auto">
                    {req.artist}
                  </div>
                  {snap.settings.showRequesterNames && (
                    <div
                      className={cn(
                        'mt-8 inline-flex max-w-full items-center gap-4 rounded-full border border-white/15 bg-white/[0.08] px-7 py-3.5 text-[1.875rem]',
                        portrait ? 'self-center' : 'self-start',
                      )}
                    >
                      <Heart className="h-8 w-8 shrink-0 fill-magenta text-magenta" />
                      <span className="shrink-0 text-white/60">This one is from</span>
                      <span className="truncate font-bold text-white" dir="auto">
                        {req.guestName}
                      </span>
                    </div>
                  )}
                  {req.dedicatedTo && (
                    <div className="mt-5 text-[1.75rem] text-white/60">
                      Dedicated to <span className="font-bold text-white">{req.dedicatedTo}</span>
                    </div>
                  )}
                  </div>
                  <div className={cn('flex w-full shrink-0 items-center justify-between gap-6', portrait ? 'mt-10' : 'pt-4')}>
                    {next ? (
                      <div className="card-frame flex min-w-0 items-center gap-4 rounded-[1.5rem] p-3 pr-6 text-left">
                        <Artwork url={next.artworkUrl} seed={next.songTitle} label={next.songTitle} className="h-[4.5rem] w-[4.5rem]" rounded="rounded-[1rem]" />
                        <div className="min-w-0">
                          <div className="text-[0.9375rem] font-bold uppercase tracking-[0.3em] text-white/45">Up next</div>
                          <div className="truncate text-[1.5rem] font-bold" dir="auto">
                            {next.songTitle}
                          </div>
                          <div className="truncate text-[1.125rem] text-white/50" dir="auto">
                            {next.artist}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <span />
                    )}
                    <QRCard snap={snap} variant="mini" size={124} className="shrink-0" />
                  </div>
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div key="idle" className="absolute inset-0 grid place-items-center p-10" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <QRCard snap={snap} variant={portrait ? 'stack' : 'row'} size={portrait ? 420 : 340} className={portrait ? 'w-[40rem] !p-12' : '!p-12'} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <FooterMarquee />
    </div>
  );
}

/* ============================================================ REQUEST WALL */
const CARD_W = 256;
const CARD_H = 112;

export function RequestWallScreen({ snap }: { snap: EventSnapshot }) {
  const { portrait, W, H, u } = useStage();
  const qrZone = portrait ? 328 : 440; // bottom strip (portrait) or right column (landscape), design px
  const areaW = portrait ? W : W - qrZone;
  const areaH = H - (portrait ? HEADER_P : HEADER_L) - FOOTER_H - (portrait ? qrZone : 0);
  const cols = Math.max(2, Math.floor(areaW / (portrait ? 330 : 292)));
  const rows = Math.max(2, Math.floor(areaH / (portrait ? 196 : 215)));
  const cellW = areaW / cols;
  const cellH = areaH / rows;

  const items = useMemo(
    () =>
      queueOf(snap.requests)
        .concat(snap.requests.filter((r) => r.status === 'playing'))
        .sort((a, b) => b.voteCount - a.voteCount || b.requestedAt.localeCompare(a.requestedAt))
        .slice(0, cols * rows),
    [snap.requests, cols, rows],
  );
  // cells ordered from the centre outwards → the most popular songs take centre stage
  const cells = useMemo(() => {
    const all: Array<{ c: number; r: number; d: number }> = [];
    for (let r = 0; r < rows; r++)
      for (let c = 0; c < cols; c++) all.push({ c, r, d: Math.hypot((c - (cols - 1) / 2) * cellW, (r - (rows - 1) / 2) * cellH * 1.25) });
    return all.sort((a, b) => a.d - b.d);
  }, [cols, rows, cellW, cellH]);
  const max = Math.max(1, ...items.map((r) => r.voteCount));

  // Sticky seats: a card keeps its place while it is on the wall (no constant reshuffling as votes
  // tick). Newcomers take the free seat closest to the centre; a new leader swaps into the centre.
  const seats = useRef(new Map<string, number>());
  const grid = useRef('');
  const placed = useMemo(() => {
    const map = seats.current;
    if (grid.current !== `${cols}x${rows}`) {
      map.clear();
      grid.current = `${cols}x${rows}`;
    }
    const ids = new Set(items.map((r) => r.id));
    for (const id of [...map.keys()]) if (!ids.has(id)) map.delete(id);
    const used = new Set(map.values());
    let free = 0;
    for (const r of items) {
      if (map.has(r.id)) continue;
      while (used.has(free)) free++;
      map.set(r.id, free);
      used.add(free);
    }
    const leader = items[0];
    if (leader && leader.voteCount > 0 && map.get(leader.id) !== 0) {
      const from = map.get(leader.id)!;
      for (const [id, seat] of map) if (seat === 0) map.set(id, from);
      map.set(leader.id, 0);
    }
    return items.map((r) => ({ r, cell: cells[map.get(r.id)!] }));
  }, [items, cells, cols, rows]);

  return (
    <div className="relative flex h-full flex-col">
      <DisplayHeader snap={snap} />
      <div className="relative min-h-0 flex-1">
        <AnimatePresence>
          {placed.map(({ r, cell }) => {
            if (!cell) return null;
            const h = hashString(r.id);
            const jx = ((h % 30) - 15) * 0.8;
            const jy = (((h >> 4) % 30) - 15) * 0.9;
            const scale = 0.86 + 0.22 * (r.voteCount / max);
            return (
              <motion.div
                key={r.id}
                layout
                initial={{ opacity: 0, scale: 0.2, y: -420 * u, rotate: -22 }}
                animate={{ opacity: 1, scale, y: 0, rotate: ((h >> 8) % 9) - 4 }}
                exit={{ opacity: 0, scale: 0.3 }}
                transition={{ type: 'spring', stiffness: 60, damping: 14 }}
                className="absolute"
                style={{
                  left: rem(cell.c * cellW + cellW / 2 - CARD_W / 2 + jx),
                  top: rem(cell.r * cellH + cellH / 2 - CARD_H / 2 + jy),
                  zIndex: Math.round(scale * 100),
                }}
              >
                <div className="animate-float" style={{ animationDelay: `${-(h % 6000) / 1000}s`, animationDuration: `${5 + (h % 4)}s` }}>
                  <WallCard r={r} hot={r.voteCount === max && r.voteCount > 0} showName={snap.settings.showRequesterNames} />
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {items.length === 0 && (
          <div className="absolute inset-0 grid place-items-center px-10 text-center font-display text-[2.25rem] font-black text-white/40">
            Requests will appear here live
          </div>
        )}
        {portrait ? (
          <div className="absolute inset-x-10 bottom-5 z-[200]">
            <QRCard snap={snap} steps className="card-solid" />
          </div>
        ) : (
          <div className="absolute right-10 top-1/2 z-[200] w-[23rem] -translate-y-1/2">
            <QRCard snap={snap} variant="stack" size={220} className="card-solid" />
          </div>
        )}
      </div>
      <FooterMarquee />
    </div>
  );
}

function WallCard({ r, hot, showName }: { r: SongRequest; hot: boolean; showName: boolean }) {
  return (
    <div
      className={cn('card-solid relative flex items-center gap-3.5 rounded-[1.5rem] p-3', hot && 'neon-border shadow-glow-lg', r.status === 'playing' && 'ring-2 ring-cyan/70')}
      style={{ width: rem(CARD_W), height: rem(CARD_H) }}
    >
      <Artwork url={r.artworkUrl} seed={r.songTitle} label={r.songTitle} className="h-[5.4rem] w-[5.4rem]" rounded="rounded-[1.1rem]" />
      <div className="min-w-0 flex-1">
        <div className="line-clamp-2 text-[1.125rem] font-bold leading-[1.15]" dir="auto">
          {r.songTitle}
        </div>
        <div className="truncate text-[0.9375rem] text-white/55" dir="auto">
          {r.artist}
        </div>
        <div className="mt-1 flex items-center justify-between gap-2 text-[0.9375rem]">
          <span className="truncate text-white/45" dir="auto">
            {showName ? r.guestName : ''}
          </span>
          <span className="relative flex shrink-0 items-center gap-1 font-bold">
            <VotePops value={r.voteCount} className="right-4 top-0" small />
            <Heart className="h-4 w-4 fill-magenta text-magenta" />
            <CountUp value={r.voteCount} />
          </span>
        </div>
      </div>
    </div>
  );
}

/* ============================================================ LEADERBOARD */
const PODIUM = [
  'bg-gradient-to-br from-amber-200 to-amber-500 text-ink',
  'bg-gradient-to-br from-slate-100 to-slate-400 text-ink',
  'bg-gradient-to-br from-orange-300 to-orange-600 text-ink',
];

export function LeaderboardScreen({ snap }: { snap: EventSnapshot }) {
  const { portrait, H } = useStage();
  const lb = leaderboardOf(snap.requests);
  const top = lb.topSongs.slice(0, portrait ? (H > 2150 ? 8 : 6) : 8);
  const fame = playedOf(snap.requests).slice(0, portrait ? 7 : 6);
  const listRows = portrait ? (H > 2150 ? 9 : 6) : 5;
  const highlights = (
    <div className={cn('grid shrink-0 grid-cols-2', portrait ? 'gap-5' : 'gap-6')}>
      <Highlight icon={<Star className="h-7 w-7 fill-amber-300/30 text-amber-300" />} label="Most popular song" value={lb.mostPopular?.songTitle ?? '—'} sub={lb.mostPopular ? `${lb.mostPopular.voteCount} votes` : 'No votes yet'} />
      <Highlight icon={<Mic2 className="h-7 w-7 text-cyan" />} label="Most requested artist" value={lb.topArtist?.name ?? '—'} sub={lb.topArtist ? `${lb.topArtist.count} requests` : 'No requests yet'} />
    </div>
  );
  const lists = (
    <div className={cn('grid min-h-0 flex-1 grid-cols-2', portrait ? 'gap-5' : 'gap-6')}>
      <GuestList title="SOUNDTRACK HEROES" subtitle="songs played" list={lb.heroes} rows={listRows} />
      <GuestList title="CROWD FAVOURITES" subtitle="votes received" list={lb.mostVoted} rows={listRows} />
    </div>
  );
  const fameStrip = (
    <div className="card-frame shrink-0 rounded-[2rem] p-5">
      <div className="mb-3 flex items-center gap-3 font-display text-[1.0625rem] font-black tracking-[0.3em] text-white/65">
        <Crown className="h-6 w-6 text-amber-300" /> WALL OF FAME
      </div>
      <div className="flex gap-4">
        {fame.map((r) => (
          <div key={r.id} className="w-[6.5rem] min-w-0 text-center">
            <Artwork url={r.artworkUrl} seed={r.songTitle} label={r.songTitle} className="h-[6.5rem] w-[6.5rem]" rounded="rounded-[1.15rem]" />
            <div className="mt-2 truncate text-[1rem] font-bold" dir="auto">
              {r.guestName}
            </div>
          </div>
        ))}
        {!fame.length && <div className="py-4 text-[1.25rem] text-white/40">Played requests earn a spot here.</div>}
      </div>
    </div>
  );

  return (
    <div className="relative flex h-full flex-col">
      <DisplayHeader snap={snap} />
      {portrait ? (
        <div className="flex min-h-0 flex-1 flex-col gap-5 px-10 py-5">
          <TopSongs top={top} className="shrink-0" />
          {highlights}
          {lists}
          {fameStrip}
        </div>
      ) : (
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)] gap-10 px-16 pb-6 pt-2">
          <TopSongs top={top} />
          <div className="flex min-h-0 flex-col gap-6">
            {highlights}
            {lists}
            {fameStrip}
          </div>
        </div>
      )}
      <FooterMarquee />
    </div>
  );
}

function TopSongs({ top, className }: { top: SongRequest[]; className?: string }) {
  const maxV = Math.max(1, ...top.map((r) => r.voteCount));
  return (
    <div className={cn('card-frame flex min-h-0 flex-col rounded-[2.5rem] p-9', className)}>
      <div className="flex items-center gap-4 font-display text-[1.75rem] font-black tracking-[0.22em]">
        <Trophy className="h-9 w-9 text-amber-300" /> THE CROWD'S TOP SONGS
      </div>
      <div className="mt-7 flex flex-1 flex-col gap-3">
        <AnimatePresence initial={false}>
          {top.map((r, i) => (
            <motion.div
              layout
              key={r.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 120, damping: 20 }}
              className="relative flex h-[4.85rem] shrink-0 items-center gap-5 overflow-hidden rounded-[1.25rem] bg-white/[0.045] px-4"
            >
              <motion.div
                className={cn('absolute inset-y-0 left-0', i === 0 ? 'bg-gradient-to-r from-amber-300/40 to-magenta/25' : 'bg-gradient-to-r from-primary/35 to-magenta/10')}
                animate={{ width: `${(r.voteCount / maxV) * 100}%` }}
                transition={{ type: 'spring', stiffness: 60, damping: 16 }}
              />
              <div
                className={cn(
                  'relative grid h-11 w-11 shrink-0 place-items-center rounded-xl font-display text-[1.375rem] font-black',
                  PODIUM[i] ?? 'bg-white/[0.07] text-white/50',
                )}
              >
                {i + 1}
              </div>
              <Artwork url={r.artworkUrl} seed={r.songTitle} label={r.songTitle} className="relative h-[3.6rem] w-[3.6rem]" rounded="rounded-[0.9rem]" />
              <div className="relative min-w-0 flex-1">
                <div className="truncate text-[1.5rem] font-bold leading-tight" dir="auto">
                  {r.songTitle}
                </div>
                <div className="truncate text-[1.0625rem] text-white/55" dir="auto">
                  {r.artist} · {r.guestName}
                </div>
              </div>
              <div className="relative shrink-0">
                <VotePops value={r.voteCount} className="left-1/2 top-0" />
                <Bump value={r.voteCount}>
                  <CountUp value={r.voteCount} className="font-display text-[2.125rem] font-black tabular-nums" />
                </Bump>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {!top.length && <div className="grid flex-1 place-items-center py-10 text-[1.625rem] text-white/40">Votes will rank the songs here</div>}
      </div>
    </div>
  );
}

function Highlight({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="neon-border card-frame min-w-0 rounded-[2rem] p-6">
      <div className="flex items-center gap-3 text-[0.9375rem] font-bold uppercase tracking-[0.26em] text-white/55">
        <span className="shrink-0">{icon}</span> <span className="truncate">{label}</span>
      </div>
      <div className="relative mt-3 h-[2.9rem] overflow-hidden">
        <AnimatePresence initial={false}>
          <motion.div
            key={value}
            className="absolute inset-0 truncate font-display text-[2.125rem] font-black leading-[1.3]"
            initial={{ opacity: 0, y: '60%' }}
            animate={{ opacity: 1, y: '0%' }}
            exit={{ opacity: 0, y: '-60%' }}
            dir="auto"
          >
            {value}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="mt-1 text-[1.125rem] text-white/50">{sub}</div>
    </div>
  );
}

function GuestList({ title, subtitle, list, rows }: { title: string; subtitle: string; list: Array<{ key: string; name: string; count: number }>; rows: number }) {
  return (
    <div className="card-frame flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[2rem] p-5">
      <div className="shrink-0 truncate font-display text-[1.0625rem] font-black tracking-[0.24em] text-white/75">{title}</div>
      <div className="mt-3 flex min-h-0 flex-col gap-2">
        {list.slice(0, rows).map((g, i) => (
          <motion.div layout key={g.key} className="flex shrink-0 items-center gap-4 rounded-[1rem] bg-white/[0.045] px-3.5 py-1.5">
            <span className={cn('grid h-8 w-8 shrink-0 place-items-center rounded-lg font-display text-[1rem] font-black', PODIUM[i] ?? 'bg-white/[0.07] text-white/50')}>
              {i + 1}
            </span>
            <span className="min-w-0 flex-1 truncate text-[1.375rem] font-semibold" dir="auto">
              {g.name}
            </span>
            <Bump value={g.count}>
              <span className="font-display text-[1.5rem] font-black tabular-nums">{g.count}</span>
            </Bump>
          </motion.div>
        ))}
        {!list.length && <div className="text-[1.125rem] text-white/40">No data yet</div>}
      </div>
      <div className="mt-auto shrink-0 pt-2 text-right text-[0.8125rem] font-semibold uppercase tracking-[0.3em] text-white/35">{subtitle}</div>
    </div>
  );
}
