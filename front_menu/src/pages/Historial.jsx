import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useUsados, useNoUsados, useHistorialPlato } from '../hooks/useHistorial.js';
import Modal from '../components/ui/Modal.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import ErrorMessage from '../components/ui/ErrorMessage.jsx';
import { DIA_ABREV as DIAS_LABEL } from '../lib/dias.js';

function soloFecha(str) {
  return str ? str.split('T')[0] : '—';
}

function formatCorto(isoStr) {
  const fecha = soloFecha(isoStr);
  const [, m, d] = fecha.split('-');
  return `${d}/${m}`;
}

function diasDesde(fechaIso) {
  const diff = Date.now() - new Date(soloFecha(fechaIso)).getTime();
  return Math.max(0, Math.floor(diff / 86400000));
}

function labelDias(n) {
  if (n === 0) return 'hoy';
  return `hace ${n}d`;
}

function descripcionFiltros(filtros) {
  if (filtros.desde || filtros.hasta) {
    return `del ${filtros.desde || 'inicio'} al ${filtros.hasta || 'hoy'}`;
  }
  if (filtros.mes) return `el mes ${filtros.mes}`;
  if (filtros.semana) return `la semana ${filtros.semana}`;
  if (filtros.dias) return `los ultimos ${filtros.dias} dias`;
  return 'todos los periodos';
}

function LoadingHistorial({ label }) {
  return (
    <div className="card flex items-center justify-center gap-3 py-12 text-sm text-gray-500">
      <Spinner size="lg" />
      <span>{label}</span>
    </div>
  );
}

// ── Panel de filtros ─────────────────────────────────────────────
const ATAJOS = [
  { label: 'Esta semana',    params: { dias: '7'  } },
  { label: 'Últimos 14 días', params: { dias: '14' } },
  { label: 'Últimos 30 días', params: { dias: '30' } },
  { label: 'Este mes',       params: () => ({ mes: new Date().toISOString().slice(0, 7) }) },
  { label: 'Mes anterior',   params: () => {
      const d = new Date();
      d.setMonth(d.getMonth() - 1);
      return { mes: d.toISOString().slice(0, 7) };
    }
  },
  { label: 'Todo',           params: {} },
];

function FiltrosPanel({ filtros, onChange }) {
  const [modoAvanzado, setModoAvanzado] = useState(false);

  const aplicarAtajo = (item) => {
    const p = typeof item.params === 'function' ? item.params() : item.params;
    onChange(p);
  };

  const isActivo = (item) => {
    const p = typeof item.params === 'function' ? item.params() : item.params;
    return JSON.stringify(p) === JSON.stringify(filtros);
  };

  return (
    <div className="card p-4 space-y-3">
      {/* Atajos rápidos */}
      <div className="flex flex-wrap gap-2">
        {ATAJOS.map((a) => (
          <button
            key={a.label}
            onClick={() => aplicarAtajo(a)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
              isActivo(a)
                ? 'bg-brand-600 text-white border-brand-600'
                : 'bg-white text-gray-600 border-gray-300 hover:border-brand-400 hover:text-brand-600'
            }`}
          >
            {a.label}
          </button>
        ))}
        <button
          onClick={() => setModoAvanzado((v) => !v)}
          className="px-3 py-1.5 text-xs font-medium rounded-full border border-dashed border-gray-300 text-gray-500 hover:border-brand-400 hover:text-brand-600 transition-colors"
        >
          {modoAvanzado ? 'Ocultar filtros' : '⚙ Filtro personalizado'}
        </button>
      </div>

      {/* Filtros avanzados */}
      {modoAvanzado && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 border-t border-gray-100">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Desde</label>
            <input
              type="date"
              value={filtros.desde ?? ''}
              onChange={(e) => onChange({ ...filtros, desde: e.target.value || undefined, dias: undefined, mes: undefined, semana: undefined })}
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Hasta</label>
            <input
              type="date"
              value={filtros.hasta ?? ''}
              onChange={(e) => onChange({ ...filtros, hasta: e.target.value || undefined, dias: undefined, mes: undefined, semana: undefined })}
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Mes</label>
            <input
              type="month"
              value={filtros.mes ?? ''}
              onChange={(e) => onChange({ mes: e.target.value || undefined })}
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Semana ISO</label>
            <input
              type="week"
              value={filtros.semana ? filtros.semana.replace('W', 'W') : ''}
              onChange={(e) => {
                // el input week devuelve "2026-W25", exactamente lo que necesita la API
                onChange({ semana: e.target.value || undefined });
              }}
              className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Modal detalle de un plato ────────────────────────────────────
function DetallePlatoModal({ plato, onClose }) {
  const { data, isLoading, isError, error } = useHistorialPlato(plato?.id);

  return (
    <Modal open={!!plato} onClose={onClose} title={plato?.nombre ?? ''}>
      {isLoading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : isError ? (
        <ErrorMessage message={error.message} />
      ) : (
        <div className="space-y-3">
          {plato?.descripcion && (
            <p className="text-xs text-gray-500 -mt-1">{plato.descripcion}</p>
          )}
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
            Historial completo · {data?.historial?.length ?? 0} apariciones
          </p>
          <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
            {data?.historial?.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-6">Nunca usado aún</p>
            ) : (
              data?.historial?.map((h) => (
                <div key={h.id} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-sm font-medium text-gray-800">
                      {formatCorto(h.fecha_servicio)}
                    </p>
                    <p className="text-xs text-gray-500">
                      {h.menu_semanal_nombre ?? 'Semana eliminada'} · {DIAS_LABEL[h.dia]} · opción {h.opcion}
                    </p>
                  </div>
                  <span className="badge bg-gray-100 text-gray-500 text-xs">
                    {labelDias(diasDesde(h.fecha_servicio))}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

// ── Tab: Platos usados ───────────────────────────────────────────
function TabUsados({ filtros }) {
  const [detalle, setDetalle] = useState(null);
  const hayFiltro = Object.values(filtros).some(Boolean);
  const { data, isLoading, isFetching, isError, error, refetch } = useUsados(filtros);
  const platos = data ?? [];
  const filtroLabel = descripcionFiltros(filtros);

  if (!hayFiltro) {
    return (
      <div className="text-center py-12 text-gray-500 text-sm">
        Seleccioná un período para ver qué platos se usaron.
      </div>
    );
  }

  if (isLoading) return <LoadingHistorial label={`Cargando platos usados para ${filtroLabel}...`} />;
  if (isError)  return <ErrorMessage message={error.message} onRetry={refetch} />;

  return (
    <>
      {platos.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-3xl mb-2">🍽️</p>
          <p className="text-sm text-gray-500">Ningun plato fue usado para {filtroLabel}.</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-gray-100 bg-gray-50">
            <p className="text-xs font-semibold text-gray-500">
              {platos.length} plato{platos.length !== 1 ? 's' : ''} usados para {filtroLabel}
            </p>
            {isFetching && !isLoading && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-600">
                <Spinner size="sm" /> Actualizando...
              </span>
            )}
          </div>
          <div className="divide-y divide-gray-50">
            {platos.map((p) => (
              <button
                type="button"
                key={p.plato_id}
                onClick={() => setDetalle({ id: p.plato_id, nombre: p.plato_nombre_snapshot })}
                aria-label={`Ver detalle de ${p.plato_nombre_snapshot}`}
                className="flex w-full items-center justify-between px-5 py-3.5 text-left hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-500 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-gray-800">{p.plato_nombre_snapshot}</p>
                  <p className="text-xs text-gray-500">
                    Última vez: {formatCorto(p.fecha_servicio)} · {DIAS_LABEL[p.dia]} · opción {p.opcion}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="badge bg-brand-50 text-brand-700">
                    {labelDias(diasDesde(p.fecha_servicio))}
                  </span>
                  <span className="text-brand-600 text-xs font-semibold">Ver →</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
      <DetallePlatoModal plato={detalle} onClose={() => setDetalle(null)} />
    </>
  );
}

// ── Tab: Platos no usados ────────────────────────────────────────
function TabNoUsados({ filtros }) {
  const [detalle, setDetalle] = useState(null);
  const { data, isLoading, isFetching, isError, error, refetch } = useNoUsados(filtros);
  const platos = data ?? [];
  const filtroLabel = descripcionFiltros(filtros);

  if (isLoading) return <LoadingHistorial label={`Cargando platos sin usar para ${filtroLabel}...`} />;
  if (isError)  return <ErrorMessage message={error.message} onRetry={refetch} />;

  return (
    <>
      {platos.length === 0 ? (
        <div className="text-center py-12 space-y-3">
          <p className="text-sm font-medium text-gray-700">Todos los platos se usaron para {filtroLabel}</p>
          <p className="text-xs text-gray-500">La rotación está bien cubierta. Podés ver el menú de esta semana para agregar más variedad.</p>
          <Link to="/semanas" className="inline-block text-xs text-brand-600 hover:underline font-medium">
            Ver menú semanal →
          </Link>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-gray-100 bg-gray-50">
            <p className="text-xs font-semibold text-gray-500">
              {platos.length} plato{platos.length !== 1 ? 's' : ''} sin usar para {filtroLabel}
            </p>
            {isFetching && !isLoading && (
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-brand-600">
                <Spinner size="sm" /> Actualizando...
              </span>
            )}
          </div>
          <div className="divide-y divide-gray-50">
            {platos.map((p) => (
              <button
                type="button"
                key={p.id}
                onClick={() => setDetalle(p)}
                aria-label={`Ver detalle de ${p.nombre}`}
                className="flex w-full items-center justify-between px-5 py-3.5 text-left hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-500 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-gray-800">{p.nombre}</p>
                  {p.descripcion && (
                    <p className="text-xs text-gray-500 line-clamp-1">{p.descripcion}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {p.ultima_vez_usado ? (
                    <span className="badge bg-amber-50 text-amber-700">
                      hace {p.dias_desde_ultimo_uso}d
                    </span>
                  ) : (
                    <span className="badge bg-gray-100 text-gray-500">Nunca usado</span>
                  )}
                  <span className="text-brand-600 text-xs font-semibold">Ver →</span>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
      <DetallePlatoModal plato={detalle} onClose={() => setDetalle(null)} />
    </>
  );
}

// ── Página principal ─────────────────────────────────────────────
const TABS = [
  { id: 'no-usados', label: '🔄 Sin usar en el período', desc: 'Candidatos para rotar' },
  { id: 'usados',    label: '📋 Usados en el período',    desc: 'Platos que sí se sirvieron' },
];

export default function Historial() {
  const [tab, setTab]       = useState('no-usados');
  const [filtros, setFiltros] = useState({ dias: '14' });

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Historial de uso</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Controlá cuándo se repite cada plato y descubrí qué conviene poner esta semana
        </p>
      </div>

      {/* Filtros */}
      <FiltrosPanel filtros={filtros} onChange={setFiltros} />

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
              tab === t.id
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Contenido */}
      {tab === 'usados'
        ? <TabUsados    filtros={filtros} />
        : <TabNoUsados  filtros={filtros} />
      }
    </div>
  );
}
