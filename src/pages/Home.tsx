import { motion } from 'framer-motion';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Headphones, LayoutDashboard, LogIn, LogOut, Monitor, Plus, Rocket, Smartphone, Trash2 } from 'lucide-react';
import { useBackend } from '@/hooks/useEvent';
import { Atmosphere } from '@/components/fx';
import { BrandMark, Spinner, useUI } from '@/components/ui';
import type { AdminIdentity } from '@/lib/backend/types';
import type { EventInfo } from '@/lib/types';
import { applyTheme, DEFAULT_THEME } from '@/lib/utils';

export default function Home() {
  const backend = useBackend();
  const nav = useNavigate();
  const { toast, confirm } = useUI();
  const [admin, setAdmin] = useState<AdminIdentity | null | undefined>(undefined);
  const [events, setEvents] = useState<EventInfo[]>([]);
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => applyTheme(DEFAULT_THEME), []);
  const refresh = async () => {
    if (!backend) return;
    const a = await backend.getAdmin();
    setAdmin(a);
    if (a) setEvents(await backend.listEvents());
  };
  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backend]);

  const local = backend?.mode === 'local';

  async function create(demo = false) {
    if (!backend) return;
    if (!demo && !name.trim()) return toast('Give your event a name', 'error');
    if (!demo && local && pin.trim().length < 4) return toast('Choose a PIN of at least 4 digits', 'error');
    setBusy(true);
    const r = await backend.createEvent(
      demo ? { name: 'Encore Showcase', id: 'showcase', pin: '0000', date: new Date().toISOString().slice(0, 10) } : { name, date: date || null, pin },
    );
    if (!r.ok || !r.data) {
      setBusy(false);
      return toast(r.message ?? 'Could not create event', 'error');
    }
    if (demo) {
      await backend.admin(r.data.id, { type: 'updateSettings', patch: { demo: { enabled: true, running: true, speed: 1, autoDj: true } } });
      window.open(`/display/${r.data.id}`, '_blank');
    }
    nav(`/admin/${r.data.id}`);
  }

  return (
    <div className="relative min-h-[100dvh] overflow-hidden bg-ink">
      <div className="fixed inset-0">
        <Atmosphere density={0.8} />
      </div>
      <div className="relative z-10 mx-auto max-w-6xl px-5 py-8 lg:py-14">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrandMark size={34} />
            <span className="font-display text-xl font-black tracking-tight">ENCORE</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="chip">{local ? 'Local mode' : backend ? 'Supabase' : '…'}</span>
            {!local && admin && (
              <button
                className="btn-ghost px-3 py-1.5 text-sm"
                onClick={async () => {
                  await backend!.signOut();
                  refresh();
                }}
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            )}
          </div>
        </header>

        <section className="mt-14 grid items-end gap-10 lg:mt-20 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="eyebrow">
              The interactive event music experience
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1, duration: 0.7 }}
              className="mt-5 font-display text-[44px] font-black leading-[0.95] tracking-tight sm:text-[72px]"
            >
              THE CROWD
              <br />
              <span className="text-gradient-anim glow-text">CREATES THE NIGHT.</span>
            </motion.h1>
            <p className="mt-6 max-w-xl text-lg text-white/60">
              Guests scan, request and vote from their phones. You stay in control from the booth. The LED wall turns every request into a moment.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 text-sm text-white/55">
              {[
                [Smartphone, 'Guest app'],
                [Monitor, 'LED display'],
                [Headphones, 'DJ control'],
              ].map(([I, t]: any) => (
                <span key={t} className="chip py-1.5">
                  <I className="h-4 w-4" /> {t}
                </span>
              ))}
            </div>
          </div>

          {!backend || admin === undefined ? (
            <div className="grid h-60 place-items-center">
              <Spinner />
            </div>
          ) : !admin ? (
            <div className="glass rounded-3xl p-6">
              <h2 className="font-display text-xl font-bold">Organizer sign in</h2>
              <p className="mt-1 text-sm text-white/55">Sign in to create events and run the DJ controls.</p>
              <Link to="/login" className="btn-primary mt-5 w-full py-3.5">
                <LogIn className="h-4 w-4" /> Sign in / create account
              </Link>
            </div>
          ) : (
            <div className="glass rounded-3xl p-6">
              <button onClick={() => create(true)} disabled={busy} className="btn-primary w-full py-4 font-display tracking-wider">
                <Rocket className="h-5 w-5" /> LAUNCH INSTANT DEMO
              </button>
              <p className="mt-2 text-center text-xs text-white/45">Opens the LED display + DJ dashboard with 100 simulated guests{local ? ' · PIN 0000' : ''}</p>
              <div className="my-5 flex items-center gap-3 text-xs text-white/30">
                <span className="h-px flex-1 bg-white/10" />
                or create a real event
                <span className="h-px flex-1 bg-white/10" />
              </div>
              <div className="space-y-3">
                <input className="field" placeholder="Event name — e.g. Sara & Omar's Wedding" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
                <div className="grid grid-cols-2 gap-3">
                  <input type="date" className="field" value={date} onChange={(e) => setDate(e.target.value)} />
                  {local && <input className="field" inputMode="numeric" placeholder="Admin PIN" value={pin} onChange={(e) => setPin(e.target.value)} maxLength={8} />}
                </div>
                <button onClick={() => create(false)} disabled={busy} className="btn-ghost w-full py-3.5">
                  <Plus className="h-4 w-4" /> Create event
                </button>
              </div>
            </div>
          )}
        </section>

        {admin && events.length > 0 && (
          <section className="mt-16">
            <h2 className="eyebrow mb-4">Your events</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {events.map((e) => (
                <div key={e.id} className="glass flex flex-wrap items-center gap-3 rounded-3xl p-4">
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-display font-bold">{e.name}</div>
                    <div className="text-xs text-white/45">
                      /{e.id} · {e.status === 'live' ? 'Live' : 'Ended'}
                      {e.date ? ` · ${e.date}` : ''}
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    <Link to={`/admin/${e.id}`} className="btn-primary px-3 py-2 text-sm" title="Dashboard">
                      <LayoutDashboard className="h-4 w-4" />
                    </Link>
                    <Link to={`/dj/${e.id}`} className="btn-ghost px-3 py-2 text-sm" title="DJ mode">
                      <Headphones className="h-4 w-4" />
                    </Link>
                    <a href={`/display/${e.id}`} target="_blank" rel="noreferrer" className="btn-ghost px-3 py-2 text-sm" title="Display">
                      <Monitor className="h-4 w-4" />
                    </a>
                    <a href={`/guest/${e.id}`} target="_blank" rel="noreferrer" className="btn-ghost px-3 py-2 text-sm" title="Guest page">
                      <Smartphone className="h-4 w-4" />
                    </a>
                    <button
                      className="btn-ghost px-3 py-2 text-sm text-white/40 hover:text-rose-300"
                      title="Delete event"
                      onClick={async () => {
                        if (await confirm({ title: `Delete “${e.name}”?`, body: 'All requests, votes and settings for this event are permanently deleted.', confirmText: 'Delete', danger: true })) {
                          await backend!.deleteEvent(e.id);
                          refresh();
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
