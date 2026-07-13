import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import pool, { query } from '../src/database/connection.js';
import { getSemanaOpciones } from '../src/modules/semana-opciones/semana-opciones.service.js';

// Fase F del teardown: prueba de PARIDAD del payload nuevo categorias[] contra
// los campos viejos (dias[].opciones / dias[].fijos / guarniciones / salsas)
// de getSemanaOpciones, sobre los menus REALES. Demuestra que el frontend
// dinamico va a dibujar exactamente lo mismo que hoy antes de reescribirlo.
// Es read-only: no escribe nada.

after(async () => {
  await pool.end();
});

function bucket(categorias, slug) {
  return categorias.find((c) => c.slug === slug) ?? null;
}

test('categorias[] reproduce especiales/fijos/guarniciones/salsas en los menus reales', async () => {
  const { rows: menus } = await query(
    "SELECT id FROM menus_semanales WHERE nombre NOT LIKE 'itp%' ORDER BY id"
  );
  assert.ok(menus.length > 0, 'debe haber menus reales');

  let verificados = 0;
  for (const m of menus) {
    const data = await getSemanaOpciones(m.id);
    assert.ok(Array.isArray(data.categorias), `menu ${m.id}: categorias[] presente`);

    // Las 5 categorias del sistema siempre estan, con su render/tipo_item.
    for (const slug of ['especiales', 'fijos-x-dia', 'fijos-de-siempre', 'guarniciones', 'salsas']) {
      assert.ok(bucket(data.categorias, slug), `menu ${m.id}: falta categoria ${slug}`);
    }
    assert.equal(bucket(data.categorias, 'especiales').render, 'matriz');
    assert.equal(bucket(data.categorias, 'especiales').tipo_item, 'slot');
    assert.equal(bucket(data.categorias, 'fijos-x-dia').render, 'lista_dia');
    assert.equal(bucket(data.categorias, 'fijos-x-dia').tipo_item, 'fijo');
    assert.equal(bucket(data.categorias, 'fijos-de-siempre').render, 'lista_siempre');
    assert.equal(bucket(data.categorias, 'guarniciones').tipo_item, 'catalogo');

    // Orden visual: especiales < fijos-x-dia < fijos-de-siempre < guarniciones < salsas.
    const ordenes = ['especiales', 'fijos-x-dia', 'fijos-de-siempre', 'guarniciones', 'salsas']
      .map((s) => bucket(data.categorias, s).orden_display);
    for (let i = 1; i < ordenes.length; i++) {
      assert.ok(ordenes[i] > ordenes[i - 1], `menu ${m.id}: orden visual roto en ${i}`);
    }

    // ── Especiales: mismo conjunto de slots que dias[].opciones ──
    const slotsViejos = new Set(data.dias.flatMap((d) => d.opciones.map((o) => o.slot_id)));
    const slotsNuevos = new Set(bucket(data.categorias, 'especiales').items.map((it) => it.slot_id));
    assert.deepEqual(
      [...slotsNuevos].sort((a, b) => a - b),
      [...slotsViejos].sort((a, b) => a - b),
      `menu ${m.id}: especiales difieren`
    );

    // ── Fijos de siempre: platos unicos con origen global/siempre ──
    const siempreViejo = new Set();
    const fijoDiaViejo = []; // (dia, plato_id|ciclo)
    data.dias.forEach((d) => d.fijos.forEach((f) => {
      if (f.origen === 'global' && f.categoria === 'siempre') {
        siempreViejo.add(f.plato_id);
      } else {
        fijoDiaViejo.push(`${d.dia}:${f.plato_id ?? 'ciclo' + f.ciclo_id}`);
      }
    }));
    const siempreNuevo = new Set(bucket(data.categorias, 'fijos-de-siempre').items.map((it) => it.plato_id));
    assert.deepEqual(
      [...siempreNuevo].sort((a, b) => a - b),
      [...siempreViejo].sort((a, b) => a - b),
      `menu ${m.id}: fijos de siempre difieren`
    );

    // ── Fijos x dia (+ rotativos): mismas (dia, plato) que los no-siempre ──
    const fijoDiaNuevo = bucket(data.categorias, 'fijos-x-dia').items
      .map((it) => `${it.dia}:${it.plato_id ?? 'ciclo' + it.ciclo_id}`);
    assert.deepEqual(
      fijoDiaNuevo.sort(),
      fijoDiaViejo.sort(),
      `menu ${m.id}: fijos x dia difieren`
    );

    // ── Guarniciones / Salsas: mismos ids que las listas viejas ──
    assert.deepEqual(
      bucket(data.categorias, 'guarniciones').items.map((it) => it.id).sort((a, b) => a - b),
      data.guarniciones.map((g) => g.id).sort((a, b) => a - b),
      `menu ${m.id}: guarniciones difieren`
    );
    assert.deepEqual(
      bucket(data.categorias, 'salsas').items.map((it) => it.id).sort((a, b) => a - b),
      data.salsas.map((s) => s.id).sort((a, b) => a - b),
      `menu ${m.id}: salsas difieren`
    );

    verificados += 1;
  }
  assert.ok(verificados >= menus.length, 'se verificaron todos los menus');
});
