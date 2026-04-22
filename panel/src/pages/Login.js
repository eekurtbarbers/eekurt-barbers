import React, { useState } from 'react';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';

function getLoginErrorMessage(err) {
  const code = err?.code || '';
  if (code === 'auth/invalid-credential') return 'Wrong email or password.';
  if (code === 'auth/user-not-found') return 'No user found with this email.';
  if (code === 'auth/wrong-password') return 'Wrong email or password.';
  if (code === 'auth/too-many-requests') return 'Too many attempts. Try again later or reset your password.';
  if (code === 'auth/network-request-failed') return 'Network error. Check internet and try again.';
  if (code === 'auth/operation-not-allowed') return 'Email/Password sign-in is disabled in Firebase Authentication.';
  return 'Login failed. Please try again.';
}

function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signInWithEmailAndPassword(auth, email, password);
      onLogin();
    } catch (err) {
      setError(getLoginErrorMessage(err));
      setPassword('');
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: '#080808',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    }}>
      {/* Subtle silver radial glow */}
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '600px',
        height: '600px',
        background: 'radial-gradient(circle, rgba(180,180,180,0.05) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{ width: '100%', maxWidth: '400px', position: 'relative' }}>

        {/* Wolf banner */}
        <div style={{ textAlign: 'center', marginBottom: '28px' }}>
          <img
            src="/wolf-logo.png"
            alt="EE Kurt Barbers"
            style={{
              width: '200px',
              height: '200px',
              objectFit: 'contain',
              filter: 'drop-shadow(0 0 24px rgba(180,180,180,0.18)) brightness(0.95)',
            }}
          />
        </div>

        {/* Card */}
        <div style={{
          background: '#111',
          border: '1px solid rgba(180,180,180,0.14)',
          borderRadius: '16px',
          padding: '36px 36px 40px',
          boxShadow: '0 0 60px rgba(0,0,0,0.7)',
        }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <h1 style={{
              fontFamily: 'Georgia, serif',
              fontSize: '1.25rem',
              color: '#c0c0c0',
              letterSpacing: '3px',
              textTransform: 'uppercase',
              marginBottom: '6px',
            }}>
              EE KURT BARBERS
            </h1>
            <p style={{ fontSize: '0.72rem', color: '#555', letterSpacing: '2px', textTransform: 'uppercase' }}>
              Admin Panel
            </p>
          </div>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '0.75rem',
              color: 'var(--muted)',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              marginBottom: '8px',
            }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); setError(''); }}
              placeholder="Enter your email"
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px 16px',
                background: 'var(--card2)',
                border: `1px solid ${error ? '#ff5252' : 'var(--border)'}`,
                borderRadius: '8px',
                color: 'var(--text)',
                fontSize: '0.95rem',
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
              onFocus={e => e.target.style.borderColor = '#c0c0c0'}
              onBlur={e => e.target.style.borderColor = error ? '#ff5252' : 'var(--border)'}
              autoFocus
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{
              display: 'block',
              fontSize: '0.75rem',
              color: 'var(--muted)',
              letterSpacing: '1px',
              textTransform: 'uppercase',
              marginBottom: '8px',
            }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              placeholder="Enter password"
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px 16px',
                background: 'var(--card2)',
                border: `1px solid ${error ? '#ff5252' : 'var(--border)'}`,
                borderRadius: '8px',
                color: 'var(--text)',
                fontSize: '0.95rem',
                outline: 'none',
                transition: 'border-color 0.2s',
              }}
              onFocus={e => e.target.style.borderColor = '#c0c0c0'}
              onBlur={e => e.target.style.borderColor = error ? '#ff5252' : 'var(--border)'}
            />
            {error && (
              <p style={{ color: '#ff5252', fontSize: '0.78rem', marginTop: '8px' }}>{error}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !email || !password}
            style={{
              width: '100%',
              padding: '14px',
              background: loading || !email || !password ? 'rgba(100,100,100,0.35)' : 'linear-gradient(135deg, #b0b0b0, #666)',
              border: 'none',
              borderRadius: '8px',
              color: '#000',
              fontWeight: '700',
              fontSize: '0.85rem',
              letterSpacing: '2px',
              textTransform: 'uppercase',
              cursor: loading || !email || !password ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>
        </div>{/* /card */}
      </div>{/* /wrapper */}
    </div>
  );
}

export default Login;