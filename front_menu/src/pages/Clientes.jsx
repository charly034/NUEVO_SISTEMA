import { useSearchParams } from 'react-router-dom';
import Empresas from './Empresas.jsx';
import Planes from './Planes.jsx';
import PedidosPagos from './PedidosPagos.jsx';
import NotificacionesAdmin from './NotificacionesAdmin.jsx';
import ClientesFinales from './ClientesFinales.jsx';

const VISTAS = [
  {
    key: 'empresas',
    label: 'Empresas',
    description: 'Empresas, empleados y cuenta corriente.',
    component: Empresas,
  },
  {
    key: 'clientes',
    label: 'Clientes finales',
    description: 'Todos los clientes finales registrados en el sistema.',
    component: ClientesFinales,
  },
  {
    key: 'planes',
    label: 'Planes',
    description: 'Planes de vianda: gramaje, postre, bebida.',
    component: Planes,
  },
  {
    key: 'pagos',
    label: 'Pagos',
    description: 'Pedidos, pagos, saldos y resúmenes para cobrar.',
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
  const [searchParams, setSearchParams] = useSearchParams();
  const vistaActiva = getVistaActiva(searchParams.get('vista'));
  const vista = VISTAS.find(item => item.key === vistaActiva) || VISTAS[0];
  const VistaComponent = vista.component;

  const irA = (key) => setSearchParams({ vista: key });

  return (
    <div className="min-h-full min-w-0 overflow-x-hidden bg-gray-50">
      {/* Header sticky con tabs */}
      <div className="sticky top-0 z-20 border-b border-gray-200 bg-white px-4 md:px-6">
        <div className="mx-auto max-w-[1600px]">
          <div className="pt-3 pb-0">
            <p className="text-xs font-medium text-gray-500">Administración de clientes</p>
            <h1 className="text-2xl font-bold text-gray-900">Clientes</h1>
          </div>
          {/* Tabs */}
          <div className="flex gap-0 mt-3 -mx-1">
            {VISTAS.map(v => (
              <button
                key={v.key}
                onClick={() => irA(v.key)}
                className={`px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap
                  ${v.key === vistaActiva
                    ? 'border-brand-600 text-brand-700'
                    : 'border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300'}`}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <VistaComponent />
    </div>
  );
}
