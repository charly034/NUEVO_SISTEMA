import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import pool, { query } from '../src/database/connection.js';
import { createMenuSemanal, duplicarMenuSemanal } from '../src/modules/menus-semanales/menus-semanales.service.js';

// Fase C del teardown "la semana es el contenedor": prueba de SEEDING. El
// invariante que hace seguro leer los fijos desde menu_semanal_dias (en vez del
// catalogo) es "todo menu tiene sus fijos materializados". Aca se verifica que
// el service lo garantiza EN LOS DOS caminos que crean menus:
//   - createMenuSemanal  -> siembra fijos frescos del catalogo
//   - duplicarMenuSemanal -> copia especiales + siembra fijos frescos
//
// A diferencia del test de paridad (que corre todo en una transaccion revertida),
// el service COMMITEA a la base, asi que cada caso limpia lo que creo. Se usan
// fechas lejanas (2099) y un prefijo distintivo para no chocar con menus reales.

const PREFIJO = 'seedtest-fase-c';
// adminUser minimo: adminActor() lo lee para armar el snapshot de auditoria.
// En uso real lo provee el controller; aca hay que pasarlo o adminActor rompe.
const ADMIN = { email: 'seed-test@laquinta.local', rol: 'admin' };
const menusCreados = [];

async function limpiar() {
  for (const id of menusCreados.splice(0)) {
    // desmaterializar + borrar sus filas y el menu (orden seguro por FKs)
    await query('DELETE FROM menu_semanal_dias WHERE menu_semanal_id = $1', [id]);
    await query('DELETE FROM menu_semanal_sin_servicio WHERE menu_semanal_id = $1', [id]);
    await query('DELETE FROM historial_uso_platos WHERE menu_semanal_id = $1', [id]);
    await query(
      "DELETE FROM admin_auditoria WHERE entidad_tipo = 'menu_semanal' AND entidad_id = $1",
      [id]
    );
    await query('DELETE FROM menus_semanales WHERE id = $1', [id]);
  }
}

after(async () => {
  await limpiar();
  await pool.end();
});

// Cuenta de fijos esperados segun el catalogo (misma regla de materializacion).
async function fijosEsperadosCatalogo() {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS c
     FROM platos
     WHERE activo = true
       AND (tipo = 'fijo' OR disponibilidad IN ('fijo_dia', 'siempre'))`
  );
  return rows[0].c;
}

async function contarFijosMaterializados(menuId) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS c
     FROM menu_semanal_dias msd
     JOIN categorias c ON c.id = msd.categoria_id
     WHERE msd.menu_semanal_id = $1
       AND msd.opcion IS NULL
       AND c.slug IN ('fijos-x-dia', 'fijos-de-siempre')`,
    [menuId]
  );
  return rows[0].c;
}

test('createMenuSemanal siembra los fijos del catalogo con su categoria', async () => {
  const esperados = await fijosEsperadosCatalogo();
  assert.ok(esperados > 0, 'el catalogo debe tener fijos para sembrar');

  const menu = await createMenuSemanal({
    nombre: `${PREFIJO} crear`,
    fecha_inicio: '2099-01-05',
    fecha_fin: '2099-01-11',
  }, null, ADMIN);
  menusCreados.push(menu.id);

  const materializados = await contarFijosMaterializados(menu.id);
  assert.equal(
    materializados,
    esperados,
    `el menu creado debe materializar los ${esperados} fijos del catalogo, dio ${materializados}`
  );

  // Ningun fijo materializado debe quedar sin categoria (romperia el read nuevo).
  const { rows: huerfanos } = await query(
    `SELECT COUNT(*)::int AS c FROM menu_semanal_dias
     WHERE menu_semanal_id = $1 AND opcion IS NULL AND categoria_id IS NULL`,
    [menu.id]
  );
  assert.equal(huerfanos[0].c, 0, 'no debe haber fijos sin categoria_id');
});

test('duplicarMenuSemanal copia especiales y siembra fijos frescos del catalogo', async () => {
  // Origen: un menu real cualquiera (tiene especiales + fijos ya materializados).
  const { rows: origenRows } = await query(
    `SELECT id FROM menus_semanales
     WHERE nombre NOT LIKE $1 AND nombre NOT LIKE 'itp%'
     ORDER BY id LIMIT 1`,
    [`${PREFIJO}%`]
  );
  const origenId = origenRows[0].id;

  const { rows: espOrigen } = await query(
    `SELECT COUNT(*)::int AS c FROM menu_semanal_dias
     WHERE menu_semanal_id = $1 AND opcion IS NOT NULL`,
    [origenId]
  );

  const dup = await duplicarMenuSemanal(origenId, {
    nombre: `${PREFIJO} duplicado`,
    fecha_inicio: '2099-02-02',
    fecha_fin: '2099-02-08',
  }, ADMIN);
  menusCreados.push(dup.id);

  // Fijos: sembrados frescos, no copiados -> deben coincidir con el catalogo.
  const esperados = await fijosEsperadosCatalogo();
  const materializados = await contarFijosMaterializados(dup.id);
  assert.equal(materializados, esperados, `el duplicado debe materializar ${esperados} fijos, dio ${materializados}`);

  // Especiales: copiados del origen (mismo conteo).
  const { rows: espDup } = await query(
    `SELECT COUNT(*)::int AS c FROM menu_semanal_dias
     WHERE menu_semanal_id = $1 AND opcion IS NOT NULL`,
    [dup.id]
  );
  assert.equal(
    espDup[0].c,
    espOrigen[0].c,
    `el duplicado debe copiar los ${espOrigen[0].c} especiales del origen, dio ${espDup[0].c}`
  );
});
