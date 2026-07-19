import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { query } from '../src/database/connection.js';
import { cerrarPoolDb } from '../test_helpers/pedidos-http.helper.js';

// Fase S2 (write-flip): el trigger BEFORE INSERT/UPDATE auto-popula semana_id
// desde la fecha. Se prueba en pedido_sugerencia_opciones (pocas FKs): al
// insertar una fila con una fecha cualquiera, semana_id debe quedar seteado y
// resolver al lunes de esa fecha (date_trunc week).

const FECHA_FIXTURE = '2099-06-17'; // fecha lejana, no colisiona con datos reales

after(async () => {
  await query('DELETE FROM pedido_sugerencia_opciones WHERE semana_inicio = $1', [FECHA_FIXTURE]);
  await cerrarPoolDb();
});

test('INSERT auto-popula semana_id desde la fecha (write-flip)', async () => {
  const plato = (await query('SELECT id FROM platos ORDER BY id LIMIT 1')).rows[0];
  assert.ok(plato, 'hay al menos un plato sembrado');

  await query('DELETE FROM pedido_sugerencia_opciones WHERE semana_inicio = $1', [FECHA_FIXTURE]);
  await query(
    'INSERT INTO pedido_sugerencia_opciones (semana_inicio, plato_id, orden, activo) VALUES ($1, $2, 1, true)',
    [FECHA_FIXTURE, plato.id],
  );

  const row = (await query(
    `SELECT o.semana_id, s.fecha_inicio::text AS fi
     FROM pedido_sugerencia_opciones o
     JOIN semanas s ON s.id = o.semana_id
     WHERE o.semana_inicio = $1 AND o.plato_id = $2`,
    [FECHA_FIXTURE, plato.id],
  )).rows[0];

  assert.ok(row, 'la fila quedo con semana_id (JOIN a semanas devuelve algo)');

  const esperado = (await query(`SELECT date_trunc('week', $1::date)::date::text AS m`, [FECHA_FIXTURE])).rows[0].m;
  assert.equal(row.fi, esperado, 'semana_id resuelve al lunes de la fecha insertada');
});
