import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { query } from '../src/database/connection.js';

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Este seed no se puede ejecutar en producción');
  }

  const email = process.env.DEMO_ADMIN_EMAIL || 'admin@laquinta.local';
  const password = process.env.DEMO_ADMIN_PASSWORD;
  if (!password || password.length < 12) {
    throw new Error('DEMO_ADMIN_PASSWORD es obligatoria y debe tener al menos 12 caracteres');
  }

  const emailNormalizado = email.trim().toLowerCase();
  const passwordHash = await bcrypt.hash(password, 10);
  const superadminResult = await query(
    "SELECT COUNT(*)::int AS total FROM usuarios_admin WHERE rol = 'superadmin' AND activo = true AND LOWER(email) <> LOWER($1)",
    [emailNormalizado]
  );
  const usuarioExistenteResult = await query(
    'SELECT rol FROM usuarios_admin WHERE LOWER(email) = LOWER($1)',
    [emailNormalizado]
  );
  const usuarioExistente = usuarioExistenteResult.rows[0];
  const rol = superadminResult.rows[0]?.total > 0 && usuarioExistente?.rol !== 'superadmin'
    ? 'admin'
    : 'superadmin';

  await query(
    `INSERT INTO usuarios_admin (nombre, apellido, email, password_hash, rol)
     VALUES ('Administrador', 'La Quinta', $1, $2, $3)
     ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash, rol = EXCLUDED.rol, activo = true`,
    [emailNormalizado, passwordHash, rol]
  );

  console.log(`Usuario admin creado: ${email} (${rol})`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
