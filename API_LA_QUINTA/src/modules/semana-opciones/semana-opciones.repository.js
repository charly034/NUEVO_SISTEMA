import { query } from '../../database/connection.js';

export { findMenu } from '../vista-semanal/vista-semanal.repository.js';

// Slots del menu con la empresa asignada resuelta (default de la empresa +
// excepcion puntual de esta semana, si existe) -- 1 query para toda la
// semana, sin N+1. La asignacion empresa->opcion NO depende del dia (la
// "Opcion A" es la misma identidad los 7 dias de la semana), por eso la
// resolucion de empresas se calcula una sola vez en la CTE `efectiva` y se
// cruza contra cada fila de menu_semanal_dias por su letra de opcion.
export const findSlotsConEmpresas = async (menuSemanalId) => {
  const result = await query(
    `WITH efectiva AS (
       SELECT e.id AS empresa_id, e.nombre AS empresa_nombre,
              COALESCE(eos.opcion, e.opcion_default) AS opcion_efectiva,
              (eos.opcion IS NOT NULL) AS es_excepcion
       FROM empresas e
       LEFT JOIN empresa_opcion_semana eos
         ON eos.empresa_id = e.id AND eos.menu_semanal_id = $1
       WHERE e.activo = true
     ),
     -- visible_empresa_ids: allowlist REAL (menu_empresa_visibilidad, filtra
     -- pedidos de verdad -- ver utils/visibilidadEmpresa.js), distinta de
     -- 'empresas' arriba (que es solo la asignacion Opcion A/B/C, organizativa,
     -- sin enforcement). Se agrega en su propia CTE 1:1 por slot para no
     -- multiplicar filas contra el cross join de 'efectiva'.
     visibilidad AS (
       SELECT menu_semanal_dia_id, array_agg(empresa_id) AS empresa_ids
       FROM menu_empresa_visibilidad
       GROUP BY menu_semanal_dia_id
     )
     SELECT msd.id AS slot_id, msd.dia::text AS dia, msd.opcion, msd.plato_id,
            p.nombre AS plato_nombre, msd.vianda_id, v.nombre_vianda,
            v.guarnicion_id, v.salsa_id, v.salsa_libre,
            msd.disponible_por_kilo,
            COALESCE(vis.empresa_ids, '{}') AS visible_empresa_ids,
            COALESCE(
              json_agg(
                json_build_object('empresa_id', ef.empresa_id, 'empresa_nombre', ef.empresa_nombre, 'es_excepcion', ef.es_excepcion)
                ORDER BY ef.empresa_nombre
              ) FILTER (WHERE ef.empresa_id IS NOT NULL AND (ef.opcion_efectiva = msd.opcion OR ef.opcion_efectiva IS NULL)),
              '[]'::json
            ) AS empresas
     FROM menu_semanal_dias msd
     JOIN platos p ON p.id = msd.plato_id
     LEFT JOIN viandas v ON v.id = msd.vianda_id
     LEFT JOIN visibilidad vis ON vis.menu_semanal_dia_id = msd.id
     LEFT JOIN efectiva ef ON true
     WHERE msd.menu_semanal_id = $1 AND msd.opcion IS NOT NULL
     GROUP BY msd.id, msd.dia, msd.opcion, msd.plato_id, p.nombre, msd.vianda_id, v.nombre_vianda, v.guarnicion_id, v.salsa_id, v.salsa_libre, msd.disponible_por_kilo, vis.empresa_ids
     ORDER BY msd.dia::text, msd.opcion ASC`,
    [menuSemanalId]
  );
  return result.rows;
};

// Teardown Fase F (payload categorias[]): todas las filas de menu_semanal_dias
// del menu que NO son fijos materializados -- es decir especiales, categorias
// custom y "Sin categorizar" (categoria_id NULL). Cada una es una celda
// slot-based (tiene id propio = slot_id) con su vianda/por-kilo/visibilidad,
// igual que findSlotsConEmpresas, pero categoria-aware y sin filtrar opcion
// (las custom pueden tener opcion=NULL). Los fijos (categoria fijos-x-dia/
// de-siempre) se EXCLUYEN aca porque el admin los sigue computando aparte
// desde el catalogo (findFijosYSiempre); incluirlos los duplicaria.
export const findItemsPlatosCategorizados = async (menuSemanalId) => {
  const result = await query(
    `WITH efectiva AS (
       SELECT e.id AS empresa_id, e.nombre AS empresa_nombre,
              COALESCE(eos.opcion, e.opcion_default) AS opcion_efectiva,
              (eos.opcion IS NOT NULL) AS es_excepcion
       FROM empresas e
       LEFT JOIN empresa_opcion_semana eos
         ON eos.empresa_id = e.id AND eos.menu_semanal_id = $1
       WHERE e.activo = true
     ),
     visibilidad AS (
       SELECT menu_semanal_dia_id, array_agg(empresa_id) AS empresa_ids
       FROM menu_empresa_visibilidad
       GROUP BY menu_semanal_dia_id
     )
     SELECT msd.id AS slot_id, msd.dia::text AS dia, msd.opcion, msd.plato_id,
            msd.categoria_id, c.slug AS categoria_slug,
            p.nombre AS plato_nombre, msd.vianda_id, v.nombre_vianda,
            v.guarnicion_id, v.salsa_id, v.salsa_libre,
            msd.disponible_por_kilo,
            -- Modo efectivo + PROCEDENCIA (plan-eng-review T7/B1). Se resuelve en el
            -- MISMO SQL que el modo para que el front no reimplemente la cascada (sería
            -- una copia más que se desincroniza justo en la capa cuyo trabajo es no
            -- mentir sobre el origen). Contexto admin: sin capa empresa, la cascada es
            -- override de celda → vianda → plato → sin (misma precedencia atómica que
            -- pedidos.repository.js VIANDA_SLOT_COLS).
            CASE
              WHEN msd.guarnicion_modo_override IS NOT NULL THEN msd.guarnicion_modo_override
              WHEN v.guarnicion_id IS NOT NULL THEN 'fija'
              WHEN p.tiene_guarnicion THEN 'libre'
              ELSE 'sin_guarnicion'
            END AS guarnicion_modo,
            CASE
              WHEN msd.guarnicion_modo_override IS NOT NULL THEN 'celda'
              WHEN v.guarnicion_id IS NOT NULL THEN 'vianda'
              WHEN p.tiene_guarnicion THEN 'plato'
              ELSE 'ninguna'
            END AS guarnicion_procedencia,
            CASE
              WHEN msd.guarnicion_modo_override IS NOT NULL THEN msd.guarnicion_fija_override_id
              ELSE v.guarnicion_id
            END AS guarnicion_efectiva_id,
            gf.nombre AS guarnicion_efectiva_nombre,
            CASE
              WHEN msd.salsa_modo_override IS NOT NULL THEN msd.salsa_modo_override
              WHEN v.salsa_id IS NOT NULL THEN 'fija'
              WHEN v.salsa_libre THEN 'libre'
              ELSE 'sin_salsa'
            END AS salsa_modo,
            CASE
              WHEN msd.salsa_modo_override IS NOT NULL THEN 'celda'
              WHEN v.salsa_id IS NOT NULL OR v.salsa_libre THEN 'vianda'
              ELSE 'ninguna'
            END AS salsa_procedencia,
            CASE
              WHEN msd.salsa_modo_override IS NOT NULL THEN msd.salsa_fija_override_id
              ELSE v.salsa_id
            END AS salsa_efectiva_id,
            sf.nombre AS salsa_efectiva_nombre,
            -- Excepciones por empresa sobre esta celda (T4/T9). Las "vigentes" cumplen
            -- la guarda plato_id_origen = plato actual; las "stale" quedaron apuntando a
            -- un plato que la rotación cambió y NO se aplican (el admin las reconfirma
            -- o borra). El front las muestra como "+N empresas" / "N desactualizadas".
            (SELECT COUNT(*)::int FROM menu_semanal_dia_empresa_override emo
              WHERE emo.menu_semanal_id = msd.menu_semanal_id
                AND emo.categoria_id = msd.categoria_id
                AND emo.dia IS NOT DISTINCT FROM msd.dia
                AND emo.opcion IS NOT DISTINCT FROM msd.opcion
                AND emo.plato_id_origen = msd.plato_id) AS excepciones_empresas,
            (SELECT COUNT(*)::int FROM menu_semanal_dia_empresa_override emo
              WHERE emo.menu_semanal_id = msd.menu_semanal_id
                AND emo.categoria_id = msd.categoria_id
                AND emo.dia IS NOT DISTINCT FROM msd.dia
                AND emo.opcion IS NOT DISTINCT FROM msd.opcion
                AND emo.plato_id_origen <> msd.plato_id) AS excepciones_stale,
            COALESCE(vis.empresa_ids, '{}') AS visible_empresa_ids,
            COALESCE(
              json_agg(
                json_build_object('empresa_id', ef.empresa_id, 'empresa_nombre', ef.empresa_nombre, 'es_excepcion', ef.es_excepcion)
                ORDER BY ef.empresa_nombre
              ) FILTER (WHERE ef.empresa_id IS NOT NULL AND msd.opcion IS NOT NULL AND (ef.opcion_efectiva = msd.opcion OR ef.opcion_efectiva IS NULL)),
              '[]'::json
            ) AS empresas
     FROM menu_semanal_dias msd
     JOIN platos p ON p.id = msd.plato_id
     LEFT JOIN categorias c ON c.id = msd.categoria_id
     LEFT JOIN viandas v ON v.id = msd.vianda_id
     LEFT JOIN guarniciones gf ON gf.id = CASE
       WHEN msd.guarnicion_modo_override IS NOT NULL THEN msd.guarnicion_fija_override_id
       ELSE v.guarnicion_id END
     LEFT JOIN salsas sf ON sf.id = CASE
       WHEN msd.salsa_modo_override IS NOT NULL THEN msd.salsa_fija_override_id
       ELSE v.salsa_id END
     LEFT JOIN visibilidad vis ON vis.menu_semanal_dia_id = msd.id
     LEFT JOIN efectiva ef ON true
     WHERE msd.menu_semanal_id = $1
       AND (msd.categoria_id IS NULL OR c.slug NOT IN ('fijos-x-dia', 'fijos-de-siempre'))
     GROUP BY msd.id, msd.dia, msd.opcion, msd.plato_id, msd.categoria_id, c.slug, p.nombre,
              p.tiene_guarnicion, msd.vianda_id, v.nombre_vianda, v.guarnicion_id, v.salsa_id,
              v.salsa_libre, gf.nombre, sf.nombre,
              msd.disponible_por_kilo, vis.empresa_ids
     ORDER BY msd.dia::text NULLS LAST, msd.opcion ASC NULLS LAST, p.nombre ASC`,
    [menuSemanalId]
  );
  return result.rows;
};

export const setDisponiblePorKilo = async (slotId, disponible) => {
  const r = await query(
    `UPDATE menu_semanal_dias SET disponible_por_kilo = $1 WHERE id = $2 RETURNING id`,
    [disponible, slotId]
  );
  return r.rows.length > 0;
};

// ── Vianda de especiales (ancla por slot -- el mismo vianda_id que ya
// existia en el schema desde Fase 1, pero que ningun endpoint vivo seteaba
// hasta ahora: hallazgo de sesion, vianda_activa de un especial era siempre
// false en la practica) ─────────────────────────────────────────────────

export const findSlotPlatoId = async (slotId) => {
  const r = await query('SELECT plato_id FROM menu_semanal_dias WHERE id = $1', [slotId]);
  return r.rows[0]?.plato_id ?? null;
};

export const setSlotVianda = async (slotId, viandaId) => {
  const r = await query(
    'UPDATE menu_semanal_dias SET vianda_id = $1 WHERE id = $2 RETURNING id, vianda_id',
    [viandaId, slotId]
  );
  return r.rows[0] || null;
};

// ── Excepcion puntual empresa->opcion (por semana) ───────────────────

export const findExcepcionEmpresaOpcion = async (menuSemanalId, empresaId) => {
  const r = await query(
    `SELECT id, menu_semanal_id, empresa_id, opcion, created_at
     FROM empresa_opcion_semana WHERE menu_semanal_id = $1 AND empresa_id = $2`,
    [menuSemanalId, empresaId]
  );
  return r.rows[0] || null;
};

export const upsertExcepcionEmpresaOpcion = async (menuSemanalId, empresaId, opcion) => {
  const r = await query(
    `INSERT INTO empresa_opcion_semana (menu_semanal_id, empresa_id, opcion)
     VALUES ($1, $2, $3)
     ON CONFLICT (menu_semanal_id, empresa_id) DO UPDATE SET opcion = EXCLUDED.opcion
     RETURNING id, menu_semanal_id, empresa_id, opcion, created_at`,
    [menuSemanalId, empresaId, opcion]
  );
  return r.rows[0];
};

export const deleteExcepcionEmpresaOpcion = async (menuSemanalId, empresaId) => {
  await query(
    'DELETE FROM empresa_opcion_semana WHERE menu_semanal_id = $1 AND empresa_id = $2',
    [menuSemanalId, empresaId]
  );
};

// ── Vianda de fijos (ancla por semana, ver migracion 1719000070000) ─────

export const findFijosViandaMap = async (menuSemanalId) => {
  const r = await query(
    `SELECT msfv.plato_id, msfv.vianda_id, v.nombre_vianda, v.guarnicion_id, v.salsa_id, v.salsa_libre
     FROM menu_semanal_fijos_vianda msfv
     JOIN viandas v ON v.id = msfv.vianda_id
     WHERE msfv.menu_semanal_id = $1`,
    [menuSemanalId]
  );
  return Object.fromEntries(r.rows.map((row) => [row.plato_id, {
    vianda_id: row.vianda_id,
    nombre_vianda: row.nombre_vianda,
    guarnicion_id: row.guarnicion_id,
    salsa_id: row.salsa_id,
    salsa_libre: row.salsa_libre,
  }]));
};

export const marcarFijoVianda = async (menuSemanalId, platoId, viandaId) => {
  const r = await query(
    `INSERT INTO menu_semanal_fijos_vianda (menu_semanal_id, plato_id, vianda_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (menu_semanal_id, plato_id) DO UPDATE SET vianda_id = EXCLUDED.vianda_id
     RETURNING id, menu_semanal_id, plato_id, vianda_id`,
    [menuSemanalId, platoId, viandaId]
  );
  return r.rows[0];
};

export const quitarFijoVianda = async (menuSemanalId, platoId) => {
  await query(
    'DELETE FROM menu_semanal_fijos_vianda WHERE menu_semanal_id = $1 AND plato_id = $2',
    [menuSemanalId, platoId]
  );
};

// ── Venta por kilo de fijos (excepcion por semana, ver migracion
// 1719000072000 -- default disponible=true, la fila representa la
// EXCLUSION puntual de esta semana) ──────────────────────────────────

export const findFijosSinKiloSet = async (menuSemanalId) => {
  const r = await query(
    'SELECT plato_id FROM menu_semanal_fijos_kilo WHERE menu_semanal_id = $1',
    [menuSemanalId]
  );
  return new Set(r.rows.map((row) => row.plato_id));
};

export const marcarFijoSinKilo = async (menuSemanalId, platoId) => {
  await query(
    `INSERT INTO menu_semanal_fijos_kilo (menu_semanal_id, plato_id)
     VALUES ($1, $2)
     ON CONFLICT (menu_semanal_id, plato_id) DO NOTHING`,
    [menuSemanalId, platoId]
  );
};

export const quitarFijoSinKilo = async (menuSemanalId, platoId) => {
  await query(
    'DELETE FROM menu_semanal_fijos_kilo WHERE menu_semanal_id = $1 AND plato_id = $2',
    [menuSemanalId, platoId]
  );
};

// ── Visibilidad de empresas de fijos (por semana, ver migracion
// 1719000073000 -- mismo modelo allowlist que menu_empresa_visibilidad) ──

export const findFijosVisibilidadMap = async (menuSemanalId) => {
  const r = await query(
    'SELECT plato_id, empresa_id FROM menu_semanal_fijos_visibilidad WHERE menu_semanal_id = $1',
    [menuSemanalId]
  );
  const map = {};
  for (const row of r.rows) {
    if (!map[row.plato_id]) map[row.plato_id] = [];
    map[row.plato_id].push(row.empresa_id);
  }
  return map;
};

export const setEmpresasFijo = async (menuSemanalId, platoId, empresaIds) => {
  await query(
    'DELETE FROM menu_semanal_fijos_visibilidad WHERE menu_semanal_id = $1 AND plato_id = $2',
    [menuSemanalId, platoId]
  );
  if (empresaIds.length > 0) {
    const values = empresaIds.map((eid, i) => `($1, $2, $${i + 3})`).join(', ');
    await query(
      `INSERT INTO menu_semanal_fijos_visibilidad (menu_semanal_id, plato_id, empresa_id) VALUES ${values}`,
      [menuSemanalId, platoId, ...empresaIds]
    );
  }
};

// ── Guarniciones y salsas "sueltas" ofrecidas esta semana (venta local,
// independiente de una vianda -- ver migracion 1719000074000) ───────────

export const findGuarnicionesSemana = async (menuSemanalId) => {
  const r = await query(
    `SELECT g.id, g.nombre
     FROM menu_semanal_guarniciones msg
     JOIN guarniciones g ON g.id = msg.guarnicion_id
     WHERE msg.menu_semanal_id = $1
     ORDER BY g.nombre ASC`,
    [menuSemanalId]
  );
  return r.rows;
};

export const agregarGuarnicionSemana = async (menuSemanalId, guarnicionId) => {
  await query(
    `INSERT INTO menu_semanal_guarniciones (menu_semanal_id, guarnicion_id)
     VALUES ($1, $2) ON CONFLICT (menu_semanal_id, guarnicion_id) DO NOTHING`,
    [menuSemanalId, guarnicionId]
  );
};

export const quitarGuarnicionSemana = async (menuSemanalId, guarnicionId) => {
  await query(
    'DELETE FROM menu_semanal_guarniciones WHERE menu_semanal_id = $1 AND guarnicion_id = $2',
    [menuSemanalId, guarnicionId]
  );
};

export const findSalsasSemana = async (menuSemanalId) => {
  const r = await query(
    `SELECT s.id, s.nombre
     FROM menu_semanal_salsas mss
     JOIN salsas s ON s.id = mss.salsa_id
     WHERE mss.menu_semanal_id = $1
     ORDER BY s.nombre ASC`,
    [menuSemanalId]
  );
  return r.rows;
};

export const agregarSalsaSemana = async (menuSemanalId, salsaId) => {
  await query(
    `INSERT INTO menu_semanal_salsas (menu_semanal_id, salsa_id)
     VALUES ($1, $2) ON CONFLICT (menu_semanal_id, salsa_id) DO NOTHING`,
    [menuSemanalId, salsaId]
  );
};

export const quitarSalsaSemana = async (menuSemanalId, salsaId) => {
  await query(
    'DELETE FROM menu_semanal_salsas WHERE menu_semanal_id = $1 AND salsa_id = $2',
    [menuSemanalId, salsaId]
  );
};
