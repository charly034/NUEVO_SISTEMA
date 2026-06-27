import { query } from '../../database/connection.js';

const DIAS_ES = { 1: 'lunes', 2: 'martes', 3: 'miercoles', 4: 'jueves', 5: 'viernes', 6: 'sabado', 0: 'domingo' };
const execute = (db, text, params) => (
  typeof db === 'function' ? db(text, params) : db.query(text, params)
);

// ── Menú de la semana para el cliente ────────────────────────────────────────

export const menuSemana = async (semanaInicio) => {
  // Solo menús publicados
  const variablesRes = await query(
    `SELECT msd.dia::text AS dia, msd.opcion, msd.plato_id,
            p.nombre AS plato_nombre, p.descripcion, p.tags, p.tiene_guarnicion,
            ms.id AS menu_semanal_id, ms.nombre AS menu_nombre,
            ms.fecha_inicio, ms.fecha_fin, ms.estado,
            ms.fecha_limite_pedidos
     FROM menus_semanales ms
     JOIN menu_semanal_dias msd ON msd.menu_semanal_id = ms.id
     JOIN platos p ON p.id = msd.plato_id
     WHERE ms.fecha_inicio = $1 AND ms.estado = 'publicado' AND p.activo = true
     ORDER BY msd.dia::text, msd.opcion ASC`,
    [semanaInicio]
  );

  // Platos fijos activos
  const fijosRes = await query(
    `SELECT id AS plato_id, nombre AS plato_nombre, descripcion, tags, tiene_guarnicion
     FROM platos WHERE tipo = 'fijo' AND activo = true ORDER BY nombre ASC`
  );

  return { variables: variablesRes.rows, fijos: fijosRes.rows };
};

// Carga las variables y fijos de un menú dado su row de DB
function cargarPlatosFijos(db = query) {
  return execute(db,
    `SELECT id AS plato_id, nombre AS plato_nombre, descripcion, tags, tiene_guarnicion
     FROM platos WHERE tipo = 'fijo' AND activo = true ORDER BY nombre ASC`
  );
}

async function cargarDetallesMenu(menu, db = query, fijosPrecargados = null) {
  const variablesRes = await execute(db,
      `SELECT msd.dia::text AS dia, msd.opcion, msd.plato_id,
              p.nombre AS plato_nombre, p.descripcion, p.tags, p.tiene_guarnicion,
              ms.id AS menu_semanal_id
       FROM menus_semanales ms
       JOIN menu_semanal_dias msd ON msd.menu_semanal_id = ms.id
       JOIN platos p ON p.id = msd.plato_id
       WHERE ms.id = $1 AND p.activo = true
       ORDER BY msd.dia::text, msd.opcion ASC`,
      [menu.id]
    );
  const fijos = fijosPrecargados || (await cargarPlatosFijos(db)).rows;
  return { ...menu, variables: variablesRes.rows, fijos };
}

// Devuelve todos los menús publicados vigentes (fecha_fin >= hoy), ordenados por fecha_inicio
export const menusPublicadosList = async () => {
  const result = await query(
    `SELECT id, nombre, fecha_inicio, fecha_fin, estado, fecha_limite_pedidos, publicado_at,
            COALESCE((
              SELECT json_agg(json_build_object('dia', ss.dia, 'motivo', ss.motivo))
              FROM menu_semanal_sin_servicio ss
              WHERE ss.menu_semanal_id = menus_semanales.id
            ), '[]'::json) AS sin_servicio
     FROM menus_semanales
     WHERE estado IN ('publicado', 'cerrado')
       AND fecha_inicio >= date_trunc('week', CURRENT_DATE)::date - INTERVAL '2 weeks'
     ORDER BY fecha_inicio ASC`
  );
  // Cargar platos de todos los menús en paralelo
  const fijosRes = await cargarPlatosFijos();
  return Promise.all(result.rows.map(m => cargarDetallesMenu(m, query, fijosRes.rows)));
};

// Devuelve un menú publicado específico por su ID (para validar al guardar pedido)
export const menuActivoPorId = async (id, db = query) => {
  const menuRes = await execute(db,
    `SELECT id, nombre, fecha_inicio, fecha_fin, estado, fecha_limite_pedidos,
            COALESCE((
              SELECT json_agg(json_build_object('dia', ss.dia, 'motivo', ss.motivo))
              FROM menu_semanal_sin_servicio ss
              WHERE ss.menu_semanal_id = menus_semanales.id
            ), '[]'::json) AS sin_servicio
     FROM menus_semanales
     WHERE id = $1 AND estado = 'publicado' AND fecha_fin >= CURRENT_DATE`,
    [id]
  );
  const menu = menuRes.rows[0];
  if (!menu) return null;
  return cargarDetallesMenu(menu, db);
};

export const menuPublicadoPorSemana = async (semanaId, db = query) => {
  const menuRes = await execute(db,
    `SELECT id, nombre, fecha_inicio, fecha_fin, estado, fecha_limite_pedidos,
            COALESCE((
              SELECT json_agg(json_build_object('dia', ss.dia, 'motivo', ss.motivo))
              FROM menu_semanal_sin_servicio ss
              WHERE ss.menu_semanal_id = menus_semanales.id
            ), '[]'::json) AS sin_servicio
     FROM menus_semanales
     WHERE estado = 'publicado'
       AND fecha_fin >= CURRENT_DATE
       AND (
        id::text = $1
        OR fecha_inicio = CASE
          WHEN $1 ~ '^\\d{4}-\\d{2}-\\d{2}$' THEN $1::date
          ELSE NULL
        END
       )
     LIMIT 1`,
    [String(semanaId)]
  );
  const menu = menuRes.rows[0];
  if (!menu) return null;
  return cargarDetallesMenu(menu, db);
};

// Mantener por compatibilidad con menuHoy y otros usos internos
export const menuActivo = async (db = query) => {
  const menuRes = await execute(db,
    `SELECT id, nombre, fecha_inicio, fecha_fin, estado, fecha_limite_pedidos,
            COALESCE((
              SELECT json_agg(json_build_object('dia', ss.dia, 'motivo', ss.motivo))
              FROM menu_semanal_sin_servicio ss
              WHERE ss.menu_semanal_id = menus_semanales.id
            ), '[]'::json) AS sin_servicio
     FROM menus_semanales
     WHERE estado = 'publicado' AND fecha_fin >= CURRENT_DATE
     ORDER BY
       CASE WHEN CURRENT_DATE BETWEEN fecha_inicio AND fecha_fin THEN 0 ELSE 1 END,
       fecha_inicio ASC
     LIMIT 1`
  );
  const menu = menuRes.rows[0];
  if (!menu) return null;
  return cargarDetallesMenu(menu, db);
};

export const menuHoy = async () => {
  const hoy = new Date();
  const diaStr = DIAS_ES[hoy.getDay()];
  const fechaHoy = hoy.toISOString().split('T')[0];

  const variablesRes = await query(
    `SELECT msd.dia::text AS dia, msd.opcion, msd.plato_id,
            p.nombre AS plato_nombre, p.descripcion, p.tags, p.tiene_guarnicion,
            ms.id AS menu_semanal_id
     FROM menus_semanales ms
     JOIN menu_semanal_dias msd ON msd.menu_semanal_id = ms.id
     JOIN platos p ON p.id = msd.plato_id
     WHERE ms.fecha_inicio <= $2 AND ms.fecha_fin >= $2
       AND msd.dia::text = $1 AND p.activo = true
       AND NOT EXISTS (
         SELECT 1 FROM menu_semanal_sin_servicio ss
         WHERE ss.menu_semanal_id = ms.id AND ss.dia::text = $1
       )
     ORDER BY msd.opcion ASC`,
    [diaStr, fechaHoy]
  );

  const fijosRes = await query(
    `SELECT id AS plato_id, nombre AS plato_nombre, descripcion, tags, tiene_guarnicion
     FROM platos WHERE tipo = 'fijo' AND activo = true ORDER BY nombre ASC`
  );

  return { dia: diaStr, fecha: fechaHoy, variables: variablesRes.rows, fijos: fijosRes.rows };
};

// ── Pedidos ───────────────────────────────────────────────────────────────────

export const findPedidoByEmpleadoSemana = async (empleadoId, semanaInicio, db = query) => {
  const r = await execute(db,
    `SELECT p.*, json_agg(
       json_build_object(
         'id', pi.id, 'dia', pi.dia, 'plato_id', pi.plato_id,
         'plato_nombre', pl.nombre, 'opcion', pi.opcion,
         'tiene_guarnicion', pl.tiene_guarnicion,
         'guarnicion_id', pi.guarnicion_id, 'guarnicion_nombre', g.nombre,
         'sin_pedido', COALESCE(pi.sin_pedido, false), 'origen', pi.origen,
         'notas', pi.notas
       ) ORDER BY pi.dia
     ) FILTER (WHERE pi.id IS NOT NULL) AS items
     FROM pedidos p
     LEFT JOIN pedido_items pi ON pi.pedido_id = p.id
     LEFT JOIN platos pl ON pl.id = pi.plato_id
     LEFT JOIN guarniciones g ON g.id = pi.guarnicion_id
     WHERE p.empleado_id = $1 AND p.semana_inicio = $2
     GROUP BY p.id`,
    [empleadoId, semanaInicio]
  );
  return r.rows[0] || null;
};

export const findPedidoCabeceraById = async (id, db = query) => {
  const r = await execute(db,
    `SELECT id, empleado_id, empresa_id, menu_semanal_id, semana_inicio, estado
     FROM pedidos
     WHERE id = $1`,
    [id]
  );
  return r.rows[0] || null;
};

export const registrarEvento = async ({
  pedido_id,
  tipo,
  actor_tipo,
  actor_id = null,
  actor_nombre = null,
  estado_anterior = null,
  estado_nuevo = null,
  resumen = null,
  metadata = {},
}, db = query) => {
  const r = await execute(db,
    `INSERT INTO pedido_eventos (
       pedido_id, tipo, actor_tipo, actor_id, actor_nombre,
       estado_anterior, estado_nuevo, resumen, metadata
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb)
     RETURNING id, pedido_id, tipo, actor_tipo, actor_id, actor_nombre,
       estado_anterior, estado_nuevo, resumen, metadata, created_at`,
    [
      pedido_id,
      tipo,
      actor_tipo,
      actor_id,
      actor_nombre,
      estado_anterior,
      estado_nuevo,
      resumen,
      JSON.stringify(metadata || {}),
    ]
  );
  return r.rows[0];
};

export const findEventosByPedidoIds = async (pedidoIds, db = query) => {
  if (!pedidoIds.length) return {};
  const r = await execute(db,
    `SELECT id, pedido_id, tipo, actor_tipo, actor_id, actor_nombre,
            estado_anterior, estado_nuevo, resumen, metadata, created_at
     FROM pedido_eventos
     WHERE pedido_id = ANY($1::int[])
     ORDER BY created_at ASC, id ASC`,
    [pedidoIds]
  );
  return r.rows.reduce((acc, evento) => {
    if (!acc[evento.pedido_id]) acc[evento.pedido_id] = [];
    acc[evento.pedido_id].push(evento);
    return acc;
  }, {});
};

export const findById = async (id) => {
  const r = await query(
    `SELECT p.id, p.semana_inicio, p.estado, p.observaciones, p.created_at,
            p.empleado_id, p.empresa_id,
            e.nombre AS empleado_nombre, e.apellido AS empleado_apellido, e.email,
            emp.nombre AS empresa_nombre,
            json_agg(
              json_build_object(
                'id', pi.id, 'dia', pi.dia, 'plato_id', pi.plato_id,
                'plato_nombre', pl.nombre, 'opcion', pi.opcion,
                'tiene_guarnicion', pl.tiene_guarnicion,
                'guarnicion_id', pi.guarnicion_id, 'guarnicion_nombre', g.nombre,
                'sin_pedido', COALESCE(pi.sin_pedido, false), 'origen', pi.origen,
                'notas', pi.notas
              ) ORDER BY pi.dia
            ) FILTER (WHERE pi.id IS NOT NULL) AS items
     FROM pedidos p
     JOIN empleados e ON e.id = p.empleado_id
     JOIN empresas emp ON emp.id = p.empresa_id
     LEFT JOIN pedido_items pi ON pi.pedido_id = p.id
     LEFT JOIN platos pl ON pl.id = pi.plato_id
     LEFT JOIN guarniciones g ON g.id = pi.guarnicion_id
     WHERE p.id = $1
     GROUP BY p.id, e.id, emp.id`,
    [id]
  );
  const pedido = r.rows[0] || null;
  if (!pedido) return null;
  const eventosPorPedido = await findEventosByPedidoIds([pedido.id]);
  return { ...pedido, eventos: eventosPorPedido[pedido.id] ?? [] };
};

export const findAll = async ({ empresa_id, semana_inicio, estado, limit = 100, offset = 0 } = {}) => {
  const conds = [];
  const vals = [];
  if (empresa_id) { vals.push(empresa_id); conds.push(`p.empresa_id = $${vals.length}`); }
  if (semana_inicio) { vals.push(semana_inicio); conds.push(`p.semana_inicio = $${vals.length}`); }
  if (estado) { vals.push(estado); conds.push(`p.estado = $${vals.length}`); }

  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  vals.push(limit, offset);

  const r = await query(
    `SELECT p.id, p.semana_inicio, p.estado, p.observaciones, p.created_at,
            p.empleado_id, p.empresa_id,
            e.nombre AS empleado_nombre, e.apellido AS empleado_apellido, e.email,
            emp.nombre AS empresa_nombre,
            json_agg(
              json_build_object(
                'id', pi.id, 'dia', pi.dia, 'plato_id', pi.plato_id,
                'plato_nombre', pl.nombre, 'opcion', pi.opcion,
                'tiene_guarnicion', pl.tiene_guarnicion,
                'guarnicion_id', pi.guarnicion_id, 'guarnicion_nombre', g.nombre,
                'sin_pedido', COALESCE(pi.sin_pedido, false), 'origen', pi.origen,
                'notas', pi.notas
              ) ORDER BY pi.dia
            ) FILTER (WHERE pi.id IS NOT NULL) AS items
     FROM pedidos p
     JOIN empleados e ON e.id = p.empleado_id
     JOIN empresas emp ON emp.id = p.empresa_id
     LEFT JOIN pedido_items pi ON pi.pedido_id = p.id
     LEFT JOIN platos pl ON pl.id = pi.plato_id
     LEFT JOIN guarniciones g ON g.id = pi.guarnicion_id
     ${where}
     GROUP BY p.id, e.id, emp.id
     ORDER BY p.created_at DESC
     LIMIT $${vals.length - 1} OFFSET $${vals.length}`,
    vals
  );
  const eventosPorPedido = await findEventosByPedidoIds(r.rows.map(p => p.id));
  return r.rows.map(p => ({ ...p, eventos: eventosPorPedido[p.id] ?? [] }));
};

export const upsertPedido = async ({ empleado_id, empresa_id, menu_semanal_id, semana_inicio, observaciones }, db = query) => {
  const r = await execute(db,
    `INSERT INTO pedidos (empleado_id, empresa_id, menu_semanal_id, semana_inicio, observaciones)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (empleado_id, semana_inicio)
     DO UPDATE SET menu_semanal_id = EXCLUDED.menu_semanal_id,
       observaciones = EXCLUDED.observaciones,
       estado = 'pendiente',
       updated_at = NOW()
     RETURNING id, empleado_id, empresa_id, menu_semanal_id, semana_inicio, estado, observaciones, created_at, updated_at`,
    [empleado_id, empresa_id, menu_semanal_id || null, semana_inicio, observaciones || null]
  );
  return r.rows[0];
};

export const upsertItem = async (
  pedidoId,
  { dia, plato_id, opcion, guarnicion_id, notas, sin_pedido = false, origen = null },
  db = query,
) => {
  const r = await execute(db,
    `INSERT INTO pedido_items (pedido_id, dia, plato_id, opcion, guarnicion_id, notas, sin_pedido, origen)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (pedido_id, dia)
     DO UPDATE SET plato_id = EXCLUDED.plato_id, opcion = EXCLUDED.opcion,
       guarnicion_id = EXCLUDED.guarnicion_id, notas = EXCLUDED.notas,
       sin_pedido = EXCLUDED.sin_pedido, origen = EXCLUDED.origen,
       updated_at = NOW()
     RETURNING *`,
    [
      pedidoId,
      dia,
      plato_id || null,
      opcion || null,
      guarnicion_id || null,
      notas || null,
      Boolean(sin_pedido),
      origen || null,
    ]
  );
  return r.rows[0];
};

export const deleteItem = async (pedidoId, dia) => {
  await query('DELETE FROM pedido_items WHERE pedido_id = $1 AND dia = $2', [pedidoId, dia]);
};

export const deleteItemsNotInDays = async (pedidoId, dias, db = query) => {
  await execute(
    db,
    'DELETE FROM pedido_items WHERE pedido_id = $1 AND NOT (dia = ANY($2::varchar[]))',
    [pedidoId, dias]
  );
};

export const validateItemForMenu = async (menuId, item, db = query) => {
  const result = await execute(
    db,
    `SELECT p.id, p.nombre, p.tipo, p.activo, p.tiene_guarnicion,
            EXISTS (
              SELECT 1
              FROM menu_semanal_dias msd
              WHERE msd.menu_semanal_id = $2
                AND msd.dia::text = $3
                AND msd.plato_id = p.id
                AND msd.opcion = $4
            ) AS pertenece_menu,
            CASE WHEN $5::integer IS NULL THEN true ELSE EXISTS (
              SELECT 1 FROM guarniciones g WHERE g.id = $5 AND g.activo = true
                AND p.tiene_guarnicion = true
            ) END AS guarnicion_valida,
            EXISTS (
              SELECT 1 FROM menu_semanal_sin_servicio ss
              WHERE ss.menu_semanal_id = $2 AND ss.dia::text = $3
            ) AS sin_servicio
     FROM platos p
     WHERE p.id = $1`,
    [item.plato_id, menuId, item.dia, item.opcion, item.guarnicion_id || null]
  );
  return result.rows[0] || null;
};

export const findHistorialByEmpleado = async (empleadoId, limit = 16) => {
  const r = await query(
    `SELECT p.id, p.semana_inicio, p.estado, p.observaciones, p.created_at,
            ms.nombre AS menu_nombre, ms.fecha_fin,
            json_agg(
              json_build_object(
                'dia', pi.dia, 'plato_id', pi.plato_id,
                'plato_nombre', pl.nombre, 'opcion', pi.opcion,
                'guarnicion_nombre', g.nombre,
                'sin_pedido', COALESCE(pi.sin_pedido, false), 'origen', pi.origen
              ) ORDER BY pi.dia
            ) FILTER (WHERE pi.id IS NOT NULL) AS items
     FROM pedidos p
     LEFT JOIN menus_semanales ms ON ms.id = p.menu_semanal_id
     LEFT JOIN pedido_items pi ON pi.pedido_id = p.id
     LEFT JOIN platos pl ON pl.id = pi.plato_id
     LEFT JOIN guarniciones g ON g.id = pi.guarnicion_id
     WHERE p.empleado_id = $1
     GROUP BY p.id, ms.id
     ORDER BY p.semana_inicio DESC
     LIMIT $2`,
    [empleadoId, limit]
  );
  return r.rows;
};

export const findSugerenciasByEmpleado = async (empleadoId) => {
  const r = await query(
    `SELECT id, empleado_id, empresa_id, semana_inicio, ideas, comentario, created_at, updated_at
     FROM pedido_sugerencias
     WHERE empleado_id = $1
     ORDER BY semana_inicio DESC`,
    [empleadoId]
  );
  return r.rows;
};

export const findSugerenciasAdmin = async ({ empresa_id, semana_inicio, limit = 100, offset = 0 } = {}) => {
  const conds = [];
  const vals = [];
  if (empresa_id) { vals.push(empresa_id); conds.push(`ps.empresa_id = $${vals.length}`); }
  if (semana_inicio) { vals.push(semana_inicio); conds.push(`ps.semana_inicio = $${vals.length}`); }

  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  vals.push(limit, offset);

  const r = await query(
    `SELECT ps.id, ps.empleado_id, ps.empresa_id, ps.semana_inicio,
            ps.ideas, ps.comentario, ps.created_at, ps.updated_at,
            e.nombre AS empleado_nombre, e.apellido AS empleado_apellido, e.email,
            emp.nombre AS empresa_nombre
     FROM pedido_sugerencias ps
     JOIN empleados e ON e.id = ps.empleado_id
     JOIN empresas emp ON emp.id = ps.empresa_id
     ${where}
     ORDER BY ps.updated_at DESC, ps.created_at DESC
     LIMIT $${vals.length - 1} OFFSET $${vals.length}`,
    vals
  );
  return r.rows;
};

export const upsertSugerencia = async ({
  empleado_id,
  empresa_id,
  semana_inicio,
  ideas,
  comentario,
}, db = query) => {
  const r = await execute(db,
    `INSERT INTO pedido_sugerencias (
       empleado_id, empresa_id, semana_inicio, ideas, comentario
     )
     VALUES ($1, $2, $3, $4::jsonb, $5)
     ON CONFLICT (empleado_id, semana_inicio)
     DO UPDATE SET
       empresa_id = EXCLUDED.empresa_id,
       ideas = EXCLUDED.ideas,
       comentario = EXCLUDED.comentario,
       updated_at = NOW()
     RETURNING id, empleado_id, empresa_id, semana_inicio, ideas, comentario, created_at, updated_at`,
    [
      empleado_id,
      empresa_id,
      semana_inicio,
      JSON.stringify(ideas || []),
      comentario || null,
    ]
  );
  return r.rows[0];
};

export const cancelarPedidoByEmpleado = async (empleadoId, semanaInicio, db = query) => {
  const r = await execute(db,
    `WITH anterior AS (
       SELECT id, estado AS estado_anterior
       FROM pedidos
       WHERE empleado_id = $1 AND semana_inicio = $2
         AND estado IN ('pendiente', 'en_proceso')
       FOR UPDATE
     )
     UPDATE pedidos p
     SET estado = 'cancelado', updated_at = NOW()
     FROM anterior a
     WHERE p.id = a.id
     RETURNING p.id, a.estado_anterior::text, p.estado, p.semana_inicio`,
    [empleadoId, semanaInicio]
  );
  if (!r.rows[0]) return null;
  await execute(db, 'DELETE FROM pedido_items WHERE pedido_id = $1', [r.rows[0].id]);
  return r.rows[0];
};

export const updateEstado = async (id, estado, db = query) => {
  const r = await execute(db,
    `UPDATE pedidos SET estado = $1, updated_at = NOW() WHERE id = $2
     RETURNING id, estado, semana_inicio, empleado_id, empresa_id`,
    [estado, id]
  );
  return r.rows[0] || null;
};

export const touchPedido = async (id, db = query) => {
  const r = await execute(db,
    `UPDATE pedidos SET updated_at = NOW() WHERE id = $1
     RETURNING id, empleado_id, empresa_id, menu_semanal_id, semana_inicio, estado, observaciones, created_at, updated_at`,
    [id]
  );
  return r.rows[0] || null;
};
