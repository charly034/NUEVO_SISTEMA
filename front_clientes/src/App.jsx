import { lazy, Suspense } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "./hooks/useAuth.js";
import PrivateRoute from "./components/layout/PrivateRoute.jsx";
import AppMobileShell from "./components/layout/AppMobileShell.jsx";
import BottomNavigation from "./components/ui/BottomNavigation.jsx";
import {
  rutasAutenticacion,
  rutasCliente,
  rutasCompatibilidad,
} from "./routes/rutasCliente.js";

const LoginPage = lazy(() => import("./pages/LoginPage.jsx"));
const RegistroPage = lazy(() => import("./pages/RegistroPage.jsx"));
const RecuperarPage = lazy(() => import("./pages/RecuperarPage.jsx"));
const PedidoPage = lazy(() => import("./pages/PedidoPage.jsx"));
const HistorialPage = lazy(() => import("./pages/HistorialPage.jsx"));
const PerfilPage = lazy(() => import("./pages/PerfilPage.jsx"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 30 * 60 * 1000,
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5 * 60 * 1000,
    },
  },
});

function FallbackRutaMobile({ conNavegacion = false }) {
  return (
    <>
      <AppMobileShell>
        <header className="shrink-0 px-1 pb-3">
          <p className="text-[0.82rem] font-black uppercase tracking-wide text-[#5f7f55]">
            La Quinta
          </p>
          <div className="mt-2 h-8 w-48 animate-pulse rounded-full bg-[#e8e3da]" />
          <div className="mt-2 h-4 w-56 animate-pulse rounded-full bg-[#efe9df]" />
        </header>

        <section
          aria-label="Cargando pantalla"
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
      {conNavegacion && <BottomNavigation />}
    </>
  );
}

const rutasPublicas = [
  {
    path: rutasAutenticacion.iniciarSesion,
    render: ({ login }) => <LoginPage onLogin={login} />,
  },
  {
    path: rutasAutenticacion.crearCuenta,
    render: ({ setSession }) => <RegistroPage onRegistrado={setSession} />,
  },
  {
    path: rutasAutenticacion.recuperarAcceso,
    render: () => <RecuperarPage />,
  },
];

const rutasPrivadas = [
  {
    path: rutasCliente.pedidoSemanal,
    render: ({ empleado }) => <PedidoPage empleado={empleado} />,
  },
  {
    path: rutasCliente.misPedidos,
    render: ({ empleado }) => <HistorialPage empleado={empleado} />,
  },
  {
    path: rutasCliente.miCuenta,
    render: ({ empleado, logout, setSession }) => (
      <PerfilPage
        empleado={empleado}
        onLogout={logout}
        onEmpleadoUpdate={setSession}
      />
    ),
  },
];

function RouteGuard({ empleado, checking, children }) {
  return (
    <PrivateRoute empleado={empleado} checking={checking}>
      <Suspense fallback={<FallbackRutaMobile conNavegacion />}>
        {children}
        <BottomNavigation />
      </Suspense>
    </PrivateRoute>
  );
}

function AppRoutes() {
  const { empleado, login, logout, setSession, checking } = useAuth();
  const auth = { empleado, login, logout, setSession };

  return (
    <Routes>
      {rutasPublicas.map((ruta) => (
        <Route
          key={ruta.path}
          path={ruta.path}
          element={
            empleado && !checking ? (
              <Navigate to={rutasCliente.inicio} replace />
            ) : (
              <Suspense fallback={<FallbackRutaMobile />}>
                {ruta.render(auth)}
              </Suspense>
            )
          }
        />
      ))}

      {rutasPrivadas.map((ruta) => (
        <Route
          key={ruta.path}
          path={ruta.path}
          element={
            <RouteGuard empleado={empleado} checking={checking}>
              {ruta.render(auth)}
            </RouteGuard>
          }
        />
      ))}

      {rutasCompatibilidad.map((ruta) => (
        <Route
          key={ruta.desde}
          path={ruta.desde}
          element={<Navigate to={ruta.hacia} replace />}
        />
      ))}

      <Route
        path="*"
        element={
          <Navigate
            to={empleado ? rutasCliente.inicio : rutasAutenticacion.iniciarSesion}
            replace
          />
        }
      />
    </Routes>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </QueryClientProvider>
  );
}
