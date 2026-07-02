/**
 * Seed de datos de prueba masivo.
 * Crea 3 empresas × 5 empleados + pedidos para esta semana y la próxima.
 * Uso: node scripts/seed-test-data.js
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { query, getClient } from '../src/database/connection.js';

if (process.env.NODE_ENV === 'production') {
  console.error('Este seed no se puede ejecutar en producción');
  process.exit(1);
}

// ── Configuración ─────────────────────────────────────────────────────────────

const PASSWORD = process.env.TEST_DATA_PASSWORD;
if (!PASSWORD || PASSWORD.length < 12) {
  console.error('TEST_DATA_PASSWORD es requerido y debe tener al menos 12 caracteres.');
  process.exit(1);
}

const EMPRESAS = [
  { nombre: 'Banco Hipotecario', slug: 'banco-hipotecario', plan: 'con_postre',  modo_pedido: 'semanal', abrev: 'bh' },
  { nombre: 'Clínica del Sol',   slug: 'clinica-del-sol',   plan: 'basico',      modo_pedido: 'semanal', abrev: 'sol' },
  { nombre: 'Estudio Ferreyra',  slug: 'estudio-ferreyra',  plan: 'con_postre',  modo_pedido: 'semanal', abrev: 'ef' },
];

const EMPLEADOS_POR_EMPRESA = [
  { nombre: 'Ana',       apellido: 'Pérez'     },
  { nombre: 'Carlos',    apellido: 'Rodríguez' },
  { nombre: 'Lucía',     apellido: 'Martínez'  },
  { nombre: 'Diego',     apellido: 'López'     },
  { nombre: 'Valentina', apellido: 'García'    },
];

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];

const NOTAS_OPCIONALES = [
  null, null, null, // mayoría sin notas
  'Sin cebolla',
  'Sin picante',
  'Poca sal por favor',
];

function telefonoDemo(empresaIndex, personaIndex) {
  return `+549261556${String(empresaIndex + 1).padStart(2, '0')}${String(personaIndex + 1).padStart(2, '0')}`;
}

function codigoEmpresaDemo(slug, empresaIndex) {
  const base = String(slug)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 4)
    .padEnd(4, 'X');
  return `${base}${String(empresaIndex + 1).padStart(2, '0')}`.slice(0, 6);
}

function fechaNacimientoDemo(empresaIndex, personaIndex) {
  const year = 1986 + ((empresaIndex * 5 + personaIndex) % 16);
  const month = String((personaIndex % 9) + 1).padStart(2, '0');
  const day = String(8 + ((empresaIndex + personaIndex) % 18)).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function preferenciasDemo(empresaIndex, personaIndex) {
  return {
    vegetariano: (empresaIndex + personaIndex) % 6 === 0,
    sin_gluten: personaIndex === 2,
    sin_lacteos: personaIndex === 3,
    sin_pescado: false,
    sin_frutos_secos: personaIndex === 4,
    recibir_recordatorios_whatsapp: true,
  };
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getLunes(offsetSemanas = 0) {
  const hoy = new Date();
  const diff = hoy.getDay() === 0 ? -6 : 1 - hoy.getDay();
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() + diff + offsetSemanas * 7);
  return lunes.toISOString().split('T')[0];
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  const hash = await bcrypt.hash(PASSWORD, 10);

  // Obtener platos y guarniciones disponibles
  const [platosRes, guarnRes] = await Promise.all([
    query(`SELECT id, nombre, tipo, tiene_guarnicion FROM platos WHERE activo = true ORDER BY tipo, nombre`),
    query(`SELECT id, nombre FROM guarniciones WHERE activo = true ORDER BY nombre`),
  ]);

  const platosEspeciales = platosRes.rows.filter(p => p.tipo === 'especial' || p.tipo === 'ambos');
  const platosFijos     = platosRes.rows.filter(p => p.tipo === 'fijo' || p.tipo === 'ambos');
  const guarniciones    = guarnRes.rows;

  if (platosEspeciales.length === 0 && platosFijos.length === 0) {
    throw new Error('No hay platos activos. Ejecutá seed-platos-fijos.js primero.');
  }

  // Obtener menús publicados para esta semana y la próxima
  const semanas = [getLunes(0), getLunes(1)];
  const menusRes = await query(
    `SELECT id, fecha_inicio::text AS fecha_inicio
     FROM menus_semanales
     WHERE estado = 'publicado' AND fecha_inicio = ANY($1)`,
    [semanas]
  );
  const menusPorSemana = Object.fromEntries(menusRes.rows.map(m => [m.fecha_inicio, m.id]));

  console.log(`\n📅 Semana actual:  ${semanas[0]} (menú: ${menusPorSemana[semanas[0]] ? 'encontrado' : 'NO encontrado'})`);
  console.log(`📅 Semana próxima: ${semanas[1]} (menú: ${menusPorSemana[semanas[1]] ? 'encontrado' : 'NO encontrado'})`);

  if (!menusPorSemana[semanas[0]] && !menusPorSemana[semanas[1]]) {
    console.warn('\n⚠ No hay menús publicados para las semanas objetivo. Los pedidos se crearán sin menu_semanal_id (platos fijos solamente).');
  }

  const client = await getClient();
  try {
    await client.query('BEGIN');

    for (const [empresaIndex, emp] of EMPRESAS.entries()) {
      // Empresa
      const empRes = await client.query(
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
          emp.nombre,
          emp.slug,
          emp.plan,
          emp.modo_pedido,
          `contacto@${emp.abrev}.test`,
          `+549261445${String(empresaIndex + 1).padStart(4, '0')}`,
          codigoEmpresaDemo(emp.slug, empresaIndex),
        ]
      );
      const empresa = empRes.rows[0];
      console.log(`\n🏢 ${empresa.nombre} (id=${empresa.id})`);

      // Empleados
      const empleadosCreados = [];
      for (const [personaIndex, persona] of EMPLEADOS_POR_EMPRESA.entries()) {
        // Para que el email sea único por persona usamos nombre
        const emailUnico = `${persona.nombre.toLowerCase()}@${emp.abrev}.com`;
        const emlRes = await client.query(
          `INSERT INTO empleados
             (empresa_id, nombre, apellido, email, password_hash, rol, telefono, fecha_nacimiento, preferencias_alimentarias)
           VALUES ($1, $2, $3, $4, $5, 'cliente', $6, $7, $8::jsonb)
           ON CONFLICT (email) DO UPDATE
              SET nombre = EXCLUDED.nombre, apellido = EXCLUDED.apellido,
                  password_hash = EXCLUDED.password_hash, empresa_id = EXCLUDED.empresa_id,
                  telefono = EXCLUDED.telefono,
                  fecha_nacimiento = EXCLUDED.fecha_nacimiento,
                  preferencias_alimentarias = EXCLUDED.preferencias_alimentarias
            RETURNING id, nombre, apellido, email`,
          [
            empresa.id,
            persona.nombre,
            persona.apellido,
            emailUnico,
            hash,
            telefonoDemo(empresaIndex, personaIndex),
            fechaNacimientoDemo(empresaIndex, personaIndex),
            JSON.stringify(preferenciasDemo(empresaIndex, personaIndex)),
          ]
        );
        empleadosCreados.push(emlRes.rows[0]);
        console.log(`  👤 ${persona.nombre} ${persona.apellido} — ${emailUnico}`);
      }

      // Pedidos para cada semana
      for (const semana of semanas) {
        const menuId = menusPorSemana[semana] || null;

        for (const empleado of empleadosCreados) {
          // ~80% de los empleados hacen pedido (simula ausencias)
          if (Math.random() > 0.8) continue;

          const pedidoRes = await client.query(
            `INSERT INTO pedidos (empleado_id, empresa_id, menu_semanal_id, semana_inicio, estado)
             VALUES ($1, $2, $3, $4, 'pendiente')
             ON CONFLICT (empleado_id, semana_inicio)
             DO UPDATE SET estado = 'pendiente', menu_semanal_id = EXCLUDED.menu_semanal_id
             RETURNING id`,
            [empleado.id, empresa.id, menuId, semana]
          );
          const pedidoId = pedidoRes.rows[0].id;

          // Items: elige 3-5 días al azar
          const diasElegidos = shuffle(DIAS).slice(0, 3 + Math.floor(Math.random() * 3));

          for (const dia of diasElegidos) {
            // Elige entre plato de rotación semanal (si hay menú) o fijo
            let plato, opcion = null;
            if (menuId && platosEspeciales.length > 0 && Math.random() > 0.4) {
              plato = pick(platosEspeciales);
              opcion = pick(['A', 'B']);
            } else if (platosFijos.length > 0) {
              plato = pick(platosFijos);
            } else {
              plato = pick(platosEspeciales);
              opcion = pick(['A', 'B']);
            }

            const guarnicionId = (plato.tiene_guarnicion && guarniciones.length > 0)
              ? pick(guarniciones).id
              : null;

            const notas = pick(NOTAS_OPCIONALES);

            await client.query(
              `INSERT INTO pedido_items (pedido_id, dia, plato_id, opcion, guarnicion_id, notas)
               VALUES ($1, $2, $3, $4, $5, $6)
               ON CONFLICT (pedido_id, dia)
               DO UPDATE SET plato_id = EXCLUDED.plato_id, opcion = EXCLUDED.opcion,
                 guarnicion_id = EXCLUDED.guarnicion_id, notas = EXCLUDED.notas`,
              [pedidoId, dia, plato.id, opcion, guarnicionId, notas]
            );
          }
        }
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  console.log('\n✅ Seed completado exitosamente');
  console.log('─────────────────────────────────');
  console.log('Password de todos los usuarios de prueba: configurada mediante TEST_DATA_PASSWORD');
  console.log('Emails: nombre@abrev.com  (ej: ana@bh.com, lucia@sol.com, carlos@ef.com)');
  console.log('Empresas creadas:');
  for (const e of EMPRESAS) {
    for (const p of EMPLEADOS_POR_EMPRESA) {
      console.log(`  ${p.nombre.toLowerCase()}@${e.abrev}.com`);
    }
  }
  process.exit(0);
}

main().catch(e => { console.error('\n❌ Error:', e.message); process.exit(1); });
