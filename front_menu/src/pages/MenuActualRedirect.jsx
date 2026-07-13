import { Navigate } from 'react-router-dom';
import { useMenusSemanales } from '../hooks/useMenus.js';
import { lunesActualISO } from '../lib/fechas.js';
import Spinner from '../components/ui/Spinner.jsx';

// Atajo "Menú de esta semana": resuelve el menú cuya semana está en curso
// (fecha_inicio = lunes de esta semana) y redirige a su Resumen. Si todavía no
// hay menú para esta semana, cae a la lista/calendario de Semanas.
export default function MenuActualRedirect() {
  const { data, isLoading } = useMenusSemanales({ limit: 200 });

  if (isLoading) {
    return <div className="flex justify-center py-16"><Spinner size="lg" /></div>;
  }

  const menus = data?.menus ?? [];
  const lunes = lunesActualISO();
  const actual = menus.find((m) => (m.fecha_inicio || '').slice(0, 10) === lunes);

  return <Navigate to={actual ? `/semanas/${actual.id}/resumen` : '/semanas'} replace />;
}
