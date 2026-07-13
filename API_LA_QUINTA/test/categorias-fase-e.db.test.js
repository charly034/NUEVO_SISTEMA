import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import pool, { query } from '../src/database/connection.js';
import * as categoriasService from '../src/modules/categorias/categorias.service.js';
import * as menuItemsService from '../src/modules/menu-items/menu-items.service.js';
import {
  numeroSemanaISO, gruposActivosParaSemana, slugify,
} from '../src/modules/categorias/categorias.service.js';

// Fase E del teardown "la semana es el contenedor": CRUD de categorías + grupos
// (backend), motor de rotación y operaciones sobre celdas (menu-items). Los
// tests que tocan la base commitean, así que cada uno limpia lo que creó.

const categoriasCreadas = [];
const menusCreados = [];

after(async () => {
  for (const id of menusCreados.splice(0)) {
    await query('DELETE FROM menu_semanal_dias WHERE menu_semanal_id = $1', [id]);
    await query('DELETE FROM menus_semanales WHERE id = $1', [id]);
  }
  for (const id of categoriasCreadas.splice(0)) {
    await query('DELETE FROM categorias WHERE id = $1', [id]);
  }
  await pool.end();
});

// ── Motor de rotación (funciones puras) ────────────────────────────────

test('numeroSemanaISO calcula la semana ISO 8601', () => {
  assert.equal(numeroSemanaISO('2026-01-05'), 2, 'lunes 5/1/2026 es semana ISO 2 (par)');
  assert.equal(numeroSemanaISO('2026-01-12'), 3, 'lunes 12/1/2026 es semana ISO 3 (impar)');
});

test('gruposActivosParaSemana respeta siempre/pares/impares', () => {
  const grupos = [
    { id: 1, criterio: 'siempre', ciclo_offset: null, activo: true },
    { id: 2, criterio: 'pares', ciclo_offset: null, activo: true },
    { id: 3, criterio: 'impares', ciclo_offset: null, activo: true },
    { id: 4, criterio: 'siempre', ciclo_offset: null, activo: false }, // inactivo -> nunca
  ];
  const parIds = gruposActivosParaSemana(grupos, '2026-01-05').map((g) => g.id).sort();
  assert.deepEqual(parIds, [1, 2], 'semana par: siempre + pares');
  const imparIds = gruposActivosParaSemana(grupos, '2026-01-12').map((g) => g.id).sort();
  assert.deepEqual(imparIds, [1, 3], 'semana impar: siempre + impares');
});

test('gruposActivosParaSemana rota los grupos "ciclo" por offset desde el ancla', () => {
  const ancla = '2026-01-05';
  const grupos = [
    { id: 10, criterio: 'ciclo', ciclo_offset: 0, activo: true },
    { id: 11, criterio: 'ciclo', ciclo_offset: 1, activo: true },
    { id: 12, criterio: 'ciclo', ciclo_offset: 2, activo: true },
  ];
  assert.deepEqual(gruposActivosParaSemana(grupos, '2026-01-05', ancla).map((g) => g.id), [10], 'semana 0 -> offset 0');
  assert.deepEqual(gruposActivosParaSemana(grupos, '2026-01-12', ancla).map((g) => g.id), [11], 'semana 1 -> offset 1');
  assert.deepEqual(gruposActivosParaSemana(grupos, '2026-01-19', ancla).map((g) => g.id), [12], 'semana 2 -> offset 2');
  assert.deepEqual(gruposActivosParaSemana(grupos, '2026-01-26', ancla).map((g) => g.id), [10], 'semana 3 -> vuelve a offset 0');
  // sin ancla, los 'ciclo' no resuelven
  assert.deepEqual(gruposActivosParaSemana(grupos, '2026-01-05', null), [], 'sin ancla no hay ciclo activo');
});

test('slugify normaliza acentos y espacios', () => {
  assert.equal(slugify('Especiales Semana Santa'), 'especiales-semana-santa');
  assert.equal(slugify('Ñoquis  &  Tartas!'), 'noquis-tartas');
});

// ── CRUD de categorías ──────────────────────────────────────────────────

test('crear categoría custom genera slug único y es_sistema=false', async () => {
  const cat = await categoriasService.crear({ nombre: 'Especiales Semana Santa', alcance: 'recurrente' });
  categoriasCreadas.push(cat.id);
  assert.equal(cat.slug, 'especiales-semana-santa');
  assert.equal(cat.es_sistema, false);
  assert.equal(cat.tipo_dato, 'platos');

  // otra con el mismo nombre -> slug con sufijo -2
  const cat2 = await categoriasService.crear({ nombre: 'Especiales Semana Santa' });
  categoriasCreadas.push(cat2.id);
  assert.equal(cat2.slug, 'especiales-semana-santa-2');
});

test('crear con defaults y actualizar los persiste', async () => {
  const cat = await categoriasService.crear({
    nombre: 'Tartas rotativas',
    defaults: { default_vianda_activa: false, default_disponible_por_kilo: true },
  });
  categoriasCreadas.push(cat.id);
  assert.equal(cat.default_vianda_activa, false);
  assert.equal(cat.default_disponible_por_kilo, true);

  const upd = await categoriasService.actualizar(cat.id, { nombre: 'Tartas', defaults: { default_vianda_activa: true } });
  assert.equal(upd.nombre, 'Tartas');
  assert.equal(upd.default_vianda_activa, true);
});

test('las categorías del sistema no se pueden eliminar', async () => {
  const { rows } = await query("SELECT id FROM categorias WHERE slug = 'especiales'");
  await assert.rejects(
    categoriasService.eliminar(rows[0].id),
    /sistema no se pueden eliminar/i,
  );
});

test('eliminar una categoría custom la borra (los platos no)', async () => {
  const cat = await categoriasService.crear({ nombre: 'Categoria efímera' });
  await categoriasService.eliminar(cat.id);
  const { rows } = await query('SELECT id FROM categorias WHERE id = $1', [cat.id]);
  assert.equal(rows.length, 0, 'la categoría se borró');
});

// ── Duplicar ────────────────────────────────────────────────────────────

test('duplicar clona categoría con sus grupos y platos', async () => {
  const origen = await categoriasService.crear({ nombre: 'Plantilla tartas' });
  categoriasCreadas.push(origen.id);
  const grupo = await categoriasService.crearGrupo(origen.id, { nombre: 'Grupo A', criterio: 'pares' });
  const { rows: platoRows } = await query("SELECT id FROM platos WHERE activo = true ORDER BY id LIMIT 1");
  await categoriasService.agregarPlatoAGrupo(origen.id, grupo.id, platoRows[0].id, 0);

  const copia = await categoriasService.duplicar(origen.id, {});
  categoriasCreadas.push(copia.id);
  assert.notEqual(copia.id, origen.id);
  assert.match(copia.slug, /^plantilla-tartas(-\d+)?$/);
  assert.match(copia.nombre, /copia/i);

  const detalle = await categoriasService.obtenerConDetalle(copia.id);
  assert.equal(detalle.grupos.length, 1, 'el clon tiene el grupo');
  assert.equal(detalle.grupos[0].criterio, 'pares');
  assert.equal(detalle.grupos[0].platos.length, 1, 'el grupo clonado tiene su plato');
});

// ── Grupos ──────────────────────────────────────────────────────────────

test('CRUD de grupos y platos de grupo', async () => {
  const cat = await categoriasService.crear({ nombre: 'Con grupos' });
  categoriasCreadas.push(cat.id);
  const grupo = await categoriasService.crearGrupo(cat.id, { nombre: 'G1', criterio: 'ciclo', ciclo_offset: 0 });
  assert.equal(grupo.criterio, 'ciclo');

  const actualizado = await categoriasService.actualizarGrupo(cat.id, grupo.id, { nombre: 'G1 renombrado' });
  assert.equal(actualizado.nombre, 'G1 renombrado');

  const { rows: platoRows } = await query('SELECT id FROM platos WHERE activo = true ORDER BY id LIMIT 2');
  const platos = await categoriasService.agregarPlatoAGrupo(cat.id, grupo.id, platoRows[0].id, 0);
  assert.equal(platos.length, 1);

  const grupoAjeno = 999999999;
  await assert.rejects(
    categoriasService.actualizarGrupo(cat.id, grupoAjeno, { nombre: 'x' }),
    /no encontrado/i,
  );

  await categoriasService.eliminarGrupo(cat.id, grupo.id);
  const detalle = await categoriasService.obtenerConDetalle(cat.id);
  assert.equal(detalle.grupos.length, 0, 'el grupo se eliminó');
});

// ── menu-items: reasignar categoría y borrar celda ──────────────────────

test('reasignar categoría de una celda y borrarla', async () => {
  // Menú throwaway + una celda (sin materializar fijos, insert directo).
  const { rows: menuRows } = await query(
    `INSERT INTO menus_semanales (nombre, fecha_inicio, fecha_fin, estado)
     VALUES ('fase-e-test menu', '2099-03-02', '2099-03-08', 'borrador') RETURNING id`
  );
  const menuId = menuRows[0].id;
  menusCreados.push(menuId);

  const { rows: platoRows } = await query('SELECT id FROM platos WHERE activo = true ORDER BY id LIMIT 1');
  const { rows: itemRows } = await query(
    `INSERT INTO menu_semanal_dias (menu_semanal_id, dia, opcion, plato_id, categoria_id)
     VALUES ($1, 'lunes', 'Z', $2, NULL) RETURNING id`,
    [menuId, platoRows[0].id]
  );
  const itemId = itemRows[0].id;

  const cat = await categoriasService.crear({ nombre: 'Destino reasignación' });
  categoriasCreadas.push(cat.id);

  // Sin categorizar -> categoría de platos
  const reasignado = await menuItemsService.reasignarCategoria(itemId, cat.id);
  assert.equal(reasignado.categoria_id, cat.id);

  // No se puede asignar a una categoría de guarniciones (tipo_dato != platos)
  const { rows: guarnRows } = await query("SELECT id FROM categorias WHERE slug = 'guarniciones'");
  await assert.rejects(
    menuItemsService.reasignarCategoria(itemId, guarnRows[0].id),
    /tipo "platos"/i,
  );

  // De vuelta a "Sin categorizar"
  const sinCat = await menuItemsService.reasignarCategoria(itemId, null);
  assert.equal(sinCat.categoria_id, null);

  // Borrar la celda
  await menuItemsService.eliminar(itemId);
  const { rows: check } = await query('SELECT id FROM menu_semanal_dias WHERE id = $1', [itemId]);
  assert.equal(check.length, 0, 'la celda se borró');

  await assert.rejects(menuItemsService.eliminar(itemId), /no encontrado/i);
});
