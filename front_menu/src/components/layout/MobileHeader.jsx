import { useLocation } from 'react-router-dom';

const PAGE_TITLES = {
  '/':             'Inicio',
  '/platos':       'Platos',
  '/semanas':      'Menú semanal',
  '/historial':    'Historial',
  '/estadisticas': 'Estadísticas',
  '/sugeridor':    'Sugeridor',
  '/pedidos':      'Pedidos',
  '/empresas':     'Empresas',
  '/guarniciones': 'Guarniciones',
};

export default function MobileHeader({ admin, onLogout }) {
  const location = useLocation();

  // Semanas/:id tiene título dinámico — mostrar genérico
  const title = PAGE_TITLES[location.pathname]
    ?? (location.pathname.startsWith('/semanas/') ? 'Detalle de menú' : 'Panel admin');

  // Pedidos tiene su propio header integrado — no duplicar
  if (location.pathname === '/pedidos') return null;

  return (
    <header className="md:hidden flex items-center justify-between px-4 h-14 bg-white border-b border-gray-100 flex-shrink-0 sticky top-0 z-30">
      <div className="flex items-center gap-2.5">
        <span className="text-lg">🌿</span>
        <h1 className="text-base font-bold text-gray-900">{title}</h1>
      </div>
      <button
        onClick={onLogout}
        className="text-xs text-gray-400 hover:text-red-500 transition-colors px-2 py-1 rounded"
      >
        Salir
      </button>
    </header>
  );
}
