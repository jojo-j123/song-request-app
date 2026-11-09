import { useEffect, useState } from 'react';
import { getBackend, type Backend } from '@/lib/backend';
import type { ConnectionStatus, EventSnapshot } from '@/lib/types';
import { applyTheme } from '@/lib/utils';

export function useBackend() {
  const [backend, setBackend] = useState<Backend | null>(null);
  useEffect(() => {
    let alive = true;
    getBackend().then((b) => alive && setBackend(b));
    return () => {
      alive = false;
    };
  }, []);
  return backend;
}

/** Live event snapshot + connection status. `undefined` = loading, `null` = not found. */
export function useEventSnapshot(eventId: string | undefined) {
  const backend = useBackend();
  const [snap, setSnap] = useState<EventSnapshot | null | undefined>(undefined);
  const [status, setStatus] = useState<ConnectionStatus>('connecting');

  useEffect(() => {
    if (!backend || !eventId) return;
    return backend.subscribe(eventId, setSnap, setStatus);
  }, [backend, eventId]);

  useEffect(() => {
    if (snap?.event.theme) applyTheme(snap.event.theme);
  }, [snap?.event.theme]);

  return { backend, snap, status };
}

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
