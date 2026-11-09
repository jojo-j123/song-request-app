/**
 * Pure event engine — the single source of truth for business rules in LOCAL mode.
 * The Supabase SQL functions (supabase/migrations) mirror these rules server-side.
 */
import type {
  ActionResult,
  AdminAction,
  Battle,
  DisplayCommand,
  EventInfo,
  EventSettings,
  EventSnapshot,
  SongRequest,
  SubmitInput,
} from './types';
import { clampText, DEFAULT_SETTINGS, normalizeSong, nowIso, uid } from './utils';

export interface VoteRecord {
  r: string; // request id
  v: string; // voter id
  c: string; // context: "round:N" | "battle:<id>"
}

export interface LocalEventState {
  event: EventInfo;
  settings: EventSettings;
  requests: SongRequest[];
  votes: VoteRecord[];
  guests: string[];
  command: DisplayCommand | null;
  battle: Battle | null;
  clientIds: Record<string, string>; // idempotency key -> request id
  adminPin: string;
  version: number;
}

export const LIMITS = { name: 40, title: 120, artist: 100, message: 200 };
export const QUEUED: SongRequest['status'][] = ['pending', 'approved'];

export function toSnapshot(s: LocalEventState): EventSnapshot {
  return { event: s.event, settings: s.settings, requests: s.requests, command: s.command, battle: s.battle };
}

export function createState(event: EventInfo, adminPin: string, settings?: Partial<EventSettings>): LocalEventState {
  return {
    event,
    settings: { ...DEFAULT_SETTINGS, ...settings, demo: { ...DEFAULT_SETTINGS.demo, ...(settings?.demo ?? {}) } },
    requests: [],
    votes: [],
    guests: [],
    command: null,
    battle: null,
    clientIds: {},
    adminPin,
    version: 1,
  };
}

const fail = (code: ActionResult['code'], message?: string): ActionResult<any> => ({ ok: false, code, message });

const nextPosition = (s: LocalEventState) => s.requests.reduce((m, r) => Math.max(m, r.queuePosition), 0) + 1;

export function registerGuest(s: LocalEventState, guestId: string) {
  if (!s.guests.includes(guestId)) {
    s.guests.push(guestId);
    s.settings.guestCount = s.guests.length;
  }
}

export function submitRequest(s: LocalEventState, input: SubmitInput): ActionResult<SongRequest> {
  // idempotency: a retried submission returns the original row
  const existingId = s.clientIds[input.clientId];
  if (existingId) {
    const r = s.requests.find((x) => x.id === existingId);
    if (r) return { ok: true, code: 'ok', data: r };
  }
  if (s.event.status === 'ended') return fail('event_ended', 'This event has ended.');
  if (!s.settings.submissionsEnabled) return fail('submissions_closed', 'Requests are paused right now.');

  const guestName = clampText(input.guestName, LIMITS.name);
  const songTitle = clampText(input.songTitle, LIMITS.title);
  const artist = clampText(input.artist, LIMITS.artist);
  if (!guestName || !songTitle || !artist || !input.guestId) return fail('invalid', 'Name, song and artist are required.');

  const mine = s.requests.filter((r) => r.guestId === input.guestId && r.status !== 'rejected' && !r.isDemo);
  if (mine.length >= s.settings.maxRequestsPerGuest)
    return fail('guest_limit', `You've reached the limit of ${s.settings.maxRequestsPerGuest} requests.`);

  const key = normalizeSong(songTitle, artist);
  const dup = s.requests.find((r) => QUEUED.includes(r.status) && normalizeSong(r.songTitle, r.artist) === key);
  if (dup) return { ok: false, code: 'duplicate_song', message: 'Already on the list — vote for it instead!', data: dup };

  const queued = s.requests.filter((r) => QUEUED.includes(r.status)).length;
  if (queued >= s.settings.maxQueueSize) return fail('queue_full', 'The queue is full. Try again soon!');

  registerGuest(s, input.guestId);
  const req: SongRequest = {
    id: uid(),
    eventId: s.event.id,
    guestId: input.guestId,
    guestName,
    songTitle,
    artist,
    artworkUrl: input.artworkUrl?.startsWith('https://') ? input.artworkUrl : null,
    status: s.settings.autoApprove ? 'approved' : 'pending',
    voteCount: 0,
    queuePosition: nextPosition(s),
    requestedAt: nowIso(),
    playedAt: null,
    dedicatedTo: clampText(input.dedicatedTo, LIMITS.name) || null,
    message: clampText(input.message, LIMITS.message) || null,
    isDemo: false,
  };
  s.requests.push(req);
  s.clientIds[input.clientId] = req.id;
  return { ok: true, code: 'ok', data: req };
}

export function castVote(
  s: LocalEventState,
  requestId: string,
  voterId: string,
  battleId?: string | null,
): ActionResult<{ voteCount: number }> {
  if (!voterId) return fail('invalid');
  const req = s.requests.find((r) => r.id === requestId);
  if (!req) return fail('not_found', 'That song is no longer in the queue.');

  if (battleId) {
    const b = s.battle;
    if (!b || b.id !== battleId || b.status !== 'live' || Date.now() > new Date(b.endsAt).getTime())
      return fail('battle_closed', 'This battle is over.');
    if (!b.requestIds.includes(requestId)) return fail('invalid');
    const ctx = `battle:${b.id}`;
    if (s.votes.some((v) => v.c === ctx && v.v === voterId)) return fail('already_voted', 'You already picked a side!');
    s.votes.push({ r: requestId, v: voterId, c: ctx });
    b.tallies[requestId] = (b.tallies[requestId] ?? 0) + 1;
    s.settings.totalVotes += 1;
    return { ok: true, code: 'ok', data: { voteCount: b.tallies[requestId] } };
  }

  if (!s.settings.votingEnabled) return fail('voting_closed', 'Voting is closed right now.');
  if (req.status !== 'approved') return fail('not_found', 'Voting is closed for this song.');
  const ctx = `round:${s.settings.votingRound}`;
  if (s.votes.some((v) => v.c === ctx && v.v === voterId && v.r === requestId))
    return fail('already_voted', 'You already voted for this one.');
  s.votes.push({ r: requestId, v: voterId, c: ctx });
  req.voteCount += 1;
  s.settings.totalVotes += 1;
  registerGuest(s, voterId);
  return { ok: true, code: 'ok', data: { voteCount: req.voteCount } };
}

function command(s: LocalEventState, type: DisplayCommand['type'], payload: Record<string, any> = {}) {
  s.command = { id: uid(), type, payload, triggeredAt: nowIso() };
}

function finishPlaying(s: LocalEventState) {
  for (const r of s.requests) if (r.status === 'playing') r.status = 'played';
}

function renumber(s: LocalEventState, orderedIds: string[]) {
  const pos = new Map(orderedIds.map((id, i) => [id, i + 1]));
  const rest = s.requests.filter((r) => !pos.has(r.id)).sort((a, b) => a.queuePosition - b.queuePosition);
  let n = orderedIds.length;
  for (const r of rest) pos.set(r.id, ++n);
  for (const r of s.requests) r.queuePosition = pos.get(r.id)!;
}

export function queueOf(requests: SongRequest[]) {
  return requests.filter((r) => r.status === 'approved').sort((a, b) => a.queuePosition - b.queuePosition);
}

export function applyAdmin(s: LocalEventState, a: AdminAction): ActionResult {
  const find = (id: string) => s.requests.find((r) => r.id === id);
  switch (a.type) {
    case 'approve': {
      const r = find(a.id);
      if (!r) return fail('not_found');
      r.status = 'approved';
      break;
    }
    case 'reject': {
      const r = find(a.id);
      if (!r) return fail('not_found');
      r.status = 'rejected';
      break;
    }
    case 'restore': {
      const r = find(a.id);
      if (!r) return fail('not_found');
      r.status = 'approved';
      r.playedAt = null;
      break;
    }
    case 'delete':
      s.requests = s.requests.filter((r) => r.id !== a.id);
      s.votes = s.votes.filter((v) => v.r !== a.id);
      break;
    case 'move': {
      const q = queueOf(s.requests);
      const i = q.findIndex((r) => r.id === a.id);
      const j = i + a.dir;
      if (i < 0 || j < 0 || j >= q.length) return { ok: true, code: 'ok' };
      [q[i], q[j]] = [q[j], q[i]];
      renumber(s, q.map((r) => r.id));
      break;
    }
    case 'reorder':
      renumber(s, a.ids);
      break;
    case 'sortByVotes': {
      const q = queueOf(s.requests).sort((x, y) => y.voteCount - x.voteCount || x.queuePosition - y.queuePosition);
      renumber(s, q.map((r) => r.id));
      break;
    }
    case 'playNow':
    case 'reveal': {
      const r = find(a.id);
      if (!r) return fail('not_found');
      finishPlaying(s);
      r.status = 'playing';
      r.playedAt = nowIso();
      if (a.type === 'reveal') command(s, 'countdown', { requestId: r.id, duration: s.settings.countdownDuration });
      break;
    }
    case 'skip': {
      const r = find(a.id);
      if (!r) return fail('not_found');
      r.status = 'skipped';
      break;
    }
    case 'finishCurrent':
      finishPlaying(s);
      break;
    case 'updateSettings':
      s.settings = {
        ...s.settings,
        ...a.patch,
        demo: { ...s.settings.demo, ...(a.patch.demo ?? {}) },
      };
      break;
    case 'updateEvent':
      s.event = { ...s.event, ...a.patch, theme: { ...s.event.theme, ...(a.patch.theme ?? {}) } };
      break;
    case 'command':
      command(s, a.command.type, a.command.payload ?? {});
      break;
    case 'clearQueue':
      s.requests = s.requests.filter((r) => !QUEUED.includes(r.status));
      break;
    case 'resetEvent':
      s.requests = [];
      s.votes = [];
      s.guests = [];
      s.clientIds = {};
      s.battle = null;
      s.command = null;
      s.settings = { ...s.settings, votingRound: 1, totalVotes: 0, guestCount: 0, demo: { ...s.settings.demo, running: false } };
      break;
    case 'newRound':
      s.settings.votingRound += 1;
      s.settings.votingEnabled = true;
      for (const r of s.requests) r.voteCount = 0;
      break;
    case 'resetRounds':
      s.settings.votingRound = 1;
      s.votes = s.votes.filter((v) => !v.c.startsWith('round:'));
      for (const r of s.requests) r.voteCount = 0;
      break;
    case 'startBattle': {
      if (a.a === a.b || !find(a.a) || !find(a.b)) return fail('invalid', 'Pick two different songs.');
      const secs = Math.max(10, Math.min(600, a.seconds));
      s.battle = {
        id: uid(),
        requestIds: [a.a, a.b],
        tallies: { [a.a]: 0, [a.b]: 0 },
        startedAt: nowIso(),
        endsAt: new Date(Date.now() + secs * 1000).toISOString(),
        status: 'live',
        winnerId: null,
      };
      break;
    }
    case 'endBattle': {
      const b = s.battle;
      if (!b || b.status !== 'live') return { ok: true, code: 'ok' };
      b.status = 'ended';
      b.endsAt = new Date(Math.min(Date.now(), new Date(b.endsAt).getTime())).toISOString();
      b.winnerId = battleWinner(b);
      break;
    }
    case 'clearBattle':
      s.battle = null;
      break;
    case 'injectRequests': {
      let pos = nextPosition(s);
      for (const r of a.requests) s.requests.push({ ...r, id: uid(), eventId: s.event.id, queuePosition: pos++ });
      break;
    }
    case 'clearDemo': {
      const ids = new Set(s.requests.filter((r) => r.isDemo).map((r) => r.id));
      s.requests = s.requests.filter((r) => !r.isDemo);
      s.votes = s.votes.filter((v) => !ids.has(v.r) && !v.v.startsWith('demo-'));
      s.guests = s.guests.filter((g) => !g.startsWith('demo-'));
      s.settings.guestCount = s.guests.length;
      s.settings.totalVotes = s.votes.length;
      if (s.battle && s.battle.requestIds.some((id) => ids.has(id))) s.battle = null;
      break;
    }
  }
  return { ok: true, code: 'ok' };
}

export function battleWinner(b: Battle): string {
  const [x, y] = b.requestIds;
  return (b.tallies[y] ?? 0) > (b.tallies[x] ?? 0) ? y : x;
}
