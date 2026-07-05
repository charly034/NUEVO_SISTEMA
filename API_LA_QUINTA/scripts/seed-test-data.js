/**
 * Seed de datos de prueba realistas.
 *
 * Crea/actualiza 4 empresas:
 *   - 3 empresas con 4 empleados cada una
 *   - 1 empresa con 13 empleados
 *
 * Luego genera pedidos de semanas anteriores, semana actual y semana próxima,
 * usando los menús existentes cuando están cargados y platos fijos como respaldo.
 *
 * Uso:
 *   TEST_DATA_PASSWORD=12345678 node scripts/seed-test-data.js
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { query, getClient } from '../src/database/connection.js';

if (process.env.NODE_ENV === 'production') {
  console.error('Este seed no se puede ejecutar en producción');
  process.exit(1);
}

const PASSWORD = process.env.TEST_DATA_PASSWORD;
if (!PASSWORD || PASSWORD.length < 8) {
  console.error('TEST_DATA_PASSWORD es requerido y debe tener al menos 8 caracteres.');
  process.exit(1);
}

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];
const ORIGEN_SEED = 'seed_test_data';
const OPCIONES_MENU_SEED = ['A', 'C'];
const PLAN_CODIGO_POR_LEGACY = {
  basico: 'clasico_450',
  con_postre: 'clasico_450_postre',
  con_postre_bebida: 'clasico_450_completo',
};

const EMPRESAS = [
  {
    nombre: 'Banco Hipotecario',
    slug: 'banco-hipotecario',
    plan: 'con_postre',
    modo_pedido: 'semanal',
    abrev: 'bh',
    empleados: [
      ['Ana', 'Pérez'],
      ['Carlos', 'Rodríguez'],
      ['Lucía', 'Martínez'],
      ['Diego', 'López'],
    ],
  },
  {
    nombre: 'Clínica del Sol',
    slug: 'clinica-del-sol',
    plan: 'basico',
    modo_pedido: 'semanal',
    abrev: 'sol',
    empleados: [
      ['Sofía', 'Torres'],
      ['Martín', 'Sánchez'],
      ['Florencia', 'Ruiz'],
      ['Ramiro', 'Gómez'],
    ],
  },
  {
    nombre: 'Estudio Ferreyra',
    slug: 'estudio-ferreyra',
    plan: 'con_postre_bebida',
    modo_pedido: 'semanal',
    abrev: 'ef',
    empleados: [
      ['Pablo', 'Morales'],
      ['Natalia', 'Romero'],
      ['Sebastián', 'Díaz'],
      ['Julia', 'Herrera'],
    ],
  },
  {
    nombre: 'Centro Operativo La Quinta',
    slug: 'centro-operativo-la-quinta',
    plan: 'con_postre',
    modo_pedido: 'semanal',
    abrev: 'co',
    empleados: [
      ['María', 'Prueba'],
      ['Roberto', 'Demo'],
      ['Laura', 'Ejemplo'],
      ['Jorge', 'Testing'],
      ['Valentina', 'García'],
      ['Agustín', 'Castro'],
      ['Camila', 'Fernández'],
      ['Federico', 'Suárez'],
      ['Micaela', 'Núñez'],
      ['Tomás', 'Vega'],
      ['Paula', 'Ríos'],
      ['Nicolás', 'Molina'],
      ['Carolina', 'Arias'],
    ],
  },
];

const SEMANAS_PEDIDOS = [
  { offset: -4, key: '-4', probabilidad: 0.78, estados: ['entregado'] },
  { offset: -3, key: '-3', probabilidad: 0.84, estados: ['entregado'] },
  { offset: -2, key: '-2', probabilidad: 0.88, estados: ['entregado', 'listo'] },
  { offset: -1, key: '-1', probabilidad: 0.82, estados: ['entregado', 'en_proceso'] },
  { offset: 0, key: '0', probabilidad: 0.76, estados: ['pendiente', 'en_proceso', 'listo'] },
  { offset: 1, key: '+1', probabilidad: 0.62, estados: ['pendiente'] },
];

const NOTAS = [
  null,
  null,
  null,
  null,
  'Sin cebolla',
  'Sin picante',
  'Poca sal',
  'Sin ajo',
  'Porción chica',
];

let randomState = 0x5eedda7a;
function random() {
  randomState = (randomState * 1664525 + 1013904223) >>> 0;
  return randomState / 0x100000000;
}

function pick(arr) {
  return arr[Math.floor(random() * arr.length)];
}

function shuffle(arr) {
  return [...arr].sort(() => random() - 0.5);
}

function getLunes(offsetSemanas = 0) {
  const hoy = new Date();
  const diff = hoy.getDay() === 0 ? -6 : 1 - hoy.getDay();
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() + diff + offsetSemanas * 7);
  lunes.setHours(0, 0, 0, 0);
  return lunes.toISOString().split('T')[0];
}

function sumarDias(fechaISO, dias) {
  const fecha = new Date(`${fechaISO}T00:00:00.000Z`);
  fecha.setUTCDate(fecha.getUTCDate() + dias);
  return fecha.toISOString().split('T')[0];
}

function normalizarEmailParte(texto) {
  return String(texto)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
}

function emailEmpleado(nombre, apellido, abrev) {
  return `${normalizarEmailParte(nombre)}.${normalizarEmailParte(apellido)}@${abrev}.test`;
}

function telefonoDemo(empresaIndex, personaIndex) {
  return `+549261558${String(empresaIndex + 1).padStart(2, '0')}${String(personaIndex + 1).padStart(2, '0')}`;
}

function telefonoEmpresa(empresaIndex) {
  return `+549261446${String(empresaIndex + 1).padStart(4, '0')}`;
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

function codigoPlanParaEmpresa(empresaSeed) {
  return PLAN_CODIGO_POR_LEGACY[empresaSeed.plan] || PLAN_CODIGO_POR_LEGACY.basico;
}

function snapshotPlan(plan) {
  return {
    plan_id: plan?.id || null,
    plan_codigo: plan?.codigo || null,
    plan_nombre: plan?.nombre || null,
    plan_gramaje_min: plan?.gramaje_min || null,
    plan_gramaje_max: plan?.gramaje_max || null,
    plan_incluye_postre: Boolean(plan?.incluye_postre),
    plan_incluye_bebida: Boolean(plan?.incluye_bebida),
  };
}

function estadoMenuParaSemana(config) {
  return config.offset < 0 ? 'cerrado' : 'publicado';
}

function nombreMenuParaSemana(semanaInicio, config) {
  if (config.offset === 0) return `Menu semana actual ${semanaInicio}`;
  if (config.offset === 1) return `Menu semana proxima ${semanaInicio}`;
  return `Menu historico test ${semanaInicio}`;
}

function fechaNacimientoDemo(empresaIndex, personaIndex) {
  const year = 1984 + ((empresaIndex * 9 + personaIndex) % 20);
  const month = String((personaIndex % 9) + 1).padStart(2, '0');
  const day = String(8 + ((empresaIndex + personaIndex) % 18)).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function preferenciasDemo(empresaIndex, personaIndex) {
  return {
    vegetariano: (empresaIndex + personaIndex) % 8 === 0,
    sin_gluten: personaIndex % 11 === 2,
    sin_lacteos: personaIndex % 13 === 3,
    sin_pescado: false,
    sin_frutos_secos: personaIndex % 10 === 4,
    recibir_recordatorios_whatsapp: personaIndex % 5 !== 0,
  };
}

function estadoPedido(config) {
  return pick(config.estados);
}

function createdAtParaSemana(semana, offset, empleadoIndex) {
  const diasAntes = offset < 0 ? 5 + (empleadoIndex % 3) : 1 + (empleadoIndex % 2);
  return `${sumarDias(semana, -diasAntes)}T${String(9 + (empleadoIndex % 8)).padStart(2, '0')}:15:00.000Z`;
}

function cantidadDiasPedido(config) {
  if (config.offset === 1) return 3 + Math.floor(random() * 2);
  if (config.offset === 0) return 3 + Math.floor(random() * 3);
  return 4 + Math.floor(random() * 2);
}

function debeMarcarSinPedido(config, empleadoIndex, diaIndex) {
  if (config.offset < -2) return false;
  return empleadoIndex % 9 === 0 && diaIndex === 0;
}

function elegirPlatosParaMenu(platosEspeciales, platosFijos, cantidad = OPCIONES_MENU_SEED.length) {
  const base = platosEspeciales.length > 0 ? platosEspeciales : platosFijos;
  if (base.length === 0) return [];
  return shuffle(base).slice(0, Math.min(cantidad, base.length));
}

async function cargarMenusPorSemanaConClient(client, semanas) {
  const menus = await client.query(
    `SELECT id, to_char(fecha_inicio, 'YYYY-MM-DD') AS fecha_inicio, estado
     FROM menus_semanales
     WHERE fecha_inicio = ANY($1::date[])
     ORDER BY fecha_inicio ASC, id ASC`,
    [semanas],
  );

  const menusPorSemana = new Map(menus.rows.map((menu) => [menu.fecha_inicio, menu]));
  if (menus.rows.length === 0) return { menusPorSemana, opcionesPorMenuDia: new Map() };

  const opciones = await client.query(
    `SELECT msd.menu_semanal_id, msd.dia, msd.opcion,
            p.id AS plato_id, p.nombre, p.tiene_guarnicion
     FROM menu_semanal_dias msd
     JOIN platos p ON p.id = msd.plato_id
     WHERE msd.menu_semanal_id = ANY($1::int[])
     ORDER BY msd.menu_semanal_id, msd.dia, msd.opcion`,
    [menus.rows.map((menu) => menu.id)],
  );

  const opcionesPorMenuDia = new Map();
  for (const row of opciones.rows) {
    const key = `${row.menu_semanal_id}:${row.dia}`;
    if (!opcionesPorMenuDia.has(key)) opcionesPorMenuDia.set(key, []);
    opcionesPorMenuDia.get(key).push({
      id: row.plato_id,
      nombre: row.nombre,
      tiene_guarnicion: row.tiene_guarnicion,
      opcion: row.opcion,
    });
  }

  return { menusPorSemana, opcionesPorMenuDia };
}

async function asegurarMenusDeTest(client, semanasConfig, platosEspeciales, platosFijos) {
  const resumen = { creados: 0, actualizados: 0, opciones: 0 };

  for (const config of semanasConfig) {
    const semanaInicio = getLunes(config.offset);
    const semanaFin = sumarDias(semanaInicio, 6);
    const estado = estadoMenuParaSemana(config);
    const publicadoAt = `${sumarDias(semanaInicio, -7)}T09:00:00.000Z`;
    const cerradoAt = estado === 'cerrado' ? `${sumarDias(semanaInicio, 6)}T18:00:00.000Z` : null;
    const nombre = nombreMenuParaSemana(semanaInicio, config);

    const existente = await client.query(
      `SELECT id
       FROM menus_semanales
       WHERE fecha_inicio = $1
       ORDER BY id ASC
       LIMIT 1`,
      [semanaInicio],
    );

    let menuId;
    if (existente.rows[0]) {
      menuId = existente.rows[0].id;
      await client.query(
        `UPDATE menus_semanales
         SET nombre = COALESCE(NULLIF(nombre, ''), $2),
             fecha_fin = $3,
             estado = $4,
             fecha_limite_pedidos = NULL,
             publicado_at = COALESCE(publicado_at, $5::timestamptz),
             cerrado_at = $6::timestamptz,
             updated_at = NOW()
         WHERE id = $1`,
        [menuId, nombre, semanaFin, estado, publicadoAt, cerradoAt],
      );
      resumen.actualizados++;
    } else {
      const creado = await client.query(
        `INSERT INTO menus_semanales
           (nombre, fecha_inicio, fecha_fin, estado, fecha_limite_pedidos, publicado_at, cerrado_at)
         VALUES ($1, $2, $3, $4, NULL, $5::timestamptz, $6::timestamptz)
         RETURNING id`,
        [nombre, semanaInicio, semanaFin, estado, publicadoAt, cerradoAt],
      );
      menuId = creado.rows[0].id;
      resumen.creados++;
    }

    for (const dia of DIAS) {
      const platosDia = elegirPlatosParaMenu(platosEspeciales, platosFijos);
      for (const [opcionIndex, plato] of platosDia.entries()) {
        const opcion = OPCIONES_MENU_SEED[opcionIndex] || String.fromCharCode(65 + opcionIndex);
        const insertado = await client.query(
          `INSERT INTO menu_semanal_dias (menu_semanal_id, dia, opcion, plato_id)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (menu_semanal_id, dia, opcion) DO NOTHING
           RETURNING id`,
          [menuId, dia, opcion, plato.id],
        );
        resumen.opciones += insertado.rowCount;
      }
    }
  }

  return resumen;
}

function elegirPlatoParaDia({ menuId, dia, opcionesPorMenuDia, platosFijos, platosEspeciales }) {
  const opcionesMenu = menuId ? opcionesPorMenuDia.get(`${menuId}:${dia}`) || [] : [];
  if (opcionesMenu.length > 0 && random() > 0.18) return pick(opcionesMenu);
  if (platosFijos.length > 0 && random() > 0.35) return { ...pick(platosFijos), opcion: null };
  const fallback = platosEspeciales.length > 0 ? platosEspeciales : platosFijos;
  return { ...pick(fallback), opcion: platosEspeciales.length > 0 ? pick(OPCIONES_MENU_SEED) : null };
}

async function main() {
  const hash = await bcrypt.hash(PASSWORD, 10);
  const semanas = SEMANAS_PEDIDOS.map((semana) => getLunes(semana.offset));

  const [platosRes, guarnRes, planesRes] = await Promise.all([
    query(`SELECT id, nombre, tipo, tiene_guarnicion FROM platos WHERE activo = true ORDER BY tipo, nombre`),
    query(`SELECT id, nombre FROM guarniciones WHERE activo = true ORDER BY nombre`),
    query(
      `SELECT id, codigo, nombre, gramaje_min, gramaje_max, incluye_postre, incluye_bebida
       FROM planes_vianda
       WHERE activo = true
       ORDER BY orden ASC, id ASC`,
    ),
  ]);

  const platosEspeciales = platosRes.rows.filter((p) => p.tipo === 'especial' || p.tipo === 'ambos');
  const platosFijos = platosRes.rows.filter((p) => p.tipo === 'fijo' || p.tipo === 'ambos');
  const guarniciones = guarnRes.rows;
  const planesPorCodigo = new Map(planesRes.rows.map((plan) => [plan.codigo, plan]));

  if (platosEspeciales.length === 0 && platosFijos.length === 0) {
    throw new Error('No hay platos activos. Ejecutá npm run seed:catalogo primero.');
  }

  if (planesRes.rows.length === 0) {
    throw new Error('No hay planes de vianda activos. Ejecuta npm run migrate para cargar planes_vianda.');
  }

  const client = await getClient();
  const resumen = {
    empresas: 0,
    empleados: 0,
    menusCreados: 0,
    menusActualizados: 0,
    opcionesMenu: 0,
    pedidos: 0,
    items: 0,
    sinPedido: 0,
    eventos: 0,
  };

  try {
    await client.query('BEGIN');

    const menusResumen = await asegurarMenusDeTest(client, SEMANAS_PEDIDOS, platosEspeciales, platosFijos);
    resumen.menusCreados += menusResumen.creados;
    resumen.menusActualizados += menusResumen.actualizados;
    resumen.opcionesMenu += menusResumen.opciones;
    const menusData = await cargarMenusPorSemanaConClient(client, semanas);

    console.log('Semanas objetivo:');
    for (const semana of SEMANAS_PEDIDOS) {
      const fecha = getLunes(semana.offset);
      const menu = menusData.menusPorSemana.get(fecha);
      console.log(`  ${fecha} (${semana.key}) - menu ${menu ? `${menu.id}/${menu.estado}` : 'no encontrado'}`);
    }

    for (const [empresaIndex, empresaSeed] of EMPRESAS.entries()) {
      const plan = planesPorCodigo.get(codigoPlanParaEmpresa(empresaSeed)) || planesRes.rows[0];
      const planPedido = snapshotPlan(plan);
      const empresaRes = await client.query(
        `INSERT INTO empresas (nombre, slug, plan, plan_id, modo_pedido, email, telefono, codigo_registro)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (slug) DO UPDATE SET
           nombre = EXCLUDED.nombre,
           plan = EXCLUDED.plan,
           plan_id = EXCLUDED.plan_id,
           modo_pedido = EXCLUDED.modo_pedido,
           email = EXCLUDED.email,
           telefono = EXCLUDED.telefono,
           codigo_registro = COALESCE(empresas.codigo_registro, EXCLUDED.codigo_registro)
         RETURNING id, nombre`,
        [
          empresaSeed.nombre,
          empresaSeed.slug,
          empresaSeed.plan,
          plan.id,
          empresaSeed.modo_pedido,
          `contacto@${empresaSeed.abrev}.test`,
          telefonoEmpresa(empresaIndex),
          codigoEmpresaDemo(empresaSeed.slug, empresaIndex),
        ],
      );
      const empresa = empresaRes.rows[0];
      resumen.empresas++;
      console.log(`\nEmpresa: ${empresa.nombre} (${empresaSeed.empleados.length} empleados)`);

      const empleados = [];
      for (const [personaIndex, [nombre, apellido]] of empresaSeed.empleados.entries()) {
        const email = emailEmpleado(nombre, apellido, empresaSeed.abrev);
        const empleadoRes = await client.query(
          `INSERT INTO empleados
             (empresa_id, nombre, apellido, email, password_hash, rol, telefono, fecha_nacimiento, preferencias_alimentarias, activo)
           VALUES ($1, $2, $3, $4, $5, 'cliente', $6, $7, $8::jsonb, true)
           ON CONFLICT (email) DO UPDATE SET
             empresa_id = EXCLUDED.empresa_id,
             nombre = EXCLUDED.nombre,
             apellido = EXCLUDED.apellido,
             password_hash = EXCLUDED.password_hash,
             rol = 'cliente',
             activo = true,
             telefono = EXCLUDED.telefono,
             fecha_nacimiento = EXCLUDED.fecha_nacimiento,
             preferencias_alimentarias = EXCLUDED.preferencias_alimentarias
           RETURNING id, nombre, apellido, email`,
          [
            empresa.id,
            nombre,
            apellido,
            email,
            hash,
            telefonoDemo(empresaIndex, personaIndex),
            fechaNacimientoDemo(empresaIndex, personaIndex),
            JSON.stringify(preferenciasDemo(empresaIndex, personaIndex)),
          ],
        );
        empleados.push({ ...empleadoRes.rows[0], index: personaIndex });
        resumen.empleados++;
      }
      await client.query(
        `UPDATE empleados
         SET activo = false
         WHERE empresa_id = $1
           AND email <> ALL($2::text[])`,
        [empresa.id, empleados.map((empleado) => empleado.email)],
      );

      for (const config of SEMANAS_PEDIDOS) {
        const semanaInicio = getLunes(config.offset);
        const menu = menusData.menusPorSemana.get(semanaInicio);
        const menuId = menu?.id || null;

        for (const empleado of empleados) {
          const siemprePide = empresaSeed.empleados.length >= 13 && empleado.index < 2;
          if (!siemprePide && random() > config.probabilidad) continue;

          const estado = estadoPedido(config);
          const createdAt = createdAtParaSemana(semanaInicio, config.offset, empleado.index);
          const pedidoRes = await client.query(
            `INSERT INTO pedidos
               (empleado_id, empresa_id, menu_semanal_id, semana_inicio, estado, observaciones, created_at, updated_at,
                plan_id, plan_codigo, plan_nombre, plan_gramaje_min, plan_gramaje_max,
                plan_incluye_postre, plan_incluye_bebida)
             VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, $9, $10, $11, $12, $13, $14)
             ON CONFLICT (empleado_id, semana_inicio) DO UPDATE SET
               empresa_id = EXCLUDED.empresa_id,
               menu_semanal_id = EXCLUDED.menu_semanal_id,
               estado = EXCLUDED.estado,
               observaciones = EXCLUDED.observaciones,
               created_at = EXCLUDED.created_at,
               plan_id = EXCLUDED.plan_id,
               plan_codigo = EXCLUDED.plan_codigo,
               plan_nombre = EXCLUDED.plan_nombre,
               plan_gramaje_min = EXCLUDED.plan_gramaje_min,
               plan_gramaje_max = EXCLUDED.plan_gramaje_max,
               plan_incluye_postre = EXCLUDED.plan_incluye_postre,
               plan_incluye_bebida = EXCLUDED.plan_incluye_bebida,
               updated_at = NOW()
             RETURNING id`,
            [
              empleado.id,
              empresa.id,
              menuId,
              semanaInicio,
              estado,
              `Pedido generado por ${ORIGEN_SEED}`,
              createdAt,
              planPedido.plan_id,
              planPedido.plan_codigo,
              planPedido.plan_nombre,
              planPedido.plan_gramaje_min,
              planPedido.plan_gramaje_max,
              planPedido.plan_incluye_postre,
              planPedido.plan_incluye_bebida,
            ],
          );
          const pedidoId = pedidoRes.rows[0].id;
          resumen.pedidos++;

          await client.query('DELETE FROM pedido_items WHERE pedido_id = $1', [pedidoId]);
          await client.query(
            `DELETE FROM pedido_eventos
             WHERE pedido_id = $1
               AND metadata->>'origen' = $2`,
            [pedidoId, ORIGEN_SEED],
          );

          const diasElegidos = shuffle(DIAS).slice(0, cantidadDiasPedido(config));
          for (const [diaIndex, dia] of diasElegidos.entries()) {
            if (debeMarcarSinPedido(config, empleado.index, diaIndex)) {
              await client.query(
                `INSERT INTO pedido_items (pedido_id, dia, sin_pedido, origen, notas)
                 VALUES ($1, $2, true, $3, $4)`,
                [pedidoId, dia, ORIGEN_SEED, 'Sin vianda: reunión externa / home office'],
              );
              resumen.items++;
              resumen.sinPedido++;
              continue;
            }

            const plato = elegirPlatoParaDia({
              menuId,
              dia,
              opcionesPorMenuDia: menusData.opcionesPorMenuDia,
              platosFijos,
              platosEspeciales,
            });
            const guarnicionId = plato.tiene_guarnicion && guarniciones.length > 0 ? pick(guarniciones).id : null;
            await client.query(
              `INSERT INTO pedido_items
                 (pedido_id, dia, plato_id, opcion, guarnicion_id, notas, sin_pedido, origen)
               VALUES ($1, $2, $3, $4, $5, $6, false, $7)`,
              [pedidoId, dia, plato.id, plato.opcion || null, guarnicionId, pick(NOTAS), ORIGEN_SEED],
            );
            resumen.items++;
          }

          await client.query(
            `INSERT INTO pedido_eventos
               (pedido_id, tipo, actor_tipo, actor_id, actor_nombre, estado_nuevo, resumen, metadata, created_at)
             VALUES ($1, 'pedido_creado', 'empleado', $2, $3, $4, $5, $6::jsonb, $7)`,
            [
              pedidoId,
              empleado.id,
              `${empleado.nombre} ${empleado.apellido}`,
              'pendiente',
              'Pedido creado por seed de test data realista',
              JSON.stringify({ origen: ORIGEN_SEED, semana_inicio: semanaInicio }),
              createdAt,
            ],
          );
          resumen.eventos++;

          if (estado !== 'pendiente') {
            await client.query(
              `INSERT INTO pedido_eventos
                 (pedido_id, tipo, actor_tipo, actor_nombre, estado_anterior, estado_nuevo, resumen, metadata, created_at)
               VALUES ($1, 'estado_cambiado', 'admin', 'Operaciones La Quinta', 'pendiente', $2, $3, $4::jsonb, NOW())`,
              [
                pedidoId,
                estado,
                `Estado simulado por seed: ${estado}`,
                JSON.stringify({ origen: ORIGEN_SEED, semana_inicio: semanaInicio }),
              ],
            );
            resumen.eventos++;
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

  console.log('\nSeed de test data completado');
  console.log('--------------------------------');
  console.log(`Empresas procesadas : ${resumen.empresas}`);
  console.log(`Empleados procesados: ${resumen.empleados}`);
  console.log(`Menus creados       : ${resumen.menusCreados}`);
  console.log(`Menus actualizados  : ${resumen.menusActualizados}`);
  console.log(`Opciones menu nuevas: ${resumen.opcionesMenu}`);
  console.log(`Pedidos generados   : ${resumen.pedidos}`);
  console.log(`Items generados     : ${resumen.items}`);
  console.log(`Días sin pedido     : ${resumen.sinPedido}`);
  console.log(`Eventos auditoría   : ${resumen.eventos}`);
  console.log('Password: configurada mediante TEST_DATA_PASSWORD');
  process.exit(0);
}

main().catch((e) => {
  console.error('\nError en seed-test-data:', e.message);
  if (process.env.DEBUG) console.error(e);
  process.exit(1);
});
