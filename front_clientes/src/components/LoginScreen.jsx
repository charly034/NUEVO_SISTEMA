import { useState } from 'react';

export default function LoginScreen({ onLogin, onRegistrar, onRecuperar }) {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await onLogin(email.trim(), password, remember);
    } catch (err) {
      setError(err?.message || 'No pudimos iniciar sesión. Revisá tu email y contraseña.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        <div style={s.logo}>🌿</div>
        <h1 style={s.titulo}>La Quinta</h1>
        <p style={s.sub}>Sistema de pedidos</p>
        <p style={s.loginHint}>Entrá con el email registrado en tu empresa. Si es tu primera vez, usá el código que te dieron.</p>

        <form onSubmit={handleSubmit} style={s.form}>

          {/* Email */}
          <label style={s.label}>
            Email
            <input
              style={s.input}
              type="email"
              required
              autoFocus
              autoComplete="username"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="usuario@empresa.com"
            />
          </label>

          {/* Contraseña con toggle */}
          <label style={s.label}>
            Contraseña
            <div style={s.passWrap}>
              <input
                style={{ ...s.input, paddingRight: 44, marginBottom: 0 }}
                type={showPass ? 'text' : 'password'}
                required
                autoComplete="current-password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPass(v => !v)}
                style={s.eyeBtn}
                tabIndex={-1}
                aria-label={showPass ? 'Ocultar contraseña' : 'Ver contraseña'}
              >
                {showPass ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={s.eyeIcon}>
                    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
                    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
                    <line x1="1" y1="1" x2="23" y2="23"/>
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={s.eyeIcon}>
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                    <circle cx="12" cy="12" r="3"/>
                  </svg>
                )}
              </button>
            </div>
          </label>

          {/* Recordarme */}
          <label style={s.checkLabel}>
            <input
              type="checkbox"
              checked={remember}
              onChange={e => setRemember(e.target.checked)}
              style={s.checkbox}
            />
            Mantener sesión activa
          </label>

          {/* Error */}
          {error && (
            <p role="alert" style={s.error}>{error}</p>
          )}

          {/* Botón */}
          <button type="submit" style={s.btn} disabled={loading}>
            {loading ? (
              <span style={s.loadingRow}>
                <svg style={s.spinner} viewBox="0 0 24 24" fill="none">
                  <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="white" strokeWidth="4"/>
                  <path style={{ opacity: 0.75 }} fill="white" d="M4 12a8 8 0 018-8v8z"/>
                </svg>
                Ingresando…
              </span>
            ) : 'Ingresar'}
          </button>

          {onRecuperar && (
            <button type="button" onClick={onRecuperar} style={s.recuperarLink}>
              ¿Olvidaste tu contraseña?
            </button>
          )}

          {onRegistrar && (
            <div style={s.registroRow}>
              <span style={{ color: 'var(--subtexto)', fontSize: 14 }}>¿Primera vez?</span>
              <button type="button" onClick={onRegistrar} style={s.registroLink}>
                Crear cuenta con código
              </button>
            </div>
          )}

        </form>
      </div>
    </div>
  );
}

const s = {
  wrap:       { minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: '#f8fafc' },
  card:       { background: '#fff', borderRadius: 20, padding: '40px 32px', width: '100%', maxWidth: 400, boxShadow: '0 4px 24px rgba(0,0,0,0.07)', border: '1px solid #f1f5f9', textAlign: 'center' },
  logo:       { fontSize: 52, marginBottom: 8 },
  titulo:     { fontSize: 26, fontWeight: 800, color: 'var(--verde)', marginBottom: 4 },
  sub:        { color: 'var(--subtexto)', marginBottom: 28, fontSize: 14 },
  loginHint:  { color: '#64748b', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, padding: '10px 12px', fontSize: 13, lineHeight: 1.4, margin: '-14px 0 18px' },
  form:       { display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'left' },
  label:      { display: 'flex', flexDirection: 'column', gap: 6, fontWeight: 600, fontSize: 14, color: '#374151' },
  input:      { padding: '11px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 16, outline: 'none', transition: 'border-color 0.15s', width: '100%', boxSizing: 'border-box' },
  passWrap:   { position: 'relative' },
  eyeBtn:     { position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#9ca3af', display: 'flex', alignItems: 'center' },
  eyeIcon:    { width: 18, height: 18 },
  checkLabel: { display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500, fontSize: 14, color: '#6b7280', cursor: 'pointer', userSelect: 'none' },
  checkbox:   { width: 15, height: 15, accentColor: 'var(--verde)', cursor: 'pointer', flexShrink: 0 },
  error:      { color: '#dc2626', fontSize: 14, textAlign: 'center', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px' },
  btn:        { background: 'var(--verde)', color: '#fff', border: 'none', borderRadius: 12, padding: '13px', fontSize: 16, fontWeight: 700, marginTop: 4, cursor: 'pointer', opacity: 1, transition: 'opacity 0.15s' },
  loadingRow:   { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  spinner:      { width: 18, height: 18, animation: 'spin 0.8s linear infinite' },
  recuperarLink:{ background: 'none', border: 'none', color: 'var(--subtexto)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline', textAlign: 'center', padding: '2px 0' },
  registroRow:  { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4 },
  registroLink: { background: 'none', border: 'none', color: 'var(--verde)', fontSize: 14, fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', padding: 0 },
};

// Inyectar keyframes para el spinner
if (typeof document !== 'undefined' && !document.getElementById('login-spin')) {
  const style = document.createElement('style');
  style.id = 'login-spin';
  style.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
  document.head.appendChild(style);
}
