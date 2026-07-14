import { query } from '../../database/connection.js';
import { filtroVisibilidadSlot, filtroVisibilidadPlato, filtroVisibilidadFijoSemana } from '../../utils/visibilidadEmpresa.js';

const DIAS_ES = { 1: 'lunes', 2: 'martes', 3: 'miercoles', 4: 'jueves', 5: 'viernes', 6: 'sabado', 0: 'domingo' };
const execute = (db, text, params) => (
  typeof db === 'function' ? db(text, params) : db.query(text, params)
);

// Filtro de visibilidad por empresa (ver utils/visibilidadEmpresa.js). En
// menuSemana/cargarDetallesMenu el parametro empresaId siempre va en $2.
const FILTRO_VISIBILIDAD_SLOT = filtroVisibilidadSlot(2);
const FILTRO_VISIBILIDAD_PLATO = filtroVisibilidadPlato(2);

// Resolución de guarnición/salsa efectiva de un slot: override del slot > default de
// la vianda del catálogo (mismo patrón de precedencia que cocina.repository.js).
// 'libre' de guarnición no viene de la vianda (que solo fija una o ninguna) sino del
// booleano legacy tiene_guarnicion: plato sin guarnición fija pero que sí admite que
// el empleado elija una del catálogo general. Salsa no tiene ese arrastre histórico,
// pero sí puede ser 'libre' como default de la vianda (v.salsa_libre) -- ver
// create-viandas-table para por qué salsa necesitó su propio campo en vez de un
// legacy booleano.
//
// RESOLUCIÓN ATÓMICA POR CAPA (plan-eng-review T2/T4): cada capa aporta modo+id como
// bloque indivisible, en orden de precedencia: excepción por empresa (emo) → override
// de celda (msd) → vianda (v) → plato (p) → sin. Si una capa gana el modo, el id
// también sale de esa capa, NO de un COALESCE que mezclaría el id de una con el modo
// de otra ("fija con la guarnición de otra capa"). La validación al escribir garantiza
// fija ⇒ id no-nulo. NOTA: cada expresión de id se repite en el JOIN de gf/sf porque
// SQL no deja referenciar el alias del SELECT en el ON.
//
// CAPA EMPRESA (T4): emo es el override de guarnición/salsa POR EMPRESA de esta celda.
// El JOIN (ver VIANDA_SLOT_JOINS) une por claves de negocio + empresa ($2) y aplica la
// GUARDA ANTI-RANCIO emo.plato_id_origen = msd.plato_id: si la rotación cambió el plato
// del slot, la excepción no matchea y no se aplica (nunca impone p.ej. puré sobre
// pescado). Con empresa=NULL (admin/cocina) emo nunca matchea → resolución base.
const VIANDA_SLOT_COLS = `
            COALESCE(v.nombre_vianda, p.nombre) AS nombre_vianda,
            CASE
              WHEN emo.guarnicion_modo_override IS NOT NULL THEN emo.guarnicion_modo_override
              WHEN msd.guarnicion_modo_override IS NOT NULL THEN msd.guarnicion_modo_override
              WHEN v.guarnicion_id IS NOT NULL THEN 'fija'
              WHEN p.tiene_guarnicion THEN 'libre'
              ELSE 'sin_guarnicion'
            END AS guarnicion_modo,
            CASE
              WHEN emo.guarnicion_modo_override IS NOT NULL THEN emo.guarnicion_fija_override_id
              WHEN msd.guarnicion_modo_override IS NOT NULL THEN msd.guarnicion_fija_override_id
              ELSE v.guarnicion_id
            END AS guarnicion_fija_id,
            gf.nombre AS guarnicion_fija_nombre,
            CASE
              WHEN emo.salsa_modo_override IS NOT NULL THEN emo.salsa_modo_override
              WHEN msd.salsa_modo_override IS NOT NULL THEN msd.salsa_modo_override
              WHEN v.salsa_id IS NOT NULL THEN 'fija'
              WHEN v.salsa_libre THEN 'libre'
              ELSE 'sin_salsa'
            END AS salsa_modo,
            CASE
              WHEN emo.salsa_modo_override IS NOT NULL THEN emo.salsa_fija_override_id
              WHEN msd.salsa_modo_override IS NOT NULL THEN msd.salsa_fija_override_id
              ELSE v.salsa_id
            END AS salsa_fija_id,
            sf.nombre AS salsa_fija_nombre`;
const VIANDA_SLOT_JOINS = `
     LEFT JOIN viandas v ON v.id = msd.vianda_id
     LEFT JOIN menu_semanal_dia_empresa_override emo
       ON emo.menu_semanal_id = msd.menu_semanal_id
      AND emo.categoria_id = msd.categoria_id
      AND emo.dia IS NOT DISTINCT FROM msd.dia
      AND emo.opcion IS NOT DISTINCT FROM msd.opcion
      AND emo.empresa_id = $2
      AND emo.plato_id_origen = msd.plato_id
     LEFT JOIN guarniciones gf ON gf.id = CASE
       WHEN emo.guarnicion_modo_override IS NOT NULL THEN emo.guarnicion_fija_override_id
       WHEN msd.guarnicion_modo_override IS NOT NULL THEN msd.guarnicion_fija_override_id
       ELSE v.guarnicion_id END
     LEFT JOIN salsas sf ON sf.id = CASE
       WHEN emo.salsa_modo_override IS NOT NULL THEN emo.salsa_fija_override_id
       WHEN msd.salsa_modo_override IS NOT NULL THEN msd.salsa_fija_override_id
       ELSE v.salsa_id END`;

// Exportados para el test de regresión byte-idéntico (shadow-read): el test compara
// la fórmula anterior (per-columna, congelada como literal) contra ESTA (atómica)
// sobre los menús reales, y valida overrides sintéticos bien formados.
export { VIANDA_SLOT_COLS, VIANDA_SLOT_JOINS };

// ── Menú de la semana para el cliente ────────────────────────────────────────

export const menuSemana = async (semanaInicio, empresaId = null) => {
  // La visibilidad de fijos ahora es por semana (menu_semanal_fijos_visibilidad,
  // ver migracion 1719000073000), asi que cargarPlatosFijos necesita saber
  // el menu_semanal_id de esta semana -- lo resolvemos con una consulta chica
  // aparte porque, si la semana no tiene NINGUN especial todavia, variablesRes
  // puede venir vacio y nunca exponer ms.id.
  const menuRow = await query(
    `SELECT id FROM menus_semanales WHERE fecha_inicio = $1 AND estado = 'publicado' LIMIT 1`,
    [semanaInicio]
  );
  const menuSemanalId = menuRow.rows[0]?.id ?? null;

  const variablesRes = await query(
    `SELECT msd.dia::text AS dia, msd.opcion, msd.plato_id,
            p.nombre AS plato_nombre, p.descripcion, p.descripcion_larga,
            p.tags, p.tiene_guarnicion, p.vegetariano,
            p.calorias, p.alergenos, p.foto_url,${VIANDA_SLOT_COLS}
            , ms.id AS menu_semanal_id, ms.nombre AS menu_nombre,
            ms.fecha_inicio, ms.fecha_fin, ms.estado,
            ms.fecha_limite_pedidos
     FROM menus_semanales ms
     JOIN menu_semanal_dias msd ON msd.menu_semanal_id = ms.id
     JOIN platos p ON p.id = msd.plato_id${VIANDA_SLOT_JOINS}
     WHERE ms.fecha_inicio = $1 AND ms.estado = 'publicado' AND p.activo = true
       AND msd.opcion IS NOT NULL  -- solo especiales/opcion-based; los fijos (opcion NULL) los trae cargarPlatosFijos (teardown Fase C)
       AND ${FILTRO_VISIBILIDAD_SLOT}
       AND ${FILTRO_VISIBILIDAD_PLATO}
     ORDER BY msd.dia::text, msd.opcion ASC`,
    [semanaInicio, empresaId]
  );

  const fijosRes = await cargarPlatosFijosDesdeMenu(query, empresaId, menuSemanalId);

  return { variables: variablesRes.rows, fijos: fijosRes.rows };
};

// Platos candidatos a "fijo" para el menú: tipo='fijo' clásico, o disponibilidad
// fijo_dia/siempre del catálogo -- en ambos casos, solo si tienen una vianda activa
// (ver create-viandas-table). Sin eso no hay guarnición/salsa efectiva que resolver.
// menuSemanalId es obligatorio para resolver la visibilidad POR SEMANA de cada fijo
// (ver filtroVisibilidadFijoSemana) -- si no se conoce (null), el filtro no restringe.
export function cargarPlatosFijos(db = query, empresaId = null, menuSemanalId = null) {
  return execute(db,
    `SELECT p.id AS plato_id, p.nombre AS plato_nombre, p.descripcion, p.descripcion_larga,
            p.tags, p.tiene_guarnicion, p.vegetariano, p.calorias, p.alergenos, p.foto_url,
            p.tipo, p.disponibilidad, p.dia_fijo,
            CASE WHEN v.guarnicion_id IS NOT NULL THEN 'fija' WHEN p.tiene_guarnicion THEN 'libre' ELSE 'sin_guarnicion' END AS guarnicion_modo,
            v.guarnicion_id AS guarnicion_fija_id, gf.nombre AS guarnicion_fija_nombre,
            CASE WHEN v.salsa_id IS NOT NULL THEN 'fija' WHEN v.salsa_libre THEN 'libre' ELSE 'sin_salsa' END AS salsa_modo,
            v.salsa_id AS salsa_fija_id, sf.nombre AS salsa_fija_nombre
     FROM platos p
     JOIN viandas v ON v.plato_id = p.id AND v.activo = true
     LEFT JOIN guarniciones gf ON gf.id = v.guarnicion_id
     LEFT JOIN salsas sf ON sf.id = v.salsa_id
     WHERE p.activo = true
       AND (p.tipo = 'fijo' OR p.disponibilidad IN ('fijo_dia', 'siempre'))
       AND ${filtroVisibilidadFijoSemana(1, 2)}
     ORDER BY p.nombre ASC`,
    [empresaId, menuSemanalId]
  );
}

// Fase B del teardown "la semana es el contenedor": mismo output que
// cargarPlatosFijos, pero el CONJUNTO de fijos sale de menu_semanal_dias
// (categorias fijos-x-dia/fijos-de-siempre) en vez de platos.disponibilidad.
// Las columnas de catalogo (disponibilidad, dia_fijo, tipo) se siguen
// exponiendo desde platos para paridad byte a byte -- lo que cambia es de
// donde viene la MEMBRESIA (categoria_id), no las columnas. La composicion
// (guarnicion/salsa) sale de la vianda anclada al slot (msd.vianda_id), que
// el backfill dejo igual a la vianda general que usa cargarPlatosFijos. La
// visibilidad usa el MISMO filtro por-semana (menu_semanal_fijos_visibilidad),
// asi que es identica por construccion. En Fase C esta funcion reemplaza a
// cargarPlatosFijos como fuente del menu.
//
// Fallback (transitorio): si un menu NO tiene fijos materializados, cae al
// catalogo (cargarPlatosFijos). Cubre menus creados por fuera del flujo normal
// (ej. fixtures de test que insertan menus por SQL directo) sin acoplar nada.
// En produccion todos los menus estan materializados (script materializar-fijos
// + siembra al crear/duplicar), asi que el fallback no se dispara. Se remueve
// cuando exista edicion de fijos por-semana (Fase F/G), donde "cero fijos"
// pasa a ser un estado valido que NO debe caer al catalogo.
export async function cargarPlatosFijosDesdeMenu(db = query, empresaId = null, menuSemanalId = null) {
  // Capa empresa (plan-eng-review T9): los fijos también son filas menu_semanal_dias
  // (categoria fijos-*, opcion NULL), así que la excepción por empresa se ancla con las
  // MISMAS claves (dia/opcion pueden ser NULL → IS NOT DISTINCT FROM). Cascada:
  // excepción empresa (emo) → vianda → plato → sin. Guarda anti-rancio
  // emo.plato_id_origen = msd.plato_id. Con empresaId NULL (admin) emo no matchea → base.
  const res = await execute(db,
    `SELECT p.id AS plato_id, p.nombre AS plato_nombre, p.descripcion, p.descripcion_larga,
            p.tags, p.tiene_guarnicion, p.vegetariano, p.calorias, p.alergenos, p.foto_url,
            p.tipo, p.disponibilidad, p.dia_fijo,
            CASE
              WHEN emo.guarnicion_modo_override IS NOT NULL THEN emo.guarnicion_modo_override
              WHEN v.guarnicion_id IS NOT NULL THEN 'fija'
              WHEN p.tiene_guarnicion THEN 'libre'
              ELSE 'sin_guarnicion'
            END AS guarnicion_modo,
            CASE
              WHEN emo.guarnicion_modo_override IS NOT NULL THEN emo.guarnicion_fija_override_id
              ELSE v.guarnicion_id
            END AS guarnicion_fija_id,
            gf.nombre AS guarnicion_fija_nombre,
            CASE
              WHEN emo.salsa_modo_override IS NOT NULL THEN emo.salsa_modo_override
              WHEN v.salsa_id IS NOT NULL THEN 'fija'
              WHEN v.salsa_libre THEN 'libre'
              ELSE 'sin_salsa'
            END AS salsa_modo,
            CASE
              WHEN emo.salsa_modo_override IS NOT NULL THEN emo.salsa_fija_override_id
              ELSE v.salsa_id
            END AS salsa_fija_id,
            sf.nombre AS salsa_fija_nombre
     FROM menu_semanal_dias msd
     JOIN categorias c ON c.id = msd.categoria_id AND c.slug IN ('fijos-x-dia', 'fijos-de-siempre')
     JOIN platos p ON p.id = msd.plato_id AND p.activo = true
     JOIN viandas v ON v.id = msd.vianda_id AND v.activo = true
     LEFT JOIN menu_semanal_dia_empresa_override emo
       ON emo.menu_semanal_id = msd.menu_semanal_id
      AND emo.categoria_id = msd.categoria_id
      AND emo.dia IS NOT DISTINCT FROM msd.dia
      AND emo.opcion IS NOT DISTINCT FROM msd.opcion
      AND emo.empresa_id = $1
      AND emo.plato_id_origen = msd.plato_id
     LEFT JOIN guarniciones gf ON gf.id = CASE
       WHEN emo.guarnicion_modo_override IS NOT NULL THEN emo.guarnicion_fija_override_id
       ELSE v.guarnicion_id END
     LEFT JOIN salsas sf ON sf.id = CASE
       WHEN emo.salsa_modo_override IS NOT NULL THEN emo.salsa_fija_override_id
       ELSE v.salsa_id END
     WHERE msd.menu_semanal_id = $2
       AND ${filtroVisibilidadFijoSemana(1, 2)}
     ORDER BY p.nombre ASC`,
    [empresaId, menuSemanalId]
  );
  if (res.rows.length > 0 || menuSemanalId == null) return res;
  return cargarPlatosFijos(db, empresaId, menuSemanalId);
}

async function cargarDetallesMenu(menu, db = query, fijosPrecargados = null, empresaId = null) {
  const variablesRes = await execute(db,
      `SELECT msd.dia::text AS dia, msd.opcion, msd.plato_id,
              p.nombre AS plato_nombre, p.descripcion, p.descripcion_larga,
              p.tags, p.tiene_guarnicion, p.vegetariano,
              p.calorias, p.alergenos, p.foto_url,${VIANDA_SLOT_COLS}
              , ms.id AS menu_semanal_id
       FROM menus_semanales ms
       JOIN menu_semanal_dias msd ON msd.menu_semanal_id = ms.id
       JOIN platos p ON p.id = msd.plato_id${VIANDA_SLOT_JOINS}
       WHERE ms.id = $1 AND p.activo = true
         AND msd.opcion IS NOT NULL  -- solo especiales; fijos via cargarPlatosFijos (teardown Fase C)
         AND ${FILTRO_VISIBILIDAD_SLOT}
         AND ${FILTRO_VISIBILIDAD_PLATO}
       ORDER BY msd.dia::text, msd.opcion ASC`,
      [menu.id, empresaId]
    );
  const fijos = fijosPrecargados || (await cargarPlatosFijosDesdeMenu(db, empresaId, menu.id)).rows;
  return { ...menu, variables: variablesRes.rows, fijos };
}

// Devuelve todos los menús publicados vigentes (fecha_fin >= hoy), ordenados por fecha_inicio
export const menusPublicadosList = async (empresaId = null) => {
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
  // La visibilidad de fijos ahora es por semana, asi que ya no se puede
  // precargar una sola vez para todos los menus de la lista (cada semana
  // puede tener una configuracion distinta) -- se resuelve por-menu dentro
  // de cargarDetallesMenu (fijosPrecargados=null).
  return Promise.all(result.rows.map(m => cargarDetallesMenu(m, query, null, empresaId)));
};

// Devuelve un menú publicado específico por su ID (para validar al guardar pedido)
export const menuActivoPorId = async (id, db = query, empresaId = null) => {
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
  return cargarDetallesMenu(menu, db, null, empresaId);
};

export const menuPublicadoPorSemana = async (semanaId, db = query, empresaId = null) => {
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
  return cargarDetallesMenu(menu, db, null, empresaId);
};

// Mantener por compatibilidad con menuHoy y otros usos internos
export const menuActivo = async (db = query, empresaId = null) => {
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
  return cargarDetallesMenu(menu, db, null, empresaId);
};

export const menuHoy = async () => {
  const hoy = new Date();
  const diaStr = DIAS_ES[hoy.getDay()];
  const fechaHoy = hoy.toISOString().split('T')[0];

  // Menu que cubre la fecha de hoy -- necesario para leer los fijos por-semana
  // (teardown Fase C, cargarPlatosFijosDesdeMenu necesita el menu_semanal_id).
  const menuRow = await query(
    `SELECT id FROM menus_semanales WHERE fecha_inicio <= $1 AND fecha_fin >= $1 ORDER BY fecha_inicio DESC LIMIT 1`,
    [fechaHoy]
  );
  const menuSemanalId = menuRow.rows[0]?.id ?? null;

  const variablesRes = await query(
    `SELECT msd.dia::text AS dia, msd.opcion, msd.plato_id,
            p.nombre AS plato_nombre, p.descripcion, p.descripcion_larga,
            p.tags, p.tiene_guarnicion, p.vegetariano,
            p.calorias, p.alergenos, p.foto_url,
            ms.id AS menu_semanal_id
     FROM menus_semanales ms
     JOIN menu_semanal_dias msd ON msd.menu_semanal_id = ms.id
     JOIN platos p ON p.id = msd.plato_id
     WHERE ms.fecha_inicio <= $2 AND ms.fecha_fin >= $2
       AND msd.dia::text = $1 AND p.activo = true
       AND msd.opcion IS NOT NULL  -- solo especiales; fijos via cargarPlatosFijos (teardown Fase C)
       AND NOT EXISTS (
         SELECT 1 FROM menu_semanal_sin_servicio ss
         WHERE ss.menu_semanal_id = ms.id AND ss.dia::text = $1
       )
     ORDER BY msd.opcion ASC`,
    [diaStr, fechaHoy]
  );

  const fijosRes = await cargarPlatosFijosDesdeMenu(query, null, menuSemanalId);

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
         'salsa_id', pi.salsa_id, 'salsa_nombre', s.nombre,
         'sin_pedido', COALESCE(pi.sin_pedido, false), 'origen', pi.origen,
         'notas', pi.notas,
         'estado', pi.estado::text, 'estado_updated_at', pi.estado_updated_at
       ) ORDER BY pi.dia
     ) FILTER (WHERE pi.id IS NOT NULL) AS items
     FROM pedidos p
     LEFT JOIN pedido_items pi ON pi.pedido_id = p.id
     LEFT JOIN platos pl ON pl.id = pi.plato_id
     LEFT JOIN guarniciones g ON g.id = pi.guarnicion_id
     LEFT JOIN salsas s ON s.id = pi.salsa_id
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
            p.plan_id, p.plan_codigo, p.plan_nombre, p.plan_gramaje_min, p.plan_gramaje_max,
            p.plan_incluye_postre, p.plan_incluye_bebida,
            e.nombre AS empleado_nombre, e.apellido AS empleado_apellido, e.email,
            emp.nombre AS empresa_nombre,
            json_agg(
              json_build_object(
                'id', pi.id, 'dia', pi.dia, 'plato_id', pi.plato_id,
                'plato_nombre', pl.nombre, 'opcion', pi.opcion,
                'tiene_guarnicion', pl.tiene_guarnicion,
                'guarnicion_id', pi.guarnicion_id, 'guarnicion_nombre', g.nombre,
                'salsa_id', pi.salsa_id, 'salsa_nombre', s.nombre,
                'sin_pedido', COALESCE(pi.sin_pedido, false), 'origen', pi.origen,
                'notas', pi.notas,
                'estado', pi.estado::text, 'estado_updated_at', pi.estado_updated_at
              ) ORDER BY pi.dia
            ) FILTER (WHERE pi.id IS NOT NULL) AS items
     FROM pedidos p
     JOIN empleados e ON e.id = p.empleado_id
     JOIN empresas emp ON emp.id = p.empresa_id
     LEFT JOIN pedido_items pi ON pi.pedido_id = p.id
     LEFT JOIN platos pl ON pl.id = pi.plato_id
     LEFT JOIN guarniciones g ON g.id = pi.guarnicion_id
     LEFT JOIN salsas s ON s.id = pi.salsa_id
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
            p.plan_id, p.plan_codigo, p.plan_nombre, p.plan_gramaje_min, p.plan_gramaje_max,
            p.plan_incluye_postre, p.plan_incluye_bebida,
            e.nombre AS empleado_nombre, e.apellido AS empleado_apellido, e.email,
            emp.nombre AS empresa_nombre,
            json_agg(
              json_build_object(
                'id', pi.id, 'dia', pi.dia, 'plato_id', pi.plato_id,
                'plato_nombre', pl.nombre, 'opcion', pi.opcion,
                'tiene_guarnicion', pl.tiene_guarnicion,
                'guarnicion_id', pi.guarnicion_id, 'guarnicion_nombre', g.nombre,
                'salsa_id', pi.salsa_id, 'salsa_nombre', s.nombre,
                'sin_pedido', COALESCE(pi.sin_pedido, false), 'origen', pi.origen,
                'notas', pi.notas,
                'estado', pi.estado::text, 'estado_updated_at', pi.estado_updated_at
              ) ORDER BY pi.dia
            ) FILTER (WHERE pi.id IS NOT NULL) AS items
     FROM pedidos p
     JOIN empleados e ON e.id = p.empleado_id
     JOIN empresas emp ON emp.id = p.empresa_id
     LEFT JOIN pedido_items pi ON pi.pedido_id = p.id
     LEFT JOIN platos pl ON pl.id = pi.plato_id
     LEFT JOIN guarniciones g ON g.id = pi.guarnicion_id
     LEFT JOIN salsas s ON s.id = pi.salsa_id
     ${where}
     GROUP BY p.id, e.id, emp.id
     ORDER BY p.created_at DESC
     LIMIT $${vals.length - 1} OFFSET $${vals.length}`,
    vals
  );
  const eventosPorPedido = await findEventosByPedidoIds(r.rows.map(p => p.id));
  return r.rows.map(p => ({ ...p, eventos: eventosPorPedido[p.id] ?? [] }));
};

export const upsertPedido = async ({
  empleado_id,
  empresa_id,
  menu_semanal_id,
  semana_inicio,
  observaciones,
  plan_snapshot = {},
}, db = query) => {
  const r = await execute(db,
    `INSERT INTO pedidos (
       empleado_id, empresa_id, menu_semanal_id, semana_inicio, observaciones,
       plan_id, plan_codigo, plan_nombre, plan_gramaje_min, plan_gramaje_max,
       plan_incluye_postre, plan_incluye_bebida
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (empleado_id, semana_inicio)
     DO UPDATE SET menu_semanal_id = EXCLUDED.menu_semanal_id,
       observaciones = EXCLUDED.observaciones,
       plan_id = EXCLUDED.plan_id,
       plan_codigo = EXCLUDED.plan_codigo,
       plan_nombre = EXCLUDED.plan_nombre,
       plan_gramaje_min = EXCLUDED.plan_gramaje_min,
       plan_gramaje_max = EXCLUDED.plan_gramaje_max,
       plan_incluye_postre = EXCLUDED.plan_incluye_postre,
       plan_incluye_bebida = EXCLUDED.plan_incluye_bebida,
       estado = 'pendiente',
       updated_at = NOW()
     RETURNING id, empleado_id, empresa_id, menu_semanal_id, semana_inicio, estado, observaciones,
       plan_id, plan_codigo, plan_nombre, plan_gramaje_min, plan_gramaje_max,
       plan_incluye_postre, plan_incluye_bebida, created_at, updated_at`,
    [
      empleado_id,
      empresa_id,
      menu_semanal_id || null,
      semana_inicio,
      observaciones || null,
      plan_snapshot.plan_id || null,
      plan_snapshot.plan_codigo || null,
      plan_snapshot.plan_nombre || null,
      plan_snapshot.plan_gramaje_min || null,
      plan_snapshot.plan_gramaje_max || null,
      Boolean(plan_snapshot.plan_incluye_postre),
      Boolean(plan_snapshot.plan_incluye_bebida),
    ]
  );
  return r.rows[0];
};

export const upsertItem = async (
  pedidoId,
  { dia, plato_id, opcion, guarnicion_id, salsa_id, notas, sin_pedido = false, origen = null },
  db = query,
) => {
  const r = await execute(db,
    `INSERT INTO pedido_items (pedido_id, dia, plato_id, opcion, guarnicion_id, salsa_id, notas, sin_pedido, origen, estado, estado_updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, CASE WHEN $8::boolean THEN 'cancelado'::pedido_item_estado ELSE 'pendiente'::pedido_item_estado END, NOW())
     ON CONFLICT (pedido_id, dia)
     DO UPDATE SET plato_id = EXCLUDED.plato_id, opcion = EXCLUDED.opcion,
       guarnicion_id = EXCLUDED.guarnicion_id, salsa_id = EXCLUDED.salsa_id, notas = EXCLUDED.notas,
       sin_pedido = EXCLUDED.sin_pedido, origen = EXCLUDED.origen,
       estado = EXCLUDED.estado, estado_updated_at = NOW(),
       updated_at = NOW()
     RETURNING *`,
    [
      pedidoId,
      dia,
      plato_id || null,
      opcion || null,
      guarnicion_id || null,
      salsa_id || null,
      notas || null,
      Boolean(sin_pedido),
      origen || null,
    ]
  );
  return r.rows[0];
};

export const cancelarItemPedido = async (pedidoId, dia, db = query) => {
  const r = await execute(
    db,
    `UPDATE pedido_items
     SET plato_id = NULL,
       opcion = NULL,
       guarnicion_id = NULL,
       salsa_id = NULL,
       notas = NULL,
       sin_pedido = TRUE,
       origen = 'usuario',
       estado = 'cancelado',
       estado_updated_at = NOW(),
       updated_at = NOW()
     WHERE pedido_id = $1 AND dia = $2
     RETURNING *`,
    [pedidoId, dia],
  );
  return r.rows[0] || null;
};

export const deleteItem = async (pedidoId, dia, db = query) => {
  await execute(db, 'DELETE FROM pedido_items WHERE pedido_id = $1 AND dia = $2', [pedidoId, dia]);
};

export const deleteItemsNotInDays = async (pedidoId, dias, db = query) => {
  await execute(
    db,
    'DELETE FROM pedido_items WHERE pedido_id = $1 AND NOT (dia = ANY($2::varchar[]))',
    [pedidoId, dias]
  );
};

// Resuelve la vianda efectiva del ítem: la del slot de menú si el plato pertenece a un
// menú semanal ese día/opción (msd.vianda_id), o la vianda global del plato si es un
// "fijo" sin slot (ver create-viandas-table, "un poco de ambas" del design doc).
export const validateItemForMenu = async (menuId, item, db = query, empresaId = null) => {
  const result = await execute(
    db,
    `SELECT p.id, p.nombre, p.tipo, p.activo, p.disponibilidad, p.dia_fijo, p.tiene_guarnicion,
            EXISTS (
              SELECT 1
              FROM menu_semanal_dias msd
              WHERE msd.menu_semanal_id = $2
                AND msd.dia::text = $3
                AND msd.plato_id = p.id
                AND msd.opcion = $4
            ) AS pertenece_menu,
            (v_slot.id IS NOT NULL OR v_global.id IS NOT NULL) AS tiene_vianda,
            -- Resolución atómica por capa (plan-eng-review T2/T4): precedencia
            -- excepción empresa (emo) → override de celda (msd) → vianda → plato. El
            -- write path resuelve con la MISMA cascada que el read (VIANDA_SLOT_COLS)
            -- para que el snapshot del pedido use la guarnición/salsa por empresa. emo
            -- se aplica con la guarda plato_id_origen (ver join).
            CASE
              WHEN emo.guarnicion_modo_override IS NOT NULL THEN emo.guarnicion_modo_override
              WHEN msd.guarnicion_modo_override IS NOT NULL THEN msd.guarnicion_modo_override
              WHEN COALESCE(v_slot.guarnicion_id, v_global.guarnicion_id) IS NOT NULL THEN 'fija'
              WHEN p.tiene_guarnicion THEN 'libre'
              ELSE 'sin_guarnicion'
            END AS guarnicion_modo,
            CASE
              WHEN emo.guarnicion_modo_override IS NOT NULL THEN emo.guarnicion_fija_override_id
              WHEN msd.guarnicion_modo_override IS NOT NULL THEN msd.guarnicion_fija_override_id
              ELSE COALESCE(v_slot.guarnicion_id, v_global.guarnicion_id)
            END AS guarnicion_fija_id,
            CASE
              WHEN emo.salsa_modo_override IS NOT NULL THEN emo.salsa_modo_override
              WHEN msd.salsa_modo_override IS NOT NULL THEN msd.salsa_modo_override
              WHEN COALESCE(v_slot.salsa_id, v_global.salsa_id) IS NOT NULL THEN 'fija'
              WHEN COALESCE(v_slot.salsa_libre, v_global.salsa_libre, false) THEN 'libre'
              ELSE 'sin_salsa'
            END AS salsa_modo,
            CASE
              WHEN emo.salsa_modo_override IS NOT NULL THEN emo.salsa_fija_override_id
              WHEN msd.salsa_modo_override IS NOT NULL THEN msd.salsa_fija_override_id
              ELSE COALESCE(v_slot.salsa_id, v_global.salsa_id)
            END AS salsa_fija_id,
            CASE WHEN $5::integer IS NULL THEN true ELSE EXISTS (
              SELECT 1 FROM guarniciones g WHERE g.id = $5 AND g.activo = true
            ) END AS guarnicion_valida,
            CASE WHEN $6::integer IS NULL THEN true ELSE EXISTS (
              SELECT 1 FROM salsas s WHERE s.id = $6 AND s.activo = true
            ) END AS salsa_valida,
            EXISTS (
              SELECT 1 FROM menu_semanal_sin_servicio ss
              WHERE ss.menu_semanal_id = $2 AND ss.dia::text = $3
            ) AS sin_servicio
     FROM platos p
     LEFT JOIN menu_semanal_dias msd
       ON msd.menu_semanal_id = $2 AND msd.dia::text = $3 AND msd.plato_id = p.id AND msd.opcion = $4
     -- Slot de FIJO (plan-eng-review T9): los fijos son filas menu_semanal_dias con
     -- opcion NULL que el join de especiales de arriba NO matchea (opcion NULL vs $4, y
     -- dia NULL en fijos-de-siempre). Este lookup los ubica para poder anclar su
     -- excepción por empresa. fijos-x-dia matchea el día del pedido; fijos-de-siempre
     -- (dia NULL) aplica cualquier día.
     LEFT JOIN menu_semanal_dias msd_fijo
       ON msd_fijo.menu_semanal_id = $2 AND msd_fijo.plato_id = p.id AND msd_fijo.opcion IS NULL
      AND (msd_fijo.dia::text = $3 OR msd_fijo.dia IS NULL)
      AND msd_fijo.categoria_id IN (SELECT id FROM categorias WHERE slug IN ('fijos-x-dia', 'fijos-de-siempre'))
     LEFT JOIN viandas v_slot ON v_slot.id = msd.vianda_id
     LEFT JOIN viandas v_global ON v_global.plato_id = p.id AND v_global.empresa_id IS NULL AND v_global.activo = true
     -- emo ancla vía la celda que corresponda: especial (msd) o fijo (msd_fijo).
     LEFT JOIN menu_semanal_dia_empresa_override emo
       ON emo.menu_semanal_id = COALESCE(msd.menu_semanal_id, msd_fijo.menu_semanal_id)
      AND emo.categoria_id = COALESCE(msd.categoria_id, msd_fijo.categoria_id)
      AND emo.dia IS NOT DISTINCT FROM COALESCE(msd.dia, msd_fijo.dia)
      AND emo.opcion IS NOT DISTINCT FROM COALESCE(msd.opcion, msd_fijo.opcion)
      AND emo.empresa_id = $7
      AND emo.plato_id_origen = p.id
     WHERE p.id = $1`,
    [item.plato_id, menuId, item.dia, item.opcion, item.guarnicion_id || null, item.salsa_id || null, empresaId]
  );
  return result.rows[0] || null;
};

export const findHistorialByEmpleado = async (empleadoId, limit = 16) => {
  const r = await query(
    `SELECT p.id, p.semana_inicio, p.estado, p.observaciones, p.created_at,
            p.empresa_id, ms.nombre AS menu_nombre, ms.fecha_fin,
            json_agg(
              json_build_object(
                'dia', pi.dia, 'plato_id', pi.plato_id,
                'plato_nombre', pl.nombre, 'opcion', pi.opcion,
                'guarnicion_nombre', g.nombre,
                'salsa_id', pi.salsa_id, 'salsa_nombre', s.nombre,
                'sin_pedido', COALESCE(pi.sin_pedido, false), 'origen', pi.origen,
                'estado', pi.estado::text, 'estado_updated_at', pi.estado_updated_at
              ) ORDER BY pi.dia
            ) FILTER (WHERE pi.id IS NOT NULL) AS items
     FROM pedidos p
     LEFT JOIN menus_semanales ms ON ms.id = p.menu_semanal_id
     LEFT JOIN pedido_items pi ON pi.pedido_id = p.id
     LEFT JOIN platos pl ON pl.id = pi.plato_id
     LEFT JOIN guarniciones g ON g.id = pi.guarnicion_id
     LEFT JOIN salsas s ON s.id = pi.salsa_id
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

export const findResumenSugerencias = async (semanaInicio) => {
  const r = await query(
    `SELECT valor AS nombre, COUNT(*)::int AS votos
     FROM pedido_sugerencias,
          jsonb_array_elements_text(ideas) AS valor
     WHERE semana_inicio = $1
       AND jsonb_array_length(ideas) > 0
     GROUP BY valor
     ORDER BY votos DESC, valor`,
    [semanaInicio]
  );
  return r.rows;
};

export const findOpcionesSugerencia = async (semanaInicio, db = query) => {
  const r = await execute(db,
    `SELECT pso.id, pso.semana_inicio, pso.plato_id, pso.orden,
            p.nombre AS plato_nombre, p.descripcion, p.tags, p.tipo, p.foto_url
     FROM pedido_sugerencia_opciones pso
     JOIN platos p ON p.id = pso.plato_id
     WHERE pso.semana_inicio = $1
       AND pso.activo = TRUE
       AND p.activo = TRUE
     ORDER BY pso.orden ASC, p.nombre ASC`,
    [semanaInicio]
  );
  return r.rows;
};

export const findOpcionesSugerenciaBySemanas = async (semanasInicio = [], db = query) => {
  const semanas = [...new Set(semanasInicio.filter(Boolean))];
  if (semanas.length === 0) return [];
  const r = await execute(db,
    `SELECT pso.id, pso.semana_inicio, pso.plato_id, pso.orden,
            p.nombre AS plato_nombre, p.descripcion, p.tags, p.tipo, p.foto_url
     FROM pedido_sugerencia_opciones pso
     JOIN platos p ON p.id = pso.plato_id
     WHERE pso.semana_inicio = ANY($1::date[])
       AND pso.activo = TRUE
       AND p.activo = TRUE
     ORDER BY pso.semana_inicio ASC, pso.orden ASC, p.nombre ASC`,
    [semanas]
  );
  return r.rows;
};

export const replaceOpcionesSugerencia = async ({ semana_inicio, plato_ids }, db = query) => {
  await execute(db, 'DELETE FROM pedido_sugerencia_opciones WHERE semana_inicio = $1', [semana_inicio]);

  const rows = [];
  for (const [index, platoId] of plato_ids.entries()) {
    const r = await execute(db,
      `INSERT INTO pedido_sugerencia_opciones (semana_inicio, plato_id, orden)
       SELECT $1, p.id, $3
       FROM platos p
       WHERE p.id = $2 AND p.activo = TRUE
       RETURNING id, semana_inicio, plato_id, orden, activo, created_at, updated_at`,
      [semana_inicio, platoId, index]
    );
    if (r.rows[0]) rows.push(r.rows[0]);
  }

  return rows;
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

export const updateItemsEstadoByPedido = async (pedidoId, estado, db = query) => {
  const r = await execute(db,
    `UPDATE pedido_items
     SET estado = $1,
       estado_updated_at = NOW(),
       updated_at = NOW()
     WHERE pedido_id = $2
       AND COALESCE(sin_pedido, false) = false
     RETURNING id, pedido_id, dia, plato_id, opcion, guarnicion_id, sin_pedido, estado::text AS estado, estado_updated_at`,
    [estado, pedidoId]
  );
  return r.rows;
};

export const findItemConPedidoById = async (itemId, db = query) => {
  const r = await execute(db,
    `SELECT pi.id, pi.pedido_id, pi.dia, pi.plato_id, pi.opcion, pi.guarnicion_id,
            COALESCE(pi.sin_pedido, false) AS sin_pedido,
            pi.estado::text AS estado, pi.estado_updated_at,
            p.estado::text AS pedido_estado, p.semana_inicio, p.empleado_id, p.empresa_id
     FROM pedido_items pi
     JOIN pedidos p ON p.id = pi.pedido_id
     WHERE pi.id = $1`,
    [itemId]
  );
  return r.rows[0] || null;
};

export const updateItemEstado = async (itemId, estado, db = query) => {
  const r = await execute(db,
    `UPDATE pedido_items
     SET estado = $1,
       estado_updated_at = NOW(),
       updated_at = NOW()
     WHERE id = $2
     RETURNING id, pedido_id, dia, plato_id, opcion, guarnicion_id,
       COALESCE(sin_pedido, false) AS sin_pedido,
       estado::text AS estado, estado_updated_at`,
    [estado, itemId]
  );
  return r.rows[0] || null;
};

export const calcularEstadoPedidoPorItems = async (pedidoId, db = query) => {
  const r = await execute(db,
    `SELECT
       COUNT(*) FILTER (WHERE COALESCE(sin_pedido, false) = false)::int AS total,
       COUNT(*) FILTER (WHERE COALESCE(sin_pedido, false) = false AND estado <> 'cancelado')::int AS activos,
       COUNT(*) FILTER (WHERE COALESCE(sin_pedido, false) = false AND estado = 'cancelado')::int AS cancelados,
       COUNT(*) FILTER (WHERE COALESCE(sin_pedido, false) = false AND estado = 'entregado')::int AS entregados
     FROM pedido_items
     WHERE pedido_id = $1`,
    [pedidoId]
  );
  const row = r.rows[0] || { total: 0, activos: 0, cancelados: 0, entregados: 0 };
  const total = Number(row.total);
  const activos = Number(row.activos);
  const entregados = Number(row.entregados);
  const cancelados = Number(row.cancelados);
  if (total === 0 || activos === 0) return 'cancelado';
  if (entregados === activos) return 'completo';
  if (entregados > 0 || cancelados > 0) return 'en_proceso';
  return 'pendiente';
};

export const touchPedido = async (id, db = query) => {
  const r = await execute(db,
    `UPDATE pedidos SET updated_at = NOW() WHERE id = $1
     RETURNING id, empleado_id, empresa_id, menu_semanal_id, semana_inicio, estado, observaciones, created_at, updated_at`,
    [id]
  );
  return r.rows[0] || null;
};
