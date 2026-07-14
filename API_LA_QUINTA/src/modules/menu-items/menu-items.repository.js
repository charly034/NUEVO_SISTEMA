import { query } from '../../database/connection.js';

// Una fila de menu_semanal_dias = un "item" del menú de la semana (una celda:
// un plato en un día/opción de una categoría). Teardown "la semana es el
// contenedor": esta es la unidad que se reasigna de categoría o se borra suelta.

export const findById = async (id) => {
  const r = await query(
    `SELECT id, menu_semanal_id, dia::text AS dia, opcion, plato_id, categoria_id,
            vianda_id, disponible_por_kilo
     FROM menu_semanal_dias WHERE id = $1`,
    [id]
  );
  return r.rows[0] || null;
};

export const setCategoria = async (id, categoriaId) => {
  const r = await query(
    'UPDATE menu_semanal_dias SET categoria_id = $2 WHERE id = $1 RETURNING id',
    [id, categoriaId]
  );
  return r.rows[0] ? findById(id) : null;
};

export const remove = async (id) => {
  const r = await query('DELETE FROM menu_semanal_dias WHERE id = $1 RETURNING id', [id]);
  return Boolean(r.rows[0]);
};

// ── Excepciones de guarnición/salsa POR EMPRESA sobre una celda (T8) ──────────
//
// La excepción NO se ancla al id de la celda sino a sus CLAVES DE NEGOCIO
// (menu, categoria, dia, opcion, empresa) para sobrevivir al re-sembrado por
// rotación, más la guarda `plato_id_origen` (ver migración 1719000080000). El
// cliente manda el slot_id y acá se derivan el ancla y la guarda: así el front
// nunca compone claves a mano.
//
// `stale` = la excepción quedó apuntando a un plato que la rotación cambió; NO se
// aplica en la resolución (pedidos.repository.js la filtra con la guarda), y el
// admin la reconfirma o la borra.

export const findExcepciones = async (slot) => {
  const r = await query(
    `SELECT emo.id, emo.empresa_id, e.nombre AS empresa_nombre,
            emo.plato_id_origen,
            (emo.plato_id_origen <> $5) AS stale,
            emo.guarnicion_modo_override, emo.guarnicion_fija_override_id, g.nombre AS guarnicion_nombre,
            emo.salsa_modo_override, emo.salsa_fija_override_id, s.nombre AS salsa_nombre
     FROM menu_semanal_dia_empresa_override emo
     JOIN empresas e ON e.id = emo.empresa_id
     LEFT JOIN guarniciones g ON g.id = emo.guarnicion_fija_override_id
     LEFT JOIN salsas s ON s.id = emo.salsa_fija_override_id
     WHERE emo.menu_semanal_id = $1
       AND emo.categoria_id = $2
       AND emo.dia IS NOT DISTINCT FROM $3::dia_semana
       AND emo.opcion IS NOT DISTINCT FROM $4::bpchar
     ORDER BY e.nombre ASC`,
    [slot.menu_semanal_id, slot.categoria_id, slot.dia, slot.opcion, slot.plato_id]
  );
  return r.rows;
};

export const upsertExcepcion = async (slot, {
  empresa_id,
  guarnicion_modo_override = null,
  guarnicion_fija_override_id = null,
  salsa_modo_override = null,
  salsa_fija_override_id = null,
}) => {
  const r = await query(
    `INSERT INTO menu_semanal_dia_empresa_override
       (menu_semanal_id, categoria_id, dia, opcion, empresa_id, plato_id_origen,
        guarnicion_modo_override, guarnicion_fija_override_id,
        salsa_modo_override, salsa_fija_override_id)
     VALUES ($1, $2, $3::dia_semana, $4::bpchar, $5, $6, $7, $8, $9, $10)
     ON CONFLICT (menu_semanal_id, categoria_id, dia, opcion, empresa_id)
     DO UPDATE SET plato_id_origen = EXCLUDED.plato_id_origen,
       guarnicion_modo_override = EXCLUDED.guarnicion_modo_override,
       guarnicion_fija_override_id = EXCLUDED.guarnicion_fija_override_id,
       salsa_modo_override = EXCLUDED.salsa_modo_override,
       salsa_fija_override_id = EXCLUDED.salsa_fija_override_id,
       updated_at = NOW()
     RETURNING id`,
    [
      slot.menu_semanal_id, slot.categoria_id, slot.dia, slot.opcion, empresa_id, slot.plato_id,
      guarnicion_modo_override, guarnicion_fija_override_id,
      salsa_modo_override, salsa_fija_override_id,
    ]
  );
  return r.rows[0] ?? null;
};

export const deleteExcepcion = async (slot, empresaId) => {
  const r = await query(
    `DELETE FROM menu_semanal_dia_empresa_override
      WHERE menu_semanal_id = $1
        AND categoria_id = $2
        AND dia IS NOT DISTINCT FROM $3::dia_semana
        AND opcion IS NOT DISTINCT FROM $4::bpchar
        AND empresa_id = $5
      RETURNING id`,
    [slot.menu_semanal_id, slot.categoria_id, slot.dia, slot.opcion, empresaId]
  );
  return Boolean(r.rows[0]);
};

// Empresas que VEN esta celda (allowlist real menu_empresa_visibilidad: sin filas
// = todas). Se usa para rechazar una excepción sobre una empresa que ni siquiera
// recibe este plato ese día.
export const empresaVeSlot = async (slotId, empresaId) => {
  const r = await query(
    `SELECT (
       NOT EXISTS (SELECT 1 FROM menu_empresa_visibilidad WHERE menu_semanal_dia_id = $1)
       OR EXISTS (SELECT 1 FROM menu_empresa_visibilidad WHERE menu_semanal_dia_id = $1 AND empresa_id = $2)
     ) AS ve`,
    [slotId, empresaId]
  );
  return Boolean(r.rows[0]?.ve);
};

// Inserta una celda nueva en una categoría (agregar plato desde la tabla). dia
// y opcion pueden ir NULL según el tipo de categoría (lista sin letra / modo
// único). La unicidad por (menu, categoria, dia, opcion) la garantiza el índice
// menu_semanal_dias_cat_dia_opcion_uidx (Fase G).
export const insertItem = async ({ menu_semanal_id, categoria_id, plato_id, dia, opcion, vianda_id, disponible_por_kilo }) => {
  const r = await query(
    `INSERT INTO menu_semanal_dias
       (menu_semanal_id, categoria_id, plato_id, dia, opcion, vianda_id, disponible_por_kilo)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [menu_semanal_id, categoria_id, plato_id, dia ?? null, opcion ?? null, vianda_id ?? null, disponible_por_kilo]
  );
  return findById(r.rows[0].id);
};
