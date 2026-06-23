import { useState } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth.js';
import LoginScreen from './components/LoginScreen.jsx';
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
          <span style={{ fontSize: 20 }}>{item.icon}</span>
          <span style={{ fontSize: 11, fontWeight: vista === item.id ? 700 : 500 }}>{item.label}</span>
        </button>
      ))}
    </nav>
  );
}

function Inner() {
  const { empleado, login, logout, checking } = useAuth();
  const qc = useQueryClient();
  const [vista, setVista] = useState('pedido');

  const cerrarSesion = () => { qc.clear(); logout(); };

  if (checking) return <div style={{ padding: 60, textAlign: 'center' }}>Verificando sesión…</div>;
  if (!empleado) return <LoginScreen onLogin={login} />;

  return (
    <>
      {vista === 'pedido'    && <FormularioPedido empleado={empleado} />}
      {vista === 'historial' && <HistorialPedidos empleado={empleado} />}
      {vista === 'perfil'    && <PerfilCliente    empleado={empleado} onLogout={cerrarSesion} />}
      <BottomNav vista={vista} onChange={setVista} />
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
  bar:      { position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid #e5e5e5', display: 'flex', zIndex: 100, paddingBottom: 'env(safe-area-inset-bottom)' },
  btn:      { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '10px 4px 12px', border: 'none', background: 'none', color: '#aaa', cursor: 'pointer' },
  btnActivo:{ color: 'var(--verde)' },
};
