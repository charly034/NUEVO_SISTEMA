import { useCallback, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useViandas, useUpdateVianda } from '../hooks/useViandas.js';
import ViandaPanel from '../components/platos/ViandaPanel.jsx';
import Spinner from '../components/ui/Spinner.jsx';
import SideDrawer from '../components/ui/SideDrawer.jsx';
import { toast } from '../lib/toast.js';

const ESTADO_FILTROS = [
  { label: 'Activas', value: 'true' },
  { label: 'Todas', value: undefined },
  { label: 'Inactivas', value: 'false' },
];

const PAGE_SIZE = 20;

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

function composicionTexto(vianda) {
  const partes = [];
  if (vianda.guarnicion_nombre) partes.push(vianda.guarnicion_nombre);
  else if (!vianda.guarnicion_id) partes.push('sin guarnición');
  if (vianda.salsa_nombre) partes.push(`salsa ${vianda.salsa_nombre}`);
  else if (vianda.salsa_libre) partes.push('salsa a elección');
  return partes.length > 0 ? partes.join(' + ') : 'solo el plato';
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

function EstadoBadge({ activo }) {
  return (
    <span className={`badge ${activo ? 'bg-brand-50 text-brand-700' : 'bg-gray-100 text-gray-500'}`}>
      {activo ? 'Activa' : 'Inactiva'}
    </span>
  );
}

function ViandaMobileCard({ vianda, onOpen }) {
  return (
    <button type="button" onClick={onOpen} className="flex w-full flex-col gap-1.5 bg-white px-4 py-3.5 text-left">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold leading-snug text-gray-900">{vianda.nombre_vianda}</p>
        <EstadoBadge activo={vianda.activo} />
      </div>
      <p className="text-xs text-gray-500">{composicionTexto(vianda)}</p>
      <p className="text-xs text-gray-400">{vianda.empresa_nombre || 'Global (todas las empresas)'}</p>
    </button>
  );
}

export default function Viandas() {
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get('search') ?? '';
  const activoFilter = leerActivo(searchParams.get('activo'));
  const page = leerEnteroPositivo(searchParams.get('page'), 1);

  const { data: viandas = [], isLoading } = useViandas({ activo: activoFilter });
  const actualizar = useUpdateVianda();

  const [panelCrear, setPanelCrear] = useState(false);
  const [panelEditar, setPanelEditar] = useState(null);
  const [detalle, setDetalle] = useState(null);

  const updateParams = useCallback((changes) => {
    const next = new URLSearchParams(searchParams);
    Object.entries(changes).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') next.delete(key);
      else next.set(key, String(value));
    });
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const filtradas = useMemo(() => {
    if (!search) return viandas;
    const term = search.toLowerCase();
    return viandas.filter((v) =>
      v.nombre_vianda?.toLowerCase().includes(term) ||
      v.plato_nombre?.toLowerCase().includes(term) ||
      v.empresa_nombre?.toLowerCase().includes(term)
    );
  }, [viandas, search]);

  const totalPages = Math.max(1, Math.ceil(filtradas.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const paginadas = filtradas.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const limpiarFiltros = () => setSearchParams(new URLSearchParams(), { replace: true });
  const filtrosActivos = Boolean(search || activoFilter !== 'true');

  const handleToggleActivo = async (vianda) => {
    try {
      await actualizar.mutateAsync({ id: vianda.id, data: { activo: !vianda.activo } });
      toast.success(vianda.activo ? 'Vianda desactivada' : 'Vianda activada');
    } catch (err) {
      toast.error(err?.message || 'No se pudo actualizar');
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4 p-4 md:space-y-5 md:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="min-h-[52px]">
          <h1 className="text-2xl font-bold text-gray-900">Viandas</h1>
          <p className="mt-0.5 h-5 text-sm text-gray-500">
            {viandas.length} vianda{viandas.length !== 1 ? 's' : ''} — la unidad que armás en el menú semanal para las empresas
          </p>
        </div>
        <button type="button" onClick={() => setPanelCrear(true)} className="btn-primary flex-shrink-0">+ Nueva vianda</button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <input
            type="text"
            value={search}
            onChange={(e) => updateParams({ search: e.target.value, page: null })}
            placeholder="Buscar por plato, vianda o empresa..."
            className="w-full rounded-lg border border-gray-300 py-2 px-4 text-sm outline-none transition-colors focus:border-brand-500 focus:ring-2 focus:ring-brand-500"
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

      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-16"><Spinner size="lg" /></div>
        ) : (
          <>
            <div className="divide-y divide-gray-100 md:hidden">
              {filtradas.length === 0 ? (
                <EmptyState
                  titulo="No se encontraron viandas."
                  detalle={viandas.length === 0 ? 'Cuando crees la primera vianda, va a aparecer acá.' : 'Probá limpiando los filtros activos.'}
                  mostrarLimpiar={filtrosActivos}
                  onLimpiar={limpiarFiltros}
                />
              ) : paginadas.map((v) => (
                <ViandaMobileCard key={v.id} vianda={v} onOpen={() => setDetalle(v)} />
              ))}
            </div>

            <div className="max-h-[560px] overflow-y-auto">
              <table className="hidden w-full text-sm md:table">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Vianda</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Composición</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Empresa</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">Estado</th>
                    <th className="px-5 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtradas.length === 0 ? (
                    <tr>
                      <td colSpan={5}>
                        <EmptyState
                          titulo="No se encontraron viandas."
                          detalle={viandas.length === 0 ? 'Cuando crees la primera vianda, va a aparecer acá.' : 'Probá limpiando los filtros activos.'}
                          mostrarLimpiar={filtrosActivos}
                          onLimpiar={limpiarFiltros}
                        />
                      </td>
                    </tr>
                  ) : paginadas.map((v) => (
                    <tr key={v.id} onClick={() => setDetalle(v)} className="group cursor-pointer transition-colors hover:bg-gray-50/80">
                      <td className="px-5 py-3.5">
                        <p className="font-medium text-gray-900">{v.nombre_vianda}</p>
                        <p className="text-xs text-gray-500">{v.plato_nombre}</p>
                      </td>
                      <td className="px-5 py-3.5 text-gray-600">{composicionTexto(v)}</td>
                      <td className="px-5 py-3.5 text-gray-600">{v.empresa_nombre || 'Global'}</td>
                      <td className="px-5 py-3.5"><EstadoBadge activo={v.activo} /></td>
                      <td className="px-5 py-3.5" />
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

      {panelCrear && <ViandaPanel onClose={() => setPanelCrear(false)} />}
      {panelEditar && <ViandaPanel vianda={panelEditar} onClose={() => setPanelEditar(null)} />}

      <SideDrawer open={!!detalle} onClose={() => setDetalle(null)} title="Detalle de vianda" width="md">
        {detalle ? (
          <div className="flex h-full flex-col p-5">
            <div className="flex-1 space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Vianda</p>
                <h2 className="mt-1 text-xl font-bold text-gray-900">{detalle.nombre_vianda}</h2>
                <p className="mt-1 text-sm text-gray-500">{detalle.plato_nombre}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <EstadoBadge activo={detalle.activo} />
                {detalle.nombre_generado && <span className="badge bg-gray-100 text-gray-500">Nombre automático</span>}
              </div>
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Guarnición</dt>
                  <dd className="mt-1 text-gray-800">{detalle.guarnicion_nombre || 'Sin guarnición'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Salsa</dt>
                  <dd className="mt-1 text-gray-800">
                    {detalle.salsa_nombre || (detalle.salsa_libre ? 'A elección del empleado' : 'Sin salsa')}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">Empresa</dt>
                  <dd className="mt-1 text-gray-800">{detalle.empresa_nombre || 'Global (todas las empresas)'}</dd>
                </div>
              </dl>
            </div>
            <div className="space-y-3 border-t border-gray-100 pt-4">
              <button
                type="button"
                onClick={() => { const actual = detalle; setDetalle(null); setPanelEditar(actual); }}
                className="btn-primary w-full"
              >
                Editar vianda
              </button>
              <button type="button" onClick={() => setDetalle(null)} className="btn-secondary w-full">
                Cerrar
              </button>
              <button
                type="button"
                onClick={() => { const actual = detalle; setDetalle(null); handleToggleActivo(actual); }}
                disabled={actualizar.isPending}
                className="w-full rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {detalle.activo ? 'Desactivar vianda' : 'Activar vianda'}
              </button>
            </div>
          </div>
        ) : null}
      </SideDrawer>
    </div>
  );
}
