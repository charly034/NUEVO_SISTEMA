import { query } from '../../database/connection.js';

// CRUD completo y rutas de viandas quedan para cuando se retome la UI (Viandas.jsx,
// bloqueada pendiente de revisión de diseño). Por ahora este repositorio expone solo
// lo que los módulos consumidores (menus-semanales, cocina) necesitan hoy.

export const existsActivaParaPlato = async (platoId) => {
  const result = await query(
    'SELECT 1 FROM viandas WHERE plato_id = $1 AND activo = true LIMIT 1',
    [platoId]
  );
  return result.rows.length > 0;
};
