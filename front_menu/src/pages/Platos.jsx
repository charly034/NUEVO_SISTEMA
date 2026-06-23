import { useState, useCallback } from 'react';
import { usePlatos, usePlatoTags, useCreatePlato, useUpdatePlato, useDeletePlato } from '../hooks/usePlatos.js';
import { useHistorialPlato } from '../hooks/useHistorial.js';
import Modal from '../components/ui/Modal.jsx';
import PlatoForm from '../components/platos/PlatoForm.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import ErrorMessage from '../components/ui/ErrorMessage.jsx';
import { toast } from '../lib/toast.js';

const ESTADO_FILTROS = [
  { label: 'Activos',   value: 'true'    },
  { label: 'Todos',     value: undefined },
  { label: 'Inactivos', value: 'false'   },
];

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
  return Math.max(0, Math.floor(diff / 86400000));
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
            {plato?.descripcion && (
              <p className="text-sm text-gray-600">{plato.descripcion}</p>
            )}
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`badge ${plato?.activo ? 'bg-brand-50 text-brand-700' : 'bg-gray-100 text-gray-500'}`}>
                {plato?.activo ? '● Activo' : '○ Inactivo'}
              </span>
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
                  <p className="text-2xl font-bold text-gray-800">{ultimo ? (esFuturo ? '—' : d) : '—'}</p>
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
                    <span className="text-xs text-gray-400">hace {diasDesde(h.fecha_servicio)}d</span>
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

// ── Página principal ─────────────────────────────────────────────
export default function Platos() {
  const [search, setSearch]             = useState('');
  const [activoFilter, setActivo]       = useState('true');
  const [tagFilter, setTagFilter]       = useState(null);
  const [page, setPage]                 = useState(1);
  const [sortBy, setSortBy]             = useState('nombre');
  const [sortDir, setSortDir]           = useState('asc');
  const [detalle, setDetalle]           = useState(null);
  const [modalCreate, setModalCreate]   = useState(false);
  const [editando, setEditando]         = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const handleSort = (col) => {
    if (sortBy === col) { setSortDir(d => d === 'asc' ? 'desc' : 'asc'); }
    else { setSortBy(col); setSortDir('asc'); }
    setPage(1);
  };

  const query    = usePlatos({ page, limit: 15, activo: activoFilter, search: search || undefined, tag: tagFilter || undefined, sort_by: sortBy, sort_dir: sortDir });
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
    e.stopPropagation();
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

  const handleSearchChange = (e) => { setSearch(e.target.value); setPage(1); };
  const handleFiltroEstado = (val) => { setActivo(val); setPage(1); };
  const handleFiltroTag = (tag) => { setTagFilter((t) => t === tag ? null : tag); setPage(1); };

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Platos</h1>
          {pagination && (
            <p className="text-sm text-gray-400 mt-0.5">
              {pagination.total} plato{pagination.total !== 1 ? 's' : ''}
            </p>
          )}
        </div>
        <button onClick={() => setModalCreate(true)} className="btn-primary">+ Nuevo plato</button>
      </div>

      {/* Búsqueda + estado */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input
            type="text"
            value={search}
            onChange={handleSearchChange}
            placeholder="Buscar por nombre o descripción..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-300 rounded-lg outline-none
              focus:ring-2 focus:ring-brand-500 focus:border-brand-500 transition-colors"
          />
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
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

      {/* Filtro por tags */}
      {allTags.length > 0 && (
        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-xs text-gray-400 font-medium">Filtrar por:</span>
          {allTags.map((tag) => (
            <TagBadge
              key={tag}
              tag={tag}
              active={tagFilter === tag}
              onClick={() => handleFiltroTag(tag)}
            />
          ))}
          {tagFilter && (
            <button
              onClick={() => setTagFilter(null)}
              className="text-xs text-gray-400 hover:text-gray-600 underline"
            >
              Limpiar filtro
            </button>
          )}
        </div>
      )}

      {/* Lista */}
      <div className="card overflow-hidden">
        {query.isLoading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : query.isError ? (
          <ErrorMessage message={query.error.message} onRetry={query.refetch} />
        ) : platos.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-4xl mb-3">🍽️</p>
            <p className="text-gray-500 text-sm">
              {search || tagFilter ? 'Sin resultados para este filtro.' : 'No hay platos cargados aún.'}
            </p>
            {!search && !tagFilter && (
              <button onClick={() => setModalCreate(true)} className="btn-primary mt-4 text-xs">
                + Crear primer plato
              </button>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                {[
                  { col: 'nombre',     label: 'Nombre',      cls: '' },
                  { col: null,         label: 'Tags',         cls: 'hidden md:table-cell' },
                  { col: 'ultimo_uso', label: 'Último uso',  cls: 'hidden sm:table-cell' },
                  { col: 'activo',     label: 'Estado',       cls: '' },
                ].map(({ col, label, cls }) => (
                  <th key={label} className={`text-left px-5 py-3 ${cls}`}>
                    {col ? (
                      <button
                        onClick={() => handleSort(col)}
                        className="flex items-center gap-1 text-xs font-semibold text-gray-500 uppercase tracking-wide hover:text-gray-800 transition-colors group"
                      >
                        {label}
                        <span className="text-gray-300 group-hover:text-gray-400">
                          {sortBy === col ? (sortDir === 'asc' ? '↑' : '↓') : '↕'}
                        </span>
                      </button>
                    ) : (
                      <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
                    )}
                  </th>
                ))}
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {platos.map((plato) => (
                <tr
                  key={plato.id}
                  onClick={() => setDetalle(plato)}
                  className="group hover:bg-gray-50/80 transition-colors cursor-pointer"
                >
                  <td className="px-5 py-3.5">
                    <p className="font-medium text-gray-900">{plato.nombre}</p>
                    {plato.descripcion && (
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{plato.descripcion}</p>
                    )}
                  </td>
                  <td className="px-5 py-3.5 hidden md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {(plato.tags ?? []).length === 0
                        ? <span className="text-gray-300 text-xs">—</span>
                        : (plato.tags).map((t) => <TagBadge key={t} tag={t} />)
                      }
                    </div>
                  </td>
                  <td className="px-5 py-3.5 hidden sm:table-cell">
                    {plato.ultimo_uso ? (() => {
                      const d = diasDesde(plato.ultimo_uso.fecha_servicio);
                      const esFuturo = new Date(soloFecha(plato.ultimo_uso.fecha_servicio)) > new Date();
                      return (
                        <div>
                          <p className="text-gray-700">{formatCorto(plato.ultimo_uso.fecha_servicio)}</p>
                          <p className="text-xs text-gray-400">
                            {esFuturo ? 'próximo uso' : d === 0 ? 'hoy' : `hace ${d}d`}
                          </p>
                        </div>
                      );
                    })() : (
                      <span className="text-gray-300 text-xs">Nunca usado</span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <button
                      onClick={(e) => handleToggleActivo(plato, e)}
                      disabled={updateMutation.isPending}
                      className={`badge cursor-pointer transition-colors ${
                        plato.activo
                          ? 'bg-brand-50 text-brand-700 hover:bg-brand-100'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {plato.activo ? '● Activo' : '○ Inactivo'}
                    </button>
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                      <span className="text-gray-300 text-xs mr-1 group-hover:text-gray-400 transition-colors">Ver →</span>
                      <button
                        onClick={() => setEditando(plato)}
                        className="p-1.5 text-gray-400 hover:text-brand-600 hover:bg-brand-50 rounded-lg transition-colors"
                        title="Editar"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => setConfirmDelete(plato)}
                        className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Eliminar"
                      >
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Paginación */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-gray-400">Página {pagination.page} de {pagination.totalPages}</p>
          <div className="flex gap-2">
            <button onClick={() => setPage((p) => p - 1)} disabled={page <= 1} className="btn-secondary text-xs disabled:opacity-40">← Anterior</button>
            <button onClick={() => setPage((p) => p + 1)} disabled={page >= pagination.totalPages} className="btn-secondary text-xs disabled:opacity-40">Siguiente →</button>
          </div>
        </div>
      )}

      {/* Modal detalle */}
      <DetallePlatoModal
        plato={detalle}
        onClose={() => setDetalle(null)}
        onEdit={(p) => setEditando(p)}
      />

      {/* Modal crear */}
      <Modal open={modalCreate} onClose={() => setModalCreate(false)} title="Nuevo plato">
        <PlatoForm onSubmit={handleCreate} onCancel={() => setModalCreate(false)} loading={createMutation.isPending} />
      </Modal>

      {/* Modal editar */}
      <Modal open={!!editando} onClose={() => setEditando(null)} title="Editar plato">
        <PlatoForm initial={editando} onSubmit={handleUpdate} onCancel={() => setEditando(null)} loading={updateMutation.isPending} />
      </Modal>

      {/* Modal eliminar */}
      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Eliminar plato">
        <p className="text-sm text-gray-600 mb-1">
          ¿Seguro que querés eliminar <strong>{confirmDelete?.nombre}</strong>?
        </p>
        <p className="text-xs text-gray-400 mb-5">
          Esta acción no se puede deshacer. Si el plato está asignado a un menú semanal activo, no se podrá eliminar.
        </p>
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
    </div>
  );
}
