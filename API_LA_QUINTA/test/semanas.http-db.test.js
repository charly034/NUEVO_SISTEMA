import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env.js';
import { query } from '../src/database/connection.js';
import * as semanasService from '../src/modules/semanas/semanas.service.js';
import { cerrarPoolDb, iniciarServidorTest, requestJson } from '../test_helpers/pedidos-http.helper.js';

// Fase S0 del plan "semana como raiz": entidad `semanas` como contenedor.
// Fixtures lejos de datos reales para no colisionar/contaminar.
const LUNES_FIXTURE = '2001-01-01';     // un lunes real
const MIERCOLES_FIXTURE = '2001-01-03'; // miercoles de la misma semana

let servidor;

before(async () => {
  servidor = await iniciarServidorTest();
});

after(async () => {
  await query('DELETE FROM semanas WHERE fecha_inicio = $1', [LUNES_FIXTURE]);
  await servidor?.cerrar();
  await cerrarPoolDb();
});

async function conAdminTest(prueba) {
  const email = `semanas-${Date.now()}@test.local`;
  const admin = (await query(
    `INSERT INTO usuarios_admin (nombre, apellido, email, password_hash, rol, activo)
     VALUES ('Admin', 'Semanas', $1, 'test', 'superadmin', true)
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

test('getOrCreateSemana es idempotente y normaliza cualquier dia al lunes', async () => {
  await query('DELETE FROM semanas WHERE fecha_inicio = $1', [LUNES_FIXTURE]);

  const desdeMiercoles = await semanasService.getOrCreateSemana(MIERCOLES_FIXTURE);
  const desdeLunes = await semanasService.getOrCreateSemana(LUNES_FIXTURE);

  assert.equal(desdeMiercoles.id, desdeLunes.id, 'dos fechas de la misma semana devuelven la misma fila');

  const row = (await query(
    'SELECT fecha_inicio::text AS fi, fecha_fin::text AS ff FROM semanas WHERE id = $1',
    [desdeMiercoles.id],
  )).rows[0];
  assert.equal(row.fi, LUNES_FIXTURE, 'fecha_inicio normalizada al lunes');
  assert.equal(row.ff, '2001-01-07', 'fecha_fin = lunes + 6 (domingo)');

  const n = (await query(
    'SELECT COUNT(*)::int AS n FROM semanas WHERE fecha_inicio = $1',
    [LUNES_FIXTURE],
  )).rows[0].n;
  assert.equal(n, 1, 'UNIQUE(fecha_inicio): una sola fila por semana');
});

test('GET /api/v1/semanas/actual devuelve (o crea) la semana de hoy', async () => {
  await conAdminTest(async ({ token }) => {
    const resp = await requestJson(servidor.baseUrl, 'GET', '/semanas/actual', { token });
    assert.equal(resp.status, 200);
    assert.equal(typeof resp.body.data.id, 'number');
    assert.ok(resp.body.data.fecha_inicio, 'trae fecha_inicio');

    // la fila devuelta es un lunes (verificado con cast ::text, sin trampa de TZ)
    const fi = (await query(
      'SELECT fecha_inicio::text AS fi FROM semanas WHERE id = $1',
      [resp.body.data.id],
    )).rows[0].fi;
    assert.equal(new Date(`${fi}T00:00:00`).getDay(), 1, 'fecha_inicio es un lunes');
  });
});

test('GET /api/v1/semanas lista, y /:id valida el id', async () => {
  await conAdminTest(async ({ token }) => {
    const lista = await requestJson(servidor.baseUrl, 'GET', '/semanas', { token });
    assert.equal(lista.status, 200);
    assert.ok(Array.isArray(lista.body.data), 'devuelve un array');

    const bad = await requestJson(servidor.baseUrl, 'GET', '/semanas/abc', { token });
    assert.equal(bad.status, 400, 'id no numerico -> 400');
  });
});
