import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Maximize, Mic, MicOff, Volume2 } from 'lucide-react';
import { useEventSnapshot, useNow } from '@/hooks/useEvent';
import { Atmosphere } from '@/components/fx';
import { Artwork, ConnectionBadge, FullScreenMessage, Spinner } from '@/components/ui';
import { HEADER_L, HEADER_P, Stage, useStage } from '@/components/display/shared';
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
import { audio, useMicState } from '@/lib/audio';
import { usePalette } from '@/lib/palette';
import { nowPlayingOf } from '@/lib/selectors';
import { sound } from '@/lib/sound';
import type { DisplayCommand, DisplayMode, EventSnapshot, SongRequest } from '@/lib/types';
import { rem } from '@/lib/utils';

export default function Display({ forcedMode }: { forcedMode?: DisplayMode }) {
  const { eventId = '' } = useParams();
  const { snap, status } = useEventSnapshot(eventId);
  const [audioReady, setAudioReady] = useState(false);
  const [controls, setControls] = useState(true);
  const mic = useMicState();

  useEffect(() => {
    if (snap) sound.configure(snap.settings.soundEnabled, snap.settings.volume);
  }, [snap?.settings.soundEnabled, snap?.settings.volume]);

  // the room's colours follow the song that is playing
  const playing = snap ? nowPlayingOf(snap.requests) : null;
  const palette = usePalette(playing);

  useEffect(() => {
    // resume music-reactive mode if this screen had it on (browsers allow it once permission was granted)
    if (audio.wantsMic && audio.mic === 'off') audio.enableMic();

    // keep the screen awake + hide cursor and controls when idle
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
    const wake = () => {
      setControls(true);
      clearTimeout(t);
      t = setTimeout(() => setControls(false), 3000);
    };
    window.addEventListener('mousemove', wake);
    window.addEventListener('pointerdown', wake);
    wake();
    const key = (e: KeyboardEvent) => {
      if (e.key === 'f') toggleFullscreen();
    };
    window.addEventListener('keydown', key);
    return () => {
      lock?.release?.();
      document.removeEventListener('visibilitychange', vis);
      window.removeEventListener('mousemove', wake);
      window.removeEventListener('pointerdown', wake);
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
  const intensity = snap.settings.animationIntensity;

  return (
    <div style={{ cursor: controls ? 'default' : 'none' }}>
      <Stage
        background={
          <Atmosphere
            theme={snap.event.theme.background}
            palette={palette}
            density={intensity === 'low' ? 0.5 : intensity === 'high' ? 1.6 : 1}
            energy={intensity === 'high' ? 1.3 : 1}
          />
        }
      >
        <AnimatePresence>
          <motion.div
            key={mode}
            className="absolute inset-0 isolate"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.04 }}
            transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
          >
            {mode === 'main' && <MainScreen snap={snap} palette={palette} />}
            {mode === 'wall' && <RequestWallScreen snap={snap} />}
            {mode === 'leaderboard' && <LeaderboardScreen snap={snap} />}
            {mode === 'nowplaying' && <NowPlayingScreen snap={snap} palette={palette} />}
          </motion.div>
        </AnimatePresence>
        <ApprovedBursts snap={snap} />
        <OverlayLayer snap={snap} />
        {status !== 'live' && (
          <div className="absolute bottom-[6.5rem] left-10 z-[80] text-[1.25rem]">
            <ConnectionBadge status={status} className="!px-4 !py-2 !text-[1rem]" />
          </div>
        )}
      </Stage>

      {/* Operator controls: appear on mouse move / tap. Sized in px — they sit outside the scaled stage. */}
      <div
        className="fixed right-3 top-3 z-[90] flex gap-2 transition-opacity duration-300"
        style={{ opacity: controls ? 1 : 0, pointerEvents: controls ? 'auto' : 'none' }}
      >
        {mic !== 'unsupported' && (
          <button
            className="op-btn"
            data-on={mic === 'on'}
            title="Make the visuals react to the music in the room. Audio is analysed on this device only — nothing is recorded or sent."
            onClick={() => (mic === 'on' ? audio.disableMic() : audio.enableMic())}
          >
            {mic === 'on' ? <Mic /> : <MicOff />}
            {mic === 'on' ? 'Reacting to music' : mic === 'denied' ? 'Mic blocked — allow it in the browser' : 'React to music'}
          </button>
        )}
        {snap.settings.soundEnabled && !audioReady && (
          <button className="op-btn" onClick={async () => setAudioReady(await sound.unlock())}>
            <Volume2 /> Enable sound
          </button>
        )}
        <button className="op-btn" onClick={toggleFullscreen} title="Fullscreen (F)" aria-label="Fullscreen">
          <Maximize />
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
  // guests "in the running" for the countdown's name shuffle
  const names = useMemo(
    () => [...new Set(snap.requests.filter((r) => ['approved', 'playing'].includes(r.status)).map((r) => r.guestName))].slice(0, 40),
    [snap.requests],
  );

  return (
    <AnimatePresence>
      {active ? (
        <motion.div key={active.id} className="absolute inset-0 z-50" exit={{ opacity: 0 }}>
          {active.type === 'countdown' && <CountdownReveal cmd={active} req={find(active.payload.requestId)} showNames={showNames} names={names} />}
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
  const { portrait, u } = useStage();
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
    setItems((x) => [...x, ...fresh].slice(-2));
    const ids = fresh.map((f) => f.id);
    setTimeout(() => setItems((x) => x.filter((i) => !ids.includes(i.id))), 4200);
  }, [approved, snap.requests]);

  return (
    <div
      className="pointer-events-none absolute inset-x-0 z-40 flex flex-col items-center gap-3 px-8"
      style={{ top: rem((portrait ? HEADER_P : HEADER_L) + 14) }}
    >
      <AnimatePresence>
        {items.map((r) => (
          <motion.div
            key={r.id}
            initial={{ opacity: 0, y: -34 * u, scale: 0.6 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 1.25 }}
            transition={{ type: 'spring', stiffness: 220, damping: 18 }}
            className="relative max-w-full"
          >
            <motion.div
              className="absolute inset-0 rounded-full bg-[radial-gradient(closest-side,rgb(var(--c-magenta)/0.55),rgb(var(--c-primary)/0.3)_60%,transparent)]"
              initial={{ scale: 0.5, opacity: 1 }}
              animate={{ scale: 2, opacity: 0 }}
              transition={{ duration: 1.1 }}
            />
            <div className="neon-border card-solid relative flex max-w-full items-center gap-4 rounded-full py-2.5 pl-2.5 pr-9 shadow-glow-lg">
              <Artwork url={r.artworkUrl} seed={r.songTitle} label={r.songTitle} className="h-[3.75rem] w-[3.75rem]" rounded="rounded-full" />
              <div className="min-w-0">
                <div className="text-[0.875rem] font-black tracking-[0.35em] text-cyan">NEW REQUEST</div>
                <div className="truncate text-[1.5rem] font-bold" dir="auto">
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
