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

test('PATCH /auth/preferencias guarda preferencia de recordatorios por WhatsApp', async () => {
  await conFixture({}, async (fixture) => {
    const respuesta = await requestJson(servidor.baseUrl, 'PATCH', '/auth/preferencias', {
      token: fixture.token,
      payload: {
        vegetariano: true,
        recibir_recordatorios_whatsapp: true,
      },
    });

    assert.equal(respuesta.status, 200);
    assert.equal(respuesta.body.data.vegetariano, true);
    assert.equal(respuesta.body.data.recibir_recordatorios_whatsapp, true);

    const sesion = await requestJson(servidor.baseUrl, 'GET', '/auth/me', {
      token: fixture.token,
    });

    assert.equal(sesion.status, 200);
    assert.equal(sesion.body.data.preferencias_alimentarias.recibir_recordatorios_whatsapp, true);
  });
});

test('POST /auth/registro exige telefono y fecha de nacimiento', async () => {
  await conFixture({}, async (fixture) => {
    const incompleto = await requestJson(servidor.baseUrl, 'POST', '/auth/registro', {
      payload: {
        codigo: fixture.empresa.codigo_registro,
        nombre: 'Alta',
        apellido: 'Incompleta',
        email: `${fixture.prefijo}+registro-incompleto@test.local`,
        password: 'Password123',
      },
    });

    assert.equal(incompleto.status, 400);
    assert.match(incompleto.body.message, /Faltan campos/);

    const completo = await requestJson(servidor.baseUrl, 'POST', '/auth/registro', {
      payload: {
        codigo: fixture.empresa.codigo_registro,
        nombre: 'Alta',
        apellido: 'Completa',
        email: `${fixture.prefijo}+registro-completo@test.local`,
        telefono: '+54 261 555-0101',
        fecha_nacimiento: '1991-05-20',
        password: 'Password123',
      },
    });

    assert.equal(completo.status, 201);
    assert.equal(completo.body.data.empleado.telefono, '+54 261 555-0101');
    assert.equal(String(completo.body.data.empleado.fecha_nacimiento).split('T')[0], '1991-05-20');
  });
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

test('POST dia sin servicio rechaza modificaciones', async () => {
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

    assert.equal(respuesta.status, 422);
    assert.match(respuesta.body.message, /no tiene servicio/);
    assert.equal(await contarPedidosFixture(fixture), 0);
  });
});

test('GET /pedidos/semanas muestra sin servicio aunque el motivo sea null', async () => {
  await conFixture({}, async (fixture) => {
    await query(
      'UPDATE menu_semanal_sin_servicio SET motivo = NULL WHERE menu_semanal_id = $1 AND dia = $2',
      [fixture.menu.id, 'jueves'],
    );

    const respuesta = await requestJson(servidor.baseUrl, 'GET', '/pedidos/semanas', {
      token: fixture.token,
    });

    assert.equal(respuesta.status, 200);
    const semana = respuesta.body.data.semanas.find((item) => item.id === fixture.semanaInicio);
    const jueves = semana.dias.find((dia) => dia.id === 'jueves');
    assert.equal(jueves.estado, 'sin_pedido_por_defecto');
    assert.equal(jueves.plato, 'Sin pedido por defecto');
    assert.match(jueves.motivo, /No hay servicio este dia/);
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

test('GET /pedidos/semanas marca cerrada una semana diaria sin dias editables', async () => {
  await conFixture({
    semanaInicio: '2026-06-22',
    modoPedido: 'diario',
    limiteHora: '00:01',
    limiteAnticipacionDias: 0,
    incluirDiaSinServicio: false,
  }, async (fixture) => {
    const respuesta = await requestJson(servidor.baseUrl, 'GET', '/pedidos/semanas', {
      token: fixture.token,
    });

    assert.equal(respuesta.status, 200);
    const semana = respuesta.body.data.semanas.find((item) => item.id === fixture.semanaInicio);
    assert.equal(semana.estado, 'cerrado');
    assert.equal(semana.dias.every((dia) => dia.bloqueado), true);
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

test('DELETE /pedidos/mi-pedido cancela pedido pendiente desde historial', async () => {
  await conFixture({}, async (fixture) => {
    const pedido = await crearPedidoDirecto(fixture, {
      items: [{
        dia: 'lunes',
        plato_id: fixture.platoConGuarnicion.id,
        opcion: 'A',
        guarnicion_id: fixture.guarnicion.id,
      }],
    });

    const respuesta = await requestJson(
      servidor.baseUrl,
      'DELETE',
      `/pedidos/mi-pedido?semana_inicio=${fixture.semanaInicio}`,
      { token: fixture.token },
    );

    assert.equal(respuesta.status, 200);
    assert.equal(respuesta.body.data.estado, 'cancelado');

    const cancelado = await obtenerPedidoDb(pedido.id);
    assert.equal(cancelado.estado, 'cancelado');
    assert.equal(cancelado.items.length, 0);
    assert.ok(cancelado.eventos.some((evento) => evento.tipo === 'pedido_cancelado'));
  });
});

test('GET /pedidos/semanas no expone pedidoId activo despues de cancelar', async () => {
  await conFixture({}, async (fixture) => {
    await crearPedidoDirecto(fixture, {
      items: [{
        dia: 'lunes',
        plato_id: fixture.platoConGuarnicion.id,
        opcion: 'A',
        guarnicion_id: fixture.guarnicion.id,
      }],
    });

    const cancelacion = await requestJson(
      servidor.baseUrl,
      'DELETE',
      `/pedidos/mi-pedido?semana_inicio=${fixture.semanaInicio}`,
      { token: fixture.token },
    );
    assert.equal(cancelacion.status, 200);

    const respuesta = await requestJson(servidor.baseUrl, 'GET', '/pedidos/semanas', {
      token: fixture.token,
    });

    assert.equal(respuesta.status, 200);
    const semana = respuesta.body.data.semanas.find((item) => item.id === fixture.semanaInicio);
    assert.ok(semana);
    assert.equal(semana.estado, 'sin_pedido');
    assert.equal(semana.metadata.pedidoId, null);
    assert.equal(semana.metadata.pedido, null);
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

test('PATCH estado admin crea notificacion interna aunque WhatsApp este desactivado', async () => {
  await conFixture({}, async (fixture) => {
    await requestJson(servidor.baseUrl, 'PATCH', '/auth/preferencias', {
      token: fixture.token,
      payload: { recibir_recordatorios_whatsapp: false },
    });

    const pedido = await crearPedidoDirecto(fixture, {
      items: [{
        dia: 'lunes',
        plato_id: fixture.platoConGuarnicion.id,
        opcion: 'A',
        guarnicion_id: fixture.guarnicion.id,
      }],
    });

    const emailAdmin = `${fixture.prefijo}+admin@test.local`;
    const admin = (await query(
      `INSERT INTO usuarios_admin (nombre, apellido, email, password_hash, rol, activo)
       VALUES ('Admin', 'Notificaciones', $1, 'test', 'admin', true)
       RETURNING id`,
      [emailAdmin],
    )).rows[0];
    const tokenAdmin = jwt.sign({ sub: admin.id, tipo: 'admin' }, env.JWT_SECRET, { expiresIn: '1h' });

    try {
      const respuesta = await requestJson(servidor.baseUrl, 'PATCH', `/pedidos/${pedido.id}/estado`, {
        token: tokenAdmin,
        payload: { estado: 'listo' },
      });

      assert.equal(respuesta.status, 200);

      const total = Number((await query(
        'SELECT COUNT(*) AS total FROM notificaciones WHERE empleado_id = $1',
        [fixture.empleado.id],
      )).rows[0].total);
      assert.equal(total, 1);
    } finally {
      await query('DELETE FROM usuarios_admin WHERE id = $1', [admin.id]);
    }
  });
});
