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
    `INSERT INTO empresas (nombre, slug, plan, modo_pedido, email, telefono, codigo_registro)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (slug) DO UPDATE SET
       nombre = EXCLUDED.nombre,
       plan = EXCLUDED.plan,
       modo_pedido = EXCLUDED.modo_pedido,
       email = EXCLUDED.email,
       telefono = EXCLUDED.telefono,
       codigo_registro = COALESCE(empresas.codigo_registro, EXCLUDED.codigo_registro)
     RETURNING id, nombre`,
    [
      'Universidad de Mendoza',
      'universidad-mendoza',
      'con_postre',
      'semanal',
      'comedor@um.edu.ar',
      '+5492615550100',
      'UMENDO',
    ]
  );
  const empresa = empRes.rows[0];
  console.log(`✓ Empresa: ${empresa.nombre} (id=${empresa.id})`);

  // Empleado
  const hash = await bcrypt.hash(clientPassword, 10);
  const emlRes = await query(
    `INSERT INTO empleados
       (empresa_id, nombre, apellido, email, password_hash, rol, telefono, fecha_nacimiento, preferencias_alimentarias)
     VALUES ($1, $2, $3, $4, $5, 'cliente', $6, $7, $8::jsonb)
     ON CONFLICT (email) DO UPDATE SET
       empresa_id = EXCLUDED.empresa_id,
       nombre = EXCLUDED.nombre,
       apellido = EXCLUDED.apellido,
       password_hash = EXCLUDED.password_hash,
       rol = 'cliente',
       telefono = EXCLUDED.telefono,
       fecha_nacimiento = EXCLUDED.fecha_nacimiento,
       preferencias_alimentarias = EXCLUDED.preferencias_alimentarias
     RETURNING id, nombre, apellido, email, rol`,
    [
      empresa.id,
      'Martín',
      'González',
      'martin@um.edu.ar',
      hash,
      '+5492615550101',
      '1990-04-12',
      JSON.stringify({
        vegetariano: false,
        sin_gluten: false,
        sin_lacteos: false,
        sin_pescado: false,
        sin_frutos_secos: false,
        recibir_recordatorios_whatsapp: true,
      }),
    ]
  );
  const emp = emlRes.rows[0];
  console.log(`✓ Empleado: ${emp.nombre} ${emp.apellido} <${emp.email}>`);
  console.log(`\nCredenciales de prueba:`);
  console.log(`  Email:    ${emp.email}`);
  console.log('  Password: configurada mediante DEMO_CLIENT_PASSWORD');

  const adminEmail = process.env.DEMO_ADMIN_EMAIL || 'admin@laquinta.local';
  const adminHash = await bcrypt.hash(adminPassword, 10);
  await query(
    `INSERT INTO usuarios_admin (nombre, apellido, email, password_hash, rol)
     VALUES ('Administrador', 'La Quinta', $1, $2, 'admin')
     ON CONFLICT (email) DO UPDATE
       SET password_hash = EXCLUDED.password_hash,
           rol = CASE
             WHEN usuarios_admin.rol = 'superadmin' THEN usuarios_admin.rol
             ELSE EXCLUDED.rol
           END,
           activo = true`,
    [adminEmail.trim().toLowerCase(), adminHash]
  );
  console.log(`\nAdministrador de desarrollo:`);
  console.log(`  Email:    ${adminEmail}`);
  console.log('  Password: configurada mediante DEMO_ADMIN_PASSWORD');

  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
