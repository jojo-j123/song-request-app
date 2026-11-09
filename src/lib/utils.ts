import type { EventSettings, ThemeConfig } from './types';

export const cn = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ');

export const uid = (prefix = '') =>
  prefix +
  (typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36));

export const nowIso = () => new Date().toISOString();

export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .slice(0, 32);
}

export const normalizeSong = (title: string, artist: string) =>
  `${title}|${artist}`
    .toLowerCase()
    .replace(/\(.*?\)|\[.*?\]/g, '')
    .replace(/feat\..*$/g, '')
    .replace(/[^a-z0-9|]/g, '');

export const clampText = (s: string | null | undefined, max: number) => (s ?? '').trim().replace(/\s+/g, ' ').slice(0, max);

export function hexToRgbTriplet(hex: string): string {
  const m = hex.replace('#', '').trim();
  const full = m.length === 3 ? m.split('').map((c) => c + c).join('') : m;
  const n = parseInt(full, 16);
  if (Number.isNaN(n) || full.length !== 6) return '139 92 246';
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

export const DEFAULT_THEME: ThemeConfig = {
  primary: '#8B5CF6',
  secondary: '#3B82F6',
  magenta: '#EC4899',
  cyan: '#22D3EE',
  background: 'aurora',
};

export const DEFAULT_SETTINGS: EventSettings = {
  votingEnabled: true,
  submissionsEnabled: true,
  maxRequestsPerGuest: 3,
  maxQueueSize: 150,
  countdownDuration: 3,
  autoApprove: false,
  displayMode: 'main',
  soundEnabled: false,
  volume: 0.6,
  animationIntensity: 'normal',
  showRequesterNames: true,
  qrUrl: null,
  votingRound: 1,
  totalVotes: 0,
  guestCount: 0,
  demo: { enabled: false, running: false, speed: 1, autoDj: true },
};

export function applyTheme(theme: ThemeConfig, el: HTMLElement = document.documentElement) {
  el.style.setProperty('--c-primary', hexToRgbTriplet(theme.primary));
  el.style.setProperty('--c-secondary', hexToRgbTriplet(theme.secondary));
  el.style.setProperty('--c-magenta', hexToRgbTriplet(theme.magenta));
  el.style.setProperty('--c-cyan', hexToRgbTriplet(theme.cyan));
}

/** Deterministic gradient "cover art" for songs without artwork. */
export function coverGradient(seed: string) {
  const h = hashString(seed);
  const palettes = [
    ['#8B5CF6', '#EC4899'],
    ['#3B82F6', '#22D3EE'],
    ['#EC4899', '#F59E0B'],
    ['#22D3EE', '#8B5CF6'],
    ['#6366F1', '#EC4899'],
    ['#14B8A6', '#3B82F6'],
    ['#F43F5E', '#8B5CF6'],
    ['#A855F7', '#22D3EE'],
  ];
  const [a, b] = palettes[h % palettes.length];
  const angle = h % 360;
  return `radial-gradient(circle at ${20 + (h % 60)}% ${20 + ((h >> 3) % 60)}%, ${b}cc, transparent 60%), linear-gradient(${angle}deg, ${a}, #0b0b18 85%)`;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

export function timeAgo(iso: string) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 45) return 'just now';
  if (s < 3600) return `${Math.round(s / 60)}m ago`;
  if (s < 86400) return `${Math.round(s / 3600)}h ago`;
  return `${Math.round(s / 86400)}d ago`;
}

export function publicBaseUrl() {
  const env = (import.meta.env.VITE_PUBLIC_URL as string | undefined)?.trim();
  if (env) return env.replace(/\/$/, '');
  return typeof window !== 'undefined' ? window.location.origin : '';
}

export function guestUrl(eventId: string, override?: string | null) {
  return override?.trim() ? override.trim() : `${publicBaseUrl()}/guest/${encodeURIComponent(eventId)}`;
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
