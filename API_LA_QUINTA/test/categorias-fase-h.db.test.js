import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import pool, { query } from '../src/database/connection.js';
import * as categoriasService from '../src/modules/categorias/categorias.service.js';
import { gruposActivosParaSemana, semanaDelMes, materializarRotacionMenu } from '../src/modules/categorias/categorias.service.js';

// Fase H: esquemas de rotación (cada_n, rango_fechas, semana_mes, excepción
// manual) + materialización en menu_semanal_dias.

const categoriasCreadas = [];
let menuId;
let platoId;

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

// ── Motor (funciones puras) ─────────────────────────────────────────────

test('cada_n: cada 2 semanas (cada 15 días) desde el ancla', () => {
  const ancla = '2026-01-05'; // lunes
  const g = [{ id: 1, criterio: 'cada_n', periodo: 2, ciclo_offset: 0, activo: true }];
  assert.equal(gruposActivosParaSemana(g, '2026-01-05', ancla).length, 1, 'semana 0 activa');
  assert.equal(gruposActivosParaSemana(g, '2026-01-12', ancla).length, 0, 'semana 1 inactiva');
  assert.equal(gruposActivosParaSemana(g, '2026-01-19', ancla).length, 1, 'semana 2 activa');
  // offset 1 -> invertido
  const g2 = [{ id: 2, criterio: 'cada_n', periodo: 2, ciclo_offset: 1, activo: true }];
  assert.equal(gruposActivosParaSemana(g2, '2026-01-05', ancla).length, 0);
  assert.equal(gruposActivosParaSemana(g2, '2026-01-12', ancla).length, 1);
});

test('rango_fechas: solo dentro del rango', () => {
  const g = [{ id: 1, criterio: 'rango_fechas', fecha_desde: '2026-04-06', fecha_hasta: '2026-04-12', activo: true }];
  assert.equal(gruposActivosParaSemana(g, '2026-04-06').length, 1, 'semana dentro');
  assert.equal(gruposActivosParaSemana(g, '2026-03-30').length, 0, 'semana antes');
  assert.equal(gruposActivosParaSemana(g, '2026-04-13').length, 0, 'semana después');
});

test('semana_mes: la Nª semana del mes, opcionalmente por meses', () => {
  assert.equal(semanaDelMes('2026-04-06'), 1);
  assert.equal(semanaDelMes('2026-04-13'), 2);
  const g = [{ id: 1, criterio: 'semana_mes', semana_del_mes: 1, meses: null, activo: true }];
  assert.equal(gruposActivosParaSemana(g, '2026-04-06').length, 1, '1ª semana');
  assert.equal(gruposActivosParaSemana(g, '2026-04-13').length, 0, '2ª semana');
  const gMes = [{ id: 1, criterio: 'semana_mes', semana_del_mes: 1, meses: [5], activo: true }];
  assert.equal(gruposActivosParaSemana(gMes, '2026-04-06').length, 0, 'abril no está en meses [5]');
  assert.equal(gruposActivosParaSemana(gMes, '2026-05-04').length, 1, 'mayo sí (y es 1ª semana)');
});

test('excepción manual (forzar) gana sobre el criterio', () => {
  const g = [
    { id: 1, criterio: 'pares', activo: true },
    { id: 2, criterio: 'impares', activo: true },
  ];
  const forzado = gruposActivosParaSemana(g, '2026-01-05', null, 2);
  assert.deepEqual(forzado.map((x) => x.id), [2], 'solo el grupo forzado');
});

// ── Materialización en un menú ──────────────────────────────────────────

test('setup: menú + plato throwaway', async () => {
  const { rows: m } = await query(
    `INSERT INTO menus_semanales (nombre, fecha_inicio, fecha_fin, estado)
     VALUES ('fase-h-test menu', '2099-05-04', '2099-05-10', 'borrador') RETURNING id`
  );
  menuId = m[0].id;
  const { rows: p } = await query("SELECT id FROM platos WHERE activo = true ORDER BY id LIMIT 1");
  platoId = p[0].id;
});

test('materializar rotación inserta los platos del grupo activo con su origen', async () => {
  const cat = await categoriasService.crear({ nombre: 'H Rotativa', defaults: { default_vianda_activa: false } });
  categoriasCreadas.push(cat.id);
  const grupo = await categoriasService.crearGrupo(cat.id, { nombre: 'Grupo Siempre', criterio: 'siempre' });
  await categoriasService.agregarPlatoAGrupo(cat.id, grupo.id, platoId, 0);

  await materializarRotacionMenu(undefined, menuId, '2099-05-04', cat.id);

  const { rows } = await query(
    `SELECT plato_id, dia::text AS dia, origen_categoria_grupo_id
     FROM menu_semanal_dias WHERE menu_semanal_id = $1 AND categoria_id = $2`,
    [menuId, cat.id]
  );
  assert.equal(rows.length, 1, 'se materializó 1 fila');
  assert.equal(rows[0].plato_id, platoId);
  assert.equal(rows[0].dia, null);
  assert.equal(rows[0].origen_categoria_grupo_id, grupo.id);

  // Idempotente: correr de nuevo no duplica.
  await materializarRotacionMenu(undefined, menuId, '2099-05-04', cat.id);
  const { rows: r2 } = await query(
    'SELECT COUNT(*)::int AS c FROM menu_semanal_dias WHERE menu_semanal_id = $1 AND categoria_id = $2',
    [menuId, cat.id]
  );
  assert.equal(r2[0].c, 1, 'no duplica');

  // Des-materializar por origen no toca filas manuales.
  const repo = await import('../src/modules/categorias/categorias.repository.js');
  await repo.desmaterializarRotacion(query, menuId, cat.id);
  const { rows: r3 } = await query(
    'SELECT COUNT(*)::int AS c FROM menu_semanal_dias WHERE menu_semanal_id = $1 AND categoria_id = $2',
    [menuId, cat.id]
  );
  assert.equal(r3[0].c, 0, 'des-materializó');
});
