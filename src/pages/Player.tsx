/**
 * JUKEBOX — runs on the laptop that is plugged into the speakers (AUX / headphone out).
 * Imports the organizer's audio files, publishes the song list for guests to request from, and
 * plays the files itself: the crowd's pick next, with the big-screen countdown in sync.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  FolderOpen,
  LayoutDashboard,
  ListMusic,
  Monitor,
  Music2,
  Pause,
  Play,
  Search,
  SkipForward,
  Trash2,
  Upload,
  Volume2,
} from 'lucide-react';
import { useEventSnapshot } from '@/hooks/useEvent';
import { useEventHost } from '@/lib/demo/simulator';
import { nowPlayingOf, queueOf } from '@/lib/selectors';
import { clearFiles, deleteFile, formatDuration, importFiles, loadFile, storedKeys } from '@/lib/library';
import { cn } from '@/lib/utils';
import { Artwork, ConnectionBadge, FullScreenMessage, Segmented, Spinner, Toggle, useUI } from '@/components/ui';
import { AdminGate, useAdminActions } from '@/components/admin/common';
import type { EventSnapshot, LibraryTrack, SongRequest } from '@/lib/types';
import type { Backend } from '@/lib/backend';

export default function Player() {
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
        <PlayerInner backend={backend!} snap={snap} status={status} />
      )}
    </AdminGate>
  );
}

/** 0.05 s of silence (8 kHz mono WAV) used to unlock audio playback on the first click. */
const SILENCE = (() => {
  const n = 400;
  const b = new Uint8Array(44 + n);
  const v = new DataView(b.buffer);
  const str = (o: number, t: string) => [...t].forEach((c, i) => (b[o + i] = c.charCodeAt(0)));
  str(0, 'RIFF');
  v.setUint32(4, 36 + n, true);
  str(8, 'WAVEfmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, 8000, true);
  v.setUint32(28, 8000, true);
  v.setUint16(32, 1, true);
  v.setUint16(34, 8, true);
  str(36, 'data');
  v.setUint32(40, n, true);
  b.fill(128, 44);
  return URL.createObjectURL(new Blob([b], { type: 'audio/wav' }));
})();

/** Who plays next: top-voted (ties → oldest request) or the DJ's queue order. */
function upNext(snap: EventSnapshot, playable: (trackId: string | null) => boolean): SongRequest[] {
  const q = queueOf(snap.requests).filter((r) => playable(r.trackId));
  return snap.settings.jukebox.order === 'votes' ? [...q].sort((a, b) => b.voteCount - a.voteCount || a.queuePosition - b.queuePosition) : q;
}

function PlayerInner({ backend, snap, status }: { backend: Backend; snap: EventSnapshot; status: Parameters<typeof ConnectionBadge>[0]['status'] }) {
  const eventId = snap.event.id;
  const { toast, confirm } = useUI();
  const { run } = useAdminActions(backend, eventId);
  useEventHost(backend, snap, true);

  const [stored, setStored] = useState<Set<string>>(new Set());
  const [started, setStarted] = useState(false);
  const [paused, setPaused] = useState(false);
  const [pos, setPos] = useState({ t: 0, d: 0 });
  const [volume, setVolume] = useState(() => Number(localStorage.getItem('encore:player-volume') ?? 1));
  const [importing, setImporting] = useState<{ done: number; total: number } | null>(null);
  const [q, setQ] = useState('');

  const audio = useMemo(() => new Audio(), []);
  const snapRef = useRef(snap);
  snapRef.current = snap;
  const storedRef = useRef(stored);
  storedRef.current = stored;
  const busy = useRef(false);
  const loadedFor = useRef<string | null>(null);
  const urlRef = useRef<string | null>(null);
  const revealAt = useRef<{ id: string; at: number } | null>(null);

  const jb = snap.settings.jukebox;
  const playing = nowPlayingOf(snap.requests);
  const byId = useMemo(() => new Map(snap.library.map((t) => [t.id, t])), [snap.library]);
  const playable = useCallback(
    (trackId: string | null) => {
      const t = trackId ? byId.get(trackId) : undefined;
      return !!t && stored.has(t.fileKey);
    },
    [byId, stored],
  );
  const playableRef = useRef(playable);
  playableRef.current = playable;
  const queue = upNext(snap, playable);
  const missing = snap.library.filter((t) => !stored.has(t.fileKey)).length;

  useEffect(() => {
    storedKeys(eventId).then(setStored).catch(() => undefined);
  }, [eventId]);

  useEffect(() => {
    audio.volume = volume;
    localStorage.setItem('encore:player-volume', String(volume));
  }, [audio, volume]);

  /** Move on: next request → (optionally) a random library song → stop. */
  const advance = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    try {
      const s = snapRef.current;
      const cfg = s.settings.jukebox;
      const next = upNext(s, playableRef.current)[0];
      if (next) {
        if (cfg.reveal) revealAt.current = { id: next.id, at: Date.now() };
        await backend.admin(eventId, { type: cfg.reveal ? 'reveal' : 'playNow', id: next.id });
      } else if (cfg.fill) {
        const recent = new Set(
          s.requests
            .filter((r) => r.trackId && r.playedAt)
            .sort((a, b) => (b.playedAt ?? '').localeCompare(a.playedAt ?? ''))
            .slice(0, Math.min(12, Math.floor(s.library.length / 2)))
            .map((r) => r.trackId),
        );
        const pool = s.library.filter((t) => storedRef.current.has(t.fileKey));
        const fresh = pool.filter((t) => !recent.has(t.id));
        const pick = (fresh.length ? fresh : pool)[Math.floor(Math.random() * (fresh.length || pool.length))];
        if (pick) await backend.admin(eventId, { type: 'playTrack', trackId: pick.id });
        else if (nowPlayingOf(s.requests)) await backend.admin(eventId, { type: 'finishCurrent' });
      } else if (nowPlayingOf(s.requests)) {
        await backend.admin(eventId, { type: 'finishCurrent' });
      }
    } finally {
      setTimeout(() => (busy.current = false), 1500);
    }
  }, [backend, eventId]);

  // audio element wiring
  useEffect(() => {
    const onTime = () => setPos({ t: audio.currentTime, d: audio.duration || 0 });
    const onEnded = () => {
      if (audio.src !== SILENCE) advance();
    };
    const onPlay = () => setPaused(false);
    const onPause = () => setPaused(!audio.ended);
    const onError = () => {
      if (!audio.src || audio.src === SILENCE) return;
      toast('This file could not be played — skipping.', 'error');
      advance();
    };
    audio.addEventListener('timeupdate', onTime);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('error', onError);
    return () => {
      audio.removeEventListener('timeupdate', onTime);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('error', onError);
    };
  }, [audio, advance, toast]);
  useEffect(
    () => () => {
      audio.pause();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [audio],
  );

  // load + play whatever the event says is playing
  useEffect(() => {
    if (!started) return;
    if (!playing || !playing.trackId) {
      if (loadedFor.current) {
        audio.pause();
        loadedFor.current = null;
        setPos({ t: 0, d: 0 });
      }
      return;
    }
    if (loadedFor.current === playing.id) return;
    loadedFor.current = playing.id;
    const req = playing;
    const track = byId.get(req.trackId!);
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    (async () => {
      const blob = track ? await loadFile(eventId, track.fileKey).catch(() => undefined) : undefined;
      if (cancelled) return;
      if (!blob) {
        toast(`“${req.songTitle}” isn't on this laptop — skipping.`, 'error');
        timer = setTimeout(advance, 1500);
        return;
      }
      audio.pause();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = URL.createObjectURL(blob);
      audio.src = urlRef.current;
      // hold the first beat until the big-screen countdown hits zero
      const s = snapRef.current;
      const D = s.settings.countdownDuration;
      const cmd = s.command;
      let startAt = 0;
      if (cmd?.type === 'countdown' && cmd.payload.requestId === req.id) startAt = new Date(cmd.triggeredAt).getTime() + (1.6 + (Number(cmd.payload.duration) || D)) * 1000;
      else if (revealAt.current?.id === req.id) startAt = revealAt.current.at + (1.6 + D) * 1000 + 300;
      timer = setTimeout(() => audio.play().catch(() => setPaused(true)), Math.max(0, startAt - Date.now()));
    })();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, playing?.id, playing?.trackId]);

  // nothing playing? start the next one (a new request into an empty queue, or first start)
  useEffect(() => {
    if (!started) return;
    const t = setInterval(() => {
      const s = snapRef.current;
      if (nowPlayingOf(s.requests)) return;
      if (upNext(s, playableRef.current).length || (s.settings.jukebox.fill && s.library.some((x) => storedRef.current.has(x.fileKey)))) advance();
    }, 2000);
    return () => clearInterval(t);
  }, [started, advance]);

  async function onFiles(list: FileList | null) {
    const files = list ? [...list] : [];
    if (!files.length) return;
    setImporting({ done: 0, total: files.length });
    try {
      const { tracks, skipped } = await importFiles(eventId, files, (done, total) => setImporting({ done, total }));
      if (tracks.length) await run({ type: 'importTracks', tracks });
      setStored(await storedKeys(eventId));
      toast(tracks.length ? `${tracks.length} songs ready${skipped ? ` · ${skipped} non-audio files skipped` : ''}` : 'No audio files found in that selection', tracks.length ? 'ok' : 'error');
    } catch (e) {
      toast('Import failed: ' + String((e as Error)?.message ?? e), 'error');
    }
    setImporting(null);
  }

  function start() {
    // One click unlocks audio for this tab (Safari wants the element itself played inside the tap):
    // play a split-second of silence, then let the queue take over.
    audio.src = SILENCE;
    audio.play().catch(() => undefined);
    setStarted(true);
  }

  const shown = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = s ? snap.library.filter((t) => `${t.title} ${t.artist}`.toLowerCase().includes(s)) : snap.library;
    return [...list].sort((a, b) => a.artist.localeCompare(b.artist) || a.title.localeCompare(b.title)).slice(0, 300);
  }, [snap.library, q]);

  const playingIsLocal = !!playing?.trackId;

  return (
    <div className="min-h-screen bg-ink p-3 text-white lg:p-5">
      <header className="mb-4 flex flex-wrap items-center gap-3">
        <div className="font-display text-lg font-black">{snap.event.name}</div>
        <span className="chip border-magenta/40 text-pink-200">JUKEBOX</span>
        <ConnectionBadge status={status} />
        <div className="ml-auto flex flex-wrap gap-2">
          <a href={`/display/${eventId}`} target="_blank" rel="noreferrer" className="btn-ghost px-3 py-2 text-sm">
            <Monitor className="h-4 w-4" /> Open display
          </a>
          <Link to={`/admin/${eventId}`} className="btn-ghost px-3 py-2 text-sm">
            <LayoutDashboard className="h-4 w-4" /> Dashboard
          </Link>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="space-y-4">
          {/* transport */}
          <div className="neon-border rounded-3xl bg-gradient-to-br from-primary/15 via-magenta/10 to-transparent p-5">
            {!started ? (
              <div className="py-4 text-center">
                <button onClick={start} disabled={!snap.library.length} className="btn-primary w-full py-5 font-display text-lg tracking-wider">
                  <Play className="h-5 w-5" /> START JUKEBOX
                </button>
                <p className="mt-3 text-sm text-white/55">
                  {snap.library.length
                    ? 'Plug the speakers into this laptop, then start. Keep this tab open: it is the music player.'
                    : 'Import your songs first (right side).'}
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-[0.3em] text-cyan">Now playing</span>
                  <span className="chip border-emerald-400/30 text-emerald-300">Player running</span>
                </div>
                {playing ? (
                  <div className="mt-3 flex items-center gap-4">
                    <Artwork url={playing.artworkUrl} seed={playing.songTitle} label={playing.songTitle} className="h-24 w-24" />
                    <div className="min-w-0">
                      <div className="truncate text-2xl font-black">{playing.songTitle}</div>
                      <div className="truncate text-white/60">{playing.artist}</div>
                      <div className="mt-1 text-sm text-white/45">
                        {playing.guestId === 'house' ? 'House pick' : <>requested by <b className="text-white/80">{playing.guestName}</b></>}
                        {!playingIsLocal && ' · not in the library (play it yourself, then press Skip)'}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-6 text-center text-white/45">Waiting for the first request…</div>
                )}
                <div className="mt-4 flex items-center gap-3 text-xs tabular-nums text-white/55">
                  <span className="w-10 text-right">{formatDuration(pos.t)}</span>
                  <input
                    type="range"
                    min={0}
                    max={pos.d || 1}
                    step={1}
                    value={Math.min(pos.t, pos.d || 1)}
                    disabled={!playingIsLocal}
                    onChange={(e) => (audio.currentTime = Number(e.target.value))}
                    className="flex-1 accent-[rgb(var(--c-magenta))]"
                    aria-label="Seek"
                  />
                  <span className="w-10">{formatDuration(pos.d)}</span>
                </div>
                <div className="mt-3 grid grid-cols-[1fr_1fr_1.4fr] gap-2">
                  <button className="btn-ghost py-3.5" disabled={!playingIsLocal} onClick={() => (audio.paused ? audio.play() : audio.pause())}>
                    {paused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />} {paused ? 'Resume' : 'Pause'}
                  </button>
                  <button
                    className="btn-ghost py-3.5"
                    onClick={() => {
                      audio.pause();
                      advance();
                    }}
                  >
                    <SkipForward className="h-4 w-4" /> Skip
                  </button>
                  <label className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3">
                    <Volume2 className="h-4 w-4 shrink-0 text-white/60" />
                    <input type="range" min={0} max={1} step={0.02} value={volume} onChange={(e) => setVolume(Number(e.target.value))} className="w-full accent-[rgb(var(--c-primary))]" aria-label="Volume" />
                  </label>
                </div>
              </>
            )}
          </div>

          {/* rules */}
          <div className="rounded-3xl border border-white/[0.07] bg-ink-2/70 p-5">
            <div className="divide-y divide-white/[0.06]">
              <Toggle
                label="Jukebox mode"
                hint={jb.enabled ? 'Guests can only request songs from your library' : 'Off: guests search any song; only library songs play automatically'}
                checked={jb.enabled}
                onChange={(v) =>
                  // a curated library needs no moderation, so requests go straight to the queue
                  run({ type: 'updateSettings', patch: v ? { jukebox: { ...jb, enabled: true }, autoApprove: true } : { jukebox: { ...jb, enabled: false } } }, v ? 'Jukebox mode on — requests are auto-approved' : 'Jukebox mode off')
                }
              />
              <Toggle label="Countdown before each song" hint="The big screen reveals the song and who asked for it; the music starts on zero" checked={jb.reveal} onChange={(v) => run({ type: 'updateSettings', patch: { jukebox: { ...jb, reveal: v } } })} />
              <Toggle label="Never go silent" hint="When the queue is empty, play a random song from the library" checked={jb.fill} onChange={(v) => run({ type: 'updateSettings', patch: { jukebox: { ...jb, fill: v } } })} />
              <div className="flex items-center justify-between gap-4 py-3">
                <span className="text-sm font-medium text-white/90">Next song is</span>
                <Segmented
                  value={jb.order}
                  onChange={(v) => run({ type: 'updateSettings', patch: { jukebox: { ...jb, order: v } } })}
                  options={[
                    { value: 'votes', label: 'Most voted' },
                    { value: 'queue', label: 'First requested' },
                  ]}
                />
              </div>
            </div>
          </div>

          {/* up next */}
          <div className="rounded-3xl border border-white/[0.07] bg-ink-2/70 p-4">
            <div className="mb-3 flex items-center gap-2 font-display font-bold">
              <ListMusic className="h-4 w-4 text-magenta" /> Up next <span className="text-white/40">{queue.length}</span>
            </div>
            <div className="space-y-2">
              {queue.slice(0, 6).map((r, i) => (
                <div key={r.id} className={cn('flex items-center gap-3 rounded-2xl p-2', i === 0 ? 'bg-magenta/10' : 'bg-white/[0.04]')}>
                  <Artwork url={r.artworkUrl} seed={r.songTitle} label={r.songTitle} className="h-11 w-11" rounded="rounded-xl" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{r.songTitle}</div>
                    <div className="truncate text-xs text-white/50">
                      {r.artist} · {r.guestName}
                    </div>
                  </div>
                  <span className="px-1 font-display font-black tabular-nums">{r.voteCount}</span>
                </div>
              ))}
              {!queue.length && <div className="py-6 text-center text-sm text-white/40">No requests waiting{jb.fill ? ' — the house picks until someone asks' : ''}</div>}
            </div>
          </div>
        </div>

        {/* library */}
        <div className="rounded-3xl border border-white/[0.07] bg-ink-2/70 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 font-display font-bold">
              <Music2 className="h-4 w-4 text-cyan" /> Library <span className="text-white/40">{snap.library.length}</span>
            </div>
            <div className="ml-auto flex gap-2">
              <label className="btn-primary cursor-pointer px-3 py-2 text-sm">
                <Upload className="h-4 w-4" /> Add songs
                <input type="file" accept="audio/*,.mp3,.m4a,.wav,.flac,.ogg" multiple className="hidden" onChange={(e) => (onFiles(e.target.files), (e.target.value = ''))} />
              </label>
              <label className="btn-ghost cursor-pointer px-3 py-2 text-sm">
                <FolderOpen className="h-4 w-4" /> Add folder
                <input type="file" multiple className="hidden" {...({ webkitdirectory: '' } as object)} onChange={(e) => (onFiles(e.target.files), (e.target.value = ''))} />
              </label>
            </div>
          </div>
          <p className="mt-2 text-xs text-white/45">
            Files stay on this laptop — only the song list is shared with guests. Title and artist come from each file's tags, or from a name like “Artist - Title.mp3”.
          </p>
          {importing && (
            <div className="mt-3">
              <div className="h-2 overflow-hidden rounded-full bg-white/10">
                <div className="h-full bg-gradient-to-r from-primary to-magenta transition-[width]" style={{ width: `${(importing.done / Math.max(1, importing.total)) * 100}%` }} />
              </div>
              <div className="mt-1 text-xs text-white/55">
                Reading {importing.done} / {importing.total}…
              </div>
            </div>
          )}
          {missing > 0 && (
            <div className="mt-3 flex items-start gap-2 rounded-2xl border border-amber-300/30 bg-amber-300/[0.06] p-3 text-sm text-amber-100/90">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {missing} {missing === 1 ? 'song is' : 'songs are'} in the list but not on this laptop (imported elsewhere, or browser data was cleared). Add the same files again to re-link
                them; until then they are skipped.
              </span>
            </div>
          )}
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
            <input className="field py-2 pl-9 text-sm" placeholder="Search the library" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="mt-3 max-h-[62vh] space-y-1 overflow-y-auto pr-1">
            {shown.map((t) => (
              <LibraryRow
                key={t.id}
                t={t}
                here={stored.has(t.fileKey)}
                onPlay={started ? () => run({ type: 'playTrack', trackId: t.id }, `Playing “${t.title}”`) : undefined}
                onRemove={async () => {
                  await run({ type: 'removeTrack', id: t.id });
                  await deleteFile(eventId, t.fileKey).catch(() => undefined);
                  setStored(await storedKeys(eventId));
                }}
              />
            ))}
            {!snap.library.length && <div className="py-12 text-center text-sm text-white/40">No songs yet. Add your MP3s to open the jukebox.</div>}
            {snap.library.length > shown.length && !q && <div className="py-2 text-center text-xs text-white/40">Showing the first {shown.length} — search to find the rest.</div>}
          </div>
          {snap.library.length > 0 && (
            <button
              className="mt-3 text-xs text-white/45 hover:text-rose-300"
              onClick={async () => {
                if (await confirm({ title: 'Remove the whole library?', body: 'Guests will no longer see these songs. The original files on your disk are not touched.', confirmText: 'Remove all', danger: true })) {
                  await run({ type: 'clearLibrary' }, 'Library cleared');
                  await clearFiles(eventId).catch(() => undefined);
                  setStored(new Set());
                }
              }}
            >
              Remove all songs
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function LibraryRow({ t, here, onPlay, onRemove }: { t: LibraryTrack; here: boolean; onPlay?: () => void; onRemove: () => void }) {
  return (
    <div className={cn('flex items-center gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.02] p-2', !here && 'opacity-60')}>
      <Artwork url={t.artworkUrl} seed={t.title} label={t.title} className="h-10 w-10" rounded="rounded-xl" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold">{t.title}</div>
        <div className="truncate text-xs text-white/50">{t.artist}</div>
      </div>
      {!here && <span className="chip border-amber-300/40 text-amber-200">missing</span>}
      <span className="text-xs tabular-nums text-white/40">{t.durationSec ? formatDuration(t.durationSec) : ''}</span>
      {onPlay && here && (
        <button title="Play now" aria-label={`Play ${t.title} now`} onClick={onPlay} className="grid h-8 w-8 place-items-center rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/10">
          <Play className="h-3.5 w-3.5" />
        </button>
      )}
      <button title="Remove" aria-label={`Remove ${t.title}`} onClick={onRemove} className="grid h-8 w-8 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-white/40 hover:text-rose-300">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
