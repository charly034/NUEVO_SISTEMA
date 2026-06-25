import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/layout/Layout.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Platos from './pages/Platos.jsx';
import Semanas from './pages/Semanas.jsx';
import SemanaDetalle from './pages/SemanaDetalle.jsx';
import Historial from './pages/Historial.jsx';
import Estadisticas from './pages/Estadisticas.jsx';
import Sugeridor from './pages/Sugeridor.jsx';
import Empresas from './pages/Empresas.jsx';
import Guarniciones from './pages/Guarniciones.jsx';
import PedidosAdmin from './pages/PedidosAdmin.jsx';
import PedidosHoy from './pages/PedidosHoy.jsx';
import Administradores from './pages/Administradores.jsx';
import AdminLogin from './components/AdminLogin.jsx';
import { adminAuth } from './auth.js';

export default function App() {
  const [admin, setAdmin] = useState(() => adminAuth.storedUser());
  const [checking, setChecking] = useState(() => !!(localStorage.getItem('admin_token') || sessionStorage.getItem('admin_token')));

  useEffect(() => {
    const unauthorized = () => setAdmin(null);
    window.addEventListener('admin:unauthorized', unauthorized);
    return () => window.removeEventListener('admin:unauthorized', unauthorized);
  }, []);

  useEffect(() => {
    if (!localStorage.getItem('admin_token') && !sessionStorage.getItem('admin_token')) return;
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
    return <div className="min-h-screen grid place-items-center text-gray-500">Verificando sesión…</div>;
  }
  if (!admin) return <AdminLogin onLogin={login} />;

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        <Route element={<Layout admin={admin} onLogout={logout} />}>
          <Route index element={<Dashboard />} />
          <Route path="platos" element={<Platos />} />
          <Route path="semanas" element={<Semanas />} />
          <Route path="semanas/:id" element={<SemanaDetalle />} />
          <Route path="historial" element={<Historial />} />
          <Route path="estadisticas" element={<Estadisticas />} />
          <Route path="sugeridor" element={<Sugeridor />} />
          <Route path="pedidos" element={<PedidosAdmin />} />
          <Route path="pedidos-hoy" element={<PedidosHoy />} />
          <Route path="empresas" element={<Empresas />} />
          <Route path="guarniciones" element={<Guarniciones />} />
          <Route path="administradores" element={<Administradores />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
