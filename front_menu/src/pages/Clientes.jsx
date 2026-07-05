import { useSearchParams } from 'react-router-dom';
import Empresas from './Empresas.jsx';
import PedidosPagos from './PedidosPagos.jsx';
import NotificacionesAdmin from './NotificacionesAdmin.jsx';

const VISTAS = [
  {
    key: 'empresas',
    label: 'Empresas',
    description: 'Empresas, empleados, planes y cuenta corriente.',
    component: Empresas,
  },
  {
    key: 'pagos',
    label: 'Pagos',
    description: 'Pedidos, pagos, saldos y resumenes para cobrar.',
    component: PedidosPagos,
  },
  {
    key: 'notificaciones',
    label: 'Notificaciones',
    description: 'Mensajes, reglas internas y WhatsApp por empresa.',
    component: NotificacionesAdmin,
  },
];

function getVistaActiva(value) {
  return VISTAS.some(vista => vista.key === value) ? value : 'empresas';
}

export default function Clientes() {
  const [searchParams] = useSearchParams();
  const vistaActiva = getVistaActiva(searchParams.get('vista'));
  const vista = VISTAS.find(item => item.key === vistaActiva) || VISTAS[0];
  const VistaComponent = vista.component;

  return (
    <div className="min-h-full min-w-0 overflow-x-hidden bg-gray-50">
      <div className="sticky top-0 z-20 border-b border-gray-200 bg-white px-4 py-3 md:top-0 md:px-6">
        <div className="mx-auto max-w-[1600px]">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Administracion de clientes</p>
            <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
            <p className="text-sm text-gray-500">{vista.description}</p>
          </div>
        </div>
      </div>

      <VistaComponent />
    </div>
  );
}
