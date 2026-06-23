import { useState } from 'react';
import { authApi } from '../api.js';

const PLANES = { basico: 'Básico', con_postre: 'Con postre', con_postre_bebida: 'Con postre y bebida' };

function PasswordVisibilityButton({ showPass, onToggle }) {
  return (
    <button type="button" tabIndex={-1} onClick={onToggle} style={f.eyeBtn} aria-label={showPass ? 'Ocultar' : 'Ver'}>
      {showPass
        ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={f.eyeIco}><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
        : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={f.eyeIco}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
      }
    </button>
  );
}

function formatFecha(iso) {
  if (!iso) return null;
  const [y, m, d] = iso.split('T')[0].split('-');
  return `${d}/${m}/${y}`;
}

// ── Formulario cambio de contraseña ──────────────────────────────────────────
function CambiarPasswordForm({ onCerrar }) {
  const [actual, setActual]     = useState('');
  const [nuevo, setNuevo]       = useState('');
  const [nuevo2, setNuevo2]     = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [ok, setOk]             = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (nuevo !== nuevo2) return setError('Las contraseñas no coinciden');
    if (nuevo.length < 6)  return setError('Mínimo 6 caracteres');
    setLoading(true);
    try {
      await authApi.cambiarPassword(actual, nuevo);
      setOk(true);
    } catch (err) {
      setError(err?.message || 'Error al cambiar la contraseña');
    } finally {
      setLoading(false);
    }
  };

  if (ok) return (
    <div style={{ textAlign: 'center', padding: '8px 0' }}>
      <div style={{ fontSize: 36, marginBottom: 8 }}>✅</div>
      <p style={{ fontWeight: 700, color: 'var(--verde)', marginBottom: 12 }}>¡Contraseña actualizada!</p>
      <button onClick={onCerrar} style={f.btnOk}>Listo</button>
    </div>
  );

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <label style={f.label}>
        Contraseña actual
        <div style={{ position: 'relative' }}>
          <input style={{ ...f.input, paddingRight: 44 }} type={showPass ? 'text' : 'password'}
            value={actual} onChange={e => setActual(e.target.value)} required autoFocus autoComplete="current-password" />
          <PasswordVisibilityButton showPass={showPass} onToggle={() => setShowPass(v => !v)} />
        </div>
      </label>
      <label style={f.label}>
        Nueva contraseña
        <div style={{ position: 'relative' }}>
          <input style={{ ...f.input, paddingRight: 44 }} type={showPass ? 'text' : 'password'}
            value={nuevo} onChange={e => setNuevo(e.target.value)} required minLength={6}
            placeholder="Mínimo 6 caracteres" autoComplete="new-password" />
          <PasswordVisibilityButton showPass={showPass} onToggle={() => setShowPass(v => !v)} />
        </div>
      </label>
      <label style={f.label}>
        Confirmar nueva contraseña
        <div style={{ position: 'relative' }}>
          <input style={{ ...f.input, paddingRight: 44, borderColor: nuevo2 && nuevo2 !== nuevo ? '#dc2626' : undefined }}
            type={showPass ? 'text' : 'password'}
            value={nuevo2} onChange={e => setNuevo2(e.target.value)} required autoComplete="new-password" />
          <PasswordVisibilityButton showPass={showPass} onToggle={() => setShowPass(v => !v)} />
        </div>
      </label>
      {error && <p role="alert" style={f.error}>{error}</p>}
      <button type="submit" style={f.btnPrimary} disabled={loading}>
        {loading ? 'Guardando…' : 'Guardar'}
      </button>
      <button type="button" onClick={onCerrar} style={f.btnLink}>Cancelar</button>
    </form>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function PerfilCliente({ empleado, onLogout, onEmpleadoUpdate }) {
  const iniciales = `${empleado.nombre?.[0] ?? ''}${empleado.apellido?.[0] ?? ''}`.toUpperCase();
  const plan      = PLANES[empleado.empresa?.plan] ?? empleado.empresa?.plan ?? '—';

  const [editando, setEditando]         = useState(false);
  const [showPass, setShowPass]         = useState(false);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState('');
  const [guardado, setGuardado]         = useState(false);

  // Form state — inicializado con datos del empleado
  const [form, setForm] = useState({
    nombre:           empleado.nombre        ?? '',
    apellido:         empleado.apellido      ?? '',
    telefono:         empleado.telefono      ?? '',
    fecha_nacimiento: empleado.fecha_nacimiento ? empleado.fecha_nacimiento.split('T')[0] : '',
  });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleGuardar = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.nombre.trim() || !form.apellido.trim()) return setError('Nombre y apellido son obligatorios');
    setLoading(true);
    try {
      const updated = await authApi.actualizarPerfil(form);
      onEmpleadoUpdate?.({ ...empleado, ...updated });
      setEditando(false);
      setGuardado(true);
      setTimeout(() => setGuardado(false), 3000);
    } catch (err) {
      setError(err?.message || 'Error al guardar');
    } finally {
      setLoading(false);
    }
  };

  const cancelar = () => {
    setForm({
      nombre:           empleado.nombre        ?? '',
      apellido:         empleado.apellido      ?? '',
      telefono:         empleado.telefono      ?? '',
      fecha_nacimiento: empleado.fecha_nacimiento ? empleado.fecha_nacimiento.split('T')[0] : '',
    });
    setError('');
    setEditando(false);
  };

  return (
    <div style={s.wrap}>

      {/* Avatar + nombre */}
      <div style={s.hero}>
        <div style={s.avatar}>{iniciales}</div>
        <div>
          <h2 style={s.nombre}>{empleado.nombre} {empleado.apellido}</h2>
          <p style={s.empresa}>{empleado.empresa?.nombre}</p>
        </div>
      </div>

      {/* Toast guardado */}
      {guardado && (
        <div style={s.toast}>✅ Datos actualizados</div>
      )}

      {/* ── Datos personales ── */}
      <div style={s.card}>
        <div style={s.cardHeader}>
          <span style={s.cardLabel}>Mis datos</span>
          {!editando && (
            <button onClick={() => setEditando(true)} style={s.editBtn}>
              ✏️ Editar
            </button>
          )}
        </div>

        {editando ? (
          <form onSubmit={handleGuardar} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={s.fila2}>
              <label style={s.label}>
                Nombre
                <input style={s.input} value={form.nombre} onChange={e => set('nombre', e.target.value)} required autoFocus />
              </label>
              <label style={s.label}>
                Apellido
                <input style={s.input} value={form.apellido} onChange={e => set('apellido', e.target.value)} required />
              </label>
            </div>
            <label style={s.label}>
              Teléfono <span style={s.opcional}>(opcional)</span>
              <input style={s.input} type="tel" value={form.telefono} onChange={e => set('telefono', e.target.value)} placeholder="+54 261 555-0000" />
            </label>
            <label style={s.label}>
              Fecha de nacimiento <span style={s.opcional}>(opcional)</span>
              <input style={s.input} type="date" value={form.fecha_nacimiento} onChange={e => set('fecha_nacimiento', e.target.value)} />
            </label>
            {error && <p role="alert" style={s.errorMsg}>{error}</p>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="submit" style={s.btnPrimary} disabled={loading}>
                {loading ? 'Guardando…' : 'Guardar cambios'}
              </button>
              <button type="button" onClick={cancelar} style={s.btnCancel}>Cancelar</button>
            </div>
          </form>
        ) : (
          <div style={s.dataList}>
            <Fila label="Nombre"    valor={`${empleado.nombre} ${empleado.apellido}`} />
            <Fila label="Email"     valor={empleado.email} />
            <Fila label="Teléfono"  valor={empleado.telefono || '—'} />
            <Fila label="Cumpleaños" valor={formatFecha(empleado.fecha_nacimiento) || '—'} last />
          </div>
        )}
      </div>

      {/* ── Empresa ── */}
      <div style={s.card}>
        <span style={s.cardLabel}>Mi empresa</span>
        <div style={s.dataList}>
          <Fila label="Empresa" valor={empleado.empresa?.nombre ?? '—'} />
          <Fila label="Plan"    valor={plan} last />
        </div>
      </div>

      {/* ── Seguridad ── */}
      <div style={s.card}>
        <span style={s.cardLabel}>Seguridad</span>
        {showPass
          ? <CambiarPasswordForm onCerrar={() => setShowPass(false)} />
          : (
            <button onClick={() => setShowPass(true)} style={s.btnSecundario}>
              🔒 Cambiar contraseña
            </button>
          )
        }
      </div>

      {/* Cerrar sesión */}
      <button onClick={onLogout} style={s.btnLogout}>Cerrar sesión</button>

      <p style={{ textAlign: 'center', fontSize: 11, color: '#ccc', marginTop: 24, paddingBottom: 90 }}>
        La Quinta · Sistema de pedidos
      </p>
    </div>
  );
}

function Fila({ label, valor, last }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: last ? 'none' : '1px solid var(--borde)' }}>
      <span style={{ fontSize: 14, color: 'var(--subtexto)' }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 600, color: '#1a1a1a', textAlign: 'right', maxWidth: '60%', wordBreak: 'break-all' }}>{valor}</span>
    </div>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────
const s = {
  wrap:        { maxWidth: 520, margin: '0 auto', padding: '24px 14px', paddingBottom: 100 },
  hero:        { display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24, padding: '0 4px' },
  avatar:      { width: 64, height: 64, borderRadius: '50%', background: 'var(--verde)', color: '#fff', fontSize: 24, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  nombre:      { fontSize: 20, fontWeight: 800, color: '#1a1a1a', margin: '0 0 3px' },
  empresa:     { fontSize: 13, color: 'var(--subtexto)', margin: 0 },
  toast:       { background: '#f0fdf4', border: '1px solid #86efac', color: '#15803d', borderRadius: 10, padding: '10px 16px', fontSize: 14, fontWeight: 600, textAlign: 'center', marginBottom: 12 },
  card:        { background: '#fff', borderRadius: 14, border: '1px solid var(--borde)', padding: '16px 18px', marginBottom: 14 },
  cardHeader:  { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  cardLabel:   { fontSize: 11, fontWeight: 700, color: 'var(--subtexto)', textTransform: 'uppercase', letterSpacing: 1, display: 'block', marginBottom: 12 },
  editBtn:     { background: 'none', border: 'none', fontSize: 13, color: 'var(--verde)', fontWeight: 600, cursor: 'pointer', padding: 0 },
  dataList:    { },
  fila2:       { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  label:       { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 13, fontWeight: 600, color: '#374151' },
  opcional:    { fontWeight: 400, color: 'var(--subtexto)', fontSize: 12 },
  input:       { padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 15, outline: 'none', width: '100%', boxSizing: 'border-box' },
  errorMsg:    { color: '#dc2626', fontSize: 13, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px' },
  btnPrimary:  { flex: 1, background: 'var(--verde)', color: '#fff', border: 'none', borderRadius: 10, padding: '11px', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  btnCancel:   { flex: 1, background: '#f3f4f6', color: '#374151', border: 'none', borderRadius: 10, padding: '11px', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  btnSecundario: { width: '100%', padding: '12px', borderRadius: 10, border: '1.5px solid var(--borde)', background: '#fff', color: '#374151', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  btnLogout:   { width: '100%', padding: '13px', borderRadius: 12, border: '2px solid #fee2e2', background: '#fff', color: '#dc2626', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 4 },
};

const f = {
  label:    { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 13, fontWeight: 600, color: '#374151' },
  input:    { padding: '10px 12px', borderRadius: 10, border: '1.5px solid #e5e7eb', fontSize: 15, outline: 'none', width: '100%', boxSizing: 'border-box' },
  eyeBtn:   { position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#9ca3af', display: 'flex', alignItems: 'center' },
  eyeIco:   { width: 18, height: 18 },
  error:    { color: '#dc2626', fontSize: 13, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, padding: '8px 12px', textAlign: 'center' },
  btnOk:    { width: '100%', background: 'var(--verde)', color: '#fff', border: 'none', borderRadius: 10, padding: '11px', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  btnPrimary: { width: '100%', background: 'var(--verde)', color: '#fff', border: 'none', borderRadius: 10, padding: '11px', fontSize: 14, fontWeight: 700, cursor: 'pointer' },
  btnLink:  { background: 'none', border: 'none', color: 'var(--subtexto)', fontSize: 13, cursor: 'pointer', textDecoration: 'underline', textAlign: 'center', padding: '4px 0' },
};
