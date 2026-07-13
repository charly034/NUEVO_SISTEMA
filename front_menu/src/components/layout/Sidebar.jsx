import { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

const NAV = [
  { to: '/', label: 'Dashboard' },
  { type: 'header', label: 'Operación' },
  { to: '/menu-actual', label: 'Menú de esta semana' },
  { to: '/pedidos', label: 'Pedidos' },
  { type: 'header', label: 'Menús' },
  { type: 'menu-semanal' },
  { type: 'catalogo' },
  { type: 'header', label: 'Gestión' },
  { type: 'clientes' },
  { to: '/auditoria', label: 'Auditoría', superadminOnly: true },
  { to: '/administradores', label: 'Administradores', superadminOnly: true },
];

const CLIENTES_ITEMS = [
  { to: '/clientes', label: 'Empresas', vista: 'empresas', icon: '/empresas' },
  { to: '/clientes?vista=clientes', label: 'Clientes finales', vista: 'clientes', icon: '/clientes-finales' },
  { to: '/clientes?vista=planes', label: 'Planes', vista: 'planes', icon: '/clientes-planes' },
  { to: '/clientes?vista=pagos', label: 'Pagos', vista: 'pagos', icon: '/pedidos-pagos' },
  { to: '/clientes?vista=notificaciones', label: 'Notificaciones', vista: 'notificaciones', icon: '/notificaciones' },
];

const CATALOGO_ITEMS = [
  { to: '/platos', label: 'Platos' },
  { to: '/viandas', label: 'Viandas' },
  { to: '/guarniciones', label: 'Guarniciones' },
  { to: '/salsas', label: 'Salsas' },
  { to: '/ciclos-rotativos', label: 'Ciclos rotativos' },
];

const MENU_SEMANAL_GROUPS = [
  {
    label: 'Planificación',
    items: [
      { to: '/semanas', label: 'Semanas' },
      { to: '/sugeridor', label: 'Generar menú' },
    ],
  },
  {
    label: 'Cocina',
    items: [
      { to: '/cocina', label: 'Cockpit de cocina' },
    ],
  },
  {
    label: 'Análisis',
    items: [
      { to: '/historial', label: 'Historial de platos' },
      { to: '/estadisticas', label: 'Estadísticas' },
      { to: '/recomendaciones-menu', label: 'Sugerencias de clientes' },
    ],
  },
];

const MENU_SEMANAL_ITEMS = MENU_SEMANAL_GROUPS.flatMap(group => group.items);

const ICONS = {
  '/': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><path d="M3 12L12 3l9 9" /><path d="M9 21V12h6v9" /></svg>,
  '/clientes': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><path d="M3 21h18M9 8h1m5 0h1M9 12h1m5 0h1M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" /><path d="M7 21v-5h10v5" /></svg>,
  '/platos': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></svg>,
  '/viandas': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M9 4v16M15 4v16" /></svg>,
  '/guarniciones': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><path d="M4 10h16" /><path d="M6 10l1.5 9h9L18 10" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>,
  '/salsas': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><path d="M12 3c2.5 3 4 5.5 4 8a4 4 0 1 1-8 0c0-2.5 1.5-5 4-8z" /></svg>,
  '/semanas': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>,
  '/menu-actual': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><path d="M3 2v7a3 3 0 0 0 3 3v10M6 2v6M9 2v6" /><path d="M18 2a3 3 0 0 0-3 3v7h3v10" /></svg>,
  '/sugeridor': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>,
  '/historial': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><path d="M12 8v4l3 3" /><path d="M3.05 11a9 9 0 1 0 .5-3" /><path d="M3 4v4h4" /></svg>,
  '/estadisticas': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><path d="M18 20V10M12 20V4M6 20v-6" /></svg>,
  '/pedidos': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /><path d="M9 12h6M9 16h4" /></svg>,
  '/pedidos-hoy': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" /></svg>,
  '/pedidos-pagos': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18" /><path d="M7 15h4M15 15h2" /><path d="M8 3v4M16 3v4" /></svg>,
  '/notificaciones': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></svg>,
  '/recomendaciones-menu': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" /><path d="M8 9h8M8 13h5" /></svg>,
  '/empresas': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><path d="M3 21h18M9 8h1m5 0h1M9 12h1m5 0h1M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" /></svg>,
  '/clientes-finales': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></svg>,
  '/clientes-planes': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  '/auditoria': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>,
  '/administradores': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><path d="M16 21v-2a4 4 0 0 0-8 0v2" /><circle cx="12" cy="7" r="4" /><path d="M19 8v6M22 11h-6" /></svg>,
  '/cocina': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><path d="M6 2v6a6 6 0 0 0 12 0V2" /><path d="M3 22h18" /><path d="M12 14v8" /></svg>,
};

function esRutaMenuSemanal(pathname, to) {
  if (to === '/semanas') return pathname === '/semanas' || pathname.startsWith('/semanas/');
  return pathname === to;
}

function vistaClientesActiva(location) {
  const pathItem = CLIENTES_ITEMS.find(item => item.path === location.pathname);
  if (pathItem) return pathItem.path;
  if (location.pathname !== '/clientes') return null;
  return new URLSearchParams(location.search).get('vista') || 'empresas';
}

function esItemClienteActivo(location, item) {
  if (item.path) return location.pathname === item.path;
  return location.pathname === '/clientes' && vistaClientesActiva(location) === item.vista;
}

function Chevron({ open }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
    >
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function SidebarContent({ admin, onLogout, onNavigate }) {
  const location = useLocation();
  const menuSemanalActivo = MENU_SEMANAL_ITEMS.some(({ to }) => esRutaMenuSemanal(location.pathname, to));
  const catalogoActivo = CATALOGO_ITEMS.some(({ to }) => location.pathname === to);
  const clientesVistaActiva = vistaClientesActiva(location);
  const clientesActivo = Boolean(clientesVistaActiva);
  const [menuSemanalOpen, setMenuSemanalOpen] = useState(menuSemanalActivo);
  const [clientesOpen, setClientesOpen] = useState(clientesActivo);
  const [catalogoOpen, setCatalogoOpen] = useState(catalogoActivo);
  const mostrarMenuSemanal = menuSemanalActivo || menuSemanalOpen;
  const mostrarClientes = clientesActivo || clientesOpen;
  const mostrarCatalogo = catalogoActivo || catalogoOpen;

  const handleLogout = () => {
    onNavigate?.();
    onLogout();
  };

  return (
    <>
      <div className="border-b border-gray-100 px-5 py-5">
        <span className="text-lg font-bold text-brand-700">La Quinta</span>
        <p className="mt-0.5 text-xs text-gray-500">Sistema de menús</p>
      </div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        {NAV.filter(item => !item.superadminOnly || admin.rol === 'superadmin').map((item) => {
          if (item.type === 'header') {
            return (
              <p key={`h-${item.label}`} className="px-3 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-wide text-gray-400 first:pt-1">
                {item.label}
              </p>
            );
          }
          if (item.type === 'clientes') {
            return (
              <div key="clientes" className="space-y-0.5">
                <div
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                    clientesActivo ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <NavLink to="/clientes" onClick={onNavigate} className="flex min-w-0 flex-1 items-center gap-2.5">
                    {ICONS['/clientes']}
                    <span className="flex-1">Clientes</span>
                  </NavLink>
                  <button
                    type="button"
                    onClick={() => setClientesOpen(open => !open)}
                    className="rounded p-0.5 hover:bg-gray-100"
                    aria-expanded={mostrarClientes}
                    aria-label={mostrarClientes ? 'Cerrar Clientes' : 'Abrir Clientes'}
                  >
                    <Chevron open={mostrarClientes} />
                  </button>
                </div>

                {mostrarClientes && (
                  <div className="ml-5 border-l border-gray-100 pl-2">
                    {CLIENTES_ITEMS.map((item) => {
                      const { to, label, icon } = item;
                      const activo = esItemClienteActivo(location, item);
                      return (
                        <NavLink
                          key={to}
                          to={to}
                          end
                          onClick={onNavigate}
                          className={() =>
                            `flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                              activo
                                ? 'bg-brand-50 font-medium text-brand-700'
                                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                            }`
                          }
                        >
                          {ICONS[icon]}
                          {label}
                        </NavLink>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          if (item.type === 'catalogo') {
            return (
              <div key="catalogo" className="space-y-0.5">
                <div
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                    catalogoActivo ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <NavLink to="/platos" onClick={onNavigate} className="flex min-w-0 flex-1 items-center gap-2.5">
                    {ICONS['/platos']}
                    <span className="flex-1">Catálogo</span>
                  </NavLink>
                  <button
                    type="button"
                    onClick={() => setCatalogoOpen(open => !open)}
                    className="rounded p-0.5 hover:bg-gray-100"
                    aria-expanded={mostrarCatalogo}
                    aria-label={mostrarCatalogo ? 'Cerrar Catálogo' : 'Abrir Catálogo'}
                  >
                    <Chevron open={mostrarCatalogo} />
                  </button>
                </div>

                {mostrarCatalogo && (
                  <div className="ml-5 border-l border-gray-100 pl-2">
                    {CATALOGO_ITEMS.map(({ to, label }) => (
                      <NavLink
                        key={to}
                        to={to}
                        end
                        onClick={onNavigate}
                        className={({ isActive }) =>
                          `flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                            isActive
                              ? 'bg-brand-50 font-medium text-brand-700'
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

          if (item.type === 'menu-semanal') {
            return (
              <div key="menu-semanal" className="space-y-0.5">
                <div
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors ${
                    menuSemanalActivo ? 'bg-brand-50 text-brand-700' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <NavLink to="/semanas" onClick={onNavigate} className="flex min-w-0 flex-1 items-center gap-2.5">
                    {ICONS['/semanas']}
                    <span className="flex-1">Planificación</span>
                  </NavLink>
                  <button
                    type="button"
                    onClick={() => setMenuSemanalOpen(open => !open)}
                    className="rounded p-0.5 hover:bg-gray-100"
                    aria-expanded={mostrarMenuSemanal}
                    aria-label={mostrarMenuSemanal ? 'Cerrar Planificación' : 'Abrir Planificación'}
                  >
                    <Chevron open={mostrarMenuSemanal} />
                  </button>
                </div>

                {mostrarMenuSemanal && (
                  <div className="ml-5 space-y-0.5 border-l border-gray-100 pl-2">
                    {MENU_SEMANAL_ITEMS.map(({ to, label }) => (
                      <NavLink
                        key={to}
                        to={to}
                        end={to !== '/semanas'}
                        onClick={onNavigate}
                        className={({ isActive }) =>
                          `flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition-colors ${
                            isActive
                              ? 'bg-brand-50 font-medium text-brand-700'
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
              onClick={onNavigate}
              className={({ isActive }) =>
                `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
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
        <p className="truncate px-2 text-xs font-medium text-gray-700">{admin.nombre} {admin.apellido}</p>
        <button onClick={handleLogout} className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5M21 12H9" /></svg>
          Cerrar sesión
        </button>
      </div>
    </>
  );
}

export default function Sidebar({ admin, onLogout, mobileOpen = false, onCloseMobile }) {
  const drawerRef = useRef(null);
  const previousFocusRef = useRef(null);

  useEffect(() => {
    if (!mobileOpen) return undefined;

    previousFocusRef.current = document.activeElement;
    const drawer = drawerRef.current;
    drawer?.focus();

    const focusableSelector = [
      'a[href]',
      'button:not([disabled])',
      'textarea:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseMobile?.();
        return;
      }

      if (event.key !== 'Tab' || !drawer) return;

      const focusables = [...drawer.querySelectorAll(focusableSelector)]
        .filter(element => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true');

      if (focusables.length === 0) {
        event.preventDefault();
        drawer.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previousFocusRef.current?.focus?.();
    };
  }, [mobileOpen, onCloseMobile]);

  return (
    <>
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden print:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={onCloseMobile} />
          <aside
            ref={drawerRef}
            className="relative flex h-full w-[min(320px,86vw)] flex-col border-r border-gray-200 bg-white shadow-2xl outline-none"
            role="dialog"
            aria-modal="true"
            aria-label="Menu principal del panel admin"
            tabIndex={-1}
          >
            <SidebarContent admin={admin} onLogout={onLogout} onNavigate={onCloseMobile} />
          </aside>
        </div>
      )}

      <aside className="hidden w-56 flex-shrink-0 flex-col border-r border-gray-200 bg-white print:hidden lg:flex">
        <SidebarContent admin={admin} onLogout={onLogout} />
      </aside>
    </>
  );
}
