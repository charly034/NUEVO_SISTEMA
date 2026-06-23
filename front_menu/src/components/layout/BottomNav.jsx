import { NavLink } from 'react-router-dom';

const NAV = [
  { to: '/',             label: 'Inicio'  },
  { to: '/platos',       label: 'Platos'  },
  { to: '/semanas',      label: 'Menús'   },
  { to: '/sugeridor',    label: 'Sugerir' },
  { to: '/estadisticas', label: 'Stats'   },
];

const ICONS = {
  '/':             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5"><path d="M3 12L12 3l9 9"/><path d="M9 21V12h6v9"/></svg>,
  '/platos':       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>,
  '/semanas':      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
  '/sugeridor':    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,
  '/estadisticas': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-5 h-5"><path d="M18 20V10M12 20V4M6 20v-6"/></svg>,
};

export default function BottomNav() {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white border-t border-gray-200">
      <div className="flex">
        {NAV.map(({ to, label }) => (
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
      </div>
    </nav>
  );
}
