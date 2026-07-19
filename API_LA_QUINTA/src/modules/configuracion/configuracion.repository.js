import { query } from '../../database/connection.js';

export const findByClave = async (clave) => {
  const r = await query('SELECT valor FROM configuracion WHERE clave = $1', [clave]);
  return r.rows[0]?.valor ?? null;
};

export const upsert = async (clave, valor) => {
  const r = await query(
    `INSERT INTO configuracion (clave, valor, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (clave) DO UPDATE SET valor = EXCLUDED.valor, updated_at = NOW()
     RETURNING valor`,
    [clave, JSON.stringify(valor)]
  );
  return r.rows[0].valor;
};
