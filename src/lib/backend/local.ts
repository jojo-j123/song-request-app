/**
 * LOCAL backend — zero-config, runs entirely in the browser.
 * - Persistence: localStorage
 * - Realtime: BroadcastChannel + `storage` events (all tabs/windows on this device sync instantly)
 * - Atomicity: Web Locks API serialises read-modify-write across tabs
 *
 * Limitation (by design): phones on other devices can't reach this data. Use Supabase for real events.
 */
import type { Backend } from './types';
import type { ActionResult, EventInfo, EventSnapshot } from '../types';
import {
  applyAdmin,
  castVote,
  createState,
  registerGuest,
  submitRequest,
  toSnapshot,
  type LocalEventState,
} from '../engine';
import { DEFAULT_THEME, nowIso, slugify, uid } from '../utils';

const K = {
  index: 'encore:events',
  event: (id: string) => `encore:event:${id}`,
  unlocked: (id: string) => `encore:unlocked:${id}`,
};

const channel: BroadcastChannel | null =
  typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('encore-sync') : null;
const listeners = new Map<string, Set<() => void>>();

function notify(eventId: string) {
  listeners.get(eventId)?.forEach((fn) => fn());
}
channel?.addEventListener('message', (e) => notify(String(e.data?.eventId)));
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key?.startsWith('encore:event:')) notify(e.key.slice('encore:event:'.length));
  });
}

function read(id: string): LocalEventState | null {
  try {
    const raw = localStorage.getItem(K.event(id));
    return raw ? (JSON.parse(raw) as LocalEventState) : null;
  } catch {
    return null;
  }
}

function write(s: LocalEventState) {
  s.version += 1;
  localStorage.setItem(K.event(s.event.id), JSON.stringify(s));
  channel?.postMessage({ eventId: s.event.id });
  notify(s.event.id);
}

function readIndex(): string[] {
  try {
    return JSON.parse(localStorage.getItem(K.index) ?? '[]');
  } catch {
    return [];
  }
}

async function withLock<T>(id: string, fn: () => T): Promise<T> {
  const locks = (navigator as any).locks;
  if (locks?.request) return locks.request(`encore:${id}`, async () => fn());
  return fn();
}

async function mutate<T>(id: string, fn: (s: LocalEventState) => ActionResult<T>): Promise<ActionResult<T>> {
  return withLock(id, () => {
    const s = read(id);
    if (!s) return { ok: false, code: 'not_found', message: 'Event not found.' } as ActionResult<T>;
    const res = fn(s);
    if (res.ok || res.code === 'duplicate_song') write(s);
    return res;
  });
}

async function sha(s: string) {
  if (crypto?.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('encore:' + s));
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }
  return 'plain:' + s;
}

export function createLocalBackend(): Backend {
  return {
    mode: 'local',

    async getAdmin() {
      return { id: 'local-admin', email: null };
    },
    async signIn() {
      return { ok: true, code: 'ok' };
    },
    async signUp() {
      return { ok: true, code: 'ok' };
    },
    async signOut() {
      for (const id of readIndex()) localStorage.removeItem(K.unlocked(id));
    },
    async unlockEvent(eventId, pin) {
      const s = read(eventId);
      if (!s) return { ok: false, code: 'not_found', message: 'Event not found on this device.' };
      if (s.adminPin !== (await sha(pin.trim()))) return { ok: false, code: 'unauthorized', message: 'Wrong PIN.' };
      localStorage.setItem(K.unlocked(eventId), '1');
      return { ok: true, code: 'ok' };
    },
    async canAdmin(eventId) {
      return localStorage.getItem(K.unlocked(eventId)) === '1';
    },

    async listEvents() {
      return readIndex()
        .map((id) => read(id)?.event)
        .filter(Boolean)
        .sort((a, b) => b!.createdAt.localeCompare(a!.createdAt)) as EventInfo[];
    },

    async createEvent(input) {
      const base = slugify(input.id || input.name) || 'event';
      let id = base;
      while (read(id)) id = `${base}-${uid().slice(0, 4)}`;
      const event: EventInfo = {
        id,
        name: input.name.trim() || 'Untitled Event',
        logoUrl: null,
        date: input.date ?? null,
        theme: { ...DEFAULT_THEME },
        status: 'live',
        createdAt: nowIso(),
      };
      const state = createState(event, await sha((input.pin ?? '0000').trim()));
      write(state);
      localStorage.setItem(K.index, JSON.stringify([...new Set([...readIndex(), id])]));
      localStorage.setItem(K.unlocked(id), '1');
      return { ok: true, code: 'ok', data: event };
    },

    async deleteEvent(eventId) {
      localStorage.removeItem(K.event(eventId));
      localStorage.removeItem(K.unlocked(eventId));
      localStorage.setItem(K.index, JSON.stringify(readIndex().filter((x) => x !== eventId)));
      notify(eventId);
      return { ok: true, code: 'ok' };
    },

    subscribe(eventId, onSnapshot, onStatus) {
      let last = -1;
      const push = () => {
        const s = read(eventId);
        if (!s) return onSnapshot(null);
        if (s.version === last) return;
        last = s.version;
        onSnapshot(toSnapshot(s) as EventSnapshot);
      };
      const set = listeners.get(eventId) ?? new Set();
      set.add(push);
      listeners.set(eventId, set);
      onStatus?.('live');
      push();
      // safety net in case a broadcast is missed (e.g. tab was frozen)
      const t = setInterval(push, 4000);
      return () => {
        set.delete(push);
        clearInterval(t);
      };
    },

    async registerGuest(eventId, guestId) {
      await mutate(eventId, (s) => {
        const before = s.guests.length;
        registerGuest(s, guestId);
        return s.guests.length > before ? { ok: true, code: 'ok' } : { ok: false, code: 'ok' };
      });
    },
    submitRequest: (eventId, input) => mutate(eventId, (s) => submitRequest(s, input)),
    castVote: (eventId, requestId, voterId, battleId) => mutate(eventId, (s) => castVote(s, requestId, voterId, battleId)),
    async admin(eventId, action) {
      if (localStorage.getItem(K.unlocked(eventId)) !== '1')
        return { ok: false, code: 'unauthorized', message: 'Unlock the event first.' };
      return mutate(eventId, (s) => applyAdmin(s, action));
    },
  };
}
