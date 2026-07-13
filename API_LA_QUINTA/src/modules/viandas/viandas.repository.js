import { query } from '../../database/connection.js';

const SELECT_COLS = `
  v.id, v.plato_id, v.guarnicion_id, v.salsa_id, v.salsa_libre, v.empresa_id,
  v.nombre_vianda, v.nombre_generado, v.activo, v.created_at, v.updated_at,
  p.nombre AS plato_nombre,
  g.nombre AS guarnicion_nombre,
  s.nombre AS salsa_nombre,
  e.nombre AS empresa_nombre
`;

const JOINS = `
  FROM viandas v
  JOIN platos p ON p.id = v.plato_id
  LEFT JOIN guarniciones g ON g.id = v.guarnicion_id
  LEFT JOIN salsas s ON s.id = v.salsa_id
  LEFT JOIN empresas e ON e.id = v.empresa_id
`;

export const findAll = async ({ activo, empresa_id, plato_id } = {}) => {
  const conditions = [];
  const values = [];

  if (activo !== undefined) {
    values.push(activo === 'true' || activo === true);
    conditions.push(`v.activo = $${values.length}`);
  }
  if (empresa_id) {
    values.push(empresa_id);
    conditions.push(`v.empresa_id = $${values.length}`);
  }
  if (plato_id) {
    values.push(plato_id);
    conditions.push(`v.plato_id = $${values.length}`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const result = await query(
    `SELECT ${SELECT_COLS} ${JOINS} ${where} ORDER BY p.nombre ASC, v.id ASC`,
    values
  );
  return result.rows;
};

export const findById = async (id) => {
  const result = await query(`SELECT ${SELECT_COLS} ${JOINS} WHERE v.id = $1`, [id]);
  return result.rows[0] || null;
};

export const create = async ({
  plato_id,
  guarnicion_id = null,
  salsa_id = null,
  salsa_libre = false,
  empresa_id = null,
  nombre_vianda = null,
}) => {
  const result = await query(
    `INSERT INTO viandas (plato_id, guarnicion_id, salsa_id, salsa_libre, empresa_id, nombre_vianda)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [plato_id, guarnicion_id, salsa_id, salsa_libre, empresa_id, nombre_vianda]
  );
  return findById(result.rows[0].id);
};

export const update = async (id, fields) => {
  const keys = Object.keys(fields);
  if (keys.length === 0) return findById(id);

  const values = Object.values(fields);
  const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');
  values.push(id);

  const result = await query(
    `UPDATE viandas SET ${setClause} WHERE id = $${values.length} RETURNING id`,
    values
  );
  if (!result.rows[0]) return null;
  return findById(id);
};

export const existsActivaParaPlato = async (platoId) => {
  const result = await query(
    'SELECT 1 FROM viandas WHERE plato_id = $1 AND activo = true LIMIT 1',
    [platoId]
  );
  return result.rows.length > 0;
};

// La vianda "general" de un plato (sin empresa especifica) -- la que se usa
// por defecto al marcar un fijo como vianda para una semana puntual.
export const findGeneralActivaParaPlato = async (platoId) => {
  const result = await query(
    'SELECT id FROM viandas WHERE plato_id = $1 AND empresa_id IS NULL AND activo = true LIMIT 1',
    [platoId]
  );
  return result.rows[0] || null;
};
