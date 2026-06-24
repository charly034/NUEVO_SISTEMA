import { useState } from 'react';
import { authApi } from '../api.js';

export default function RecuperarPassword({ onVolver, onExito }) {
  const [codigo, setCodigo]     = useState('');
  const [paso, setPaso]         = useState(1); // 1 = ingresar código, 2 = nueva contraseña
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const handleCodigo = (e) => {
    e.preventDefault();
    if (codigo.trim().length < 5) return setError('Ingresá el código completo');
    setError('');
    setPaso(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== password2) return setError('Las contraseñas no coinciden');
    if (password.length < 8) return setError('Mínimo 8 caracteres');
    setLoading(true);
    try {
      await authApi.usarResetCode(codigo.trim().toUpperCase(), password);
      onExito();
    } catch (err) {
      setError(err?.message || 'El código no es válido o ya venció. Pedí uno nuevo a tu empresa.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        <div style={s.icono}>🔑</div>
        <h2 style={s.titulo}>Recuperar contraseña</h2>

        {paso === 1 && (
          <form onSubmit={handleCodigo} style={s.form}>
            <p style={s.info}>
              Pedí un código de recuperación a tu empresa y escribilo acá. Por seguridad, usalo apenas te lo entreguen.
            </p>
            <label style={s.label}>
              Código de recuperación
              <input
                style={{ ...s.input, textTransform: 'uppercase', letterSpacing: 4, fontSize: 20, textAlign: 'center', fontWeight: 700 }}
                value={codigo}
                onChange={e => setCodigo(e.target.value.toUpperCase())}
                placeholder="XXX-XXX"
                autoFocus
                autoComplete="off"
                spellCheck={false}
                maxLength={7}
                required
              />
            </label>
            {error && <p role="alert" style={s.error}>{error}</p>}
            <button type="submit" style={s.btn}>Continuar →</button>
            <button type="button" onClick={onVolver} style={s.linkBtn}>← Volver al inicio de sesión</button>
          </form>
        )}

        {paso === 2 && (
          <form onSubmit={handleSubmit} style={s.form}>
            <p style={s.info}>Código <strong style={{ fontFamily: 'monospace', color: 'var(--verde)' }}>{codigo}</strong>. Elegí tu nueva contraseña.</p>

            <label style={s.label}>
              Nueva contraseña
              <div style={{ position: 'relative' }}>
                <input
                  style={{ ...s.input, paddingRight: 44 }}
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required minLength={8}
                  placeholder="Mínimo 8 caracteres"
                  autoComplete="new-password"
                  autoFocus
                />
                <button type="button" tabIndex={-1} onClick={() => setShowPass(v => !v)} style={s.eyeBtn} aria-label={showPass ? 'Ocultar' : 'Ver'}>
                  {showPass
                    ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={s.eyeIco}><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={s.eyeIco}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
            </label>

            <label style={s.label}>
              Confirmar contraseña
              <div style={{ position: 'relative' }}>
                <input
                  style={{ ...s.input, paddingRight: 44, borderColor: password2 && password2 !== password ? '#dc2626' : undefined }}
                  type={showPass ? 'text' : 'password'}
                  value={password2}
                  onChange={e => setPassword2(e.target.value)}
                  required
                  placeholder="Repetí la contraseña"
                  autoComplete="new-password"
                />
                <button type="button" tabIndex={-1} onClick={() => setShowPass(v => !v)} style={s.eyeBtn} aria-label={showPass ? 'Ocultar' : 'Ver'}>
                  {showPass
                    ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={s.eyeIco}><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={s.eyeIco}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
            </label>

            {error && <p role="alert" style={s.error}>{error}</p>}

            <button type="submit" style={s.btn} disabled={loading}>
              {loading
                ? <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                    <svg style={{ width: 18, height: 18, animation: 'spin 0.8s linear infinite' }} viewBox="0 0 24 24" fill="none">
                      <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="white" strokeWidth="4"/>
                      <path style={{ opacity: 0.75 }} fill="white" d="M4 12a8 8 0 018-8v8z"/>
                    </svg>
                    Guardando…
                  </span>
                : 'Guardar nueva contraseña'}
            </button>
            <button type="button" onClick={() => { setPaso(1); setError(''); }} style={s.linkBtn}>← Cambiar código</button>
          </form>
        )}
      </div>
    </div>
  );
}

const s = {
  wrap:    { minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: '#f8fafc' },
  card:    { background: '#fff', borderRadius: 20, padding: '32px 28px', width: '100%', maxWidth: 400, boxShadow: '0 4px 24px rgba(0,0,0,0.07)', border: '1px solid #f1f5f9', textAlign: 'center' },
  icono:   { fontSize: 44, marginBottom: 8 },
  titulo:  { fontSize: 22, fontWeight: 800, color: 'var(--verde)', marginBottom: 16 },
  info:    { fontSize: 14, color: 'var(--subtexto)', marginBottom: 8, lineHeight: 1.5 },
  form:    { display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'left' },
  label:   { display: 'flex', flexDirection: 'column', gap: 5, fontWeight: 600, fontSize: 14, color: '#374151' },
  input:   { padding: '11px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 16, outline: 'none', width: '100%', boxSizing: 'border-box' },
  eyeBtn:  { position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#9ca3af', display: 'flex', alignItems: 'center' },
  eyeIco:  { width: 18, height: 18 },
  error:   { color: '#dc2626', fontSize: 14, textAlign: 'center', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px' },
  btn:     { background: 'var(--verde)', color: '#fff', border: 'none', borderRadius: 12, padding: '13px', fontSize: 16, fontWeight: 700, marginTop: 4, cursor: 'pointer' },
  linkBtn: { background: 'none', border: 'none', color: 'var(--subtexto)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline', textAlign: 'center', padding: '4px 0' },
};
