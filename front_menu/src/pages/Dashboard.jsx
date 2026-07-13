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

const ESTADO_LABEL = {
  borrador: { label: 'Borrador', color: 'bg-amber-100 text-amber-700' },
  publicado: { label: 'Publicado', color: 'bg-green-100 text-green-700' },
  cerrado: { label: 'Cerrado', color: 'bg-gray-100 text-gray-500' },
};

function KpiCard({ valor, label, to, loading }) {
  const inner = (
    <div className="rounded-xl border border-gray-100 bg-white px-4 py-4 text-center transition-shadow hover:shadow-sm">
      {loading ? (
        <div className="mx-auto mb-1 h-7 w-12 animate-pulse rounded bg-gray-100" />
      ) : (
        <p className="text-2xl font-bold text-gray-900 tabular-nums">{valor ?? '—'}</p>
      )}
      <p className="mt-0.5 text-xs text-gray-500">{label}</p>
    </div>
  );
  return to ? <Link to={to}>{inner}</Link> : inner;
}

function AccesoRapido({ to, icon, label, description }) {
  return (
    <Link
      to={to}
      className="flex items-start gap-3 rounded-xl border border-gray-100 bg-white p-4 transition-shadow hover:shadow-sm"
    >
      <div className="mt-0.5 rounded-lg bg-green-50 p-2 text-green-700">{icon}</div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-900">{label}</p>
        <p className="mt-0.5 text-xs text-gray-500">{description}</p>
      </div>
    </Link>
  );
}

const IconCocina = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
    <path d="M6 2v6a6 6 0 0 0 12 0V2" />
    <path d="M3 22h18" />
    <path d="M12 14v8" />
  </svg>
);

const IconPedidos = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
    <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" />
    <rect x="9" y="3" width="6" height="4" rx="1" />
    <path d="M9 12h6M9 16h4" />
  </svg>
);

const IconClientes = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
    <path d="M3 21h18M9 8h1m5 0h1M9 12h1m5 0h1M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" />
  </svg>
);

const IconPlatos = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
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
  const menuActual = menus.find(m => m.fecha_inicio === lunesEsta) ?? menus[0] ?? null;
  const menuProximo = menus.find(m => m.fecha_inicio?.slice(0, 10) === lunesProxima) ?? null;
  const proximaSinPublicar = !menusQuery.isLoading && (!menuProximo || menuProximo.estado !== 'publicado');

  const pedidosQuery = usePedidos(
    { semana_inicio: lunesEsta, limit: 500 },
    { enabled: Boolean(lunesEsta) }
  );
  const totalPedidos = useMemo(() => {
    const d = pedidosQuery.data;
    const arr = d?.pedidos ?? d ?? [];
    return arr.filter(p => p.estado !== 'cancelado').length;
  }, [pedidosQuery.data]);

  const empresasQuery = useEmpresas();
  const empresasActivas = (empresasQuery.data ?? []).filter(e => e.activo).length;

  const clientesQuery = useEmpleados();
  const clientesActivos = (clientesQuery.data ?? []).filter(c => c.activo && c.rol !== 'admin').length;

  const estadoMenu = menuActual ? (ESTADO_LABEL[menuActual.estado] ?? ESTADO_LABEL.borrador) : null;

  return (
    <div className="min-h-full bg-gray-50">
      <div className="bg-green-700 px-4 py-5 md:px-6">
        <p className="text-base font-semibold text-white">
          {formatFecha(fechaOperativa) || 'Hoy'}
        </p>
        <p className="mt-0.5 text-sm text-green-200">Panel de administracion</p>
      </div>

      <div className="mx-auto max-w-3xl space-y-5 px-4 py-5 md:px-6">

        <div className="grid grid-cols-3 gap-3">
          <KpiCard
            valor={pedidosQuery.isLoading ? null : totalPedidos}
            label="Pedidos esta semana"
            to="/pedidos"
            loading={pedidosQuery.isLoading}
          />
          <KpiCard
            valor={empresasQuery.isLoading ? null : empresasActivas}
            label="Empresas activas"
            to="/clientes"
            loading={empresasQuery.isLoading}
          />
          <KpiCard
            valor={clientesQuery.isLoading ? null : clientesActivos}
            label="Clientes activos"
            to="/clientes?vista=clientes"
            loading={clientesQuery.isLoading}
          />
        </div>

        {proximaSinPublicar && (
          <Link
            to="/semanas"
            className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 transition-shadow hover:shadow-sm"
          >
            <span className="mt-0.5 text-lg leading-none">⚠️</span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-amber-800">
                {menuProximo ? 'Menu de la proxima semana sin publicar' : 'Proxima semana sin menu'}
              </p>
              <p className="mt-0.5 text-xs text-amber-600">
                {formatRangoSemana(lunesProxima)} · Publicalo antes del cierre de pedidos
              </p>
            </div>
          </Link>
        )}

        <div className="rounded-xl border border-gray-100 bg-white px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Semana actual</p>
              {menusQuery.isLoading ? (
                <div className="mt-1 h-5 w-48 animate-pulse rounded bg-gray-100" />
              ) : menuActual ? (
                <p className="mt-0.5 text-sm font-medium text-gray-900">
                  {formatRangoSemana(menuActual.fecha_inicio)}
                </p>
              ) : (
                <p className="mt-0.5 text-sm text-gray-500">Sin semana creada</p>
              )}
            </div>
            {estadoMenu && (
              <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${estadoMenu.color}`}>
                {estadoMenu.label}
              </span>
            )}
          </div>

          {menuActual ? (
            <div className="mt-3 flex gap-2">
              <Link
                to={`/semanas/${menuActual.id}/resumen`}
                className="rounded-lg bg-green-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-800"
              >
                Ver menu
              </Link>
              <Link
                to="/semanas"
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50"
              >
                Ver semanas
              </Link>
            </div>
          ) : (
            !menusQuery.isLoading && (
              <div className="mt-3">
                <Link
                  to="/semanas"
                  className="rounded-lg bg-green-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-800"
                >
                  Crear semana
                </Link>
              </div>
            )
          )}
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">Accesos rapidos</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <AccesoRapido
              to="/cocina"
              label="Cockpit de cocina"
              description="Pedidos del dia, orden de produccion"
              icon={<IconCocina />}
            />
            <AccesoRapido
              to="/pedidos"
              label="Pedidos"
              description="Ver y gestionar pedidos de la semana"
              icon={<IconPedidos />}
            />
            <AccesoRapido
              to="/clientes"
              label="Clientes"
              description="Empresas, clientes finales y pagos"
              icon={<IconClientes />}
            />
            <AccesoRapido
              to="/platos"
              label="Catalogo de platos"
              description="Agregar y editar platos y guarniciones"
              icon={<IconPlatos />}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
