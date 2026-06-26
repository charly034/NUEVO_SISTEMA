import { useMemo, useState } from 'react';
import { usePedidos } from '../hooks/usePedidos.js';
import { useEmpresas } from '../hooks/useEmpresas.js';
import Spinner from '../components/ui/Spinner.jsx';

const DIAS_ORDEN = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];

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

export default function PedidosHoy() {
  const hoy = new Date();
  const diaHoy = getDiaHoy();
  const lunes = getLunes();
  const [empresaFiltro, setEmpresaFiltro] = useState('');

  const { data: pedidosData, isLoading } = usePedidos({ semana_inicio: lunes, limit: 500 });
  const { data: empresas = [] } = useEmpresas();

  const pedidos = useMemo(() => pedidosData?.pedidos ?? pedidosData ?? [], [pedidosData]);

  const pedidosHoy = useMemo(() => {
    return pedidos
      .filter(p => p.estado !== 'cancelado')
      .filter(p => !empresaFiltro || p.empresa_nombre === empresaFiltro)
      .map(p => ({
        ...p,
        itemHoy: (p.items || []).find(i => i.dia === diaHoy),
      }))
      .filter(p => p.itemHoy)
      .sort((a, b) => (a.empresa_nombre || '').localeCompare(b.empresa_nombre || '') || (a.empleado_apellido || '').localeCompare(b.empleado_apellido || ''));
  }, [pedidos, diaHoy, empresaFiltro]);

  const porEmpresa = useMemo(() => {
    const mapa = new Map();
    for (const p of pedidosHoy) {
      if (!mapa.has(p.empresa_nombre)) mapa.set(p.empresa_nombre, []);
      mapa.get(p.empresa_nombre).push(p);
    }
    return [...mapa.entries()];
  }, [pedidosHoy]);

  const resumenPlatos = useMemo(() => {
    const mapa = new Map();
    for (const p of pedidosHoy) {
      const key = p.itemHoy.plato_nombre;
      mapa.set(key, (mapa.get(key) || 0) + 1);
    }
    return [...mapa.entries()].sort((a, b) => b[1] - a[1]);
  }, [pedidosHoy]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 print:px-0 print:py-0">

      {/* Header — oculto al imprimir */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pedidos de hoy</h1>
          <p className="text-sm text-gray-500 capitalize">{formatFechaLarga(hoy)}</p>
        </div>
        <div className="flex gap-2">
          <select
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white"
            value={empresaFiltro}
            onChange={e => setEmpresaFiltro(e.target.value)}
          >
            <option value="">Todas las empresas</option>
            {empresas.map(e => <option key={e.id} value={e.nombre}>{e.nombre}</option>)}
          </select>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-4 py-2 bg-brand-700 text-white text-sm font-semibold rounded-lg hover:bg-brand-800"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4">
              <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
              <rect x="6" y="14" width="12" height="8"/>
            </svg>
            Imprimir
          </button>
        </div>
      </div>

      {/* Header de impresión */}
      <div className="hidden print:block mb-6">
        <h1 className="text-xl font-bold">🌿 La Quinta — Pedidos del día</h1>
        <p className="text-sm capitalize">{formatFechaLarga(hoy)}</p>
        {empresaFiltro && <p className="text-sm font-semibold mt-1">Empresa: {empresaFiltro}</p>}
      </div>

      {isLoading && <div className="flex justify-center py-20"><Spinner /></div>}

      {!isLoading && pedidosHoy.length === 0 && (
        <div className="text-center py-20 text-gray-400">
          <p className="text-4xl mb-3">📋</p>
          <p className="font-medium">Sin pedidos para hoy</p>
          {diaHoy === 'sabado' || diaHoy === 'domingo'
            ? <p className="text-sm mt-1">Es fin de semana.</p>
            : <p className="text-sm mt-1">No hay pedidos registrados para este día.</p>
          }
        </div>
      )}

      {!isLoading && pedidosHoy.length > 0 && (
        <>
          {/* Resumen de platos */}
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 print:border print:border-gray-300 print:bg-white">
            <h2 className="text-sm font-bold text-amber-800 mb-2 print:text-gray-700">Resumen de producción</h2>
            <div className="flex flex-wrap gap-2">
              {resumenPlatos.map(([plato, cant]) => (
                <span key={plato} className="inline-flex items-center gap-1.5 bg-white border border-amber-200 text-amber-900 text-sm font-medium px-3 py-1 rounded-full print:border-gray-300 print:text-gray-800">
                  <span className="font-bold text-amber-700 print:text-gray-900">{cant}×</span> {plato}
                </span>
              ))}
            </div>
            <p className="text-xs text-amber-600 mt-2 print:text-gray-500">
              Total: {pedidosHoy.length} pedido{pedidosHoy.length !== 1 ? 's' : ''}
            </p>
          </div>

          {/* Lista por empresa */}
          <div className="space-y-6">
            {porEmpresa.map(([empresa, pedidos]) => (
              <div key={empresa} className="break-inside-avoid">
                <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wide mb-2">{empresa} · {pedidos.length} pedido{pedidos.length !== 1 ? 's' : ''}</h2>
                <div className="border border-gray-200 rounded-xl overflow-hidden print:border-gray-300">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 print:bg-gray-100">
                        <th className="text-left px-4 py-2.5 font-semibold text-gray-600 w-1/3">Empleado</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Plato</th>
                        <th className="text-left px-4 py-2.5 font-semibold text-gray-600">Guarnición</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 print:divide-gray-200">
                      {pedidos.map(p => (
                        <tr key={p.id} className="hover:bg-gray-50 print:hover:bg-transparent">
                          <td className="px-4 py-2.5 font-medium text-gray-900">
                            {p.empleado_apellido}, {p.empleado_nombre}
                          </td>
                          <td className="px-4 py-2.5 text-gray-700">{p.itemHoy.plato_nombre}</td>
                          <td className="px-4 py-2.5 text-gray-500">{p.itemHoy.guarnicion_nombre || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* CSS de impresión */}
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
