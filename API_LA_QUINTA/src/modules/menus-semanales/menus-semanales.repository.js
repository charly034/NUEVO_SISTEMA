import { query } from '../../database/connection.js';
import { ORDEN_DIA_SQL as ORDEN_DIA } from '../../utils/fecha.js';

// ── Menús semanales ───────────────────────────────────────────────

export const findAll = async ({ limit = 10, offset = 0, desde, hasta } = {}) => {
  const conditions = [];
  const values = [];

  if (desde) { values.push(desde); conditions.push(`se.fecha_inicio >= $${values.length}`); }
  if (hasta) { values.push(hasta); conditions.push(`se.fecha_fin <= $${values.length}`); }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  values.push(limit, offset);

  const result = await query(
    `SELECT ms.id, ms.nombre, se.fecha_inicio, se.fecha_fin, ms.estado, ms.fecha_limite_pedidos, ms.publicado_at, ms.cerrado_at, ms.created_at, ms.updated_at,
      COALESCE(
        (SELECT json_agg(jsonb_build_object(
          'dia', d.dia,
          'platos', (
            SELECT json_agg(jsonb_build_object('opcion', msd2.opcion, 'plato_id', msd2.plato_id, 'plato_nombre', p.nombre))
            FROM menu_semanal_dias msd2
            JOIN platos p ON p.id = msd2.plato_id
            WHERE msd2.menu_semanal_id = ms.id AND msd2.dia = d.dia AND msd2.opcion IS NOT NULL
          )
        ))
        FROM (SELECT DISTINCT dia FROM menu_semanal_dias WHERE menu_semanal_id = ms.id AND opcion IS NOT NULL) d),
        '[]'::json
      ) AS dias,
      COALESCE(
        (SELECT json_agg(jsonb_build_object('dia', ss.dia, 'motivo', ss.motivo))
         FROM menu_semanal_sin_servicio ss WHERE ss.menu_semanal_id = ms.id),
        '[]'::json
      ) AS sin_servicio
     FROM menus_semanales ms
     JOIN semanas se ON se.id = ms.semana_id ${where}
     ORDER BY se.fecha_inicio DESC
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );
  return result.rows;
};

export const countAll = async ({ desde, hasta } = {}) => {
  const conditions = [];
  const values = [];

  if (desde) { values.push(desde); conditions.push(`se.fecha_inicio >= $${values.length}`); }
  if (hasta) { values.push(hasta); conditions.push(`se.fecha_fin <= $${values.length}`); }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await query(`SELECT COUNT(*) as total FROM menus_semanales ms JOIN semanas se ON se.id = ms.semana_id ${where}`, values);
  return parseInt(result.rows[0].total, 10);
};

export const findById = async (id) => {
  const result = await query(
    `SELECT ms.id, ms.nombre, se.fecha_inicio, se.fecha_fin, ms.estado, ms.fecha_limite_pedidos, ms.publicado_at, ms.cerrado_at, ms.created_at, ms.updated_at
     FROM menus_semanales ms JOIN semanas se ON se.id = ms.semana_id WHERE ms.id = $1`,
    [id]
  );
  return result.rows[0] || null;
};

// Devuelve el menú publicado activo (el más cercano a hoy hacia adelante)
export const findPublicadoActivo = async () => {
  const result = await query(
    `SELECT ms.id, ms.nombre, se.fecha_inicio, se.fecha_fin, ms.estado, ms.fecha_limite_pedidos, ms.publicado_at
     FROM menus_semanales ms JOIN semanas se ON se.id = ms.semana_id
     WHERE ms.estado = 'publicado' AND se.fecha_fin >= CURRENT_DATE
     ORDER BY
       CASE WHEN CURRENT_DATE BETWEEN se.fecha_inicio AND se.fecha_fin THEN 0 ELSE 1 END,
       se.fecha_inicio ASC
     LIMIT 1`
  );
  return result.rows[0] || null;
};

export const cambiarEstado = async (id, estado, extra = {}) => {
  const campos = { estado };
  if (estado === 'publicado') {
    campos.publicado_at = new Date().toISOString();
    campos.cerrado_at = null;
  }
  if (estado === 'cerrado') campos.cerrado_at = new Date().toISOString();
  if (extra.fecha_limite_pedidos !== undefined) campos.fecha_limite_pedidos = extra.fecha_limite_pedidos;

  const keys = Object.keys(campos);
  const vals = Object.values(campos);
  const set = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  vals.push(id);

  const result = await query(
    `WITH upd AS (
       UPDATE menus_semanales SET ${set}, updated_at = NOW() WHERE id = $${vals.length}
       RETURNING id, nombre, estado, semana_id, fecha_limite_pedidos, publicado_at, cerrado_at
     )
     SELECT upd.id, upd.nombre, upd.estado, se.fecha_inicio, se.fecha_fin,
            upd.fecha_limite_pedidos, upd.publicado_at, upd.cerrado_at
     FROM upd JOIN semanas se ON se.id = upd.semana_id`,
    vals
  );
  return result.rows[0] || null;
};

// Devuelve el menú completo con los días agrupados por día
// Cada día tiene un array de platos ordenados por opción (A, B, C...)
// También incluye los días sin servicio
export const findByIdWithDias = async (id) => {
  const menuResult = await query(
    `SELECT ms.id, ms.nombre, se.fecha_inicio, se.fecha_fin, ms.estado, ms.fecha_limite_pedidos, ms.created_at, ms.updated_at
     FROM menus_semanales ms JOIN semanas se ON se.id = ms.semana_id WHERE ms.id = $1`,
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
       WHERE msd.menu_semanal_id = $1 AND msd.opcion IS NOT NULL
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

// Guardia del 1-1 semana<->menu: ¿ya hay un menú para esta semana? Se resuelve por
// la fecha del lunes vía JOIN semanas (S4: menus_semanales ya no tiene fecha_inicio;
// el UNIQUE duro es sobre semana_id). Devuelve el menú existente o null.
export const findBySemanaInicio = async (fechaInicio) => {
  const result = await query(
    `SELECT ms.id, ms.nombre, se.fecha_inicio
     FROM menus_semanales ms JOIN semanas se ON se.id = ms.semana_id
     WHERE se.fecha_inicio = $1 LIMIT 1`,
    [fechaInicio]
  );
  return result.rows[0] || null;
};

// S4: el menú cuelga de `semanas` vía semana_id; el service resuelve la semana
// (getOrCreateByLunes) y pasa semana_id. RETURNING vía CTE+JOIN para exponer
// fecha_inicio/fecha_fin (del contrato) desde semanas.
export const create = async ({ nombre, semana_id, admin_id = null }) => {
  const result = await query(
    `WITH nuevo AS (
       INSERT INTO menus_semanales (nombre, semana_id, created_by_admin_id, updated_by_admin_id)
       VALUES ($1, $2, $3, $3)
       RETURNING id, nombre, semana_id, created_by_admin_id, updated_by_admin_id, created_at, updated_at
     )
     SELECT nuevo.id, nuevo.nombre, se.fecha_inicio, se.fecha_fin,
            nuevo.created_by_admin_id, nuevo.updated_by_admin_id, nuevo.created_at, nuevo.updated_at
     FROM nuevo JOIN semanas se ON se.id = nuevo.semana_id`,
    [nombre, semana_id, admin_id]
  );
  return result.rows[0];
};

// `fields` NO puede incluir fecha_inicio/fecha_fin (S4: no existen en la tabla); el
// service traduce un cambio de semana a `semana_id` antes de llamar. RETURNING vía CTE+JOIN.
export const update = async (id, fields, admin_id = null) => {
  const allFields = admin_id ? { ...fields, updated_by_admin_id: admin_id } : fields;
  const keys = Object.keys(allFields);
  const values = Object.values(allFields);
  const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');
  values.push(id);

  const result = await query(
    `WITH upd AS (
       UPDATE menus_semanales SET ${setClause}, updated_at = NOW() WHERE id = $${values.length}
       RETURNING id, nombre, semana_id, created_by_admin_id, updated_by_admin_id, created_at, updated_at
     )
     SELECT upd.id, upd.nombre, se.fecha_inicio, se.fecha_fin,
            upd.created_by_admin_id, upd.updated_by_admin_id, upd.created_at, upd.updated_at
     FROM upd JOIN semanas se ON se.id = upd.semana_id`,
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
     WHERE msd.menu_semanal_id = $1 AND msd.dia = $2 AND msd.opcion IS NOT NULL
     ORDER BY msd.opcion ASC`,
    [menuSemanalId, dia]
  );
  return result.rows;
};

export const agregarPlato = async (menuSemanalId, dia, opcion, platoId, {
  guarnicionModoOverride = null,
  guarnicionFijaOverrideId = null,
  salsaModoOverride = null,
  salsaFijaOverrideId = null,
} = {}) => {
  const result = await query(
    // categoria_id de "Especiales": desde el teardown Fase A toda fila de
    // especial creada debe llevar su categoria (los fijos van por otra via).
    `INSERT INTO menu_semanal_dias (menu_semanal_id, dia, opcion, plato_id, guarnicion_modo_override, guarnicion_fija_override_id, salsa_modo_override, salsa_fija_override_id, categoria_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, (SELECT id FROM categorias WHERE slug = 'especiales'))
     ON CONFLICT (menu_semanal_id, categoria_id, dia, opcion)
     DO UPDATE SET plato_id = EXCLUDED.plato_id,
       guarnicion_modo_override = EXCLUDED.guarnicion_modo_override,
       guarnicion_fija_override_id = EXCLUDED.guarnicion_fija_override_id,
       salsa_modo_override = EXCLUDED.salsa_modo_override,
       salsa_fija_override_id = EXCLUDED.salsa_fija_override_id,
       categoria_id = EXCLUDED.categoria_id,
       created_at = NOW()
     RETURNING id, dia, opcion, plato_id, guarnicion_modo_override, guarnicion_fija_override_id, salsa_modo_override, salsa_fija_override_id, created_at`,
    [menuSemanalId, dia, opcion, platoId, guarnicionModoOverride, guarnicionFijaOverrideId, salsaModoOverride, salsaFijaOverrideId]
  );
  return result.rows[0];
};

// Reemplaza la visibilidad de empresas de un slot ([] = todas las empresas)
export const setEmpresasSlot = async (client, slotId, empresaIds) => {
  await client.query('DELETE FROM menu_empresa_visibilidad WHERE menu_semanal_dia_id = $1', [slotId]);
  if (empresaIds.length > 0) {
    const values = empresaIds.map((eid, i) => `($1, $${i + 2})`).join(', ');
    await client.query(
      `INSERT INTO menu_empresa_visibilidad (menu_semanal_dia_id, empresa_id) VALUES ${values}`,
      [slotId, ...empresaIds]
    );
  }
};

// Devuelve los slots donde ya existe ese plato ese día, con sus empresa_ids
export const findPlatoEnDia = async (menuSemanalId, dia, platoId) => {
  const result = await query(
    `SELECT msd.id, msd.opcion,
       COALESCE(
         json_agg(mev.empresa_id) FILTER (WHERE mev.empresa_id IS NOT NULL),
         '[]'::json
       ) AS empresa_ids
     FROM menu_semanal_dias msd
     LEFT JOIN menu_empresa_visibilidad mev ON mev.menu_semanal_dia_id = msd.id
     WHERE msd.menu_semanal_id = $1 AND msd.dia = $2 AND msd.plato_id = $3
     GROUP BY msd.id, msd.opcion`,
    [menuSemanalId, dia, platoId]
  );
  return result.rows;
};

export const findSlotId = async (menuSemanalId, dia, opcion) => {
  const result = await query(
    'SELECT id FROM menu_semanal_dias WHERE menu_semanal_id = $1 AND dia = $2 AND opcion = $3',
    [menuSemanalId, dia, opcion]
  );
  return result.rows[0]?.id ?? null;
};

export const actualizarGuarnicionSlot = async (menuSemanalId, dia, opcion, guarnicionModoOverride, guarnicionFijaOverrideId = null) => {
  const result = await query(
    `UPDATE menu_semanal_dias
     SET guarnicion_modo_override = $4, guarnicion_fija_override_id = $5
     WHERE menu_semanal_id = $1 AND dia = $2 AND opcion = $3
     RETURNING id, dia, opcion, plato_id, guarnicion_modo_override, guarnicion_fija_override_id`,
    [menuSemanalId, dia, opcion, guarnicionModoOverride, guarnicionFijaOverrideId]
  );
  return result.rows[0] || null;
};

export const actualizarSalsaSlot = async (menuSemanalId, dia, opcion, salsaModoOverride, salsaFijaOverrideId = null) => {
  const result = await query(
    `UPDATE menu_semanal_dias
     SET salsa_modo_override = $4, salsa_fija_override_id = $5
     WHERE menu_semanal_id = $1 AND dia = $2 AND opcion = $3
     RETURNING id, dia, opcion, plato_id, salsa_modo_override, salsa_fija_override_id`,
    [menuSemanalId, dia, opcion, salsaModoOverride, salsaFijaOverrideId]
  );
  return result.rows[0] || null;
};

export const quitarPlato = async (menuSemanalId, dia, opcion) => {
  const result = await query(
    'DELETE FROM menu_semanal_dias WHERE menu_semanal_id = $1 AND dia = $2 AND opcion = $3 RETURNING id',
    [menuSemanalId, dia, opcion]
  );
  return result.rows[0] || null;
};

export const quitarTodosLosPlatosDelDia = async (menuSemanalId, dia) => {
  // Solo especiales: marcar un dia sin servicio no debe borrar fijos
  // materializados (teardown Fase C). La interaccion sin_servicio<->fijos se
  // define en Fase D.
  await query(
    'DELETE FROM menu_semanal_dias WHERE menu_semanal_id = $1 AND dia = $2 AND opcion IS NOT NULL',
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

// Mapa de dias sin servicio para un menu { lunes: motivo|null, ... }
export const findSinServicioMap = async (menuSemanalId) => {
  const result = await query(
    'SELECT dia, motivo FROM menu_semanal_sin_servicio WHERE menu_semanal_id = $1',
    [menuSemanalId]
  );
  const map = {};
  for (const r of result.rows) map[r.dia] = r.motivo ?? null;
  return map;
};

// ── Vista de diseño ───────────────────────────────────────────────
// Devuelve el menú con slots programados (enriquecidos con datos de la vianda resuelta:
// vianda del catálogo > overrides del slot, ver design doc de /office-hours), platos fijos
// por día del catálogo, y platos siempre disponibles -- candidatos para agregar al menú.

export const findDisenoById = async (id) => {
  const menuResult = await query(
    `SELECT ms.id, ms.nombre, se.fecha_inicio, se.fecha_fin, ms.estado, ms.fecha_limite_pedidos, ms.created_at, ms.updated_at
     FROM menus_semanales ms JOIN semanas se ON se.id = ms.semana_id WHERE ms.id = $1`,
    [id]
  );
  const menu = menuResult.rows[0];
  if (!menu) return null;

  const [slotsResult, sinServicioResult, fijosResult, siempreResult] = await Promise.all([
    // Slots programados en este menú. Resolución de guarnición/salsa efectiva:
    // override del slot > default de la vianda catálogo (ver cocina.repository.js SLOTS_SELECT
    // para el mismo patrón de precedencia).
    query(
      `SELECT
         msd.id, msd.dia, msd.opcion, msd.created_at,
         msd.guarnicion_modo_override, msd.guarnicion_fija_override_id,
         go.nombre     AS guarnicion_fija_override_nombre,
         msd.salsa_modo_override, msd.salsa_fija_override_id,
         so.nombre     AS salsa_fija_override_nombre,
         p.id          AS plato_id,
         p.nombre      AS plato_nombre,
         COALESCE(v.nombre_vianda, p.nombre) AS nombre_vianda,
         p.descripcion AS plato_descripcion,
         p.disponibilidad,
         p.vegetariano,
         p.calorias,
         p.foto_url,
         COALESCE(
           json_agg(e.id ORDER BY e.nombre) FILTER (WHERE e.id IS NOT NULL),
           '[]'::json
         ) AS empresa_ids,
         COALESCE(
           json_agg(e.nombre ORDER BY e.nombre) FILTER (WHERE e.id IS NOT NULL),
           '[]'::json
         ) AS empresa_nombres
       FROM menu_semanal_dias msd
       JOIN platos p ON p.id = msd.plato_id
       LEFT JOIN viandas v ON v.id = msd.vianda_id
       LEFT JOIN guarniciones go ON go.id = msd.guarnicion_fija_override_id
       LEFT JOIN salsas so ON so.id = msd.salsa_fija_override_id
       LEFT JOIN menu_empresa_visibilidad mev ON mev.menu_semanal_dia_id = msd.id
       LEFT JOIN empresas e ON e.id = mev.empresa_id AND e.activo = true
       WHERE msd.menu_semanal_id = $1 AND msd.opcion IS NOT NULL
       GROUP BY msd.id, msd.dia, msd.opcion, msd.created_at,
         msd.guarnicion_modo_override, msd.guarnicion_fija_override_id, go.nombre,
         msd.salsa_modo_override, msd.salsa_fija_override_id, so.nombre,
         p.id, p.nombre, v.nombre_vianda, p.descripcion, p.disponibilidad,
         p.vegetariano, p.calorias, p.foto_url
       ORDER BY ${ORDEN_DIA}, msd.opcion ASC`,
      [id]
    ),
    // Días sin servicio
    query(
      `SELECT dia, motivo FROM menu_semanal_sin_servicio WHERE menu_semanal_id = $1`,
      [id]
    ),
    // Platos fijos por día del catálogo con una vianda activa -- candidatos que aparecen
    // automáticamente para armar el menú (no todo plato fijo es necesariamente una vianda).
    query(
      `SELECT DISTINCT
         p.id, p.nombre, v.nombre_vianda, p.descripcion,
         p.disponibilidad, p.dia_fijo,
         v.guarnicion_id, v.salsa_id,
         p.vegetariano, p.calorias, p.foto_url
       FROM platos p
       JOIN viandas v ON v.plato_id = p.id AND v.activo = true
       WHERE p.activo = true AND p.disponibilidad = 'fijo_dia'
       ORDER BY p.nombre`,
      []
    ),
    // Platos siempre disponibles del catálogo con una vianda activa
    query(
      `SELECT DISTINCT
         p.id, p.nombre, v.nombre_vianda, p.descripcion,
         p.disponibilidad,
         v.guarnicion_id, v.salsa_id,
         p.vegetariano, p.calorias, p.foto_url
       FROM platos p
       JOIN viandas v ON v.plato_id = p.id AND v.activo = true
       WHERE p.activo = true AND p.disponibilidad = 'siempre'
       ORDER BY p.nombre`,
      []
    ),
  ]);

  const sinServicioMap = {};
  for (const r of sinServicioResult.rows) sinServicioMap[r.dia] = r.motivo ?? null;

  // Agrupar slots por día
  const slotsMap = {};
  for (const r of slotsResult.rows) {
    if (!slotsMap[r.dia]) slotsMap[r.dia] = [];
    slotsMap[r.dia].push({
      slot_id:                   r.id,
      opcion:                    r.opcion,
      guarnicion_modo_override:        r.guarnicion_modo_override,
      guarnicion_fija_override_id:     r.guarnicion_fija_override_id,
      guarnicion_fija_override_nombre: r.guarnicion_fija_override_nombre,
      salsa_modo_override:        r.salsa_modo_override,
      salsa_fija_override_id:     r.salsa_fija_override_id,
      salsa_fija_override_nombre: r.salsa_fija_override_nombre,
      empresa_ids:                     r.empresa_ids ?? [],
      empresa_nombres:                 r.empresa_nombres ?? [],
      plato: {
        id:              r.plato_id,
        nombre:          r.plato_nombre,
        nombre_vianda:   r.nombre_vianda,
        descripcion:     r.plato_descripcion,
        disponibilidad:  r.disponibilidad,
        vegetariano:     r.vegetariano,
        calorias:        r.calorias,
        foto_url:        r.foto_url,
      },
    });
  }

  return {
    menu,
    sin_servicio: sinServicioMap,
    slots: slotsMap,
    fijos_por_dia: fijosResult.rows,
    siempre: siempreResult.rows,
  };
};

// ── Historial ─────────────────────────────────────────────────────

export const historialPorPlato = async (platoId) => {
  const result = await query(
    `SELECT ms.id AS menu_semanal_id, ms.nombre, se.fecha_inicio, se.fecha_fin,
            msd.dia, msd.opcion
     FROM menu_semanal_dias msd
     JOIN menus_semanales ms ON ms.id = msd.menu_semanal_id
     JOIN semanas se ON se.id = ms.semana_id
     WHERE msd.plato_id = $1 AND msd.opcion IS NOT NULL
     ORDER BY se.fecha_inicio DESC, ${ORDEN_DIA}, msd.opcion ASC`,
    [platoId]
  );
  return result.rows;
};
