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
  const empresaResult = await query(
    'SELECT id FROM empresas WHERE activo = true ORDER BY id LIMIT 1'
  );
  const empresa = empresaResult.rows[0];
  if (!empresa) throw new Error('No hay una empresa activa para asociar al administrador');

  const passwordHash = await bcrypt.hash(password, 10);
  await query(
    `INSERT INTO empleados (empresa_id, nombre, apellido, email, password_hash, rol)
     VALUES ($1, 'Administrador', 'La Quinta', $2, $3, 'admin')
     ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash, rol = 'admin', activo = true`,
    [empresa.id, email, passwordHash]
  );

  console.log(`Administrador creado: ${email}`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
