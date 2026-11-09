import { useEffect, useState } from 'react';
import { FlaskConical, Gauge, Image as ImageIcon, Pause, Play, RotateCcw, Save, Settings2 } from 'lucide-react';
import type { BackgroundTheme, EventSnapshot, ThemeConfig } from '@/lib/types';
import { DEFAULT_THEME, guestUrl } from '@/lib/utils';
import { Segmented, Toggle, useUI } from '@/components/ui';
import { Panel, useAdminActions } from './common';

type Run = ReturnType<typeof useAdminActions>['run'];

async function fileToDataUrl(file: File, max = 256): Promise<string> {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.round(img.width * scale);
  c.height = Math.round(img.height * scale);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/png');
}

export function SettingsPanel({ snap, run }: { snap: EventSnapshot; run: Run }) {
  const { toast } = useUI();
  const [ev, setEv] = useState({ name: snap.event.name, logoUrl: snap.event.logoUrl ?? '', date: snap.event.date ?? '', theme: snap.event.theme });
  const [st, setSt] = useState({
    maxRequestsPerGuest: snap.settings.maxRequestsPerGuest,
    maxQueueSize: snap.settings.maxQueueSize,
    countdownDuration: snap.settings.countdownDuration,
    qrUrl: snap.settings.qrUrl ?? '',
    showRequesterNames: snap.settings.showRequesterNames,
  });
  useEffect(() => {
    setEv({ name: snap.event.name, logoUrl: snap.event.logoUrl ?? '', date: snap.event.date ?? '', theme: snap.event.theme });
  }, [snap.event]);

  const setTheme = (patch: Partial<ThemeConfig>) => setEv((e) => ({ ...e, theme: { ...e.theme, ...patch } }));

  async function save() {
    const ok1 = await run({ type: 'updateEvent', patch: { name: ev.name.trim() || snap.event.name, logoUrl: ev.logoUrl || null, date: ev.date || null, theme: ev.theme } });
    const ok2 = await run({
      type: 'updateSettings',
      patch: {
        maxRequestsPerGuest: clamp(st.maxRequestsPerGuest, 1, 50),
        maxQueueSize: clamp(st.maxQueueSize, 1, 2000),
        countdownDuration: clamp(st.countdownDuration, 1, 10),
        qrUrl: st.qrUrl.trim() || null,
        showRequesterNames: st.showRequesterNames,
      },
    });
    if (ok1 && ok2) toast('Settings saved — all screens updated');
  }

  return (
    <Panel
      title="Event configuration"
      icon={<Settings2 className="h-4 w-4 text-primary" />}
      actions={
        <button className="btn-primary px-4 py-2 text-sm" onClick={save}>
          <Save className="h-4 w-4" /> Save
        </button>
      }
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div>
            <label className="label">Event name</label>
            <input className="field" maxLength={80} value={ev.name} onChange={(e) => setEv({ ...ev, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Event date</label>
              <input type="date" className="field" value={ev.date} onChange={(e) => setEv({ ...ev, date: e.target.value })} />
            </div>
            <div>
              <label className="label">Status</label>
              <Segmented
                value={snap.event.status}
                onChange={(v) => run({ type: 'updateEvent', patch: { status: v } }, v === 'ended' ? 'Event ended' : 'Event live')}
                options={[
                  { value: 'live', label: 'Live' },
                  { value: 'ended', label: 'Ended' },
                ]}
              />
            </div>
          </div>
          <div>
            <label className="label">Event logo</label>
            <div className="flex gap-3">
              <div className="grid h-[52px] w-[52px] shrink-0 place-items-center overflow-hidden rounded-2xl border border-white/10 bg-white/5">
                {ev.logoUrl ? <img src={ev.logoUrl} alt="" className="h-full w-full object-cover" /> : <ImageIcon className="h-5 w-5 text-white/30" />}
              </div>
              <input className="field" placeholder="https://… or upload" value={ev.logoUrl.startsWith('data:') ? '(uploaded image)' : ev.logoUrl} onChange={(e) => setEv({ ...ev, logoUrl: e.target.value })} />
              <label className="btn-ghost shrink-0 cursor-pointer px-4 text-sm">
                Upload
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) setEv({ ...ev, logoUrl: await fileToDataUrl(f) });
                  }}
                />
              </label>
            </div>
          </div>
          <div>
            <label className="label">Brand colours</label>
            <div className="grid grid-cols-4 gap-2">
              {(['primary', 'secondary', 'magenta', 'cyan'] as const).map((k) => (
                <label key={k} className="flex flex-col items-center gap-1.5 rounded-2xl border border-white/10 bg-white/[0.03] p-2 text-[11px] capitalize text-white/60">
                  <input type="color" value={ev.theme[k]} onChange={(e) => setTheme({ [k]: e.target.value })} className="h-9 w-full cursor-pointer rounded-lg bg-transparent" />
                  {k === 'magenta' ? 'accent' : k === 'cyan' ? 'highlight' : k}
                </label>
              ))}
            </div>
            <button className="mt-2 text-xs text-white/50 hover:text-white" onClick={() => setTheme(DEFAULT_THEME)}>
              Reset to default palette
            </button>
          </div>
          <div>
            <label className="label">Background theme</label>
            <Segmented<BackgroundTheme>
              value={ev.theme.background}
              onChange={(v) => setTheme({ background: v })}
              options={[
                { value: 'aurora', label: 'Aurora' },
                { value: 'nebula', label: 'Nebula' },
                { value: 'grid', label: 'Grid' },
                { value: 'minimal', label: 'Minimal' },
              ]}
            />
          </div>
        </div>
        <div className="space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <NumField label="Requests / guest" value={st.maxRequestsPerGuest} onChange={(v) => setSt({ ...st, maxRequestsPerGuest: v })} />
            <NumField label="Max queue" value={st.maxQueueSize} onChange={(v) => setSt({ ...st, maxQueueSize: v })} />
            <NumField label="Countdown (s)" value={st.countdownDuration} onChange={(v) => setSt({ ...st, countdownDuration: v })} />
          </div>
          <div>
            <label className="label">QR code destination</label>
            <input className="field" placeholder={guestUrl(snap.event.id)} value={st.qrUrl} onChange={(e) => setSt({ ...st, qrUrl: e.target.value })} />
            <p className="mt-1 text-xs text-white/40">Leave empty to use the guest page. Use a custom domain or short link if you have one.</p>
          </div>
          <Toggle label="Show requester names" hint="On the big screen and community list" checked={st.showRequesterNames} onChange={(v) => setSt({ ...st, showRequesterNames: v })} />
        </div>
      </div>
    </Panel>
  );
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, Math.round(Number(v) || a)));

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div>
      <label className="label truncate">{label}</label>
      <input type="number" className="field" value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

/* ================================================================== DEMO */
export function DemoPanel({ snap, run }: { snap: EventSnapshot; run: Run }) {
  const { confirm } = useUI();
  const d = snap.settings.demo;
  const demoCount = snap.requests.filter((r) => r.isDemo).length;
  return (
    <Panel
      title="Demo mode"
      icon={<FlaskConical className="h-4 w-4 text-amber-300" />}
      className={d.enabled ? 'border-amber-300/30 bg-amber-300/[0.04]' : ''}
      actions={d.enabled ? <span className="chip border-amber-300/40 bg-amber-300/10 text-amber-200">DEMO MODE</span> : null}
    >
      <p className="text-sm text-white/55">
        Simulates 100 guests requesting songs and voting in real time, so you can showcase every screen before the event. Simulated data is tagged and can be wiped
        in one click.
      </p>
      <div className="mt-3 divide-y divide-white/[0.06]">
        <Toggle label="Demo mode" hint="Shows a DEMO badge on screens" checked={d.enabled} onChange={(v) => run({ type: 'updateSettings', patch: { demo: { ...d, enabled: v, running: v ? d.running : false } } })} />
        <Toggle label="Simulated DJ" hint="Auto-approves requests and reveals the crowd favourite about once a minute" checked={d.autoDj} disabled={!d.enabled} onChange={(v) => run({ type: 'updateSettings', patch: { demo: { ...d, autoDj: v } } })} />
      </div>
      <div className="mt-3 flex items-center gap-3">
        <Gauge className="h-4 w-4 text-white/50" />
        <span className="text-sm">Speed</span>
        <Segmented
          className="flex-1"
          value={String(d.speed)}
          onChange={(v) => run({ type: 'updateSettings', patch: { demo: { ...d, speed: Number(v) } } })}
          options={['0.5', '1', '2', '4'].map((x) => ({ value: x, label: `${x}×` }))}
        />
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2">
        <button
          className="btn-primary py-3 text-sm"
          disabled={d.running}
          onClick={() => run({ type: 'updateSettings', patch: { demo: { ...d, enabled: true, running: true } } }, 'Simulation running')}
        >
          <Play className="h-4 w-4" /> Start
        </button>
        <button className="btn-ghost py-3 text-sm" disabled={!d.running} onClick={() => run({ type: 'updateSettings', patch: { demo: { ...d, running: false } } }, 'Simulation paused')}>
          <Pause className="h-4 w-4" /> Pause
        </button>
        <button
          className="btn-danger py-3 text-sm"
          onClick={async () => {
            if (await confirm({ title: 'Reset simulation?', body: `Removes ${demoCount} simulated requests and all simulated votes and guests. Real guest data is kept.`, confirmText: 'Reset', danger: true })) {
              await run({ type: 'updateSettings', patch: { demo: { ...d, running: false } } });
              await run({ type: 'clearDemo' }, 'Simulation reset');
            }
          }}
        >
          <RotateCcw className="h-4 w-4" /> Reset
        </button>
      </div>
      {d.running && <p className="mt-3 text-xs text-amber-200/80">Keep this tab open — it drives the simulation for every connected screen.</p>}
    </Panel>
  );
}
