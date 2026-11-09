import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useBackend } from '@/hooks/useEvent';
import { BrandMark, Segmented, Spinner } from '@/components/ui';

export default function Login() {
  const backend = useBackend();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<{ text: string; error?: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  if (backend?.mode === 'local')
    return (
      <div className="grid min-h-[100dvh] place-items-center bg-ink p-6 text-center">
        <div>
          <p className="text-white/60">Local mode needs no account — events are protected by a PIN.</p>
          <Link to="/" className="btn-primary mt-4 px-5 py-3">Go to events</Link>
        </div>
      </div>
    );

  return (
    <div className="grid min-h-[100dvh] place-items-center bg-ink p-6">
      <form
        className="glass w-full max-w-sm rounded-3xl p-8"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!backend) return;
          setBusy(true);
          setMsg(null);
          const r = mode === 'in' ? await backend.signIn(email, password) : await backend.signUp(email, password);
          setBusy(false);
          if (!r.ok) return setMsg({ text: r.message ?? 'Failed', error: true });
          if (r.message) return setMsg({ text: r.message });
          nav(params.get('next') || '/');
        }}
      >
        <BrandMark size={44} className="mx-auto" />
        <h1 className="mt-5 text-center font-display text-xl font-bold">Organizer access</h1>
        <Segmented
          className="mt-6"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'in', label: 'Sign in' },
            { value: 'up', label: 'Create account' },
          ]}
        />
        <div className="mt-5 space-y-3">
          <input className="field" type="email" autoComplete="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          <input className="field" type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} placeholder="Password (min 6 chars)" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {msg && <p className={`mt-3 text-sm ${msg.error ? 'text-rose-300' : 'text-emerald-300'}`}>{msg.text}</p>}
        <button className="btn-primary mt-5 w-full py-3.5" disabled={busy}>
          {busy ? <Spinner /> : mode === 'in' ? 'Sign in' : 'Create account'}
        </button>
        <Link to="/" className="mt-4 block text-center text-sm text-white/50 hover:text-white">← Back</Link>
      </form>
    </div>
  );
}
