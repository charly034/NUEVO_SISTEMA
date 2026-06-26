import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "./hooks/useAuth.js";
import PrivateRoute from "./components/layout/PrivateRoute.jsx";
import BottomNavigation from "./components/ui/BottomNavigation.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import RegistroPage from "./pages/RegistroPage.jsx";
import RecuperarPage from "./pages/RecuperarPage.jsx";
import PedidoPage from "./pages/PedidoPage.jsx";
import HistorialPage from "./pages/HistorialPage.jsx";
import PerfilPage from "./pages/PerfilPage.jsx";
import {
  rutasAutenticacion,
  rutasCliente,
  rutasCompatibilidad,
} from "./routes/rutasCliente.js";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 2 * 60 * 1000 } },
});

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
      {children}
      <BottomNavigation />
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
              ruta.render(auth)
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
