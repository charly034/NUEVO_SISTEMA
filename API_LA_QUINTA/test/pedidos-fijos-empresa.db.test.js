import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import pool, { getClient } from '../src/database/connection.js';
import { cargarPlatosFijosDesdeMenu, validateItemForMenu } from '../src/modules/pedidos/pedidos.repository.js';

// plan-eng-review T9: excepción de guarnición/salsa POR EMPRESA sobre FIJOS.
// Los fijos son filas menu_semanal_dias (categoria fijos-*, opcion NULL) que resuelven
// de la vianda. La capa empresa se ancla con las mismas claves y se aplica tanto en el
// READ (cargarPlatosFijosDesdeMenu — lo que ve el empleado) como en el WRITE
// (validateItemForMenu — el snapshot del pedido). Guarda anti-rancio: plato_id_origen.

after(async () => {
  await pool.end();
});

// Fijo-de-siempre (dia NULL) con vianda-guarnición y SIN restricción de visibilidad
// (allowlist: sin filas = visible a todas), para que cualquier empresa lo vea.
async function fijoLibreVisible(client) {
  const { rows } = await client.query(
    `SELECT msd.menu_semanal_id, msd.categoria_id, msd.dia, msd.plato_id, v.guarnicion_id
       FROM menu_semanal_dias msd
       JOIN categorias c ON c.id = msd.categoria_id AND c.slug = 'fijos-de-siempre'
       JOIN viandas v ON v.id = msd.vianda_id AND v.activo = true
      WHERE v.guarnicion_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM menu_semanal_fijos_visibilidad m WHERE m.menu_semanal_id = msd.menu_semanal_id AND m.plato_id = msd.plato_id)
      LIMIT 1`
  );
  return rows[0] ?? null;
}

function guarnDeFijo(rows, platoId) {
  const r = rows.find((x) => x.plato_id === platoId);
  return r ? { modo: r.guarnicion_modo, id: r.guarnicion_fija_id } : null;
}

test('T9 fijos: la excepción por empresa se aplica en read y write, y la guarda plato_id_origen la invalida', async () => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const fijo = await fijoLibreVisible(client);
    if (!fijo) { await client.query('ROLLBACK'); return; }
    const { menu_semanal_id: menuId, categoria_id, dia, plato_id } = fijo;

    const { rows: [emp] } = await client.query('SELECT id FROM empresas WHERE activo = true ORDER BY id LIMIT 1');
    const { rows: [otraG] } = await client.query('SELECT id FROM guarniciones WHERE id <> $1 AND activo = true LIMIT 1', [fijo.guarnicion_id]);
    const { rows: [otroPlato] } = await client.query('SELECT id FROM platos WHERE id <> $1 LIMIT 1', [plato_id]);

    const insertarExcepcion = (platoOrigen) => client.query(
      `INSERT INTO menu_semanal_dia_empresa_override
         (menu_semanal_id, categoria_id, dia, opcion, empresa_id, plato_id_origen, guarnicion_modo_override, guarnicion_fija_override_id)
       VALUES ($1,$2,$3,NULL,$4,$5,'fija',$6)`,
      [menuId, categoria_id, dia, emp.id, platoOrigen, otraG.id]
    );

    // READ base (empresa, sin excepción): resuelve de la vianda.
    const baseRead = guarnDeFijo((await cargarPlatosFijosDesdeMenu(client, emp.id, menuId)).rows, plato_id);
    assert.ok(baseRead, 'el fijo debe aparecer para la empresa');
    assert.equal(baseRead.id, fijo.guarnicion_id, 'base: guarnición de la vianda');

    // WRITE base (empresa, sin excepción): el snapshot usaría la de la vianda.
    const baseWrite = await validateItemForMenu(menuId, { plato_id, dia: 'lunes', opcion: null }, client, emp.id);
    assert.equal(baseWrite.guarnicion_fija_id, fijo.guarnicion_id, 'write base: guarnición de la vianda');

    // Excepción VÁLIDA (plato_id_origen = plato del fijo).
    await insertarExcepcion(plato_id);

    const conExc = guarnDeFijo((await cargarPlatosFijosDesdeMenu(client, emp.id, menuId)).rows, plato_id);
    assert.equal(conExc.modo, 'fija', 'read: la empresa ve el modo de la excepción');
    assert.equal(conExc.id, otraG.id, 'read: la empresa ve la guarnición de la excepción');

    const writeExc = await validateItemForMenu(menuId, { plato_id, dia: 'lunes', opcion: null }, client, emp.id);
    assert.equal(writeExc.guarnicion_modo, 'fija', 'write: snapshot usa el modo de la excepción');
    assert.equal(writeExc.guarnicion_fija_id, otraG.id, 'write: snapshot usa la guarnición de la excepción');

    // Admin (empresa=null) no ve la excepción.
    const admin = guarnDeFijo((await cargarPlatosFijosDesdeMenu(client, null, menuId)).rows, plato_id);
    assert.equal(admin.id, fijo.guarnicion_id, 'admin: resolución base, sin excepción por empresa');

    // Guarda anti-rancio: excepción apuntando a OTRO plato → no se aplica.
    await client.query('DELETE FROM menu_semanal_dia_empresa_override WHERE menu_semanal_id=$1 AND empresa_id=$2', [menuId, emp.id]);
    await insertarExcepcion(otroPlato.id);
    const staleRead = guarnDeFijo((await cargarPlatosFijosDesdeMenu(client, emp.id, menuId)).rows, plato_id);
    assert.equal(staleRead.id, fijo.guarnicion_id, 'read stale: no se aplica, resuelve la base');
    const staleWrite = await validateItemForMenu(menuId, { plato_id, dia: 'lunes', opcion: null }, client, emp.id);
    assert.equal(staleWrite.guarnicion_fija_id, fijo.guarnicion_id, 'write stale: no se aplica, resuelve la base');

    await client.query('ROLLBACK');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});
