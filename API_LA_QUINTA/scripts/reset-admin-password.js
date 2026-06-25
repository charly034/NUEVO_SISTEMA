import 'dotenv/config';
import bcrypt from 'bcryptjs';
import pool, { query } from '../src/database/connection.js';

const email = process.env.ADMIN_EMAIL || process.env.DEMO_ADMIN_EMAIL;
const newPassword = process.env.ADMIN_NEW_PASSWORD || process.env.DEMO_ADMIN_PASSWORD;

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Este script es solo para desarrollo. No se puede ejecutar en producción.');
  }

  if (!email) {
    throw new Error('ADMIN_EMAIL es requerido. Ejemplo: ADMIN_EMAIL=admin@laquinta.local');
  }

  if (!newPassword || newPassword.length < 12) {
    throw new Error('ADMIN_NEW_PASSWORD es requerido y debe tener al menos 12 caracteres.');
  }

  const admin = await query(
    `SELECT id, email, rol, activo
     FROM usuarios_admin
     WHERE LOWER(email) = LOWER($1)`,
    [email.trim()]
  );

  const usuario = admin.rows[0];
  if (!usuario) {
    throw new Error(`No existe un administrador con email ${email}`);
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  const result = await query(
    `UPDATE usuarios_admin
     SET password_hash = $1, activo = true
     WHERE id = $2
     RETURNING id, email, rol, activo`,
    [passwordHash, usuario.id]
  );

  const updated = result.rows[0];
  console.log('Contraseña de administrador actualizada.');
  console.log(`Email: ${updated.email}`);
  console.log(`Rol: ${updated.rol}`);
  console.log('Activo: sí');
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
