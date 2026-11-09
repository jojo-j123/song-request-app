import { AnimatePresence, motion, animate, useMotionValue, useTransform } from 'framer-motion';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Wifi, WifiOff, X } from 'lucide-react';
import { cn, coverGradient, initials } from '@/lib/utils';
import type { ConnectionStatus } from '@/lib/types';

/* ------------------------------------------------------------------ Brand */
export function BrandMark({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" className={className} aria-hidden>
      <defs>
        <linearGradient id="bm" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="rgb(var(--c-primary))" />
          <stop offset=".5" stopColor="rgb(var(--c-magenta))" />
          <stop offset="1" stopColor="rgb(var(--c-cyan))" />
        </linearGradient>
      </defs>
      <g fill="url(#bm)">
        <rect x="6" y="26" width="7" height="12" rx="3.5" />
        <rect x="17" y="16" width="7" height="32" rx="3.5" />
        <rect x="28" y="8" width="7" height="48" rx="3.5" />
        <rect x="39" y="18" width="7" height="28" rx="3.5" />
        <rect x="50" y="27" width="7" height="10" rx="3.5" />
      </g>
    </svg>
  );
}

export function EventLogo({ name, logoUrl, size = 48 }: { name: string; logoUrl: string | null; size?: number }) {
  if (logoUrl)
    return <img src={logoUrl} alt={name} style={{ width: size, height: size }} className="rounded-2xl object-cover" />;
  return (
    <div
      style={{ width: size, height: size }}
      className="grid place-items-center rounded-2xl bg-gradient-to-br from-primary via-magenta to-cyan p-[2px] shadow-glow"
    >
      <div className="grid h-full w-full place-items-center rounded-[14px] bg-ink">
        <BrandMark size={size * 0.6} />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Artwork */
export function Artwork({
  url,
  seed,
  className,
  rounded = 'rounded-2xl',
  label,
}: {
  url: string | null | undefined;
  seed: string;
  className?: string;
  rounded?: string;
  label?: string;
}) {
  const [failed, setFailed] = useState(false);
  const show = url && !failed;
  return (
    <div className={cn('relative shrink-0 overflow-hidden bg-ink-3', rounded, className)} style={{ containerType: 'inline-size' }}>
      {show ? (
        <img
          src={url}
          alt=""
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="absolute inset-0" style={{ background: coverGradient(seed) }}>
          <div className="absolute inset-0 grid place-items-center">
            <span className="font-display font-black text-white/85 mix-blend-overlay" style={{ fontSize: '38cqw' }}>
              {label ? initials(label) : '♪'}
            </span>
          </div>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_30%,rgba(255,255,255,0.25),transparent_45%)]" />
        </div>
      )}
      <div className={cn('pointer-events-none absolute inset-0 ring-1 ring-inset ring-white/10', rounded)} />
    </div>
  );
}

/* ---------------------------------------------------------------- Status */
export function LiveDot({ className, color = 'bg-rose-500' }: { className?: string; color?: string }) {
  return (
    <span className={cn('relative inline-flex h-2.5 w-2.5', className)}>
      <span className={cn('pulse-ring absolute inset-0 rounded-full text-rose-500/70')} />
      <span className={cn('relative inline-flex h-full w-full rounded-full', color)} />
    </span>
  );
}

export function ConnectionBadge({ status, className }: { status: ConnectionStatus; className?: string }) {
  const map = {
    live: { icon: Wifi, text: 'Live', cls: 'text-emerald-300 border-emerald-400/30 bg-emerald-400/10' },
    connecting: { icon: Loader2, text: 'Connecting', cls: 'text-white/70 border-white/10 bg-white/5' },
    reconnecting: { icon: Loader2, text: 'Reconnecting', cls: 'text-amber-200 border-amber-300/30 bg-amber-300/10' },
    offline: { icon: WifiOff, text: 'Offline', cls: 'text-rose-200 border-rose-400/30 bg-rose-400/10' },
  }[status];
  const Icon = map.icon;
  return (
    <span className={cn('chip', map.cls, className)}>
      <Icon className={cn('h-3.5 w-3.5', status !== 'live' && status !== 'offline' && 'animate-spin')} />
      {map.text}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-5 w-5 animate-spin', className)} />;
}

export function FullScreenMessage({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="grid min-h-[100dvh] place-items-center bg-ink p-6 text-center">
      <div className="max-w-md">
        <BrandMark size={48} className="mx-auto mb-6" />
        <h1 className="font-display text-2xl font-bold">{title}</h1>
        <div className="mt-3 text-white/60">{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------ Equalizer */
export function Equalizer({
  bars = 5,
  className,
  barClass = 'w-1.5',
  playing = true,
}: {
  bars?: number;
  className?: string;
  barClass?: string;
  playing?: boolean;
}) {
  return (
    <div className={cn('flex h-6 items-end gap-[3px]', className)} aria-hidden>
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className={cn('eq-bar h-full rounded-full bg-gradient-to-t from-primary via-magenta to-cyan', barClass)}
          style={{
            animationDelay: `${(i * 0.17) % 1}s`,
            animationDuration: `${0.7 + ((i * 37) % 50) / 100}s`,
            animationPlayState: playing ? 'running' : 'paused',
          }}
        />
      ))}
    </div>
  );
}

/* ----------------------------------------------------------- CountUp */
export function CountUp({ value, className }: { value: number; className?: string }) {
  const mv = useMotionValue(value);
  const rounded = useTransform(mv, (v) => Math.round(v).toLocaleString());
  useEffect(() => {
    const c = animate(mv, value, { duration: 0.8, ease: [0.2, 0.8, 0.2, 1] });
    return c.stop;
  }, [value, mv]);
  return <motion.span className={className}>{rounded}</motion.span>;
}

/* ------------------------------------------------------------- Toggle */
export function Toggle({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: ReactNode;
  hint?: ReactNode;
  disabled?: boolean;
}) {
  return (
    <label className={cn('flex cursor-pointer items-center justify-between gap-4 py-2', disabled && 'opacity-50')}>
      {(label || hint) && (
        <span>
          <span className="block text-sm font-medium text-white/90">{label}</span>
          {hint && <span className="block text-xs text-white/45">{hint}</span>}
        </span>
      )}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          'relative h-7 w-12 shrink-0 rounded-full border transition-colors',
          checked ? 'border-primary/60 bg-gradient-to-r from-primary to-magenta' : 'border-white/15 bg-white/10',
        )}
      >
        <motion.span
          layout
          transition={{ type: 'spring', stiffness: 600, damping: 35 }}
          className={cn('absolute top-0.5 h-[22px] w-[22px] rounded-full bg-white shadow', checked ? 'right-0.5' : 'left-0.5')}
        />
      </button>
    </label>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: Array<{ value: T; label: ReactNode }>;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cn('flex rounded-2xl border border-white/10 bg-white/[0.03] p-1', className)}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            'relative flex-1 rounded-xl px-3 py-2 text-sm font-semibold transition-colors',
            value === o.value ? 'text-white' : 'text-white/50 hover:text-white/80',
          )}
        >
          {value === o.value && (
            <motion.span
              layoutId={`seg-${options.map((x) => x.value).join('')}`}
              className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/80 to-magenta/70 shadow-glow"
              transition={{ type: 'spring', stiffness: 500, damping: 40 }}
            />
          )}
          <span className="relative z-10 inline-flex items-center gap-1.5">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------ Toast + Confirm */
interface ToastItem {
  id: number;
  kind: 'ok' | 'error' | 'info';
  text: string;
}
interface ConfirmReq {
  title: string;
  body?: string;
  confirmText?: string;
  danger?: boolean;
  resolve: (v: boolean) => void;
}
const UICtx = createContext<{
  toast: (text: string, kind?: ToastItem['kind']) => void;
  confirm: (o: Omit<ConfirmReq, 'resolve'>) => Promise<boolean>;
} | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmReq, setConfirmReq] = useState<ConfirmReq | null>(null);
  const n = useRef(0);
  const toast = useCallback((text: string, kind: ToastItem['kind'] = 'ok') => {
    const id = ++n.current;
    setToasts((t) => [...t.slice(-3), { id, kind, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3200);
  }, []);
  const confirm = useCallback(
    (o: Omit<ConfirmReq, 'resolve'>) => new Promise<boolean>((resolve) => setConfirmReq({ ...o, resolve })),
    [],
  );
  const close = (v: boolean) => {
    confirmReq?.resolve(v);
    setConfirmReq(null);
  };
  return (
    <UICtx.Provider value={{ toast, confirm }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[100] flex flex-col items-center gap-2 px-4">
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className={cn(
                'glass-strong pointer-events-auto flex max-w-md items-center gap-2 rounded-2xl px-4 py-3 text-sm shadow-2xl',
                t.kind === 'error' && 'border-rose-400/40',
              )}
            >
              {t.kind === 'error' ? (
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-300" />
              ) : (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
              )}
              {t.text}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {confirmReq && (
          <motion.div
            className="fixed inset-0 z-[110] grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => close(false)}
          >
            <motion.div
              initial={{ scale: 0.92, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-strong w-full max-w-sm rounded-3xl p-6"
              role="alertdialog"
            >
              <div className="flex items-start justify-between gap-4">
                <h3 className="font-display text-lg font-bold">{confirmReq.title}</h3>
                <button onClick={() => close(false)} className="text-white/50 hover:text-white" aria-label="Close">
                  <X className="h-5 w-5" />
                </button>
              </div>
              {confirmReq.body && <p className="mt-2 text-sm text-white/60">{confirmReq.body}</p>}
              <div className="mt-6 flex gap-3">
                <button className="btn-ghost flex-1 py-3" onClick={() => close(false)}>
                  Cancel
                </button>
                <button
                  autoFocus
                  className={cn(confirmReq.danger ? 'btn-danger' : 'btn-primary', 'flex-1 py-3')}
                  onClick={() => close(true)}
                >
                  {confirmReq.confirmText ?? 'Confirm'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </UICtx.Provider>
  );
}

export function useUI() {
  const c = useContext(UICtx);
  if (!c) throw new Error('UIProvider missing');
  return c;
}
