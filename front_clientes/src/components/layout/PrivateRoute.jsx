import { Navigate } from 'react-router-dom';

export default function PrivateRoute({ empleado, checking, children }) {
  if (checking) {
    return <div style={{ padding: 60, textAlign: 'center' }}>Verificando sesion...</div>;
  }
  if (!empleado) {
    return <Navigate to="/login" replace />;
  }
  return children;
}
