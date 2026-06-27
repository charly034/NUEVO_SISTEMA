import { Navigate } from 'react-router-dom';
import AppMobileShell from './AppMobileShell.jsx';
import BottomNavigation from '../ui/BottomNavigation.jsx';

function PantallaValidandoSesion() {
  return (
    <>
      <AppMobileShell>
        <header className="shrink-0 px-1 pb-3">
          <p className="text-[0.82rem] font-black uppercase tracking-wide text-[#5f7f55]">
            La Quinta
          </p>
          <h1 className="mt-1 text-[1.65rem] font-black leading-tight tracking-normal text-[#1a1a1a] md:text-[2rem]">
            Cargando tu sesion...
          </h1>
          <p className="mt-1 text-[0.95rem] font-medium leading-tight text-[#716c64]">
            Estamos preparando tu pedido.
          </p>
        </header>

        <section
          aria-label="Preparando pedido"
          className="mt-2 flex min-h-0 flex-1 flex-col gap-3 rounded-3xl border border-[#eee8df] bg-white p-3 shadow-sm"
        >
          <div className="h-5 w-32 animate-pulse rounded-full bg-[#e8e3da]" />
          <div className="h-20 animate-pulse rounded-2xl bg-[#f0f7ee]" />
          <div className="space-y-2">
            <div className="h-12 animate-pulse rounded-2xl bg-[#faf8f4]" />
            <div className="h-12 animate-pulse rounded-2xl bg-[#faf8f4]" />
            <div className="h-12 animate-pulse rounded-2xl bg-[#faf8f4]" />
          </div>
        </section>
      </AppMobileShell>
      <BottomNavigation />
    </>
  );
}

export default function PrivateRoute({ empleado, checking, children }) {
  if (checking) {
    return <PantallaValidandoSesion />;
  }
  if (!empleado) {
    return <Navigate to="/login" replace />;
  }
  return children;
}
