import { useEffect, useRef, useState } from 'react';
import './AuthScreen.css';

const API_URL = 'http://localhost:5000/api/auth';
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export default function AuthScreen({ onAuthenticated }) {
  const [mode, setMode] = useState('login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const googleButtonRef = useRef(null);

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !googleButtonRef.current) return undefined;

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async ({ credential }) => {
          setBusy(true);
          setError('');
          try {
            const response = await fetch(`${API_URL}/google`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ credential }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.message || 'Google sign-in failed');
            onAuthenticated(result.data);
          } catch (requestError) {
            setError(requestError.message || 'Could not connect to the server');
          } finally {
            setBusy(false);
          }
        },
      });
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'rectangular',
        width: googleButtonRef.current.clientWidth,
      });
    };
    script.onerror = () => setError('Google sign-in could not be loaded');
    document.head.appendChild(script);

    return () => script.remove();
  }, [onAuthenticated]);

  async function handleSubmit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');

    const formData = new FormData(event.currentTarget);
    try {
      const response = await fetch(`${API_URL}/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: formData.get('username'),
          password: formData.get('password'),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Authentication failed');
      onAuthenticated(result.data);
    } catch (requestError) {
      setError(requestError.message || 'Could not connect to the server');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="auth-shell">
      <section className="auth-brand" aria-label="HotelFeedback">
        <div className="auth-brand-mark" aria-hidden="true">H</div>
        <p className="auth-eyebrow">HOTEL OPERATIONS</p>
        <h1>HotelFeedback</h1>
        <p className="auth-brand-copy">Guest intelligence, ready when your team is.</p>
      </section>

      <section className="auth-content">
        <div className="auth-form-wrap">
          <p className="auth-eyebrow auth-form-eyebrow">TEAM ACCESS</p>
          <h2>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
          <p className="auth-description">
            {mode === 'login' ? 'Sign in with your username and password.' : 'Choose a username for your workspace.'}
          </p>

          <div className="auth-mode" role="tablist" aria-label="Account access">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'login'}
              className={mode === 'login' ? 'is-active' : ''}
              onClick={() => { setMode('login'); setError(''); }}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'register'}
              className={mode === 'register' ? 'is-active' : ''}
              onClick={() => { setMode('register'); setError(''); }}
            >
              Create account
            </button>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            <label htmlFor="auth-username">Username</label>
            <input
              id="auth-username"
              name="username"
              type="text"
              autoComplete="username"
              minLength={3}
              maxLength={32}
              pattern="[A-Za-z0-9._-]+"
              title="Use 3-32 letters, numbers, dots, underscores, or hyphens"
              required
            />

            <label htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              name="password"
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              minLength={mode === 'register' ? 8 : undefined}
              maxLength={128}
              required
            />

            {error && <p className="auth-error" role="alert">{error}</p>}

            <button className="auth-submit" type="submit" disabled={busy}>
              {busy ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          {GOOGLE_CLIENT_ID && (
            <>
              <div className="auth-divider"><span>OR</span></div>
              <div className="auth-google-button" ref={googleButtonRef} />
              {busy && <p className="auth-google-status">Verifying Google account...</p>}
            </>
          )}

          <p className="auth-security-note">Password accounts use one-way hashes. Google tokens are verified by the server.</p>
        </div>
      </section>
    </main>
  );
}