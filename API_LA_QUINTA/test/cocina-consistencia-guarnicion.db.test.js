import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import pool, { getClient } from '../src/database/connection.js';

// plan-eng-review T5: baseline de regresión de COCINA.
//
// Hallazgo (grounded en cocina.repository.js + cocina.service.js): la cocina NO
// necesita un peldaño de resolución por-empresa. Su producción real sale de:
//   - findDetalleEtiquetas → lee pi.guarnicion_id / pi.salsa_id (el SNAPSHOT del
//     pedido). El snapshot ya es por-empresa: al guardar, validateItemForMenu (T4)
//     resuelve la guarnición/salsa de la empresa y upsertItem la persiste.
//   - findConteosPedidos → cuenta PLATOS por empresa, no guarniciones (no hay
//     agregación por guarnición que "fragmentar").
//   - SLOTS_SELECT → tablero del menú de la semana, resolución base a propósito.
//
// Por eso T5 no agrega joins a cocina (evita el riesgo que marcó la voz externa).
// Lo que sí valida este test: tras la normalización de T2, la guarnición/salsa que
// COCINA resolvería del menú (SLOTS_SELECT) COINCIDE, slot por slot, con la que
// resuelve PEDIDOS en contexto base (empresa=NULL). Si divergieran, la cocina
// cocinaría distinto a lo que el cliente ve ofertado.

after(async () => {
  await pool.end();
});

// Expresión de id de guarnición/salsa tal como la resuelve COCINA (SLOTS_SELECT).
const COCINA_IDS = `
  CASE
    WHEN msd.guarnicion_modo_override = 'fija' THEN msd.guarnicion_fija_override_id
    WHEN msd.guarnicion_modo_override IN ('sin_guarnicion', 'libre') THEN NULL
    ELSE v.guarnicion_id
  END AS cocina_guarnicion_id,
  CASE
    WHEN msd.salsa_modo_override = 'fija' THEN msd.salsa_fija_override_id
    WHEN msd.salsa_modo_override IN ('sin_salsa', 'libre') THEN NULL
    ELSE v.salsa_id
  END AS cocina_salsa_id`;

// Expresión de id tal como la resuelve PEDIDOS en contexto base (sin capa empresa).
const PEDIDOS_IDS = `
  CASE
    WHEN msd.guarnicion_modo_override IS NOT NULL THEN msd.guarnicion_fija_override_id
    ELSE v.guarnicion_id
  END AS pedidos_guarnicion_id,
  CASE
    WHEN msd.salsa_modo_override IS NOT NULL THEN msd.salsa_fija_override_id
    ELSE v.salsa_id
  END AS pedidos_salsa_id`;

test('consistencia cocina↔pedidos: la guarnición/salsa fija coincide slot por slot (todos los menu_semanal_dias reales)', async () => {
  const client = await getClient();
  try {
    const { rows } = await client.query(
      `SELECT msd.id, ${COCINA_IDS}, ${PEDIDOS_IDS}
         FROM menu_semanal_dias msd
         JOIN platos p ON p.id = msd.plato_id
         LEFT JOIN viandas v ON v.id = msd.vianda_id
        WHERE msd.opcion IS NOT NULL`
    );
    assert.ok(rows.length > 0, 'debe haber slots especiales para comparar');

    const divergentes = rows.filter(
      (r) => r.cocina_guarnicion_id !== r.pedidos_guarnicion_id || r.cocina_salsa_id !== r.pedidos_salsa_id
    );
    assert.deepEqual(
      divergentes,
      [],
      `hay slots donde cocina resolvería una guarnición/salsa distinta a pedidos: ${JSON.stringify(divergentes.slice(0, 5))}`
    );
  } finally {
    client.release();
  }
});
