import { useState, useCallback, useMemo } from 'react';
import { usePlatos, usePlatoTags, useCreatePlato, useUpdatePlato, useDeletePlato } from '../hooks/usePlatos.js';
import { useGuarniciones, useUpdateGuarnicion, useDeleteGuarnicion } from '../hooks/useGuarniciones.js';
import { useHistorialPlato } from '../hooks/useHistorial.js';
import Modal from '../components/ui/Modal.jsx';
import PlatoForm from '../components/platos/PlatoForm.jsx';
import GuarnicionesPanel from '../components/platos/GuarnicionesPanel.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import ErrorMessage from '../components/ui/ErrorMessage.jsx';
import { toast } from '../lib/toast.js';
import { confirmar } from '../lib/confirm.js';

const ESTADO_FILTROS = [
  { label: 'Activos',   value: 'true'    },
  { label: 'Todos',     value: undefined },
  { label: 'Inactivos', value: 'false'   },
];

const TIPO_FILTROS = [
  { label: 'Todos',            value: undefined  },
  { label: '⭐ Especial',       value: 'especial' },
  { label: '📌 Fijo',           value: 'fijo'     },
  { label: '🔄 Fijo + Especial', value: 'ambos'   },
];

const TIPO_CONFIG = {
  especial: { label: '⭐ Especial',      cls: 'bg-amber-50 text-amber-700'   },
  fijo:     { label: '📌 Fijo',          cls: 'bg-blue-50 text-blue-700'     },
  ambos:    { label: '🔄 Fijo + Especial', cls: 'bg-purple-50 text-purple-700' },
};

function TipoBadge({ tipo }) {
  const cfg = TIPO_CONFIG[tipo] ?? { label: tipo ?? '—', cls: 'bg-gray-100 text-gray-500' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

const DIAS_LABEL = {
  lunes: 'Lun', martes: 'Mar', miercoles: 'Mié',
  jueves: 'Jue', viernes: 'Vie', sabado: 'Sáb', domingo: 'Dom',
};

function soloFecha(str) {
  return str ? str.split('T')[0] : '—';
}

function formatCorto(isoStr) {
  const f = soloFecha(isoStr);
  const [, m, d] = f.split('-');
  return `${d}/${m}`;
}

function diasDesde(fechaIso) {
  const diff = Date.now() - new Date(soloFecha(fechaIso)).getTime();
  return Math.floor(diff / 86400000);
}

// ── Colores por tag ──────────────────────────────────────────────
const TAG_COLORS = [
  'bg-blue-50 text-blue-700',
  'bg-purple-50 text-purple-700',
  'bg-amber-50 text-amber-700',
  'bg-rose-50 text-rose-700',
  'bg-teal-50 text-teal-700',
  'bg-indigo-50 text-indigo-700',
  'bg-orange-50 text-orange-700',
  'bg-green-50 text-green-700',
];

function tagColor(tag) {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) % TAG_COLORS.length;
  return TAG_COLORS[h];
}

function TagBadge({ tag, onClick, active }) {
  return (
    <span
      onClick={onClick}
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium transition-all
        ${tagColor(tag)}
        ${onClick ? 'cursor-pointer' : ''}
        ${active ? 'ring-2 ring-offset-1 ring-current' : ''}
      `}
    >
      {tag}
    </span>
  );
}

// ── Modal detalle de plato ───────────────────────────────────────
function DetallePlatoModal({ plato, onClose, onEdit }) {
  const { data, isLoading, isError, error } = useHistorialPlato(plato?.id);

  return (
    <Modal open={!!plato} onClose={onClose} title={plato?.nombre ?? ''}>
      {isLoading ? (
        <div className="flex justify-center py-8"><Spinner /></div>
      ) : isError ? (
        <ErrorMessage message={error.message} />
      ) : (
        <div className="space-y-4">
          {/* Info básica */}
          <div className="space-y-2">
            {plato?.foto_url && (
              <img
                src={plato.foto_url}
                alt={plato.nombre}
                className="h-44 w-full rounded-xl object-cover border border-gray-100"
              />
            )}
            {plato?.descripcion && (
              <p className="text-sm text-gray-600">{plato.descripcion}</p>
            )}
            {plato?.descripcion_larga && (
              <p className="text-sm text-gray-500 whitespace-pre-line">{plato.descripcion_larga}</p>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`badge ${plato?.activo ? 'bg-brand-50 text-brand-700' : 'bg-gray-100 text-gray-500'}`}>
                {plato?.activo ? '● Activo' : '○ Inactivo'}
              </span>
              {plato?.calorias ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-50 text-orange-700">
                  {plato.calorias} kcal
                </span>
              ) : null}
              {plato?.vegetariano ? (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                  Vegetariano
                </span>
              ) : null}
              {plato?.tipo && <TipoBadge tipo={plato.tipo} />}
              {plato?.tiene_guarnicion && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">
                  🥗 Con guarnición
                </span>
              )}
              {(plato?.alergenos ?? []).map((alergeno) => (
                <span key={alergeno} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-50 text-red-700">
                  {alergeno}
                </span>
              ))}
              {(plato?.tags ?? []).map((t) => (
                <TagBadge key={t} tag={t} />
              ))}
            </div>
          </div>

          {/* Stats rápidas */}
          {(() => {
            const ultimo = data?.historial?.[0];
            const d = ultimo ? diasDesde(ultimo.fecha_servicio) : null;
            const esFuturo = ultimo && new Date(soloFecha(ultimo.fecha_servicio)) > new Date();
            return (
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-gray-800">{data?.historial?.length ?? 0}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Veces usado</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-2xl font-bold text-gray-800">{ultimo ? (esFuturo ? -d : d) : '—'}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{esFuturo ? 'Días hasta uso' : 'Días desde último'}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-gray-800">{ultimo ? formatCorto(ultimo.fecha_servicio) : '—'}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{esFuturo ? 'Próximo uso' : 'Último uso'}</p>
                </div>
              </div>
            );
          })()}

          {/* Historial */}
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Historial completo
            </p>
            <div className="max-h-60 overflow-y-auto divide-y divide-gray-50 rounded-lg border border-gray-100">
              {!data?.historial?.length ? (
                <p className="text-sm text-gray-400 text-center py-6">Nunca usado aún</p>
              ) : (
                data.historial.map((h) => (
                  <div key={h.id} className="flex items-center justify-between px-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{formatCorto(h.fecha_servicio)}</p>
                      <p className="text-xs text-gray-400">
                        {h.menu_semanal_nombre ?? 'Semana eliminada'} · {DIAS_LABEL[h.dia]} · op. {h.opcion}
                      </p>
                    </div>
                    <span className="text-xs text-gray-400">{(() => { const d = diasDesde(h.fecha_servicio); return d < 0 ? `en ${-d}d` : d === 0 ? 'hoy' : `hace ${d}d`; })()}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Acciones */}
          <div className="flex justify-end gap-2 pt-1 border-t border-gray-100">
            <button onClick={onClose} className="btn-secondary text-xs">Cerrar</button>
            <button onClick={() => { onClose(); onEdit(plato); }} className="btn-primary text-xs">
              ✏️ Editar plato
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function PlatoMobileCard({ plato, loading, onOpen, onToggleActivo, onEdit, onDelete }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const ultimoUso = plato.ultimo_uso ? (() => {
    const d = diasDesde(plato.ultimo_uso.fecha_servicio);
    const esFuturo = new Date(soloFecha(plato.ultimo_uso.fecha_servicio)) > new Date();
    return { texto: `${formatCorto(plato.ultimo_uso.fecha_servicio)} · ${esFuturo ? 'próximo uso' : d === 0 ? 'hoy' : `hace ${d}d`}`, urgente: !esFuturo && d <= 7 };
  })() : { texto: 'Nunca usado', urgente: false };

  const tags = plato.tags ?? [];
  const tagsVisible = tags.slice(0, 3);
  const tagsExtra = tags.length - 3;

  return (
    <div className="px-4 py-3.5 bg-white relative">
      {/* Fila principal: nombre + menú */}
      <div className="flex items-start gap-2">
        <button onClick={onOpen} className="w-12 h-12 rounded-xl overflow-hidden bg-gray-100 border border-gray-100 flex items-center justify-center flex-shrink-0">
          {plato.foto_url ? (
            <img src={plato.foto_url} alt={plato.nombre} className="w-full h-full object-cover" />
          ) : (
            <span className="text-lg">🍽️</span>
          )}
        </button>
        <button onClick={onOpen} className="flex-1 text-left min-w-0">
          <p className="font-semibold text-gray-900 leading-snug">{plato.nombre}</p>
          {plato.calorias ? <p className="text-xs text-orange-600 mt-0.5">{plato.calorias} kcal</p> : null}
        </button>

        {/* Estado badge tappable */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleActivo(plato); }}
          disabled={loading}
          className={`flex-shrink-0 badge transition-colors ${plato.activo ? 'bg-brand-50 text-brand-700 active:bg-brand-100' : 'bg-gray-100 text-gray-500 active:bg-gray-200'}`}
        >
          {plato.activo ? '● Activo' : '○ Inactivo'}
        </button>

        {/* Menú ⋮ */}
        <div className="relative flex-shrink-0" onClick={e => e.stopPropagation()}>
          <button
            onClick={() => setMenuOpen(v => !v)}
            className="p-1.5 -mr-1 text-gray-400 hover:text-gray-600 rounded-lg active:bg-gray-100"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
              <circle cx="10" cy="4" r="1.5"/><circle cx="10" cy="10" r="1.5"/><circle cx="10" cy="16" r="1.5"/>
            </svg>
          </button>
          {menuOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
              <div className="absolute right-0 top-8 z-20 bg-white rounded-xl shadow-lg border border-gray-100 py-1 min-w-[140px]">
                <button onClick={() => { setMenuOpen(false); onOpen(plato); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                  👁 Ver historial
                </button>
                <button onClick={() => { setMenuOpen(false); onEdit(plato); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                  ✏️ Editar
                </button>
                <button onClick={() => { setMenuOpen(false); onToggleActivo(plato); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2">
                  {plato.activo ? '○ Desactivar' : '● Activar'}
                </button>
                <div className="border-t border-gray-100 my-1" />
                <button onClick={() => { setMenuOpen(false); onDelete(plato); }}
                  className="w-full text-left px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 flex items-center gap-2">
                  🗑 Eliminar
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Fila secundaria: tipo + guarnición + último uso */}
      <button onClick={onOpen} className="w-full text-left mt-2">
        <div className="flex items-center gap-2 flex-wrap">
          {plato.tipo && <TipoBadge tipo={plato.tipo} />}
          {plato.tiene_guarnicion && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700">🥗 Guarnición</span>
          )}
          <span className={`text-xs ml-auto ${ultimoUso.urgente ? 'text-amber-500 font-medium' : 'text-gray-400'}`}>
            {ultimoUso.texto}
          </span>
        </div>

        {/* Tags (máx 3 + contador) */}
        {tagsVisible.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {tagsVisible.map(t => <TagBadge key={t} tag={t} />)}
            {tagsExtra > 0 && (
              <span className="px-2 py-0.5 text-xs text-gray-400 bg-gray-100 rounded-full">+{tagsExtra}</span>
            )}
          </div>
        )}
      </button>
    </div>
  );
}

// ── Página principal ─────────────────────────────────────────────
export default function Platos() {
  const [tab, setTab]                       = useState('platos');
  const [search, setSearch]                 = useState('');
  const [activoFilter, setActivo]           = useState('true');
  const [tagFilter, setTagFilter]           = useState(null);
  const [tipoFilter, setTipoFilter]         = useState(undefined);
  const [page, setPage]                     = useState(1);
  const [sortBy, setSortBy]                 = useState('nombre');
  const [sortDir, setSortDir]               = useState('asc');
  const [detalle, setDetalle]               = useState(null);
  const [modalCreate, setModalCreate]       = useState(false);
  const [editando, setEditando]             = useState(null);
  const [confirmDelete, setConfirmDelete]   = useState(null);
  const [modalGuarnicion, setModalGuarnicion] = useState(false);
  // Guarniciones state
  const [gSortBy, setGSortBy]               = useState('nombre');
  const [gSortDir, setGSortDir]             = useState('asc');
  const [gTipoFilter, setGTipoFilter]       = useState(undefined);
  const [gEditando, setGEditando]           = useState(null);

  const handleSort = (col) => {
    if (sortBy === col) { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); }
    else { setSortBy(col); setSortDir('asc'); }
    setPage(1);
  };
  const handleGSort = (col) => {
    if (gSortBy === col) setGSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setGSortBy(col); setGSortDir('asc'); }
  };

  const { data: guarnicionesData = [], isLoading: gLoading } = useGuarniciones();
  const gUpdate = useUpdateGuarnicion();
  const gDelete = useDeleteGuarnicion();

  const query    = usePlatos({ page, limit: 15, activo: activoFilter, search: search || undefined, tag: tagFilter || undefined, tipo: tipoFilter, sort_by: sortBy, sort_dir: sortDir });
  const tagsQuery = usePlatoTags();

  const createMutation = useCreatePlato();
  const updateMutation = useUpdatePlato();
  const deleteMutation = useDeletePlato();

  const platos     = query.data?.platos ?? [];
  const pagination = query.data?.pagination;
  const allTags    = tagsQuery.data ?? [];

  const handleCreate = useCallback(async (data) => {
    try {
      await createMutation.mutateAsync(data);
      toast.success('Plato creado correctamente');
      setModalCreate(false);
    } catch (e) { toast.error(e.message); }
  }, [createMutation]);

  const handleUpdate = useCallback(async (data) => {
    try {
      await updateMutation.mutateAsync({ id: editando.id, data });
      toast.success('Plato actualizado');
      setEditando(null);
    } catch (e) { toast.error(e.message); }
  }, [updateMutation, editando]);

  const handleToggleActivo = useCallback(async (plato, e) => {
    e?.stopPropagation();
    try {
      await updateMutation.mutateAsync({ id: plato.id, data: { activo: !plato.activo } });
      toast.success(plato.activo ? 'Plato desactivado' : 'Plato activado');
    } catch (e) { toast.error(e.message); }
  }, [updateMutation]);

  const handleDelete = useCallback(async () => {
    try {
      await deleteMutation.mutateAsync(confirmDelete.id);
      toast.success('Plato eliminado');
      setConfirmDelete(null);
    } catch (e) { toast.error(e.message); setConfirmDelete(null); }
  }, [deleteMutation, confirmDelete]);

  const guarnicionesFiltradas = useMemo(() => {
    let list = guarnicionesData.filter(g =>
      (!search || g.nombre.toLowerCase().includes(search.toLowerCase())) &&
      (gTipoFilter === undefined || g.tipo === gTipoFilter)
    );
    if (activoFilter === 'true')  list = list.filter(g =>  g.activo);
    if (activoFilter === 'false') list = list.filter(g => !g.activo);
    return [...list].sort((a, b) => {
      let va, vb;
      if (gSortBy === 'nombre') { va = a.nombre.toLowerCase(); vb = b.nombre.toLowerCase(); }
      else if (gSortBy === 'tipo') { va = a.tipo ?? 'zzz'; vb = b.tipo ?? 'zzz'; }
      else { va = a.activo ? 1 : 0; vb = b.activo ? 1 : 0; }
      if (va < vb) return gSortDir === 'asc' ? -1 : 1;
      if (va > vb) return gSortDir === 'asc' ?  1 : -1;
      return 0;
    });
  }, [guarnicionesData, search, activoFilter, gTipoFilter, gSortBy, gSortDir]);

  const handleSearchChange = (e) => { setSearch(e.target.value); setPage(1); };
  const handleFiltroEstado = (val) => { setActivo(val); setPage(1); };
  const handleFiltroTipo = (val) => { setTipoFilter(val); setPage(1); };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4 md:space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-h-[52px]">
          <h1 className="text-2xl font-bold text-gray-900">
            {tab === 'platos' ? 'Platos' : 'Guarniciones'}
          </h1>
          <p className="text-sm text-gray-400 mt-0.5 h-5">
            {tab === 'platos' && pagination
              ? `${pagination.total} plato${pagination.total !== 1 ? 's' : ''}`
              : tab === 'guarniciones' && guarnicionesData.length > 0
              ? `${guarnicionesData.length} guarnición${guarnicionesData.length !== 1 ? 'es' : ''}`
              : ''}
          </p>
        </div>
        {tab === 'platos'
          ? <button onClick={() => setModalCreate(true)}    className="btn-primary flex-shrink-0">+ Nuevo plato</button>
          : <button onClick={() => setModalGuarnicion(true)} className="btn-primary flex-shrink-0">+ Nueva guarnición</button>
        }
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 self-start w-fit">
        {[
          { key: 'platos',       label: '🍽️ Platos'      },
          { key: 'guarniciones', label: '🥗 Guarniciones' },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
              tab === key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Barra de búsqueda — siempre visible, compartida entre tabs */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input
            type="text"
            value={search}
            onChange={handleSearchChange}
            placeholder={tab === 'platos' ? 'Buscar por nombre o descripción...' : 'Buscar guarnición...'}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg outline-none
              focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
          />
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 flex-shrink-0">
          {ESTADO_FILTROS.map((f) => (
            <button
              key={String(f.value)}
              onClick={() => handleFiltroEstado(f.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activoFilter === f.value
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Fila de filtros secundarios — scroll horizontal en mobile */}
      <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-none">
        {tab === 'platos' ? (<>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 flex-shrink-0">
            {TIPO_FILTROS.map((f) => (
              <button key={String(f.value)} onClick={() => handleFiltroTipo(f.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${tipoFilter === f.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {f.label}
              </button>
            ))}
          </div>
          {allTags.length > 0 && (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <select value={tagFilter ?? ''} onChange={(e) => { setTagFilter(e.target.value || null); setPage(1); }}
                className="text-sm border border-gray-300 rounded-lg px-3 py-[7px] outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 bg-white text-gray-700">
                <option value="">Todas las categorías</option>
                {allTags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
              </select>
              {tagFilter && <button onClick={() => { setTagFilter(null); setPage(1); }} className="text-xs text-gray-400 hover:text-gray-600 underline flex-shrink-0">Limpiar</button>}
            </div>
          )}
        </>) : (
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 flex-shrink-0">
            {[
              { label: 'Todas',        value: undefined    },
              { label: '🔥 Calientes', value: 'caliente'  },
              { label: '❄️ Frías',     value: 'fria'       },
            ].map(f => (
              <button key={String(f.value)} onClick={() => setGTipoFilter(f.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${gTipoFilter === f.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {f.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── CARD ÚNICO — nunca se desmonta ── */}
      <div className="card overflow-hidden">
        {(tab === 'platos' ? query.isLoading : gLoading) ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : tab === 'platos' && query.isError ? (
          <ErrorMessage message={query.error.message} onRetry={query.refetch} />
        ) : (
          <>
          {/* Mobile cards (solo platos) */}
          {tab === 'platos' && (
            <div className="md:hidden divide-y divide-gray-100">
              {platos.length === 0 ? (
                <div className="text-center py-16">
                  <p className="text-4xl mb-3">🍽️</p>
                  <p className="text-gray-500 text-sm">{search || tagFilter ? 'Sin resultados.' : 'No hay platos cargados aún.'}</p>
                </div>
              ) : platos.map((plato) => (
                <PlatoMobileCard key={plato.id} plato={plato} loading={updateMutation.isPending}
                  onOpen={() => setDetalle(plato)} onToggleActivo={handleToggleActivo}
                  onEdit={setEditando} onDelete={setConfirmDelete} />
              ))}
            </div>
          )}

          {/* Tabla desktop — siempre el mismo <table>, solo cambia thead/tbody */}
          <div className="overflow-y-auto max-h-[520px] scrollbar-none">
          <table className={tab === 'platos' ? 'hidden md:table w-full text-sm' : 'w-full text-sm'}>
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-gray-100 bg-gray-50">
                {tab === 'platos' ? (<>
                  {[
                    { col: 'nombre',     label: 'Nombre'     },
                    { col: null,         label: 'Tipo',       cls: 'hidden md:table-cell' },
                    { col: null,         label: 'Tags',       cls: 'hidden lg:table-cell' },
                    { col: 'ultimo_uso', label: 'Último uso', cls: 'hidden sm:table-cell' },
                    { col: 'activo',     label: 'Estado'     },
                  ].map(({ col, label, cls = '' }) => (
                    <th key={label} className={`text-left px-5 py-3 ${cls}`}>
                      {col
                        ? <button onClick={() => handleSort(col)} className="flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase tracking-wide hover:text-gray-800 transition-colors whitespace-nowrap">
                            {label} <span className="text-gray-300">{sortBy === col ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
                          </button>
                        : <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{label}</span>
                      }
                    </th>
                  ))}
                  <th className="px-5 py-3" />
                </>) : (<>
                  {[
                    { col: 'nombre', label: 'Nombre' },
                    { col: 'tipo',   label: 'Tipo'   },
                    { col: 'activo', label: 'Estado' },
                  ].map(({ col, label }) => (
                    <th key={label} className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap cursor-pointer select-none hover:text-gray-800" onClick={() => handleGSort(col)}>
                      {label} <span className="text-gray-300">{gSortBy === col ? (gSortDir === 'asc' ? '↑' : '↓') : '↕'}</span>
                    </th>
                  ))}
                  <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Acciones</th>
                </>)}
              </tr>
            </thead>
            <tbody key={tab} className="divide-y divide-gray-50 rows-fade">
              {tab === 'platos' ? (
                platos.length === 0 ? (
                  <tr><td colSpan={6} className="text-center py-16 text-gray-500 text-sm">
                    {search || tagFilter ? 'Sin resultados para este filtro.' : 'No hay platos cargados aún.'}
                  </td></tr>
                ) : platos.map((plato) => (
                  <tr key={plato.id} onClick={() => setDetalle(plato)} className="group hover:bg-gray-50/80 transition-colors cursor-pointer">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-xl overflow-hidden bg-gray-100 border border-gray-100 flex items-center justify-center flex-shrink-0">
                          {plato.foto_url ? (
                            <img src={plato.foto_url} alt={plato.nombre} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-base">🍽️</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-gray-900">{plato.nombre}</p>
                          {plato.descripcion && <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{plato.descripcion}</p>}
                          <div className="flex items-center gap-1.5 mt-1">
                            {plato.calorias ? <span className="text-xs text-orange-600">{plato.calorias} kcal</span> : null}
                            {plato.vegetariano ? <span className="text-xs text-emerald-600">Vegetariano</span> : null}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 hidden md:table-cell">
                      <div className="flex flex-col gap-1.5">
                        <TipoBadge tipo={plato.tipo} />
                        {plato.tiene_guarnicion && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-50 text-green-700 w-fit">🥗 Guarnición</span>}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 hidden lg:table-cell">
                      <div className="flex flex-wrap gap-1">
                        {(plato.tags ?? []).length === 0 ? <span className="text-gray-300 text-xs">—</span> : plato.tags.map((t) => <TagBadge key={t} tag={t} />)}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 hidden sm:table-cell">
                      {plato.ultimo_uso ? (() => {
                        const d = diasDesde(plato.ultimo_uso.fecha_servicio);
                        const esFuturo = new Date(soloFecha(plato.ultimo_uso.fecha_servicio)) > new Date();
                        return <div><p className="text-gray-700">{formatCorto(plato.ultimo_uso.fecha_servicio)}</p><p className="text-xs text-gray-400">{esFuturo ? 'próximo uso' : d === 0 ? 'hoy' : `hace ${d}d`}</p></div>;
                      })() : <span className="text-gray-300 text-xs">Nunca usado</span>}
                    </td>
                    <td className="px-5 py-3.5">
                      <button onClick={(e) => handleToggleActivo(plato, e)} disabled={updateMutation.isPending}
                        className={`badge cursor-pointer transition-colors ${plato.activo ? 'bg-brand-50 text-brand-700 hover:bg-brand-100' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                        {plato.activo ? '● Activo' : '○ Inactivo'}
                      </button>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                        <span className="text-gray-300 text-xs mr-1 group-hover:text-gray-400 transition-colors">Ver →</span>
                        <button onClick={() => setEditando(plato)} className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors" title="Editar">✏️</button>
                        <button onClick={() => setConfirmDelete(plato)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar">🗑️</button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                guarnicionesFiltradas.length === 0 ? (
                  <tr><td colSpan={4} className="text-center py-16 text-gray-500 text-sm">Sin resultados para este filtro.</td></tr>
                ) : guarnicionesFiltradas.map((g) => {
                  const tipoCfg = g.tipo === 'caliente' ? { label: '🔥 Caliente', cls: 'bg-orange-50 text-orange-700' }
                                : g.tipo === 'fria'     ? { label: '❄️ Fría',     cls: 'bg-blue-50 text-blue-700'    }
                                : null;
                  return (
                    <tr key={g.id} className="group hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-3.5">
                        {gEditando?.id === g.id ? (
                          <form onSubmit={async (e) => { e.preventDefault(); try { await gUpdate.mutateAsync({ id: g.id, data: { nombre: gEditando.nombre, tipo: gEditando.tipo ?? null } }); setGEditando(null); toast.success('Guarnición actualizada'); } catch(err) { toast.error(err?.message || 'Error'); }}} className="flex gap-2 items-center">
                            <input autoFocus value={gEditando.nombre} onChange={e => setGEditando(ed => ({ ...ed, nombre: e.target.value }))}
                              className="border border-gray-200 rounded-lg px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-brand-500 w-48" />
                            <select value={gEditando.tipo ?? ''} onChange={e => setGEditando(ed => ({ ...ed, tipo: e.target.value || null }))}
                              className="border border-gray-200 rounded-lg px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-brand-500 bg-white">
                              <option value="">Sin tipo</option>
                              <option value="caliente">🔥 Caliente</option>
                              <option value="fria">❄️ Fría</option>
                            </select>
                            <button type="submit" className="text-brand-700 text-xs font-semibold">Guardar</button>
                            <button type="button" onClick={() => setGEditando(null)} className="text-gray-400 text-xs">Cancelar</button>
                          </form>
                        ) : <span className="font-medium text-gray-900">{g.nombre}</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        {tipoCfg ? <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${tipoCfg.cls}`}>{tipoCfg.label}</span>
                                 : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        <button onClick={() => gUpdate.mutate({ id: g.id, data: { activo: !g.activo } })}
                          className={`badge cursor-pointer transition-colors ${g.activo ? 'bg-brand-50 text-brand-700 hover:bg-brand-100' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                          {g.activo ? '● Activa' : '○ Inactiva'}
                        </button>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1" onClick={e => e.stopPropagation()}>
                          <button onClick={() => setGEditando({ id: g.id, nombre: g.nombre, tipo: g.tipo })} className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors" title="Editar">✏️</button>
                          <button onClick={async () => {
                            if (!await confirmar({ titulo: `¿Eliminar "${g.nombre}"?`, texto: 'Esta acción no se puede deshacer.', botonConfirmar: 'Sí, eliminar' })) return;
                            try { await gDelete.mutateAsync(g.id); toast.success('Guarnición eliminada'); } catch(err) { toast.error(err?.message || 'Error'); }
                          }} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Eliminar">🗑️</button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
          </div>
          </>
        )}
      </div>

      {/* Paginación — solo platos */}
      {tab === 'platos' && pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-gray-400">Página {pagination.page} de {pagination.totalPages}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => p - 1)} disabled={page <= 1} className="btn-secondary text-xs disabled:opacity-40">← Anterior</button>
            <button onClick={() => setPage((p) => p + 1)} disabled={page >= pagination.totalPages} className="btn-secondary text-xs disabled:opacity-40">Siguiente →</button>
          </div>
        </div>
      )}

      {/* Modal detalle */}
      <DetallePlatoModal plato={detalle} onClose={() => setDetalle(null)} onEdit={(p) => setEditando(p)} />

      {/* Modal crear plato */}
      <Modal open={modalCreate} onClose={() => setModalCreate(false)} title="Nuevo plato">
        <PlatoForm onSubmit={handleCreate} onCancel={() => setModalCreate(false)} loading={createMutation.isPending} />
      </Modal>

      {/* Modal editar plato */}
      <Modal open={!!editando} onClose={() => setEditando(null)} title="Editar plato">
        <PlatoForm initial={editando} onSubmit={handleUpdate} onCancel={() => setEditando(null)} loading={updateMutation.isPending} />
      </Modal>

      {/* Modal eliminar plato */}
      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Eliminar plato">
        <p className="text-sm text-gray-600 mb-1">¿Seguro que querés eliminar <strong>{confirmDelete?.nombre}</strong>?</p>
        <p className="text-xs text-gray-400 mb-5">Esta acción no se puede deshacer. Si el plato está asignado a un menú semanal activo, no se podrá eliminar.</p>
        <div className="flex justify-end gap-2">
          <button onClick={() => setConfirmDelete(null)} className="btn-secondary">Cancelar</button>
          <button
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
          >
            {deleteMutation.isPending ? <Spinner size="sm" /> : null}
            Eliminar
          </button>
        </div>
      </Modal>

      {/* Modal nueva guarnición */}
      <GuarnicionesPanel
        modalOpen={modalGuarnicion}
        onModalClose={() => setModalGuarnicion(false)}
      />

    </div>
  );
}
