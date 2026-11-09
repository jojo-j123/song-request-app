import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  ChevronUp,
  Crown,
  Flame,
  Heart,
  Music2,
  PauseCircle,
  PenLine,
  Search,
  Sparkles,
  Swords,
  X,
} from 'lucide-react';
import { useEventSnapshot, useNow } from '@/hooks/useEvent';
import { Atmosphere, Confetti } from '@/components/fx';
import { Artwork, ConnectionBadge, CountUp, Equalizer, EventLogo, FullScreenMessage, Spinner, useUI } from '@/components/ui';
import { addMyRequest, addMyVote, getGuestId, getGuestName, getMyRequests, getMyVotes, setGuestName } from '@/lib/identity';
import { searchSongs, type TrackResult } from '@/lib/itunes';
import { leaderOf, nowPlayingOf, recentOf, trendingOf } from '@/lib/selectors';
import type { ActionResult, Battle, EventSnapshot, SongRequest } from '@/lib/types';
import type { Backend } from '@/lib/backend';
import { cn, sleep, uid } from '@/lib/utils';

type Tab = 'request' | 'vote';

export default function Guest() {
  const { eventId = '' } = useParams();
  const { backend, snap, status } = useEventSnapshot(eventId);
  const [tab, setTab] = useState<Tab>('request');
  const guestId = useMemo(getGuestId, []);

  useEffect(() => {
    if (backend && snap) backend.registerGuest(eventId, guestId).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backend, !!snap, eventId, guestId]);

  if (snap === undefined)
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-ink">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  if (snap === null)
    return (
      <FullScreenMessage title="Event not found">
        Double-check the QR code or link. If you're testing locally, open the guest page on the same device as the
        organizer.
      </FullScreenMessage>
    );

  const approvedCount = snap.requests.filter((r) => r.status === 'approved').length;

  return (
    <div className="relative min-h-[100dvh] overflow-x-hidden bg-ink" data-intensity={snap.settings.animationIntensity}>
      <div className="fixed inset-0">
        <Atmosphere theme={snap.event.theme.background} density={0.6} waves={false} grain={false} />
      </div>
      <div className="relative z-10 mx-auto flex min-h-[100dvh] max-w-md flex-col px-5 pb-10 pt-[max(1rem,env(safe-area-inset-top))]">
        <header className="flex items-center justify-between py-3">
          <div className="flex min-w-0 items-center gap-3">
            <EventLogo name={snap.event.name} logoUrl={snap.event.logoUrl} size={36} />
            <div className="min-w-0">
              <div className="truncate font-display text-sm font-bold">{snap.event.name}</div>
              <div className="text-[11px] uppercase tracking-[0.2em] text-white/45">Live requests</div>
            </div>
          </div>
          {status !== 'live' && <ConnectionBadge status={status} />}
        </header>

        <nav className="sticky top-2 z-20 mt-2 grid grid-cols-2 rounded-2xl border border-white/10 bg-ink/70 p-1 backdrop-blur-xl">
          {(['request', 'vote'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn('relative rounded-xl py-2.5 text-sm font-bold transition-colors', tab === t ? 'text-white' : 'text-white/50')}
            >
              {tab === t && (
                <motion.span layoutId="guest-tab" className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary to-magenta shadow-glow" />
              )}
              <span className="relative z-10 inline-flex items-center gap-2">
                {t === 'request' ? <Music2 className="h-4 w-4" /> : <Flame className="h-4 w-4" />}
                {t === 'request' ? 'Request' : 'Vote'}
                {t === 'vote' && approvedCount > 0 && (
                  <span className="rounded-full bg-white/20 px-1.5 text-[11px]">{approvedCount}</span>
                )}
                {t === 'vote' && snap.battle?.status === 'live' && <span className="h-2 w-2 animate-pulse rounded-full bg-cyan" />}
              </span>
            </button>
          ))}
        </nav>

        <AnimatePresence mode="wait">
          {tab === 'request' ? (
            <motion.div key="req" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
              <RequestFlow backend={backend!} snap={snap} guestId={guestId} onGoVote={() => setTab('vote')} />
            </motion.div>
          ) : (
            <motion.div key="vote" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }}>
              <Community backend={backend!} snap={snap} guestId={guestId} />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ================================================================ REQUEST */
function RequestFlow({
  backend,
  snap,
  guestId,
  onGoVote,
}: {
  backend: Backend;
  snap: EventSnapshot;
  guestId: string;
  onGoVote: () => void;
}) {
  const { toast } = useUI();
  const eventId = snap.event.id;
  const [name, setName] = useState(getGuestName);
  const [editingName, setEditingName] = useState(!getGuestName());
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TrackResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchFailed, setSearchFailed] = useState(false);
  const [selected, setSelected] = useState<TrackResult | null>(null);
  const [manual, setManual] = useState(false);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [dedicate, setDedicate] = useState(false);
  const [dedicatedTo, setDedicatedTo] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<SongRequest | null>(null);
  const [dupe, setDupe] = useState<SongRequest | null>(null);
  const clientId = useRef(uid());

  useEffect(() => {
    if (manual || selected) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const ctrl = new AbortController();
    setSearching(true);
    const t = setTimeout(() => {
      searchSongs(q, ctrl.signal)
        .then((r) => {
          setResults(r);
          setSearchFailed(false);
        })
        .catch((e) => {
          if (e.name !== 'AbortError') setSearchFailed(true);
        })
        .finally(() => setSearching(false));
    }, 280);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, manual, selected]);

  const songTitle = selected?.title ?? title;
  const songArtist = selected?.artist ?? artist;
  const canSubmit = name.trim() && songTitle.trim() && songArtist.trim() && !submitting;

  const mine = useMemo(() => getMyRequests(eventId), [eventId, success]);
  const myCount = snap.requests.filter((r) => mine.includes(r.id) && r.status !== 'rejected').length;

  async function submit() {
    if (!canSubmit) return;
    setGuestName(name);
    setEditingName(false);
    setSubmitting(true);
    setDupe(null);
    let res: ActionResult<any> | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      res = await backend
        .submitRequest(eventId, {
          guestId,
          guestName: name,
          songTitle,
          artist: songArtist,
          artworkUrl: selected?.artworkUrl ?? null,
          clientId: clientId.current,
          dedicatedTo: dedicate ? dedicatedTo : null,
          message: dedicate ? message : null,
        })
        .catch((): ActionResult<any> => ({ ok: false, code: 'network', message: 'Connection problem.' }));
      if (res.code !== 'network') break;
      await sleep(800 * (attempt + 1));
    }
    setSubmitting(false);
    if (!res) return;
    if (res.ok) {
      addMyRequest(eventId, (res.data as SongRequest).id);
      setSuccess(res.data as SongRequest);
      clientId.current = uid();
      if (navigator.vibrate) navigator.vibrate([30, 40, 60]);
    } else if (res.code === 'duplicate_song' && res.data) {
      setDupe(res.data as SongRequest);
    } else {
      toast(res.message ?? 'Something went wrong. Try again.', 'error');
    }
  }

  async function voteDupe() {
    if (!dupe) return;
    const ctx = `round:${snap.settings.votingRound}`;
    const r = await backend.castVote(eventId, dupe.id, guestId);
    if (r.ok || r.code === 'already_voted') {
      addMyVote(eventId, ctx, dupe.id);
      toast(r.ok ? 'Vote added — push it up!' : 'You already voted for it.');
      onGoVote();
    } else toast(r.message ?? 'Could not vote.', 'error');
    setDupe(null);
  }

  function reset() {
    setSuccess(null);
    setSelected(null);
    setQuery('');
    setTitle('');
    setArtist('');
    setDedicate(false);
    setDedicatedTo('');
    setMessage('');
    setManual(false);
  }

  if (success) return <SuccessCard req={success} snap={snap} onAgain={reset} onVote={onGoVote} />;

  const closed = !snap.settings.submissionsEnabled || snap.event.status === 'ended';
  const limitReached = myCount >= snap.settings.maxRequestsPerGuest;

  return (
    <div className="pt-8">
      <motion.h1
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: [0.2, 0.8, 0.2, 1] }}
        className="font-display text-[44px] font-black leading-[0.95] tracking-tight"
      >
        TONIGHT
        <br />
        IS <span className="text-gradient-anim glow-text">YOURS.</span>
      </motion.h1>
      <p className="mt-3 text-lg text-white/60">What's your soundtrack tonight?</p>

      {closed ? (
        <div className="glass mt-8 rounded-3xl p-6 text-center">
          <PauseCircle className="mx-auto h-10 w-10 text-white/50" />
          <h3 className="mt-3 font-display text-lg font-bold">Requests are paused</h3>
          <p className="mt-1 text-sm text-white/55">The DJ will reopen requests soon. Meanwhile, vote for your favourites!</p>
          <button onClick={onGoVote} className="btn-primary mt-5 w-full py-3.5">
            Vote now <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <div className="mt-8 space-y-4">
          {/* name */}
          {editingName ? (
            <div>
              <label className="label" htmlFor="gname">Your name</label>
              <input
                id="gname"
                className="field"
                placeholder="So the crowd knows who to thank"
                autoComplete="given-name"
                maxLength={40}
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && name.trim() && setEditingName(false)}
              />
            </div>
          ) : (
            <button
              onClick={() => setEditingName(true)}
              className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left"
            >
              <span className="text-sm text-white/55">
                Requesting as <span className="font-bold text-white">{name}</span>
              </span>
              <PenLine className="h-4 w-4 text-white/40" />
            </button>
          )}

          {/* song */}
          {selected ? (
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="neon-border glass flex items-center gap-4 rounded-3xl p-3"
            >
              <Artwork url={selected.artworkUrl} seed={selected.title} className="h-16 w-16" />
              <div className="min-w-0 flex-1">
                <div className="truncate font-bold">{selected.title}</div>
                <div className="truncate text-sm text-white/55">{selected.artist}</div>
              </div>
              <button onClick={() => setSelected(null)} className="rounded-full p-2 text-white/50 hover:bg-white/10" aria-label="Change song">
                <X className="h-5 w-5" />
              </button>
            </motion.div>
          ) : manual ? (
            <div className="space-y-3">
              <div>
                <label className="label" htmlFor="title">Song title</label>
                <input id="title" className="field" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Blinding Lights" />
              </div>
              <div>
                <label className="label" htmlFor="artist">Artist</label>
                <input id="artist" className="field" maxLength={100} value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="e.g. The Weeknd" />
              </div>
              <button onClick={() => setManual(false)} className="text-sm font-semibold text-cyan">
                ← Back to search
              </button>
            </div>
          ) : (
            <div>
              <label className="label" htmlFor="search">Find your song</label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40" />
                <input
                  id="search"
                  className="field pl-12"
                  placeholder="Song or artist"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoComplete="off"
                  enterKeyHint="search"
                />
                {searching && <Spinner className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />}
              </div>
              <AnimatePresence>
                {results.length > 0 && (
                  <motion.ul
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="glass-strong mt-2 max-h-[46vh] overflow-y-auto rounded-3xl p-1.5"
                  >
                    {results.map((r, i) => (
                      <motion.li key={r.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.025 }}>
                        <button
                          onClick={() => {
                            setSelected(r);
                            setResults([]);
                          }}
                          className="flex w-full items-center gap-3 rounded-2xl p-2 text-left transition active:bg-white/10 hover:bg-white/[0.06]"
                        >
                          <Artwork url={r.artworkUrl?.replace('600x600', '100x100')} seed={r.title} className="h-12 w-12" rounded="rounded-xl" />
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-[15px] font-semibold">{r.title}</div>
                            <div className="truncate text-xs text-white/50">{r.artist}</div>
                          </div>
                        </button>
                      </motion.li>
                    ))}
                  </motion.ul>
                )}
              </AnimatePresence>
              {searchFailed && <p className="mt-2 text-xs text-amber-200/80">Search is unavailable right now — enter it manually.</p>}
              <button
                onClick={() => {
                  setManual(true);
                  if (query && !title) setTitle(query);
                }}
                className="mt-3 text-sm font-semibold text-white/60 underline decoration-white/20 underline-offset-4"
              >
                Can't find it? Type it in
              </button>
            </div>
          )}

          {/* dedication */}
          <div>
            <button
              onClick={() => setDedicate((d) => !d)}
              className={cn('chip py-1.5', dedicate && 'border-magenta/50 bg-magenta/15 text-white')}
            >
              <Heart className={cn('h-3.5 w-3.5', dedicate && 'fill-magenta text-magenta')} /> Dedicate it to someone
            </button>
            <AnimatePresence>
              {dedicate && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="space-y-3 pt-3">
                    <input className="field" maxLength={40} placeholder="Dedicated to…" value={dedicatedTo} onChange={(e) => setDedicatedTo(e.target.value)} />
                    <input className="field" maxLength={200} placeholder="Short message (optional)" value={message} onChange={(e) => setMessage(e.target.value)} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <AnimatePresence>
            {dupe && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-3xl border border-cyan/30 bg-cyan/10 p-4"
              >
                <div className="text-sm font-semibold">"{dupe.songTitle}" is already on the list!</div>
                <div className="mt-1 text-xs text-white/60">Requested by {dupe.guestName}. Give it your vote to push it up.</div>
                <button onClick={voteDupe} className="btn-primary mt-3 w-full py-3">
                  <ChevronUp className="h-4 w-4" /> Vote for it
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <button onClick={submit} disabled={!canSubmit || limitReached} className="btn-primary mt-2 w-full py-[18px] font-display text-base tracking-wider">
            {submitting ? <Spinner /> : limitReached ? 'REQUEST LIMIT REACHED' : 'MAKE YOUR REQUEST'}
          </button>
          <p className="text-center text-xs text-white/40">
            {Math.max(0, snap.settings.maxRequestsPerGuest - myCount)} of {snap.settings.maxRequestsPerGuest} requests left
          </p>
        </div>
      )}
      <MyRequests snap={snap} />
    </div>
  );
}

function SuccessCard({ req, snap, onAgain, onVote }: { req: SongRequest; snap: EventSnapshot; onAgain: () => void; onVote: () => void }) {
  const live = snap.requests.find((r) => r.id === req.id) ?? req;
  return (
    <div className="relative pt-8 text-center">
      <div className="pointer-events-none fixed inset-0 z-0">
        <Confetti burstKey={req.id} count={120} />
      </div>
      <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 15 }}>
        <div className="relative mx-auto grid h-28 w-28 place-items-center">
          {[0, 1, 2].map((i) => (
            <motion.span
              key={i}
              className="absolute inset-0 rounded-full border-2 border-magenta/60"
              initial={{ scale: 0.6, opacity: 0.8 }}
              animate={{ scale: 2, opacity: 0 }}
              transition={{ duration: 2.2, repeat: Infinity, delay: i * 0.7 }}
            />
          ))}
          <div className="grid h-24 w-24 place-items-center rounded-full bg-gradient-to-br from-primary via-magenta to-cyan shadow-glow-lg">
            <Equalizer bars={5} className="h-10" barClass="w-2 !bg-white" />
          </div>
        </div>
      </motion.div>
      <motion.h2
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.25 }}
        className="mt-8 font-display text-[34px] font-black leading-[1] tracking-tight"
      >
        YOUR SONG IS
        <br />
        <span className="text-gradient-anim glow-text">ON THE LIST!</span>
      </motion.h2>
      <motion.div
        initial={{ y: 30, opacity: 0, rotateX: 30 }}
        animate={{ y: 0, opacity: 1, rotateX: 0 }}
        transition={{ delay: 0.45, type: 'spring', stiffness: 120 }}
        className="neon-border glass relative z-10 mx-auto mt-8 flex items-center gap-4 rounded-3xl p-4 text-left"
      >
        <Artwork url={live.artworkUrl} seed={live.songTitle} className="h-20 w-20" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-lg font-bold">{live.songTitle}</div>
          <div className="truncate text-white/60">{live.artist}</div>
          <div className="mt-1 text-xs text-white/45">
            Requested by <span className="font-semibold text-white/80">{live.guestName}</span>
          </div>
        </div>
      </motion.div>
      <StatusLine status={live.status} />
      <div className="relative z-10 mt-8 space-y-3">
        <button onClick={onAgain} className="btn-primary w-full py-4 font-display tracking-wider">
          REQUEST ANOTHER SONG
        </button>
        <button onClick={onVote} className="btn-ghost w-full py-3.5">
          <Flame className="h-4 w-4" /> Vote for the crowd's picks
        </button>
      </div>
    </div>
  );
}

function StatusLine({ status }: { status: SongRequest['status'] }) {
  const map: Record<SongRequest['status'], [string, string]> = {
    pending: ['Waiting for the DJ to approve', 'text-amber-200'],
    approved: ['Approved — it\'s in the queue!', 'text-emerald-300'],
    playing: ['NOW PLAYING — this one\'s yours!', 'text-cyan'],
    played: ['Played. You made the night!', 'text-magenta'],
    rejected: ['The DJ passed on this one', 'text-white/50'],
    skipped: ['Skipped this time', 'text-white/50'],
  };
  const [text, cls] = map[status];
  return (
    <motion.div key={status} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={cn('relative z-10 mt-4 text-sm font-semibold', cls)}>
      {text}
    </motion.div>
  );
}

function MyRequests({ snap }: { snap: EventSnapshot }) {
  const ids = getMyRequests(snap.event.id);
  const mine = snap.requests.filter((r) => ids.includes(r.id)).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));
  if (!mine.length) return null;
  const label: Record<SongRequest['status'], string> = {
    pending: 'Pending',
    approved: 'In queue',
    playing: 'Playing',
    played: 'Played',
    rejected: 'Passed',
    skipped: 'Skipped',
  };
  return (
    <div className="mt-10">
      <div className="eyebrow mb-3">Your requests</div>
      <div className="space-y-2">
        {mine.map((r) => (
          <div key={r.id} className="flex items-center gap-3 rounded-2xl border border-white/5 bg-white/[0.03] p-2.5">
            <Artwork url={r.artworkUrl} seed={r.songTitle} className="h-10 w-10" rounded="rounded-xl" />
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">{r.songTitle}</div>
              <div className="truncate text-xs text-white/45">{r.artist}</div>
            </div>
            <span
              className={cn(
                'chip',
                r.status === 'playing' && 'border-cyan/40 text-cyan',
                r.status === 'approved' && 'border-emerald-400/30 text-emerald-300',
                r.status === 'played' && 'border-magenta/40 text-magenta',
              )}
            >
              {label[r.status]}
              {r.status === 'approved' && ` · ${r.voteCount}♥`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ============================================================== COMMUNITY */
function Community({ backend, snap, guestId }: { backend: Backend; snap: EventSnapshot; guestId: string }) {
  const { toast } = useUI();
  const eventId = snap.event.id;
  const ctx = `round:${snap.settings.votingRound}`;
  const [voted, setVoted] = useState(() => getMyVotes(eventId, ctx));
  const [busy, setBusy] = useState<string | null>(null);
  const [view, setView] = useState<'trending' | 'recent'>('trending');
  useEffect(() => setVoted(getMyVotes(eventId, ctx)), [eventId, ctx]);

  const trending = trendingOf(snap.requests);
  const recent = recentOf(snap.requests);
  const leader = leaderOf(snap.requests);
  const playing = nowPlayingOf(snap.requests);
  const list = view === 'trending' ? trending : recent;
  const votingOpen = snap.settings.votingEnabled;

  async function vote(r: SongRequest) {
    if (voted.has(r.id) || busy) return;
    setBusy(r.id);
    setVoted((v) => new Set(v).add(r.id)); // optimistic
    const res = await backend.castVote(eventId, r.id, guestId).catch(() => ({ ok: false, code: 'network', message: 'Connection problem.' }) as const);
    setBusy(null);
    if (res.ok || res.code === 'already_voted') {
      setVoted(addMyVote(eventId, ctx, r.id));
      if (navigator.vibrate) navigator.vibrate(15);
    } else {
      setVoted((v) => {
        const n = new Set(v);
        n.delete(r.id);
        return n;
      });
      toast(res.message ?? 'Could not vote.', 'error');
    }
  }

  return (
    <div className="space-y-6 pt-6">
      {snap.battle && <BattleCard backend={backend} snap={snap} battle={snap.battle} guestId={guestId} />}

      {playing && (
        <div className="flex items-center gap-3 rounded-3xl border border-cyan/20 bg-cyan/[0.06] p-3">
          <Artwork url={playing.artworkUrl} seed={playing.songTitle} className="h-12 w-12" rounded="rounded-xl" />
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-cyan">Now playing</div>
            <div className="truncate font-semibold">{playing.songTitle}</div>
            <div className="truncate text-xs text-white/50">{playing.artist} · for {playing.guestName}</div>
          </div>
          <Equalizer bars={4} className="h-5" barClass="w-1" />
        </div>
      )}

      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-black">The crowd chooses</h2>
        <span className={cn('chip', votingOpen ? 'border-emerald-400/30 text-emerald-300' : 'text-white/50')}>
          <span className={cn('h-1.5 w-1.5 rounded-full', votingOpen ? 'bg-emerald-400' : 'bg-white/40')} />
          {votingOpen ? 'Voting open' : 'Voting closed'}
        </span>
      </div>

      {leader && (
        <motion.div layout className="neon-border relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/25 via-magenta/15 to-transparent p-4">
          <div className="flex items-center gap-4">
            <Artwork url={leader.artworkUrl} seed={leader.songTitle} className="h-20 w-20" />
            <div className="min-w-0 flex-1">
              <div className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-[0.25em] text-amber-300">
                <Crown className="h-3.5 w-3.5" /> Most voted
              </div>
              <div className="truncate text-lg font-bold">{leader.songTitle}</div>
              <div className="truncate text-sm text-white/55">{leader.artist}</div>
            </div>
            <VoteButton count={leader.voteCount} voted={voted.has(leader.id)} disabled={!votingOpen} onClick={() => vote(leader)} big />
          </div>
        </motion.div>
      )}

      <div className="flex gap-2">
        {(['trending', 'recent'] as const).map((v) => (
          <button key={v} onClick={() => setView(v)} className={cn('chip py-1.5 capitalize', view === v && 'border-primary/60 bg-primary/20 text-white')}>
            {v === 'trending' ? <Flame className="h-3.5 w-3.5" /> : <Sparkles className="h-3.5 w-3.5" />} {v}
          </button>
        ))}
      </div>

      {list.length === 0 ? (
        <div className="glass rounded-3xl p-8 text-center text-white/55">
          <Music2 className="mx-auto mb-3 h-8 w-8 text-white/30" />
          No approved requests yet. Be the first!
        </div>
      ) : (
        <motion.ul layout className="space-y-2">
          <AnimatePresence initial={false}>
            {list.map((r, i) => (
              <motion.li
                layout
                key={r.id}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                className="flex items-center gap-3 rounded-2xl border border-white/[0.06] bg-white/[0.03] p-2.5"
              >
                {view === 'trending' && <span className="w-5 text-center font-display text-sm font-bold text-white/35">{i + 1}</span>}
                <Artwork url={r.artworkUrl} seed={r.songTitle} className="h-12 w-12" rounded="rounded-xl" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-semibold">{r.songTitle}</div>
                  <div className="truncate text-xs text-white/50">
                    {r.artist}
                    {snap.settings.showRequesterNames && <> · {r.guestName}</>}
                  </div>
                </div>
                <VoteButton count={r.voteCount} voted={voted.has(r.id)} disabled={!votingOpen} onClick={() => vote(r)} />
              </motion.li>
            ))}
          </AnimatePresence>
        </motion.ul>
      )}
    </div>
  );
}

function VoteButton({ count, voted, disabled, onClick, big }: { count: number; voted: boolean; disabled?: boolean; onClick: () => void; big?: boolean }) {
  return (
    <motion.button
      whileTap={{ scale: 0.85 }}
      onClick={onClick}
      disabled={disabled && !voted}
      aria-pressed={voted}
      aria-label={voted ? 'Voted' : 'Vote'}
      className={cn(
        'flex shrink-0 flex-col items-center justify-center rounded-2xl border font-bold transition-colors disabled:opacity-40',
        big ? 'h-16 w-14' : 'h-12 w-12',
        voted ? 'border-magenta/60 bg-gradient-to-b from-magenta/40 to-primary/30 text-white shadow-glow' : 'border-white/10 bg-white/[0.05] text-white/80',
      )}
    >
      {voted ? <Check className="h-4 w-4" /> : <ChevronUp className="h-5 w-5" />}
      <CountUp value={count} className="text-xs tabular-nums" />
    </motion.button>
  );
}

function BattleCard({ backend, snap, battle, guestId }: { backend: Backend; snap: EventSnapshot; battle: Battle; guestId: string }) {
  const { toast } = useUI();
  const now = useNow(500);
  const ctx = `battle:${battle.id}`;
  const [mine, setMine] = useState<string | null>(() => [...getMyVotes(snap.event.id, ctx)][0] ?? null);
  const left = Math.max(0, Math.ceil((new Date(battle.endsAt).getTime() - now) / 1000));
  const ended = battle.status === 'ended' || left === 0;
  const songs = battle.requestIds.map((id) => snap.requests.find((r) => r.id === id)).filter(Boolean) as SongRequest[];
  const total = battle.requestIds.reduce((s, id) => s + (battle.tallies[id] ?? 0), 0) || 1;
  if (songs.length < 2) return null;

  async function pick(id: string) {
    if (mine || ended) return;
    setMine(id);
    const r = await backend.castVote(snap.event.id, id, guestId, battle.id);
    if (r.ok || r.code === 'already_voted') addMyVote(snap.event.id, ctx, id);
    else {
      setMine(null);
      toast(r.message ?? 'Could not vote', 'error');
    }
  }

  return (
    <div className="neon-border relative overflow-hidden rounded-3xl bg-ink-2/80 p-4">
      <div className="flex items-center justify-between">
        <div className="inline-flex items-center gap-2 font-display text-sm font-black tracking-wider text-cyan">
          <Swords className="h-4 w-4" /> CROWD VOTE
        </div>
        <span className="chip font-mono tabular-nums">{ended ? 'Ended' : `${left}s`}</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3">
        {songs.map((s) => {
          const pct = Math.round(((battle.tallies[s.id] ?? 0) / total) * 100);
          const isWinner = ended && (battle.winnerId ?? '') === s.id;
          return (
            <button
              key={s.id}
              onClick={() => pick(s.id)}
              disabled={!!mine || ended}
              className={cn(
                'relative overflow-hidden rounded-2xl border p-2 text-left transition',
                mine === s.id ? 'border-magenta/70 bg-magenta/15' : 'border-white/10 bg-white/[0.04]',
                isWinner && 'border-amber-300/70',
              )}
            >
              <Artwork url={s.artworkUrl} seed={s.songTitle} className="aspect-square w-full" rounded="rounded-xl" />
              <div className="mt-2 truncate text-sm font-bold">{s.songTitle}</div>
              <div className="truncate text-xs text-white/50">{s.artist}</div>
              {(mine || ended) && (
                <div className="mt-2">
                  <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                    <motion.div className="h-full bg-gradient-to-r from-primary to-magenta" animate={{ width: `${pct}%` }} />
                  </div>
                  <div className="mt-1 text-xs font-bold tabular-nums">{pct}%</div>
                </div>
              )}
              {isWinner && <Crown className="absolute right-3 top-3 h-6 w-6 text-amber-300 drop-shadow" />}
            </button>
          );
        })}
      </div>
      {!mine && !ended && <p className="mt-3 text-center text-xs text-white/55">Tap your pick — one vote per guest.</p>}
    </div>
  );
}
