import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuth } from "./hooks/useAuth.js";
import PrivateRoute from "./components/layout/PrivateRoute.jsx";
import BottomNav from "./components/layout/BottomNav.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import RegistroPage from "./pages/RegistroPage.jsx";
import RecuperarPage from "./pages/RecuperarPage.jsx";
import PedidoPage from "./pages/PedidoPage.jsx";
import HistorialPage from "./pages/HistorialPage.jsx";
import PerfilPage from "./pages/PerfilPage.jsx";

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 2 * 60 * 1000 } },
});

const rutasPublicas = [
  {
    path: "/login",
    render: ({ login }) => <LoginPage onLogin={login} />,
  },
  {
    path: "/registro",
    render: ({ setSession }) => <RegistroPage onRegistrado={setSession} />,
  },
  {
    path: "/recuperar",
    render: () => <RecuperarPage />,
  },
];

const rutasPrivadas = [
  {
    path: "/pedido",
    render: ({ empleado }) => <PedidoPage empleado={empleado} />,
  },
  {
    path: "/historial",
    render: ({ empleado }) => <HistorialPage empleado={empleado} />,
  },
  {
    path: "/perfil",
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
      <BottomNav />
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
              <Navigate to="/pedido" replace />
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

      <Route
        path="*"
        element={<Navigate to={empleado ? "/pedido" : "/login"} replace />}
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
