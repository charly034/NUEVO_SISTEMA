import { query } from '../../database/connection.js';

const SELECT_COLS = 'id, nombre, descripcion, tags, tipo, tiene_guarnicion, activo, created_at, updated_at';

const SORT_MAP = {
  nombre:     'p.nombre',
  activo:     'p.activo',
  created_at: 'p.created_at',
  ultimo_uso: 'h.fecha_servicio',
};

export const findAll = async ({ limit = 20, offset = 0, activo, search, tag, tipo, sort_by = 'nombre', sort_dir = 'asc' } = {}) => {
  const conditions = [];
  const values = [];

  if (activo !== undefined) {
    values.push(activo === 'true');
    conditions.push(`activo = $${values.length}`);
  }
  if (search) {
    values.push(`%${search}%`);
    conditions.push(`(p.nombre ILIKE $${values.length} OR p.descripcion ILIKE $${values.length})`);
  }
  if (tag) {
    values.push(tag);
    conditions.push(`$${values.length} = ANY(p.tags)`);
  }
  if (tipo) {
    values.push(tipo);
    conditions.push(`p.tipo = $${values.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const col   = SORT_MAP[sort_by] ?? 'p.nombre';
  const dir   = sort_dir === 'desc' ? 'DESC' : 'ASC';
  const nulls = sort_by === 'ultimo_uso' ? 'NULLS LAST' : '';
  // Solo agrega nombre como secundario si no es la columna primaria
  const secondary = col !== 'p.nombre' ? ', p.nombre ASC' : '';

  values.push(limit, offset);
  const result = await query(
    `SELECT p.id, p.nombre, p.descripcion, p.tags, p.tipo, p.tiene_guarnicion,
            p.activo, p.created_at, p.updated_at,
            h.fecha_servicio AS ultimo_uso_fecha,
            h.dia            AS ultimo_uso_dia,
            h.opcion         AS ultimo_uso_opcion,
            h.menu_nombre    AS ultimo_uso_menu
     FROM platos p
     LEFT JOIN LATERAL (
       SELECT h2.fecha_servicio, h2.dia, h2.opcion, ms2.nombre AS menu_nombre
       FROM historial_uso_platos h2
       LEFT JOIN menus_semanales ms2 ON ms2.id = h2.menu_semanal_id
       WHERE h2.plato_id = p.id
       ORDER BY h2.fecha_servicio DESC
       LIMIT 1
     ) h ON true
     ${where}
     ORDER BY ${col} ${dir} ${nulls}${secondary}
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );

  return result.rows.map(r => ({
    id: r.id, nombre: r.nombre, descripcion: r.descripcion,
    tags: r.tags, tipo: r.tipo, tiene_guarnicion: r.tiene_guarnicion,
    activo: r.activo, created_at: r.created_at, updated_at: r.updated_at,
    ultimo_uso: r.ultimo_uso_fecha
      ? { fecha_servicio: r.ultimo_uso_fecha, dia: r.ultimo_uso_dia, opcion: r.ultimo_uso_opcion, menu_semanal_nombre: r.ultimo_uso_menu }
      : null,
  }));
};

export const countAll = async ({ activo, search, tag, tipo } = {}) => {
  const conditions = [];
  const values = [];

  if (activo !== undefined) {
    values.push(activo === 'true');
    conditions.push(`activo = $${values.length}`);
  }
  if (search) {
    values.push(`%${search}%`);
    conditions.push(`(nombre ILIKE $${values.length} OR descripcion ILIKE $${values.length})`);
  }
  if (tag) {
    values.push(tag);
    conditions.push(`$${values.length} = ANY(tags)`);
  }
  if (tipo) {
    values.push(tipo);
    conditions.push(`tipo = $${values.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await query(`SELECT COUNT(*) as total FROM platos ${where}`, values);
  return parseInt(result.rows[0].total, 10);
};

export const findById = async (id) => {
  const result = await query(
    `SELECT ${SELECT_COLS} FROM platos WHERE id = $1`,
    [id]
  );
  return result.rows[0] || null;
};

export const findAllTags = async () => {
  const result = await query(
    `SELECT DISTINCT unnest(tags) AS tag FROM platos WHERE activo = true ORDER BY tag ASC`
  );
  return result.rows.map((r) => r.tag);
};

export const create = async ({ nombre, descripcion, tags = [], tipo = 'especial', tiene_guarnicion = false }) => {
  const result = await query(
    `INSERT INTO platos (nombre, descripcion, tags, tipo, tiene_guarnicion)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING ${SELECT_COLS}`,
    [nombre, descripcion ?? null, tags, tipo, tiene_guarnicion]
  );
  return result.rows[0];
};

export const update = async (id, fields) => {
  const keys = Object.keys(fields);
  const values = Object.values(fields);
  const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');
  values.push(id);

  const result = await query(
    `UPDATE platos SET ${setClause}, updated_at = NOW() WHERE id = $${values.length}
     RETURNING ${SELECT_COLS}`,
    values
  );
  return result.rows[0] || null;
};

export const remove = async (id) => {
  const result = await query('DELETE FROM platos WHERE id = $1 RETURNING id', [id]);
  return result.rows[0] || null;
};

export const isUsedInMenuSemanal = async (id) => {
  const result = await query(
    'SELECT 1 FROM menu_semanal_dias WHERE plato_id = $1 LIMIT 1',
    [id]
  );
  return result.rows.length > 0;
};
