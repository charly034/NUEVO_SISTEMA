import { query as dbQuery } from '../../database/connection.js';

const DIA_ORDEN = `CASE h.dia::text
  WHEN 'lunes' THEN 1 WHEN 'martes' THEN 2 WHEN 'miercoles' THEN 3
  WHEN 'jueves' THEN 4 WHEN 'viernes' THEN 5 WHEN 'sabado' THEN 6 WHEN 'domingo' THEN 7
END`;

export async function platosmasUsados({ limit = 20, desde, hasta } = {}) {
  const { rows } = await dbQuery(`
    SELECT p.id, p.nombre, p.tags,
           COUNT(h.id)::int        AS usos,
           MAX(h.fecha_servicio)   AS ultimo_uso,
           MIN(h.fecha_servicio)   AS primer_uso
    FROM platos p
    JOIN historial_uso_platos h ON h.plato_id = p.id
    WHERE ($1::date IS NULL OR h.fecha_servicio >= $1)
      AND ($2::date IS NULL OR h.fecha_servicio <= $2)
    GROUP BY p.id, p.nombre, p.tags
    ORDER BY usos DESC
    LIMIT $3
  `, [desde ?? null, hasta ?? null, limit]);
  return rows;
}

export async function distribucionTags({ desde, hasta } = {}) {
  const { rows } = await dbQuery(`
    SELECT tag, COUNT(*)::int AS usos
    FROM historial_uso_platos h
    JOIN platos p ON p.id = h.plato_id,
    unnest(p.tags) AS tag
    WHERE ($1::date IS NULL OR h.fecha_servicio >= $1)
      AND ($2::date IS NULL OR h.fecha_servicio <= $2)
    GROUP BY tag
    ORDER BY usos DESC
  `, [desde ?? null, hasta ?? null]);
  return rows;
}

export async function usoPorDia() {
  const { rows } = await dbQuery(`
    SELECT h.dia,
           COUNT(*)::int                  AS usos,
           COUNT(DISTINCT h.plato_id)::int AS platos_distintos
    FROM historial_uso_platos h
    GROUP BY h.dia
    ORDER BY ${DIA_ORDEN}
  `);
  return rows;
}

export async function tendenciaMensual() {
  const { rows } = await dbQuery(`
    SELECT TO_CHAR(fecha_servicio, 'YYYY-MM')   AS mes,
           COUNT(*)::int                         AS usos,
           COUNT(DISTINCT plato_id)::int          AS platos_distintos
    FROM historial_uso_platos
    GROUP BY mes
    ORDER BY mes
  `);
  return rows;
}

export async function topPlatosPorDia({ limit = 5 } = {}) {
  const { rows } = await dbQuery(`
    SELECT h.dia, p.id, p.nombre, p.tags, COUNT(*)::int AS usos
    FROM historial_uso_platos h
    JOIN platos p ON p.id = h.plato_id
    GROUP BY h.dia, p.id, p.nombre, p.tags
    ORDER BY h.dia, usos DESC
  `);
  const DIA_ORDEN = ['lunes','martes','miercoles','jueves','viernes','sabado','domingo'];
  const grouped = {};
  for (const row of rows) {
    if (!grouped[row.dia]) grouped[row.dia] = [];
    if (grouped[row.dia].length < limit) grouped[row.dia].push(row);
  }
  return Object.fromEntries(
    DIA_ORDEN.filter(d => grouped[d]).map(d => [d, grouped[d]])
  );
}

export async function resumenGeneral() {
  const { rows } = await dbQuery(`
    SELECT
      (SELECT COUNT(*)::int FROM platos WHERE activo = true)                       AS total_platos,
      (SELECT COUNT(*)::int FROM historial_uso_platos)                             AS total_usos,
      (SELECT COUNT(DISTINCT plato_id)::int FROM historial_uso_platos)             AS platos_usados,
      (SELECT COUNT(*)::int FROM menus_semanales)                                  AS total_semanas,
      (SELECT COUNT(*)::int FROM platos WHERE activo = true
        AND id NOT IN (SELECT DISTINCT plato_id FROM historial_uso_platos))        AS nunca_usados
  `);
  return rows[0];
}
