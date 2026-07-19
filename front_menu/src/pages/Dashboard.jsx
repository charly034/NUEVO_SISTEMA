import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useEmpresas } from '../hooks/useEmpresas.js';
import { useEmpleados } from '../hooks/useEmpleados.js';
import { useMenusSemanales } from '../hooks/useMenus.js';
import { usePedidos } from '../hooks/usePedidos.js';
import {
  fechaISOEnZona,
  lunesDeSemanaISO,
  useFechaOperativa,
} from '../hooks/useFechaOperativa.js';
import { formatFechaLarga as formatFecha, formatRangoSemana } from '../lib/fechas.js';
import { DIAS_LABORALES, DIA_ABREV } from '../lib/dias.js';

const ESTADO_LABEL = {
  borrador: { label: 'Borrador', color: 'bg-amber-100 text-amber-700' },
  publicado: { label: 'Publicado', color: 'bg-brand-100 text-brand-700' },
  cerrado: { label: 'Cerrado', color: 'bg-gray-100 text-gray-500' },
};

// Barra de calor: cuanto más pedidos, más larga y más oscura.
function heatBar(valor, max) {
  if (!valor) return { width: 0, color: 'bg-gray-200' };
  const ratio = valor / max;
  const width = Math.round(24 + ratio * 48); // 24–72px
  const color =
    ratio >= 0.85 ? 'bg-brand-600' :
    ratio >= 0.6  ? 'bg-brand-500' :
    ratio >= 0.4  ? 'bg-brand-400' : 'bg-brand-300';
  return { width, color };
}

function KpiCard({ valor, label, sub, to, loading, primary }) {
  const inner = (
    <div className={`rounded-lg border border-gray-200 bg-white p-5 transition-shadow hover:shadow-sm ${primary ? 'border-t-2 border-t-brand-600' : ''}`}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      {loading ? (
        <div className="mt-1.5 h-8 w-14 animate-pulse rounded bg-gray-100" />
      ) : (
        <p className={`mt-1.5 font-mono text-3xl font-semibold tabular-nums ${primary ? 'text-brand-700' : 'text-gray-900'}`}>{valor ?? '—'}</p>
      )}
      {sub && <p className="mt-1 text-[11px] font-medium text-gray-400">{sub}</p>}
    </div>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}

function AccesoRapido({ to, icon, label }) {
  return (
    <Link to={to} className="flex items-center gap-2.5 px-5 py-3 text-sm transition-colors hover:bg-brand-50/50">
      <span className="text-brand-600">{icon}</span>
      <span className="font-medium text-gray-800">{label}</span>
      <span className="ml-auto text-gray-300">→</span>
    </Link>
  );
}

const IconCocina = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
    <path d="M6 2v6a6 6 0 0 0 12 0V2" />
    <path d="M3 22h18" />
    <path d="M12 14v8" />
  </svg>
);

const IconPedidos = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
    <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
    <rect x="9" y="3" width="6" height="4" rx="1" />
    <path d="M9 12h6M9 16h4" />
  </svg>
);

const IconClientes = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
    <path d="M3 21h18M9 8h1m5 0h1M9 12h1m5 0h1M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
  </svg>
);

const IconPlatos = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 3" />
  </svg>
);

export default function Dashboard() {
  const fechaOperativaQuery = useFechaOperativa();
  const fechaOperativa = fechaOperativaQuery.data?.fecha ?? fechaISOEnZona();
  const lunesEsta = lunesDeSemanaISO(fechaOperativa, 0);
  const lunesProxima = lunesDeSemanaISO(fechaOperativa, 1);

  const menusQuery = useMenusSemanales({ page: 1, pageSize: 4 });
  const menus = menusQuery.data?.menus ?? [];
  // Comparar por fecha (YYYY-MM-DD): fecha_inicio viene como timestamp del
  // backend, así que hay que recortar (mismo criterio que menuProximo). Sin
  // fallback a menus[0]: si no hay menú de ESTA semana, menuActual queda null
  // (la UI muestra el estado "sin menú"), en vez de etiquetar como "semana
  // actual" a un menú arbitrario (p.ej. uno futuro que encabeza el orden DESC).
  const menuActual = menus.find(m => m.fecha_inicio?.slice(0, 10) === lunesEsta) ?? null;
  const menuProximo = menus.find(m => m.fecha_inicio?.slice(0, 10) === lunesProxima) ?? null;
  const proximaSinPublicar = !menusQuery.isLoading && (!menuProximo || menuProximo.estado !== 'publicado');

  const pedidosQuery = usePedidos(
    { semana_inicio: lunesEsta, limit: 500 },
    { enabled: Boolean(lunesEsta) }
  );

  const pedidosActivos = useMemo(() => {
    const d = pedidosQuery.data;
    const arr = d?.pedidos ?? d ?? [];
    return arr.filter(p => p.estado !== 'cancelado');
  }, [pedidosQuery.data]);

  const totalPedidos = pedidosActivos.length;

  // Conteo real de viandas pedidas por día (excluye "sin pedido").
  const conteoPorDia = useMemo(() => {
    const c = Object.fromEntries(DIAS_LABORALES.map(d => [d, 0]));
    for (const p of pedidosActivos) {
      for (const item of (p.items ?? [])) {
        if (item.sin_pedido) continue;
        if (c[item.dia] !== undefined) c[item.dia] += 1;
      }
    }
    return c;
  }, [pedidosActivos]);

  const maxDia = Math.max(1, ...DIAS_LABORALES.map(d => conteoPorDia[d]));
  const totalViandas = DIAS_LABORALES.reduce((s, d) => s + conteoPorDia[d], 0);

  const empresasQuery = useEmpresas();
  const empresasActivas = (empresasQuery.data ?? []).filter(e => e.activo).length;

  const clientesQuery = useEmpleados();
  const clientesActivos = (clientesQuery.data ?? []).filter(c => c.activo && c.rol !== 'admin').length;

  const estadoMenu = menuActual ? (ESTADO_LABEL[menuActual.estado] ?? ESTADO_LABEL.borrador) : null;
  const rangoSemana = menuActual ? formatRangoSemana(menuActual.fecha_inicio) : formatRangoSemana(lunesEsta);

  return (
    <div className="min-h-full bg-gray-50">
      {/* Header verde de marca */}
      <header className="flex items-center justify-between bg-brand-700 px-4 py-3.5 md:px-6">
        <div className="flex items-center gap-3">
          <h1 className="text-base font-bold text-white">Dashboard</h1>
          <span className="font-mono text-xs text-brand-200">{formatFecha(fechaOperativa) || 'Hoy'}</span>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="hidden items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold text-white sm:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-brand-300" />
            {menuActual ? 'Semana activa' : 'Sin semana'}
          </span>
          <Link to="/semanas" className="rounded bg-white px-3 py-1.5 text-xs font-bold text-brand-700 hover:bg-brand-50">
            + Nueva semana
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-5 p-4 md:p-6">
        {/* KPIs */}
        <section className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <KpiCard primary valor={totalPedidos} label="Pedidos esta semana" sub="viandas confirmadas" to="/pedidos" loading={pedidosQuery.isLoading} />
          <KpiCard valor={empresasActivas} label="Empresas activas" to="/clientes" loading={empresasQuery.isLoading} />
          <KpiCard valor={clientesActivos} label="Clientes activos" to="/clientes?vista=clientes" loading={clientesQuery.isLoading} />
        </section>

        {/* Alerta */}
        {proximaSinPublicar && (
          <Link to="/semanas" className="flex items-center gap-3 rounded-lg border-l-4 border-amber-500 bg-amber-50 px-4 py-3 transition-shadow hover:shadow-sm">
            <span className="font-mono text-xs font-bold text-amber-600">WARN</span>
            <p className="text-sm text-amber-800">
              <span className="font-semibold">{menuProximo ? 'Menú próxima semana sin publicar' : 'Próxima semana sin menú'}</span>
              {' · '}{formatRangoSemana(lunesProxima)}{' · '}publicalo antes del cierre
            </p>
            <span className="ml-auto text-amber-500">→</span>
          </Link>
        )}

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          {/* Semana actual + tabla de calor */}
          <div className="rounded-lg border border-gray-200 bg-white lg:col-span-2">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
              <p className="text-sm font-bold text-gray-800">Semana actual · {rangoSemana}</p>
              {estadoMenu && (
                <span className={`rounded px-2 py-0.5 text-[11px] font-bold uppercase ${estadoMenu.color}`}>{estadoMenu.label}</span>
              )}
            </div>

            {menusQuery.isLoading ? (
              <div className="space-y-2 p-5">
                {[0, 1, 2, 3, 4].map(i => <div key={i} className="h-6 animate-pulse rounded bg-gray-100" />)}
              </div>
            ) : menuActual ? (
              <>
                <table className="w-full text-left text-sm">
                  <thead className="text-[11px] uppercase tracking-wide text-gray-400">
                    <tr>
                      <th className="px-5 py-2.5 font-medium">Día</th>
                      <th className="px-5 py-2.5 text-right font-medium">Pedidos</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {DIAS_LABORALES.map(dia => {
                      const valor = conteoPorDia[dia];
                      const bar = heatBar(valor, maxDia);
                      return (
                        <tr key={dia}>
                          <td className="px-5 py-3 font-medium text-gray-700">{DIA_ABREV[dia]}</td>
                          <td className="px-5 py-3">
                            <div className="flex items-center justify-end gap-2">
                              <span className={`h-2 rounded-full ${bar.color}`} style={{ width: `${bar.width}px` }} />
                              <span className="w-8 text-right font-mono font-semibold tabular-nums text-gray-900">
                                {pedidosQuery.isLoading ? '·' : valor}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-gray-200 bg-gray-50">
                      <td className="px-5 py-2.5 text-xs font-semibold text-gray-500">Total semana</td>
                      <td className="px-5 py-2.5 text-right font-mono font-bold tabular-nums text-brand-700">
                        {pedidosQuery.isLoading ? '·' : totalViandas}
                      </td>
                    </tr>
                  </tfoot>
                </table>
                <div className="flex gap-2 border-t border-gray-100 px-5 py-3">
                  <Link to={`/semanas/${menuActual.id}/resumen`} className="rounded bg-brand-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-700">Ver menú</Link>
                  <Link to="/semanas" className="rounded border border-gray-300 px-3.5 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50">Ver semanas</Link>
                </div>
              </>
            ) : (
              <div className="px-5 py-8 text-center">
                <p className="text-sm text-gray-500">Sin semana creada</p>
                <Link to="/semanas" className="mt-3 inline-block rounded bg-brand-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-brand-700">Crear semana</Link>
              </div>
            )}
          </div>

          {/* Accesos rápidos */}
          <div className="rounded-lg border border-gray-200 bg-white">
            <p className="border-b border-gray-200 px-5 py-3 text-sm font-bold text-gray-800">Accesos rápidos</p>
            <div className="divide-y divide-gray-100">
              <AccesoRapido to="/cocina" label="Cockpit de cocina" icon={<IconCocina />} />
              <AccesoRapido to="/pedidos" label="Pedidos" icon={<IconPedidos />} />
              <AccesoRapido to="/clientes" label="Clientes" icon={<IconClientes />} />
              <AccesoRapido to="/platos" label="Catálogo de platos" icon={<IconPlatos />} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
