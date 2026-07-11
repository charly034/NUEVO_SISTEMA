import { useLocation } from 'react-router-dom';

const PAGE_TITLES = {
  '/':             'Inicio',
  '/platos':       'Platos',
  '/semanas':      'Semanas',
  '/historial':    'Historial',
  '/estadisticas': 'Estadísticas',
  '/sugeridor':    'Generar menú',
  '/pedidos':      'Pedidos',
  '/pedidos-hoy':  'Despacho hoy',
  '/clientes':     'Clientes',
  '/pedidos-pagos': 'Pedidos y pagos',
  '/recomendaciones-menu': 'Sugerencias de clientes',
  '/empresas':     'Empresas',
  '/guarniciones': 'Guarniciones',
  '/auditoria':    'Auditoría',
  '/administradores': 'Administradores',
};

function MenuIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" />
    </svg>
  );
}

export default function MobileHeader({ onLogout, onOpenMenu }) {
  const location = useLocation();

  // Semanas/:id tiene título dinámico — mostrar genérico
  const title = PAGE_TITLES[location.pathname]
    ?? (location.pathname.startsWith('/semanas/') ? 'Detalle de menú' : 'Panel admin');

  return (
    <header className="print:hidden lg:hidden flex items-center justify-between px-4 h-14 bg-white border-b border-gray-100 flex-shrink-0 sticky top-0 z-30">
      <div className="flex min-w-0 items-center gap-2.5">
        <button
          type="button"
          onClick={onOpenMenu}
          className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-gray-200 text-gray-600"
          aria-label="Abrir menú lateral"
        >
          <MenuIcon />
        </button>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold leading-tight text-brand-700">La Quinta</p>
          <p className="truncate text-[11px] leading-tight text-gray-500">Sistema de menús · {title}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onLogout}
        className="text-xs text-gray-500 hover:text-red-500 transition-colors px-2 py-1 rounded"
        aria-label="Cerrar sesión del panel admin"
      >
        Salir
      </button>
    </header>
  );
}
