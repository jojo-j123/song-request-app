import { AnimatePresence, motion } from 'framer-motion';
import { Link, useParams } from 'react-router-dom';
import { Check, Clapperboard, Crown, Flame, Inbox, LayoutDashboard, Play, SkipForward, Square, X, Zap } from 'lucide-react';
import { useEventSnapshot } from '@/hooks/useEvent';
import { useEventHost } from '@/lib/demo/simulator';
import { leaderOf, nowPlayingOf, pendingOf, queueOf } from '@/lib/selectors';
import { cn } from '@/lib/utils';
import { Artwork, ConnectionBadge, Equalizer, FullScreenMessage, Spinner, Toggle } from '@/components/ui';
import { AdminGate, useAdminActions } from '@/components/admin/common';
import { MODES } from '@/components/admin/panels';
import type { EventSnapshot, SongRequest } from '@/lib/types';
import type { Backend } from '@/lib/backend';

export default function DJ() {
  const { eventId = '' } = useParams();
  const { backend, snap, status } = useEventSnapshot(eventId);
  return (
    <AdminGate backend={backend} eventId={eventId}>
      {snap === undefined ? (
        <div className="grid min-h-screen place-items-center bg-ink">
          <Spinner className="h-8 w-8 text-primary" />
        </div>
      ) : snap === null ? (
        <FullScreenMessage title="Event not found" />
      ) : (
        <DJInner backend={backend!} snap={snap} status={status} />
      )}
    </AdminGate>
  );
}

function DJInner({ backend, snap, status }: { backend: Backend; snap: EventSnapshot; status: Parameters<typeof ConnectionBadge>[0]['status'] }) {
  const eventId = snap.event.id;
  const { run, busy } = useAdminActions(backend, eventId);
  useEventHost(backend, snap, true);
  const playing = nowPlayingOf(snap.requests);
  const queue = queueOf(snap.requests);
  const leader = leaderOf(snap.requests);
  const next = leader ?? queue[0] ?? null;
  const pending = pendingOf(snap.requests);
  const s = snap.settings;

  return (
    <div className="min-h-screen bg-ink p-3 text-white lg:p-5">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <div className="font-display text-lg font-black">{snap.event.name}</div>
        <span className="chip border-cyan/30 text-cyan">DJ MODE</span>
        {s.demo.enabled && <span className="chip border-amber-300/40 text-amber-200">DEMO</span>}
        <ConnectionBadge status={status} />
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {MODES.map((m) => (
            <button
              key={m.value}
              onClick={() => run({ type: 'updateSettings', patch: { displayMode: m.value } })}
              className={cn('chip py-2', s.displayMode === m.value && 'border-primary/60 bg-primary/25 text-white')}
            >
              {m.icon} <span className="hidden sm:inline">{m.label}</span>
            </button>
          ))}
          <Link to={`/admin/${eventId}`} className="btn-ghost px-3 py-2 text-sm">
            <LayoutDashboard className="h-4 w-4" /> Full dashboard
          </Link>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr_1fr]">
        {/* NOW + NEXT */}
        <div className="space-y-4">
          <div className="rounded-3xl border border-cyan/25 bg-gradient-to-br from-cyan/[0.08] to-transparent p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-[0.3em] text-cyan">Now playing</span>
              {playing && <Equalizer bars={4} className="h-4" barClass="w-1" />}
            </div>
            {playing ? (
              <>
                <BigSong r={playing} />
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <button className="btn-ghost py-3.5" onClick={() => run({ type: 'finishCurrent' })}>
                    <Square className="h-4 w-4" /> End song
                  </button>
                  <button className="btn-ghost py-3.5" onClick={() => run({ type: 'command', command: { type: 'fame', payload: { requestId: playing.id } } }, 'Spotlight!')}>
                    <Crown className="h-4 w-4 text-amber-300" /> Spotlight
                  </button>
                </div>
              </>
            ) : (
              <div className="py-8 text-center text-white/40">Nothing playing</div>
            )}
          </div>

          <div className="neon-border rounded-3xl bg-gradient-to-br from-primary/15 via-magenta/10 to-transparent p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase tracking-[0.3em] text-magenta">Next up</span>
              {leader && next?.id === leader.id && (
                <span className="chip border-amber-300/40 text-amber-200">
                  <Crown className="h-3 w-3" /> crowd favourite
                </span>
              )}
            </div>
            {next ? (
              <>
                <BigSong r={next} />
                <button
                  disabled={busy === 'reveal' + next.id}
                  onClick={() => run({ type: 'reveal', id: next.id }, 'Countdown on screen!')}
                  className="btn-primary mt-4 w-full py-5 font-display text-lg tracking-wider"
                >
                  <Clapperboard className="h-5 w-5" /> REVEAL NEXT ({s.countdownDuration}s)
                </button>
                <div className="mt-2 grid grid-cols-2 gap-2">
                  <button className="btn-ghost py-3" onClick={() => run({ type: 'playNow', id: next.id }, 'Now playing')}>
                    <Play className="h-4 w-4" /> Play (no reveal)
                  </button>
                  <button className="btn-ghost py-3" onClick={() => run({ type: 'skip', id: next.id }, 'Skipped')}>
                    <SkipForward className="h-4 w-4" /> Skip
                  </button>
                </div>
              </>
            ) : (
              <div className="py-8 text-center text-white/40">Queue is empty</div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-3xl border border-white/[0.07] bg-ink-2/70 p-3">
            <button className="btn-ghost py-3.5" onClick={() => run({ type: 'command', command: { type: 'hype', payload: {} } }, 'HYPE!')}>
              <Zap className="h-4 w-4 text-amber-300" /> Hype moment
            </button>
            <button className="btn-ghost py-3.5" onClick={() => run({ type: 'command', command: { type: 'clear' } })}>
              <X className="h-4 w-4" /> Clear screen
            </button>
            <div className="col-span-2 grid grid-cols-2 gap-x-4 px-2">
              <Toggle label="Requests" checked={s.submissionsEnabled} onChange={(v) => run({ type: 'updateSettings', patch: { submissionsEnabled: v } })} />
              <Toggle label="Voting" checked={s.votingEnabled} onChange={(v) => run({ type: 'updateSettings', patch: { votingEnabled: v } })} />
            </div>
          </div>
        </div>

        {/* INCOMING */}
        <div className="rounded-3xl border border-white/[0.07] bg-ink-2/70 p-4">
          <div className="mb-3 flex items-center gap-2 font-display font-bold">
            <Inbox className="h-4 w-4 text-amber-300" /> Incoming <span className="text-white/40">{pending.length}</span>
          </div>
          <div className="max-h-[75vh] space-y-2 overflow-y-auto pr-1">
            <AnimatePresence initial={false}>
              {pending.map((r) => (
                <motion.div key={r.id} layout initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 40 }} className="flex items-center gap-2 rounded-2xl bg-white/[0.04] p-2">
                  <Row r={r} />
                  <button aria-label="Approve" onClick={() => run({ type: 'approve', id: r.id })} className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-emerald-400/15 text-emerald-300 active:scale-90">
                    <Check className="h-6 w-6" />
                  </button>
                  <button aria-label="Reject" onClick={() => run({ type: 'reject', id: r.id })} className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-rose-400/10 text-rose-300 active:scale-90">
                    <X className="h-6 w-6" />
                  </button>
                </motion.div>
              ))}
            </AnimatePresence>
            {!pending.length && <div className="py-10 text-center text-sm text-white/40">No pending requests{s.autoApprove ? ' (auto-approve is on)' : ''}</div>}
          </div>
        </div>

        {/* QUEUE */}
        <div className="rounded-3xl border border-white/[0.07] bg-ink-2/70 p-4">
          <div className="mb-3 flex items-center justify-between font-display font-bold">
            <span className="flex items-center gap-2">
              <Flame className="h-4 w-4 text-magenta" /> Up next <span className="text-white/40">{queue.length}</span>
            </span>
            <button className="text-xs font-semibold text-cyan" onClick={() => run({ type: 'sortByVotes' }, 'Sorted by votes')}>
              Sort by votes
            </button>
          </div>
          <div className="max-h-[75vh] space-y-2 overflow-y-auto pr-1">
            {queue.map((r) => (
              <motion.div layout key={r.id} className={cn('flex items-center gap-2 rounded-2xl p-2', r.id === leader?.id ? 'bg-amber-300/[0.08]' : 'bg-white/[0.04]')}>
                <Row r={r} votes />
                <button aria-label="Reveal" onClick={() => run({ type: 'reveal', id: r.id }, 'Countdown on screen!')} className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/20 text-white active:scale-90">
                  <Clapperboard className="h-5 w-5" />
                </button>
              </motion.div>
            ))}
            {!queue.length && <div className="py-10 text-center text-sm text-white/40">Approve requests to build the queue</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function BigSong({ r }: { r: SongRequest }) {
  return (
    <div className="mt-3 flex items-center gap-4">
      <Artwork url={r.artworkUrl} seed={r.songTitle} label={r.songTitle} className="h-24 w-24" />
      <div className="min-w-0">
        <div className="truncate text-2xl font-black">{r.songTitle}</div>
        <div className="truncate text-white/60">{r.artist}</div>
        <div className="mt-1 text-sm text-white/45">
          for <b className="text-white/80">{r.guestName}</b> · {r.voteCount} votes
        </div>
      </div>
    </div>
  );
}

function Row({ r, votes }: { r: SongRequest; votes?: boolean }) {
  return (
    <>
      <Artwork url={r.artworkUrl} seed={r.songTitle} label={r.songTitle} className="h-12 w-12" rounded="rounded-xl" />
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">{r.songTitle}</div>
        <div className="truncate text-xs text-white/50">
          {r.artist} · {r.guestName}
        </div>
      </div>
      {votes && <span className="px-1 font-display text-lg font-black tabular-nums">{r.voteCount}</span>}
    </>
  );
}
