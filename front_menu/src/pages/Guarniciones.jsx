import { useCallback, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useDeleteGuarnicion, useGuarniciones, useUpdateGuarnicion } from '../hooks/useGuarniciones.js';
import GuarnicionesPanel from '../components/platos/GuarnicionesPanel.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import SideDrawer from '../components/ui/SideDrawer.jsx';
import { PencilIcon, IconActionButton } from '../components/ui/IconActionButton.jsx';
import { confirmar } from '../lib/confirm.js';
import { toast } from '../lib/toast.js';

const ESTADO_FILTROS = [
  { label: 'Activos', value: 'true' },
  { label: 'Todos', value: undefined },
  { label: 'Inactivos', value: 'false' },
];

const TIPO_FILTROS = [
  { label: 'Todas', value: undefined },
  { label: 'Calientes', value: 'caliente' },
  { label: 'Frias', value: 'fria' },
];

const SORT_OPTIONS = [
  { label: 'Nombre A-Z', sortBy: 'nombre', sortDir: 'asc' },
  { label: 'Nombre Z-A', sortBy: 'nombre', sortDir: 'desc' },
  { label: 'Tipo A-Z', sortBy: 'tipo', sortDir: 'asc' },
  { label: 'Tipo Z-A', sortBy: 'tipo', sortDir: 'desc' },
  { label: 'Estado activas primero', sortBy: 'activo', sortDir: 'desc' },
  { label: 'Estado inactivas primero', sortBy: 'activo', sortDir: 'asc' },
];

const PAGE_SIZE = 15;

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

function hayFiltroActivo({ search, activoFilter, tipoFilter }) {
  return Boolean(search || activoFilter !== 'true' || tipoFilter);
}

function textoEstadoGuarniciones({ search, activoFilter, tipoFilter, totalBase }) {
  if (totalBase === 0) {
    return {
      titulo: 'No hay guarniciones cargadas aun.',
      detalle: 'Cuando crees la primera guarnicion, va a aparecer en este listado.',
    };
  }
  if (search) {
    return {
      titulo: `No se encontraron guarniciones para "${search}".`,
      detalle: 'Probá con otro nombre o limpiá los filtros activos.',
    };
  }
  if (activoFilter === 'false') {
    return {
      titulo: 'No hay guarniciones inactivas.',
      detalle: 'Todas las guarniciones visibles estan activas.',
    };
  }
  if (activoFilter === 'true' && tipoFilter) {
    return {
      titulo: 'No hay guarniciones activas para este tipo.',
      detalle: 'Probá cambiando el tipo o el estado.',
    };
  }
  if (tipoFilter === 'caliente') {
    return {
      titulo: 'No hay guarniciones calientes.',
      detalle: 'Probá con guarniciones frias o limpiá los filtros.',
    };
  }
  if (tipoFilter === 'fria') {
    return {
      titulo: 'No hay guarniciones frias.',
      detalle: 'Probá con guarniciones calientes o limpiá los filtros.',
    };
  }
  return {
    titulo: 'No se encontraron guarniciones para este filtro.',
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

function tipoBadge(tipo) {
  if (tipo === 'caliente') return { label: 'Caliente', cls: 'bg-orange-50 text-orange-700' };
  if (tipo === 'fria') return { label: 'Fria', cls: 'bg-blue-50 text-blue-700' };
  return null;
}

function EstadoBadge({ activo, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`badge cursor-pointer transition-colors ${
        activo ? 'bg-brand-50 text-brand-700 hover:bg-brand-100' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
      }`}
    >
      {activo ? 'Activa' : 'Inactiva'}
    </button>
  );
}

function TipoBadge({ tipo }) {
  const tipoCfg = tipoBadge(tipo);
  return tipoCfg ? (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${tipoCfg.cls}`}>
      {tipoCfg.label}
    </span>
  ) : (
    <span className="text-xs text-gray-500">-</span>
  );
}

function GuarnicionMobileCard({ guarnicion, loading, onOpen, onToggleActivo }) {
  return (
    <div className="bg-white px-4 py-3.5">
      <button type="button" onClick={onOpen} className="flex w-full items-start gap-3 text-left">
        <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-gray-100 bg-gray-100">
          <span className="text-xs text-gray-500">Tipo</span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-snug text-gray-900">{guarnicion.nombre}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <TipoBadge tipo={guarnicion.tipo} />
          </div>
        </div>
      </button>
      <div className="mt-3 flex items-center justify-between gap-2">
        <EstadoBadge
          activo={guarnicion.activo}
          disabled={loading}
          onClick={() => onToggleActivo(guarnicion)}
        />
        <button type="button" onClick={onOpen} className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50">
          Ver detalle
        </button>
      </div>
    </div>
  );
}

export default function Guarniciones() {
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get('search') ?? '';
  const activoFilter = leerActivo(searchParams.get('activo'));
  const tipoFilter = searchParams.get('tipo') || undefined;
  const sortBy = searchParams.get('sort_by') || 'nombre';
  const sortDir = searchParams.get('sort_dir') === 'desc' ? 'desc' : 'asc';
  const page = leerEnteroPositivo(searchParams.get('page'), 1);

  const { data: guarniciones = [], isLoading } = useGuarniciones();
  const actualizar = useUpdateGuarnicion();
  const eliminar = useDeleteGuarnicion();

  const [modalCreate, setModalCreate] = useState(false);
  const [editando, setEditando] = useState(null);
  const [detalle, setDetalle] = useState(null);
  const [editError, setEditError] = useState('');
  const [filtrosAvanzadosAbiertos, setFiltrosAvanzadosAbiertos] = useState(false);
  const editNombreRef = useRef(null);

  const updateParams = useCallback((changes) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') next.delete(key);
      else next.set(key, String(value));
    });
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const filtradas = useMemo(() => {
    let list = guarniciones.filter((g) => {
      const coincideTexto = !search || g.nombre.toLowerCase().includes(search.toLowerCase());
      const coincideTipo = tipoFilter === undefined || g.tipo === tipoFilter;
      const coincideEstado =
        activoFilter === undefined ||
        (activoFilter === 'true' ? g.activo : !g.activo);
      return coincideTexto && coincideTipo && coincideEstado;
    });

    list = [...list].sort((a, b) => {
      let va;
      let vb;
      if (sortBy === 'tipo') {
        va = a.tipo ?? 'zzz';
        vb = b.tipo ?? 'zzz';
      } else if (sortBy === 'activo') {
        va = a.activo ? 1 : 0;
        vb = b.activo ? 1 : 0;
      } else {
        va = a.nombre.toLowerCase();
        vb = b.nombre.toLowerCase();
      }
      if (va < vb) return sortDir === 'asc' ? -1 : 1;
      if (va > vb) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [activoFilter, guarniciones, search, sortBy, sortDir, tipoFilter]);

  const totalPages = Math.max(1, Math.ceil(filtradas.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginadas = filtradas.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const filtrosActivos = hayFiltroActivo({ search, activoFilter, tipoFilter });
  const emptyState = textoEstadoGuarniciones({
    search,
    activoFilter,
    tipoFilter,
    totalBase: guarniciones.length,
  });

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

  const startEdit = (guarnicion) => {
    setEditError('');
    setDetalle(null);
    setEditando({ id: guarnicion.id, nombre: guarnicion.nombre, tipo: guarnicion.tipo });
  };
  const limpiarFiltros = () => setSearchParams(new URLSearchParams(), { replace: true });

  const handleToggleActivo = async (guarnicion) => {
    try {
      await actualizar.mutateAsync({ id: guarnicion.id, data: { activo: !guarnicion.activo } });
      toast.success(guarnicion.activo ? 'Guarnicion desactivada' : 'Guarnicion activada');
    } catch (err) {
      toast.error(err?.message || 'Error');
    }
  };

  const handleDelete = async (guarnicion) => {
    if (!await confirmar({ titulo: `Eliminar "${guarnicion.nombre}"?`, texto: 'Esta acción no se puede deshacer.', botonConfirmar: 'Sí, eliminar' })) return;
    try {
      await eliminar.mutateAsync(guarnicion.id);
      toast.success('Guarnicion eliminada');
    } catch (err) {
      toast.error(err?.message || 'Error');
    }
  };

  const handleGuardarEdit = async (e) => {
    e.preventDefault();
    if (!editando.nombre.trim()) {
      setEditError('El nombre es obligatorio');
      requestAnimationFrame(() => {
        editNombreRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        editNombreRef.current?.focus({ preventScroll: true });
      });
      return;
    }
    try {
      await actualizar.mutateAsync({
        id: editando.id,
        data: { nombre: editando.nombre.trim(), tipo: editando.tipo || null },
      });
      setEditando(null);
      setEditError('');
      toast.success('Guarnicion actualizada');
    } catch (err) {
      toast.error(err?.message || 'Error');
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 md:space-y-5 md:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-h-[52px]">
          <h1 className="text-2xl font-bold text-gray-900">Guarniciones</h1>
          <p className="mt-0.5 h-5 text-sm text-gray-500">
            {guarniciones.length} guarnicion{guarniciones.length !== 1 ? 'es' : ''}
          </p>
        </div>
        <button type="button" onClick={() => setModalCreate(true)} className="btn-primary flex-shrink-0">+ Nueva guarnicion</button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">Buscar</span>
          <input
            type="text"
            value={search}
            onChange={(e) => updateParams({ search: e.target.value, page: null })}
            placeholder="Buscar guarnicion..."
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

      <div className="rounded-xl border border-gray-100 bg-white">
        <button
          type="button"
          onClick={() => setFiltrosAvanzadosAbiertos((open) => !open)}
          className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-semibold text-gray-700"
        >
          <span>Filtros avanzados</span>
          <span className="text-xs text-gray-500">{filtrosAvanzadosAbiertos ? 'Ocultar' : 'Mostrar'}</span>
        </button>
        {filtrosAvanzadosAbiertos ? (
          <div className="space-y-3 border-t border-gray-100 px-4 py-3">
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
            </div>
            <SortSelect value={`${sortBy}:${sortDir}`} onChange={handleMobileSort} />
          </div>
        ) : null}
      </div>

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : (
          <>
            <div className="divide-y divide-gray-100 md:hidden">
              {paginadas.length === 0 ? (
                <EmptyState
                  titulo={emptyState.titulo}
                  detalle={emptyState.detalle}
                  mostrarLimpiar={filtrosActivos}
                  onLimpiar={limpiarFiltros}
                />
              ) : paginadas.map((guarnicion) => (
                <GuarnicionMobileCard
                  key={guarnicion.id}
                  guarnicion={guarnicion}
                  loading={actualizar.isPending}
                  onOpen={() => setDetalle(guarnicion)}
                  onToggleActivo={handleToggleActivo}
                />
              ))}
            </div>

            <div className="max-h-[520px] overflow-y-auto">
              <table className="hidden w-full text-sm md:table">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-gray-100 bg-gray-50">
                    {[
                      { col: 'nombre', label: 'Nombre' },
                      { col: 'tipo', label: 'Tipo' },
                      { col: 'activo', label: 'Estado' },
                    ].map(({ col, label }) => (
                      <th key={col} className="px-5 py-3 text-left">
                        <button
                          type="button"
                          onClick={() => handleSort(col)}
                          className="flex items-center gap-1 whitespace-nowrap text-xs font-semibold uppercase tracking-wide text-gray-500 transition-colors hover:text-gray-800"
                        >
                          {label} <span className="text-gray-500">{sortBy === col ? (sortDir === 'asc' ? 'up' : 'down') : '-'}</span>
                        </button>
                      </th>
                    ))}
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {paginadas.length === 0 ? (
                    <tr>
                      <td colSpan={4}>
                        <EmptyState
                          titulo={emptyState.titulo}
                          detalle={emptyState.detalle}
                          mostrarLimpiar={filtrosActivos}
                          onLimpiar={limpiarFiltros}
                        />
                      </td>
                    </tr>
                  ) : paginadas.map((g) => (
                    <tr key={g.id} onClick={() => setDetalle(g)} className="group cursor-pointer transition-colors hover:bg-gray-50/80">
                      <td className="px-5 py-3.5">
                        {editando?.id === g.id ? (
                          <form onSubmit={handleGuardarEdit} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <div>
                              <input
                                ref={editNombreRef}
                                autoFocus
                                value={editando.nombre}
                                onChange={(e) => {
                                  setEditando((ed) => ({ ...ed, nombre: e.target.value }));
                                  setEditError('');
                                }}
                                aria-invalid={Boolean(editError)}
                                className={`w-full rounded-lg border px-2 py-1 text-sm outline-none focus:ring-2 focus:ring-brand-500 sm:w-56 ${
                                  editError ? 'border-red-400 bg-red-50' : 'border-gray-200'
                                }`}
                              />
                              {editError && <p className="mt-1 text-xs text-red-500">{editError}</p>}
                            </div>
                            <select
                              value={editando.tipo ?? ''}
                              onChange={(e) => setEditando((ed) => ({ ...ed, tipo: e.target.value || null }))}
                              className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs outline-none focus:ring-2 focus:ring-brand-500"
                            >
                              <option value="">Sin tipo</option>
                              <option value="caliente">Caliente</option>
                              <option value="fria">Fria</option>
                            </select>
                            <button type="submit" className="text-xs font-semibold text-brand-700">Guardar</button>
                            <button type="button" onClick={() => { setEditando(null); setEditError(''); }} className="text-xs text-gray-500">Cancelar</button>
                          </form>
                        ) : <span className="font-medium text-gray-900">{g.nombre}</span>}
                      </td>
                      <td className="px-5 py-3.5">
                        <TipoBadge tipo={g.tipo} />
                      </td>
                      <td className="px-5 py-3.5" onClick={(e) => e.stopPropagation()}>
                        <EstadoBadge
                          activo={g.activo}
                          disabled={actualizar.isPending}
                          onClick={() => handleToggleActivo(g)}
                        />
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <IconActionButton label={`Ver detalle de ${g.nombre}`} tooltip="Ver detalle" onClick={() => setDetalle(g)}>
                            <PencilIcon />
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

      {totalPages > 1 ? (
        <div className="flex items-center justify-between text-sm">
          <p className="text-gray-500">Página {safePage} de {totalPages}</p>
          <div className="flex gap-2">
            <button type="button" onClick={() => updateParams({ page: safePage - 1 > 1 ? safePage - 1 : null })} disabled={safePage <= 1} className="btn-secondary text-xs disabled:opacity-40">Anterior</button>
            <button type="button" onClick={() => updateParams({ page: safePage + 1 })} disabled={safePage >= totalPages} className="btn-secondary text-xs disabled:opacity-40">Siguiente</button>
          </div>
        </div>
      ) : null}

      <GuarnicionesPanel modalOpen={modalCreate} onModalClose={() => setModalCreate(false)} />

      <SideDrawer open={!!detalle} onClose={() => setDetalle(null)} title="Detalle de guarnicion" width="md">
        {detalle ? (
          <div className="flex h-full flex-col p-5">
            <div className="flex-1 space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Guarnicion</p>
                <h2 className="mt-1 text-xl font-bold text-gray-900">{detalle.nombre}</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <TipoBadge tipo={detalle.tipo} />
                <span className={`badge ${detalle.activo ? 'bg-brand-50 text-brand-700' : 'bg-gray-100 text-gray-500'}`}>
                  {detalle.activo ? 'Activa' : 'Inactiva'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleToggleActivo(detalle)}
                disabled={actualizar.isPending}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {detalle.activo ? 'Desactivar guarnicion' : 'Activar guarnicion'}
              </button>
            </div>
            <div className="space-y-3 border-t border-gray-100 pt-4">
              <button type="button" onClick={() => startEdit(detalle)} className="btn-primary w-full">
                Editar guarnicion
              </button>
              <button type="button" onClick={() => setDetalle(null)} className="btn-secondary w-full">
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => { const actual = detalle; setDetalle(null); handleDelete(actual); }}
                className="w-full rounded-lg border border-red-100 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
              >
                Eliminar guarnicion
              </button>
            </div>
          </div>
        ) : null}
      </SideDrawer>
    </div>
  );
}
