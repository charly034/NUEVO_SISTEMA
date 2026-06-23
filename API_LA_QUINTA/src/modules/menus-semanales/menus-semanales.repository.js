import { query } from '../../database/connection.js';

const ORDEN_DIA = `CASE dia
  WHEN 'lunes'     THEN 1
  WHEN 'martes'    THEN 2
  WHEN 'miercoles' THEN 3
  WHEN 'jueves'    THEN 4
  WHEN 'viernes'   THEN 5
  WHEN 'sabado'    THEN 6
  WHEN 'domingo'   THEN 7
END`;

// ── Menús semanales ───────────────────────────────────────────────

export const findAll = async ({ limit = 10, offset = 0, desde, hasta } = {}) => {
  const conditions = [];
  const values = [];

  if (desde) { values.push(desde); conditions.push(`fecha_inicio >= $${values.length}`); }
  if (hasta) { values.push(hasta); conditions.push(`fecha_fin <= $${values.length}`); }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  values.push(limit, offset);

  const result = await query(
    `SELECT ms.id, ms.nombre, ms.fecha_inicio, ms.fecha_fin, ms.estado, ms.fecha_limite_pedidos, ms.publicado_at, ms.cerrado_at, ms.created_at, ms.updated_at,
      COALESCE(
        (SELECT json_agg(jsonb_build_object(
          'dia', d.dia,
          'platos', (
            SELECT json_agg(jsonb_build_object('opcion', msd2.opcion, 'plato_id', msd2.plato_id, 'plato_nombre', p.nombre))
            FROM menu_semanal_dias msd2
            JOIN platos p ON p.id = msd2.plato_id
            WHERE msd2.menu_semanal_id = ms.id AND msd2.dia = d.dia
          )
        ))
        FROM (SELECT DISTINCT dia FROM menu_semanal_dias WHERE menu_semanal_id = ms.id) d),
        '[]'::json
      ) AS dias,
      COALESCE(
        (SELECT json_agg(jsonb_build_object('dia', ss.dia, 'motivo', ss.motivo))
         FROM menu_semanal_sin_servicio ss WHERE ss.menu_semanal_id = ms.id),
        '[]'::json
      ) AS sin_servicio
     FROM menus_semanales ms ${where}
     ORDER BY ms.fecha_inicio DESC
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );
  return result.rows;
};

export const countAll = async ({ desde, hasta } = {}) => {
  const conditions = [];
  const values = [];

  if (desde) { values.push(desde); conditions.push(`fecha_inicio >= $${values.length}`); }
  if (hasta) { values.push(hasta); conditions.push(`fecha_fin <= $${values.length}`); }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await query(`SELECT COUNT(*) as total FROM menus_semanales ${where}`, values);
  return parseInt(result.rows[0].total, 10);
};

export const findById = async (id) => {
  const result = await query(
    'SELECT id, nombre, fecha_inicio, fecha_fin, estado, fecha_limite_pedidos, publicado_at, cerrado_at, created_at, updated_at FROM menus_semanales WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
};

// Devuelve el menú publicado activo (el más cercano a hoy hacia adelante)
export const findPublicadoActivo = async () => {
  const result = await query(
    `SELECT id, nombre, fecha_inicio, fecha_fin, estado, fecha_limite_pedidos, publicado_at
     FROM menus_semanales
     WHERE estado = 'publicado' AND fecha_fin >= CURRENT_DATE
     ORDER BY
       CASE WHEN CURRENT_DATE BETWEEN fecha_inicio AND fecha_fin THEN 0 ELSE 1 END,
       fecha_inicio ASC
     LIMIT 1`
  );
  return result.rows[0] || null;
};

export const cambiarEstado = async (id, estado, extra = {}) => {
  const campos = { estado };
  if (estado === 'publicado') campos.publicado_at = new Date().toISOString();
  if (estado === 'cerrado') campos.cerrado_at = new Date().toISOString();
  if (extra.fecha_limite_pedidos !== undefined) campos.fecha_limite_pedidos = extra.fecha_limite_pedidos;

  const keys = Object.keys(campos);
  const vals = Object.values(campos);
  const set = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  vals.push(id);

  const result = await query(
    `UPDATE menus_semanales SET ${set}, updated_at = NOW() WHERE id = $${vals.length}
     RETURNING id, nombre, estado, fecha_inicio, fecha_fin, fecha_limite_pedidos, publicado_at, cerrado_at`,
    vals
  );
  return result.rows[0] || null;
};

// Devuelve el menú completo con los días agrupados por día
// Cada día tiene un array de platos ordenados por opción (A, B, C...)
// También incluye los días sin servicio
export const findByIdWithDias = async (id) => {
  const menuResult = await query(
    'SELECT id, nombre, fecha_inicio, fecha_fin, created_at, updated_at FROM menus_semanales WHERE id = $1',
    [id]
  );
  const menu = menuResult.rows[0];
  if (!menu) return null;

  const [platosResult, sinServicioResult] = await Promise.all([
    query(
      `SELECT msd.id, msd.dia, msd.opcion, msd.plato_id, msd.created_at,
              p.nombre AS plato_nombre, p.descripcion AS plato_descripcion
       FROM menu_semanal_dias msd
       JOIN platos p ON p.id = msd.plato_id
       WHERE msd.menu_semanal_id = $1
       ORDER BY ${ORDEN_DIA}, msd.opcion ASC`,
      [id]
    ),
    query(
      `SELECT dia, motivo FROM menu_semanal_sin_servicio
       WHERE menu_semanal_id = $1
       ORDER BY ${ORDEN_DIA}`,
      [id]
    ),
  ]);

  // Agrupar platos por día
  const diasMap = {};
  for (const row of platosResult.rows) {
    if (!diasMap[row.dia]) diasMap[row.dia] = [];
    diasMap[row.dia].push({
      id: row.id,
      opcion: row.opcion,
      plato_id: row.plato_id,
      plato_nombre: row.plato_nombre,
      plato_descripcion: row.plato_descripcion,
      created_at: row.created_at,
    });
  }

  const dias = Object.entries(diasMap).map(([dia, platos]) => ({ dia, platos }));

  return {
    ...menu,
    dias,
    sin_servicio: sinServicioResult.rows,
  };
};

export const create = async ({ nombre, fecha_inicio, fecha_fin }) => {
  const result = await query(
    'INSERT INTO menus_semanales (nombre, fecha_inicio, fecha_fin) VALUES ($1, $2, $3) RETURNING id, nombre, fecha_inicio, fecha_fin, created_at, updated_at',
    [nombre, fecha_inicio, fecha_fin]
  );
  return result.rows[0];
};

export const update = async (id, fields) => {
  const keys = Object.keys(fields);
  const values = Object.values(fields);
  const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');
  values.push(id);

  const result = await query(
    `UPDATE menus_semanales SET ${setClause}, updated_at = NOW() WHERE id = $${values.length}
     RETURNING id, nombre, fecha_inicio, fecha_fin, created_at, updated_at`,
    values
  );
  return result.rows[0] || null;
};

export const remove = async (id) => {
  const result = await query('DELETE FROM menus_semanales WHERE id = $1 RETURNING id', [id]);
  return result.rows[0] || null;
};

// ── Platos por día ────────────────────────────────────────────────

export const findPlato = async (menuSemanalId, dia, opcion) => {
  const result = await query(
    'SELECT id, dia, opcion, plato_id FROM menu_semanal_dias WHERE menu_semanal_id = $1 AND dia = $2 AND opcion = $3',
    [menuSemanalId, dia, opcion]
  );
  return result.rows[0] || null;
};

export const findPlatosByDia = async (menuSemanalId, dia) => {
  const result = await query(
    `SELECT msd.id, msd.opcion, msd.plato_id, p.nombre, p.descripcion
     FROM menu_semanal_dias msd
     JOIN platos p ON p.id = msd.plato_id
     WHERE msd.menu_semanal_id = $1 AND msd.dia = $2
     ORDER BY msd.opcion ASC`,
    [menuSemanalId, dia]
  );
  return result.rows;
};

export const agregarPlato = async (menuSemanalId, dia, opcion, platoId) => {
  const result = await query(
    `INSERT INTO menu_semanal_dias (menu_semanal_id, dia, opcion, plato_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (menu_semanal_id, dia, opcion)
     DO UPDATE SET plato_id = EXCLUDED.plato_id, created_at = NOW()
     RETURNING id, dia, opcion, plato_id, created_at`,
    [menuSemanalId, dia, opcion, platoId]
  );
  return result.rows[0];
};

export const quitarPlato = async (menuSemanalId, dia, opcion) => {
  const result = await query(
    'DELETE FROM menu_semanal_dias WHERE menu_semanal_id = $1 AND dia = $2 AND opcion = $3 RETURNING id',
    [menuSemanalId, dia, opcion]
  );
  return result.rows[0] || null;
};

export const quitarTodosLosPlatosDelDia = async (menuSemanalId, dia) => {
  await query(
    'DELETE FROM menu_semanal_dias WHERE menu_semanal_id = $1 AND dia = $2',
    [menuSemanalId, dia]
  );
};

// ── Días sin servicio ─────────────────────────────────────────────

export const findSinServicio = async (menuSemanalId, dia) => {
  const result = await query(
    'SELECT id, dia, motivo FROM menu_semanal_sin_servicio WHERE menu_semanal_id = $1 AND dia = $2',
    [menuSemanalId, dia]
  );
  return result.rows[0] || null;
};

export const agregarSinServicio = async (menuSemanalId, dia, motivo) => {
  const result = await query(
    `INSERT INTO menu_semanal_sin_servicio (menu_semanal_id, dia, motivo)
     VALUES ($1, $2, $3)
     ON CONFLICT (menu_semanal_id, dia)
     DO UPDATE SET motivo = EXCLUDED.motivo, created_at = NOW()
     RETURNING id, dia, motivo, created_at`,
    [menuSemanalId, dia, motivo ?? null]
  );
  return result.rows[0];
};

export const quitarSinServicio = async (menuSemanalId, dia) => {
  const result = await query(
    'DELETE FROM menu_semanal_sin_servicio WHERE menu_semanal_id = $1 AND dia = $2 RETURNING id',
    [menuSemanalId, dia]
  );
  return result.rows[0] || null;
};

// ── Historial ─────────────────────────────────────────────────────

export const historialPorPlato = async (platoId) => {
  const result = await query(
    `SELECT ms.id AS menu_semanal_id, ms.nombre, ms.fecha_inicio, ms.fecha_fin,
            msd.dia, msd.opcion
     FROM menu_semanal_dias msd
     JOIN menus_semanales ms ON ms.id = msd.menu_semanal_id
     WHERE msd.plato_id = $1
     ORDER BY ms.fecha_inicio DESC, ${ORDEN_DIA}, msd.opcion ASC`,
    [platoId]
  );
  return result.rows;
};
