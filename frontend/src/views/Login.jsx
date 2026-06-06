import React, { useState } from 'react';
import { apiRequest, setAuthToken } from '../utils/api';

export default function Login({ onLoginSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleUsernameChange = (val) => {
    setUsername(val);
    if (errors.username) setErrors(p => { const copy = { ...p }; delete copy.username; return copy; });
  };

  const handlePasswordChange = (val) => {
    setPassword(val);
    if (errors.password) setErrors(p => { const copy = { ...p }; delete copy.password; return copy; });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = {};
    if (!username.trim()) { newErrors.username = 'Username wajib diisi'; }
    if (!password) { newErrors.password = 'Password wajib diisi'; }
    else if (password.length < 6) { newErrors.password = 'Password minimal 6 karakter'; }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      setError('Mohon perbaiki kesalahan input di bawah.');
      return;
    }

    setError(''); setErrors({}); setLoading(true);
    try {
      const data = await apiRequest('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username: username.trim(), password }),
      });
      setAuthToken(data.token);
      onLoginSuccess(data.user);
    } catch (err) {
      setError(err.message || 'Login gagal. Hubungi administrator.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="login-logo">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
            </svg>
          </div>
          <h2>PERSIS GUDANG</h2>
          <p>Sistem Manajemen Persediaan Barang</p>
        </div>

        {error && <div className="alert alert-danger">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Username</label>
            <input
              type="text" className={`form-control ${errors.username ? 'is-invalid' : ''}`} placeholder="Masukkan username"
              value={username} onChange={e => handleUsernameChange(e.target.value)}
              disabled={loading} autoFocus autoComplete="username"
            />
            {errors.username && <div className="invalid-feedback">{errors.username}</div>}
          </div>
          <div className="form-group" style={{ marginBottom: '26px' }}>
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPass ? 'text' : 'password'} className={`form-control ${errors.password ? 'is-invalid' : ''}`}
                placeholder="Masukkan password" style={{ paddingRight: '44px' }}
                value={password} onChange={e => handlePasswordChange(e.target.value)}
                disabled={loading} autoComplete="current-password"
              />
              <button
                type="button" tabIndex={-1}
                onClick={() => setShowPass(!showPass)}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '2px' }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" style={{ width: '18px', height: '18px' }}>
                  {showPass
                    ? <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 001.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.45 10.45 0 0112 4.5c4.756 0 8.773 3.162 10.065 7.498a10.523 10.523 0 01-4.293 5.774M6.228 6.228L3 3m3.228 3.228l3.65 3.65m7.894 7.894L21 21m-3.228-3.228l-3.65-3.65m0 0a3 3 0 10-4.243-4.243m4.242 4.242L9.88 9.88" />
                    : <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  }
                </svg>
              </button>
            </div>
            {errors.password && <div className="invalid-feedback">{errors.password}</div>}
          </div>
          <button type="submit" className="btn btn-primary" style={{ width: '100%', padding: '11px' }} disabled={loading}>
            {loading ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center' }}>
                <span style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block' }} />
                Memverifikasi...
              </span>
            ) : 'Masuk ke Sistem'}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '22px', fontSize: '0.78rem', color: 'var(--text-muted)', padding: '12px', background: 'rgba(255,255,255,0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
          <div>Default Admin: <strong style={{ color: 'var(--text-secondary)' }}>admin</strong> / <strong style={{ color: 'var(--text-secondary)' }}>admin123</strong></div>
          <div style={{ marginTop: '4px' }}>Default Operator: <strong style={{ color: 'var(--text-secondary)' }}>operator</strong> / <strong style={{ color: 'var(--text-secondary)' }}>operator123</strong></div>
        </div>
      </div>
    </div>
  );
}
