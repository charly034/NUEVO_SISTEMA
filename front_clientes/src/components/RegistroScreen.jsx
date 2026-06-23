import { useState, useRef } from 'react';
import { authApi, saveClientSession } from '../api.js';

// ── Utilidades ─────────────────────────────────────────────────────────────────

function slugify(str) {
  return str.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

function emailSugerido(nombre, apellido, empresa) {
  const n = slugify(nombre || '');
  const a = slugify(apellido || '');
  const e = slugify(empresa || '');
  if (!n || !e) return '';
  return a ? `${n}.${a}@${e}.com` : `${n}@${e}.com`;
}

// ── Componente principal ────────────────────────────────────────────────────────

export default function RegistroScreen({ onRegistrado, onVolver }) {
  const [paso, setPaso] = useState(1);
  const [codigo, setCodigo]         = useState('');
  const [empresa, setEmpresa]       = useState(null); // { id, nombre }
  const [loadingCodigo, setLoadingCodigo] = useState(false);
  const [errorCodigo, setErrorCodigo]     = useState('');

  const [nombre, setNombre]         = useState('');
  const [apellido, setApellido]     = useState('');
  const [email, setEmail]           = useState('');
  const [emailManual, setEmailManual] = useState(false);
  const [telefono, setTelefono]     = useState('');
  const [nacimiento, setNacimiento] = useState('');
  const [password, setPassword]     = useState('');
  const [password2, setPassword2]   = useState('');
  const [showPass, setShowPass]     = useState(false);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');

  const codigoRef = useRef(null);

  // ── Paso 1: verificar código ──────────────────────────────────────────────────

  const handleCodigo = async (e) => {
    e.preventDefault();
    setErrorCodigo('');
    setLoadingCodigo(true);
    try {
      const data = await authApi.verificarCodigo(codigo.trim().toUpperCase());
      setEmpresa(data);
      setPaso(2);
    } catch (err) {
      setErrorCodigo(err?.message || 'Código no válido');
    } finally {
      setLoadingCodigo(false);
    }
  };

  // Actualizar email sugerido cuando cambian nombre/apellido (solo si no lo editó manualmente)
  const handleNombre = (v) => {
    setNombre(v);
    if (!emailManual) setEmail(emailSugerido(v, apellido, empresa?.nombre));
  };
  const handleApellido = (v) => {
    setApellido(v);
    if (!emailManual) setEmail(emailSugerido(nombre, v, empresa?.nombre));
  };
  const handleEmail = (v) => {
    setEmail(v);
    setEmailManual(true);
  };

  // ── Paso 2: crear cuenta ──────────────────────────────────────────────────────

  const handleRegistro = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== password2) return setError('Las contraseñas no coinciden');
    if (password.length < 6) return setError('La contraseña debe tener al menos 6 caracteres');
    setLoading(true);
    try {
      const data = await authApi.registro({
        codigo: codigo.trim().toUpperCase(),
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        email: email.trim(),
        password,
        telefono: telefono.trim() || null,
        fecha_nacimiento: nacimiento || null,
      });
      saveClientSession({ token: data.token, empleado: data.empleado }, false);
      onRegistrado(data.empleado);
    } catch (err) {
      setError(err?.message || 'Error al crear la cuenta');
    } finally {
      setLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div style={s.wrap}>
      <div style={s.card}>
        <div style={s.logo}>🌿</div>
        <h1 style={s.titulo}>La Quinta</h1>
        <p style={s.sub}>Crear cuenta</p>

        {/* Indicador de pasos */}
        <div style={s.pasos}>
          <div style={{ ...s.paso, ...(paso >= 1 ? s.pasoActivo : {}) }}>
            <span style={s.pasoNum}>1</span>
            <span style={s.pasoLabel}>Código</span>
          </div>
          <div style={s.pasoDivider} />
          <div style={{ ...s.paso, ...(paso >= 2 ? s.pasoActivo : {}) }}>
            <span style={s.pasoNum}>2</span>
            <span style={s.pasoLabel}>Tus datos</span>
          </div>
        </div>

        {/* ── Paso 1 ── */}
        {paso === 1 && (
          <form onSubmit={handleCodigo} style={s.form}>
            <p style={s.instruccion}>
              Ingresá el código de tu empresa para continuar.
            </p>

            <label style={s.label}>
              Código de empresa
              <input
                ref={codigoRef}
                style={{ ...s.input, textTransform: 'uppercase', letterSpacing: 3, fontSize: 20, textAlign: 'center', fontWeight: 700 }}
                value={codigo}
                onChange={e => setCodigo(e.target.value.toUpperCase().slice(0, 8))}
                placeholder="ABC123"
                autoFocus
                autoComplete="off"
                spellCheck={false}
                maxLength={8}
                required
              />
            </label>

            {errorCodigo && <p role="alert" style={s.error}>{errorCodigo}</p>}

            <button type="submit" style={s.btn} disabled={loadingCodigo || codigo.length < 4}>
              {loadingCodigo ? 'Verificando…' : 'Continuar →'}
            </button>

            <button type="button" onClick={onVolver} style={s.linkBtn}>
              ← Volver al inicio de sesión
            </button>
          </form>
        )}

        {/* ── Paso 2 ── */}
        {paso === 2 && empresa && (
          <form onSubmit={handleRegistro} style={s.form}>
            {/* Empresa confirmada */}
            <div style={s.empresaBanner}>
              ✅ <strong>{empresa.nombre}</strong>
            </div>

            <div style={s.fila2}>
              <label style={s.label}>
                Nombre
                <input style={s.input} value={nombre} onChange={e => handleNombre(e.target.value)}
                  required autoFocus placeholder="Martín" />
              </label>
              <label style={s.label}>
                Apellido
                <input style={s.input} value={apellido} onChange={e => handleApellido(e.target.value)}
                  required placeholder="García" />
              </label>
            </div>

            <label style={s.label}>
              Email
              <input style={s.input} type="email" value={email}
                onChange={e => handleEmail(e.target.value)}
                required placeholder="tu@email.com"
                autoComplete="username" />
              {!emailManual && email && (
                <span style={s.hint}>Sugerido — podés cambiarlo</span>
              )}
            </label>

            <label style={s.label}>
              Teléfono <span style={s.opcional}>(opcional)</span>
              <input style={s.input} type="tel" value={telefono}
                onChange={e => setTelefono(e.target.value)}
                placeholder="+54 261 555-0000" />
            </label>

            <label style={s.label}>
              Fecha de nacimiento <span style={s.opcional}>(opcional)</span>
              <input style={s.input} type="date" value={nacimiento}
                onChange={e => setNacimiento(e.target.value)} />
            </label>

            <label style={s.label}>
              Contraseña
              <div style={{ position: 'relative' }}>
                <input
                  style={{ ...s.input, paddingRight: 44, marginBottom: 0 }}
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required minLength={6}
                  placeholder="Mínimo 6 caracteres"
                  autoComplete="new-password"
                />
                <button type="button" tabIndex={-1}
                  onClick={() => setShowPass(v => !v)}
                  style={s.eyeBtn}
                  aria-label={showPass ? 'Ocultar' : 'Ver'}>
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
                  style={{ ...s.input, paddingRight: 44, marginBottom: 0, borderColor: password2 && password2 !== password ? '#dc2626' : undefined }}
                  type={showPass ? 'text' : 'password'}
                  value={password2}
                  onChange={e => setPassword2(e.target.value)}
                  required placeholder="Repetí la contraseña"
                  autoComplete="new-password"
                />
                <button type="button" tabIndex={-1}
                  onClick={() => setShowPass(v => !v)}
                  style={s.eyeBtn}
                  aria-label={showPass ? 'Ocultar' : 'Ver'}>
                  {showPass
                    ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={s.eyeIco}><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={s.eyeIco}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
            </label>

            {error && <p role="alert" style={s.error}>{error}</p>}

            <button type="submit" style={s.btn} disabled={loading}>
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <svg style={{ width: 18, height: 18, animation: 'spin 0.8s linear infinite' }} viewBox="0 0 24 24" fill="none">
                    <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="white" strokeWidth="4"/>
                    <path style={{ opacity: 0.75 }} fill="white" d="M4 12a8 8 0 018-8v8z"/>
                  </svg>
                  Creando cuenta…
                </span>
              ) : 'Crear cuenta'}
            </button>

            <button type="button" onClick={() => setPaso(1)} style={s.linkBtn}>
              ← Cambiar código de empresa
            </button>
          </form>
        )}
      </div>

      {typeof document !== 'undefined' && (() => {
        if (!document.getElementById('reg-spin')) {
          const st = document.createElement('style');
          st.id = 'reg-spin';
          st.textContent = '@keyframes spin { to { transform: rotate(360deg); } }';
          document.head.appendChild(st);
        }
        return null;
      })()}
    </div>
  );
}

const s = {
  wrap:          { minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: '#f8fafc' },
  card:          { background: '#fff', borderRadius: 20, padding: '32px 28px', width: '100%', maxWidth: 420, boxShadow: '0 4px 24px rgba(0,0,0,0.07)', border: '1px solid #f1f5f9', textAlign: 'center' },
  logo:          { fontSize: 44, marginBottom: 6 },
  titulo:        { fontSize: 24, fontWeight: 800, color: 'var(--verde)', marginBottom: 2 },
  sub:           { color: 'var(--subtexto)', marginBottom: 20, fontSize: 14 },
  pasos:         { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 24 },
  paso:          { display: 'flex', alignItems: 'center', gap: 6, opacity: 0.35 },
  pasoActivo:    { opacity: 1 },
  pasoNum:       { width: 24, height: 24, borderRadius: '50%', background: 'var(--verde)', color: '#fff', fontSize: 12, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  pasoLabel:     { fontSize: 13, fontWeight: 600, color: 'var(--verde)' },
  pasoDivider:   { width: 32, height: 2, background: '#e5e7eb', borderRadius: 2 },
  form:          { display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'left' },
  instruccion:   { fontSize: 14, color: 'var(--subtexto)', textAlign: 'center', marginBottom: 4 },
  label:         { display: 'flex', flexDirection: 'column', gap: 5, fontWeight: 600, fontSize: 14, color: '#374151' },
  input:         { padding: '11px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 16, outline: 'none', width: '100%', boxSizing: 'border-box', marginBottom: 0 },
  fila2:         { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  hint:          { fontSize: 12, color: 'var(--subtexto)', fontStyle: 'italic', marginTop: 2 },
  opcional:      { fontWeight: 400, color: 'var(--subtexto)', fontSize: 13 },
  empresaBanner: { background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: 12, padding: '10px 16px', fontSize: 15, color: '#15803d', textAlign: 'center' },
  eyeBtn:        { position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#9ca3af', display: 'flex', alignItems: 'center' },
  eyeIco:        { width: 18, height: 18 },
  error:         { color: '#dc2626', fontSize: 14, textAlign: 'center', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px' },
  btn:           { background: 'var(--verde)', color: '#fff', border: 'none', borderRadius: 12, padding: '13px', fontSize: 16, fontWeight: 700, marginTop: 4, cursor: 'pointer' },
  linkBtn:       { background: 'none', border: 'none', color: 'var(--subtexto)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline', textAlign: 'center', padding: '4px 0' },
};
