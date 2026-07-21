import { once } from 'node:events';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';
import pool, { query } from '../src/database/connection.js';
import { env } from '../src/config/env.js';

let contador = 0;

export async function iniciarServidorTest() {
  const server = app.listen(0);
  await once(server, 'listening');
  const { port } = server.address();

  return {
    baseUrl: `http://127.0.0.1:${port}/api/v1`,
    cerrar: () => new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    }),
  };
}

export async function cerrarPoolDb() {
  await pool.end();
}

export async function requestJson(baseUrl, metodo, recurso, { token, payload } = {}) {
  const respuesta = await fetch(`${baseUrl}${recurso}`, {
    method: metodo,
    headers: {
      ...(payload ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: payload ? JSON.stringify(payload) : undefined,
  });

  const texto = await respuesta.text();
  const body = texto ? JSON.parse(texto) : null;

  return { status: respuesta.status, body };
}

export function crearTokenEmpleado(empleadoId) {
  return jwt.sign({ sub: empleadoId, tipo: 'empleado' }, env.JWT_SECRET, { expiresIn: '1h' });
}

export function crearPrefijoTest() {
  contador += 1;
  return `itp${Date.now()}${contador}`;
}

export async function limpiarDatosTest(prefijo) {
  await query(
    `DELETE FROM pedido_sugerencias ps
     USING empresas e
     WHERE ps.empresa_id = e.id
       AND e.slug LIKE $1`,
    [`${prefijo}%`],
  );
  await query(
    `DELETE FROM pedido_eventos pe
     USING pedidos p, empresas e
     WHERE pe.pedido_id = p.id
       AND p.empresa_id = e.id
       AND e.slug LIKE $1`,
    [`${prefijo}%`],
  );
  await query(
    `DELETE FROM pedido_items pi
     USING pedidos p, empresas e
     WHERE pi.pedido_id = p.id
       AND p.empresa_id = e.id
       AND e.slug LIKE $1`,
    [`${prefijo}%`],
  );
  await query(
    `DELETE FROM pedidos p
     USING empresas e
     WHERE p.empresa_id = e.id
       AND e.slug LIKE $1`,
    [`${prefijo}%`],
  );
  await query(
    `DELETE FROM menu_semanal_sin_servicio ss
     USING menus_semanales ms
     WHERE ss.menu_semanal_id = ms.id
       AND ms.nombre LIKE $1`,
    [`${prefijo}%`],
  );
  await query(
    `DELETE FROM menu_semanal_dias md
     USING menus_semanales ms
     WHERE md.menu_semanal_id = ms.id
       AND ms.nombre LIKE $1`,
    [`${prefijo}%`],
  );
  await query('DELETE FROM menus_semanales WHERE nombre LIKE $1', [`${prefijo}%`]);
  await query(
    `DELETE FROM empleados em
     USING empresas e
     WHERE em.empresa_id = e.id
       AND e.slug LIKE $1`,
    [`${prefijo}%`],
  );
  await query('DELETE FROM empresas WHERE slug LIKE $1', [`${prefijo}%`]);
  await query(
    `DELETE FROM viandas v
     USING platos p
     WHERE v.plato_id = p.id
       AND p.nombre LIKE $1`,
    [`${prefijo}%`],
  );
  await query('DELETE FROM platos WHERE nombre LIKE $1', [`${prefijo}%`]);
  await query('DELETE FROM guarniciones WHERE nombre LIKE $1', [`${prefijo}%`]);
  await query('DELETE FROM salsas WHERE nombre LIKE $1', [`${prefijo}%`]);
}

// Libera la semana de `fechaInicio` borrando cualquier menú que la ocupe (seed
// histórico o leak cross-file de otro test), en cascada (todas las FK a
// menu_semanal_id son ON DELETE CASCADE; pedidos es SET NULL). Necesario desde S3:
// UNIQUE(menus_semanales.semana_id) hace fatal cualquier 2º menú/semana, así que
// un fixture que crea su menú para una semana ya ocupada choca. El test "posee" su
// semana: la libera antes de crear su propio menú. Idempotente (si no hay menú, no
// borra nada; si la semana ni existe en `semanas`, el subselect no matchea).
export async function liberarSemana(fechaInicio) {
  await query(
    `DELETE FROM menus_semanales ms
     USING semanas s
     WHERE ms.semana_id = s.id
       AND s.fecha_inicio = date_trunc('week', $1::date)::date`,
    [fechaInicio],
  );
}

function fechaISOHelper(fecha) {
  return [
    fecha.getFullYear(),
    String(fecha.getMonth() + 1).padStart(2, '0'),
    String(fecha.getDate()).padStart(2, '0'),
  ].join('-');
}

// Lunes de la semana que empieza despues de hoy -- su plazo semanal (que se
// calcula a partir de semanaInicio) todavia no vencio bajo ningun
// limite_dia_semana/limite_hora posible. Reemplaza al literal fijo
// '2026-07-06' que este fixture tenia antes: un lunes hardcodeado termina
// quedando en el pasado a medida que corre el tiempo real, y entonces
// CUALQUIER test que dependa del fixture default empieza a fallar con 409
// "plazo vencido" sin que el codigo de pedidos tenga ningun bug real
// (encontrado en vivo 2026-07-13, ver test/pedidos.http-db.test.js que ya
// usa este mismo patron via lunesSemanaProximaTest/lunesSemanaActualTest
// para los pocos casos que ya lo necesitaban).
function lunesSemanaProximaHelper() {
  const fecha = new Date();
  fecha.setHours(0, 0, 0, 0);
  const dia = fecha.getDay();
  const diasHastaLunes = dia === 0 ? 1 : (8 - dia) % 7 || 7;
  fecha.setDate(fecha.getDate() + diasHastaLunes);
  return fechaISOHelper(fecha);
}

export async function crearFixturePedido({
  prefijo = crearPrefijoTest(),
  semanaInicio = lunesSemanaProximaHelper(),
  fechaLimitePedidos = '2099-01-01T12:00:00-03:00',
  modoPedido = 'semanal',
  limiteHora = '23:59',
  limiteDiaSemana = 'domingo',
  limiteAnticipacionDias = 0,
  diasLaborales = 'lunes_viernes',
  incluirDiaSinServicio = true,
} = {}) {
  await limpiarDatosTest(prefijo);

  const empresa = (await query(
    `INSERT INTO empresas (
       nombre, slug, modo_pedido, activo, limite_hora,
       limite_dia_semana, limite_anticipacion_dias, dias_laborales, codigo_registro
     )
     VALUES ($1, $2, $3, true, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      `${prefijo} Empresa`,
      prefijo,
      modoPedido,
      limiteHora,
      limiteDiaSemana,
      limiteAnticipacionDias,
      diasLaborales,
      prefijo.slice(-10).toUpperCase(),
    ],
  )).rows[0];

  const otraEmpresa = (await query(
    `INSERT INTO empresas (
       nombre, slug, modo_pedido, activo, limite_hora,
       limite_dia_semana, limite_anticipacion_dias, dias_laborales, codigo_registro
     )
     VALUES ($1, $2, $3, true, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      `${prefijo} Otra Empresa`,
      `${prefijo}-otra`,
      modoPedido,
      limiteHora,
      limiteDiaSemana,
      limiteAnticipacionDias,
      diasLaborales,
      `${prefijo.slice(-8)}OE`.toUpperCase(),
    ],
  )).rows[0];

  const empleado = (await query(
    `INSERT INTO empleados (empresa_id, nombre, apellido, email, password_hash, activo)
     VALUES ($1, 'Empleado', 'Propio', $2, 'test', true)
     RETURNING *`,
    [empresa.id, `${prefijo}+propio@test.local`],
  )).rows[0];

  const empleadoAjeno = (await query(
    `INSERT INTO empleados (empresa_id, nombre, apellido, email, password_hash, activo)
     VALUES ($1, 'Empleado', 'Ajeno', $2, 'test', true)
     RETURNING *`,
    [empresa.id, `${prefijo}+ajeno@test.local`],
  )).rows[0];

  const empleadoOtraEmpresa = (await query(
    `INSERT INTO empleados (empresa_id, nombre, apellido, email, password_hash, activo)
     VALUES ($1, 'Empleado', 'OtraEmpresa', $2, 'test', true)
     RETURNING *`,
    [otraEmpresa.id, `${prefijo}+otra@test.local`],
  )).rows[0];

  const guarnicion = (await query(
    `INSERT INTO guarniciones (nombre, activo, tipo)
     VALUES ($1, true, 'caliente')
     RETURNING *`,
    [`${prefijo} Pure de papas`],
  )).rows[0];

  const platoConGuarnicion = (await query(
    `INSERT INTO platos (nombre, descripcion, activo, tipo, tiene_guarnicion)
     VALUES ($1, 'Plato test con guarnicion', true, 'especial', true)
     RETURNING *`,
    [`${prefijo} Milanesa con guarnicion`],
  )).rows[0];

  const platoSinGuarnicion = (await query(
    `INSERT INTO platos (nombre, descripcion, activo, tipo, tiene_guarnicion)
     VALUES ($1, 'Plato test sin guarnicion', true, 'especial', false)
     RETURNING *`,
    [`${prefijo} Ravioles completos`],
  )).rows[0];

  const platoFijo = (await query(
    `INSERT INTO platos (nombre, descripcion, activo, tipo, tiene_guarnicion)
     VALUES ($1, 'Plato fijo test', true, 'fijo', false)
     RETURNING *`,
    [`${prefijo} Plato fijo`],
  )).rows[0];

  const platoNoDisponibleVianda = (await query(
    `INSERT INTO platos (nombre, descripcion, activo, tipo, tiene_guarnicion, disponible_vianda)
     VALUES ($1, 'Plato solo local test', true, 'fijo', false, false)
     RETURNING *`,
    [`${prefijo} Plato solo local`],
  )).rows[0];

  const salsa = (await query(
    `INSERT INTO salsas (nombre, activo)
     VALUES ($1, true)
     RETURNING *`,
    [`${prefijo} Salsa fileto`],
  )).rows[0];

  const platoConGuarnicionYSalsa = (await query(
    `INSERT INTO platos (nombre, descripcion, activo, tipo, tiene_guarnicion, salsa_modo)
     VALUES ($1, 'Plato test con guarnicion y salsa a eleccion', true, 'fijo', true, 'libre')
     RETURNING *`,
    [`${prefijo} Fideos con salsa y guarnicion libres`],
  )).rows[0];

  const platoConSalsaFija = (await query(
    `INSERT INTO platos (nombre, descripcion, activo, tipo, tiene_guarnicion, salsa_modo, salsa_fija_id)
     VALUES ($1, 'Plato test con salsa fija', true, 'fijo', false, 'fija', $2)
     RETURNING *`,
    [`${prefijo} Ñoquis con salsa fija`, salsa.id],
  )).rows[0];

  // Viandas globales (empresa_id NULL) para cada plato "vianda-eligible" del fixture --
  // sin esta fila, platos.repository.js/validateItemForMenu los trata como sin vianda
  // activa (ver create-viandas-table). platoNoDisponibleVianda queda sin vianda a
  // proposito: es el caso de prueba de "no disponible".
  await query(
    `INSERT INTO viandas (plato_id, activo) VALUES ($1, true), ($2, true), ($3, true)`,
    [platoConGuarnicion.id, platoSinGuarnicion.id, platoFijo.id],
  );
  await query(
    `INSERT INTO viandas (plato_id, salsa_libre, activo) VALUES ($1, true, true)`,
    [platoConGuarnicionYSalsa.id],
  );
  await query(
    `INSERT INTO viandas (plato_id, salsa_id, activo) VALUES ($1, $2, true)`,
    [platoConSalsaFija.id, salsa.id],
  );

  // S3: garantizar que la semana esté libre antes de crear el menú del fixture
  // (el seed histórico ocupa varias semanas reales, y el UNIQUE(semana_id) lo prohíbe).
  await liberarSemana(semanaInicio);
  const menu = (await query(
    `INSERT INTO menus_semanales (
       nombre, fecha_inicio, fecha_fin, estado, fecha_limite_pedidos, publicado_at
     )
     VALUES ($1, $2, ($2::date + INTERVAL '4 days')::date, 'publicado', $3, NOW())
     RETURNING *`,
    [`${prefijo} Menu semanal`, semanaInicio, fechaLimitePedidos],
  )).rows[0];

  const catEspeciales = (await query(`SELECT id FROM categorias WHERE slug = 'especiales'`)).rows[0].id;
  await query(
    `INSERT INTO menu_semanal_dias (menu_semanal_id, dia, opcion, plato_id, categoria_id)
     VALUES
       ($1, 'lunes', 'A', $2, $4),
       ($1, 'martes', 'A', $3, $4),
       ($1, 'miercoles', 'A', $3, $4),
       ($1, 'jueves', 'A', $3, $4),
       ($1, 'viernes', 'A', $3, $4)`,
    [menu.id, platoConGuarnicion.id, platoSinGuarnicion.id, catEspeciales],
  );
  // Los fijos de este menu de fixture NO se materializan: cargarPlatosFijosDesdeMenu
  // cae al catalogo cuando un menu no tiene fijos materializados (ver su fallback).

  if (incluirDiaSinServicio) {
    await query(
      `INSERT INTO menu_semanal_sin_servicio (menu_semanal_id, dia, motivo)
       VALUES ($1, 'jueves', 'Feriado test')`,
      [menu.id],
    );
  }

  return {
    prefijo,
    semanaInicio,
    empresa,
    otraEmpresa,
    empleado,
    empleadoAjeno,
    empleadoOtraEmpresa,
    token: crearTokenEmpleado(empleado.id),
    tokenAjeno: crearTokenEmpleado(empleadoAjeno.id),
    tokenOtraEmpresa: crearTokenEmpleado(empleadoOtraEmpresa.id),
    guarnicion,
    salsa,
    platoConGuarnicion,
    platoSinGuarnicion,
    platoFijo,
    platoNoDisponibleVianda,
    platoConGuarnicionYSalsa,
    platoConSalsaFija,
    menu,
  };
}

export function payloadPedidoValido(fixture, overrides = {}) {
  return {
    semana_inicio: fixture.semanaInicio,
    menu_semanal_id: fixture.menu.id,
    items: [
      {
        dia: 'lunes',
        plato_id: fixture.platoConGuarnicion.id,
        opcion: 'A',
        guarnicion_id: fixture.guarnicion.id,
      },
      {
        dia: 'martes',
        plato_id: null,
        guarnicion_id: null,
        sin_pedido: true,
        origen: 'usuario',
      },
    ],
    ...overrides,
  };
}

export async function crearPedidoDirecto(fixture, { empleado = fixture.empleado, items = [] } = {}) {
  const pedido = (await query(
    `INSERT INTO pedidos (empleado_id, empresa_id, menu_semanal_id, semana_inicio, estado)
     VALUES ($1, $2, $3, $4, 'pendiente')
     RETURNING *`,
    [empleado.id, empleado.empresa_id, fixture.menu.id, fixture.semanaInicio],
  )).rows[0];

  for (const item of items) {
    await query(
      `INSERT INTO pedido_items (pedido_id, dia, plato_id, opcion, guarnicion_id, salsa_id, sin_pedido, origen)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        pedido.id,
        item.dia,
        item.plato_id || null,
        item.opcion || null,
        item.guarnicion_id || null,
        item.salsa_id || null,
        Boolean(item.sin_pedido),
        item.origen || null,
      ],
    );
  }

  return pedido;
}

export async function obtenerPedidoDb(pedidoId) {
  const pedido = (await query('SELECT * FROM pedidos WHERE id = $1', [pedidoId])).rows[0] || null;
  const items = (await query(
    'SELECT * FROM pedido_items WHERE pedido_id = $1 ORDER BY dia',
    [pedidoId],
  )).rows;
  const eventos = (await query(
    'SELECT * FROM pedido_eventos WHERE pedido_id = $1 ORDER BY id',
    [pedidoId],
  )).rows;

  return pedido ? { ...pedido, items, eventos } : null;
}

export async function contarPedidosFixture(fixture) {
  return Number((await query(
    `SELECT COUNT(*) AS total
     FROM pedidos
     WHERE empleado_id = $1 AND semana_inicio = $2`,
    [fixture.empleado.id, fixture.semanaInicio],
  )).rows[0].total);
}
