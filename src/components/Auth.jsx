import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

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
  const { login, signup } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'signup'

  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [error,    setError]    = useState('');
  const [busy,     setBusy]     = useState(false);

  const switchMode = (m) => {
    setMode(m);
    setError('');
    setName(''); setEmail(''); setPassword(''); setConfirm('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

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
    <div className="auth-page">
      <div className="auth-card">

        {/* Brand */}
        <div className="auth-brand">
          <img src="/logo-icon.svg" alt="ESB" className="auth-logo" />
          <span className="auth-brand-name">ESB Finance Tracker</span>
        </div>

        <h2 className="auth-title">
          {mode === 'login' ? 'Welcome back' : 'Create your account'}
        </h2>
        <p className="auth-subtitle">
          {mode === 'login'
            ? 'Sign in to access your personal finance dashboard.'
            : 'Start tracking your income, expenses and savings.'}
        </p>

        {/* Mode toggle */}
        <div className="auth-toggle">
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
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          {mode === 'signup' && (
            <div className="form-group">
              <label>Full Name</label>
              <input
                type="text"
                placeholder="e.g. Richie Afriyie"
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

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              placeholder={mode === 'signup' ? 'Minimum 6 characters' : '••••••••'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

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

          {error && <p className="auth-error">{error}</p>}

          <button type="submit" className="auth-submit" disabled={busy}>
            {busy
              ? 'Please wait…'
              : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <p className="auth-switch">
          {mode === 'login' ? "Don't have an account? " : 'Already have an account? '}
          <button
            type="button"
            className="auth-switch-link"
            onClick={() => switchMode(mode === 'login' ? 'signup' : 'login')}
          >
            {mode === 'login' ? 'Create one' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  );
}
