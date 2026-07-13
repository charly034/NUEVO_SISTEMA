import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import pool, { query } from '../src/database/connection.js';

// Fase A del teardown "la semana es el contenedor": verifica que la migracion
// 1719000075000 dejo el esquema listo con cero cambio de comportamiento --
// categorias del sistema sembradas, backfill de Especiales sobre las filas
// existentes de menu_semanal_dias, y las columnas nullable donde corresponde.

after(async () => {
  await pool.end();
});

test('las 5 categorias del sistema existen con es_sistema=true y su tipo_dato correcto', async () => {
  const r = await query(
    `SELECT slug, tipo_dato, usa_opcion, es_sistema, alcance, modo
     FROM categorias WHERE es_sistema = true ORDER BY orden`
  );
  const bySlug = Object.fromEntries(r.rows.map((c) => [c.slug, c]));

  assert.equal(r.rows.length, 5, 'deben existir exactamente 5 categorias de sistema');

  assert.equal(bySlug['especiales'].tipo_dato, 'platos');
  assert.equal(bySlug['especiales'].usa_opcion, true, 'especiales usa letras de opcion A/B/C');

  assert.equal(bySlug['fijos-x-dia'].tipo_dato, 'platos');
  assert.equal(bySlug['fijos-x-dia'].usa_opcion, false);
  assert.equal(bySlug['fijos-x-dia'].modo, 'plato_distinto_por_dia');

  assert.equal(bySlug['fijos-de-siempre'].tipo_dato, 'platos');
  assert.equal(bySlug['fijos-de-siempre'].modo, 'plato_unico_todos_los_dias', 'fijos de siempre = mismo plato todos los dias');

  assert.equal(bySlug['guarniciones'].tipo_dato, 'guarniciones');
  assert.equal(bySlug['salsas'].tipo_dato, 'salsas');

  for (const c of r.rows) {
    assert.equal(c.alcance, 'recurrente', `la categoria de sistema ${c.slug} es recurrente`);
  }
});

test('cada fila de menu_semanal_dias esta categorizada: especiales tienen opcion, fijos no', async () => {
  // El backfill de Fase A anclo las filas existentes (todas especiales) a la
  // categoria Especiales. Tras la Fase C, menu_semanal_dias tambien tiene los
  // fijos materializados (opcion IS NULL, categoria fijos-x-dia/de-siempre). La
  // invariante DURADERA que importa: ninguna fila queda sin categoria, y el
  // discriminador opcion separa limpiamente especiales de fijos.
  const r = await query(
    `SELECT
       COUNT(*) FILTER (WHERE categoria_id IS NULL) AS sin_categoria,
       COUNT(*) FILTER (
         WHERE opcion IS NOT NULL
           AND categoria_id <> (SELECT id FROM categorias WHERE slug = 'especiales')
       ) AS especiales_mal_ancladas,
       COUNT(*) FILTER (
         WHERE opcion IS NULL
           AND categoria_id NOT IN (
             SELECT id FROM categorias WHERE slug IN ('fijos-x-dia', 'fijos-de-siempre')
           )
       ) AS fijos_mal_anclados
     FROM menu_semanal_dias`
  );
  const { sin_categoria, especiales_mal_ancladas, fijos_mal_anclados } = r.rows[0];
  assert.equal(Number(sin_categoria), 0, 'no debe quedar ninguna fila sin categoria');
  assert.equal(Number(especiales_mal_ancladas), 0, 'toda fila con opcion (especial) debe ser categoria Especiales');
  assert.equal(Number(fijos_mal_anclados), 0, 'toda fila sin opcion (fijo) debe ser una categoria de fijos');
});

test('menu_semanal_dias.dia y opcion ahora aceptan NULL (para los fijos de Fase B)', async () => {
  const r = await query(
    `SELECT column_name, is_nullable FROM information_schema.columns
     WHERE table_name = 'menu_semanal_dias' AND column_name IN ('dia', 'opcion', 'categoria_id')`
  );
  const byCol = Object.fromEntries(r.rows.map((c) => [c.column_name, c.is_nullable]));
  assert.equal(byCol['dia'], 'YES', 'dia debe ser nullable (fijo de siempre = todos los dias)');
  assert.equal(byCol['opcion'], 'YES', 'opcion debe ser nullable (fijos sin letra)');
  assert.equal(byCol['categoria_id'], 'YES', 'categoria_id es nullable (bucket "Sin categorizar")');
});

test('las tablas nuevas de categorias existen (defaults, grupos, grupo-plato)', async () => {
  const r = await query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name IN ('categorias', 'categoria_defaults_vianda', 'categoria_grupo', 'categoria_grupo_plato')`
  );
  const nombres = r.rows.map((t) => t.table_name).sort();
  assert.deepEqual(nombres, ['categoria_defaults_vianda', 'categoria_grupo', 'categoria_grupo_plato', 'categorias']);
});

test('el CHECK de alcance impide una categoria recurrente atada a un menu (y viceversa)', async () => {
  // recurrente + menu_semanal_id NOT NULL debe fallar
  await assert.rejects(
    query(
      `INSERT INTO categorias (nombre, slug, tipo_dato, alcance, menu_semanal_id)
       VALUES ('X recurrente con menu', 'x-rec-con-menu-fasea', 'platos', 'recurrente', 1)`
    ),
    /categorias_alcance_menu_chk|check/i,
    'una categoria recurrente no puede tener menu_semanal_id'
  );
});
