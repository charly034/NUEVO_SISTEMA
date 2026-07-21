import { query } from '../../database/connection.js';

const COLS = 'id, fecha_inicio, fecha_fin, created_at, updated_at';

export const findAll = async () => {
  const r = await query(`SELECT ${COLS} FROM semanas ORDER BY fecha_inicio DESC`);
  return r.rows;
};

export const findById = async (id) => {
  const r = await query(`SELECT ${COLS} FROM semanas WHERE id = $1`, [id]);
  return r.rows[0] || null;
};

export const findByLunes = async (lunes) => {
  const r = await query(`SELECT ${COLS} FROM semanas WHERE fecha_inicio = $1`, [lunes]);
  return r.rows[0] || null;
};

// Upsert idempotente por lunes: crea la semana si no existe y devuelve la fila
// (nueva o existente) en una sola query. Un unico INSERT ... ON CONFLICT evita la
// carrera get-then-insert cuando la creacion de un menu y la de un pedido de la
// misma semana ocurren en paralelo. `db` opcional para correr dentro de una
// transaccion (pasar `client.query.bind(client)`).
export const getOrCreateByLunes = async (lunes, fechaFin = null, db = query) => {
  const r = await db(
    `INSERT INTO semanas (fecha_inicio, fecha_fin)
     VALUES ($1, COALESCE($2::date, $1::date + 6))
     ON CONFLICT (fecha_inicio) DO UPDATE SET updated_at = NOW()
     RETURNING ${COLS}`,
    [lunes, fechaFin],
  );
  return r.rows[0];
};
