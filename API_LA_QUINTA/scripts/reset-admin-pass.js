import bcrypt from 'bcryptjs';
import pg from 'pg';
const { Pool } = pg;

const pool = new Pool({
  host: 'localhost', port: 5433,
  database: 'menudb',
  user: 'la_quinta_pruebas',
  password: 'la_quinta_pruebass',
});

const NEW_PASS = 'Admin1234!';
const hash = await bcrypt.hash(NEW_PASS, 10);
const r = await pool.query(
  "UPDATE empleados SET password_hash=$1 WHERE rol='admin' RETURNING email, rol",
  [hash]
);
console.log('Actualizado:', r.rows);
console.log('Nueva contraseña:', NEW_PASS);
await pool.end();
