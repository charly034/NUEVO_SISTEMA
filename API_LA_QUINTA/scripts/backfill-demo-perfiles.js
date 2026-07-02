import 'dotenv/config';
import { query } from '../src/database/connection.js';

if (process.env.NODE_ENV === 'production') {
  console.error('Este backfill demo no se puede ejecutar en producción.');
  process.exit(1);
}

function codigoDemo(slug, id) {
  const base = String(slug || 'empresa')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4)
    .padEnd(4, 'X');
  return `${base}${String(id).padStart(2, '0')}`.slice(0, 6);
}

function telefonoEmpresa(id) {
  return `+549261444${String(id).padStart(4, '0')}`;
}

function telefonoEmpleado(empresaId, index) {
  return `+549261557${String(empresaId).padStart(2, '0')}${String(index).padStart(2, '0')}`;
}

function fechaNacimiento(empresaId, index) {
  const year = 1985 + ((empresaId * 5 + index) % 18);
  const month = String((index % 9) + 1).padStart(2, '0');
  const day = String(9 + ((empresaId + index) % 18)).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function preferencias(empresaId, index) {
  return {
    vegetariano: (empresaId + index) % 7 === 0,
    sin_gluten: index === 2,
    sin_lacteos: index === 3,
    sin_pescado: false,
    sin_frutos_secos: index === 4,
    recibir_recordatorios_whatsapp: true,
  };
}

async function main() {
  const empresas = await query(`
    SELECT id, slug
    FROM empresas
    WHERE email IS NULL
       OR email = ''
       OR telefono IS NULL
       OR telefono = ''
       OR codigo_registro IS NULL
       OR codigo_registro = ''
    ORDER BY id
  `);

  let empresasActualizadas = 0;
  for (const empresa of empresas.rows) {
    await query(
      `UPDATE empresas
       SET email = COALESCE(NULLIF(email, ''), $1),
           telefono = COALESCE(NULLIF(telefono, ''), $2),
           codigo_registro = COALESCE(NULLIF(codigo_registro, ''), $3)
       WHERE id = $4`,
      [
        `contacto@${empresa.slug}.test`,
        telefonoEmpresa(empresa.id),
        codigoDemo(empresa.slug, empresa.id),
        empresa.id,
      ],
    );
    empresasActualizadas++;
  }

  const empleados = await query(`
    SELECT id, empresa_id
    FROM empleados
    WHERE telefono IS NULL
       OR telefono = ''
       OR fecha_nacimiento IS NULL
       OR preferencias_alimentarias IS NULL
       OR preferencias_alimentarias = '{}'::jsonb
    ORDER BY empresa_id, id
  `);

  let empleadosActualizados = 0;
  const indicesPorEmpresa = new Map();
  for (const empleado of empleados.rows) {
    const index = (indicesPorEmpresa.get(empleado.empresa_id) || 0) + 1;
    indicesPorEmpresa.set(empleado.empresa_id, index);
    await query(
      `UPDATE empleados
       SET telefono = COALESCE(NULLIF(telefono, ''), $1),
           fecha_nacimiento = COALESCE(fecha_nacimiento, $2),
           preferencias_alimentarias = $3::jsonb || COALESCE(preferencias_alimentarias, '{}'::jsonb)
       WHERE id = $4`,
      [
        telefonoEmpleado(empleado.empresa_id, index),
        fechaNacimiento(empleado.empresa_id, index),
        JSON.stringify(preferencias(empleado.empresa_id, index)),
        empleado.id,
      ],
    );
    empleadosActualizados++;
  }

  console.log(`Empresas demo actualizadas: ${empresasActualizadas}`);
  console.log(`Empleados demo actualizados: ${empleadosActualizados}`);
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
