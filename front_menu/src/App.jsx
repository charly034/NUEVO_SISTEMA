import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout.jsx';
import AdminLogin from './components/AdminLogin.jsx';
import { adminAuth } from './auth.js';

const Dashboard = lazy(() => import('./pages/Dashboard.jsx'));
const Platos = lazy(() => import('./pages/Platos.jsx'));
const Semanas = lazy(() => import('./pages/Semanas.jsx'));
const SemanaDetalle = lazy(() => import('./pages/SemanaDetalle.jsx'));
const Historial = lazy(() => import('./pages/Historial.jsx'));
const Estadisticas = lazy(() => import('./pages/Estadisticas.jsx'));
const Sugeridor = lazy(() => import('./pages/Sugeridor.jsx'));
const Empresas = lazy(() => import('./pages/Empresas.jsx'));
const Guarniciones = lazy(() => import('./pages/Guarniciones.jsx'));
const PedidosAdmin = lazy(() => import('./pages/PedidosAdmin.jsx'));
const PedidosHoy = lazy(() => import('./pages/PedidosHoy.jsx'));
const RecomendacionesMenu = lazy(() => import('./pages/RecomendacionesMenu.jsx'));
const Administradores = lazy(() => import('./pages/Administradores.jsx'));

function PageFallback() {
  return (
    <div className="min-h-[320px] animate-pulse rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <div className="h-6 w-48 rounded bg-gray-200" />
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <div className="h-24 rounded bg-gray-100" />
        <div className="h-24 rounded bg-gray-100" />
        <div className="h-24 rounded bg-gray-100" />
      </div>
      <div className="mt-6 h-48 rounded bg-gray-100" />
    </div>
  );
}

export default function App() {
  const [admin, setAdmin] = useState(() => adminAuth.storedUser());
  const [checking, setChecking] = useState(() => adminAuth.hasToken() && !adminAuth.storedUser());

  useEffect(() => {
    const unauthorized = () => setAdmin(null);
    window.addEventListener('admin:unauthorized', unauthorized);
    return () => window.removeEventListener('admin:unauthorized', unauthorized);
  }, []);

  useEffect(() => {
    if (!adminAuth.hasToken()) {
      return;
    }
    adminAuth.me()
      .then(setAdmin)
      .catch(() => {
        adminAuth.logout();
        setAdmin(null);
      })
      .finally(() => setChecking(false));
  }, []);

  const login = async (email, password, remember) => setAdmin(await adminAuth.login(email, password, remember));
  const logout = () => {
    adminAuth.logout();
    setAdmin(null);
  };

  if (checking) {
    return <div className="min-h-screen grid place-items-center text-gray-500">Verificando sesion...</div>;
  }
  if (!admin) return <AdminLogin onLogin={login} />;

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route element={<Layout admin={admin} onLogout={logout} />}>
          <Route index element={<Suspense fallback={<PageFallback />}><Dashboard /></Suspense>} />
          <Route path="platos" element={<Suspense fallback={<PageFallback />}><Platos /></Suspense>} />
          <Route path="semanas" element={<Suspense fallback={<PageFallback />}><Semanas /></Suspense>} />
          <Route path="semanas/:id" element={<Suspense fallback={<PageFallback />}><SemanaDetalle /></Suspense>} />
          <Route path="historial" element={<Suspense fallback={<PageFallback />}><Historial /></Suspense>} />
          <Route path="estadisticas" element={<Suspense fallback={<PageFallback />}><Estadisticas /></Suspense>} />
          <Route path="sugeridor" element={<Suspense fallback={<PageFallback />}><Sugeridor /></Suspense>} />
          <Route path="pedidos" element={<Suspense fallback={<PageFallback />}><PedidosAdmin /></Suspense>} />
          <Route path="pedidos-hoy" element={<Suspense fallback={<PageFallback />}><PedidosHoy /></Suspense>} />
          <Route path="recomendaciones-menu" element={<Suspense fallback={<PageFallback />}><RecomendacionesMenu /></Suspense>} />
          <Route path="empresas" element={<Suspense fallback={<PageFallback />}><Empresas /></Suspense>} />
          <Route path="empleados" element={<Suspense fallback={<PageFallback />}><Empresas /></Suspense>} />
          <Route path="guarniciones" element={<Suspense fallback={<PageFallback />}><Guarniciones /></Suspense>} />
          <Route path="administradores" element={<Suspense fallback={<PageFallback />}><Administradores /></Suspense>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
