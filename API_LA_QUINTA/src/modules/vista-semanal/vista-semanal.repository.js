import { query } from '../../database/connection.js';

export const findMenu = async (menuSemanalId) => {
  const result = await query(
    'SELECT id, nombre, fecha_inicio, fecha_fin, estado FROM menus_semanales WHERE id = $1',
    [menuSemanalId]
  );
  return result.rows[0] || null;
};

// Slots 'especial' de la semana (canal vianda, editable) con el agregado de
// empresas activas resuelto en la misma query -- subquery correlacionada, no
// una query por celda, para evitar el N+1 ya identificado en revision.
export const findSlotsEspeciales = async (menuSemanalId) => {
  const result = await query(
    `SELECT msd.id AS slot_id, msd.dia::text AS dia, msd.opcion, msd.plato_id,
            p.nombre AS plato_nombre, msd.vianda_id, v.nombre_vianda,
            (
              SELECT COUNT(*)::int FROM empresas e
              WHERE e.activo = true
                AND (
                  NOT EXISTS (SELECT 1 FROM menu_empresa_visibilidad mev WHERE mev.menu_semanal_dia_id = msd.id)
                  OR EXISTS (SELECT 1 FROM menu_empresa_visibilidad mev WHERE mev.menu_semanal_dia_id = msd.id AND mev.empresa_id = e.id)
                )
                AND (
                  NOT EXISTS (SELECT 1 FROM plato_empresa_visibilidad pev WHERE pev.plato_id = p.id)
                  OR EXISTS (SELECT 1 FROM plato_empresa_visibilidad pev WHERE pev.plato_id = p.id AND pev.empresa_id = e.id)
                )
            ) AS empresas_activas,
            (
              SELECT COALESCE(json_agg(e.nombre ORDER BY e.nombre), '[]'::json) FROM empresas e
              WHERE e.activo = true
                AND (
                  NOT EXISTS (SELECT 1 FROM menu_empresa_visibilidad mev WHERE mev.menu_semanal_dia_id = msd.id)
                  OR EXISTS (SELECT 1 FROM menu_empresa_visibilidad mev WHERE mev.menu_semanal_dia_id = msd.id AND mev.empresa_id = e.id)
                )
                AND (
                  NOT EXISTS (SELECT 1 FROM plato_empresa_visibilidad pev WHERE pev.plato_id = p.id)
                  OR EXISTS (SELECT 1 FROM plato_empresa_visibilidad pev WHERE pev.plato_id = p.id AND pev.empresa_id = e.id)
                )
            ) AS empresas_nombres
     FROM menu_semanal_dias msd
     JOIN platos p ON p.id = msd.plato_id
     LEFT JOIN viandas v ON v.id = msd.vianda_id
     WHERE msd.menu_semanal_id = $1 AND msd.opcion IS NOT NULL
     ORDER BY msd.dia::text, msd.opcion ASC`,
    [menuSemanalId]
  );
  return result.rows;
};

// Reglas de disponibilidad local (canal por-kilo) relevantes para el rango de
// la semana: diario y dia_semana son recurrentes (siempre relevantes),
// fecha puntual solo si cae dentro del rango. Una sola query para toda la
// semana -- la expansion dia por dia se hace en el service, en memoria.
export const findDisponibilidadLocalSemana = async (fechaInicio, fechaFin) => {
  const result = await query(
    `SELECT p.id AS plato_id, pdl.patron, pdl.dia_semana::text AS dia_semana,
            to_char(pdl.fecha, 'YYYY-MM-DD') AS fecha
     FROM plato_disponibilidad_local pdl
     JOIN platos p ON p.id = pdl.plato_id
     WHERE p.activo = true
       AND (
         pdl.patron = 'diario'
         OR pdl.patron = 'dia_semana'
         OR (pdl.patron = 'fecha' AND pdl.fecha BETWEEN $1::date AND $2::date)
       )`,
    [fechaInicio, fechaFin]
  );
  return result.rows;
};
