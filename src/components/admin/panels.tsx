import { Reorder } from 'framer-motion';
import { useMemo, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Cake,
  Check,
  Clapperboard,
  Crown,
  Gift,
  GripVertical,
  Heart,
  LayoutGrid,
  ListOrdered,
  Monitor,
  Pause,
  Play,
  RotateCcw,
  Search,
  SkipForward,
  Sparkles,
  Square,
  Swords,
  Trash2,
  Trophy,
  Undo2,
  X,
  Zap,
} from 'lucide-react';
import type { DisplayMode, EventSnapshot, RequestStatus, SongRequest } from '@/lib/types';
import { leaderOf, nowPlayingOf, queueOf, trendingOf } from '@/lib/selectors';
import { cn } from '@/lib/utils';
import { Segmented, Toggle, useUI } from '@/components/ui';
import { useNow } from '@/hooks/useEvent';
import { Panel, SongCell, STATUS_STYLE, useAdminActions } from './common';

type Run = ReturnType<typeof useAdminActions>['run'];

/* =============================================================== REQUESTS */
export function RequestsPanel({ snap, run }: { snap: EventSnapshot; run: Run }) {
  const { confirm } = useUI();
  const [filter, setFilter] = useState<RequestStatus | 'all'>('pending');
  const [q, setQ] = useState('');
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return snap.requests
      .filter((r) => filter === 'all' || r.status === filter)
      .filter((r) => !s || `${r.songTitle} ${r.artist} ${r.guestName}`.toLowerCase().includes(s))
      .sort((a, b) => (filter === 'approved' ? a.queuePosition - b.queuePosition : b.requestedAt.localeCompare(a.requestedAt)));
  }, [snap.requests, filter, q]);
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: snap.requests.length };
    for (const r of snap.requests) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [snap.requests]);
  const filters: Array<RequestStatus | 'all'> = ['pending', 'approved', 'playing', 'played', 'rejected', 'skipped', 'all'];
  const pending = snap.requests.filter((r) => r.status === 'pending');

  return (
    <Panel
      title="Requests"
      icon={<ListOrdered className="h-4 w-4 text-primary" />}
      actions={
        filter === 'pending' && pending.length > 1 ? (
          <button
            className="btn-success px-3 py-1.5 text-sm"
            onClick={async () => {
              for (const r of pending) await run({ type: 'approve', id: r.id });
            }}
          >
            <Check className="h-4 w-4" /> Approve all ({pending.length})
          </button>
        ) : null
      }
    >
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center">
        <div className="flex flex-wrap gap-1.5">
          {filters.map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={cn('chip capitalize', filter === f && 'border-primary/60 bg-primary/20 text-white')}>
              {f} <span className="text-white/40">{counts[f] ?? 0}</span>
            </button>
          ))}
        </div>
        <div className="relative md:ml-auto md:w-64">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <input className="field py-2 pl-9 text-sm" placeholder="Search song, artist, guest" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>
      <div className="max-h-[60vh] space-y-1.5 overflow-y-auto pr-1">
        {list.map((r) => (
          <div key={r.id} className="flex items-center gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.02] p-2.5 hover:bg-white/[0.04]">
            <div className="min-w-0 flex-1">
              <SongCell r={r} />
            </div>
            <span className="hidden items-center gap-1 text-sm font-bold tabular-nums text-white/70 sm:flex">
              <Heart className="h-3.5 w-3.5 text-magenta" /> {r.voteCount}
            </span>
            <span className={cn('chip hidden capitalize sm:inline-flex', STATUS_STYLE[r.status])}>{r.status}</span>
            <div className="flex shrink-0 gap-1">
              {r.status === 'pending' && (
                <>
                  <IconBtn title="Approve" className="text-emerald-300" onClick={() => run({ type: 'approve', id: r.id })}>
                    <Check />
                  </IconBtn>
                  <IconBtn title="Reject" className="text-rose-300" onClick={() => run({ type: 'reject', id: r.id })}>
                    <X />
                  </IconBtn>
                </>
              )}
              {r.status === 'approved' && (
                <>
                  <IconBtn title="Reveal with countdown" className="text-cyan" onClick={() => run({ type: 'reveal', id: r.id }, 'Countdown started on the big screen')}>
                    <Clapperboard />
                  </IconBtn>
                  <IconBtn title="Mark now playing" onClick={() => run({ type: 'playNow', id: r.id }, 'Now playing')}>
                    <Play />
                  </IconBtn>
                  <IconBtn title="Skip" onClick={() => run({ type: 'skip', id: r.id })}>
                    <SkipForward />
                  </IconBtn>
                </>
              )}
              {(r.status === 'playing' || r.status === 'played') && (
                <IconBtn title="Spotlight on Wall of Fame" className="text-amber-300" onClick={() => run({ type: 'command', command: { type: 'fame', payload: { requestId: r.id } } }, 'Spotlight on screen')}>
                  <Crown />
                </IconBtn>
              )}
              {r.dedicatedTo && (
                <IconBtn title="Show dedication" className="text-pink-300" onClick={() => run({ type: 'command', command: { type: 'dedication', payload: { requestId: r.id } } }, 'Dedication on screen')}>
                  <Heart />
                </IconBtn>
              )}
              {['rejected', 'skipped', 'played'].includes(r.status) && (
                <IconBtn title="Back to queue" onClick={() => run({ type: 'restore', id: r.id }, 'Back in the queue')}>
                  <Undo2 />
                </IconBtn>
              )}
              <IconBtn
                title="Delete"
                className="text-white/40 hover:text-rose-300"
                onClick={async () => {
                  if (await confirm({ title: 'Delete this request?', body: `"${r.songTitle}" and its votes will be removed permanently.`, confirmText: 'Delete', danger: true }))
                    run({ type: 'delete', id: r.id }, 'Deleted');
                }}
              >
                <Trash2 />
              </IconBtn>
            </div>
          </div>
        ))}
        {!list.length && <div className="py-10 text-center text-sm text-white/40">Nothing here.</div>}
      </div>
    </Panel>
  );
}

export function IconBtn({ children, onClick, title, className, disabled }: { children: React.ReactElement; onClick: () => void; title: string; className?: string; disabled?: boolean }) {
  return (
    <button
      title={title}
      aria-label={title}
      disabled={disabled}
      onClick={onClick}
      className={cn('grid h-9 w-9 place-items-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-white/80 transition hover:bg-white/10 active:scale-90 disabled:opacity-30 [&>svg]:h-4 [&>svg]:w-4', className)}
    >
      {children}
    </button>
  );
}

/* =============================================================== QUEUE */
export function QueuePanel({ snap, run }: { snap: EventSnapshot; run: Run }) {
  const queue = queueOf(snap.requests);
  const [order, setOrder] = useState<string[] | null>(null);
  const items = order ? (order.map((id) => queue.find((r) => r.id === id)).filter(Boolean) as SongRequest[]) : queue;
  const playing = nowPlayingOf(snap.requests);
  const leader = leaderOf(snap.requests);

  return (
    <Panel
      title={`Queue (${queue.length})`}
      icon={<ListOrdered className="h-4 w-4 text-cyan" />}
      actions={
        <div className="flex gap-2">
          <button className="btn-ghost px-3 py-1.5 text-sm" onClick={() => run({ type: 'sortByVotes' }, 'Queue sorted by votes')}>
            <ArrowUpDown className="h-4 w-4" /> Sort by votes
          </button>
          {playing && (
            <button className="btn-ghost px-3 py-1.5 text-sm" onClick={() => run({ type: 'finishCurrent' }, 'Marked as played')}>
              <Square className="h-4 w-4" /> End current
            </button>
          )}
        </div>
      }
    >
      {playing && (
        <div className="mb-3 flex items-center gap-3 rounded-2xl border border-cyan/30 bg-cyan/[0.07] p-3">
          <span className="text-[10px] font-black uppercase tracking-[0.25em] text-cyan">Now</span>
          <div className="min-w-0 flex-1">
            <SongCell r={playing} sub={<></>} />
          </div>
        </div>
      )}
      <Reorder.Group
        axis="y"
        values={items.map((r) => r.id)}
        onReorder={(ids) => setOrder(ids)}
        className="max-h-[60vh] space-y-1.5 overflow-y-auto pr-1"
      >
        {items.map((r, i) => (
          <Reorder.Item
            key={r.id}
            value={r.id}
            onDragEnd={() => {
              if (order) run({ type: 'reorder', ids: order }).then(() => setOrder(null));
            }}
            className={cn('flex cursor-grab items-center gap-2 rounded-2xl border bg-ink-2 p-2 active:cursor-grabbing', r.id === leader?.id ? 'border-amber-300/40' : 'border-white/[0.06]')}
          >
            <GripVertical className="h-4 w-4 shrink-0 text-white/25" />
            <span className="w-6 text-center font-display text-sm font-bold text-white/35">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <SongCell r={r} />
            </div>
            <span className="flex items-center gap-1 text-sm font-bold tabular-nums">
              {r.id === leader?.id && <Crown className="h-3.5 w-3.5 text-amber-300" />}
              {r.voteCount}
            </span>
            <div className="flex gap-1">
              <IconBtn title="Move up" disabled={i === 0} onClick={() => run({ type: 'move', id: r.id, dir: -1 })}>
                <ArrowUp />
              </IconBtn>
              <IconBtn title="Move down" disabled={i === items.length - 1} onClick={() => run({ type: 'move', id: r.id, dir: 1 })}>
                <ArrowDown />
              </IconBtn>
              <IconBtn title="Reveal next (countdown)" className="text-cyan" onClick={() => run({ type: 'reveal', id: r.id }, 'Countdown started')}>
                <Clapperboard />
              </IconBtn>
              <IconBtn title="Skip" onClick={() => run({ type: 'skip', id: r.id })}>
                <SkipForward />
              </IconBtn>
            </div>
          </Reorder.Item>
        ))}
      </Reorder.Group>
      {!items.length && <div className="py-10 text-center text-sm text-white/40">Queue is empty. Approve requests to fill it.</div>}
    </Panel>
  );
}

/* =============================================================== DISPLAY */
export const MODES: Array<{ value: DisplayMode; label: string; icon: React.ReactNode }> = [
  { value: 'main', label: 'Main', icon: <Monitor className="h-4 w-4" /> },
  { value: 'nowplaying', label: 'Now Playing', icon: <Play className="h-4 w-4" /> },
  { value: 'wall', label: 'Request Wall', icon: <LayoutGrid className="h-4 w-4" /> },
  { value: 'leaderboard', label: 'Leaderboard', icon: <Trophy className="h-4 w-4" /> },
];

export function DisplayPanel({ snap, run }: { snap: EventSnapshot; run: Run }) {
  const s = snap.settings;
  const next = leaderOf(snap.requests) ?? queueOf(snap.requests)[0];
  const playing = nowPlayingOf(snap.requests);
  return (
    <Panel title="Big screen" icon={<Monitor className="h-4 w-4 text-primary" />}>
      <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {MODES.map((m) => (
          <button
            key={m.value}
            onClick={() => run({ type: 'updateSettings', patch: { displayMode: m.value } }, `Screen: ${m.label}`)}
            className={cn(
              'flex flex-col items-center gap-2 rounded-2xl border p-4 text-sm font-semibold transition',
              s.displayMode === m.value ? 'border-primary/60 bg-gradient-to-b from-primary/25 to-magenta/10 shadow-glow' : 'border-white/[0.07] bg-white/[0.03] hover:bg-white/[0.06]',
            )}
          >
            {m.icon}
            {m.label}
          </button>
        ))}
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3">
        <button className="btn-primary py-3" disabled={!next} onClick={() => next && run({ type: 'reveal', id: next.id }, `Revealing “${next.songTitle}”`)}>
          <Clapperboard className="h-4 w-4" /> Reveal next
        </button>
        <button className="btn-ghost py-3" disabled={!playing} onClick={() => playing && run({ type: 'command', command: { type: 'fame', payload: { requestId: playing.id } } }, 'Wall of Fame!')}>
          <Crown className="h-4 w-4 text-amber-300" /> Spotlight guest
        </button>
        <button className="btn-ghost py-3" onClick={() => run({ type: 'command', command: { type: 'clear' } }, 'Overlay cleared')}>
          <X className="h-4 w-4" /> Clear overlay
        </button>
      </div>
      {next && <p className="mt-2 text-xs text-white/45">Next reveal: “{next.songTitle}” ({next.voteCount} votes) — {s.countdownDuration}s countdown</p>}
    </Panel>
  );
}

/* =============================================================== MOMENTS */
export function MomentsPanel({ snap, run }: { snap: EventSnapshot; run: Run }) {
  const [kind, setKind] = useState<'hype' | 'dedication' | 'birthday' | 'surprise'>('hype');
  const [f, setF] = useState({ message: '', name: '', from: '', to: '', title: '', requestId: '' });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((x) => ({ ...x, [k]: e.target.value }));
  const songs = snap.requests.filter((r) => ['approved', 'playing', 'played'].includes(r.status));
  const cards = [
    { k: 'hype' as const, icon: <Zap className="h-5 w-5 text-amber-300" />, label: 'Hype', tint: 'from-amber-400/20' },
    { k: 'dedication' as const, icon: <Heart className="h-5 w-5 text-pink-300" />, label: 'Dedication', tint: 'from-pink-500/20' },
    { k: 'birthday' as const, icon: <Cake className="h-5 w-5 text-amber-200" />, label: 'Birthday', tint: 'from-yellow-400/20' },
    { k: 'surprise' as const, icon: <Gift className="h-5 w-5 text-cyan" />, label: 'Surprise', tint: 'from-cyan/20' },
  ];
  function fire() {
    const payload: Record<string, unknown> = {};
    if (kind === 'hype') payload.message = f.message || undefined;
    if (kind === 'birthday') Object.assign(payload, { name: f.name || 'YOU', message: f.message || undefined });
    if (kind === 'surprise') Object.assign(payload, { title: f.title || undefined, message: f.message || undefined });
    if (kind === 'dedication') {
      const r = songs.find((x) => x.id === f.requestId);
      Object.assign(payload, { requestId: r?.id, songTitle: r?.songTitle, artist: r?.artist, from: f.from || r?.guestName, to: f.to || r?.dedicatedTo, message: f.message || r?.message });
    }
    run({ type: 'command', command: { type: kind, payload } }, 'Moment live on screen');
  }
  return (
    <Panel title="Event moments" icon={<Sparkles className="h-4 w-4 text-magenta" />}>
      <div className="grid grid-cols-4 gap-2">
        {cards.map((c) => (
          <button
            key={c.k}
            onClick={() => setKind(c.k)}
            className={cn(
              'flex flex-col items-center gap-1.5 rounded-2xl border bg-gradient-to-b to-transparent p-3 text-xs font-semibold transition',
              c.tint,
              kind === c.k ? 'border-white/30' : 'border-white/[0.06] opacity-70 hover:opacity-100',
            )}
          >
            {c.icon}
            {c.label}
          </button>
        ))}
      </div>
      <div className="mt-4 space-y-2.5">
        {kind === 'hype' && <input className="field py-2.5 text-sm" placeholder="LET'S MAKE SOME NOISE!" value={f.message} onChange={set('message')} />}
        {kind === 'birthday' && (
          <>
            <input className="field py-2.5 text-sm" placeholder="Birthday star's name" value={f.name} onChange={set('name')} />
            <input className="field py-2.5 text-sm" placeholder="Personal message (optional)" value={f.message} onChange={set('message')} />
          </>
        )}
        {kind === 'surprise' && (
          <>
            <input className="field py-2.5 text-sm" placeholder="Headline (e.g. SURPRISE!)" value={f.title} onChange={set('title')} />
            <input className="field py-2.5 text-sm" placeholder="The reveal message" value={f.message} onChange={set('message')} />
          </>
        )}
        {kind === 'dedication' && (
          <>
            <select className="field py-2.5 text-sm" value={f.requestId} onChange={set('requestId')}>
              <option value="">Pick a song…</option>
              {songs.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.songTitle} — {r.artist} ({r.guestName})
                </option>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <input className="field py-2.5 text-sm" placeholder="Dedicated by" value={f.from} onChange={set('from')} />
              <input className="field py-2.5 text-sm" placeholder="Dedicated to" value={f.to} onChange={set('to')} />
            </div>
            <input className="field py-2.5 text-sm" placeholder="Personal message (optional)" value={f.message} onChange={set('message')} />
          </>
        )}
        <button className="btn-primary w-full py-3" onClick={fire}>
          <Zap className="h-4 w-4" /> Launch {kind} moment
        </button>
      </div>
    </Panel>
  );
}

/* =============================================================== VOTING */
export function VotingPanel({ snap, run }: { snap: EventSnapshot; run: Run }) {
  const { confirm } = useUI();
  const s = snap.settings;
  const top = trendingOf(snap.requests);
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const [secs, setSecs] = useState(60);
  const now = useNow(1000);
  const battle = snap.battle;
  const live = battle?.status === 'live' && new Date(battle.endsAt).getTime() > now;
  const pickTop2 = () => {
    setA(top[0]?.id ?? '');
    setB(top[1]?.id ?? '');
  };
  return (
    <Panel title="The crowd chooses" icon={<Swords className="h-4 w-4 text-cyan" />}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn('chip', s.votingEnabled ? 'border-emerald-400/30 text-emerald-300' : 'text-white/50')}>
          {s.votingEnabled ? 'Voting open' : 'Voting closed'} · Round {s.votingRound}
        </span>
        <button className="btn-ghost px-3 py-1.5 text-sm" onClick={() => run({ type: 'updateSettings', patch: { votingEnabled: !s.votingEnabled } }, s.votingEnabled ? 'Voting ended' : 'Voting enabled')}>
          {s.votingEnabled ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          {s.votingEnabled ? 'End voting' : 'Enable voting'}
        </button>
        <button
          className="btn-ghost px-3 py-1.5 text-sm"
          onClick={async () => {
            if (await confirm({ title: `Start round ${s.votingRound + 1}?`, body: 'All vote counts reset to zero and every guest can vote again.', confirmText: 'New round' }))
              run({ type: 'newRound' }, 'New voting round started');
          }}
        >
          <RotateCcw className="h-4 w-4" /> New round
        </button>
        <button
          className="btn-danger px-3 py-1.5 text-sm"
          onClick={async () => {
            if (await confirm({ title: 'Reset all voting rounds?', body: 'Deletes every round vote and returns to round 1.', confirmText: 'Reset', danger: true }))
              run({ type: 'resetRounds' }, 'Voting reset');
          }}
        >
          Reset rounds
        </button>
      </div>

      <div className="mt-5 rounded-2xl border border-white/[0.07] bg-white/[0.02] p-4">
        <div className="flex items-center justify-between">
          <div className="text-sm font-bold">Voting battle</div>
          <button className="text-xs font-semibold text-cyan" onClick={pickTop2}>
            Use top 2
          </button>
        </div>
        {live ? (
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="text-sm text-white/70">
              Battle live — {Math.max(0, Math.ceil((new Date(battle!.endsAt).getTime() - now) / 1000))}s left ·{' '}
              {battle!.requestIds.map((id) => battle!.tallies[id] ?? 0).join(' vs ')}
            </div>
            <button className="btn-danger px-3 py-1.5 text-sm" onClick={() => run({ type: 'endBattle' }, 'Winner revealed')}>
              End & reveal winner
            </button>
          </div>
        ) : (
          <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_100px_auto]">
            {[
              [a, setA],
              [b, setB],
            ].map(([v, setV], i) => (
              <select key={i} className="field py-2.5 text-sm" value={v as string} onChange={(e) => (setV as (x: string) => void)(e.target.value)}>
                <option value="">Song {i + 1}…</option>
                {top.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.songTitle} ({r.voteCount})
                  </option>
                ))}
              </select>
            ))}
            <input type="number" min={10} max={600} className="field py-2.5 text-sm" value={secs} onChange={(e) => setSecs(Number(e.target.value))} aria-label="Seconds" />
            <button className="btn-primary px-4 py-2.5 text-sm" disabled={!a || !b || a === b} onClick={() => run({ type: 'startBattle', a, b, seconds: secs }, 'Battle is live!')}>
              <Swords className="h-4 w-4" /> Start
            </button>
          </div>
        )}
        {battle && !live && (
          <button className="mt-2 text-xs text-white/50 hover:text-white" onClick={() => run({ type: 'clearBattle' })}>
            Hide last battle result
          </button>
        )}
      </div>
    </Panel>
  );
}

/* =============================================================== EVENT CONTROLS */
export function EventControls({ snap, run }: { snap: EventSnapshot; run: Run }) {
  const { confirm } = useUI();
  const s = snap.settings;
  return (
    <Panel title="Event controls" icon={<Sparkles className="h-4 w-4 text-primary" />}>
      <div className="divide-y divide-white/[0.06]">
        <Toggle label="Accept requests" hint={s.submissionsEnabled ? 'Guests can submit songs' : 'Submissions paused'} checked={s.submissionsEnabled} onChange={(v) => run({ type: 'updateSettings', patch: { submissionsEnabled: v } }, v ? 'Requests resumed' : 'Requests paused')} />
        <Toggle label="Voting" checked={s.votingEnabled} onChange={(v) => run({ type: 'updateSettings', patch: { votingEnabled: v } })} />
        <Toggle label="Auto-approve" hint="Skip moderation — requests go straight to the queue" checked={s.autoApprove} onChange={(v) => run({ type: 'updateSettings', patch: { autoApprove: v } })} />
        <Toggle label="Sound effects" hint="Plays on the display (click “Enable sound” there once)" checked={s.soundEnabled} onChange={(v) => run({ type: 'updateSettings', patch: { soundEnabled: v } })} />
        <div className="flex items-center gap-4 py-3">
          <span className="text-sm font-medium text-white/90">Volume</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={s.volume}
            onChange={(e) => run({ type: 'updateSettings', patch: { volume: Number(e.target.value) } })}
            className="flex-1 accent-[rgb(var(--c-primary))]"
          />
          <span className="w-10 text-right text-sm tabular-nums text-white/60">{Math.round(s.volume * 100)}%</span>
        </div>
        <div className="flex items-center justify-between gap-4 py-3">
          <span className="text-sm font-medium text-white/90">Animation intensity</span>
          <Segmented
            value={s.animationIntensity}
            onChange={(v) => run({ type: 'updateSettings', patch: { animationIntensity: v } })}
            options={[
              { value: 'low', label: 'Low' },
              { value: 'normal', label: 'Normal' },
              { value: 'high', label: 'High' },
            ]}
          />
        </div>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          className="btn-danger py-2.5 text-sm"
          onClick={async () => {
            if (await confirm({ title: 'Clear the queue?', body: 'Removes all pending and approved requests. Played history stays.', confirmText: 'Clear queue', danger: true }))
              run({ type: 'clearQueue' }, 'Queue cleared');
          }}
        >
          <Trash2 className="h-4 w-4" /> Clear queue
        </button>
        <button
          className="btn-danger py-2.5 text-sm"
          onClick={async () => {
            if (await confirm({ title: 'Reset the entire event?', body: 'Deletes every request, vote, guest and moment. Settings and branding are kept. This cannot be undone.', confirmText: 'Reset event', danger: true }))
              run({ type: 'resetEvent' }, 'Event reset');
          }}
        >
          <RotateCcw className="h-4 w-4" /> Reset event
        </button>
      </div>
    </Panel>
  );
}
