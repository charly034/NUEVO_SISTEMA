import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { pedidoApi } from '../api.js';
import { DIAS_LABEL } from '../utils.js';

const ESTADO_CONFIG = {
  pendiente:   { label: 'Confirmado',  color: '#2e7d32', bg: '#e8f5e9' },
  en_proceso:  { label: 'En proceso',  color: '#e65100', bg: '#fff3e0' },
  listo:       { label: 'Listo',       color: '#1565c0', bg: '#e3f2fd' },
  entregado:   { label: 'Entregado',   color: '#555',    bg: '#f5f5f5' },
  cancelado:   { label: 'Cancelado',   color: '#c62828', bg: '#ffebee' },
};

function formatSemana(fechaISO) {
  if (!fechaISO) return '';
  const [y, m, d] = String(fechaISO).split('T')[0].split('-').map(Number);
  const lunes = new Date(y, m - 1, d);
  const viernes = new Date(y, m - 1, d + 4);
  const fmt = (dt) => `${dt.getDate()}/${dt.getMonth() + 1}`;
  return `${fmt(lunes)} al ${fmt(viernes)} de ${viernes.getFullYear()}`;
}

function lunesDeHoy() {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const dia = hoy.getDay(); // 0=dom, 1=lun, ...
  const diff = dia === 0 ? -6 : 1 - dia;
  hoy.setDate(hoy.getDate() + diff);
  return hoy;
}

function esEstaSemana(fechaISO) {
  if (!fechaISO) return false;
  const [y, m, d] = String(fechaISO).split('T')[0].split('-').map(Number);
  const semana = new Date(y, m - 1, d);
  const lunes = lunesDeHoy();
  return semana.getTime() === lunes.getTime();
}

export default function HistorialPedidos({ empleado }) {
  const [expandido, setExpandido] = useState(null);

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ['mi-historial', empleado.id],
    queryFn: pedidoApi.miHistorial,
    staleTime: 60 * 1000,
  });

  if (isLoading) {
    return (
      <div style={s.wrap}>
        <p style={{ textAlign: 'center', padding: 60, color: 'var(--subtexto)' }}>Cargando historial...</p>
      </div>
    );
  }

  const pedidosActivos = pedidos.filter(p => p.estado !== 'cancelado');

  if (pedidosActivos.length === 0) {
    return (
      <div style={s.wrap}>
        <h2 style={s.titulo}>Mis pedidos</h2>
        <div style={s.empty}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
          <p style={{ color: 'var(--subtexto)', fontSize: 15 }}>Todavía no tenés pedidos registrados.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={s.wrap}>
      <h2 style={s.titulo}>Mis pedidos</h2>
      <p style={{ color: 'var(--subtexto)', fontSize: 13, marginBottom: 16 }}>
        {pedidosActivos.length} semana{pedidosActivos.length !== 1 ? 's' : ''} registrada{pedidosActivos.length !== 1 ? 's' : ''}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 90 }}>
        {pedidosActivos.map(p => {
          const cfg = ESTADO_CONFIG[p.estado] ?? ESTADO_CONFIG.pendiente;
          const esCurrent = esEstaSemana(p.semana_inicio);
          const abierto = expandido === p.id;
          const items = p.items ?? [];

          return (
            <div key={p.id} style={s.card}>
              <button style={s.cardHeader} onClick={() => setExpandido(abierto ? null : p.id)}>
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>
                      Semana del {formatSemana(p.semana_inicio)}
                    </span>
                    {esCurrent && (
                      <span style={{ fontSize: 11, background: 'var(--verde)', color: '#fff', borderRadius: 20, padding: '2px 8px', fontWeight: 700 }}>
                        Esta semana
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <span style={{ fontSize: 12, background: cfg.bg, color: cfg.color, borderRadius: 20, padding: '2px 9px', fontWeight: 600 }}>
                      {cfg.label}
                    </span>
                    <span style={{ fontSize: 12, color: 'var(--subtexto)' }}>
                      {items.length} día{items.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                <span style={{ color: 'var(--subtexto)', fontSize: 18, marginLeft: 8 }}>{abierto ? '▲' : '▼'}</span>
              </button>

              {abierto && (
                <div style={{ borderTop: '1px solid var(--borde)', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {items.length === 0 ? (
                    <p style={{ color: 'var(--subtexto)', fontSize: 13 }}>Sin platos registrados.</p>
                  ) : (
                    items.map(item => (
                      <div key={item.dia} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: 'var(--verde)', minWidth: 72 }}>
                          {DIAS_LABEL[item.dia] ?? item.dia}
                        </span>
                        <div>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>{item.plato_nombre}</div>
                          {item.guarnicion_nombre && (
                            <div style={{ fontSize: 12, color: 'var(--subtexto)' }}>+ {item.guarnicion_nombre}</div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

const s = {
  wrap:       { maxWidth: 560, margin: '0 auto', padding: '20px 14px' },
  titulo:     { fontSize: 22, fontWeight: 800, color: '#1a1a1a', marginBottom: 4 },
  empty:      { textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: 16, marginTop: 24 },
  card:       { background: '#fff', borderRadius: 14, border: '2px solid var(--borde)', overflow: 'hidden' },
  cardHeader: { width: '100%', background: 'none', border: 'none', padding: '14px 16px', display: 'flex', alignItems: 'center', cursor: 'pointer', textAlign: 'left' },
};
