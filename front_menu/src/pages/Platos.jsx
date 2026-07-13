import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useCreatePlato, useDeletePlato, usePlatos, useUpdatePlato, useVisibilidadEmpresas, useSetVisibilidadEmpresas, useDisponibilidadLocal, useSetDisponibilidadLocal } from '../hooks/usePlatos.js';
import { useEmpresas } from '../hooks/useEmpresas.js';
import { useHistorialPlato } from '../hooks/useHistorial.js';
import Modal from '../components/ui/Modal.jsx';
import SideDrawer from '../components/ui/SideDrawer.jsx';
import PlatoForm from '../components/platos/PlatoForm.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import ErrorMessage from '../components/ui/ErrorMessage.jsx';
import PlatoPhoto from '../components/ui/PlatoPhoto.jsx';
import { toast } from '../lib/toast.js';
import { DIA_ABREV as DIAS_LABEL } from '../lib/dias.js';

const DIAS_SEMANA = [
  { value: 'lunes', label: 'Lun' },
  { value: 'martes', label: 'Mar' },
  { value: 'miercoles', label: 'Mie' },
  { value: 'jueves', label: 'Jue' },
  { value: 'viernes', label: 'Vie' },
  { value: 'sabado', label: 'Sab' },
  { value: 'domingo', label: 'Dom' },
];

const DISPONIBLE_VIANDA_FILTROS = [
  { label: 'Todos', value: undefined },
  { label: 'Sí', value: 'true' },
  { label: 'No', value: 'false' },
];

const DISPONIBILIDAD_FILTROS = [
  { label: 'Todos', value: undefined },
  { label: 'Especial', value: 'especial' },
  { label: 'Fijo dia', value: 'fijo_dia' },
  { label: 'Siempre', value: 'siempre' },
];

const TIPO_CONFIG = {
  especial: { label: 'Especial', cls: 'bg-amber-50 text-amber-700' },
  fijo: { label: 'Fijo', cls: 'bg-blue-50 text-blue-700' },
  ambos: { label: 'Fijo + Especial', cls: 'bg-purple-50 text-purple-700' },
};

const DISPONIBILIDAD_CONFIG = {
  especial:  { label: 'Especial',     cls: 'bg-amber-50 text-amber-700'     },
  fijo_dia:  { label: 'Fijo por dia', cls: 'bg-sky-50 text-sky-700'         },
  siempre:   { label: 'Siempre',      cls: 'bg-emerald-50 text-emerald-700' },
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

function leerActivo(value) {
  if (value === 'todos') return undefined;
  if (value === 'false') return 'false';
  return 'true';
}

function hayFiltroActivo({ search, activoFilter, tipoFilter, tagFilter, disponibleViandaFilter, disponibilidadFilter }) {
  return Boolean(search || activoFilter !== 'true' || tipoFilter || tagFilter || disponibleViandaFilter || disponibilidadFilter);
}

function textoEstadoPlatos({ search, activoFilter, tipoFilter, tagFilter, totalBase }) {
  if (totalBase === 0) {
    return {
      titulo: 'No hay platos cargados aún.',
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
        {detalle ? <p className="mt-1 text-xs text-gray-500">{detalle}</p> : null}
      </div>
      {mostrarLimpiar ? (
        <button type="button" onClick={onLimpiar} className="btn-secondary text-xs">
          Limpiar filtros
        </button>
      ) : null}
    </div>
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

function DisponibleViandaBadge({ disponibleVianda }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${disponibleVianda ? 'bg-brand-50 text-brand-700' : 'bg-gray-100 text-gray-500'}`}>
      {disponibleVianda ? 'Vianda: sí' : 'Vianda: no'}
    </span>
  );
}

function DisponibilidadBadge({ disponibilidad, diaFijo }) {
  const cfg = DISPONIBILIDAD_CONFIG[disponibilidad] ?? { label: disponibilidad ?? '-', cls: 'bg-gray-100 text-gray-500' };
  const label = disponibilidad === 'fijo_dia' && diaFijo ? `${cfg.label} (${diaFijo.slice(0,3)})` : cfg.label;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cfg.cls}`}>
      {label}
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

function VisibilidadEmpresas({ platoId }) {
  const { data: vis, isLoading } = useVisibilidadEmpresas(platoId);
  const { data: empresasData } = useEmpresas({ activo: true, limit: 200 });
  const setVis = useSetVisibilidadEmpresas();

  const empresas = empresasData?.empresas ?? [];
  const seleccionadas = new Set((vis?.visibilidad ?? []).map((e) => e.id));

  const toggle = (id) => {
    const next = seleccionadas.has(id)
      ? [...seleccionadas].filter((x) => x !== id)
      : [...seleccionadas, id];
    setVis.mutate(
      { id: platoId, empresa_ids: next },
      { onError: () => toast.error('Error al guardar visibilidad') }
    );
  };

  if (isLoading) return <div className="flex justify-center py-3"><Spinner /></div>;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Visible para empresas (catálogo)</p>
        {vis?.todas && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">Todas</span>}
      </div>
      <p className="text-xs text-amber-600">
        Esto ya no se usa para filtrar pedidos: la visibilidad de un fijo ahora se decide semana a semana desde
        Resumen (Menú semanal), no acá.
      </p>
      <p className="text-xs text-gray-500">Sin seleccion = visible para todas. Tildando empresas limitás la visibilidad.</p>
      <div className="grid grid-cols-2 gap-1.5 max-h-36 overflow-y-auto">
        {empresas.map((e) => (
          <label key={e.id} className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-100 px-2 py-1.5 hover:bg-gray-50">
            <input
              type="checkbox"
              checked={seleccionadas.has(e.id)}
              onChange={() => toggle(e.id)}
              className="h-3.5 w-3.5 rounded border-gray-300 text-brand-600"
            />
            <span className="text-xs text-gray-700 truncate">{e.nombre}</span>
          </label>
        ))}
      </div>
    </div>
  );
}

function DisponibilidadLocal({ platoId }) {
  const { data, isLoading } = useDisponibilidadLocal(platoId);
  const setDisponibilidad = useSetDisponibilidadLocal();
  const [fechaNueva, setFechaNueva] = useState('');

  const entradas = data?.entradas ?? [];
  const esDiario = entradas.some((e) => e.patron === 'diario');
  const diasSemana = new Set(entradas.filter((e) => e.patron === 'dia_semana').map((e) => e.dia_semana));
  const fechas = entradas.filter((e) => e.patron === 'fecha').map((e) => String(e.fecha).slice(0, 10));

  const guardar = (nuevasEntradas) => {
    setDisponibilidad.mutate(
      { id: platoId, entradas: nuevasEntradas },
      { onError: () => toast.error('Error al guardar disponibilidad en el local') }
    );
  };

  const toggleDiario = () => {
    if (esDiario) guardar([]);
    else guardar([{ patron: 'diario' }]);
  };

  const toggleDia = (dia) => {
    if (esDiario) return;
    const next = new Set(diasSemana);
    if (next.has(dia)) next.delete(dia); else next.add(dia);
    guardar([
      ...[...next].map((d) => ({ patron: 'dia_semana', dia_semana: d })),
      ...fechas.map((f) => ({ patron: 'fecha', fecha: f })),
    ]);
  };

  const agregarFecha = () => {
    if (!fechaNueva || fechas.includes(fechaNueva)) return;
    guardar([
      ...[...diasSemana].map((d) => ({ patron: 'dia_semana', dia_semana: d })),
      ...fechas.map((f) => ({ patron: 'fecha', fecha: f })),
      { patron: 'fecha', fecha: fechaNueva },
    ]);
    setFechaNueva('');
  };

  const quitarFecha = (fecha) => {
    guardar([
      ...[...diasSemana].map((d) => ({ patron: 'dia_semana', dia_semana: d })),
      ...fechas.filter((f) => f !== fecha).map((f) => ({ patron: 'fecha', fecha: f })),
    ]);
  };

  if (isLoading) return <div className="flex justify-center py-3"><Spinner /></div>;

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Disponibilidad en el local</p>
      <p className="text-xs text-gray-500">Solo informativo para cocina: el local no gestiona precio ni pedidos en este sistema.</p>
      <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-100 px-2 py-1.5 hover:bg-gray-50">
        <input
          type="checkbox"
          checked={esDiario}
          onChange={toggleDiario}
          className="h-3.5 w-3.5 rounded border-gray-300 text-brand-600"
        />
        <span className="text-xs text-gray-700">Todos los días</span>
      </label>
      {!esDiario ? (
        <div className="flex flex-wrap gap-1.5">
          {DIAS_SEMANA.map((d) => (
            <button
              key={d.value}
              type="button"
              onClick={() => toggleDia(d.value)}
              className={`rounded-lg border-2 px-2.5 py-1 text-xs font-medium transition-colors ${
                diasSemana.has(d.value) ? 'border-brand-500 bg-brand-50 text-brand-700' : 'border-gray-200 text-gray-500 hover:border-gray-300'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      ) : null}
      <div className="flex items-center gap-2 pt-1">
        <input
          type="date"
          value={fechaNueva}
          onChange={(e) => setFechaNueva(e.target.value)}
          className="rounded-lg border border-gray-300 px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-brand-500"
        />
        <button type="button" onClick={agregarFecha} className="rounded-lg border border-gray-200 px-2 py-1 text-xs font-semibold text-gray-600 hover:bg-gray-50">
          + Fecha puntual
        </button>
      </div>
      {fechas.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {fechas.map((f) => (
            <span key={f} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700">
              {f}
              <button type="button" onClick={() => quitarFecha(f)} className="text-gray-400 hover:text-red-500">&times;</button>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function DetallePlatoModal({ plato, onClose, onEdit, onDelete }) {
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
            <DisponibleViandaBadge disponibleVianda={plato?.disponible_vianda} />
            {plato?.disponibilidad ? <DisponibilidadBadge disponibilidad={plato.disponibilidad} diaFijo={plato.dia_fijo} /> : null}
            {plato?.tipo ? <TipoBadge tipo={plato.tipo} /> : null}
            {plato?.guarnicion_modo && plato.guarnicion_modo !== 'sin_guarnicion' ? (
              <span className="rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                {plato.guarnicion_modo === 'libre' ? 'Guarnicion a eleccion' : 'Guarnicion fija'}
              </span>
            ) : null}
            {plato?.salsa_modo && plato.salsa_modo !== 'sin_salsa' ? (
              <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                {plato.salsa_modo === 'libre' ? 'Salsa a eleccion' : 'Salsa fija'}
              </span>
            ) : null}
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
              <p className="mt-0.5 text-xs text-gray-500">Último uso</p>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Historial completo</p>
            <div className="max-h-60 divide-y divide-gray-50 overflow-y-auto rounded-lg border border-gray-100">
              {!data?.historial?.length ? (
                <p className="py-6 text-center text-sm text-gray-500">Nunca usado aun</p>
              ) : (
                data.historial.map((h) => (
                  <div key={h.id} className="flex items-center justify-between px-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium text-gray-800">{formatCorto(h.fecha_servicio)}</p>
                      <p className="text-xs text-gray-500">
                        {h.menu_semanal_nombre ?? 'Semana eliminada'} - {DIAS_LABEL[h.dia] ?? h.dia} - op. {h.opcion}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {plato?.disponibilidad === 'siempre' && (
            <div className="border-t border-gray-100 pt-3">
              <VisibilidadEmpresas platoId={plato.id} />
            </div>
          )}

          {plato?.id ? (
            <div className="border-t border-gray-100 pt-3">
              <DisponibilidadLocal platoId={plato.id} />
            </div>
          ) : null}

          <div className="flex flex-col gap-2 border-t border-gray-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
            <button
              type="button"
              onClick={() => { onClose(); onDelete(plato); }}
              className="rounded-lg border border-red-100 px-3 py-2 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50"
            >
              Eliminar plato
            </button>
            <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-secondary text-xs">Cerrar</button>
            <button type="button" onClick={() => { onClose(); onEdit(plato); }} className="btn-primary text-xs">Editar plato</button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}

export default function Platos() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get('search') ?? '';
  const activoFilter = leerActivo(searchParams.get('activo'));
  const tagFilter = searchParams.get('tag') || null;
  const tipoFilter = searchParams.get('tipo') || undefined;
  const disponibleViandaFilter = searchParams.get('disponible_vianda') || undefined;
  const disponibilidadFilter = searchParams.get('disponibilidad') || undefined;

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
    limit: 200,
    activo: activoFilter,
    search: search || undefined,
    tag: tagFilter || undefined,
    disponible_vianda: disponibleViandaFilter,
    disponibilidad: disponibilidadFilter,
    sort_by: 'nombre',
    sort_dir: 'asc',
  });
  const baseQuery = usePlatos({ page: 1, limit: 1, activo: undefined });
  const createMutation = useCreatePlato();
  const updateMutation = useUpdatePlato();
  const deleteMutation = useDeletePlato();

  const platos = query.data?.platos ?? [];
  const totalBase = baseQuery.data?.pagination?.total ?? 0;
  const filtrosActivos = hayFiltroActivo({ search, activoFilter, tipoFilter, tagFilter, disponibleViandaFilter, disponibilidadFilter });
  const emptyState = textoEstadoPlatos({ search, activoFilter, tipoFilter, tagFilter, totalBase });

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

  const platosSimepre  = platos.filter((p) => p.disponibilidad === 'siempre');
  const platosFijoDia  = platos.filter((p) => p.disponibilidad === 'fijo_dia');
  const platosEspecial = platos.filter((p) => !['siempre', 'fijo_dia'].includes(p.disponibilidad));

  const dispLabel = (p) => {
    if (p.disponibilidad === 'siempre')   return '∞ siempre';
    if (p.disponibilidad === 'fijo_dia')  return `fijo · ${(p.dia_fijo ?? '').slice(0, 3)}`;
    return 'especial';
  };

  const viandaNombre = (p) => p.nombre_vianda || p.nombre;

  const guarnicionLabel = (p) => {
    if (!p.guarnicion_modo || p.guarnicion_modo === 'sin_guarnicion') return null;
    if (p.guarnicion_modo === 'libre') return 'a elección';
    return 'fija';
  };

  const renderFilas = (lista) => lista.map((plato) => (
    <tr
      key={plato.id}
      onClick={() => setDetalle(plato)}
      className="group cursor-pointer border-b border-gray-50 last:border-0 hover:bg-gray-50/60 transition-colors"
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-gray-100">
            <PlatoPhoto src={plato.foto_url} alt={plato.nombre} plato={plato} />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-gray-900 leading-tight">{plato.nombre}</p>
            {plato.descripcion ? <p className="mt-0.5 text-xs text-gray-500 line-clamp-1">{plato.descripcion}</p> : null}
          </div>
        </div>
      </td>
      <td className="px-4 py-3">
        <DisponibleViandaBadge disponibleVianda={plato.disponible_vianda} />
      </td>
      <td className="px-4 py-3 text-sm text-gray-700 hidden md:table-cell">
        {viandaNombre(plato)}
      </td>
      <td className="px-4 py-3 hidden lg:table-cell">
        {guarnicionLabel(plato)
          ? <span className="text-sm text-gray-600">{guarnicionLabel(plato)}</span>
          : <span className="text-xs italic text-gray-500">sin guarnición</span>}
      </td>
      <td className="px-4 py-3 hidden sm:table-cell">
        <span className="text-xs font-medium text-gray-500">{dispLabel(plato)}</span>
      </td>
      <td className="px-4 py-3 text-right">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); setEditando(plato); }}
          className="rounded-lg border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-600 hover:border-brand-300 hover:text-brand-700 transition-colors"
        >
          Editar
        </button>
      </td>
    </tr>
  ));

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 md:space-y-5 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900">Catálogo de platos</h1>
        <div className="flex items-center gap-2">
          <Link to="/guarniciones" className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><path d="M4 6h16M4 12h16M4 18h10"/></svg>
            Guarniciones
          </Link>
          <button type="button" onClick={() => setModalCreate(true)} className="btn-primary">+ Nuevo plato</button>
        </div>
      </div>

      {/* Filtros */}
      <div className="rounded-xl border border-gray-100 bg-white px-4 py-3 space-y-3">
        <input
          type="text"
          value={search}
          onChange={(e) => updateParams({ search: e.target.value, page: null })}
          placeholder="Buscar plato..."
          className="w-full rounded-lg border border-gray-200 py-2 px-3 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100"
        />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500">Disponible en vianda:</span>
            <div className="flex gap-1">
              {DISPONIBLE_VIANDA_FILTROS.map((f) => (
                <button key={String(f.value)} type="button"
                  onClick={() => updateParams({ disponible_vianda: f.value, page: null })}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${disponibleViandaFilter === f.value ? 'bg-brand-500 text-white' : 'border border-gray-200 text-gray-500 hover:border-brand-300'}`}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500">Disponibilidad:</span>
            <div className="flex gap-1">
              {DISPONIBILIDAD_FILTROS.map((f) => (
                <button key={String(f.value)} type="button"
                  onClick={() => updateParams({ disponibilidad: f.value, page: null })}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${disponibilidadFilter === f.value ? 'bg-sky-500 text-white' : 'border border-gray-200 text-gray-500 hover:border-sky-300'}`}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>
          {filtrosActivos && (
            <button type="button" onClick={limpiarFiltros} className="text-xs text-gray-500 underline hover:text-gray-600">Limpiar</button>
          )}
        </div>
      </div>

      {/* Tabla */}
      <div className="rounded-xl border border-gray-100 bg-white overflow-hidden">
        {query.isLoading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : query.isError ? (
          <ErrorMessage message={query.error.message} onRetry={query.refetch} />
        ) : platos.length === 0 ? (
          <EmptyState titulo={emptyState.titulo} detalle={emptyState.detalle} mostrarLimpiar={filtrosActivos} onLimpiar={limpiarFiltros} />
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Plato</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Vianda</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hidden md:table-cell">En vianda aparece como</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hidden lg:table-cell">Guarnición</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 hidden sm:table-cell">Disponibilidad</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {platosSimepre.length > 0 && (
                <>
                  <tr><td colSpan={6} className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-gray-500 bg-gray-50 border-b border-gray-100">Siempre disponibles (transversales)</td></tr>
                  {renderFilas(platosSimepre)}
                </>
              )}
              {platosFijoDia.length > 0 && (
                <>
                  <tr><td colSpan={6} className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-gray-500 bg-gray-50 border-b border-gray-100">Fijos por día (plantilla semanal)</td></tr>
                  {renderFilas(platosFijoDia)}
                </>
              )}
              {platosEspecial.length > 0 && (
                <>
                  {(platosSimepre.length > 0 || platosFijoDia.length > 0) && (
                    <tr><td colSpan={6} className="px-4 py-2 text-xs font-bold uppercase tracking-widest text-gray-500 bg-gray-50 border-b border-gray-100">Especiales (rotativos)</td></tr>
                  )}
                  {renderFilas(platosEspecial)}
                </>
              )}
            </tbody>
          </table>
        )}
      </div>

      <DetallePlatoModal
        plato={detalle}
        onClose={() => setDetalle(null)}
        onEdit={setEditando}
        onDelete={setConfirmDelete}
      />

      <SideDrawer open={modalCreate} onClose={() => setModalCreate(false)} title="Nuevo plato" width="lg">
        <div className="p-5">
          {modalCreate ? (
            <PlatoForm onSubmit={handleCreate} onCancel={() => setModalCreate(false)} loading={createMutation.isPending} />
          ) : null}
        </div>
      </SideDrawer>

      <SideDrawer open={!!editando} onClose={() => setEditando(null)} title="Editar plato" width="lg">
        <div className="p-5">
          {editando ? (
            <PlatoForm key={editando.id} initial={editando} onSubmit={handleUpdate} onCancel={() => setEditando(null)} loading={updateMutation.isPending} />
          ) : null}
        </div>
      </SideDrawer>

      <Modal open={!!confirmDelete} onClose={() => setConfirmDelete(null)} title="Eliminar plato">
        <p className="mb-1 text-sm text-gray-600">Seguro que queres eliminar <strong>{confirmDelete?.nombre}</strong>?</p>
        <p className="mb-5 text-xs text-gray-500">Esta acción no se puede deshacer. Si el plato está asignado a un menú semanal activo, no se podrá eliminar.</p>
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
