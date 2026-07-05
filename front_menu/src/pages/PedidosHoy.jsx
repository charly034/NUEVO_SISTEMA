import { useEffect, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { usePedidos } from '../hooks/usePedidos.js';
import { useEmpresas } from '../hooks/useEmpresas.js';
import Spinner from '../components/ui/Spinner.jsx';

const DIAS_ORDEN = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
const PLATO_SIN_ASIGNAR = 'Sin plato asignado';
const VALOR_TODOS = '';

function texto(valor, fallback = '') {
  return valor == null ? fallback : String(valor);
}

function getLunes() {
  const hoy = new Date();
  const diff = hoy.getDay() === 0 ? -6 : 1 - hoy.getDay();
  const l = new Date(hoy);
  l.setDate(hoy.getDate() + diff);
  return l.toISOString().split('T')[0];
}

function getDiaHoy() {
  return DIAS_ORDEN[(new Date().getDay() + 6) % 7];
}

function formatFechaLarga(date) {
  return date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}

function getNombrePlato(item) {
  return item?.plato_nombre || PLATO_SIN_ASIGNAR;
}

function esSinPlato(nombre) {
  return nombre === PLATO_SIN_ASIGNAR;
}

function PlatoNombre({ nombre, compacto = false }) {
  if (!esSinPlato(nombre)) return <>{nombre}</>;

  return (
    <span className={`inline-flex items-center gap-1 font-bold text-red-800 print:text-black ${compacto ? '' : 'rounded border border-red-200 bg-red-50 px-2 py-1 print:border-black print:bg-white'}`}>
      <span aria-hidden="true">⚠</span>
      <span>Sin plato asignado</span>
    </span>
  );
}

function getPlanNombre(pedido) {
  return pedido?.plan_nombre || 'Plan sin snapshot';
}

function getPlanDetalle(pedido) {
  const partes = [];
  if (pedido?.plan_gramaje_min) {
    partes.push(`${pedido.plan_gramaje_min}-${pedido.plan_gramaje_max || pedido.plan_gramaje_min} g`);
  }
  partes.push(pedido?.plan_incluye_postre ? 'con postre' : 'sin postre');
  partes.push(pedido?.plan_incluye_bebida ? 'con bebida' : 'sin bebida');
  return partes.join(' · ');
}

function getTamanoPlan(pedido) {
  if (pedido?.plan_gramaje_min) return `${pedido.plan_gramaje_min} g`;
  return 'Sin tamaño';
}

function getClavePreparacion(item) {
  return [
    item?.plato_id || texto(getNombrePlato(item)).trim().toLowerCase() || 'sin-plato',
    item?.opcion || 'Fijo',
    item?.guarnicion_id || texto(item?.guarnicion_nombre).trim().toLowerCase() || '',
  ].join('|');
}

function ordenarTamanos([a], [b]) {
  const na = parseInt(a, 10);
  const nb = parseInt(b, 10);
  if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
  return texto(a).localeCompare(texto(b));
}

function resumenTamanos(tamanos = {}) {
  return Object.entries(tamanos)
    .sort(ordenarTamanos)
    .map(([tamano, cantidad]) => `${cantidad} de ${tamano}`)
    .join(' · ');
}

function ordenarPedidosDia(a, b) {
  return texto(a.empresa_nombre).localeCompare(texto(b.empresa_nombre))
    || texto(a.empleado_apellido).localeCompare(texto(b.empleado_apellido));
}

export default function PedidosHoy() {
  const hoy = new Date();
  const diaHoy = getDiaHoy();
  const lunes = getLunes();
  const [searchParams, setSearchParams] = useSearchParams();
  const empresaFiltro = searchParams.get('empresa') || VALOR_TODOS;
  const platoFiltro = searchParams.get('plato') || VALOR_TODOS;

  const { data: pedidosData, isLoading } = usePedidos({ semana_inicio: lunes, limit: 500 });
  const { data: empresas = [] } = useEmpresas();

  const pedidos = useMemo(() => pedidosData?.pedidos ?? pedidosData ?? [], [pedidosData]);

  const pedidosDia = useMemo(() => {
    return pedidos
      .filter(p => p.estado !== 'cancelado')
      .map(p => ({
        ...p,
        itemHoy: (p.items || []).find(i => i.dia === diaHoy),
      }))
      .filter(p => p.itemHoy)
      .sort(ordenarPedidosDia);
  }, [pedidos, diaHoy]);

  const pedidosEmpresa = useMemo(() => {
    return pedidosDia.filter(p => !empresaFiltro || p.empresa_nombre === empresaFiltro);
  }, [pedidosDia, empresaFiltro]);

  const platosDisponiblesHoy = useMemo(() => {
    const nombres = pedidosEmpresa.map(p => getNombrePlato(p.itemHoy)).filter(Boolean);
    return [...new Set(nombres)].sort((a, b) => {
      if (esSinPlato(a)) return -1;
      if (esSinPlato(b)) return 1;
      return a.localeCompare(b);
    });
  }, [pedidosEmpresa]);

  useEffect(() => {
    if (isLoading) return;
    if (!platoFiltro || platosDisponiblesHoy.includes(platoFiltro)) return;
    const params = new URLSearchParams(searchParams);
    params.delete('plato');
    setSearchParams(params, { replace: true });
  }, [isLoading, platoFiltro, platosDisponiblesHoy, searchParams, setSearchParams]);

  const pedidosHoy = useMemo(() => {
    return pedidosEmpresa
      .filter(p => !platoFiltro || getNombrePlato(p.itemHoy) === platoFiltro)
      .sort(ordenarPedidosDia);
  }, [pedidosEmpresa, platoFiltro]);

  const filtrosActivos = Boolean(empresaFiltro || platoFiltro);
  const noHayPedidosDia = pedidosDia.length === 0;
  const sinCoincidenciasFiltros = pedidosDia.length > 0 && pedidosHoy.length === 0 && filtrosActivos;
  const esFinDeSemana = diaHoy === 'sabado' || diaHoy === 'domingo';

  const actualizarFiltros = (siguiente) => {
    const empresa = siguiente.empresa ?? empresaFiltro;
    const plato = siguiente.plato ?? platoFiltro;
    const params = new URLSearchParams(searchParams);

    if (empresa) params.set('empresa', empresa);
    else params.delete('empresa');

    if (plato) params.set('plato', plato);
    else params.delete('plato');

    setSearchParams(params, { replace: true });
  };

  const limpiarFiltros = () => {
    setSearchParams({}, { replace: true });
  };

  const porEmpresa = useMemo(() => {
    const mapa = new Map();
    for (const p of pedidosHoy) {
      const empresa = texto(p.empresa_nombre, 'Sin empresa');
      if (!mapa.has(empresa)) mapa.set(empresa, []);
      mapa.get(empresa).push(p);
    }
    return [...mapa.entries()];
  }, [pedidosHoy]);

  const resumenPlatos = useMemo(() => {
    const mapa = new Map();
    for (const p of pedidosHoy) {
      const plato = texto(getNombrePlato(p.itemHoy), PLATO_SIN_ASIGNAR);
      const key = getClavePreparacion(p.itemHoy);
      const actual = mapa.get(key) || {
        opcion: p.itemHoy.opcion || 'Fijo',
        plato,
        guarnicion: p.itemHoy.guarnicion_nombre || '',
        tamanos: {},
        postres: 0,
        bebidas: 0,
        cantidad: 0,
        sinPlato: esSinPlato(plato),
      };
      actual.cantidad += 1;
      const tamano = getTamanoPlan(p);
      actual.tamanos[tamano] = (actual.tamanos[tamano] || 0) + 1;
      if (p.plan_incluye_postre) actual.postres += 1;
      if (p.plan_incluye_bebida) actual.bebidas += 1;
      actual.plan = [actual.guarnicion ? `+ ${actual.guarnicion}` : null, resumenTamanos(actual.tamanos)].filter(Boolean).join(' · ');
      actual.planDetalle = `Postres: ${actual.postres} · Bebidas: ${actual.bebidas}`;
      mapa.set(key, actual);
    }
    return [...mapa.values()].sort((a, b) => {
      if (a.sinPlato !== b.sinPlato) return a.sinPlato ? -1 : 1;
      return b.cantidad - a.cantidad || texto(a.plato).localeCompare(texto(b.plato));
    });
  }, [pedidosHoy]);

  const resumenDia = useMemo(() => {
    return pedidosHoy.reduce((acc, p) => {
      acc.postres += p.plan_incluye_postre ? 1 : 0;
      acc.bebidas += p.plan_incluye_bebida ? 1 : 0;
      const tamano = getTamanoPlan(p);
      acc.tamanos[tamano] = (acc.tamanos[tamano] || 0) + 1;
      return acc;
    }, { postres: 0, bebidas: 0, tamanos: {} });
  }, [pedidosHoy]);

  const resumenGuarniciones = useMemo(() => {
    const mapa = new Map();
    for (const p of pedidosHoy) {
      const nombre = p.itemHoy.guarnicion_nombre;
      if (!nombre) continue;
      mapa.set(nombre, (mapa.get(nombre) || 0) + 1);
    }
    return [...mapa.entries()].sort((a, b) => b[1] - a[1]);
  }, [pedidosHoy]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 print:px-0 print:py-0">
      <div className="mb-6 flex flex-col justify-between gap-3 print:hidden sm:flex-row sm:items-center">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-brand-700">La Quinta · Sistema de menús</p>
          <h1 className="text-2xl font-bold text-gray-900">Pedidos de hoy</h1>
          <p className="text-sm text-gray-600 capitalize">{formatFechaLarga(hoy)}</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div>
            <label htmlFor="pedidos-hoy-empresa" className="sr-only">Filtrar por empresa</label>
            <select
              id="pedidos-hoy-empresa"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm sm:w-auto"
              value={empresaFiltro}
              onChange={e => actualizarFiltros({ empresa: e.target.value, plato: VALOR_TODOS })}
            >
              <option value="">Todas las empresas</option>
              {empresas.map(e => <option key={e.id} value={e.nombre}>{e.nombre}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="pedidos-hoy-plato" className="sr-only">Filtrar por plato</label>
            <select
              id="pedidos-hoy-plato"
              className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm sm:w-auto"
              value={platoFiltro}
              onChange={e => actualizarFiltros({ plato: e.target.value })}
            >
              <option value="">Todos los platos</option>
              {platosDisponiblesHoy.map(nombre => <option key={nombre} value={nombre}>{esSinPlato(nombre) ? '⚠ Sin plato asignado' : nombre}</option>)}
            </select>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-brand-700 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-800"
            aria-label="Imprimir hoja de pedidos de hoy"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4" aria-hidden="true">
              <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
              <rect x="6" y="14" width="12" height="8"/>
            </svg>
            Imprimir
          </button>
        </div>
      </div>

      <div className="mb-6 hidden print:block">
        <h1 className="text-xl font-bold">La Quinta · Pedidos del dia</h1>
        <p className="text-sm capitalize">{formatFechaLarga(hoy)}</p>
        {empresaFiltro && <p className="mt-1 text-sm font-semibold">Empresa: {empresaFiltro}</p>}
        {platoFiltro && <p className="mt-1 text-sm font-semibold">Plato: {platoFiltro}</p>}
      </div>

      {isLoading && <div className="flex justify-center py-20"><Spinner /></div>}

      {!isLoading && (noHayPedidosDia || sinCoincidenciasFiltros) && (
        <div className="py-20 text-center text-gray-500">
          <p className="mb-3 text-4xl" aria-hidden="true">📋</p>
          {sinCoincidenciasFiltros ? (
            <>
              <p className="font-semibold text-gray-800">Ningun pedido coincide con los filtros seleccionados</p>
              <p className="mt-1 text-sm text-gray-600">Hay pedidos para este dia, pero no para la combinacion elegida.</p>
              <button
                type="button"
                onClick={limpiarFiltros}
                className="mt-4 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                Limpiar filtros
              </button>
            </>
          ) : (
            <>
              <p className="font-semibold text-gray-800">Sin pedidos para hoy</p>
              {esFinDeSemana
                ? <p className="mt-1 text-sm text-gray-600">Es fin de semana.</p>
                : <p className="mt-1 text-sm text-gray-600">No hay pedidos registrados para este dia.</p>
              }
            </>
          )}
        </div>
      )}

      {!isLoading && pedidosHoy.length > 0 && (
        <>
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 print:border print:border-gray-300 print:bg-white">
            <h2 className="mb-2 text-sm font-bold text-amber-900 print:text-gray-700">Resumen de produccion</h2>
            <div className="flex flex-wrap gap-2">
              {resumenPlatos.map((item) => (
                <span
                  key={`${item.opcion}-${item.plato}-${item.plan}`}
                  className={`inline-flex items-center gap-1.5 rounded-full border bg-white px-3 py-1 text-sm font-medium print:border-gray-300 print:text-gray-800 ${
                    item.sinPlato
                      ? 'border-red-300 text-red-900 ring-1 ring-red-200 print:border-black print:ring-0'
                      : 'border-amber-200 text-amber-900'
                  }`}
                >
                  <span className={`font-bold print:text-gray-900 ${item.sinPlato ? 'text-red-800' : 'text-amber-700'}`}>{item.cantidad}×</span>
                  <span className={`rounded px-1.5 py-0.5 text-[11px] font-bold print:bg-white print:text-gray-900 ${item.sinPlato ? 'bg-red-100 text-red-800' : 'bg-amber-100 text-amber-800'}`}>{item.opcion}</span>
                  <PlatoNombre nombre={item.plato} compacto />
                  <span className="text-xs text-amber-800 print:text-gray-700">· {item.plan} ({item.planDetalle})</span>
                </span>
              ))}
            </div>
            {resumenGuarniciones.length > 0 && (
              <div className="mt-3 border-t border-amber-200 pt-3 print:border-gray-200">
                <p className="mb-2 text-xs font-bold uppercase tracking-wide text-amber-800 print:text-gray-600">Guarniciones</p>
                <div className="flex flex-wrap gap-2">
                  {resumenGuarniciones.map(([guarnicion, cant]) => (
                    <span key={guarnicion} className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-white px-3 py-1 text-sm font-medium text-amber-900 print:border-gray-300 print:text-gray-800">
                      <span className="font-bold text-amber-700 print:text-gray-900">{cant}×</span> {guarnicion}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <p className="mt-2 text-xs font-medium text-amber-800 print:text-gray-600">
              Total: {pedidosHoy.length} pedido{pedidosHoy.length !== 1 ? 's' : ''} · {resumenTamanos(resumenDia.tamanos)} · Postres: {resumenDia.postres} · Bebidas: {resumenDia.bebidas}
            </p>
          </div>

          <div className="space-y-6">
            {porEmpresa.map(([empresa, pedidos]) => (
              <div key={empresa} className="break-inside-avoid">
                <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-gray-600">{empresa} · {pedidos.length} pedido{pedidos.length !== 1 ? 's' : ''}</h2>
                <div className="overflow-hidden rounded-lg border border-gray-200 print:border-gray-300">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 print:bg-gray-100">
                        <th className="w-1/3 px-4 py-2.5 text-left font-semibold text-gray-700">Empleado</th>
                        <th className="px-4 py-2.5 text-left font-semibold text-gray-700">Plan</th>
                        <th className="px-4 py-2.5 text-left font-semibold text-gray-700">Plato</th>
                        <th className="px-4 py-2.5 text-left font-semibold text-gray-700">Guarnicion</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 print:divide-gray-200">
                      {pedidos.map(p => {
                        const nombrePlato = getNombrePlato(p.itemHoy);
                        return (
                          <tr key={p.id} className={`hover:bg-gray-50 print:hover:bg-transparent ${esSinPlato(nombrePlato) ? 'bg-red-50/70 print:bg-white' : ''}`}>
                            <td className="px-4 py-2.5 font-medium text-gray-900">
                              {p.empleado_apellido}, {p.empleado_nombre}
                            </td>
                            <td className="px-4 py-2.5 text-gray-700">
                              <span className="block font-medium text-gray-900">{getPlanNombre(p)}</span>
                              <span className="block text-xs font-medium text-gray-600">{getPlanDetalle(p)}</span>
                            </td>
                            <td className="px-4 py-2.5 text-gray-800"><PlatoNombre nombre={nombrePlato} /></td>
                            <td className="px-4 py-2.5 text-gray-700">{p.itemHoy.guarnicion_nombre || '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <style>{`
        @media print {
          body * { visibility: hidden; }
          .max-w-4xl, .max-w-4xl * { visibility: visible; }
          .max-w-4xl { position: absolute; top: 0; left: 0; width: 100%; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  );
}
