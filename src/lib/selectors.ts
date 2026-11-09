import type { SongRequest } from './types';
import { queueOf } from './engine';

export { queueOf };

export const nowPlayingOf = (rs: SongRequest[]) =>
  rs
    .filter((r) => r.status === 'playing')
    .sort((a, b) => (b.playedAt ?? '').localeCompare(a.playedAt ?? ''))[0] ?? null;

export const pendingOf = (rs: SongRequest[]) =>
  rs.filter((r) => r.status === 'pending').sort((a, b) => a.requestedAt.localeCompare(b.requestedAt));

export const trendingOf = (rs: SongRequest[]) =>
  rs
    .filter((r) => r.status === 'approved')
    .sort((a, b) => b.voteCount - a.voteCount || b.requestedAt.localeCompare(a.requestedAt));

export const recentOf = (rs: SongRequest[]) =>
  rs.filter((r) => r.status === 'approved').sort((a, b) => b.requestedAt.localeCompare(a.requestedAt));

export const leaderOf = (rs: SongRequest[]) => {
  const t = trendingOf(rs)[0];
  return t && t.voteCount > 0 ? t : null;
};

export const playedOf = (rs: SongRequest[]) =>
  rs
    .filter((r) => r.status === 'played' || r.status === 'playing')
    .sort((a, b) => (b.playedAt ?? '').localeCompare(a.playedAt ?? ''));

export interface GuestStat {
  key: string;
  name: string;
  count: number;
}

export function leaderboardOf(rs: SongRequest[]) {
  const live = rs.filter((r) => r.status !== 'rejected');
  const byGuest = (pick: (r: SongRequest) => number, list = live) => {
    const m = new Map<string, GuestStat>();
    for (const r of list) {
      const key = r.guestId || r.guestName.toLowerCase();
      const cur = m.get(key) ?? { key, name: r.guestName, count: 0 };
      cur.count += pick(r);
      m.set(key, cur);
    }
    return [...m.values()].filter((g) => g.count > 0).sort((a, b) => b.count - a.count);
  };
  const heroes = byGuest(() => 1, playedOf(rs));
  const mostVoted = byGuest((r) => r.voteCount);
  const artists = new Map<string, { name: string; count: number }>();
  for (const r of live) {
    const k = r.artist.toLowerCase();
    const cur = artists.get(k) ?? { name: r.artist, count: 0 };
    cur.count += 1;
    artists.set(k, cur);
  }
  const topArtists = [...artists.values()].sort((a, b) => b.count - a.count);
  const topSongs = [...live].sort((a, b) => b.voteCount - a.voteCount).filter((r) => r.voteCount > 0);
  return {
    heroes,
    mostVoted,
    topArtists,
    topSongs,
    mostPopular: topSongs[0] ?? null,
    topArtist: topArtists[0] ?? null,
  };
}

export const countBy = (rs: SongRequest[]) => {
  const c = { total: rs.length, pending: 0, approved: 0, rejected: 0, playing: 0, played: 0, skipped: 0 };
  for (const r of rs) c[r.status] += 1;
  return c;
};
