import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import BrandLogo from './BrandLogo';

const ERROR_MESSAGES = {
  'auth/user-not-found':      'No account found with this email.',
  'auth/wrong-password':      'Incorrect password. Please try again.',
  'auth/invalid-credential':  'Incorrect email or password.',
  'auth/email-already-in-use':'An account with this email already exists.',
  'auth/weak-password':       'Password must be at least 6 characters.',
  'auth/invalid-email':       'Please enter a valid email address.',
  'auth/too-many-requests':   'Too many attempts. Please try again later.',
};

function friendlyError(code) {
  return ERROR_MESSAGES[code] || 'Something went wrong. Please try again.';
}

export default function Auth() {
  const { login, signup, resetPassword } = useAuth();
  // 'login' | 'signup' | 'reset'; the landing page links to ?mode=signup for "Get started"
  const [mode, setMode] = useState(() =>
    new URLSearchParams(window.location.search).get('mode') === 'signup' ? 'signup' : 'login'
  );

  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [error,    setError]    = useState('');
  const [busy,     setBusy]     = useState(false);
  const [notice,   setNotice]   = useState('');

  const switchMode = (m) => {
    setMode(m);
    setError(''); setNotice('');
    setName(''); setPassword(''); setConfirm('');
    if (m === 'signup') setEmail('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(''); setNotice('');

    if (mode === 'reset') {
      setBusy(true);
      try {
        await resetPassword(email.trim());
        setNotice(`If an account exists for ${email.trim()}, a password reset link has been sent. Check your inbox and spam folder.`);
      } catch (err) {
        setError(friendlyError(err.code));
      } finally {
        setBusy(false);
      }
      return;
    }

    if (mode === 'signup') {
      if (!name.trim())               return setError('Please enter your full name.');
      if (password !== confirm)       return setError('Passwords do not match.');
      if (password.length < 6)        return setError('Password must be at least 6 characters.');
    }

    setBusy(true);
    try {
      if (mode === 'login') {
        await login(email, password);
      } else {
        await signup(email, password, name.trim());
      }
    } catch (err) {
      setError(friendlyError(err.code));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-page auth-split">
      {/* Photo side (left on wide screens, banner on phones). Photo: Unsplash, free licence. */}
      <aside className="auth-visual" aria-hidden="true">
        <picture>
          <source media="(max-width: 899px)" srcSet="/auth/signin-photo-wide.webp" />
          <img src="/auth/signin-photo.webp" alt="" />
        </picture>
        <div className="auth-visual-copy">
          <p className="auth-visual-title">Budget, save and grow your money, <span>in any currency.</span></p>
          <p className="auth-visual-sub">All your accounts, budgets and savings in one clear view.</p>
        </div>
      </aside>

      <div className="auth-form-side">
      <div className="auth-card">

        {/* Brand */}
        <div className="auth-brand">
          <BrandLogo className="auth-wordmark" />
        </div>

        <h2 className="auth-title">
          {mode === 'login' ? 'Welcome back' : mode === 'signup' ? 'Create your account' : 'Reset your password'}
        </h2>
        <p className="auth-subtitle">
          {mode === 'login'
            ? 'Sign in to access your personal finance dashboard.'
            : mode === 'signup'
              ? 'Start tracking your income, expenses and savings.'
              : "Enter your account email and we'll send you a link to set a new password."}
        </p>

        {/* Mode toggle */}
        {mode !== 'reset' && <div className="auth-toggle">
          <button
            className={`auth-toggle-btn ${mode === 'login' ? 'active' : ''}`}
            onClick={() => switchMode('login')}
            type="button"
          >Sign In</button>
          <button
            className={`auth-toggle-btn ${mode === 'signup' ? 'active' : ''}`}
            onClick={() => switchMode('signup')}
            type="button"
          >Create Account</button>
        </div>}

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'signup' && (
            <div className="form-group">
              <label>Full Name</label>
              <input
                type="text"
                placeholder="Your full name"
                value={name}
                onChange={e => setName(e.target.value)}
                autoFocus
                required
              />
            </div>
          )}

          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoFocus={mode === 'login'}
              required
            />
          </div>

          {mode !== 'reset' && <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              placeholder={mode === 'signup' ? 'Minimum 6 characters' : '••••••••'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
            {mode === 'login' && (
              <button
                type="button"
                className="auth-switch-link auth-forgot-link"
                onClick={() => switchMode('reset')}
              >Forgot password?</button>
            )}
          </div>}

          {mode === 'signup' && (
            <div className="form-group">
              <label>Confirm Password</label>
              <input
                type="password"
                placeholder="Re-enter your password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
              />
            </div>
          )}

          {error  && <p className="auth-error">{error}</p>}
          {notice && <p className="auth-notice">{notice}</p>}

          <button type="submit" className="auth-submit" disabled={busy}>
            {busy
              ? 'Please wait…'
              : mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Create Account' : 'Send Reset Link'}
          </button>
        </form>

        {mode === 'reset' ? (
          <p className="auth-switch">
            Remembered it?{' '}
            <button type="button" className="auth-switch-link" onClick={() => switchMode('login')}>
              Back to sign in
            </button>
          </p>
        ) : <p className="auth-switch">
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button
            type="button"
            className="auth-switch-link"
            onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
          >
            {mode === 'login' ? 'Create one' : 'Sign in'}
          </button>
        </p>}
      </div>
      </div>
    </div>
  );
}
