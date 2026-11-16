/**
 * Jukebox library: audio files stay on the player laptop.
 *  - the files are kept in this browser's IndexedDB so they survive reloads;
 *  - only title / artist / duration (and a public artwork URL) are shared with the event.
 */
import type { LibraryTrack } from './types';
import { searchSongs } from './itunes';

export type NewTrack = Omit<LibraryTrack, 'id' | 'eventId'>;

/* ------------------------------------------------------------- file store */
const DB = 'encore-jukebox';
const STORE = 'files';

function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
const key = (eventId: string, fileKey: string) => `${eventId}::${fileKey}`;

async function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const req = fn(d.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export const fileKeyOf = (f: File) => `${f.name}|${f.size}`;
export const saveFile = (eventId: string, f: File) => tx('readwrite', (s) => s.put(f, key(eventId, fileKeyOf(f))));
export const loadFile = (eventId: string, fileKey: string) => tx<Blob | undefined>('readonly', (s) => s.get(key(eventId, fileKey)));
export const deleteFile = (eventId: string, fileKey: string) => tx('readwrite', (s) => s.delete(key(eventId, fileKey)));

/** File keys stored on this device for an event. */
export async function storedKeys(eventId: string): Promise<Set<string>> {
  const all = await tx<IDBValidKey[]>('readonly', (s) => s.getAllKeys());
  const prefix = `${eventId}::`;
  return new Set(all.map(String).filter((k) => k.startsWith(prefix)).map((k) => k.slice(prefix.length)));
}

export async function clearFiles(eventId: string) {
  for (const k of await storedKeys(eventId)) await deleteFile(eventId, k);
}

/* ------------------------------------------------------------------- tags */
const AUDIO_EXT = /\.(mp3|m4a|aac|wav|ogg|oga|flac|opus|webm)$/i;
export const isAudioFile = (f: File) => f.type.startsWith('audio/') || AUDIO_EXT.test(f.name);

function decodeText(bytes: Uint8Array): string {
  if (!bytes.length) return '';
  const enc = bytes[0];
  const body = bytes.subarray(1);
  const label = enc === 1 ? 'utf-16' : enc === 2 ? 'utf-16be' : enc === 3 ? 'utf-8' : 'iso-8859-1';
  try {
    return new TextDecoder(label).decode(body).replace(/\0/g, '').trim();
  } catch {
    return '';
  }
}

/** Minimal ID3v2 reader (v2.2 / v2.3 / v2.4): title + artist. */
async function readId3(file: File): Promise<{ title?: string; artist?: string }> {
  const head = new Uint8Array(await file.slice(0, 10).arrayBuffer());
  if (head.length < 10 || head[0] !== 0x49 || head[1] !== 0x44 || head[2] !== 0x33) return {};
  const ver = head[3];
  const size = ((head[6] & 0x7f) << 21) | ((head[7] & 0x7f) << 14) | ((head[8] & 0x7f) << 7) | (head[9] & 0x7f);
  const buf = new Uint8Array(await file.slice(10, 10 + Math.min(size, 1_500_000)).arrayBuffer());
  const out: { title?: string; artist?: string } = {};
  const idLen = ver === 2 ? 3 : 4;
  const headLen = ver === 2 ? 6 : 10;
  let p = 0;
  while (p + headLen <= buf.length && !(out.title && out.artist)) {
    if (buf[p] === 0) break; // padding
    const id = String.fromCharCode(...buf.subarray(p, p + idLen));
    let len: number;
    if (ver === 2) len = (buf[p + 3] << 16) | (buf[p + 4] << 8) | buf[p + 5];
    else if (ver === 4) len = ((buf[p + 4] & 0x7f) << 21) | ((buf[p + 5] & 0x7f) << 14) | ((buf[p + 6] & 0x7f) << 7) | (buf[p + 7] & 0x7f);
    else len = ((buf[p + 4] << 24) | (buf[p + 5] << 16) | (buf[p + 6] << 8) | buf[p + 7]) >>> 0;
    const start = p + headLen;
    if (len <= 0 || start + len > buf.length) break;
    if (id === 'TIT2' || id === 'TT2') out.title = decodeText(buf.subarray(start, start + len));
    else if (id === 'TPE1' || id === 'TP1') out.artist = decodeText(buf.subarray(start, start + len));
    p = start + len;
  }
  return out;
}

/** "01 - Artist - Title.mp3" → { artist, title } as a fallback when a file has no tags. */
export function fromFilename(name: string): { title: string; artist: string } {
  const base = name
    .replace(/\.[^.]+$/, '')
    .replace(/_/g, ' ')
    .replace(/^\s*\d{1,3}\s*[-.)]\s*/, '')
    .trim();
  const parts = base.split(/\s+[-–—]\s+/);
  if (parts.length >= 2) return { artist: parts[0].trim(), title: parts.slice(1).join(' - ').trim() };
  return { title: base || 'Untitled', artist: 'Unknown artist' };
}

function durationOf(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const a = new Audio();
    const done = (d: number) => {
      URL.revokeObjectURL(url);
      resolve(Number.isFinite(d) ? d : 0);
    };
    const t = setTimeout(() => done(0), 5000);
    a.preload = 'metadata';
    a.onloadedmetadata = () => {
      clearTimeout(t);
      done(a.duration);
    };
    a.onerror = () => {
      clearTimeout(t);
      done(0);
    };
    a.src = url;
  });
}

/* ----------------------------------------------------------------- import */
/**
 * Reads tags + duration for each file and stores the file on this device.
 * Cover art is looked up by title/artist on the public iTunes catalogue (best effort — it gives
 * up quietly after a few failures so an offline laptop still imports at full speed).
 */
export async function importFiles(
  eventId: string,
  files: File[],
  onProgress?: (done: number, total: number) => void,
): Promise<{ tracks: NewTrack[]; skipped: number }> {
  const audio = files.filter(isAudioFile);
  const tracks: NewTrack[] = [];
  let artFailures = 0;
  let done = 0;
  const worker = async (file: File) => {
    try {
      const tags = await readId3(file).catch(() => ({}) as { title?: string; artist?: string });
      const guess = fromFilename(file.name);
      const title = tags.title || guess.title;
      const artist = tags.artist || guess.artist;
      const durationSec = await durationOf(file);
      let artworkUrl: string | null = null;
      if (artFailures < 3 && artist !== 'Unknown artist') {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 2500);
        try {
          const hits = await searchSongs(`${title} ${artist}`, ctrl.signal);
          artworkUrl = hits[0]?.artworkUrl ?? null;
        } catch {
          artFailures++;
        }
        clearTimeout(t);
      }
      await saveFile(eventId, file);
      tracks.push({ title, artist, durationSec: Math.round(durationSec), artworkUrl, fileKey: fileKeyOf(file) });
    } finally {
      onProgress?.(++done, audio.length);
    }
  };
  // small pool: fast, without opening hundreds of audio decoders at once
  const queue = [...audio];
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      for (let f = queue.shift(); f; f = queue.shift()) await worker(f);
    }),
  );
  return { tracks, skipped: files.length - audio.length };
}

export const formatDuration = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
