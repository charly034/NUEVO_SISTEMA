import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env.js';
import { query } from '../src/database/connection.js';
import {
  cerrarPoolDb,
  iniciarServidorTest,
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

async function conAdminTest(prefijo, prueba, rol = 'superadmin') {
  const email = `${prefijo}+admin-${Date.now()}@test.local`;
  const admin = (await query(
    `INSERT INTO usuarios_admin (nombre, apellido, email, password_hash, rol, activo)
     VALUES ('Admin', 'Planes', $1, 'test', $2, true)
     RETURNING id`,
    [email, rol],
  )).rows[0];
  const token = jwt.sign({ sub: admin.id, tipo: 'admin' }, env.JWT_SECRET, { expiresIn: '1h' });

  try {
    return await prueba({ admin, token });
  } finally {
    await query('DELETE FROM usuarios_admin WHERE id = $1', [admin.id]);
  }
}

async function limpiarPlanesTest(prefijo) {
  await query('DELETE FROM planes_comerciales WHERE codigo LIKE $1', [`${prefijo}%`]);
}

test('GET /api/v1/planes sin token devuelve 401', async () => {
  const respuesta = await requestJson(servidor.baseUrl, 'GET', '/planes', {});
  assert.equal(respuesta.status, 401);
  assert.equal(respuesta.body.success, false);
});

test('POST /api/v1/planes crea un plan comercial y persiste en planes_comerciales', async () => {
  const prefijo = `itp${Date.now()}planes`;
  await conAdminTest(prefijo, async ({ token }) => {
    try {
      const respuesta = await requestJson(servidor.baseUrl, 'POST', '/planes', {
        token,
        payload: {
          nombre: `${prefijo} Plan chico`,
          codigo: `${prefijo}_chico`,
          gramaje_min: 300,
          gramaje_max: 350,
          incluye_postre: true,
        },
      });

      assert.equal(respuesta.status, 201);
      assert.equal(respuesta.body.data.codigo, `${prefijo}_chico`);

      const enDb = (await query('SELECT * FROM planes_comerciales WHERE codigo = $1', [`${prefijo}_chico`])).rows[0];
      assert.ok(enDb, 'el plan debe persistir en planes_comerciales');
      assert.equal(enDb.gramaje_min, 300);
      assert.equal(enDb.incluye_postre, true);
    } finally {
      await limpiarPlanesTest(prefijo);
    }
  });
});

test('POST /api/v1/planes sin gramaje_max lo persiste como null', async () => {
  const prefijo = `itp${Date.now()}planessinmax`;
  await conAdminTest(prefijo, async ({ token }) => {
    try {
      const respuesta = await requestJson(servidor.baseUrl, 'POST', '/planes', {
        token,
        payload: {
          nombre: `${prefijo} Plan sin max`,
          codigo: `${prefijo}_sinmax`,
          gramaje_min: 300,
        },
      });

      assert.equal(respuesta.status, 201);
      assert.equal(respuesta.body.data.gramaje_max, null);

      const enDb = (await query('SELECT gramaje_max FROM planes_comerciales WHERE codigo = $1', [`${prefijo}_sinmax`])).rows[0];
      assert.equal(enDb.gramaje_max, null);
    } finally {
      await limpiarPlanesTest(prefijo);
    }
  });
});

test('POST /api/v1/planes con codigo duplicado devuelve 409', async () => {
  const prefijo = `itp${Date.now()}planesdup`;
  await conAdminTest(prefijo, async ({ token }) => {
    try {
      const payload = {
        nombre: `${prefijo} Plan`,
        codigo: `${prefijo}_dup`,
        gramaje_min: 300,
        gramaje_max: 350,
      };
      const primera = await requestJson(servidor.baseUrl, 'POST', '/planes', { token, payload });
      assert.equal(primera.status, 201);

      const segunda = await requestJson(servidor.baseUrl, 'POST', '/planes', { token, payload });
      assert.equal(segunda.status, 409);
    } finally {
      await limpiarPlanesTest(prefijo);
    }
  });
});

test('GET /api/v1/planes lista planes creados', async () => {
  const prefijo = `itp${Date.now()}planesget`;
  await conAdminTest(prefijo, async ({ token }) => {
    try {
      await requestJson(servidor.baseUrl, 'POST', '/planes', {
        token,
        payload: { nombre: `${prefijo} Plan`, codigo: `${prefijo}_get`, gramaje_min: 250, gramaje_max: 300 },
      });

      const respuesta = await requestJson(servidor.baseUrl, 'GET', '/planes', { token });
      assert.equal(respuesta.status, 200);
      assert.ok(respuesta.body.data.some((plan) => plan.codigo === `${prefijo}_get`));
    } finally {
      await limpiarPlanesTest(prefijo);
    }
  });
});

test('PATCH /api/v1/planes/:id actualiza campos del plan', async () => {
  const prefijo = `itp${Date.now()}planespatch`;
  await conAdminTest(prefijo, async ({ token }) => {
    try {
      const creado = await requestJson(servidor.baseUrl, 'POST', '/planes', {
        token,
        payload: { nombre: `${prefijo} Plan`, codigo: `${prefijo}_patch`, gramaje_min: 300, gramaje_max: 350 },
      });
      const id = creado.body.data.id;

      const respuesta = await requestJson(servidor.baseUrl, 'PATCH', `/planes/${id}`, {
        token,
        payload: { gramaje_min: 320, incluye_bebida: true },
      });

      assert.equal(respuesta.status, 200);
      assert.equal(respuesta.body.data.gramaje_min, 320);
      assert.equal(respuesta.body.data.incluye_bebida, true);
    } finally {
      await limpiarPlanesTest(prefijo);
    }
  });
});

test('DELETE /api/v1/planes/:id desactiva el plan (soft delete)', async () => {
  const prefijo = `itp${Date.now()}planesdel`;
  await conAdminTest(prefijo, async ({ token }) => {
    try {
      const creado = await requestJson(servidor.baseUrl, 'POST', '/planes', {
        token,
        payload: { nombre: `${prefijo} Plan`, codigo: `${prefijo}_del`, gramaje_min: 300, gramaje_max: 350 },
      });
      const id = creado.body.data.id;

      const respuesta = await requestJson(servidor.baseUrl, 'DELETE', `/planes/${id}`, { token });
      assert.equal(respuesta.status, 200);
      assert.equal(respuesta.body.data.activo, false);

      const enDb = (await query('SELECT activo FROM planes_comerciales WHERE id = $1', [id])).rows[0];
      assert.ok(enDb, 'el plan no debe borrarse fisicamente');
      assert.equal(enDb.activo, false);
    } finally {
      await limpiarPlanesTest(prefijo);
    }
  });
});
