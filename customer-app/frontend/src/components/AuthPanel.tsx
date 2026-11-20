import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, LockKeyhole, X } from 'lucide-react';
import { authenticate, type Customer } from '../lib/api';

export default function AuthPanel({ request, onClose, onSuccess }: {
  request: string;
  onClose: () => void;
  onSuccess: (customer: Customer) => void;
}) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const panel = useRef<HTMLElement>(null);

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    document.body.classList.add('no-scroll');
    panel.current?.querySelector<HTMLInputElement>('input')?.focus();
    return () => {
      document.body.classList.remove('no-scroll');
      previous?.focus();
    };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      onSuccess(await authenticate(mode, name, email, password));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return <div className="auth-overlay" onMouseDown={event => {
    if (event.target === event.currentTarget && !busy) onClose();
  }}>
    <section ref={panel} className="auth-panel" role="dialog" aria-modal="true"
      aria-labelledby="auth-title" onKeyDown={event => {
        if (event.key === 'Escape' && !busy) onClose();
        if (event.key === 'Tab') {
          const controls = panel.current?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled)');
          if (!controls?.length) return;
          const first = controls[0];
          const last = controls[controls.length - 1];
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus();
          }
        }
      }}>
      <button className="auth-close icon-button" aria-label="Close login" onClick={onClose} disabled={busy}><X /></button>
      <LockKeyhole className="auth-symbol" size={28} />
      <h2 id="auth-title">{mode === 'login' ? 'Let’s get your plan started.' : 'Your Doneeo account.'}</h2>
      <p>{request
        ? 'I can help you work through this. Log in to keep your request and continue with Doneeo.'
        : 'Log in to start a request or continue your saved plan.'}</p>
      {request && <blockquote>{request}</blockquote>}
      <form onSubmit={event => void submit(event)}>
        {mode === 'register' && <label>Your name
          <input autoComplete="name" value={name} maxLength={80} required
            onChange={event => setName(event.target.value)} />
        </label>}
        <label>Email
          <input type="email" autoComplete="email" value={email} maxLength={254} required
            onChange={event => setEmail(event.target.value)} />
        </label>
        <label>Password
          <input type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            value={password} minLength={mode === 'register' ? 12 : undefined} required
            onChange={event => setPassword(event.target.value)} />
        </label>
        {mode === 'register' && <small>Use at least 12 characters.</small>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary" type="submit" disabled={busy}>
          {busy ? 'Continuing…' : mode === 'register' ? 'Create account and continue' : 'Log in and continue'}
          <ArrowRight size={17} />
        </button>
      </form>
      <button className="auth-switch" disabled={busy} onClick={() => {
        setMode(mode === 'login' ? 'register' : 'login');
        setError('');
        setPassword('');
      }}>{mode === 'login' ? 'New to Doneeo? Create an account' : 'Already have an account? Log in'}</button>
    </section>
  </div>;
}
