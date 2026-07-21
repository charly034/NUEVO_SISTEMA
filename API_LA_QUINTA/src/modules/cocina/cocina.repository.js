import { query } from '../../database/connection.js';
import { ORDEN_DIA_SQL as ORDEN_DIA } from '../../utils/fecha.js';

// Devuelve el lunes de la semana que contiene la fecha dada (YYYY-MM-DD)
export const lunesDe = (fechaISO) => {
  const d = new Date(`${fechaISO}T12:00:00Z`);
  const dow = d.getUTCDay(); // 0=dom, 1=lun ...
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
};

// Nombre del día de la semana para una fecha ISO
export const diaDeNombre = (fechaISO) => {
  const DIAS = ['domingo','lunes','martes','miercoles','jueves','viernes','sabado'];
  const d = new Date(`${fechaISO}T12:00:00Z`);
  return DIAS[d.getUTCDay()];
};

// ── Menu activo que cubre una fecha ──────────────────────────────

export const findMenuActivoPorFecha = async (fechaISO) => {
  const result = await query(
    `SELECT ms.id, ms.nombre, se.fecha_inicio, se.fecha_fin, ms.estado
     FROM menus_semanales ms
     JOIN semanas se ON se.id = ms.semana_id
     WHERE ms.estado IN ('publicado', 'cerrado')
       AND se.fecha_inicio <= $1
       AND se.fecha_fin    >= $1
     ORDER BY se.fecha_inicio DESC
     LIMIT 1`,
    [fechaISO]
  );
  return result.rows[0] || null;
};

// ── Slots del menú (de un día específico, o de toda la semana si se omite `dia`) ──

// Resuelve guarnición/salsa efectivas con precedencia de 2 niveles (el 3er nivel,
// la elección puntual del empleado, vive en pedido_items y se resuelve en
// findDetalleEtiquetas): override del slot semanal > default de la vianda del catálogo.
// 'sin_guarnicion'/'sin_salsa'/'libre' en el override anulan explícitamente el default
// de la vianda (no es "no hay override", es "este día no lleva" o "se define al pedir").
//
// SIN capa por-empresa a propósito (plan-eng-review T5): esta es la vista del TABLERO
// del menú de la semana (qué ofrece cada slot en general), no una resolución por
// pedido. La guarnición/salsa POR EMPRESA llega a la cocina por otro camino: el
// SNAPSHOT de pedido_items (pi.guarnicion_id/salsa_id), que validateItemForMenu (T4)
// resuelve por empresa al guardar. findDetalleEtiquetas lee ese snapshot, así que las
// etiquetas ya reflejan la excepción por empresa sin que cocina resuelva nada extra.
// Los conteos (findConteosPedidos) agregan por PLATO, no por guarnición. Ver el test
// cocina-consistencia-guarnicion.db.test.js: esta resolución del tablero coincide slot
// por slot con la resolución base de pedidos.
const SLOTS_SELECT = `
  SELECT
    msd.id, msd.dia, msd.opcion,
    msd.guarnicion_modo_override,
    msd.salsa_modo_override,
    p.id          AS plato_id,
    p.nombre      AS plato_nombre,
    COALESCE(v.nombre_vianda, p.nombre) AS nombre_vianda,
    g.nombre      AS guarnicion_nombre,
    s.nombre      AS salsa_nombre,
    p.vegetariano,
    p.calorias,
    p.foto_url
  FROM menu_semanal_dias msd
  JOIN platos p ON p.id = msd.plato_id
  LEFT JOIN viandas v ON v.id = msd.vianda_id
  LEFT JOIN guarniciones g ON g.id = CASE
    WHEN msd.guarnicion_modo_override = 'fija' THEN msd.guarnicion_fija_override_id
    WHEN msd.guarnicion_modo_override IN ('sin_guarnicion', 'libre') THEN NULL
    ELSE v.guarnicion_id
  END
  LEFT JOIN salsas s ON s.id = CASE
    WHEN msd.salsa_modo_override = 'fija' THEN msd.salsa_fija_override_id
    WHEN msd.salsa_modo_override IN ('sin_salsa', 'libre') THEN NULL
    ELSE v.salsa_id
  END
`;

const findSlots = async (menuSemanalId, dia = null) => {
  // opcion IS NOT NULL: solo especiales; los fijos (opcion NULL) tienen su
  // propia vista (findFijosYSiempre). Teardown Fase C.
  const where = dia
    ? 'WHERE msd.menu_semanal_id = $1 AND msd.dia = $2 AND msd.opcion IS NOT NULL'
    : 'WHERE msd.menu_semanal_id = $1 AND msd.opcion IS NOT NULL';
  const orderBy = dia ? 'msd.opcion ASC' : `${ORDEN_DIA}, msd.opcion ASC`;
  const params = dia ? [menuSemanalId, dia] : [menuSemanalId];
  const result = await query(`${SLOTS_SELECT} ${where} ORDER BY ${orderBy}`, params);
  return result.rows;
};

export const findSlotsPorDia = (menuSemanalId, dia) => findSlots(menuSemanalId, dia);

export const findSlotsSemana = (menuSemanalId) => findSlots(menuSemanalId);

// ── Conteos de pedidos por plato×empresa para un día/semana ─────
// semanaInicio: YYYY-MM-DD (lunes de esa semana)
// dia: 'lunes' | ... | null (null = todos los días)

export const findConteosPedidos = async (semanaInicio, dia = null) => {
  const conds = ['se.fecha_inicio = $1', "p.estado NOT IN ('cancelado')"];
  const vals = [semanaInicio];

  if (dia) {
    vals.push(dia);
    conds.push(`pi.dia = $${vals.length}`);
  }

  const result = await query(
    `SELECT
       pi.dia,
       pi.plato_id,
       pl.nombre      AS plato_nombre,
       p.empresa_id,
       e.nombre       AS empresa_nombre,
       COUNT(*)::int  AS total
     FROM pedido_items pi
     JOIN pedidos  p  ON p.id  = pi.pedido_id
     JOIN semanas  se ON se.id = p.semana_id
     JOIN empresas e  ON e.id  = p.empresa_id
     JOIN platos   pl ON pl.id = pi.plato_id
     WHERE ${conds.join(' AND ')}
       AND pi.plato_id IS NOT NULL
       AND pi.sin_pedido = false
     GROUP BY pi.dia, pi.plato_id, pl.nombre, p.empresa_id, e.nombre
     ORDER BY ${ORDEN_DIA}, pl.nombre, e.nombre`,
    vals
  );
  return result.rows;
};

// ── Detalle de pedidos para etiquetas ────────────────────────────
// Devuelve una fila por (empleado, dia, plato) para imprimir etiquetas

export const findDetalleEtiquetas = async (semanaInicio, dia) => {
  const result = await query(
    `SELECT
       pi.dia,
       pi.plato_id,
       pl.nombre         AS plato_nombre,
       p.empresa_id,
       e.nombre          AS empresa_nombre,
       empl.id           AS empleado_id,
       empl.nombre       AS empleado_nombre,
       empl.apellido     AS empleado_apellido,
       g.nombre          AS guarnicion_nombre,
       s.nombre          AS salsa_nombre,
       pv.nombre         AS plan_nombre,
       pv.gramaje_min    AS plan_gramaje_min
     FROM pedido_items pi
     JOIN pedidos      p    ON p.id    = pi.pedido_id
     JOIN semanas      se   ON se.id   = p.semana_id
     JOIN empresas     e    ON e.id    = p.empresa_id
     JOIN empleados    empl ON empl.id = p.empleado_id
     JOIN platos       pl   ON pl.id   = pi.plato_id
     LEFT JOIN guarniciones  g  ON g.id  = pi.guarnicion_id
     LEFT JOIN salsas        s  ON s.id  = pi.salsa_id
     LEFT JOIN planes_comerciales pv ON pv.id = e.plan_id
     WHERE se.fecha_inicio = $1
       AND pi.dia          = $2
       AND p.estado NOT IN ('cancelado')
       AND pi.sin_pedido   = false
       AND pi.plato_id IS NOT NULL
     ORDER BY e.nombre, empl.apellido, empl.nombre`,
    [semanaInicio, dia]
  );
  return result.rows;
};

// ── KPIs del día ─────────────────────────────────────────────────
// viandas totales / listas / pendientes / empresas con entrega

export const findKPIsHoy = async (semanaInicio, dia) => {
  const result = await query(
    `SELECT
       COUNT(*) FILTER (WHERE pi.estado NOT IN ('cancelado'))::int                       AS total,
       COUNT(*) FILTER (WHERE pi.estado IN ('listo','preparado','entregado'))::int       AS listas,
       COUNT(*) FILTER (WHERE pi.estado IN ('pendiente','en_proceso'))::int              AS pendientes,
       COUNT(DISTINCT p.empresa_id) FILTER (WHERE pi.estado NOT IN ('cancelado'))::int  AS empresas_count
     FROM pedido_items pi
     JOIN pedidos p ON p.id = pi.pedido_id
     JOIN semanas se ON se.id = p.semana_id
     WHERE se.fecha_inicio = $1
       AND pi.dia = $2
       AND pi.sin_pedido = false
       AND pi.plato_id IS NOT NULL
       AND p.estado NOT IN ('cancelado')`,
    [semanaInicio, dia]
  );
  return result.rows[0] ?? { total: 0, listas: 0, pendientes: 0, empresas_count: 0 };
};

// Totales por día para la semana (para los chips de días)
export const findTotalesPorDia = async (semanaInicio) => {
  const result = await query(
    `SELECT pi.dia, COUNT(*)::int AS total
     FROM pedido_items pi
     JOIN pedidos p ON p.id = pi.pedido_id
     JOIN semanas se ON se.id = p.semana_id
     WHERE se.fecha_inicio = $1
       AND pi.sin_pedido = false
       AND pi.plato_id IS NOT NULL
       AND p.estado NOT IN ('cancelado')
     GROUP BY pi.dia`,
    [semanaInicio]
  );
  const map = {};
  for (const r of result.rows) map[r.dia] = r.total;
  return map;
};

// ── Oferta semanal por empresa ────────────────────────────────────
// Devuelve los slots del menú con qué empresas los ven

export const findOfertaSemanal = async (menuSemanalId) => {
  const result = await query(
    `SELECT
       msd.id, msd.dia, msd.opcion,
       p.id AS plato_id, p.nombre AS plato_nombre,
       COALESCE(v.nombre_vianda, p.nombre) AS nombre_vianda,
       p.descripcion,
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
     LEFT JOIN menu_empresa_visibilidad mev ON mev.menu_semanal_dia_id = msd.id
     LEFT JOIN empresas e ON e.id = mev.empresa_id
     WHERE msd.menu_semanal_id = $1 AND msd.opcion IS NOT NULL
     GROUP BY msd.id, msd.dia, msd.opcion, p.id, p.nombre, v.nombre_vianda, p.descripcion
     ORDER BY msd.dia, msd.opcion`,
    [menuSemanalId]
  );
  return result.rows;
};

// ── Canal "por kilo" (buffet): qué cocinar hoy ───────────────────
// Automático según disponibilidad del plato -- no depende de si el plato
// también se vende como vianda (disponible_vianda). Un mismo plato puede
// servir a los dos canales a la vez; este query es la vista de cocina para
// el canal por kilo, no una composición de vianda.

export const findFijosYSiempre = async () => {
  const result = await query(
    `SELECT id, nombre, disponibilidad, dia_fijo
     FROM platos
     WHERE activo = true AND disponibilidad IN ('fijo_dia', 'siempre')
     ORDER BY disponibilidad, nombre`,
    []
  );
  return result.rows;
};

// ── Días sin servicio para un menú ──────────────────────────────

export const findSinServicio = async (menuSemanalId) => {
  const result = await query(
    `SELECT dia, motivo FROM menu_semanal_sin_servicio WHERE menu_semanal_id = $1`,
    [menuSemanalId]
  );
  const map = {};
  for (const r of result.rows) map[r.dia] = r.motivo ?? null;
  return map;
};
