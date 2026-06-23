/**
 * Crea una empresa de demo y un empleado de prueba.
 * Uso: node scripts/seed-empresa-demo.js
 */
import bcrypt from 'bcryptjs';
import { query } from '../src/database/connection.js';

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Este seed no se puede ejecutar en producción');
  }
  const clientPassword = process.env.DEMO_CLIENT_PASSWORD;
  const adminPassword = process.env.DEMO_ADMIN_PASSWORD;
  if (!clientPassword || clientPassword.length < 12 || !adminPassword || adminPassword.length < 12) {
    throw new Error('DEMO_CLIENT_PASSWORD y DEMO_ADMIN_PASSWORD deben tener al menos 12 caracteres');
  }

  // Empresa
  const empRes = await query(
    `INSERT INTO empresas (nombre, slug, plan, modo_pedido)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (slug) DO UPDATE SET nombre = EXCLUDED.nombre
     RETURNING id, nombre`,
    ['Universidad de Mendoza', 'universidad-mendoza', 'con_postre', 'semanal']
  );
  const empresa = empRes.rows[0];
  console.log(`✓ Empresa: ${empresa.nombre} (id=${empresa.id})`);

  // Empleado
  const hash = await bcrypt.hash(clientPassword, 10);
  const emlRes = await query(
    `INSERT INTO empleados (empresa_id, nombre, apellido, email, password_hash, rol)
     VALUES ($1, $2, $3, $4, $5, 'cliente')
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, rol = 'cliente'
     RETURNING id, nombre, apellido, email, rol`,
    [empresa.id, 'Martín', 'González', 'martin@um.edu.ar', hash]
  );
  const emp = emlRes.rows[0];
  console.log(`✓ Empleado: ${emp.nombre} ${emp.apellido} <${emp.email}>`);
  console.log(`\nCredenciales de prueba:`);
  console.log(`  Email:    ${emp.email}`);
  console.log('  Password: configurada mediante DEMO_CLIENT_PASSWORD');

  const adminEmail = process.env.DEMO_ADMIN_EMAIL || 'admin@laquinta.local';
  const adminHash = await bcrypt.hash(adminPassword, 10);
  await query(
    `INSERT INTO empleados (empresa_id, nombre, apellido, email, password_hash, rol)
     VALUES ($1, 'Administrador', 'La Quinta', $2, $3, 'admin')
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, rol = 'admin', activo = true`,
    [empresa.id, adminEmail, adminHash]
  );
  console.log(`\nAdministrador de desarrollo:`);
  console.log(`  Email:    ${adminEmail}`);
  console.log('  Password: configurada mediante DEMO_ADMIN_PASSWORD');

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
