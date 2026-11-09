import { useCallback, useEffect, useState } from 'react';
import type { Backend } from '@/lib/backend';

/** Resolves whether the current user may operate this event. */
export function useAdminGate(backend: Backend | null, eventId: string | undefined) {
  const [state, setState] = useState<'checking' | 'allowed' | 'denied'>('checking');
  const recheck = useCallback(async () => {
    if (!backend || !eventId) return;
    setState((await backend.canAdmin(eventId)) ? 'allowed' : 'denied');
  }, [backend, eventId]);
  useEffect(() => {
    recheck();
  }, [recheck]);
  return { state, recheck };
}
