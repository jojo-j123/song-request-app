import { useCallback, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Lock, LogIn } from 'lucide-react';
import type { Backend } from '@/lib/backend';
import type { AdminAction, SongRequest } from '@/lib/types';
import { Artwork, BrandMark, FullScreenMessage, Spinner, useUI } from '@/components/ui';
import { useAdminGate } from '@/hooks/useAdminGate';
import { cn, timeAgo } from '@/lib/utils';

export function useAdminActions(backend: Backend | null, eventId: string) {
  const { toast } = useUI();
  const [busy, setBusy] = useState<string | null>(null);
  const run = useCallback(
    async (action: AdminAction, success?: string, key?: string) => {
      if (!backend) return false;
      const k = key ?? action.type + ('id' in action ? action.id : '');
      setBusy(k);
      const res = await backend.admin(eventId, action).catch((e) => ({ ok: false, code: 'error', message: String(e) }) as const);
      setBusy(null);
      if (!res.ok) toast(res.message ?? 'Action failed', 'error');
      else if (success) toast(success);
      return res.ok;
    },
    [backend, eventId, toast],
  );
  return { run, busy };
}

export function AdminGate({ backend, eventId, children }: { backend: Backend | null; eventId: string; children: ReactNode }) {
  const { state, recheck } = useAdminGate(backend, eventId);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  if (!backend || state === 'checking')
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-ink">
        <Spinner className="h-8 w-8 text-primary" />
      </div>
    );
  if (state === 'allowed') return <>{children}</>;
  if (backend.mode === 'supabase')
    return (
      <FullScreenMessage title="Organizer access only">
        <p>Sign in with the account that owns this event.</p>
        <Link to={`/login?next=${encodeURIComponent(location.pathname)}`} className="btn-primary mt-6 px-6 py-3">
          <LogIn className="h-4 w-4" /> Sign in
        </Link>
      </FullScreenMessage>
    );
  return (
    <div className="grid min-h-[100dvh] place-items-center bg-ink p-6">
      <form
        className="glass w-full max-w-sm rounded-3xl p-8 text-center"
        onSubmit={async (e) => {
          e.preventDefault();
          const r = await backend.unlockEvent(eventId, pin);
          if (r.ok) recheck();
          else setError(r.message ?? 'Wrong PIN');
        }}
      >
        <BrandMark size={44} className="mx-auto" />
        <h1 className="mt-5 font-display text-xl font-bold">Unlock DJ controls</h1>
        <p className="mt-1 text-sm text-white/55">Enter the event PIN you set when creating “{eventId}”.</p>
        <div className="relative mt-6">
          <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input
            className="field pl-11 text-center font-mono tracking-[0.5em]"
            inputMode="numeric"
            autoFocus
            placeholder="••••"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
          />
        </div>
        {error && <p className="mt-2 text-sm text-rose-300">{error}</p>}
        <button className="btn-primary mt-5 w-full py-3">Unlock</button>
        <Link to="/" className="mt-4 block text-sm text-white/50 hover:text-white">
          ← Back to events
        </Link>
      </form>
    </div>
  );
}

export const STATUS_STYLE: Record<SongRequest['status'], string> = {
  pending: 'border-amber-300/40 bg-amber-300/10 text-amber-200',
  approved: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
  playing: 'border-cyan/50 bg-cyan/15 text-cyan',
  played: 'border-magenta/40 bg-magenta/10 text-pink-200',
  rejected: 'border-white/10 bg-white/5 text-white/40',
  skipped: 'border-white/10 bg-white/5 text-white/40',
};

export function SongCell({ r, sub }: { r: SongRequest; sub?: ReactNode }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Artwork url={r.artworkUrl} seed={r.songTitle} label={r.songTitle} className="h-11 w-11" rounded="rounded-xl" />
      <div className="min-w-0">
        <div className="truncate font-semibold">{r.songTitle}</div>
        <div className="truncate text-xs text-white/50">
          {r.artist} · <span className="text-white/70">{r.guestName}</span>
          {sub ?? <> · {timeAgo(r.requestedAt)}</>}
          {r.isDemo && <span className="ml-1.5 rounded bg-amber-300/15 px-1 text-[10px] font-bold text-amber-200">DEMO</span>}
        </div>
        {r.dedicatedTo && <div className="truncate text-xs text-pink-200/80">♥ for {r.dedicatedTo}{r.message ? ` — “${r.message}”` : ''}</div>}
      </div>
    </div>
  );
}

export function Panel({ title, icon, actions, children, className }: { title?: ReactNode; icon?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('rounded-3xl border border-white/[0.07] bg-ink-2/70 p-5', className)}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-display text-base font-bold">
            {icon}
            {title}
          </h2>
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function StatCard({ label, value, accent, sub }: { label: string; value: ReactNode; accent?: string; sub?: ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/[0.07] bg-ink-2/70 p-5">
      <div className={cn('absolute -right-6 -top-6 h-20 w-20 rounded-full blur-2xl', accent ?? 'bg-primary/30')} />
      <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">{label}</div>
      <div className="mt-2 truncate font-display text-3xl font-black">{value}</div>
      {sub && <div className="mt-1 truncate text-xs text-white/50">{sub}</div>}
    </div>
  );
}
