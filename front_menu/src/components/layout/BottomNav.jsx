import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';

const NAV_PRIMARY = [
  { to: '/', label: 'Inicio' },
  { to: '/pedidos', label: 'Pedidos' },
  { to: '/semanas', label: 'Menús' },
  { to: '/clientes', label: 'Clientes' },
];

const NAV_MORE = [
  { to: '/cocina', label: 'Cocina' },
  { to: '/platos', label: 'Platos' },
  { to: '/guarniciones', label: 'Guarn.' },
  { to: '/auditoria', label: 'Auditoría', superadminOnly: true },
  { to: '/administradores', label: 'Admins', superadminOnly: true },
];

const ICONS = {
  '/': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><path d="M3 12L12 3l9 9" /><path d="M9 21V12h6v9" /></svg>,
  '/pedidos': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" /><rect x="9" y="3" width="6" height="4" rx="1" /><path d="M9 12h6M9 16h4" /></svg>,
  '/clientes': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><path d="M3 21h18M9 8h1m5 0h1M9 12h1m5 0h1M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16" /><path d="M7 21v-5h10v5" /></svg>,
  '/semanas': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></svg>,
  '/platos': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></svg>,
  '/guarniciones': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><path d="M4 10h16" /><path d="M6 10l1.5 9h9L18 10" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>,
  '/cocina': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><path d="M6 2v6a6 6 0 0 0 12 0V2" /><path d="M3 22h18" /><path d="M12 14v8" /></svg>,
  '/pedidos-hoy': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" /></svg>,
  '/historial': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><path d="M12 8v4l3 3" /><path d="M3.05 11a9 9 0 1 0 .5-3" /><path d="M3 4v4h4" /></svg>,
  '/estadisticas': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><path d="M18 20V10M12 20V4M6 20v-6" /></svg>,
  '/sugeridor': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>,
  '/recomendaciones-menu': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z" /><path d="M8 9h8M8 13h5" /></svg>,
  '/auditoria': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" /></svg>,
  '/administradores': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5"><path d="M16 21v-2a4 4 0 0 0-8 0v2" /><circle cx="12" cy="7" r="4" /><path d="M19 8v6M22 11h-6" /></svg>,
};

function IconMas() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
      <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="6" cy="12" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="18" cy="12" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

export default function BottomNav({ admin }) {
  const [masOpen, setMasOpen] = useState(false);
  const location = useLocation();
  const navMore = NAV_MORE.filter(item => !item.superadminOnly || admin?.rol === 'superadmin');
  const inMore = navMore.some(item => item.to === location.pathname);

  return (
    <>
      {masOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={() => setMasOpen(false)}
        />
      )}

      <div className={`fixed bottom-16 left-0 right-0 z-50 rounded-t-2xl border-t border-gray-200 bg-white shadow-2xl transition-transform duration-200 md:hidden ${masOpen ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="mx-auto mb-2 mt-3 h-1 w-10 rounded-full bg-gray-200" />
        <div className="grid grid-cols-3 gap-1 p-3 pb-5">
          {navMore.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setMasOpen(false)}
              className={({ isActive }) =>
                `flex flex-col items-center gap-1.5 rounded-xl px-2 py-3 transition-colors ${
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

      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white md:hidden">
        <div className="flex">
          {NAV_PRIMARY.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
                  isActive ? 'text-brand-700' : 'text-gray-500'
                }`
              }
            >
              {ICONS[to]}
              {label}
            </NavLink>
          ))}

          <button
            type="button"
            onClick={() => setMasOpen(v => !v)}
            className={`relative flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors ${
              inMore || masOpen ? 'text-brand-700' : 'text-gray-500'
            }`}
          >
            <IconMas />
            Más
            {inMore && !masOpen && (
              <span className="absolute right-[20%] top-1.5 h-1.5 w-1.5 rounded-full bg-brand-600" />
            )}
          </button>
        </div>
      </nav>
    </>
  );
}
