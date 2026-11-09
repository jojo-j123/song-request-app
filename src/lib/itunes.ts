export interface TrackResult {
  id: string;
  title: string;
  artist: string;
  album: string;
  artworkUrl: string | null;
}

const cache = new Map<string, TrackResult[]>();

/**
 * Song discovery via the public iTunes Search API (no key required, CORS-enabled).
 * Metadata + artwork only — the app never streams audio.
 */
export async function searchSongs(term: string, signal?: AbortSignal): Promise<TrackResult[]> {
  const q = term.trim();
  if (q.length < 2) return [];
  if (cache.has(q.toLowerCase())) return cache.get(q.toLowerCase())!;
  const url = `https://itunes.apple.com/search?media=music&entity=song&limit=12&term=${encodeURIComponent(q)}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error('search failed');
  const json = await res.json();
  const seen = new Set<string>();
  const out: TrackResult[] = [];
  for (const t of json.results ?? []) {
    const key = `${t.trackName}|${t.artistName}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      id: String(t.trackId),
      title: t.trackName,
      artist: t.artistName,
      album: t.collectionName ?? '',
      artworkUrl: t.artworkUrl100 ? String(t.artworkUrl100).replace('100x100bb', '600x600bb') : null,
    });
  }
  cache.set(q.toLowerCase(), out);
  return out;
}
