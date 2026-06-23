import { query } from '../../database/connection.js';

// El repository es el ÚNICO lugar que habla con la base de datos.
// Aquí van todas las consultas SQL. Sin lógica de negocio.

export const findAll = async ({ limit = 10, offset = 0 } = {}) => {
  const result = await query(
    'SELECT id, nombre, email, created_at, updated_at FROM users ORDER BY created_at DESC LIMIT $1 OFFSET $2',
    [limit, offset]
  );
  return result.rows;
};

export const countAll = async () => {
  const result = await query('SELECT COUNT(*) as total FROM users');
  return parseInt(result.rows[0].total, 10);
};

export const findById = async (id) => {
  const result = await query(
    'SELECT id, nombre, email, created_at, updated_at FROM users WHERE id = $1',
    [id]
  );
  return result.rows[0] || null;
};

export const findByEmail = async (email) => {
  const result = await query(
    'SELECT id, nombre, email FROM users WHERE email = $1',
    [email]
  );
  return result.rows[0] || null;
};

export const create = async ({ nombre, email }) => {
  const result = await query(
    'INSERT INTO users (nombre, email) VALUES ($1, $2) RETURNING id, nombre, email, created_at, updated_at',
    [nombre, email]
  );
  return result.rows[0];
};

export const update = async (id, fields) => {
  const keys = Object.keys(fields);
  const values = Object.values(fields);

  // Construir SET dinámico: SET nombre = $1, email = $2
  const setClause = keys.map((key, i) => `${key} = $${i + 1}`).join(', ');
  values.push(id);

  const result = await query(
    `UPDATE users SET ${setClause}, updated_at = NOW() WHERE id = $${values.length} RETURNING id, nombre, email, created_at, updated_at`,
    values
  );
  return result.rows[0] || null;
};

export const remove = async (id) => {
  const result = await query(
    'DELETE FROM users WHERE id = $1 RETURNING id',
    [id]
  );
  return result.rows[0] || null;
};
