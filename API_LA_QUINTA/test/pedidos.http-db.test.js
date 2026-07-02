import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env.js';
import { query } from '../src/database/connection.js';
import {
  cerrarPoolDb,
  contarPedidosFixture,
  crearFixturePedido,
  crearPedidoDirecto,
  iniciarServidorTest,
  limpiarDatosTest,
  obtenerPedidoDb,
  payloadPedidoValido,
  requestJson,
} from '../test_helpers/pedidos-http.helper.js';

let servidor;

before(async () => {
  servidor = await iniciarServidorTest();
});

after(async () => {
  await servidor?.cerrar();
  await cerrarPoolDb();
});

async function conFixture(opciones, prueba) {
  const fixture = await crearFixturePedido(opciones);
  try {
    return await prueba(fixture);
  } finally {
    await limpiarDatosTest(fixture.prefijo);
  }
}

test('POST /api/v1/pedidos sin token devuelve 401', async () => {
  const respuesta = await requestJson(servidor.baseUrl, 'POST', '/pedidos', {
    payload: { semana_inicio: '2026-07-06', items: [] },
  });

  assert.equal(respuesta.status, 401);
  assert.equal(respuesta.body.success, false);
});

test('GET /api/v1/users responde 410 para modulo legacy retirado', async () => {
  const email = `users-legacy-${Date.now()}@test.local`;
  const admin = (await query(
    `INSERT INTO usuarios_admin (nombre, apellido, email, password_hash, rol, activo)
     VALUES ('Admin', 'Legacy', $1, 'test', 'superadmin', true)
     RETURNING id`,
    [email],
  )).rows[0];
  const token = jwt.sign({ sub: admin.id, tipo: 'admin' }, env.JWT_SECRET, { expiresIn: '1h' });

  try {
    const respuesta = await requestJson(servidor.baseUrl, 'GET', '/users', { token });

    assert.equal(respuesta.status, 410);
    assert.equal(respuesta.body.success, false);
    assert.match(respuesta.body.message, /legacy/i);
  } finally {
    await query('DELETE FROM usuarios_admin WHERE id = $1', [admin.id]);
  }
});

test('POST /api/v1/pedidos crea pedido valido y persiste items', async () => {
  await conFixture({}, async (fixture) => {
    const respuesta = await requestJson(servidor.baseUrl, 'POST', '/pedidos', {
      token: fixture.token,
      payload: payloadPedidoValido(fixture),
    });

    assert.equal(respuesta.status, 201);
    assert.equal(respuesta.body.success, true);

    const pedidoId = respuesta.body.data.pedido.id;
    const pedido = await obtenerPedidoDb(pedidoId);

    assert.equal(pedido.empleado_id, fixture.empleado.id);
    assert.equal(pedido.empresa_id, fixture.empresa.id);
    assert.equal(pedido.menu_semanal_id, fixture.menu.id);
    assert.equal(pedido.items.length, 2);

    const lunes = pedido.items.find((item) => item.dia === 'lunes');
    const martes = pedido.items.find((item) => item.dia === 'martes');
    assert.equal(lunes.plato_id, fixture.platoConGuarnicion.id);
    assert.equal(lunes.guarnicion_id, fixture.guarnicion.id);
    assert.equal(Boolean(martes.sin_pedido), true);
    assert.equal(martes.origen, 'usuario');
  });
});

test('POST permite guardar si la empresa esta en plazo aunque el menu tenga limite vencido', async () => {
  await conFixture({
    fechaLimitePedidos: '2026-01-01T12:00:00-03:00',
  }, async (fixture) => {
    const respuesta = await requestJson(servidor.baseUrl, 'POST', '/pedidos', {
      token: fixture.token,
      payload: payloadPedidoValido(fixture),
    });

    assert.equal(respuesta.status, 201);
    assert.equal(respuesta.body.success, true);
    assert.equal(await contarPedidosFixture(fixture), 1);
  });
});

test('POST plato con guarnicion obligatoria faltante devuelve 422 y no guarda parcial', async () => {
  await conFixture({}, async (fixture) => {
    const respuesta = await requestJson(servidor.baseUrl, 'POST', '/pedidos', {
      token: fixture.token,
      payload: payloadPedidoValido(fixture, {
        items: [{
          dia: 'lunes',
          plato_id: fixture.platoConGuarnicion.id,
          opcion: 'A',
          guarnicion_id: null,
        }],
      }),
    });

    assert.equal(respuesta.status, 422);
    assert.equal(await contarPedidosFixture(fixture), 0);
  });
});

test('POST con guarnicion indebida devuelve 422 y no guarda parcial', async () => {
  await conFixture({}, async (fixture) => {
    const respuesta = await requestJson(servidor.baseUrl, 'POST', '/pedidos', {
      token: fixture.token,
      payload: payloadPedidoValido(fixture, {
        items: [{
          dia: 'martes',
          plato_id: fixture.platoSinGuarnicion.id,
          opcion: 'A',
          guarnicion_id: fixture.guarnicion.id,
        }],
      }),
    });

    assert.equal(respuesta.status, 422);
    assert.match(respuesta.body.message, /no admite guarnicion/);
    assert.equal(await contarPedidosFixture(fixture), 0);
  });
});

test('POST sinPedido true con plato cargado devuelve 422 y no guarda parcial', async () => {
  await conFixture({}, async (fixture) => {
    const respuesta = await requestJson(servidor.baseUrl, 'POST', '/pedidos', {
      token: fixture.token,
      payload: payloadPedidoValido(fixture, {
        items: [{
          dia: 'martes',
          plato_id: fixture.platoSinGuarnicion.id,
          guarnicion_id: null,
          sin_pedido: true,
        }],
      }),
    });

    assert.equal(respuesta.status, 422);
    assert.equal(await contarPedidosFixture(fixture), 0);
  });
});

test('POST dia sin servicio permite pedido si la empresa entrega anticipado', async () => {
  await conFixture({}, async (fixture) => {
    const respuesta = await requestJson(servidor.baseUrl, 'POST', '/pedidos', {
      token: fixture.token,
      payload: payloadPedidoValido(fixture, {
        items: [{
          dia: 'jueves',
          plato_id: fixture.platoSinGuarnicion.id,
          opcion: 'A',
          guarnicion_id: null,
        }],
      }),
    });

    assert.equal(respuesta.status, 201);
    assert.equal(await contarPedidosFixture(fixture), 1);
    assert.equal(respuesta.body.data.pedido.dias[0].diaId, 'jueves');
  });
});

test('POST duplicado actualiza el mismo pedido de la semana', async () => {
  await conFixture({}, async (fixture) => {
    const primera = await requestJson(servidor.baseUrl, 'POST', '/pedidos', {
      token: fixture.token,
      payload: payloadPedidoValido(fixture),
    });
    const pedidoId = primera.body.data.pedido.id;

    const segunda = await requestJson(servidor.baseUrl, 'POST', '/pedidos', {
      token: fixture.token,
      payload: payloadPedidoValido(fixture, {
        items: [{
          dia: 'miercoles',
          plato_id: fixture.platoSinGuarnicion.id,
          opcion: 'A',
          guarnicion_id: null,
        }],
      }),
    });

    assert.equal(segunda.status, 201);
    assert.equal(segunda.body.data.pedido.id, pedidoId);
    assert.equal(await contarPedidosFixture(fixture), 1);

    const pedido = await obtenerPedidoDb(pedidoId);
    assert.equal(pedido.items.length, 1);
    assert.equal(pedido.items[0].dia, 'miercoles');
  });
});

test('POST /api/v1/pedidos/sugerencias guarda sugerencias sin exigir dias de pedido', async () => {
  await conFixture({ semanaInicio: '2026-07-13' }, async (fixture) => {
    const respuesta = await requestJson(servidor.baseUrl, 'POST', '/pedidos/sugerencias', {
      token: fixture.token,
      payload: {
        semana_inicio: fixture.semanaInicio,
        ideas: ['Milanesa con pure', 'Pollo al horno'],
        comentario: 'Opciones livianas para esa semana',
      },
    });

    assert.equal(respuesta.status, 201);
    assert.equal(respuesta.body.success, true);
    assert.deepEqual(respuesta.body.data.sugerencia.recomendacionesUsuario, [
      'Milanesa con pure',
      'Pollo al horno',
    ]);

    const semanas = await requestJson(servidor.baseUrl, 'GET', '/pedidos/semanas', {
      token: fixture.token,
    });
    const semana = semanas.body.data.semanas.find((item) => item.id === fixture.semanaInicio);

    assert.ok(semana);
    assert.deepEqual(semana.recomendacionesUsuario, ['Milanesa con pure', 'Pollo al horno']);
    assert.equal(semana.comentarioRecomendacion, 'Opciones livianas para esa semana');
  });
});

test('PUT /api/v1/pedidos/:pedidoId sin token devuelve 401', async () => {
  await conFixture({}, async (fixture) => {
    const pedido = await crearPedidoDirecto(fixture);
    const respuesta = await requestJson(servidor.baseUrl, 'PUT', `/pedidos/${pedido.id}`, {
      payload: payloadPedidoValido(fixture),
    });

    assert.equal(respuesta.status, 401);
  });
});

test('PUT pedido propio valido actualiza items', async () => {
  await conFixture({}, async (fixture) => {
    const pedido = await crearPedidoDirecto(fixture, {
      items: [{
        dia: 'lunes',
        plato_id: fixture.platoConGuarnicion.id,
        opcion: 'A',
        guarnicion_id: fixture.guarnicion.id,
      }],
    });

    const respuesta = await requestJson(servidor.baseUrl, 'PUT', `/pedidos/${pedido.id}`, {
      token: fixture.token,
      payload: payloadPedidoValido(fixture, {
        items: [{
          dia: 'martes',
          plato_id: fixture.platoSinGuarnicion.id,
          opcion: 'A',
          guarnicion_id: null,
        }],
      }),
    });

    assert.equal(respuesta.status, 200);
    assert.equal(respuesta.body.data.pedido.id, pedido.id);
    assert.equal(respuesta.body.data.pedido.estado, 'confirmado');

    const actualizado = await obtenerPedidoDb(pedido.id);
    assert.equal(actualizado.items.length, 1);
    assert.equal(actualizado.items[0].dia, 'martes');
    assert.equal(actualizado.items[0].plato_id, fixture.platoSinGuarnicion.id);
  });
});

test('PUT pedido ajeno devuelve 403', async () => {
  await conFixture({}, async (fixture) => {
    const pedido = await crearPedidoDirecto(fixture, {
      items: [{
        dia: 'lunes',
        plato_id: fixture.platoConGuarnicion.id,
        opcion: 'A',
        guarnicion_id: fixture.guarnicion.id,
      }],
    });
    const respuesta = await requestJson(servidor.baseUrl, 'PUT', `/pedidos/${pedido.id}`, {
      token: fixture.tokenAjeno,
      payload: payloadPedidoValido(fixture),
    });

    assert.equal(respuesta.status, 403);

    const sinCambios = await obtenerPedidoDb(pedido.id);
    assert.equal(sinCambios.items.length, 1);
    assert.equal(sinCambios.items[0].dia, 'lunes');
  });
});

test('PUT pedido de otra empresa devuelve 403', async () => {
  await conFixture({}, async (fixture) => {
    const pedido = await crearPedidoDirecto(fixture);
    const respuesta = await requestJson(servidor.baseUrl, 'PUT', `/pedidos/${pedido.id}`, {
      token: fixture.tokenOtraEmpresa,
      payload: payloadPedidoValido(fixture),
    });

    assert.equal(respuesta.status, 403);
  });
});

test('PUT fuera de plazo semanal por regla de empresa devuelve 409 y conserva el pedido anterior', async () => {
  await conFixture({
    semanaInicio: '2026-06-22',
    fechaLimitePedidos: '2099-01-01T12:00:00-03:00',
    limiteDiaSemana: 'lunes',
    limiteHora: '00:01',
  }, async (fixture) => {
    const pedido = await crearPedidoDirecto(fixture, {
      items: [{
        dia: 'lunes',
        plato_id: fixture.platoConGuarnicion.id,
        opcion: 'A',
        guarnicion_id: fixture.guarnicion.id,
      }],
    });

    const respuesta = await requestJson(servidor.baseUrl, 'PUT', `/pedidos/${pedido.id}`, {
      token: fixture.token,
      payload: payloadPedidoValido(fixture, {
        items: [{
          dia: 'martes',
          plato_id: fixture.platoSinGuarnicion.id,
          opcion: 'A',
          guarnicion_id: null,
        }],
      }),
    });

    assert.equal(respuesta.status, 409);

    const sinCambios = await obtenerPedidoDb(pedido.id);
    assert.equal(sinCambios.items.length, 1);
    assert.equal(sinCambios.items[0].dia, 'lunes');
  });
});

test('PUT con dia vencido por regla diaria devuelve 409', async () => {
  await conFixture({
    semanaInicio: '2026-06-22',
    fechaLimitePedidos: '2099-01-01T12:00:00-03:00',
    modoPedido: 'diario',
    limiteHora: '00:01',
    limiteAnticipacionDias: 0,
    incluirDiaSinServicio: false,
  }, async (fixture) => {
    const pedido = await crearPedidoDirecto(fixture, {
      items: [{
        dia: 'lunes',
        plato_id: fixture.platoFijo.id,
        opcion: null,
        guarnicion_id: null,
      }],
    });

    const respuesta = await requestJson(servidor.baseUrl, 'PUT', `/pedidos/${pedido.id}`, {
      token: fixture.token,
      payload: payloadPedidoValido(fixture, {
        menu_semanal_id: null,
        items: [{
          dia: 'lunes',
          plato_id: fixture.platoFijo.id,
          opcion: null,
          guarnicion_id: null,
        }],
      }),
    });

    assert.equal(respuesta.status, 409);
  });
});

test('PUT con guarnicion indebida devuelve 422', async () => {
  await conFixture({}, async (fixture) => {
    const pedido = await crearPedidoDirecto(fixture);
    const respuesta = await requestJson(servidor.baseUrl, 'PUT', `/pedidos/${pedido.id}`, {
      token: fixture.token,
      payload: payloadPedidoValido(fixture, {
        items: [{
          dia: 'martes',
          plato_id: fixture.platoSinGuarnicion.id,
          opcion: 'A',
          guarnicion_id: fixture.guarnicion.id,
        }],
      }),
    });

    assert.equal(respuesta.status, 422);
    assert.match(respuesta.body.message, /no admite guarnicion/);
  });
});

test('PUT con guarnicion faltante cuando corresponde devuelve 422', async () => {
  await conFixture({}, async (fixture) => {
    const pedido = await crearPedidoDirecto(fixture);
    const respuesta = await requestJson(servidor.baseUrl, 'PUT', `/pedidos/${pedido.id}`, {
      token: fixture.token,
      payload: payloadPedidoValido(fixture, {
        items: [{
          dia: 'lunes',
          plato_id: fixture.platoConGuarnicion.id,
          opcion: 'A',
          guarnicion_id: null,
        }],
      }),
    });

    assert.equal(respuesta.status, 422);
    assert.match(respuesta.body.message, /guarnicion/);
  });
});

test('PUT pedido inexistente devuelve 404', async () => {
  await conFixture({}, async (fixture) => {
    const respuesta = await requestJson(servidor.baseUrl, 'PUT', '/pedidos/2147483000', {
      token: fixture.token,
      payload: payloadPedidoValido(fixture),
    });

    assert.equal(respuesta.status, 404);
  });
});

test('PATCH /api/v1/pedidos/:pedidoId/confirmar sin token devuelve 401', async () => {
  await conFixture({}, async (fixture) => {
    const pedido = await crearPedidoDirecto(fixture);
    const respuesta = await requestJson(servidor.baseUrl, 'PATCH', `/pedidos/${pedido.id}/confirmar`);

    assert.equal(respuesta.status, 401);
  });
});

test('PATCH pedido propio confirma y registra evento', async () => {
  await conFixture({}, async (fixture) => {
    const pedido = await crearPedidoDirecto(fixture);
    const respuesta = await requestJson(servidor.baseUrl, 'PATCH', `/pedidos/${pedido.id}/confirmar`, {
      token: fixture.token,
    });

    assert.equal(respuesta.status, 200);
    assert.equal(respuesta.body.data.pedido.id, pedido.id);

    const confirmado = await obtenerPedidoDb(pedido.id);
    assert.equal(confirmado.empleado_id, fixture.empleado.id);
    assert.equal(confirmado.empresa_id, fixture.empresa.id);
    assert.ok(confirmado.updated_at);
    assert.ok(confirmado.eventos.some((evento) => evento.tipo === 'pedido_confirmado'));
  });
});

test('PATCH pedido ajeno devuelve 403', async () => {
  await conFixture({}, async (fixture) => {
    const pedido = await crearPedidoDirecto(fixture);
    const respuesta = await requestJson(servidor.baseUrl, 'PATCH', `/pedidos/${pedido.id}/confirmar`, {
      token: fixture.tokenAjeno,
    });

    assert.equal(respuesta.status, 403);
  });
});

test('PATCH pedido inexistente devuelve 404', async () => {
  await conFixture({}, async (fixture) => {
    const respuesta = await requestJson(servidor.baseUrl, 'PATCH', '/pedidos/2147483000/confirmar', {
      token: fixture.token,
    });

    assert.equal(respuesta.status, 404);
  });
});

test('GET /pedidos/semanas refleja pedido confirmado luego de PATCH', async () => {
  await conFixture({}, async (fixture) => {
    const pedido = await crearPedidoDirecto(fixture, {
      items: [{
        dia: 'lunes',
        plato_id: fixture.platoConGuarnicion.id,
        opcion: 'A',
        guarnicion_id: fixture.guarnicion.id,
      }],
    });

    await requestJson(servidor.baseUrl, 'PATCH', `/pedidos/${pedido.id}/confirmar`, {
      token: fixture.token,
    });

    const respuesta = await requestJson(servidor.baseUrl, 'GET', '/pedidos/semanas', {
      token: fixture.token,
    });

    assert.equal(respuesta.status, 200);
    const semana = respuesta.body.data.semanas.find((item) => item.id === fixture.semanaInicio);
    assert.ok(semana);
    assert.equal(semana.estado, 'confirmado');
    assert.equal(semana.metadata.pedidoId, pedido.id);
  });
});
