import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { menuApi, pedidoApi } from '../services/api.js';
import { DIAS_LABEL, getDiasSemana } from '../utils/dias.js';
import { confirmar, toast } from '../lib/swal.js';
import styles from './HistorialPedidos.module.css';

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
  const dia = hoy.getDay();
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

function fechaKey(fechaISO) {
  return String(fechaISO || '').split('T')[0];
}

function construirDiasPedido(pedido, menuSemana) {
  const items = pedido.items ?? [];
  const porDia = new Map(items.map(item => [item.dia, item]));
  const dias = menuSemana ? getDiasSemana(menuSemana.dias_laborales) : items.map(item => item.dia);
  return dias.map(dia => ({ dia, item: porDia.get(dia) || null }));
}

export default function HistorialPedidos({ empleado }) {
  const queryClient = useQueryClient();
  const [expandido, setExpandido] = useState(null);

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ['mi-historial', empleado.id],
    queryFn: pedidoApi.miHistorial,
    staleTime: 60 * 1000,
  });

  const { data: menuData } = useQuery({
    queryKey: ['menus-publicados'],
    queryFn: menuApi.activo,
    staleTime: 60 * 1000,
  });

  const menusPorSemana = new Map(
    (menuData?.menus_disponibles ?? []).map(menuSemana => [fechaKey(menuSemana.menu?.fecha_inicio), menuSemana])
  );

  const pedidosVisibles = pedidos.filter(p => p.estado !== 'cancelado');

  const mutationCancelar = useMutation({
    mutationFn: pedidoApi.cancelar,
    onSuccess: (_data, semanaInicio) => {
      queryClient.invalidateQueries({ queryKey: ['mi-historial', empleado.id] });
      queryClient.invalidateQueries({ queryKey: ['mi-pedido', empleado.id, semanaInicio] });
      queryClient.invalidateQueries({ queryKey: ['menus-publicados'] });
      setExpandido(null);
      toast.success('Pedido eliminado. Podés volver a cargarlo mientras siga abierto.');
    },
    onError: (e) => toast.error(e?.message || 'No se pudo eliminar el pedido'),
  });

  const eliminarPedido = async (pedido) => {
    if (!await confirmar({
      titulo: '¿Eliminar pedido?',
      texto: 'Se eliminará el pedido completo de esa semana. Si el plazo sigue abierto, vas a poder cargarlo de nuevo.',
      botonConfirmar: 'Sí, eliminar',
      color: '#dc2626',
    })) return;
    mutationCancelar.mutate(fechaKey(pedido.semana_inicio));
  };

  if (isLoading) {
    return (
      <div className={styles.wrap}>
        <p style={{ textAlign: 'center', padding: 60, color: 'var(--subtexto)' }}>Cargando pedidos...</p>
      </div>
    );
  }

  if (pedidosVisibles.length === 0) {
    return (
      <div className={styles.wrap}>
        <h2 className={styles.titulo}>Mis pedidos</h2>
        <div className={styles.empty}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
          <p style={{ color: 'var(--subtexto)', fontSize: 15 }}>Todavía no tenés pedidos registrados.</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.wrap}>
      <h2 className={styles.titulo}>Mis pedidos</h2>
      <p style={{ color: 'var(--subtexto)', fontSize: 13, marginBottom: 16 }}>
        {pedidosVisibles.length} semana{pedidosVisibles.length !== 1 ? 's' : ''} registrada{pedidosVisibles.length !== 1 ? 's' : ''}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {pedidosVisibles.map(p => {
          const cfg = ESTADO_CONFIG[p.estado] ?? ESTADO_CONFIG.pendiente;
          const esCurrent = esEstaSemana(p.semana_inicio);
          const abierto = expandido === p.id;
          const items = p.items ?? [];
          const menuSemana = menusPorSemana.get(fechaKey(p.semana_inicio));
          const diasPedido = construirDiasPedido(p, menuSemana);
          const puedeEliminar = ['pendiente', 'en_proceso'].includes(p.estado)
            && menuSemana?.disponible
            && !menuSemana?.limiteEmpresa?.vencido;

          return (
            <div key={p.id} className={styles.card}>
              <button className={styles.cardHeader} onClick={() => setExpandido(abierto ? null : p.id)}>
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
                  {diasPedido.length === 0 ? (
                    <p style={{ color: 'var(--subtexto)', fontSize: 13 }}>Sin platos registrados.</p>
                  ) : (
                    diasPedido.map(({ dia, item }) => (
                      <div
                        key={dia}
                        className={`${styles.diaFila}${!item ? ` ${styles.diaFilaSinVianda}` : ''}`}
                      >
                        <span className={`${styles.diaLabel}${!item ? ` ${styles.diaLabelSinVianda}` : ''}`}>
                          {DIAS_LABEL[dia] ?? dia}
                        </span>
                        <div>
                          {item ? (
                            <>
                              <div style={{ fontSize: 14, fontWeight: 600 }}>{item.plato_nombre}</div>
                              {item.guarnicion_nombre && (
                                <div style={{ fontSize: 12, color: 'var(--subtexto)' }}>+ {item.guarnicion_nombre}</div>
                              )}
                            </>
                          ) : (
                            <div className={styles.sinVianda}>No pedís vianda</div>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                  {puedeEliminar && (
                    <button
                      type="button"
                      onClick={() => eliminarPedido(p)}
                      disabled={mutationCancelar.isPending}
                      className={styles.btnEliminar}
                    >
                      {mutationCancelar.isPending ? 'Eliminando...' : 'Eliminar pedido de esta semana'}
                    </button>
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
