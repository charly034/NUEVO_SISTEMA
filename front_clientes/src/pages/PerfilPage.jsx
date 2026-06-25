import { useQueryClient } from '@tanstack/react-query';
import PerfilCliente from '../components/PerfilCliente.jsx';

export default function PerfilPage({ empleado, onLogout, onEmpleadoUpdate }) {
  const qc = useQueryClient();
  const cerrarSesion = () => { qc.clear(); onLogout(); };
  return (
    <PerfilCliente
      empleado={empleado}
      onLogout={cerrarSesion}
      onEmpleadoUpdate={onEmpleadoUpdate}
    />
  );
}
