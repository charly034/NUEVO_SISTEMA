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
  await query('DELETE FROM platos WHERE nombre LIKE $1', [`${prefijo}%`]);
  await query('DELETE FROM guarniciones WHERE nombre LIKE $1', [`${prefijo}%`]);
}

export async function crearFixturePedido({
  prefijo = crearPrefijoTest(),
  semanaInicio = '2026-07-06',
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
       nombre, slug, plan, modo_pedido, activo, limite_hora,
       limite_dia_semana, limite_anticipacion_dias, dias_laborales, codigo_registro
     )
     VALUES ($1, $2, 'basico', $3, true, $4, $5, $6, $7, $8)
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
       nombre, slug, plan, modo_pedido, activo, limite_hora,
       limite_dia_semana, limite_anticipacion_dias, dias_laborales, codigo_registro
     )
     VALUES ($1, $2, 'basico', $3, true, $4, $5, $6, $7, $8)
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

  const menu = (await query(
    `INSERT INTO menus_semanales (
       nombre, fecha_inicio, fecha_fin, estado, fecha_limite_pedidos, publicado_at
     )
     VALUES ($1, $2, ($2::date + INTERVAL '4 days')::date, 'publicado', $3, NOW())
     RETURNING *`,
    [`${prefijo} Menu semanal`, semanaInicio, fechaLimitePedidos],
  )).rows[0];

  await query(
    `INSERT INTO menu_semanal_dias (menu_semanal_id, dia, opcion, plato_id)
     VALUES
       ($1, 'lunes', 'A', $2),
       ($1, 'martes', 'A', $3),
       ($1, 'miercoles', 'A', $3),
       ($1, 'jueves', 'A', $3),
       ($1, 'viernes', 'A', $3)`,
    [menu.id, platoConGuarnicion.id, platoSinGuarnicion.id],
  );

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
    platoConGuarnicion,
    platoSinGuarnicion,
    platoFijo,
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
      `INSERT INTO pedido_items (pedido_id, dia, plato_id, opcion, guarnicion_id, sin_pedido, origen)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        pedido.id,
        item.dia,
        item.plato_id || null,
        item.opcion || null,
        item.guarnicion_id || null,
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
