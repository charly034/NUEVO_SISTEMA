import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  useMenuSemanal,
  useAgregarPlato,
  useQuitarPlato,
  useMarcarSinServicio,
  useQuitarSinServicio,
} from '../hooks/useMenus.js';
import { usePlatos } from '../hooks/usePlatos.js';
import Modal from '../components/ui/Modal.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import ErrorMessage from '../components/ui/ErrorMessage.jsx';
import { toast } from '../lib/toast.js';

const DIAS = ['lunes','martes','miercoles','jueves','viernes','sabado','domingo'];

function diasDesde(fechaIso) {
  const diff = Date.now() - new Date(fechaIso).getTime();
  return Math.max(0, Math.floor(diff / 86400000));
}

function formatCorto(isoStr) {
  const f = soloFecha(isoStr);
  if (!f || f === 'undefined') return '—';
  const [, m, d] = f.split('-');
  return `${d}/${m}`;
}

function esPasado(fechaInicio, dia) {
  const offset = DIAS.indexOf(dia);
  const d = new Date(soloFecha(fechaInicio));
  d.setUTCDate(d.getUTCDate() + offset);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return d < hoy;
}
const DIA_LABEL = {
  lunes: 'Lunes', martes: 'Martes', miercoles: 'Miércoles',
  jueves: 'Jueves', viernes: 'Viernes', sabado: 'Sábado', domingo: 'Domingo',
};
const OPCIONES = ['A','B','C','D','E','F'];

// Calcula la fecha exacta de cada día dado el lunes de la semana
// Extrae solo YYYY-MM-DD de un string que puede venir como ISO datetime
function soloFecha(str) {
  return str ? str.split('T')[0] : str;
}

function fechaDia(fechaInicio, dia) {
  const offset = DIAS.indexOf(dia);
  const [y, m, d] = soloFecha(fechaInicio).split('-').map(Number);
  const fecha = new Date(y, m - 1, d + offset);
  return `${String(fecha.getDate()).padStart(2,'0')}/${String(fecha.getMonth()+1).padStart(2,'0')}`;
}

// Sugiere la próxima opción libre para un día
function siguienteOpcion(platos) {
  const usadas = new Set(platos.map((p) => p.opcion));
  return OPCIONES.find((o) => !usadas.has(o)) ?? 'A';
}

// ── Modal para agregar plato a un día ────────────────────────────
function AgregarPlatoModal({ dia, platosDelDia, onSubmit, onCancel, loading }) {
  const opcionSugerida = siguienteOpcion(platosDelDia);
  const [opcion, setOpcion] = useState(opcionSugerida);
  const [platoId, setPlatoId] = useState('');
  const [search, setSearch] = useState('');

  const platosQuery = usePlatos({ activo: 'true', limit: 50, search: search || undefined });
  const platos = platosQuery.data?.platos ?? [];

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!platoId) { toast.error('Seleccioná un plato'); return; }
    onSubmit({ dia, opcion, plato_id: parseInt(platoId, 10) });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Día y opción */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Día</label>
          <div className="px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg text-gray-700 font-medium">
            {DIA_LABEL[dia]}
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Opción</label>
          <select
            value={opcion}
            onChange={(e) => setOpcion(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-brand-500"
          >
            {OPCIONES.map((o) => (
              <option key={o} value={o}>
                {o}{platosDelDia.find((p) => p.opcion === o) ? ' (reemplaza actual)' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Buscador de plato */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Plato <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPlatoId(''); }}
          placeholder="Buscar plato..."
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-brand-500 mb-2"
        />
        <div className="max-h-44 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-50">
          {platosQuery.isLoading ? (
            <div className="flex justify-center py-4"><Spinner size="sm" /></div>
          ) : platos.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-4">Sin resultados</p>
          ) : (
            platos.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPlatoId(String(p.id))}
                className={`w-full text-left px-3 py-2.5 text-sm transition-colors ${
                  platoId === String(p.id)
                    ? 'bg-brand-50 text-brand-800 font-medium'
                    : 'hover:bg-gray-50 text-gray-700'
                }`}
              >
                <span>{p.nombre}</span>
                {p.ultimo_uso && (() => {
                  const d = diasDesde(p.ultimo_uso.fecha_servicio);
                  return (
                    <span className="ml-2 text-xs text-gray-400">
                      · {d === 0 ? 'usado hoy' : `hace ${d}d`}
                    </span>
                  );
                })()}
              </button>
            ))
          )}
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className="btn-secondary">Cancelar</button>
        <button type="submit" disabled={loading || !platoId} className="btn-primary">
          {loading && <Spinner size="sm" />}
          Agregar
        </button>
      </div>
    </form>
  );
}

// ── Contenido compartido de platos ──────────────────────────────
function PlatosLista({ platos, onQuitar, loadingDia, compact = false }) {
  return (
    <div className={compact ? 'space-y-1' : 'space-y-1.5'}>
      {platos.map((p) => (
        <div key={p.opcion} className="flex items-center gap-2 bg-white rounded-lg px-2 py-1.5 border border-brand-100 group">
          <span className={`flex-shrink-0 rounded-full bg-brand-100 text-brand-700 font-bold flex items-center justify-center ${compact ? 'w-5 h-5 text-[10px]' : 'w-6 h-6 text-xs'}`}>
            {p.opcion}
          </span>
          <p className={`flex-1 min-w-0 text-gray-700 leading-tight ${compact ? 'text-[11px] line-clamp-1' : 'text-sm'}`}>
            {p.plato_nombre}
          </p>
          <button
            onClick={() => onQuitar(p.opcion)}
            disabled={loadingDia}
            className="opacity-0 group-hover:opacity-100 flex-shrink-0 w-5 h-5 flex items-center justify-center text-gray-300 hover:text-red-400 transition-all text-sm rounded"
            title="Quitar"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Vista mobile: tarjeta horizontal por día ─────────────────────
function DiaFila({ dia, fecha, platos = [], sinServicio, onAgregar, onQuitar, onMarcarFeriado, onQuitarFeriado, loadingDia, pasado }) {
  if (sinServicio) {
    return (
      <div className={`card p-4 border-l-4 border-l-red-300 bg-red-50 ${pasado ? 'opacity-50' : ''}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-700">{DIA_LABEL[dia]}</p>
            <p className="text-xs text-gray-400">{fecha}</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-medium text-red-500">Sin servicio{sinServicio.motivo ? ` · ${sinServicio.motivo}` : ''}</span>
            <button onClick={onQuitarFeriado} disabled={loadingDia} className="text-xs text-red-400 hover:text-red-600 underline">
              Quitar
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`card p-4 ${pasado ? 'opacity-50' : ''} ${platos.length > 0 ? 'border-l-4 border-l-brand-400' : ''}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <p className="text-sm font-semibold text-gray-800">{DIA_LABEL[dia]}</p>
          <p className="text-xs text-gray-400">{fecha}</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button
            onClick={onAgregar}
            disabled={loadingDia}
            className="text-xs font-medium text-brand-600 hover:text-brand-800 bg-brand-50 hover:bg-brand-100 px-3 py-1.5 rounded-lg transition-colors border border-brand-200"
          >
            + Agregar
          </button>
          <button
            onClick={onMarcarFeriado}
            disabled={loadingDia}
            className="text-xs text-gray-400 hover:text-red-500 bg-gray-50 hover:bg-red-50 px-3 py-1.5 rounded-lg transition-colors border border-gray-200"
          >
            Feriado
          </button>
        </div>
      </div>
      {platos.length > 0 && <PlatosLista platos={platos} onQuitar={onQuitar} loadingDia={loadingDia} />}
    </div>
  );
}

// ── Vista desktop: columna vertical por día ──────────────────────
function DiaColumna({ dia, fecha, platos = [], sinServicio, onAgregar, onQuitar, onMarcarFeriado, onQuitarFeriado, loadingDia }) {
  if (sinServicio) {
    return (
      <div className="flex flex-col rounded-xl border-2 border-dashed border-red-200 bg-red-50 p-3 min-h-[180px]">
        <div className="text-center mb-2">
          <p className="text-xs font-bold text-gray-500 uppercase">{DIA_LABEL[dia]}</p>
          <p className="text-[11px] text-gray-400">{fecha}</p>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-1">
          <p className="text-xs font-medium text-red-500 text-center">Sin servicio</p>
          {sinServicio.motivo && <p className="text-[10px] text-red-400 text-center">{sinServicio.motivo}</p>}
        </div>
        <button onClick={onQuitarFeriado} disabled={loadingDia} className="mt-2 text-[10px] text-red-400 hover:text-red-600 underline text-center w-full">
          Quitar feriado
        </button>
      </div>
    );
  }

  return (
    <div className={`flex flex-col rounded-xl border p-3 min-h-[180px] transition-colors ${
      platos.length > 0 ? 'border-brand-200 bg-brand-50/40' : 'border-gray-200 bg-white'
    }`}>
      <div className="text-center mb-2">
        <p className="text-xs font-bold text-gray-500 uppercase">{DIA_LABEL[dia]}</p>
        <p className="text-[11px] text-gray-400">{fecha}</p>
      </div>
      <div className="flex-1">
        <PlatosLista platos={platos} onQuitar={onQuitar} loadingDia={loadingDia} compact />
      </div>
      <div className="mt-2 flex flex-col gap-1">
        <button onClick={onAgregar} disabled={loadingDia} className="w-full text-[11px] font-medium text-brand-600 hover:text-brand-800 hover:bg-brand-50 rounded-lg py-1 transition-colors border border-dashed border-brand-200 hover:border-brand-400">
          + Agregar plato
        </button>
        <button onClick={onMarcarFeriado} disabled={loadingDia} className="w-full text-[10px] text-gray-400 hover:text-red-500 py-0.5 transition-colors">
          Marcar feriado
        </button>
      </div>
    </div>
  );
}

// ── Modal marcar sin servicio ────────────────────────────────────
function SinServicioModal({ dia, onSubmit, onCancel, loading }) {
  const [motivo, setMotivo] = useState('');
  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit({ dia, motivo: motivo || undefined }); }} className="space-y-4">
      <p className="text-sm text-gray-600">
        Vas a marcar el <strong>{DIA_LABEL[dia]}</strong> como sin servicio.
        Si tiene platos asignados, serán eliminados de este día.
      </p>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Motivo <span className="text-gray-400 font-normal">(opcional)</span>
        </label>
        <input
          type="text"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Ej: Feriado nacional, cierre por mantenimiento..."
          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-brand-500"
        />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className="btn-secondary">Cancelar</button>
        <button type="submit" disabled={loading} className="inline-flex items-center gap-2 px-4 py-2 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50">
          {loading && <Spinner size="sm" />}
          Confirmar
        </button>
      </div>
    </form>
  );
}

// ── Página principal ─────────────────────────────────────────────
export default function SemanaDetalle() {
  const { id } = useParams();

  const menuQuery        = useMenuSemanal(id);
  const agregarMut       = useAgregarPlato(id);
  const quitarMut        = useQuitarPlato(id);
  const sinServicioMut   = useMarcarSinServicio(id);
  const quitarFeriadoMut = useQuitarSinServicio(id);

  const [modalAgregar, setModalAgregar]     = useState(null); // dia seleccionado
  const [modalFeriado, setModalFeriado]     = useState(null); // dia seleccionado
  const [loadingDias, setLoadingDias]       = useState({});   // { dia: bool }

  const menu = menuQuery.data;

  if (menuQuery.isLoading) {
    return <div className="flex justify-center items-center h-64"><Spinner size="lg" /></div>;
  }
  if (menuQuery.isError) {
    return <div className="p-6"><ErrorMessage message={menuQuery.error.message} onRetry={menuQuery.refetch} /></div>;
  }

  const diasMap = Object.fromEntries((menu.dias ?? []).map((d) => [d.dia, d.platos ?? []]));
  const sinServicioMap = Object.fromEntries((menu.sin_servicio ?? []).map((s) => [s.dia, s]));

  const setLoading = (dia, val) => setLoadingDias((prev) => ({ ...prev, [dia]: val }));

  const handleAgregar = async (data) => {
    setLoading(data.dia, true);
    try {
      await agregarMut.mutateAsync(data);
      toast.success(`Plato agregado al ${DIA_LABEL[data.dia]}`);
      setModalAgregar(null);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(data.dia, false);
    }
  };

  const handleQuitar = async (dia, opcion) => {
    setLoading(dia, true);
    try {
      await quitarMut.mutateAsync({ dia, opcion });
      toast.success('Plato quitado');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(dia, false);
    }
  };

  const handleMarcarFeriado = async (data) => {
    setLoading(data.dia, true);
    try {
      await sinServicioMut.mutateAsync(data);
      toast.success(`${DIA_LABEL[data.dia]} marcado como sin servicio`);
      setModalFeriado(null);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(data.dia, false);
    }
  };

  const handleQuitarFeriado = async (dia) => {
    setLoading(dia, true);
    try {
      await quitarFeriadoMut.mutateAsync(dia);
      toast.success('Feriado quitado');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(dia, false);
    }
  };

  const totalPlatos = Object.values(diasMap).reduce((acc, p) => acc + p.length, 0);
  const diasCubiertos = Object.keys(diasMap).length;
  const feriados = Object.keys(sinServicioMap).length;

  return (
    <div className="p-4 md:p-6 space-y-4">
      {/* Header */}
      <div>
        <Link to="/semanas" className="text-xs text-gray-400 hover:text-brand-600 transition-colors">
          ← Volver a semanas
        </Link>
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 mt-1">{menu.nombre}</h1>
        <p className="text-xs text-gray-400 mt-0.5 flex flex-wrap gap-x-2">
          <span>{formatCorto(menu.fecha_inicio)} → {formatCorto(menu.fecha_fin)}</span>
          <span>·</span>
          <span>{diasCubiertos}/7 días con platos</span>
          <span>·</span>
          <span>{totalPlatos} platos totales</span>
          {feriados > 0 && (
            <><span>·</span><span className="text-red-400">{feriados} feriado{feriados > 1 ? 's' : ''}</span></>
          )}
        </p>
      </div>

      {/* Vista mobile: lista de días */}
      <div className="md:hidden space-y-3">
        {DIAS.map((dia) => (
          <DiaFila
            key={dia}
            dia={dia}
            fecha={fechaDia(menu.fecha_inicio, dia)}
            platos={diasMap[dia] ?? []}
            sinServicio={sinServicioMap[dia] ?? null}
            loadingDia={loadingDias[dia]}
            pasado={esPasado(menu.fecha_inicio, dia)}
            onAgregar={() => setModalAgregar(dia)}
            onQuitar={(opcion) => handleQuitar(dia, opcion)}
            onMarcarFeriado={() => setModalFeriado(dia)}
            onQuitarFeriado={() => handleQuitarFeriado(dia)}
          />
        ))}
      </div>

      {/* Vista desktop: grilla de 7 columnas */}
      <div className="hidden md:grid grid-cols-7 gap-3">
        {DIAS.map((dia) => (
          <div key={dia} className={esPasado(menu.fecha_inicio, dia) ? 'opacity-50' : ''}>
            <DiaColumna
              dia={dia}
              fecha={fechaDia(menu.fecha_inicio, dia)}
              platos={diasMap[dia] ?? []}
              sinServicio={sinServicioMap[dia] ?? null}
              loadingDia={loadingDias[dia]}
              onAgregar={() => setModalAgregar(dia)}
              onQuitar={(opcion) => handleQuitar(dia, opcion)}
              onMarcarFeriado={() => setModalFeriado(dia)}
              onQuitarFeriado={() => handleQuitarFeriado(dia)}
            />
          </div>
        ))}
      </div>

      {/* Leyenda */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-brand-500 inline-block" /> Con platos
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-gray-200 inline-block" /> Sin asignar
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-red-300 inline-block" /> Sin servicio
        </span>
        <span className="hidden md:inline ml-auto">
          Pasá el mouse sobre un plato para ver la opción de quitarlo
        </span>
      </div>

      {/* Modal agregar plato */}
      <Modal
        open={!!modalAgregar}
        onClose={() => setModalAgregar(null)}
        title={`Agregar plato — ${modalAgregar ? DIA_LABEL[modalAgregar] : ''}`}
      >
        {modalAgregar && (
          <AgregarPlatoModal
            dia={modalAgregar}
            platosDelDia={diasMap[modalAgregar] ?? []}
            onSubmit={handleAgregar}
            onCancel={() => setModalAgregar(null)}
            loading={agregarMut.isPending}
          />
        )}
      </Modal>

      {/* Modal feriado */}
      <Modal
        open={!!modalFeriado}
        onClose={() => setModalFeriado(null)}
        title="Marcar día sin servicio"
      >
        {modalFeriado && (
          <SinServicioModal
            dia={modalFeriado}
            onSubmit={handleMarcarFeriado}
            onCancel={() => setModalFeriado(null)}
            loading={sinServicioMut.isPending}
          />
        )}
      </Modal>
    </div>
  );
}
