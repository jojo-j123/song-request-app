import type { Backend } from './types';
import { createLocalBackend } from './local';

const url = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)?.trim();

export const isSupabaseConfigured = !!(url && key);

let instance: Backend | null = null;
let pending: Promise<Backend> | null = null;

/** Lazily resolves the active backend. Supabase SDK is only downloaded when configured. */
export function getBackend(): Promise<Backend> {
  if (instance) return Promise.resolve(instance);
  if (!pending) {
    pending = (async () => {
      if (isSupabaseConfigured) {
        const { createSupabaseBackend } = await import('./supabase');
        instance = createSupabaseBackend(url!, key!);
      } else {
        instance = createLocalBackend();
      }
      return instance;
    })();
  }
  return pending;
}

export type { Backend };
