import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Maximize, Volume2 } from 'lucide-react';
import { useEventSnapshot, useNow } from '@/hooks/useEvent';
import { Atmosphere } from '@/components/fx';
import { Artwork, ConnectionBadge, FullScreenMessage, Spinner } from '@/components/ui';
import { Stage } from '@/components/display/shared';
import { MainScreen } from '@/components/display/MainScreen';
import { LeaderboardScreen, NowPlayingScreen, RequestWallScreen } from '@/components/display/Screens';
import {
  BirthdayMoment,
  CountdownReveal,
  CrowdVoteOverlay,
  DedicationMoment,
  HypeMoment,
  MOMENT_DURATION,
  SurpriseMoment,
  WallOfFameMoment,
} from '@/components/display/Overlays';
import { sound } from '@/lib/sound';
import type { DisplayCommand, DisplayMode, EventSnapshot, SongRequest } from '@/lib/types';

export default function Display({ forcedMode }: { forcedMode?: DisplayMode }) {
  const { eventId = '' } = useParams();
  const { snap, status } = useEventSnapshot(eventId);
  const [audioReady, setAudioReady] = useState(false);
  const [cursor, setCursor] = useState(true);

  useEffect(() => {
    if (snap) sound.configure(snap.settings.soundEnabled, snap.settings.volume);
  }, [snap?.settings.soundEnabled, snap?.settings.volume]);

  // keep the screen awake + hide the cursor when idle
  useEffect(() => {
    let lock: any = null;
    const req = async () => {
      try {
        lock = await (navigator as any).wakeLock?.request('screen');
      } catch {
        /* unsupported */
      }
    };
    req();
    const vis = () => document.visibilityState === 'visible' && req();
    document.addEventListener('visibilitychange', vis);
    let t: ReturnType<typeof setTimeout>;
    const move = () => {
      setCursor(true);
      clearTimeout(t);
      t = setTimeout(() => setCursor(false), 2500);
    };
    window.addEventListener('mousemove', move);
    move();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'f') toggleFullscreen();
    };
    window.addEventListener('keydown', key);
    return () => {
      lock?.release?.();
      document.removeEventListener('visibilitychange', vis);
      window.removeEventListener('mousemove', move);
      window.removeEventListener('keydown', key);
      clearTimeout(t);
    };
  }, []);

  if (snap === undefined)
    return (
      <div className="grid h-screen place-items-center bg-ink">
        <Spinner className="h-10 w-10 text-primary" />
      </div>
    );
  if (snap === null) return <FullScreenMessage title="Event not found">Check the display URL.</FullScreenMessage>;

  const mode = forcedMode ?? snap.settings.displayMode;

  return (
    <div style={{ cursor: cursor ? 'default' : 'none' }} data-intensity={snap.settings.animationIntensity}>
      <Stage>
        <Atmosphere
          theme={snap.event.theme.background}
          density={snap.settings.animationIntensity === 'low' ? 0.5 : snap.settings.animationIntensity === 'high' ? 1.6 : 1}
          energy={snap.settings.animationIntensity === 'high' ? 1.3 : 1}
        />
        <AnimatePresence mode="wait">
          <motion.div
            key={mode}
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 0.96, filter: 'blur(24px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 1.04, filter: 'blur(24px)' }}
            transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
          >
            {mode === 'main' && <MainScreen snap={snap} />}
            {mode === 'wall' && <RequestWallScreen snap={snap} />}
            {mode === 'leaderboard' && <LeaderboardScreen snap={snap} />}
            {mode === 'nowplaying' && <NowPlayingScreen snap={snap} />}
          </motion.div>
        </AnimatePresence>
        <ApprovedBursts snap={snap} />
        <OverlayLayer snap={snap} />
        {status !== 'live' && (
          <div className="absolute bottom-24 left-16 z-[80] scale-150 origin-bottom-left">
            <ConnectionBadge status={status} />
          </div>
        )}
      </Stage>

      {/* operator controls (only visible while the mouse moves) */}
      <div className={`fixed right-4 top-4 z-[90] flex gap-2 transition-opacity ${cursor ? 'opacity-100' : 'opacity-0'}`}>
        {snap.settings.soundEnabled && !audioReady && (
          <button
            className="btn-primary px-4 py-2 text-sm"
            onClick={async () => setAudioReady(await sound.unlock())}
          >
            <Volume2 className="h-4 w-4" /> Enable sound
          </button>
        )}
        <button className="btn-ghost px-3 py-2 text-sm" onClick={toggleFullscreen} title="Fullscreen (F)">
          <Maximize className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function toggleFullscreen() {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen?.().catch(() => undefined);
}

/* Overlay selection: crowd-vote battles take priority, then the latest DJ command. */
function OverlayLayer({ snap }: { snap: EventSnapshot }) {
  const now = useNow(500);
  const cmd = snap.command;
  const battle = snap.battle;
  const battleVisible =
    battle && (battle.status === 'live' || now - new Date(battle.endsAt).getTime() < 12_000) && now - new Date(battle.startedAt).getTime() < 15 * 60_000;

  let active: DisplayCommand | null = null;
  if (cmd && cmd.type !== 'clear') {
    const dur = (MOMENT_DURATION[cmd.type]?.(cmd) ?? 10) * 1000;
    const age = now - new Date(cmd.triggeredAt).getTime();
    if (age < dur && age > -5000) active = cmd;
  }
  // if a battle was started after the command, the battle wins
  if (battleVisible && active && new Date(battle!.startedAt) > new Date(active.triggeredAt)) active = null;

  const find = (id?: string) => (id ? snap.requests.find((r) => r.id === id) : undefined);
  const showNames = snap.settings.showRequesterNames;

  return (
    <AnimatePresence>
      {active ? (
        <motion.div key={active.id} className="absolute inset-0 z-50" exit={{ opacity: 0 }}>
          {active.type === 'countdown' && <CountdownReveal cmd={active} req={find(active.payload.requestId)} showNames={showNames} />}
          {active.type === 'fame' && <WallOfFameMoment cmd={active} req={find(active.payload.requestId)} />}
          {active.type === 'hype' && <HypeMoment cmd={active} />}
          {active.type === 'dedication' && <DedicationMoment cmd={active} req={find(active.payload.requestId)} />}
          {active.type === 'birthday' && <BirthdayMoment cmd={active} />}
          {active.type === 'surprise' && <SurpriseMoment cmd={active} />}
        </motion.div>
      ) : battleVisible ? (
        <motion.div key={battle!.id} className="absolute inset-0 z-50" exit={{ opacity: 0 }}>
          <CrowdVoteOverlay battle={battle!} snap={snap} />
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/* Neon burst when the DJ approves a new request. */
function ApprovedBursts({ snap }: { snap: EventSnapshot }) {
  const seen = useRef<Set<string> | null>(null);
  const [items, setItems] = useState<SongRequest[]>([]);
  const approved = useMemo(() => snap.requests.filter((r) => r.status === 'approved'), [snap.requests]);
  useEffect(() => {
    if (!seen.current) {
      seen.current = new Set(snap.requests.filter((r) => r.status !== 'pending').map((r) => r.id));
      return;
    }
    const fresh = approved.filter((r) => !seen.current!.has(r.id));
    snap.requests.forEach((r) => r.status !== 'pending' && seen.current!.add(r.id));
    if (!fresh.length) return;
    sound.play('request');
    setItems((x) => [...x, ...fresh].slice(-3));
    const ids = fresh.map((f) => f.id);
    setTimeout(() => setItems((x) => x.filter((i) => !ids.includes(i.id))), 4200);
  }, [approved, snap.requests]);

  return (
    <div className="pointer-events-none absolute left-1/2 top-[124px] z-40 flex -translate-x-1/2 flex-col items-center gap-3">
      <AnimatePresence>
        {items.map((r) => (
          <motion.div
            key={r.id}
            initial={{ opacity: 0, y: -30, scale: 0.6 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 1.3, filter: 'blur(16px)' }}
            transition={{ type: 'spring', stiffness: 220, damping: 18 }}
            className="relative"
          >
            <motion.div
              className="absolute inset-0 rounded-full bg-gradient-to-r from-primary via-magenta to-cyan blur-2xl"
              initial={{ scale: 0.5, opacity: 1 }}
              animate={{ scale: 1.8, opacity: 0 }}
              transition={{ duration: 1.1 }}
            />
            <div className="neon-border glass-strong relative flex items-center gap-4 rounded-full py-2.5 pl-2.5 pr-8 shadow-glow-lg">
              <Artwork url={r.artworkUrl} seed={r.songTitle} label={r.songTitle} className="h-14 w-14" rounded="rounded-full" />
              <div>
                <div className="text-[13px] font-black tracking-[0.35em] text-cyan">NEW REQUEST</div>
                <div className="text-[22px] font-bold">
                  {r.songTitle} <span className="font-normal text-white/50">— {r.guestName}</span>
                </div>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
