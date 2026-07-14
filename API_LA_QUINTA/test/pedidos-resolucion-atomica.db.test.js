import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import pool, { getClient } from '../src/database/connection.js';
import { VIANDA_SLOT_COLS, VIANDA_SLOT_JOINS } from '../src/modules/pedidos/pedidos.repository.js';

// plan-eng-review T2/T4: cascada guarnición/salsa con RESOLUCIÓN ATÓMICA POR CAPA
// (excepción empresa → override de celda → vianda → plato → sin). Cada capa aporta
// (modo, id) como bloque; ver pedidos.repository.js VIANDA_SLOT_COLS.
//
// Este test cubre:
//  1. Regresión byte-idéntica (T2): la fórmula atómica con empresa=NULL == la fórmula
//     per-columna anterior (congelada abajo) sobre los menús reales.
//  2. Semántica atómica de la celda (T2): overrides sintéticos bien formados.
//  3. Capa empresa (T4): la excepción por empresa gana, y la GUARDA plato_id_origen
//     ignora la excepción si la rotación cambió el plato del slot (anti-rancio).

after(async () => {
  await pool.end();
});

// Fórmula ANTERIOR (per-columna, pre-T2), congelada. Referencia de no-regresión.
const VIANDA_SLOT_COLS_VIEJO = `
            COALESCE(v.nombre_vianda, p.nombre) AS nombre_vianda,
            CASE
              WHEN msd.guarnicion_modo_override = 'fija' THEN 'fija'
              WHEN msd.guarnicion_modo_override IN ('sin_guarnicion', 'libre') THEN msd.guarnicion_modo_override
              WHEN v.guarnicion_id IS NOT NULL THEN 'fija'
              WHEN p.tiene_guarnicion THEN 'libre'
              ELSE 'sin_guarnicion'
            END AS guarnicion_modo,
            COALESCE(msd.guarnicion_fija_override_id, v.guarnicion_id) AS guarnicion_fija_id,
            gf.nombre AS guarnicion_fija_nombre,
            CASE
              WHEN msd.salsa_modo_override = 'fija' THEN 'fija'
              WHEN msd.salsa_modo_override IN ('sin_salsa', 'libre') THEN msd.salsa_modo_override
              WHEN v.salsa_id IS NOT NULL THEN 'fija'
              WHEN v.salsa_libre THEN 'libre'
              ELSE 'sin_salsa'
            END AS salsa_modo,
            COALESCE(msd.salsa_fija_override_id, v.salsa_id) AS salsa_fija_id,
            sf.nombre AS salsa_fija_nombre`;
const VIANDA_SLOT_JOINS_VIEJO = `
     LEFT JOIN viandas v ON v.id = msd.vianda_id
     LEFT JOIN guarniciones gf ON gf.id = COALESCE(msd.guarnicion_fija_override_id, v.guarnicion_id)
     LEFT JOIN salsas sf ON sf.id = COALESCE(msd.salsa_fija_override_id, v.salsa_id)`;

const SELECT_COLS = 'msd.id AS msd_id, msd.dia::text AS dia, msd.opcion,';

// El VIEJO no tiene la capa empresa ($2); se corre sin parámetros.
function resolverViejo(client) {
  return client.query(
    `SELECT ${SELECT_COLS}${VIANDA_SLOT_COLS_VIEJO}
       FROM menu_semanal_dias msd
       JOIN platos p ON p.id = msd.plato_id${VIANDA_SLOT_JOINS_VIEJO}
      ORDER BY msd.id`
  );
}
// El NUEVO usa $2 = empresa (los joins de emo). $1 no lo usan los joins, pero debe
// existir y estar tipado; se consume con un predicado trivial.
function resolverNuevo(client, empresaId) {
  return client.query(
    `SELECT ${SELECT_COLS}${VIANDA_SLOT_COLS}
       FROM menu_semanal_dias msd
       JOIN platos p ON p.id = msd.plato_id${VIANDA_SLOT_JOINS}
      WHERE $1::int IS NOT DISTINCT FROM $1::int
      ORDER BY msd.id`,
    [null, empresaId]
  );
}

test('regresión byte-idéntica: atómica (empresa=NULL) == per-columna sobre todos los menu_semanal_dias reales', async () => {
  const client = await getClient();
  try {
    const viejo = (await resolverViejo(client)).rows;
    const nuevo = (await resolverNuevo(client, null)).rows;
    assert.ok(viejo.length > 0, 'debe haber slots para comparar');
    assert.deepEqual(nuevo, viejo, 'la resolución atómica (empresa=NULL) difiere de la per-columna sobre data real');
  } finally {
    client.release();
  }
});

// Lee la resolución de un slot puntual con la cascada NUEVA, para una empresa dada
// (null = contexto admin/base).
async function leerSlot(client, msdId, empresaId) {
  const { rows } = await client.query(
    `SELECT ${VIANDA_SLOT_COLS}
       FROM menu_semanal_dias msd
       JOIN platos p ON p.id = msd.plato_id${VIANDA_SLOT_JOINS}
      WHERE msd.id = $1`,
    [msdId, empresaId]
  );
  return rows[0];
}

async function slotCompuesto(client) {
  const { rows } = await client.query(
    `SELECT msd.id, msd.menu_semanal_id, msd.categoria_id, msd.dia, msd.opcion, msd.plato_id,
            v.guarnicion_id, v.salsa_id
       FROM menu_semanal_dias msd
       JOIN viandas v ON v.id = msd.vianda_id
      WHERE v.guarnicion_id IS NOT NULL AND v.salsa_id IS NOT NULL
        AND msd.categoria_id IS NOT NULL
      LIMIT 1`
  );
  return rows[0] ?? null;
}

test('semántica atómica de celda: overrides sintéticos bien formados resuelven (modo, id) como bloque', async () => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const slot = await slotCompuesto(client);
    if (!slot) { await client.query('ROLLBACK'); return; }

    const { rows: [otraG] } = await client.query('SELECT id FROM guarniciones WHERE id <> $1 AND activo = true LIMIT 1', [slot.guarnicion_id]);
    const { rows: [otraS] } = await client.query('SELECT id FROM salsas WHERE id <> $1 AND activo = true LIMIT 1', [slot.salsa_id]);

    // 1) 'fija' con id → usa el id del override, no el de la vianda.
    await client.query(
      `UPDATE menu_semanal_dias SET guarnicion_modo_override='fija', guarnicion_fija_override_id=$2,
              salsa_modo_override='fija', salsa_fija_override_id=$3 WHERE id=$1`,
      [slot.id, otraG.id, otraS.id]
    );
    let r = await leerSlot(client, slot.id, null);
    assert.equal(r.guarnicion_modo, 'fija');
    assert.equal(r.guarnicion_fija_id, otraG.id);
    assert.equal(r.salsa_modo, 'fija');
    assert.equal(r.salsa_fija_id, otraS.id);

    // 2) 'sin_*' → id NULL (no arrastra el de la vianda).
    await client.query(
      `UPDATE menu_semanal_dias SET guarnicion_modo_override='sin_guarnicion', guarnicion_fija_override_id=NULL,
              salsa_modo_override='sin_salsa', salsa_fija_override_id=NULL WHERE id=$1`,
      [slot.id]
    );
    r = await leerSlot(client, slot.id, null);
    assert.equal(r.guarnicion_modo, 'sin_guarnicion');
    assert.equal(r.guarnicion_fija_id, null);
    assert.equal(r.salsa_modo, 'sin_salsa');
    assert.equal(r.salsa_fija_id, null);

    // 3) 'fija' sin id → id NULL (fuga per-columna cerrada).
    await client.query(
      `UPDATE menu_semanal_dias SET guarnicion_modo_override='fija', guarnicion_fija_override_id=NULL WHERE id=$1`,
      [slot.id]
    );
    r = await leerSlot(client, slot.id, null);
    assert.equal(r.guarnicion_modo, 'fija');
    assert.equal(r.guarnicion_fija_id, null);

    await client.query('ROLLBACK');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

test('capa empresa (T4): la excepción por empresa gana y la guarda plato_id_origen la invalida si cambió el plato', async () => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const slot = await slotCompuesto(client);
    if (!slot) { await client.query('ROLLBACK'); return; }

    const { rows: [emp] } = await client.query('SELECT id FROM empresas WHERE activo = true ORDER BY id LIMIT 1');
    const { rows: [otraG] } = await client.query('SELECT id FROM guarniciones WHERE id <> $1 AND activo = true LIMIT 1', [slot.guarnicion_id ?? 0]);
    const { rows: [otroPlato] } = await client.query('SELECT id FROM platos WHERE id <> $1 LIMIT 1', [slot.plato_id]);

    const insertarExcepcion = (platoOrigen, gModo, gId) => client.query(
      `INSERT INTO menu_semanal_dia_empresa_override
         (menu_semanal_id, categoria_id, dia, opcion, empresa_id, plato_id_origen, guarnicion_modo_override, guarnicion_fija_override_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [slot.menu_semanal_id, slot.categoria_id, slot.dia, slot.opcion, emp.id, platoOrigen, gModo, gId]
    );

    // Base (empresa=null / admin): sin excepción, resuelve por la vianda.
    const base = await leerSlot(client, slot.id, null);

    // Excepción VÁLIDA (plato_id_origen = plato actual del slot): la empresa la ve, el admin no.
    await insertarExcepcion(slot.plato_id, 'fija', otraG.id);
    const conEmpresa = await leerSlot(client, slot.id, emp.id);
    assert.equal(conEmpresa.guarnicion_modo, 'fija', 'la empresa ve el modo de la excepción');
    assert.equal(conEmpresa.guarnicion_fija_id, otraG.id, 'la empresa ve la guarnición de la excepción');
    const adminIgual = await leerSlot(client, slot.id, null);
    assert.deepEqual(adminIgual, base, 'el admin (empresa=null) no ve la excepción por empresa');

    // Guarda anti-rancio: reapunto la excepción a OTRO plato (simula que la rotación
    // cambió el plato del slot). Ahora plato_id_origen != slot.plato_id → no aplica.
    await client.query('DELETE FROM menu_semanal_dia_empresa_override WHERE menu_semanal_id=$1 AND empresa_id=$2', [slot.menu_semanal_id, emp.id]);
    await insertarExcepcion(otroPlato.id, 'fija', otraG.id);
    const stale = await leerSlot(client, slot.id, emp.id);
    assert.deepEqual(stale, base, 'excepción rancia (otro plato_id_origen): no se aplica, resuelve la base');

    await client.query('ROLLBACK');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});
