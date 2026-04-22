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
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px',
    }}>
      {/* Background glow */}
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '500px',
        height: '500px',
        background: 'radial-gradient(circle, rgba(212,175,55,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{
        background: 'var(--card)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        padding: '48px 40px',
        width: '100%',
        maxWidth: '400px',
        position: 'relative',
        boxShadow: '0 0 60px rgba(212,175,55,0.1)',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <div style={{
            fontSize: '2.5rem',
            marginBottom: '12px',
          }}>✂️</div>
          <h1 style={{
            fontFamily: 'Georgia, serif',
            fontSize: '1.4rem',
            color: '#d4af37',
            letterSpacing: '3px',
            textTransform: 'uppercase',
            marginBottom: '6px',
          }}>
            EE KURT BARBERS
          </h1>
          <p style={{ fontSize: '0.78rem', color: 'var(--muted)', letterSpacing: '2px', textTransform: 'uppercase' }}>
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
              onFocus={e => e.target.style.borderColor = '#d4af37'}
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
              onFocus={e => e.target.style.borderColor = '#d4af37'}
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
              background: loading ? 'rgba(212,175,55,0.5)' : 'linear-gradient(135deg, #d4af37, #b8860b)',
              border: 'none',
              borderRadius: '8px',
              color: '#000',
              fontWeight: '700',
              fontSize: '0.85rem',
              letterSpacing: '2px',
              textTransform: 'uppercase',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {loading ? 'Signing In...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;