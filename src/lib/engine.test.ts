import { describe, expect, it } from 'vitest';
import { applyAdmin, castVote, createState, submitRequest } from './engine';
import { DEFAULT_THEME } from './utils';
import { leaderOf, queueOf } from './selectors';

const mk = () =>
  createState(
    { id: 'ev', name: 'Test', logoUrl: null, date: null, theme: DEFAULT_THEME, status: 'live', createdAt: new Date().toISOString() },
    'pin',
  );
let n = 0;
const sub = (s: ReturnType<typeof mk>, guest: string, title: string, artist = 'Artist') =>
  submitRequest(s, { guestId: guest, guestName: 'Guest ' + guest, songTitle: title, artist, clientId: 'c' + n++ });

describe('submissions', () => {
  it('creates a pending request', () => {
    const s = mk();
    const r = sub(s, 'g1', 'Song A');
    expect(r.ok).toBe(true);
    expect(s.requests[0].status).toBe('pending');
  });
  it('is idempotent on retry with same client id', () => {
    const s = mk();
    const input = { guestId: 'g1', guestName: 'A', songTitle: 'X', artist: 'Y', clientId: 'same' };
    submitRequest(s, input);
    const again = submitRequest(s, input);
    expect(again.ok).toBe(true);
    expect(s.requests).toHaveLength(1);
  });
  it('rejects empty fields', () => {
    expect(sub(mk(), 'g1', '   ').code).toBe('invalid');
  });
  it('enforces per-guest limit', () => {
    const s = mk();
    s.settings.maxRequestsPerGuest = 2;
    sub(s, 'g1', 'A');
    sub(s, 'g1', 'B');
    expect(sub(s, 'g1', 'C').code).toBe('guest_limit');
    expect(sub(s, 'g2', 'C').ok).toBe(true);
  });
  it('detects duplicate songs (case/punctuation-insensitive)', () => {
    const s = mk();
    sub(s, 'g1', "Don't Stop Me Now", 'Queen');
    const d = sub(s, 'g2', 'dont stop me now', 'QUEEN');
    expect(d.code).toBe('duplicate_song');
    expect(d.data).toBeTruthy();
  });
  it('respects paused submissions and queue size', () => {
    const s = mk();
    s.settings.submissionsEnabled = false;
    expect(sub(s, 'g1', 'A').code).toBe('submissions_closed');
    s.settings.submissionsEnabled = true;
    s.settings.maxQueueSize = 1;
    sub(s, 'g1', 'A');
    expect(sub(s, 'g2', 'B').code).toBe('queue_full');
  });
  it('auto-approves when enabled', () => {
    const s = mk();
    s.settings.autoApprove = true;
    sub(s, 'g1', 'A');
    expect(s.requests[0].status).toBe('approved');
  });
});

describe('voting', () => {
  it('counts one vote per voter per song per round', () => {
    const s = mk();
    const r = sub(s, 'g1', 'A').data!;
    expect(castVote(s, r.id, 'v1').code).toBe('not_found'); // not approved yet
    applyAdmin(s, { type: 'approve', id: r.id });
    expect(castVote(s, r.id, 'v1').ok).toBe(true);
    expect(castVote(s, r.id, 'v1').code).toBe('already_voted');
    expect(castVote(s, r.id, 'v2').ok).toBe(true);
    expect(s.requests[0].voteCount).toBe(2);
    expect(s.settings.totalVotes).toBe(2);
  });
  it('blocks votes when voting disabled and resets on new round', () => {
    const s = mk();
    const r = sub(s, 'g1', 'A').data!;
    applyAdmin(s, { type: 'approve', id: r.id });
    castVote(s, r.id, 'v1');
    applyAdmin(s, { type: 'updateSettings', patch: { votingEnabled: false } });
    expect(castVote(s, r.id, 'v2').code).toBe('voting_closed');
    applyAdmin(s, { type: 'newRound' });
    expect(s.requests[0].voteCount).toBe(0);
    expect(castVote(s, r.id, 'v1').ok).toBe(true); // can vote again in new round
  });
  it('battles allow one pick per voter and pick the winner', () => {
    const s = mk();
    const a = sub(s, 'g1', 'A').data!;
    const b = sub(s, 'g2', 'B').data!;
    applyAdmin(s, { type: 'startBattle', a: a.id, b: b.id, seconds: 30 });
    const id = s.battle!.id;
    expect(castVote(s, b.id, 'v1', id).ok).toBe(true);
    expect(castVote(s, a.id, 'v1', id).code).toBe('already_voted');
    castVote(s, b.id, 'v2', id);
    castVote(s, a.id, 'v3', id);
    applyAdmin(s, { type: 'endBattle' });
    expect(s.battle!.winnerId).toBe(b.id);
    expect(castVote(s, a.id, 'v4', id).code).toBe('battle_closed');
  });
});

describe('queue management', () => {
  it('moves, sorts, reveals and finishes', () => {
    const s = mk();
    const ids = ['A', 'B', 'C'].map((t, i) => sub(s, 'g' + i, t).data!.id);
    ids.forEach((id) => applyAdmin(s, { type: 'approve', id }));
    applyAdmin(s, { type: 'move', id: ids[2], dir: -1 });
    expect(queueOf(s.requests).map((r) => r.songTitle)).toEqual(['A', 'C', 'B']);
    castVote(s, ids[1], 'v1');
    castVote(s, ids[1], 'v2');
    castVote(s, ids[2], 'v1');
    applyAdmin(s, { type: 'sortByVotes' });
    expect(queueOf(s.requests).map((r) => r.songTitle)).toEqual(['B', 'C', 'A']);
    expect(leaderOf(s.requests)?.songTitle).toBe('B');
    applyAdmin(s, { type: 'reveal', id: ids[1] });
    expect(s.command?.type).toBe('countdown');
    expect(s.requests.find((r) => r.id === ids[1])!.status).toBe('playing');
    applyAdmin(s, { type: 'playNow', id: ids[0] });
    expect(s.requests.find((r) => r.id === ids[1])!.status).toBe('played');
    applyAdmin(s, { type: 'clearQueue' });
    expect(queueOf(s.requests)).toHaveLength(0);
    applyAdmin(s, { type: 'resetEvent' });
    expect(s.requests).toHaveLength(0);
  });
});
