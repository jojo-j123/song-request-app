import { useEffect, useRef } from 'react';
import type { Backend } from '../backend/types';
import type { EventSnapshot, SongRequest } from '../types';
import { DEMO_DEDICATIONS, DEMO_SONGS, demoGuests } from './data';
import { hashString, normalizeSong, uid } from '../utils';
import { leaderOf, pendingOf, queueOf } from '../selectors';

const GUESTS = demoGuests(100);
const pick = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];
const TAB = uid().slice(0, 8);

/** Only one tab per device runs the simulator / battle timer (leader election via localStorage heartbeat). */
function claimHost(key: string) {
  try {
    const raw = localStorage.getItem(key);
    const cur = raw ? JSON.parse(raw) : null;
    if (!cur || cur.tab === TAB || Date.now() - cur.ts > 5000) {
      localStorage.setItem(key, JSON.stringify({ tab: TAB, ts: Date.now() }));
      return true;
    }
  } catch {
    return true;
  }
  return false;
}

function makeRequest(eventId: string, song: [string, string], status: SongRequest['status'], votes = 0, agoSec = 0) {
  const g = pick(GUESTS);
  const dedicate = Math.random() < 0.08;
  return {
    guestId: g.id,
    guestName: g.name,
    songTitle: song[0],
    artist: song[1],
    artworkUrl: null,
    status,
    voteCount: votes,
    requestedAt: new Date(Date.now() - agoSec * 1000).toISOString(),
    playedAt: status === 'played' || status === 'playing' ? new Date(Date.now() - agoSec * 500).toISOString() : null,
    dedicatedTo: dedicate ? pick(DEMO_DEDICATIONS) : null,
    message: null,
    isDemo: true,
    eventId,
  };
}

/** Song "popularity" so the simulated crowd has believable favourites. */
const appeal = (r: SongRequest) => 1 + (hashString(r.songTitle) % 7) + r.voteCount * 0.6;

function weighted(list: SongRequest[]) {
  const total = list.reduce((s, r) => s + appeal(r), 0);
  let x = Math.random() * total;
  for (const r of list) if ((x -= appeal(r)) <= 0) return r;
  return list[0];
}

export async function seedDemo(backend: Backend, snap: EventSnapshot) {
  const eventId = snap.event.id;
  const taken = new Set(snap.requests.map((r) => normalizeSong(r.songTitle, r.artist)));
  const songs = [...DEMO_SONGS].filter((s) => !taken.has(normalizeSong(s[0], s[1]))).sort(() => Math.random() - 0.5);
  const reqs = [
    ...songs.slice(0, 5).map((s, i) => makeRequest(eventId, s, 'played', 0, 1800 - i * 200)),
    ...songs.slice(5, 27).map((s, i) => makeRequest(eventId, s, 'approved', Math.floor(Math.random() ** 2 * 38), 900 - i * 30)),
    ...songs.slice(27, 33).map((s, i) => makeRequest(eventId, s, 'pending', 0, 60 - i * 8)),
  ].map(({ eventId: _e, ...r }) => r);
  const now = makeRequest(eventId, songs[33], 'playing', 0, 120);
  const { eventId: _x, ...nowReq } = now;
  await backend.admin(eventId, { type: 'injectRequests', requests: [...reqs, nowReq] });
  const seededVotes = reqs.reduce((s, r) => s + r.voteCount, 0);
  await backend.admin(eventId, {
    type: 'updateSettings',
    // guests are counted naturally as simulated guests vote (server registers them)
    patch: { totalVotes: snap.settings.totalVotes + seededVotes },
  });
}

/**
 * Hosts the demo simulation and battle auto-finish for an authenticated admin/DJ tab.
 */
export function useEventHost(backend: Backend | null, snap: EventSnapshot | null, enabled: boolean) {
  const snapRef = useRef(snap);
  snapRef.current = snap;
  const busy = useRef(false);
  const lastReveal = useRef(Date.now());
  const seededFor = useRef<string | null>(null);

  const eventId = snap?.event.id;
  const running = !!snap?.settings.demo.enabled && !!snap?.settings.demo.running;
  const speed = snap?.settings.demo.speed ?? 1;

  // battle timer — finalise when time is up
  useEffect(() => {
    if (!backend || !enabled || !eventId) return;
    const t = setInterval(() => {
      const b = snapRef.current?.battle;
      if (b && b.status === 'live' && Date.now() > new Date(b.endsAt).getTime() && claimHost(`encore:host:${eventId}`))
        backend.admin(eventId, { type: 'endBattle' });
    }, 1000);
    return () => clearInterval(t);
  }, [backend, enabled, eventId]);

  // seed once when the demo starts with no demo data
  useEffect(() => {
    const s = snapRef.current;
    if (!backend || !enabled || !running || !s || !eventId) return;
    if (seededFor.current === eventId) return;
    if (s.requests.some((r) => r.isDemo)) {
      seededFor.current = eventId;
      return;
    }
    if (!claimHost(`encore:host:${eventId}`)) return;
    seededFor.current = eventId;
    seedDemo(backend, s);
  }, [backend, enabled, running, eventId]);

  useEffect(() => {
    if (!backend || !enabled || !running || !eventId) return;
    const interval = Math.max(250, 1400 / speed);
    const t = setInterval(async () => {
      const s = snapRef.current;
      if (!s || busy.current || !claimHost(`encore:host:${eventId}`)) return;
      busy.current = true;
      try {
        const queue = queueOf(s.requests);
        const roll = Math.random();

        // 1) new incoming request
        if (roll < 0.3 && queue.length < 45 && s.settings.submissionsEnabled) {
          const taken = new Set(
            s.requests.filter((r) => r.status !== 'rejected').map((r) => normalizeSong(r.songTitle, r.artist)),
          );
          const song = DEMO_SONGS.filter((x) => !taken.has(normalizeSong(x[0], x[1])));
          if (song.length) {
            const { eventId: _e, ...r } = makeRequest(eventId, pick(song), s.settings.autoApprove ? 'approved' : 'pending');
            await backend.admin(eventId, { type: 'injectRequests', requests: [r] });
          }
        }

        // 2) crowd votes
        const voters = 1 + Math.floor(Math.random() * 3 * Math.min(2, speed));
        if (s.settings.votingEnabled && queue.length) {
          for (let i = 0; i < voters; i++) {
            const target = weighted(queue);
            await backend.castVote(eventId, target.id, pick(GUESTS).id);
          }
        }
        const b = s.battle;
        if (b && b.status === 'live' && Date.now() < new Date(b.endsAt).getTime()) {
          for (let i = 0; i < 2; i++) {
            const favour = hashString(b.id) % 2;
            const choice = Math.random() < 0.56 ? b.requestIds[favour] : b.requestIds[1 - favour];
            await backend.castVote(eventId, choice, pick(GUESTS).id, b.id);
          }
        }

        // 3) simulated DJ: approve, and periodically reveal the crowd favourite
        if (s.settings.demo.autoDj) {
          const pend = pendingOf(s.requests).filter((r) => r.isDemo);
          if (pend.length && Date.now() - new Date(pend[0].requestedAt).getTime() > 6000 && Math.random() < 0.45) {
            await backend.admin(eventId, { type: Math.random() < 0.9 ? 'approve' : 'reject', id: pend[0].id });
          }
          const bt = s.battle;
          const busyScreen = !!bt && (bt.status === 'live' || Date.now() - new Date(bt.endsAt).getTime() < 20_000);
          if (!busyScreen && Date.now() - lastReveal.current > Math.max(35_000, 60_000 / speed)) {
            lastReveal.current = Date.now();
            const next = leaderOf(s.requests) ?? queue[0];
            if (next) await backend.admin(eventId, { type: 'reveal', id: next.id });
          }
        }
      } finally {
        busy.current = false;
      }
    }, interval);
    return () => clearInterval(t);
  }, [backend, enabled, running, speed, eventId]);
}
