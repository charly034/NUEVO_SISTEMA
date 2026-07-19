import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import pool, { getClient } from '../src/database/connection.js';
import { cargarPlatosFijos, cargarPlatosFijosDesdeMenu } from '../src/modules/pedidos/pedidos.repository.js';
import { materializarFijosMenu } from '../src/modules/categorias/categorias.repository.js';

// Fase B del teardown "la semana es el contenedor": prueba de PARIDAD (shadow
// read). Demuestra sobre los menus REALES que materializar los fijos como
// filas de menu_semanal_dias y leerlos de ahi (cargarPlatosFijosDesdeMenu)
// da EXACTAMENTE lo mismo que leerlos del catalogo (cargarPlatosFijos, el
// path viejo que usan las empresas al pedir HOY).
//
// Se corre todo dentro de UNA transaccion que se revierte al final: NO
// commitea la materializacion a produccion. El commit real es en Fase C,
// justo antes del flip, con esta misma funcion ya probada. Asi el riesgo del
// teardown queda demostrado como cero antes de tocar el read path real.

after(async () => {
  await pool.end();
});

function ordenarPorPlato(rows) {
  return [...rows].sort((a, b) => a.plato_id - b.plato_id);
}

test('paridad fijos: leer de menu_semanal_dias == leer del catalogo, en los 25 menus reales', async () => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { rows: menus } = await client.query('SELECT id, nombre FROM menus_semanales ORDER BY id');
    assert.ok(menus.length > 0, 'debe haber menus para comparar');

    // Materializar los fijos de todos los menus dentro de la transaccion.
    for (const m of menus) {
      await materializarFijosMenu(client, m.id);
    }

    // Contextos de empresa a probar: admin (null, sin restriccion de
    // visibilidad) y una empresa real (ejercita filtroVisibilidadFijoSemana).
    const { rows: empresaRows } = await client.query('SELECT id FROM empresas WHERE activo = true ORDER BY id LIMIT 1');
    const contextos = [null, empresaRows[0]?.id ?? null];

    let comparaciones = 0;
    for (const m of menus) {
      for (const empresaId of contextos) {
        const viejo = ordenarPorPlato((await cargarPlatosFijos(client, empresaId, m.id)).rows);
        const nuevo = ordenarPorPlato((await cargarPlatosFijosDesdeMenu(client, empresaId, m.id)).rows);

        assert.deepEqual(
          nuevo,
          viejo,
          `menu ${m.id} "${m.nombre}" empresa=${empresaId}: el read nuevo (menu_semanal_dias) difiere del viejo (catalogo)`
        );
        comparaciones += 1;
      }
    }

    // Sanity: el conjunto de fijos no debe ser vacio (si lo fuera, la
    // materializacion no habria insertado nada y la "paridad" seria trivial).
    // El umbral se DERIVA del path viejo (catalogo) del mismo menu, no de un
    // numero fijo: la cantidad real de fijos por semana depende de cuantos
    // fijos se anclaron como vianda en el seed (hoy ~14/semana con el CSV
    // historico), asi que hardcodear >=20 hacia fallar el test en un reseed
    // limpio sin que la materializacion tuviera ningun bug.
    const primerMenu = menus[0].id;
    const nuevoPrimero = (await cargarPlatosFijosDesdeMenu(client, null, primerMenu)).rows;
    const viejoPrimero = (await cargarPlatosFijos(client, null, primerMenu)).rows;
    assert.ok(viejoPrimero.length > 0, `el primer menu debe tener fijos en el catalogo, dio ${viejoPrimero.length}`);
    assert.equal(
      nuevoPrimero.length,
      viejoPrimero.length,
      `el primer menu debe materializar exactamente los fijos del catalogo (${viejoPrimero.length}), dio ${nuevoPrimero.length}`,
    );

    assert.ok(comparaciones >= menus.length, 'se compararon todos los menus');

    await client.query('ROLLBACK');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});

test('idempotencia: materializar dos veces el mismo menu no duplica filas', async () => {
  const client = await getClient();
  try {
    await client.query('BEGIN');
    const { rows: menus } = await client.query('SELECT id FROM menus_semanales ORDER BY id LIMIT 1');
    const menuId = menus[0].id;

    await materializarFijosMenu(client, menuId);
    const primera = (await cargarPlatosFijosDesdeMenu(client, null, menuId)).rows.length;
    await materializarFijosMenu(client, menuId);
    const segunda = (await cargarPlatosFijosDesdeMenu(client, null, menuId)).rows.length;

    assert.equal(segunda, primera, 'la segunda materializacion no debe agregar filas (idempotente)');

    await client.query('ROLLBACK');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
});
