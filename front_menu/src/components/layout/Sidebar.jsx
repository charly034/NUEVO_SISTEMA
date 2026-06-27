import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

const NAV = [
  { to: '/', label: 'Dashboard' },
  { to: '/platos', label: 'Platos' },
  { type: 'menu-semanal' },
  { to: '/pedidos', label: 'Pedidos' },
  { to: '/pedidos-hoy', label: 'Pedidos de hoy' },
  { to: '/empresas', label: 'Empresas' },
  { to: '/administradores', label: 'Administradores', superadminOnly: true },
];

const MENU_SEMANAL_ITEMS = [
  { to: '/semanas', label: 'Menú semanal' },
  { to: '/sugeridor', label: 'Sugeridor' },
  { to: '/historial', label: 'Historial de platos' },
  { to: '/estadisticas', label: 'Estadísticas de platos' },
  { to: '/recomendaciones-menu', label: 'Recomendaciones' },
];

const ICONS = {
  '/': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4"><path d="M3 12L12 3l9 9"/><path d="M9 21V12h6v9"/></svg>,
  '/platos': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>,
  '/semanas': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
  '/sugeridor': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,
  '/historial': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4"><path d="M12 8v4l3 3"/><path d="M3.05 11a9 9 0 1 0 .5-3"/><path d="M3 4v4h4"/></svg>,
  '/estadisticas': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>,
  '/pedidos': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/></svg>,
  '/pedidos-hoy': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg>,
  '/recomendaciones-menu': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/><path d="M8 9h8M8 13h5"/></svg>,
  '/empresas': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4"><path d="M3 21h18M9 8h1m5 0h1M9 12h1m5 0h1M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"/></svg>,
  '/administradores': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4"><path d="M16 21v-2a4 4 0 0 0-8 0v2"/><circle cx="12" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/></svg>,
};

function esRutaMenuSemanal(pathname, to) {
  if (to === '/semanas') return pathname === '/semanas' || pathname.startsWith('/semanas/');
  return pathname === to;
}

export default function Sidebar({ admin, onLogout }) {
  const location = useLocation();
  const menuSemanalActivo = MENU_SEMANAL_ITEMS.some(({ to }) => esRutaMenuSemanal(location.pathname, to));
  const [menuSemanalOpen, setMenuSemanalOpen] = useState(menuSemanalActivo);

  useEffect(() => {
    if (menuSemanalActivo) setMenuSemanalOpen(true);
  }, [menuSemanalActivo]);

  return (
    <aside className="hidden md:flex w-52 flex-shrink-0 bg-white border-r border-gray-200 flex-col">
      <div className="px-5 py-5 border-b border-gray-100">
        <span className="text-lg font-bold text-brand-700">🌿 La Quinta</span>
        <p className="text-xs text-gray-400 mt-0.5">Sistema de menús</p>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {NAV.filter(item => !item.superadminOnly || admin.rol === 'superadmin').map((item) => {
          if (item.type === 'menu-semanal') {
            return (
              <div key="menu-semanal" className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => setMenuSemanalOpen(open => !open)}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                    menuSemanalActivo ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                  aria-expanded={menuSemanalOpen}
                >
                  {ICONS['/semanas']}
                  <span className="flex-1">Menú semanal</span>
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    className={`h-4 w-4 transition-transform ${menuSemanalOpen ? 'rotate-180' : ''}`}
                  >
                    <path d="M6 9l6 6 6-6" />
                  </svg>
                </button>

                {menuSemanalOpen && (
                  <div className="ml-5 border-l border-gray-100 pl-2">
                    {MENU_SEMANAL_ITEMS.map(({ to, label }) => (
                      <NavLink
                        key={to}
                        to={to}
                        end={to !== '/semanas'}
                        className={({ isActive }) =>
                          `flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                            isActive
                              ? 'bg-brand-50 text-brand-700 font-medium'
                              : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                          }`
                        }
                      >
                        {ICONS[to]}
                        {label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              {ICONS[item.to]}
              {item.label}
            </NavLink>
          );
        })}
      </nav>
      <div className="flex-shrink-0 border-t border-gray-100 p-3">
        <p className="px-2 text-xs font-medium text-gray-700 truncate">{admin.nombre} {admin.apellido}</p>
        <button onClick={onLogout} className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-4 h-4"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/></svg>
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
