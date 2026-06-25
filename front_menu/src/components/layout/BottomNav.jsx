import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

const NAV_PRIMARY = [
  { to: '/',        label: 'Inicio'  },
  { to: '/pedidos', label: 'Pedidos' },
  { to: '/semanas', label: 'Menús'   },
  { to: '/platos',  label: 'Platos'  },
];

const NAV_MORE = [
  { to: '/pedidos-hoy',  label: 'Hoy'          },
  { to: '/empresas',     label: 'Empresas'     },
  { to: '/historial',    label: 'Historial'    },
  { to: '/estadisticas', label: 'Estadísticas' },
  { to: '/sugeridor',    label: 'Sugeridor'    },
  { to: '/administradores', label: 'Admins', superadminOnly: true },
];

const ICONS = {
  '/':             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5"><path d="M3 12L12 3l9 9"/><path d="M9 21V12h6v9"/></svg>,
  '/pedidos':      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/><rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 12h6M9 16h4"/></svg>,
  '/semanas':      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
  '/platos':       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>,
  '/empresas':     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5"><path d="M3 21h18M9 8h1m5 0h1M9 12h1m5 0h1M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16"/></svg>,
  '/historial':    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5"><path d="M12 8v4l3 3"/><path d="M3.05 11a9 9 0 1 0 .5-3"/><path d="M3 4v4h4"/></svg>,
  '/estadisticas': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>,
  '/guarniciones': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5"><path d="M12 2a7 7 0 0 1 7 7c0 4-3 6-7 13C8 15 5 13 5 9a7 7 0 0 1 7-7z"/></svg>,
  '/administradores': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5"><path d="M16 21v-2a4 4 0 0 0-8 0v2"/><circle cx="12" cy="7" r="4"/><path d="M19 8v6M22 11h-6"/></svg>,
  '/sugeridor':    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,
  '/pedidos-hoy':  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg>,
};

function IconMas() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5">
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/>
      <circle cx="6"  cy="12" r="1.5" fill="currentColor" stroke="none"/>
      <circle cx="18" cy="12" r="1.5" fill="currentColor" stroke="none"/>
    </svg>
  );
}

export default function BottomNav({ admin }) {
  const [masOpen, setMasOpen] = useState(false);
  const location = useLocation();
  const navMore = NAV_MORE.filter(item => !item.superadminOnly || admin?.rol === 'superadmin');

  const inMore = navMore.map(n => n.to).includes(location.pathname);

  return (
    <>
      {/* Overlay */}
      {masOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={() => setMasOpen(false)}
        />
      )}

      {/* Drawer "Más" */}
      <div className={`fixed bottom-16 left-0 right-0 z-50 md:hidden bg-white border-t border-gray-200 rounded-t-2xl shadow-2xl transition-transform duration-200 ${masOpen ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mt-3 mb-2" />
        <div className="grid grid-cols-3 gap-1 p-3 pb-5">
          {navMore.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setMasOpen(false)}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl transition-colors ${
                  isActive ? 'bg-brand-50 text-brand-700' : 'text-gray-500 hover:bg-gray-50'
                }`
              }
            >
              {ICONS[to]}
              <span className="text-xs font-medium">{label}</span>
            </NavLink>
          ))}
        </div>
      </div>

      {/* Bottom nav bar */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white border-t border-gray-200">
        <div className="flex">
          {NAV_PRIMARY.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-medium transition-colors
                 ${isActive ? 'text-brand-700' : 'text-gray-400'}`
              }
            >
              {ICONS[to]}
              {label}
            </NavLink>
          ))}

          {/* Botón Más */}
          <button
            onClick={() => setMasOpen(v => !v)}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-medium transition-colors relative
              ${inMore ? 'text-brand-700' : masOpen ? 'text-brand-700' : 'text-gray-400'}`}
          >
            <IconMas />
            Más
            {inMore && !masOpen && (
              <span className="absolute top-1.5 right-[20%] w-1.5 h-1.5 rounded-full bg-brand-600" />
            )}
          </button>
        </div>
      </nav>
    </>
  );
}
