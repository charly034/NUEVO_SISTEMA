import { lazy, Suspense } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "./hooks/useAuth.js";
import { VISTAS_AUTENTICACION } from "./hooks/useLoginPage.js";
import PrivateRoute from "./components/layout/PrivateRoute.jsx";
import AppMobileShell from "./components/layout/AppMobileShell.jsx";
import BottomNavigation from "./components/ui/BottomNavigation.jsx";
import {
  rutasAutenticacion,
  rutasCliente,
  rutasCompatibilidad,
} from "./routes/rutasCliente.js";

const LoginPage         = lazy(() => import("./pages/LoginPage.jsx"));
const SplashPage        = lazy(() => import("./pages/SplashPage.jsx"));
const OnboardingPage    = lazy(() => import("./pages/OnboardingPage.jsx"));
const PedidoPage        = lazy(() => import("./pages/PedidoPage.jsx"));
const HistorialPage     = lazy(() => import("./pages/HistorialPage.jsx"));
const PerfilPage        = lazy(() => import("./pages/PerfilPage.jsx"));
const NotificacionesPage = lazy(() => import("./pages/NotificacionesPage.jsx"));
const SugerenciasPage   = lazy(() => import("./pages/SugerenciasPage.jsx"));
const NavMapScreen      = lazy(() => import("./pages/NavMapScreen.jsx"));

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
          <p className="text-[0.82rem] font-black uppercase tracking-wide text-[#5B6B2A]">
            La Quinta
          </p>
          <div className="mt-2 h-8 w-48 animate-pulse rounded-full bg-[#EDF0E4]" />
          <div className="mt-2 h-4 w-56 animate-pulse rounded-full bg-[#F0EDE6]" />
        </header>
        <section
          aria-label="Cargando pantalla"
          className="mt-2 flex min-h-0 flex-1 flex-col gap-3 rounded-3xl border border-[#E8E5DC] bg-white p-3 shadow-sm"
        >
          <div className="h-5 w-32 animate-pulse rounded-full bg-[#EDF0E4]" />
          <div className="h-20 animate-pulse rounded-2xl bg-[#EDF0E4]" />
          <div className="space-y-2">
            <div className="h-12 animate-pulse rounded-2xl bg-[#FAF8F3]" />
            <div className="h-12 animate-pulse rounded-2xl bg-[#FAF8F3]" />
            <div className="h-12 animate-pulse rounded-2xl bg-[#FAF8F3]" />
          </div>
        </section>
      </AppMobileShell>
      {conNavegacion && <BottomNavigation />}
    </>
  );
}

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

function RouteGuardSinNav({ empleado, checking, children }) {
  return (
    <PrivateRoute empleado={empleado} checking={checking}>
      <Suspense fallback={<FallbackRutaMobile />}>
        {children}
      </Suspense>
    </PrivateRoute>
  );
}

function AuthRoute({
  checking,
  empleado,
  onLogin,
  onSesionAutenticada,
  vistaInicial,
}) {
  if (empleado && !checking) {
    return <Navigate to={rutasCliente.inicio} replace />;
  }

  return (
    <Suspense fallback={<FallbackRutaMobile />}>
      <LoginPage
        onLogin={onLogin}
        onSesionAutenticada={onSesionAutenticada}
        vistaInicial={vistaInicial}
      />
    </Suspense>
  );
}

function AppRoutes() {
  const { empleado, login, logout, setSession, setAuthenticatedSession, checking } = useAuth();

  return (
    <Routes>
      {/* Splash + Onboarding */}
      <Route
        path="/"
        element={
          <Suspense fallback={null}>
            <SplashPage />
          </Suspense>
        }
      />
      <Route
        path="/onboarding"
        element={
          <Suspense fallback={null}>
            <OnboardingPage />
          </Suspense>
        }
      />

      {/* Autenticación */}
      <Route
        path={rutasAutenticacion.iniciarSesion}
        element={
          <AuthRoute
            checking={checking}
            empleado={empleado}
            onLogin={login}
            onSesionAutenticada={setAuthenticatedSession}
            vistaInicial={VISTAS_AUTENTICACION.LOGIN}
          />
        }
      />
      <Route
        path={rutasAutenticacion.crearCuenta}
        element={
          <AuthRoute
            checking={checking}
            empleado={empleado}
            onLogin={login}
            onSesionAutenticada={setAuthenticatedSession}
            vistaInicial={VISTAS_AUTENTICACION.REGISTRO}
          />
        }
      />
      <Route
        path={rutasAutenticacion.recuperarAcceso}
        element={
          <AuthRoute
            checking={checking}
            empleado={empleado}
            onLogin={login}
            onSesionAutenticada={setAuthenticatedSession}
            vistaInicial={VISTAS_AUTENTICACION.RECUPERAR}
          />
        }
      />

      {/* Rutas privadas con nav */}
      <Route
        path={rutasCliente.pedidoSemanal}
        element={
          <RouteGuard empleado={empleado} checking={checking}>
            <PedidoPage empleado={empleado} />
          </RouteGuard>
        }
      />
      <Route
        path={rutasCliente.misPedidos}
        element={
          <RouteGuard empleado={empleado} checking={checking}>
            <HistorialPage empleado={empleado} />
          </RouteGuard>
        }
      />
      <Route
        path={rutasCliente.miCuenta}
        element={
          <RouteGuard empleado={empleado} checking={checking}>
            <PerfilPage empleado={empleado} onLogout={logout} onEmpleadoUpdate={setSession} />
          </RouteGuard>
        }
      />

      {/* Rutas privadas sin nav (pantallas secundarias) */}
      <Route
        path={rutasCliente.mapaNavegacion}
        element={
          <RouteGuardSinNav empleado={empleado} checking={checking}>
            <NavMapScreen />
          </RouteGuardSinNav>
        }
      />

      <Route
        path={rutasCliente.notificaciones}
        element={
          <RouteGuardSinNav empleado={empleado} checking={checking}>
            <NotificacionesPage />
          </RouteGuardSinNav>
        }
      />
      <Route
        path={rutasCliente.sugerencias}
        element={
          <RouteGuardSinNav empleado={empleado} checking={checking}>
            <SugerenciasPage />
          </RouteGuardSinNav>
        }
      />

      {/* Compatibilidad */}
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
            to={empleado ? rutasCliente.inicio : "/"}
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
