import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env.js';
import { query } from '../src/database/connection.js';
import {
  cerrarPoolDb,
  iniciarServidorTest,
  requestJson,
  insertarMenuSemana,
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
     VALUES ('Admin', 'DisponibilidadLocal', $1, 'test', $2, true)
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

async function crearPlatoTest(prefijo, overrides = {}) {
  const plato = (await query(
    `INSERT INTO platos (nombre, descripcion, activo, tipo, disponible_vianda)
     VALUES ($1, 'Plato de prueba disponibilidad local', true, 'especial', $2)
     RETURNING *`,
    [`${prefijo} Plato`, overrides.disponible_vianda ?? true],
  )).rows[0];
  return plato;
}

async function limpiarTest(prefijo) {
  await query(
    `DELETE FROM plato_disponibilidad_local pdl USING platos p
     WHERE pdl.plato_id = p.id AND p.nombre LIKE $1`,
    [`${prefijo}%`],
  );
  await query('DELETE FROM platos WHERE nombre LIKE $1', [`${prefijo}%`]);
}

test('PUT /api/v1/platos/:id/disponibilidad-local guarda dia(s) de semana y fecha puntual, GET lo refleja', async () => {
  const prefijo = `itp${Date.now()}dispolocal`;
  await conAdminTest(prefijo, async ({ token }) => {
    try {
      const plato = await crearPlatoTest(prefijo);

      const respuestaPut = await requestJson(servidor.baseUrl, 'PUT', `/platos/${plato.id}/disponibilidad-local`, {
        token,
        payload: {
          entradas: [
            { patron: 'dia_semana', dia_semana: 'lunes' },
            { patron: 'dia_semana', dia_semana: 'miercoles' },
            { patron: 'fecha', fecha: '2026-07-18' },
          ],
        },
      });

      assert.equal(respuestaPut.status, 200);
      assert.equal(respuestaPut.body.data.entradas.length, 3);

      const respuestaGet = await requestJson(servidor.baseUrl, 'GET', `/platos/${plato.id}/disponibilidad-local`, { token });
      assert.equal(respuestaGet.status, 200);
      const patrones = respuestaGet.body.data.entradas.map((e) => e.patron).sort();
      assert.deepEqual(patrones, ['dia_semana', 'dia_semana', 'fecha']);
      assert.ok(respuestaGet.body.data.entradas.some((e) => e.dia_semana === 'lunes'));
      assert.ok(respuestaGet.body.data.entradas.some((e) => e.dia_semana === 'miercoles'));
      assert.ok(respuestaGet.body.data.entradas.some((e) => String(e.fecha).startsWith('2026-07-18')));
    } finally {
      await limpiarTest(prefijo);
    }
  });
});

test('PUT /api/v1/platos/:id/disponibilidad-local rechaza combinar dia_semana con fecha en la misma entrada', async () => {
  const prefijo = `itp${Date.now()}dispolocalmix`;
  await conAdminTest(prefijo, async ({ token }) => {
    try {
      const plato = await crearPlatoTest(prefijo);

      const respuesta = await requestJson(servidor.baseUrl, 'PUT', `/platos/${plato.id}/disponibilidad-local`, {
        token,
        payload: {
          entradas: [
            { patron: 'dia_semana', dia_semana: 'lunes', fecha: '2026-07-18' },
          ],
        },
      });

      assert.equal(respuesta.status, 400);
    } finally {
      await limpiarTest(prefijo);
    }
  });
});

test('PUT /api/v1/platos/:id/disponibilidad-local reemplaza el calendario completo (delete + insert)', async () => {
  const prefijo = `itp${Date.now()}dispolocalreemplazo`;
  await conAdminTest(prefijo, async ({ token }) => {
    try {
      const plato = await crearPlatoTest(prefijo);

      await requestJson(servidor.baseUrl, 'PUT', `/platos/${plato.id}/disponibilidad-local`, {
        token,
        payload: { entradas: [{ patron: 'diario' }] },
      });

      const respuesta = await requestJson(servidor.baseUrl, 'PUT', `/platos/${plato.id}/disponibilidad-local`, {
        token,
        payload: { entradas: [{ patron: 'dia_semana', dia_semana: 'sabado' }] },
      });

      assert.equal(respuesta.status, 200);
      assert.equal(respuesta.body.data.entradas.length, 1);
      assert.equal(respuesta.body.data.entradas[0].patron, 'dia_semana');
      assert.equal(respuesta.body.data.entradas[0].dia_semana, 'sabado');
    } finally {
      await limpiarTest(prefijo);
    }
  });
});

test('POST /api/v1/menus-semanales/:id/dias rechaza un plato sin vianda activa', async () => {
  const prefijo = `itp${Date.now()}nodisponiblevianda`;
  await conAdminTest(prefijo, async ({ token }) => {
    try {
      const plato = await crearPlatoTest(prefijo, { disponible_vianda: false });

      const menu = await insertarMenuSemana(query, {
        nombre: `${prefijo} Menu`, fecha_inicio: '2026-08-03',
      });

      const respuesta = await requestJson(servidor.baseUrl, 'POST', `/menus-semanales/${menu.id}/dias`, {
        token,
        payload: { dia: 'lunes', opcion: 'A', plato_id: plato.id },
      });

      assert.equal(respuesta.status, 409);
      assert.match(respuesta.body.message, /no tiene una vianda activa/);

      await query('DELETE FROM menus_semanales WHERE id = $1', [menu.id]);
    } finally {
      await limpiarTest(prefijo);
    }
  });
});
