import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import {
  AlertTriangle,
  ArrowLeft,
  Copy,
  ExternalLink,
  FlaskConical,
  Headphones,
  LayoutDashboard,
  ListOrdered,
  Monitor,
  Settings2,
  Sparkles,
  Swords,
  Inbox,
} from 'lucide-react';
import { useEventSnapshot } from '@/hooks/useEvent';
import { useEventHost } from '@/lib/demo/simulator';
import { countBy, leaderOf, nowPlayingOf, pendingOf } from '@/lib/selectors';
import { guestUrl, cn } from '@/lib/utils';
import { BrandMark, ConnectionBadge, FullScreenMessage, Spinner, useUI } from '@/components/ui';
import { AdminGate, Panel, SongCell, StatCard, useAdminActions } from '@/components/admin/common';
import { DisplayPanel, EventControls, IconBtn, MomentsPanel, QueuePanel, RequestsPanel, VotingPanel } from '@/components/admin/panels';
import { DemoPanel, SettingsPanel } from '@/components/admin/settings';
import { Check, X } from 'lucide-react';
import type { EventSnapshot } from '@/lib/types';
import type { Backend } from '@/lib/backend';

type Section = 'overview' | 'requests' | 'queue' | 'screen' | 'voting' | 'settings' | 'demo';
const NAV: Array<{ id: Section; label: string; icon: React.ReactNode }> = [
  { id: 'overview', label: 'Overview', icon: <LayoutDashboard className="h-4 w-4" /> },
  { id: 'requests', label: 'Requests', icon: <Inbox className="h-4 w-4" /> },
  { id: 'queue', label: 'Queue', icon: <ListOrdered className="h-4 w-4" /> },
  { id: 'screen', label: 'Screen & Moments', icon: <Sparkles className="h-4 w-4" /> },
  { id: 'voting', label: 'Voting', icon: <Swords className="h-4 w-4" /> },
  { id: 'settings', label: 'Settings', icon: <Settings2 className="h-4 w-4" /> },
  { id: 'demo', label: 'Demo mode', icon: <FlaskConical className="h-4 w-4" /> },
];

export default function Admin() {
  const { eventId = '' } = useParams();
  const { backend, snap, status } = useEventSnapshot(eventId);
  return (
    <AdminGate backend={backend} eventId={eventId}>
      {snap === undefined ? (
        <div className="grid min-h-screen place-items-center bg-ink">
          <Spinner className="h-8 w-8 text-primary" />
        </div>
      ) : snap === null ? (
        <FullScreenMessage title="Event not found" />
      ) : (
        <AdminInner backend={backend!} snap={snap} status={status} />
      )}
    </AdminGate>
  );
}

function AdminInner({ backend, snap, status }: { backend: Backend; snap: EventSnapshot; status: Parameters<typeof ConnectionBadge>[0]['status'] }) {
  const eventId = snap.event.id;
  const [section, setSection] = useState<Section>('overview');
  const { run } = useAdminActions(backend, eventId);
  useEventHost(backend, snap, true);
  const pendingCount = snap.requests.filter((r) => r.status === 'pending').length;

  return (
    <div className="min-h-screen bg-ink text-white">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top_left,rgb(var(--c-primary)/0.12),transparent_50%)]" />
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-ink/80 backdrop-blur-xl">
        <div className="flex items-center gap-4 px-4 py-3 lg:px-6">
          <Link to="/" className="text-white/50 hover:text-white" aria-label="All events">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <BrandMark size={26} />
          <div className="min-w-0">
            <div className="truncate font-display font-bold">{snap.event.name}</div>
            <div className="text-[11px] uppercase tracking-[0.2em] text-white/40">DJ Control Center</div>
          </div>
          {snap.settings.demo.enabled && <span className="chip border-amber-300/40 bg-amber-300/10 text-amber-200">DEMO</span>}
          <ConnectionBadge status={status} className="hidden sm:inline-flex" />
          <div className="ml-auto flex items-center gap-2">
            <Link to={`/dj/${eventId}`} className="btn-ghost px-3 py-2 text-sm">
              <Headphones className="h-4 w-4" /> <span className="hidden md:inline">DJ mode</span>
            </Link>
            <a href={`/display/${eventId}`} target="_blank" rel="noreferrer" className="btn-primary px-3 py-2 text-sm">
              <Monitor className="h-4 w-4" /> <span className="hidden md:inline">Open display</span>
            </a>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-4 pb-2 lg:hidden">
          {NAV.map((n) => (
            <button key={n.id} onClick={() => setSection(n.id)} className={cn('chip shrink-0 py-1.5', section === n.id && 'border-primary/60 bg-primary/20 text-white')}>
              {n.icon} {n.label}
              {n.id === 'requests' && pendingCount > 0 && <span className="rounded-full bg-amber-300 px-1.5 text-[10px] text-ink">{pendingCount}</span>}
            </button>
          ))}
        </nav>
      </header>

      <div className="relative flex">
        <aside className="sticky top-[65px] hidden h-[calc(100vh-65px)] w-60 shrink-0 flex-col gap-1 border-r border-white/[0.06] p-4 lg:flex">
          {NAV.map((n) => (
            <button
              key={n.id}
              onClick={() => setSection(n.id)}
              className={cn(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
                section === n.id ? 'bg-gradient-to-r from-primary/25 to-transparent text-white' : 'text-white/55 hover:bg-white/[0.04] hover:text-white',
              )}
            >
              {n.icon}
              {n.label}
              {n.id === 'requests' && pendingCount > 0 && <span className="ml-auto rounded-full bg-amber-300 px-2 text-xs font-bold text-ink">{pendingCount}</span>}
            </button>
          ))}
          <ShareBox eventId={eventId} qrUrl={snap.settings.qrUrl} />
        </aside>

        <main className="min-w-0 flex-1 space-y-5 p-4 lg:p-6">
          {backend.mode === 'local' && (
            <div className="flex items-start gap-3 rounded-2xl border border-amber-300/30 bg-amber-300/[0.06] p-4 text-sm text-amber-100/90">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <b>Local mode.</b> Everything syncs instantly between tabs on <i>this device</i> (perfect for demos), but guests' phones can't reach it. Connect
                Supabase (see README) before a real event.
              </div>
            </div>
          )}
          {section === 'overview' && <Overview snap={snap} run={run} />}
          {section === 'requests' && <RequestsPanel snap={snap} run={run} />}
          {section === 'queue' && <QueuePanel snap={snap} run={run} />}
          {section === 'screen' && (
            <div className="grid gap-5 xl:grid-cols-2">
              <DisplayPanel snap={snap} run={run} />
              <MomentsPanel snap={snap} run={run} />
              <ScreenLinks eventId={eventId} />
            </div>
          )}
          {section === 'voting' && <VotingPanel snap={snap} run={run} />}
          {section === 'settings' && (
            <div className="space-y-5">
              <SettingsPanel snap={snap} run={run} />
              <EventControls snap={snap} run={run} />
            </div>
          )}
          {section === 'demo' && <DemoPanel snap={snap} run={run} />}
        </main>
      </div>
    </div>
  );
}

function Overview({ snap, run }: { snap: EventSnapshot; run: ReturnType<typeof useAdminActions>['run'] }) {
  const c = countBy(snap.requests);
  const leader = leaderOf(snap.requests);
  const playing = nowPlayingOf(snap.requests);
  const pending = pendingOf(snap.requests).slice(0, 6);
  const s = snap.settings;
  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        <StatCard label="Total requests" value={c.total} />
        <StatCard label="Pending" value={c.pending} accent="bg-amber-300/30" />
        <StatCard label="In queue" value={c.approved} accent="bg-emerald-400/30" />
        <StatCard label="Total votes" value={s.totalVotes.toLocaleString()} accent="bg-magenta/30" />
        <StatCard label="Guests" value={s.guestCount} accent="bg-cyan/30" />
        <StatCard label="Most voted" value={leader ? leader.voteCount : '—'} sub={leader?.songTitle ?? 'No votes yet'} accent="bg-amber-300/30" />
        <StatCard
          label="Event status"
          value={<span className={snap.event.status === 'live' ? 'text-emerald-300' : 'text-white/50'}>{snap.event.status === 'live' ? 'LIVE' : 'ENDED'}</span>}
          sub={`${s.submissionsEnabled ? 'Requests open' : 'Requests paused'} · ${s.votingEnabled ? 'Voting on' : 'Voting off'}`}
        />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <div className="space-y-5">
          <Panel title="Now playing" icon={<Headphones className="h-4 w-4 text-cyan" />}>
            {playing ? <SongCell r={playing} /> : <div className="text-sm text-white/45">Nothing marked as playing.</div>}
          </Panel>
          <Panel title={`Incoming (${c.pending})`} icon={<Inbox className="h-4 w-4 text-amber-300" />}>
            <div className="space-y-1.5">
              {pending.map((r) => (
                <div key={r.id} className="flex items-center gap-2 rounded-2xl bg-white/[0.03] p-2">
                  <div className="min-w-0 flex-1">
                    <SongCell r={r} />
                  </div>
                  <IconBtn title="Approve" className="text-emerald-300" onClick={() => run({ type: 'approve', id: r.id })}>
                    <Check />
                  </IconBtn>
                  <IconBtn title="Reject" className="text-rose-300" onClick={() => run({ type: 'reject', id: r.id })}>
                    <X />
                  </IconBtn>
                </div>
              ))}
              {!pending.length && <div className="py-4 text-sm text-white/45">All caught up.</div>}
            </div>
          </Panel>
        </div>
        <div className="space-y-5">
          <DisplayPanel snap={snap} run={run} />
          <VotingPanel snap={snap} run={run} />
        </div>
      </div>
    </>
  );
}

function ShareBox({ eventId, qrUrl }: { eventId: string; qrUrl: string | null }) {
  const { toast } = useUI();
  const url = guestUrl(eventId, qrUrl);
  return (
    <div className="mt-auto rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3">
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/45">Guest link</div>
      <div className="rounded-xl bg-white p-2">
        <QRCodeSVG value={url} size={180} className="h-auto w-full" />
      </div>
      <button
        className="mt-2 flex w-full items-center gap-2 truncate text-left text-xs text-white/60 hover:text-white"
        onClick={() => {
          navigator.clipboard?.writeText(url);
          toast('Guest link copied');
        }}
      >
        <Copy className="h-3.5 w-3.5 shrink-0" /> <span className="truncate">{url}</span>
      </button>
    </div>
  );
}

function ScreenLinks({ eventId }: { eventId: string }) {
  const links = [
    ['Main LED display', `/display/${eventId}`, 'Follows the mode you pick above'],
    ['Request Wall', `/request-wall/${eventId}`, 'Always shows the floating wall'],
    ['Leaderboard', `/leaderboard/${eventId}`, 'Always shows rankings & Wall of Fame'],
    ['Guest page', `/guest/${eventId}`, 'What guests see after scanning'],
    ['DJ mode', `/dj/${eventId}`, 'Simplified booth controls'],
  ];
  return (
    <Panel title="Screens & links" icon={<ExternalLink className="h-4 w-4 text-cyan" />} className="xl:col-span-2">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {links.map(([t, href, d]) => (
          <a key={href} href={href} target="_blank" rel="noreferrer" className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-3 transition hover:bg-white/[0.06]">
            <div className="flex items-center gap-1.5 text-sm font-semibold">
              {t} <ExternalLink className="h-3 w-3 text-white/40" />
            </div>
            <div className="mt-0.5 text-xs text-white/45">{d}</div>
          </a>
        ))}
      </div>
    </Panel>
  );
}
