import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import pool, { query } from '../src/database/connection.js';
import * as categoriasService from '../src/modules/categorias/categorias.service.js';
import * as menuItemsService from '../src/modules/menu-items/menu-items.service.js';

// Fase G+: agregar platos a una categoría desde la tabla (POST /menu-items ->
// menuItemsService.agregar) y unicidad de opción POR CATEGORÍA (migración
// 1719000077000). Commitea, así que limpia lo que crea.

const categoriasCreadas = [];
let menuId;
let platoId;
let platoId2;

after(async () => {
  if (menuId) {
    await query('DELETE FROM menu_semanal_dias WHERE menu_semanal_id = $1', [menuId]);
    await query('DELETE FROM menus_semanales WHERE id = $1', [menuId]);
  }
  for (const id of categoriasCreadas.splice(0)) {
    await query('DELETE FROM categorias WHERE id = $1', [id]);
  }
  await pool.end();
});

test('setup: menú y plato throwaway', async () => {
  const { rows: m } = await query(
    `INSERT INTO menus_semanales (nombre, fecha_inicio, fecha_fin, estado)
     VALUES ('fase-g-test menu', '2099-04-06', '2099-04-12', 'borrador') RETURNING id`
  );
  menuId = m[0].id;
  const { rows: p } = await query("SELECT id FROM platos WHERE activo = true ORDER BY id LIMIT 2");
  platoId = p[0].id;
  platoId2 = p[1].id;
});

test('agregar plato a una categoría custom (lista sin opción) inserta la celda', async () => {
  const cat = await categoriasService.crear({ nombre: 'G Lista', defaults: { default_vianda_activa: false } });
  categoriasCreadas.push(cat.id);

  const item = await menuItemsService.agregar({ menu_semanal_id: menuId, categoria_id: cat.id, plato_id: platoId, dia: 'lunes' });
  assert.equal(item.categoria_id, cat.id);
  assert.equal(item.dia, 'lunes');
  assert.equal(item.opcion, null);

  // Una lista sin letra admite varios platos DISTINTOS el mismo día (el índice
  // de fijos impide repetir el MISMO plato el mismo día dentro de la categoría).
  const item2 = await menuItemsService.agregar({ menu_semanal_id: menuId, categoria_id: cat.id, plato_id: platoId2, dia: 'lunes' });
  assert.notEqual(item2.id, item.id);

  // Repetir el mismo plato el mismo día en la categoría: rechazado.
  await assert.rejects(
    menuItemsService.agregar({ menu_semanal_id: menuId, categoria_id: cat.id, plato_id: platoId, dia: 'lunes' }),
    /ya hay un plato en esa celda/i,
  );
});

test('opción es única POR categoría, no global', async () => {
  const catA = await categoriasService.crear({ nombre: 'G Matriz A', usa_opcion: true, defaults: { default_vianda_activa: false } });
  const catB = await categoriasService.crear({ nombre: 'G Matriz B', usa_opcion: true, defaults: { default_vianda_activa: false } });
  categoriasCreadas.push(catA.id, catB.id);

  // Misma (dia, opcion) en DOS categorías distintas: permitido.
  await menuItemsService.agregar({ menu_semanal_id: menuId, categoria_id: catA.id, plato_id: platoId, dia: 'martes', opcion: 'A' });
  await menuItemsService.agregar({ menu_semanal_id: menuId, categoria_id: catB.id, plato_id: platoId, dia: 'martes', opcion: 'A' });

  // Repetir la misma (categoria, dia, opcion): 409.
  await assert.rejects(
    menuItemsService.agregar({ menu_semanal_id: menuId, categoria_id: catA.id, plato_id: platoId, dia: 'martes', opcion: 'A' }),
    /ya hay un plato en esa celda/i,
  );
});

test('no se puede agregar a una categoría que no es de platos', async () => {
  const { rows } = await query("SELECT id FROM categorias WHERE slug = 'guarniciones'");
  await assert.rejects(
    menuItemsService.agregar({ menu_semanal_id: menuId, categoria_id: rows[0].id, plato_id: platoId, dia: 'lunes' }),
    /tipo "platos"/i,
  );
});

test('crear categoría la ubica al final (orden = max+1)', async () => {
  const maxAntes = (await query('SELECT MAX(orden) AS m FROM categorias')).rows[0].m;
  const cat = await categoriasService.crear({ nombre: 'G Orden' });
  categoriasCreadas.push(cat.id);
  assert.equal(cat.orden, Number(maxAntes) + 1, 'la categoría nueva queda al final');
});
