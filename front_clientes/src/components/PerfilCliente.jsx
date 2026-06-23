const PLANES = { basico: 'Básico', con_postre: 'Con postre', con_postre_bebida: 'Con postre y bebida' };

export default function PerfilCliente({ empleado, onLogout }) {
  const iniciales = `${empleado.nombre?.[0] ?? ''}${empleado.apellido?.[0] ?? ''}`.toUpperCase();
  const plan = PLANES[empleado.empresa?.plan] ?? empleado.empresa?.plan ?? '—';

  return (
    <div style={s.wrap}>
      {/* Avatar */}
      <div style={s.avatarWrap}>
        <div style={s.avatar}>{iniciales}</div>
        <h2 style={s.nombre}>{empleado.nombre} {empleado.apellido}</h2>
        <p style={s.email}>{empleado.email}</p>
      </div>

      {/* Info empresa */}
      <div style={s.card}>
        <p style={s.cardLabel}>Mi empresa</p>
        <div style={s.row}>
          <span style={s.rowLabel}>Empresa</span>
          <span style={s.rowVal}>{empleado.empresa?.nombre ?? '—'}</span>
        </div>
        <div style={s.row}>
          <span style={s.rowLabel}>Plan</span>
          <span style={s.rowVal}>{plan}</span>
        </div>
      </div>

      {/* Cerrar sesión */}
      <button onClick={onLogout} style={s.btnLogout}>
        Cerrar sesión
      </button>

      <p style={{ textAlign: 'center', fontSize: 11, color: '#ccc', marginTop: 32, paddingBottom: 90 }}>
        La Quinta · Sistema de pedidos
      </p>
    </div>
  );
}

const s = {
  wrap:       { maxWidth: 560, margin: '0 auto', padding: '32px 14px' },
  avatarWrap: { textAlign: 'center', marginBottom: 28 },
  avatar:     { width: 72, height: 72, borderRadius: '50%', background: 'var(--verde)', color: '#fff', fontSize: 26, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' },
  nombre:     { fontSize: 22, fontWeight: 800, color: '#1a1a1a', margin: '0 0 4px' },
  email:      { fontSize: 14, color: 'var(--subtexto)', margin: 0 },
  card:       { background: '#fff', borderRadius: 14, border: '1px solid var(--borde)', padding: '16px 18px', marginBottom: 16 },
  cardLabel:  { fontSize: 11, fontWeight: 700, color: 'var(--subtexto)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  row:        { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--borde)' },
  rowLabel:   { fontSize: 14, color: 'var(--subtexto)' },
  rowVal:     { fontSize: 14, fontWeight: 600, color: '#1a1a1a' },
  btnLogout:  { width: '100%', padding: '13px', borderRadius: 12, border: '2px solid #e74c3c', background: '#fff', color: '#c0392b', fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 8 },
};
