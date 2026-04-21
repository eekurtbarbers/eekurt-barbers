import React, { useState } from 'react';
import config from '../config';

function Login({ onLogin }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      if (password === config.adminPassword) {
        onLogin();
      } else {
        setError('Incorrect password. Please try again.');
        setLoading(false);
      }
    }, 600);
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
            {config.shopName}
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
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => { setPassword(e.target.value); setError(''); }}
              placeholder="Enter admin password"
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
            {error && (
              <p style={{ color: '#ff5252', fontSize: '0.78rem', marginTop: '8px' }}>{error}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !password}
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
            {loading ? '...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

export default Login;