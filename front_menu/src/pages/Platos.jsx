import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useCreatePlato, useDeletePlato, usePlatos, usePlatoTags, useUpdatePlato } from '../hooks/usePlatos.js';
import { useHistorialPlato } from '../hooks/useHistorial.js';
import Modal from '../components/ui/Modal.jsx';
import SideDrawer from '../components/ui/SideDrawer.jsx';
import PlatoForm from '../components/platos/PlatoForm.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import ErrorMessage from '../components/ui/ErrorMessage.jsx';
import { EyeIcon, IconActionButton, PencilIcon, TrashIcon } from '../components/ui/IconActionButton.jsx';
import PlatoPhoto from '../components/ui/PlatoPhoto.jsx';
import { toast } from '../lib/toast.js';

const ESTADO_FILTROS = [
  { label: 'Activos', value: 'true' },
  { label: 'Todos', value: undefined },
  { label: 'Inactivos', value: 'false' },
];

const TIPO_FILTROS = [
  { label: 'Todos', value: undefined },
  { label: 'Especial', value: 'especial' },
  { label: 'Fijo', value: 'fijo' },
  { label: 'Fijo + Especial', value: 'ambos' },
];

const SORT_OPTIONS = [
  { label: 'Nombre A-Z', sortBy: 'nombre', sortDir: 'asc' },
  { label: 'Nombre Z-A', sortBy: 'nombre', sortDir: 'desc' },
  { label: 'Ultimo uso reciente', sortBy: 'ultimo_uso', sortDir: 'desc' },
  { label: 'Ultimo uso antiguo', sortBy: 'ultimo_uso', sortDir: 'asc' },
  { label: 'Estado activos primero', sortBy: 'activo', sortDir: 'desc' },
  { label: 'Estado inactivos primero', sortBy: 'activo', sortDir: 'asc' },
];

const TIPO_CONFIG = {
  especial: { label: 'Especial', cls: 'bg-amber-50 text-amber-700' },
  fijo: { label: 'Fijo', cls: 'bg-blue-50 text-blue-700' },
  ambos: { label: 'Fijo + Especial', cls: 'bg-purple-50 text-purple-700' },
};

const DIAS_LABEL = {
  lunes: 'Lun',
  martes: 'Mar',
  miercoles: 'Mie',
  jueves: 'Jue',
  viernes: 'Vie',
  sabado: 'Sab',
  domingo: 'Dom',
};

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

function leerEnteroPositivo(value, fallback = 1) {
  const numero = Number(value);
  return Number.isInteger(numero) && numero > 0 ? numero : fallback;
}

function leerActivo(value) {
  if (value === 'todos') return undefined;
  if (value === 'false') return 'false';
  return 'true';
}

function escribirActivo(value) {
  return value === undefined ? 'todos' : value;
}

function hayFiltroActivo({ search, activoFilter, tipoFilter, tagFilter }) {
  return Boolean(search || activoFilter !== 'true' || tipoFilter || tagFilter);
}

function textoEstadoPlatos({ search, activoFilter, tipoFilter, tagFilter, totalBase }) {
  if (totalBase === 0) {
    return {
      titulo: 'No hay platos cargados aun.',
      detalle: 'Cuando crees el primer plato, va a aparecer en este listado.',
    };
  }
  if (search) {
    return {
      titulo: `No se encontraron platos para "${search}".`,
      detalle: 'Probá con otro nombre o limpiá los filtros activos.',
    };
  }
  if (activoFilter === 'false') {
    return {
      titulo: 'No hay platos inactivos.',
      detalle: 'Todos los platos visibles estan activos.',
    };
  }
  if (activoFilter === 'true' && (tipoFilter || tagFilter)) {
    return {
      titulo: 'No hay platos activos para este filtro.',
      detalle: 'Probá cambiando el tipo o la categoria.',
    };
  }
  if (tipoFilter) {
    return {
      titulo: 'No hay platos para este tipo.',
      detalle: 'Probá con otro tipo de uso.',
    };
  }
  if (tagFilter) {
    return {
      titulo: `No hay platos en "${tagFilter}".`,
      detalle: 'Probá con otra categoria.',
    };
  }
  return {
    titulo: 'No se encontraron platos para este filtro.',
    detalle: 'Probá limpiando los filtros activos.',
  };
}

function EmptyState({ titulo, detalle, mostrarLimpiar, onLimpiar }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-16 text-center">
      <div>
        <p className="text-sm font-medium text-gray-600">{titulo}</p>
        {detalle ? <p className="mt-1 text-xs text-gray-400">{detalle}</p> : null}
      </div>
      {mostrarLimpiar ? (
        <button type="button" onClick={onLimpiar} className="btn-secondary text-xs">
          Limpiar filtros
        </button>
      ) : null}
    </div>
  );
}

function SortSelect({ value, onChange }) {
  return (
    <label className="flex flex-col gap-1 md:hidden">
      <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Ordenar por</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500"
      >
        {SORT_OPTIONS.map((option) => (
          <option key={`${option.sortBy}:${option.sortDir}`} value={`${option.sortBy}:${option.sortDir}`}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function soloFecha(str) {
  return str ? str.split('T')[0] : null;
}

function formatCorto(isoStr) {
  const fecha = soloFecha(isoStr);
  if (!fecha) return '-';
  const [, mes, dia] = fecha.split('-');
  return `${dia}/${mes}`;
}

function diasDesde(fechaIso) {
  const fecha = soloFecha(fechaIso);
  if (!fecha) return null;
  const diff = Date.now() - new Date(fecha).getTime();
  return Math.floor(diff / 86400000);
}

function tagColor(tag) {
  let h = 0;
  for (let i = 0; i < tag.length; i += 1) h = (h * 31 + tag.charCodeAt(i)) % TAG_COLORS.length;
  return TAG_COLORS[h];
}

function TipoBadge({ tipo }) {
  const cfg = TIPO_CONFIG[tipo] ?? { label: tipo ?? '-', cls: 'bg-gray-100 text-gray-500' };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold ${cfg.cls}`}>
      {cfg.label}
    </span>
  );
}

function TagBadge({ tag }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tagColor(tag)}`}>
      {tag}
    </span>
  );
}

function EstadoBadge({ activo, onClick, disabled, femenino = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`badge cursor-pointer transition-colors ${
        activo ? 'bg-brand-50 text-brand-700 hover:bg-brand-100' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
      }`}
    >
      {activo ? `Activo${femenino ? 'a' : ''}` : `Inactivo${femenino ? 'a' : ''}`}
    </button>
  );
}

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
          <div className="h-44 w-full overflow-hidden rounded-xl border border-gray-100">
            <PlatoPhoto
              src={plato?.foto_url}
              alt={plato?.nombre ?? 'Plato'}
              plato={plato}
              size="lg"
            />
          </div>

          {plato?.descripcion ? <p className="text-sm text-gray-600">{plato.descripcion}</p> : null}
          {plato?.descripcion_larga ? <p className="whitespace-pre-line text-sm text-gray-500">{plato.descripcion_larga}</p> : null}

          <div className="flex flex-wrap items-center gap-2">
            <span className={`badge ${plato?.activo ? 'bg-brand-50 text-brand-700' : 'bg-gray-100 text-gray-500'}`}>
              {plato?.activo ? 'Activo' : 'Inactivo'}
            </span>
            {plato?.calorias ? <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700">{plato.calorias} kcal</span> : null}
            {plato?.vegetariano ? <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Vegetariano</span> : null}
            {plato?.tipo ? <TipoBadge tipo={plato.tipo} /> : null}
            {plato?.tiene_guarnicion ? <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">Con guarnicion</span> : null}
            {(plato?.alergenos ?? []).map((alergeno) => (
              <span key={alergeno} className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">{alergeno}</span>
            ))}
            {(plato?.tags ?? []).map((tag) => <TagBadge key={tag} tag={tag} />)}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-gray-50 p-3 text-center">
              <p className="text-2xl font-bold text-gray-800">{data?.historial?.length ?? 0}</p>
              <p className="mt-0.5 text-xs text-gray-500">Veces usado</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3 text-center">
              <p className="text-2xl font-bold text-gray-800">{data?.historial?.[0] ? Math.abs(diasDesde(data.historial[0].fecha_servicio) ?? 0) : '-'}</p>
              <p className="mt-0.5 text-xs text-gray-500">Dias desde/hasta</p>
            </div>
            <div className="rounded-lg bg-gray-50 p-3 text-center">
              <p className="text-lg font-bold text-gray-800">{data?.historial?.[0] ? formatCorto(data.historial[0].fecha_servicio) : '-'}</p>
              <p className="mt-0.5 text-xs text-gray-500">Ultimo uso</p>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Historial completo</p>
            <div className="max-h-60 divide-y divide-gray-50 overflow-y-auto rounded-lg border border-gray-100">
              {!data?.historial?.length ? (
                <p className="py-6 text-center text-sm text-gray-400">Nunca usado aun</p>
              ) : (
                data.historial.map((h) => (
                  <div key={h.id} className="flex items-center justify-between px-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{formatCorto(h.fecha_servicio)}</p>
                      <p className="text-xs text-gray-400">
                        {h.menu_semanal_nombre ?? 'Semana eliminada'} - {DIAS_LABEL[h.dia] ?? h.dia} - op. {h.opcion}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 border-t border-gray-100 pt-1">
            <button type="button" onClick={onClose} className="btn-secondary text-xs">Cerrar</button>
            <button type="button" onClick={() => { onClose(); onEdit(plato); }} className="btn-primary text-xs">Editar plato</button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function PlatoMobileCard({ plato, loading, onOpen, onToggleActivo, onEdit, onDelete }) {
  const ultimoUso = plato.ultimo_uso
    ? `Último uso: ${formatCorto(plato.ultimo_uso.fecha_servicio)}`
    : 'Nunca usado';

  return (
    <div className="bg-white px-4 py-3.5">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Ver detalle de ${plato.nombre}`}
        className="flex w-full items-start gap-3 text-left"
      >
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-100">
          <PlatoPhoto src={plato.foto_url} alt={plato.nombre} plato={plato} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-snug text-gray-900">{plato.nombre}</p>
          <p className="mt-0.5 text-xs text-gray-400">{ultimoUso}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            {plato.tipo ? <TipoBadge tipo={plato.tipo} /> : null}
            {plato.tiene_guarnicion ? <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">Guarnicion</span> : null}
            {plato.calorias ? <span className="text-xs text-orange-600">{plato.calorias} kcal</span> : null}
          </div>
        </div>
      </button>
      <div className="mt-3 flex items-center justify-between gap-2">
        <EstadoBadge activo={plato.activo} disabled={loading} onClick={() => onToggleActivo(plato)} />
        <div className="flex items-center gap-1">
          <IconActionButton label={`Ver detalle de ${plato.nombre}`} tooltip="Ver detalle" onClick={onOpen}>
            <EyeIcon />
          </IconActionButton>
          <IconActionButton label={`Editar plato ${plato.nombre}`} tooltip="Editar plato" tone="brand" onClick={() => onEdit(plato)}>
            <PencilIcon />
          </IconActionButton>
          <IconActionButton label={`Eliminar plato ${plato.nombre}`} tooltip="Eliminar plato" tone="danger" onClick={() => onDelete(plato)}>
            <TrashIcon />
          </IconActionButton>
        </div>
      </div>
    </div>
  );
}

export default function Platos() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get('search') ?? '';
  const activoFilter = leerActivo(searchParams.get('activo'));
  const tagFilter = searchParams.get('tag') || null;
  const tipoFilter = searchParams.get('tipo') || undefined;
  const page = leerEnteroPositivo(searchParams.get('page'), 1);
  const sortBy = searchParams.get('sort_by') || 'nombre';
  const sortDir = searchParams.get('sort_dir') === 'desc' ? 'desc' : 'asc';

  const [detalle, setDetalle] = useState(null);
  const [modalCreate, setModalCreate] = useState(false);
  const [editando, setEditando] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  useEffect(() => {
    if (searchParams.get('tab') !== 'guarniciones') return;
    const next = new URLSearchParams(searchParams);
    next.delete('tab');
    navigate({ pathname: '/guarniciones', search: next.toString() ? `?${next.toString()}` : '' }, { replace: true });
  }, [navigate, searchParams]);

  const updateParams = useCallback((changes) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') next.delete(key);
      else next.set(key, String(value));
    });
    next.delete('tab');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const query = usePlatos({
    page,
    limit: 15,
    activo: activoFilter,
    search: search || undefined,
    tag: tagFilter || undefined,
    tipo: tipoFilter,
    sort_by: sortBy,
    sort_dir: sortDir,
  });
  const baseQuery = usePlatos({ page: 1, limit: 1, activo: undefined });
  const tagsQuery = usePlatoTags();
  const createMutation = useCreatePlato();
  const updateMutation = useUpdatePlato();
  const deleteMutation = useDeletePlato();

  const platos = query.data?.platos ?? [];
  const pagination = query.data?.pagination;
  const totalBase = baseQuery.data?.pagination?.total ?? 0;
  const allTags = tagsQuery.data ?? [];
  const filtrosActivos = hayFiltroActivo({ search, activoFilter, tipoFilter, tagFilter });
  const emptyState = textoEstadoPlatos({ search, activoFilter, tipoFilter, tagFilter, totalBase });

  const handleSort = (col) => {
    updateParams({
      sort_by: col,
      sort_dir: sortBy === col && sortDir === 'asc' ? 'desc' : 'asc',
      page: null,
    });
  };
  const handleMobileSort = (value) => {
    const [nextSortBy, nextSortDir] = value.split(':');
    updateParams({
      sort_by: nextSortBy,
      sort_dir: nextSortDir,
      page: null,
    });
  };
  const limpiarFiltros = () => setSearchParams(new URLSearchParams(), { replace: true });

  const handleCreate = async (data) => {
    try {
      await createMutation.mutateAsync(data);
      toast.success('Plato creado correctamente');
      setModalCreate(false);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleUpdate = async (data) => {
    try {
      await updateMutation.mutateAsync({ id: editando.id, data });
      toast.success('Plato actualizado');
      setEditando(null);
    } catch (e) {
      toast.error(e.message);
    }
  };

  const handleToggleActivo = useCallback(async (plato, e) => {
    e?.stopPropagation();
    try {
      await updateMutation.mutateAsync({ id: plato.id, data: { activo: !plato.activo } });
      toast.success(plato.activo ? 'Plato desactivado' : 'Plato activado');
    } catch (e) {
      toast.error(e.message);
    }
  }, [updateMutation]);

  const handleDelete = async () => {
    try {
      await deleteMutation.mutateAsync(confirmDelete.id);
      toast.success('Plato eliminado');
      setConfirmDelete(null);
    } catch (e) {
      toast.error(e.message);
      setConfirmDelete(null);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 md:space-y-5 md:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-h-[52px]">
          <h1 className="text-2xl font-bold text-gray-900">Platos</h1>
          <p className="mt-0.5 h-5 text-sm text-gray-400">
            {pagination ? `${pagination.total} plato${pagination.total !== 1 ? 's' : ''}` : ''}
          </p>
        </div>
        <button type="button" onClick={() => setModalCreate(true)} className="btn-primary flex-shrink-0">+ Nuevo plato</button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">Buscar</span>
          <input
            type="text"
            value={search}
            onChange={(e) => updateParams({ search: e.target.value, page: null })}
            placeholder="Buscar por nombre o descripcion..."
            className="w-full rounded-lg border border-gray-300 py-2 pl-16 pr-4 text-sm outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500"
          />
        </div>
        <div className="flex flex-shrink-0 gap-1 rounded-lg bg-gray-100 p-1">
          {ESTADO_FILTROS.map((f) => (
            <button
              key={String(f.value)}
              type="button"
              onClick={() => updateParams({ activo: escribirActivo(f.value), page: null })}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                activoFilter === f.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
        <div className="flex flex-shrink-0 gap-1 rounded-lg bg-gray-100 p-1">
          {TIPO_FILTROS.map((f) => (
            <button
              key={String(f.value)}
              type="button"
              onClick={() => updateParams({ tipo: f.value, page: null })}
              className={`whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                tipoFilter === f.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {allTags.length > 0 ? (
          <div className="flex flex-shrink-0 items-center gap-1.5">
            <select
              value={tagFilter ?? ''}
              onChange={(e) => updateParams({ tag: e.target.value || null, page: null })}
              className="rounded-lg border border-gray-300 bg-white px-3 py-[7px] text-sm text-gray-700 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Todas las categorias</option>
              {allTags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}
            </select>
            {tagFilter ? (
              <button type="button" onClick={() => updateParams({ tag: null, page: null })} className="flex-shrink-0 text-xs text-gray-400 underline hover:text-gray-600">Limpiar</button>
            ) : null}
          </div>
        ) : null}
      </div>

      <SortSelect value={`${sortBy}:${sortDir}`} onChange={handleMobileSort} />

      <div className="card overflow-hidden">
        {query.isLoading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : query.isError ? (
          <ErrorMessage message={query.error.message} onRetry={query.refetch} />
        ) : (
          <>
            <div className="divide-y divide-gray-100 md:hidden">
              {platos.length === 0 ? (
                <EmptyState
                  titulo={emptyState.titulo}
                  detalle={emptyState.detalle}
                  mostrarLimpiar={filtrosActivos}
                  onLimpiar={limpiarFiltros}
                />
              ) : platos.map((plato) => (
                <PlatoMobileCard
                  key={plato.id}
                  plato={plato}
                  loading={updateMutation.isPending}
                  onOpen={() => setDetalle(plato)}
                  onToggleActivo={handleToggleActivo}
                  onEdit={setEditando}
                  onDelete={setConfirmDelete}
                />
              ))}
            </div>

            <div className="max-h-[520px] overflow-y-auto">
              <table className="hidden w-full text-sm md:table">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {[
                      { col: 'nombre', label: 'Nombre' },
                      { col: null, label: 'Tipo', cls: 'hidden md:table-cell' },
                      { col: null, label: 'Tags', cls: 'hidden lg:table-cell' },
                      { col: 'ultimo_uso', label: 'Ultimo uso', cls: 'hidden sm:table-cell' },
                      { col: 'activo', label: 'Estado' },
                    ].map(({ col, label, cls = '' }) => (
                      <th key={label} className={`px-5 py-3 text-left ${cls}`}>
                        {col ? (
                          <button type="button" onClick={() => handleSort(col)} className="flex items-center gap-1 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-gray-500 transition-colors hover:text-gray-800">
                            {label} <span className="text-gray-300">{sortBy === col ? (sortDir === 'asc' ? 'up' : 'down') : '-'}</span>
                          </button>
                        ) : (
                          <span className="whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</span>
                        )}
                      </th>
                    ))}
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {platos.length === 0 ? (
                    <tr>
                      <td colSpan={6}>
                        <EmptyState
                          titulo={emptyState.titulo}
                          detalle={emptyState.detalle}
                          mostrarLimpiar={filtrosActivos}
                          onLimpiar={limpiarFiltros}
                        />
                      </td>
                    </tr>
                  ) : platos.map((plato) => (
                    <tr key={plato.id} onClick={() => setDetalle(plato)} className="group cursor-pointer transition-colors hover:bg-gray-50/80">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-100">
                            <PlatoPhoto src={plato.foto_url} alt={plato.nombre} plato={plato} />
                          </div>
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setDetalle(plato); }}
                              aria-label={`Ver detalle de ${plato.nombre}`}
                              className="rounded text-left font-medium text-gray-900 transition-colors hover:text-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1"
                            >
                              {plato.nombre}
                            </button>
                            {plato.descripcion ? <p className="mt-0.5 line-clamp-1 text-xs text-gray-400">{plato.descripcion}</p> : null}
                            <div className="mt-1 flex items-center gap-1.5">
                              {plato.calorias ? <span className="text-xs text-orange-600">{plato.calorias} kcal</span> : <span className="text-xs text-gray-400">Sin kcal</span>}
                              {plato.vegetariano ? <span className="text-xs text-emerald-600">Vegetariano</span> : null}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="hidden px-5 py-3.5 md:table-cell">
                        <div className="flex flex-col gap-1.5">
                          <TipoBadge tipo={plato.tipo} />
                          {plato.tiene_guarnicion ? <span className="w-fit rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">Guarnicion</span> : null}
                        </div>
                      </td>
                      <td className="hidden px-5 py-3.5 lg:table-cell">
                        <div className="flex flex-wrap gap-1">
                          {(plato.tags ?? []).length === 0 ? <span className="text-xs text-gray-300">-</span> : plato.tags.map((tag) => <TagBadge key={tag} tag={tag} />)}
                        </div>
                      </td>
                      <td className="hidden px-5 py-3.5 sm:table-cell">
                        {plato.ultimo_uso ? (
                          <span className="text-sm text-gray-700">{formatCorto(plato.ultimo_uso.fecha_servicio)}</span>
                        ) : <span className="text-xs text-gray-300">Nunca usado</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        <EstadoBadge activo={plato.activo} disabled={updateMutation.isPending} onClick={(e) => handleToggleActivo(plato, e)} />
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <IconActionButton label={`Ver detalle de ${plato.nombre}`} tooltip="Ver detalle" onClick={() => setDetalle(plato)}>
                            <EyeIcon />
                          </IconActionButton>
                          <IconActionButton label={`Editar plato ${plato.nombre}`} tooltip="Editar plato" tone="brand" onClick={() => setEditando(plato)}>
                            <PencilIcon />
                          </IconActionButton>
                          <IconActionButton label={`Eliminar plato ${plato.nombre}`} tooltip="Eliminar plato" tone="danger" onClick={() => setConfirmDelete(plato)}>
                            <TrashIcon />
                          </IconActionButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {pagination && pagination.totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm">
          <p className="text-gray-400">Pagina {pagination.page} de {pagination.totalPages}</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => updateParams({ page: page - 1 > 1 ? page - 1 : null })} disabled={page <= 1} className="btn-secondary text-xs disabled:opacity-40">Anterior</button>
            <button type="button" onClick={() => updateParams({ page: page + 1 })} disabled={page >= pagination.totalPages} className="btn-secondary text-xs disabled:opacity-40">Siguiente</button>
          </div>
        </div>
      ) : null}

      <DetallePlatoModal plato={detalle} onClose={() => setDetalle(null)} onEdit={setEditando} />

      <SideDrawer open={modalCreate} onClose={() => setModalCreate(false)} title="Nuevo plato" width="lg">
        <div className="p-5">
          <PlatoForm onSubmit={handleCreate} onCancel={() => setModalCreate(false)} loading={createMutation.isPending} />
        </div>
      </SideDrawer>

      <SideDrawer open={!!editando} onClose={() => setEditando(null)} title="Editar plato" width="lg">
        <div className="p-5">
          <PlatoForm initial={editando} onSubmit={handleUpdate} onCancel={() => setEditando(null)} loading={updateMutation.isPending} />
        </div>
      </SideDrawer>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Eliminar plato">
        <p className="mb-1 text-sm text-gray-600">Seguro que queres eliminar <strong>{confirmDelete?.nombre}</strong>?</p>
        <p className="mb-5 text-xs text-gray-400">Esta accion no se puede deshacer. Si el plato esta asignado a un menu semanal activo, no se podra eliminar.</p>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => setConfirmDelete(null)} className="btn-secondary">Cancelar</button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleteMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-50"
          >
            {deleteMutation.isPending ? <Spinner size="sm" /> : null}
            Eliminar
          </button>
        </div>
      </Modal>
    </div>
  );
}
