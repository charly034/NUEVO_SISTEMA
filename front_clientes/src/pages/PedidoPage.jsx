import { useState } from 'react';
import FormularioPedido from '../components/formulario/index.jsx';

export default function PedidoPage({ empleado }) {
  const [pedidoKey, setPedidoKey] = useState(0);

  // Recargar el formulario al navegar a esta tab cuando ya está activa
  // (el BottomNav usa NavLink; para el mismo comportamiento de "re-tap",
  //  se puede llamar onReload desde el layout si se necesita en el futuro)
  return <FormularioPedido key={pedidoKey} empleado={empleado} onReload={() => setPedidoKey(k => k + 1)} />;
}
