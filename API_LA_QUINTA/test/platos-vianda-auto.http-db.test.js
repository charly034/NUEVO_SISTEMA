import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env.js';
import { query } from '../src/database/connection.js';
import { cerrarPoolDb, iniciarServidorTest, requestJson } from '../test_helpers/pedidos-http.helper.js';

// Golpe barato del /plan-eng-review 2026-07-18: crear un plato auto-crea su
// vianda "general" en la misma transaccion, para que el plato quede usable en
// el diseño de menu al instante (sin el error "no tiene una vianda activa").

let servidor;

before(async () => {
  servidor = await iniciarServidorTest();
});

after(async () => {
  await servidor?.cerrar();
  await cerrarPoolDb();
});

async function conAdminTest(prueba) {
  const email = `platos-vianda-${Date.now()}@test.local`;
  const admin = (await query(
    `INSERT INTO usuarios_admin (nombre, apellido, email, password_hash, rol, activo)
     VALUES ('Admin', 'Platos', $1, 'test', 'superadmin', true)
     RETURNING id`,
    [email],
  )).rows[0];
  const token = jwt.sign({ sub: admin.id, tipo: 'admin' }, env.JWT_SECRET, { expiresIn: '1h' });
  try {
    return await prueba({ token });
  } finally {
    await query('DELETE FROM usuarios_admin WHERE id = $1', [admin.id]);
  }
}

test('POST /api/v1/platos auto-crea una vianda general activa (plato usable al instante)', async () => {
  await conAdminTest(async ({ token }) => {
    const nombre = `itp-vianda-auto-${Date.now()}`;
    const resp = await requestJson(servidor.baseUrl, 'POST', '/platos', {
      token,
      payload: { nombre, descripcion: 'test auto vianda' },
    });

    assert.equal(resp.status, 201);
    const platoId = resp.body.data.id;
    try {
      const viandas = (await query(
        'SELECT id, empresa_id, activo FROM viandas WHERE plato_id = $1',
        [platoId],
      )).rows;
      assert.equal(viandas.length, 1, 'debe existir exactamente 1 vianda auto-creada');
      assert.equal(viandas[0].empresa_id, null, 'la vianda auto-creada es general (empresa_id NULL)');
      assert.equal(viandas[0].activo, true, 'la vianda auto-creada esta activa');
    } finally {
      await query('DELETE FROM viandas WHERE plato_id = $1', [platoId]);
      await query('DELETE FROM platos WHERE id = $1', [platoId]);
    }
  });
});
