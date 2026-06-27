import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMenusSemanales, useCreateMenu, useDeleteMenu, useCambiarEstadoMenu } from '../hooks/useMenus.js';
import Modal from '../components/ui/Modal.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import { toast } from '../lib/toast.js';

// ── helpers de fecha ────────────────────────────────────────────────
const MESES = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const DIAS_SEMANA = ['lunes','martes','miercoles','jueves','viernes','sabado','domingo'];
const DIA_LABEL = { lunes:'Lun', martes:'Mar', miercoles:'Mié', jueves:'Jue', viernes:'Vie', sabado:'Sáb', domingo:'Dom' };

// Extrae YYYY-MM-DD de un string ISO (no toca timezone)
function soloFecha(str) { return str ? str.split('T')[0] : ''; }

// Convierte un objeto Date a YYYY-MM-DD usando hora LOCAL (evita el desfase UTC)
function localISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

// Suma n días a una fecha ISO YYYY-MM-DD usando aritmética local
function addDias(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  return localISO(new Date(y, m - 1, d + n));
}

function addSemanas(iso, n) { return addDias(iso, n * 7); }

// Lunes de la semana actual en hora local
function getLunesActual() {
  const hoy = new Date();
  const offset = (hoy.getDay() + 6) % 7; // lun=0 mar=1 ... dom=6
  return localISO(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - offset));
}

function formatCorto(iso) {
  if (!iso) return '—';
  const [, m, d] = soloFecha(iso).split('-');
  return `${parseInt(d)} ${MESES[parseInt(m) - 1]}`;
}

function nombreSugerido(lunesIso) {
  const [, lm, ld] = soloFecha(lunesIso).split('-');
  const domingoIso = addDias(lunesIso, 6);
  const [, dm, dd] = soloFecha(domingoIso).split('-');
  return `Semana del ${parseInt(ld)}/${parseInt(lm)} al ${parseInt(dd)}/${parseInt(dm)}`;
}

// ── estado config ────────────────────────────────────────────────────
const ESTADO_CFG = {
  borrador:  { label: 'Borrador',  bg: '#f3f4f6', color: '#374151', border: '#d1d5db' },
  publicado: { label: 'Publicado', bg: '#dcfce7', color: '#15803d', border: '#86efac' },
  cerrado:   { label: 'Cerrado',   bg: '#ffedd5', color: '#c2410c', border: '#fdba74' },
  vacio:     { label: 'Sin menú',  bg: '#fff',    color: '#d1d5db', border: '#f3f4f6' },
};

// ── Tile de semana ───────────────────────────────────────────────────
function SemanaTile({ lunesIso, menu, selected, onSelect, esHoy }) {
  const domingo = addDias(lunesIso, 6);
  const estado = menu?.estado ?? 'vacio';
  const cfg = ESTADO_CFG[estado];
  const diasMap = new Set((menu?.dias ?? []).map(d => d.dia));
  const sinSet  = new Set((menu?.sin_servicio ?? []).map(d => d.dia));

  return (
    <button
      onClick={() => onSelect(lunesIso)}
      style={{
        flex: 1,
        minWidth: 0,
        padding: '10px 6px 8px',
        borderRadius: 12,
        border: selected ? '2px solid #16a34a' : `2px solid ${esHoy ? '#fde68a' : '#e5e7eb'}`,
        background: selected ? '#f0fdf4' : esHoy ? '#fffbeb' : '#fff',
        boxShadow: selected ? '0 0 0 3px #bbf7d0' : '0 1px 4px rgba(0,0,0,0.06)',
        cursor: 'pointer',
        textAlign: 'center',
        transition: 'all 0.15s',
        position: 'relative',
      }}
    >
      {esHoy && (
        <span style={{
          position: 'absolute', top: 5, right: 6,
          fontSize: 8, fontWeight: 800, color: '#b45309',
          background: '#fef3c7', padding: '1px 4px', borderRadius: 4,
        }}>
          HOY
        </span>
      )}
      <div style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>{formatCorto(lunesIso)}</div>
      <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 7 }}>— {formatCorto(domingo)}</div>

      {/* puntos L M X J V */}
      <div style={{ display: 'flex', gap: 3, justifyContent: 'center', marginBottom: 7 }}>
        {DIAS_SEMANA.map(dia => (
          <div
            key={dia}
            style={{
              width: 7, height: 7, borderRadius: '50%',
              background: sinSet.has(dia) ? '#fca5a5' : diasMap.has(dia) ? '#16a34a' : '#e5e7eb',
            }}
          />
        ))}
      </div>

      <span style={{
        display: 'inline-block', fontSize: 9, fontWeight: 700,
        padding: '2px 6px', borderRadius: 20,
        background: cfg.bg, color: cfg.color,
        textTransform: 'uppercase', letterSpacing: '0.04em',
        border: `1px solid ${cfg.border}`,
      }}>
        {cfg.label}
      </span>
    </button>
  );
}

// ── Modal publicar ───────────────────────────────────────────────────
function ModalPublicarForm({ menu, onConfirm, onCancel, loading }) {
  const [fecha, setFecha] = useState('');
  const [hora, setHora]   = useState('10:00');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <p style={{ fontSize: 14, color: '#374151' }}>
        Publicar <strong>{menu?.nombre}</strong> lo hará visible para que los empleados puedan hacer su pedido.
      </p>
      <div>
        <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
          Fecha límite de pedidos <span style={{ fontWeight: 400, color: '#9ca3af' }}>(opcional)</span>
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <input type="date" value={fecha} onChange={e => setFecha(e.target.value)}
            style={{ flex: 1, padding: '8px 10px', fontSize: 13, border: '1.5px solid #d1d5db', borderRadius: 8, outline: 'none' }} />
          <input type="time" value={hora} onChange={e => setHora(e.target.value)}
            style={{ width: 100, padding: '8px 10px', fontSize: 13, border: '1.5px solid #d1d5db', borderRadius: 8, outline: 'none' }} />
        </div>
        <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 5 }}>
          Sin fecha → los pedidos quedan abiertos hasta que cerrés manualmente.
        </p>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} className="btn-secondary">Cancelar</button>
        <button
          onClick={() => onConfirm(fecha ? `${fecha}T${hora}:00` : null)}
          disabled={loading}
          className="btn-primary"
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          {loading && <Spinner size="sm" />}
          Publicar menú
        </button>
      </div>
    </div>
  );
}

// ── Panel de detalle ─────────────────────────────────────────────────
function PanelDetalle({ lunesIso, menu, estadoMut, estadoPending, onPublicar, onReabrir, onDelete }) {
  const domingo = addDias(lunesIso, 6);

  if (!menu) {
    return <PanelVacio lunesIso={lunesIso} domingoIso={domingo} />;
  }

  const { estado = 'borrador', dias = [], sin_servicio = [] } = menu;
  const cfg = ESTADO_CFG[estado];
  const diasMap  = Object.fromEntries(dias.map(d => [d.dia, d]));
  const sinSet   = new Set(sin_servicio.map(s => s.dia));
  const totalPlatos = dias.reduce((acc, d) => acc + (d.platos?.length ?? 0), 0);
  const fechaLimiteStr = menu.fecha_limite_pedidos
    ? new Date(menu.fecha_limite_pedidos).toLocaleString('es-AR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : null;

  return (
    <div>
      {/* Cabecera */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#111827' }}>{menu.nombre}</h2>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
              background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
              textTransform: 'uppercase', letterSpacing: '0.05em',
            }}>
              {cfg.label}
            </span>
          </div>
          <p style={{ fontSize: 12, color: '#6b7280' }}>
            {formatCorto(menu.fecha_inicio)} — {formatCorto(addDias(soloFecha(menu.fecha_inicio), 6))}
            {' · '}{totalPlatos} plato{totalPlatos !== 1 ? 's' : ''}
            {sin_servicio.length > 0 && ` · ${sin_servicio.length} feriado${sin_servicio.length > 1 ? 's' : ''}`}
          </p>
          {fechaLimiteStr && estado === 'publicado' && (
            <p style={{ fontSize: 12, color: '#d97706', marginTop: 2 }}>⏰ Pedidos hasta: {fechaLimiteStr}</p>
          )}
        </div>

        {/* Acciones */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {estado === 'borrador' && (
            <button onClick={onPublicar} style={btnStyle('#16a34a', '#fff')}>
              Publicar
            </button>
          )}
          {estado === 'publicado' && (
            <>
              <button
                onClick={() => estadoMut({ estado: 'cerrado' })}
                disabled={estadoPending}
                style={btnStyle('#f97316', '#fff')}
              >
                Cerrar pedidos
              </button>
              <button
                onClick={() => estadoMut({ estado: 'borrador' })}
                disabled={estadoPending}
                style={btnStyle('#f3f4f6', '#374151')}
              >
                Volver a borrador
              </button>
            </>
          )}
          {estado === 'cerrado' && (
            <button
              onClick={onReabrir}
              disabled={estadoPending}
              style={btnStyle('#16a34a', '#fff')}
            >
              Reabrir pedidos
            </button>
          )}
          <Link
            to={`/semanas/${menu.id}`}
            style={{
              fontSize: 13, fontWeight: 600, padding: '7px 14px', borderRadius: 8,
              background: '#16a34a', color: '#fff', textDecoration: 'none',
            }}
          >
            Editar grilla →
          </Link>
          {estado === 'borrador' && (
            <button
              onClick={onDelete}
              title="Eliminar menú"
              style={{ padding: '7px 8px', borderRadius: 8, background: 'transparent', border: '1.5px solid #e5e7eb', cursor: 'pointer', fontSize: 14 }}
            >
              🗑️
            </button>
          )}
        </div>
      </div>

      {/* Grid días L-D */}
      <div style={{ overflowX: 'auto', marginLeft: -4, marginRight: -4, paddingLeft: 4, paddingRight: 4 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(80px, 1fr))', gap: 6, minWidth: 560 }}>
        {DIAS_SEMANA.map((dia, i) => {
          const fechaDia = addDias(soloFecha(menu.fecha_inicio), i);
          const platos   = diasMap[dia]?.platos ?? [];
          const esSin    = sinSet.has(dia);

          return (
            <div
              key={dia}
              style={{
                borderRadius: 10,
                border: `1.5px solid ${esSin ? '#fca5a5' : platos.length > 0 ? '#86efac' : (i >= 5 ? '#f3f4f6' : '#e5e7eb')}`,
                background: esSin ? '#fff5f5' : platos.length > 0 ? '#f0fdf4' : (i >= 5 ? '#f9fafb' : '#fafafa'),
                padding: '8px 5px',
                minHeight: 80,
              }}
            >
              <div style={{ fontWeight: 700, fontSize: 12, color: '#1f2937' }}>{DIA_LABEL[dia].slice(0, 3)}</div>
              <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 7 }}>{formatCorto(fechaDia)}</div>
              {esSin ? (
                <div style={{ fontSize: 10, color: '#ef4444', fontWeight: 600 }}>Sin servicio</div>
              ) : platos.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {platos.slice(0, 3).map((p, pi) => (
                    <div key={pi} style={{ fontSize: 10, color: '#15803d', lineHeight: 1.3 }}>
                      {p.opcion && <span style={{ fontWeight: 700 }}>{p.opcion}: </span>}
                      {p.plato_nombre}
                    </div>
                  ))}
                  {platos.length > 3 && (
                    <div style={{ fontSize: 10, color: '#9ca3af' }}>+{platos.length - 3} más</div>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: 10, color: '#d1d5db' }}>Sin platos</div>
              )}
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
}

function PanelVacio({ lunesIso, domingoIso }) {
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre]   = useState('');
  const createMut = useCreateMenu();

  const handleCreate = async () => {
    try {
      const n = nombre.trim() || nombreSugerido(lunesIso);
      await createMut.mutateAsync({ nombre: n, fecha_inicio: lunesIso, fecha_fin: domingoIso });
      toast.success('Menú creado');
      setCreando(false);
      setNombre('');
    } catch (e) {
      toast.error(e.message);
    }
  };

  return (
    <div style={{ textAlign: 'center', padding: '36px 20px' }}>
      <div style={{ fontSize: 44, marginBottom: 10 }}>📅</div>
      <h3 style={{ fontWeight: 700, fontSize: 17, color: '#1f2937', marginBottom: 4 }}>
        {formatCorto(lunesIso)} — {formatCorto(domingoIso)}
      </h3>
      <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 24 }}>
        No hay menú registrado para esta semana.
      </p>

      {creando ? (
        <div style={{ maxWidth: 340, margin: '0 auto', textAlign: 'left' }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 6 }}>
            Nombre del menú
          </label>
          <input
            type="text"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
            placeholder={nombreSugerido(lunesIso)}
            autoFocus
            onKeyDown={e => e.key === 'Enter' && handleCreate()}
            style={{
              width: '100%', padding: '9px 12px', fontSize: 14, boxSizing: 'border-box',
              border: '1.5px solid #d1d5db', borderRadius: 8, outline: 'none', marginBottom: 12,
            }}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            <button onClick={() => { setCreando(false); setNombre(''); }} className="btn-secondary">
              Cancelar
            </button>
            <button
              onClick={handleCreate}
              disabled={createMut.isPending}
              className="btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: 6 }}
            >
              {createMut.isPending && <Spinner size="sm" />}
              Crear menú
            </button>
          </div>
        </div>
      ) : (
        <button onClick={() => setCreando(true)} className="btn-primary">
          + Crear menú para esta semana
        </button>
      )}
    </div>
  );
}

function btnStyle(bg, color) {
  return {
    fontSize: 13, fontWeight: 600, padding: '7px 14px', borderRadius: 8,
    background: bg, color, border: 'none', cursor: 'pointer',
  };
}

// ── Componente principal ─────────────────────────────────────────────
export default function Semanas() {
  const lunesActual = getLunesActual();
  const [ventana, setVentana] = useState(-2);        // offset de la 1ª tile visible
  const [selLunes, setSelLunes] = useState(lunesActual);
  const [modalPublicar, setModalPublicar] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmReabrir, setConfirmReabrir] = useState(false);

  const query     = useMenusSemanales({ limit: 100 });
  const deleteMut = useDeleteMenu();
  const estadoMut = useCambiarEstadoMenu();

  const menus = query.data?.menus ?? [];
  const menuByLunes = new Map(menus.map(m => [soloFecha(m.fecha_inicio), m]));

  // 5 tiles visibles
  const tilesLunes = Array.from({ length: 5 }, (_, i) => addSemanas(lunesActual, ventana + i));

  const menuSel = menuByLunes.get(selLunes) ?? null;

  const handleEstado = async ({ estado, extra = {} }) => {
    if (!menuSel) return false;
    try {
      await estadoMut.mutateAsync({ id: menuSel.id, estado, extra });
      const labels = {
        publicado: menuSel.estado === 'cerrado' ? 'reabierto' : 'publicado',
        borrador: 'vuelto a borrador',
        cerrado: 'cerrado',
      };
      toast.success(`Menú ${labels[estado]}`);
      setModalPublicar(false);
      return true;
    } catch (e) {
      toast.error(e?.message || 'Error al cambiar el estado');
      return false;
    }
  };

  const handleReabrir = async () => {
    const ok = await handleEstado({ estado: 'publicado', extra: { fecha_limite_pedidos: null } });
    if (ok) setConfirmReabrir(false);
  };

  const handleDelete = async () => {
    if (!menuSel) return;
    try {
      await deleteMut.mutateAsync(menuSel.id);
      toast.success('Menú eliminado');
      setConfirmDelete(false);
    } catch (e) {
      toast.error(e?.message || 'Error al cambiar el estado');
    }
  };

  // Cuando se hace click en tile fuera de la ventana, ajustar ventana
  const handleSelectTile = (lunes) => {
    setSelLunes(lunes);
    // Si la semana seleccionada no está en las 5 tiles actuales, centrar ventana
    const offsetFromActual = Math.round((new Date(lunes) - new Date(lunesActual)) / (7 * 86400000));
    if (offsetFromActual < ventana || offsetFromActual >= ventana + 5) {
      setVentana(offsetFromActual - 2);
    }
  };

  // Ir a hoy
  const irAHoy = () => {
    setVentana(-2);
    setSelLunes(lunesActual);
  };

  return (
    <div style={{ padding: '20px 16px 100px', maxWidth: 860, margin: '0 auto' }}>
      {/* Título */}
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: '#111827', marginBottom: 2 }}>Menús semanales</h1>
          <p style={{ fontSize: 13, color: '#6b7280' }}>
            {query.isLoading ? 'Cargando...' : `${menus.length} semana${menus.length !== 1 ? 's' : ''} registrada${menus.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button
          onClick={irAHoy}
          style={{ fontSize: 12, color: '#16a34a', background: 'none', border: '1.5px solid #bbf7d0', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontWeight: 600 }}
        >
          ↩ Esta semana
        </button>
      </div>

      {/* ── Navegador de semanas ── */}
      <div style={{
        background: '#fff', borderRadius: 16, border: '1.5px solid #e5e7eb',
        padding: '14px 14px 10px', marginBottom: 12,
      }}>
        <div style={{ display: 'flex', alignItems: 'stretch', gap: 8 }}>
          {/* Flecha izquierda */}
          <button
            onClick={() => setVentana(v => v - 1)}
            style={{
              width: 32, borderRadius: 8, border: '1.5px solid #e5e7eb',
              background: '#fafafa', cursor: 'pointer', fontSize: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              color: '#374151',
            }}
          >
            ‹
          </button>

          {/* Tiles */}
          <div style={{ flex: 1, display: 'flex', gap: 8 }}>
            {tilesLunes.map(lunes => (
              <SemanaTile
                key={lunes}
                lunesIso={lunes}
                menu={menuByLunes.get(lunes) ?? null}
                selected={lunes === selLunes}
                esHoy={lunes === lunesActual}
                onSelect={handleSelectTile}
              />
            ))}
          </div>

          {/* Flecha derecha */}
          <button
            onClick={() => setVentana(v => v + 1)}
            style={{
              width: 32, borderRadius: 8, border: '1.5px solid #e5e7eb',
              background: '#fafafa', cursor: 'pointer', fontSize: 16,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              color: '#374151',
            }}
          >
            ›
          </button>
        </div>

        {/* Leyenda */}
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', marginTop: 10 }}>
          {[
            { color: '#16a34a', label: 'Con platos' },
            { color: '#fca5a5', label: 'Sin servicio' },
            { color: '#e5e7eb', label: 'Vacío' },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#6b7280' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* ── Panel de detalle ── */}
      <div style={{
        background: '#fff', borderRadius: 16, border: '1.5px solid #e5e7eb',
        padding: 20, minHeight: 220,
      }}>
        {query.isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}><Spinner size="lg" /></div>
        ) : (
          <PanelDetalle
            lunesIso={selLunes}
            menu={menuSel}
            estadoMut={handleEstado}
            estadoPending={estadoMut.isPending}
            onPublicar={() => setModalPublicar(true)}
            onReabrir={() => setConfirmReabrir(true)}
            onDelete={() => setConfirmDelete(true)}
          />
        )}
      </div>

      {/* Modal publicar */}
      <Modal open={modalPublicar} onClose={() => setModalPublicar(false)} title="Publicar menú">
        {menuSel && (
          <ModalPublicarForm
            menu={menuSel}
            onConfirm={(fechaLimite) => handleEstado({ estado: 'publicado', extra: { fecha_limite_pedidos: fechaLimite } })}
            onCancel={() => setModalPublicar(false)}
            loading={estadoMut.isPending}
          />
        )}
      </Modal>

      {/* Modal confirmar reabrir */}
      <Modal open={confirmReabrir} onClose={() => setConfirmReabrir(false)} title="Reabrir pedidos">
        <p style={{ fontSize: 14, color: '#374151', marginBottom: 8 }}>
          ¿Reabrir <strong>{menuSel?.nombre}</strong>?
        </p>
        <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 20 }}>
          La semana volverá a estar publicada y los empleados podrán cargar o modificar pedidos si todavía están dentro del plazo definido.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={() => setConfirmReabrir(false)} className="btn-secondary">Cancelar</button>
          <button
            onClick={handleReabrir}
            disabled={estadoMut.isPending}
            style={{ padding: '8px 16px', background: '#16a34a', color: '#fff', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {estadoMut.isPending && <Spinner size="sm" />}
            Reabrir pedidos
          </button>
        </div>
      </Modal>

      {/* Modal confirmar eliminar */}
      <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Eliminar menú">
        <p style={{ fontSize: 14, color: '#374151', marginBottom: 8 }}>
          ¿Eliminar <strong>{menuSel?.nombre}</strong>?
        </p>
        <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 20 }}>
          Se eliminarán todos los platos y días sin servicio asignados a esta semana.
        </p>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={() => setConfirmDelete(false)} className="btn-secondary">Cancelar</button>
          <button
            onClick={handleDelete}
            disabled={deleteMut.isPending}
            style={{ padding: '8px 16px', background: '#ef4444', color: '#fff', fontSize: 13, fontWeight: 600, borderRadius: 8, border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            {deleteMut.isPending && <Spinner size="sm" />}
            Eliminar
          </button>
        </div>
      </Modal>
    </div>
  );
}
