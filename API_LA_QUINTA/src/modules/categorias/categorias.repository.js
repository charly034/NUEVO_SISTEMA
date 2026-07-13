import { query, getClient } from '../../database/connection.js';

const execute = (db, text, params) => (
  typeof db === 'function' ? db(text, params) : db.query(text, params)
);

// Columnas de la categoria + sus defaults de vianda (LEFT JOIN, pueden ser
// NULL si la categoria no tiene fila en categoria_defaults_vianda).
const SELECT_CATEGORIA = `
  SELECT
    c.id, c.nombre, c.slug, c.tipo_dato, c.alcance, c.menu_semanal_id,
    c.modo, c.usa_opcion, c.es_sistema, c.orden, c.activo, c.created_at,
    d.default_vianda_activa,
    d.default_disponible_por_kilo,
    d.default_empresa_ids
  FROM categorias c
  LEFT JOIN categoria_defaults_vianda d ON d.categoria_id = c.id`;

// ── Categorias: lectura ────────────────────────────────────────────────

export const findAll = async ({ tipo_dato, activo, incluir_sistema } = {}) => {
  const conds = [];
  const vals = [];
  if (tipo_dato) {
    vals.push(tipo_dato);
    conds.push(`c.tipo_dato = $${vals.length}`);
  }
  if (activo !== undefined) {
    vals.push(activo);
    conds.push(`c.activo = $${vals.length}`);
  }
  if (incluir_sistema === false) {
    conds.push('c.es_sistema = false');
  }
  const where = conds.length ? `WHERE ${conds.join(' AND ')}` : '';
  const r = await query(`${SELECT_CATEGORIA} ${where} ORDER BY c.orden ASC, c.id ASC`, vals);
  return r.rows;
};

export const findById = async (id) => {
  const r = await query(`${SELECT_CATEGORIA} WHERE c.id = $1`, [id]);
  return r.rows[0] || null;
};

export const findBySlug = async (slug) => {
  const r = await query('SELECT id, slug FROM categorias WHERE slug = $1', [slug]);
  return r.rows[0] || null;
};

// Todos los slugs que empiezan con un prefijo (para autogenerar {slug}-{n}).
export const findSlugsQueEmpiezan = async (prefijo) => {
  const r = await query('SELECT slug FROM categorias WHERE slug LIKE $1', [`${prefijo}%`]);
  return r.rows.map((row) => row.slug);
};

// Mayor `orden` existente (para que una categoría nueva se cree al final y sea
// reordenable por drag).
export const maxOrden = async () => {
  const r = await query('SELECT COALESCE(MAX(orden), 0) AS max FROM categorias');
  return Number(r.rows[0].max);
};

// ── Grupos de una categoria ────────────────────────────────────────────

export const findGruposDeCategoria = async (categoriaId, { soloActivos = false } = {}) => {
  const where = soloActivos ? 'AND activo = true' : '';
  const r = await query(
    `SELECT id, categoria_id, nombre, criterio, ciclo_offset, periodo,
            fecha_desde::text AS fecha_desde, fecha_hasta::text AS fecha_hasta,
            semana_del_mes, meses, orden, activo, created_at
     FROM categoria_grupo
     WHERE categoria_id = $1 ${where}
     ORDER BY orden ASC, id ASC`,
    [categoriaId]
  );
  return r.rows;
};

export const findGrupoById = async (id) => {
  const r = await query(
    `SELECT id, categoria_id, nombre, criterio, ciclo_offset, periodo,
            fecha_desde::text AS fecha_desde, fecha_hasta::text AS fecha_hasta,
            semana_del_mes, meses, orden, activo, created_at
     FROM categoria_grupo WHERE id = $1`,
    [id]
  );
  return r.rows[0] || null;
};

export const findPlatosDeGrupo = async (grupoId) => {
  const r = await query(
    `SELECT cgp.plato_id, cgp.orden, p.nombre AS plato_nombre
     FROM categoria_grupo_plato cgp
     JOIN platos p ON p.id = cgp.plato_id
     WHERE cgp.categoria_grupo_id = $1
     ORDER BY cgp.orden ASC, cgp.plato_id ASC`,
    [grupoId]
  );
  return r.rows;
};

// Categoria + defaults + grupos (cada uno con sus platos), para el drawer.
export const findByIdConDetalle = async (id) => {
  const categoria = await findById(id);
  if (!categoria) return null;
  const grupos = await findGruposDeCategoria(id);
  const gruposConPlatos = await Promise.all(
    grupos.map(async (g) => ({ ...g, platos: await findPlatosDeGrupo(g.id) }))
  );
  return { ...categoria, grupos: gruposConPlatos };
};

// ── Categorias: escritura ──────────────────────────────────────────────

export const create = async ({
  nombre, slug, tipo_dato, alcance = 'recurrente', menu_semanal_id = null,
  modo = 'plato_distinto_por_dia', usa_opcion = false, orden = 0,
}) => {
  const r = await query(
    `INSERT INTO categorias
       (nombre, slug, tipo_dato, alcance, menu_semanal_id, modo, usa_opcion, es_sistema, orden)
     VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8)
     RETURNING id`,
    [nombre, slug, tipo_dato, alcance, menu_semanal_id, modo, usa_opcion, orden]
  );
  return findById(r.rows[0].id);
};

// Actualiza solo las columnas propias de la categoria (los defaults van por
// upsertDefaults). `fields` ya viene saneado por el service.
export const update = async (id, fields) => {
  const keys = Object.keys(fields);
  if (keys.length === 0) return findById(id);
  const vals = Object.values(fields);
  const set = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  vals.push(id);
  const r = await query(
    `UPDATE categorias SET ${set} WHERE id = $${vals.length} RETURNING id`,
    vals
  );
  return r.rows[0] ? findById(id) : null;
};

export const upsertDefaults = async (categoriaId, { default_vianda_activa, default_disponible_por_kilo, default_empresa_ids }) => {
  await query(
    `INSERT INTO categoria_defaults_vianda
       (categoria_id, default_vianda_activa, default_disponible_por_kilo, default_empresa_ids)
     VALUES ($1, COALESCE($2, true), COALESCE($3, true), $4)
     ON CONFLICT (categoria_id) DO UPDATE SET
       default_vianda_activa       = COALESCE(EXCLUDED.default_vianda_activa, categoria_defaults_vianda.default_vianda_activa),
       default_disponible_por_kilo = COALESCE(EXCLUDED.default_disponible_por_kilo, categoria_defaults_vianda.default_disponible_por_kilo),
       default_empresa_ids         = EXCLUDED.default_empresa_ids`,
    [categoriaId, default_vianda_activa ?? null, default_disponible_por_kilo ?? null, default_empresa_ids ?? null]
  );
  return findById(categoriaId);
};

// Borrado FISICO de una categoria custom. Las filas de menu_semanal_dias que
// la referencian quedan con categoria_id=NULL (ON DELETE SET NULL, bucket "Sin
// categorizar"); defaults y grupos caen por ON DELETE CASCADE. Los platos NUNCA
// se borran. El service ya garantizo es_sistema=false.
export const remove = async (id) => {
  const r = await query('DELETE FROM categorias WHERE id = $1 RETURNING id', [id]);
  return Boolean(r.rows[0]);
};

// Clona una categoria (custom o de sistema) como una nueva categoria custom,
// con sus defaults, grupos y platos-de-grupo. Transaccional: o se copia todo o
// nada. es_sistema del clon es siempre false.
export const duplicar = async (origenId, { nombre, slug }) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { rows: origenRows } = await client.query(
      `SELECT nombre, tipo_dato, alcance, menu_semanal_id, modo, usa_opcion, orden
       FROM categorias WHERE id = $1`,
      [origenId]
    );
    const origen = origenRows[0];

    const { rows: nuevaRows } = await client.query(
      `INSERT INTO categorias
         (nombre, slug, tipo_dato, alcance, menu_semanal_id, modo, usa_opcion, es_sistema, orden)
       VALUES ($1, $2, $3, $4, $5, $6, $7, false, $8)
       RETURNING id`,
      [nombre, slug, origen.tipo_dato, origen.alcance, origen.menu_semanal_id, origen.modo, origen.usa_opcion, origen.orden]
    );
    const nuevaId = nuevaRows[0].id;

    await client.query(
      `INSERT INTO categoria_defaults_vianda
         (categoria_id, default_vianda_activa, default_disponible_por_kilo, default_empresa_ids)
       SELECT $1, default_vianda_activa, default_disponible_por_kilo, default_empresa_ids
       FROM categoria_defaults_vianda WHERE categoria_id = $2`,
      [nuevaId, origenId]
    );

    // Grupos: copiar uno por uno para poder remapear sus platos al grupo nuevo.
    const { rows: grupos } = await client.query(
      `SELECT id, nombre, criterio, ciclo_offset, orden, activo
       FROM categoria_grupo WHERE categoria_id = $1 ORDER BY orden, id`,
      [origenId]
    );
    for (const g of grupos) {
      const { rows: gNuevoRows } = await client.query(
        `INSERT INTO categoria_grupo (categoria_id, nombre, criterio, ciclo_offset, orden, activo)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [nuevaId, g.nombre, g.criterio, g.ciclo_offset, g.orden, g.activo]
      );
      await client.query(
        `INSERT INTO categoria_grupo_plato (categoria_grupo_id, plato_id, orden)
         SELECT $1, plato_id, orden FROM categoria_grupo_plato WHERE categoria_grupo_id = $2`,
        [gNuevoRows[0].id, g.id]
      );
    }

    await client.query('COMMIT');
    return findById(nuevaId);
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
};

// ── Grupos: escritura ──────────────────────────────────────────────────

export const createGrupo = async ({
  categoria_id, nombre, criterio = 'siempre', ciclo_offset = null,
  periodo = null, fecha_desde = null, fecha_hasta = null, semana_del_mes = null, meses = null,
  orden = 0, activo = true,
}) => {
  const r = await query(
    `INSERT INTO categoria_grupo
       (categoria_id, nombre, criterio, ciclo_offset, periodo, fecha_desde, fecha_hasta, semana_del_mes, meses, orden, activo)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id`,
    [categoria_id, nombre, criterio, ciclo_offset, periodo, fecha_desde, fecha_hasta, semana_del_mes, meses, orden, activo]
  );
  return findGrupoById(r.rows[0].id);
};

export const updateGrupo = async (id, fields) => {
  const keys = Object.keys(fields);
  if (keys.length === 0) return findGrupoById(id);
  const vals = Object.values(fields);
  const set = keys.map((k, i) => `${k} = $${i + 1}`).join(', ');
  vals.push(id);
  const r = await query(
    `UPDATE categoria_grupo SET ${set} WHERE id = $${vals.length} RETURNING id`,
    vals
  );
  return r.rows[0] ? findGrupoById(id) : null;
};

export const removeGrupo = async (id) => {
  const r = await query('DELETE FROM categoria_grupo WHERE id = $1 RETURNING id', [id]);
  return Boolean(r.rows[0]);
};

export const agregarPlatoAGrupo = async (grupoId, platoId, orden = 0) => {
  await query(
    `INSERT INTO categoria_grupo_plato (categoria_grupo_id, plato_id, orden)
     VALUES ($1, $2, $3)
     ON CONFLICT (categoria_grupo_id, plato_id) DO UPDATE SET orden = EXCLUDED.orden`,
    [grupoId, platoId, orden]
  );
  return findPlatosDeGrupo(grupoId);
};

export const quitarPlatoDeGrupo = async (grupoId, platoId) => {
  await query(
    'DELETE FROM categoria_grupo_plato WHERE categoria_grupo_id = $1 AND plato_id = $2',
    [grupoId, platoId]
  );
  return findPlatosDeGrupo(grupoId);
};

// Fase B/C del teardown "la semana es el contenedor". Materializa los platos
// FIJOS de un menu como filas de menu_semanal_dias con su categoria_id, para
// que dejen de leerse de platos.disponibilidad y pasen a ser dato por-semana.
//
// Regla de categoria (decision de sesion 2026-07-13, ver design doc):
//   - disponibilidad='fijo_dia'  -> categoria "Fijos x dia",  dia = dia_fijo.
//   - todo lo demas del conjunto -> categoria "Fijos de siempre", dia = NULL.
//     "todo lo demas" = disponibilidad='siempre' MAS los 14 platos legacy
//     tipo='fijo' con disponibilidad='especial' (el usuario eligio mantenerlos
//     como fijos, ver AskUserQuestion "14 fijos fantasma"). El conjunto es
//     exactamente el mismo que cargarPlatosFijos: (tipo='fijo' OR
//     disponibilidad IN ('fijo_dia','siempre')).
//
// vianda_id: se usa el anclaje por-semana (menu_semanal_fijos_vianda) que dejo
// el backfill, con fallback a la vianda general activa del plato (misma que
// usa cargarPlatosFijos por su JOIN v.plato_id=p.id). disponible_por_kilo: la
// tabla de excepciones (menu_semanal_fijos_kilo) invierte el default true.
//
// Idempotente (NOT EXISTS): correrla dos veces sobre el mismo menu no duplica.
export const materializarFijosMenu = (db = query, menuSemanalId) =>
  execute(db,
    `INSERT INTO menu_semanal_dias
       (menu_semanal_id, dia, opcion, plato_id, categoria_id, vianda_id, disponible_por_kilo)
     SELECT
       $1,
       CASE WHEN p.disponibilidad = 'fijo_dia' THEN p.dia_fijo ELSE NULL END,
       NULL,
       p.id,
       CASE WHEN p.disponibilidad = 'fijo_dia'
            THEN (SELECT id FROM categorias WHERE slug = 'fijos-x-dia')
            ELSE (SELECT id FROM categorias WHERE slug = 'fijos-de-siempre')
       END,
       COALESCE(
         msfv.vianda_id,
         (SELECT id FROM viandas WHERE plato_id = p.id AND activo = true LIMIT 1)
       ),
       NOT EXISTS (
         SELECT 1 FROM menu_semanal_fijos_kilo msk
         WHERE msk.menu_semanal_id = $1 AND msk.plato_id = p.id
       )
     FROM platos p
     LEFT JOIN menu_semanal_fijos_vianda msfv
       ON msfv.menu_semanal_id = $1 AND msfv.plato_id = p.id
     WHERE p.activo = true
       AND (p.tipo = 'fijo' OR p.disponibilidad IN ('fijo_dia', 'siempre'))
       AND NOT EXISTS (
         SELECT 1 FROM menu_semanal_dias msd
         JOIN categorias c ON c.id = msd.categoria_id
           AND c.slug IN ('fijos-x-dia', 'fijos-de-siempre')
         WHERE msd.menu_semanal_id = $1 AND msd.plato_id = p.id
       )`,
    [menuSemanalId]
  );

// Quita todas las filas de fijos materializadas de un menu (para rollback /
// re-materializacion limpia en tests).
export const desmaterializarFijosMenu = (db = query, menuSemanalId) =>
  execute(db,
    `DELETE FROM menu_semanal_dias msd
     USING categorias c
     WHERE msd.categoria_id = c.id
       AND c.slug IN ('fijos-x-dia', 'fijos-de-siempre')
       AND msd.menu_semanal_id = $1`,
    [menuSemanalId]
  );

// ── Rotación (Fase H): excepción manual + materialización ────────────────

// Categorías (activas, de platos) que tienen al menos un grupo de rotación
// activo. Son las candidatas a materializar rotación en un menú.
export const findCategoriasConGrupos = async () => {
  const r = await query(
    `SELECT DISTINCT c.id
     FROM categorias c
     JOIN categoria_grupo g ON g.categoria_id = c.id AND g.activo = true
     WHERE c.activo = true AND c.tipo_dato = 'platos'`
  );
  return r.rows.map((row) => row.id);
};

export const findSeleccionSemana = async (menuSemanalId, categoriaId) => {
  const r = await query(
    `SELECT categoria_grupo_id FROM categoria_grupo_seleccion_semana
     WHERE menu_semanal_id = $1 AND categoria_id = $2`,
    [menuSemanalId, categoriaId]
  );
  return r.rows[0]?.categoria_grupo_id ?? null;
};

export const upsertSeleccionSemana = async (menuSemanalId, categoriaId, categoriaGrupoId) => {
  await query(
    `INSERT INTO categoria_grupo_seleccion_semana (menu_semanal_id, categoria_id, categoria_grupo_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (menu_semanal_id, categoria_id) DO UPDATE SET categoria_grupo_id = EXCLUDED.categoria_grupo_id`,
    [menuSemanalId, categoriaId, categoriaGrupoId]
  );
};

export const deleteSeleccionSemana = async (menuSemanalId, categoriaId) => {
  await query(
    'DELETE FROM categoria_grupo_seleccion_semana WHERE menu_semanal_id = $1 AND categoria_id = $2',
    [menuSemanalId, categoriaId]
  );
};

// Borra las filas materializadas por rotación de un menú (las que tienen
// origen_categoria_grupo_id). NO toca las filas cargadas a mano (origen NULL).
// Opcionalmente acotado a una categoría.
export const desmaterializarRotacion = (db = query, menuSemanalId, categoriaId = null) =>
  execute(db,
    `DELETE FROM menu_semanal_dias
     WHERE menu_semanal_id = $1
       AND origen_categoria_grupo_id IS NOT NULL
       AND ($2::integer IS NULL OR categoria_id = $2)`,
    [menuSemanalId, categoriaId]
  );

// Inserta una fila materializada por rotación (marca su origen para poder
// re-sembrar). vianda/kilo salen de los defaults de la categoría. NOT EXISTS
// evita duplicar el mismo plato del mismo grupo en el mismo día.
export const insertFilaRotacion = (db = query, { menu_semanal_id, categoria_id, plato_id, dia, vianda_id, disponible_por_kilo, origen_categoria_grupo_id }) =>
  execute(db,
    `INSERT INTO menu_semanal_dias
       (menu_semanal_id, categoria_id, plato_id, dia, opcion, vianda_id, disponible_por_kilo, origen_categoria_grupo_id)
     SELECT $1, $2, $3, $4, NULL, $5, $6, $7
     WHERE NOT EXISTS (
       SELECT 1 FROM menu_semanal_dias
       WHERE menu_semanal_id = $1 AND categoria_id = $2 AND plato_id = $3
         AND dia IS NOT DISTINCT FROM $4 AND origen_categoria_grupo_id = $7
     )`,
    [menu_semanal_id, categoria_id, plato_id, dia ?? null, vianda_id ?? null, disponible_por_kilo, origen_categoria_grupo_id]
  );
