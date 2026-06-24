import { useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth.js';
import LoginScreen from './components/LoginScreen.jsx';
import RegistroScreen from './components/RegistroScreen.jsx';
import RecuperarPassword from './components/RecuperarPassword.jsx';
import FormularioPedido from './components/FormularioPedido.jsx';
import HistorialPedidos from './components/HistorialPedidos.jsx';
import PerfilCliente from './components/PerfilCliente.jsx';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 2 * 60 * 1000 } },
});

const NAV = [
  { id: 'pedido',   icon: '🍽️',  label: 'Pedido' },
  { id: 'historial', icon: '📋', label: 'Historial' },
  { id: 'perfil',   icon: '👤',  label: 'Mi cuenta' },
];

function BottomNav({ vista, onChange }) {
  return (
    <nav style={sNav.bar}>
      {NAV.map(item => (
        <button
          key={item.id}
          onClick={() => onChange(item.id)}
          style={{ ...sNav.btn, ...(vista === item.id ? sNav.btnActivo : {}) }}
        >
          <span style={{ fontSize: 20, lineHeight: 1 }}>{item.icon}</span>
          <span style={{ fontSize: 12, fontWeight: vista === item.id ? 800 : 600 }}>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

function Inner() {
  const { empleado, login, logout, setSession, checking } = useAuth();
  const qc = useQueryClient();
  const [vista, setVista] = useState('pedido');
  const [pedidoKey, setPedidoKey] = useState(0);
  const [pantalla, setPantalla] = useState('login'); // 'login' | 'registro' | 'recuperar'

  const cerrarSesion = () => { qc.clear(); logout(); };

  const handleNav = (id) => {
    if (id === 'pedido' && vista === 'pedido') setPedidoKey(k => k + 1);
    setVista(id);
  };

  if (checking) return <div style={{ padding: 60, textAlign: 'center' }}>Verificando sesión…</div>;
  if (!empleado) {
    if (pantalla === 'registro') {
      return (
        <RegistroScreen
          onRegistrado={(emp) => { setSession(emp); setPantalla('login'); }}
          onVolver={() => setPantalla('login')}
        />
      );
    }
    if (pantalla === 'recuperar') {
      return (
        <RecuperarPassword
          onVolver={() => setPantalla('login')}
          onExito={() => { setPantalla('login'); }}
        />
      );
    }
    return <LoginScreen onLogin={login} onRegistrar={() => setPantalla('registro')} onRecuperar={() => setPantalla('recuperar')} />;
  }

  return (
    <>
      {vista === 'pedido'    && <FormularioPedido key={pedidoKey} empleado={empleado} />}
      {vista === 'historial' && <HistorialPedidos empleado={empleado} />}
      {vista === 'perfil'    && <PerfilCliente    empleado={empleado} onLogout={cerrarSesion} onEmpleadoUpdate={setSession} />}
      <BottomNav vista={vista} onChange={handleNav} />
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Inner />
    </QueryClientProvider>
  );
}

const sNav = {
  bar:      { position: 'fixed', bottom: 0, left: 0, right: 0, maxWidth: 560, margin: '0 auto', background: '#fff', borderTop: '1px solid #e5e5e5', borderLeft: '1px solid #f1f5f9', borderRight: '1px solid #f1f5f9', display: 'flex', zIndex: 100, paddingBottom: 'env(safe-area-inset-bottom)', boxShadow: '0 -8px 24px rgba(15,23,42,0.05)' },
  btn:      { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '10px 4px 12px', minHeight: 58, border: 'none', background: 'none', color: '#64748b', cursor: 'pointer' },
  btnActivo:{ color: 'var(--verde)' },
};
