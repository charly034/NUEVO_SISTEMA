#!/usr/bin/env node
/**
 * backfill-vianda-anchors.js
 *
 * Ancla vianda_id (especiales) y menu_semanal_fijos_vianda (fijos) para
 * datos ya existentes que quedaron sin vianda por semana -- creados antes
 * del rediseño "vianda es una decisión por semana, no del catálogo" hecho
 * en sesión 2026-07-13. Hallazgo real: 222 de 223 especiales en menús
 * publicados/cerrados no tenían vianda anclada (los seeds de menús nunca
 * la seteaban), y solo 2 semanas tenían algún fijo anclado por semana.
 * Aplicar el filtro de visibilidad de empresas por vianda_activa sin este
 * backfill vaciaría de golpe el menú publicado real de la semana actual.
 *
 * No destructivo: solo agrega vianda_id/anclajes faltantes, nunca borra ni
 * pisa una vianda ya elegida a mano. Crea una vianda general (sin
 * guarnición/salsa, igual que el auto-anclaje de agregarPlatoDia) para
 * cualquier plato que todavía no tenga ninguna.
 *
 * Uso: node scripts/backfill-vianda-anchors.js
 */

import pool, { getClient } from '../src/database/connection.js';

async function obtenerOCrearViandaGeneral(client, platoId, cache) {
  if (cache.has(platoId)) return cache.get(platoId);

  const existente = await client.query(
    'SELECT id FROM viandas WHERE plato_id = $1 AND empresa_id IS NULL AND activo = true LIMIT 1',
    [platoId]
  );
  let viandaId;
  if (existente.rows.length > 0) {
    viandaId = existente.rows[0].id;
  } else {
    const inserted = await client.query(
      'INSERT INTO viandas (plato_id, activo) VALUES ($1, true) RETURNING id',
      [platoId]
    );
    viandaId = inserted.rows[0].id;
  }
  cache.set(platoId, viandaId);
  return viandaId;
}

async function backfill() {
  const client = await getClient();
  const cacheViandas = new Map();

  try {
    await client.query('BEGIN');

    // ── 1. Especiales sin vianda anclada esta semana ──────────────────────
    const { rows: sinVianda } = await client.query(
      'SELECT id, plato_id FROM menu_semanal_dias WHERE vianda_id IS NULL'
    );
    console.log(`\n📋 ${sinVianda.length} especial(es) sin vianda anclada`);

    let especialesAnclados = 0;
    for (const row of sinVianda) {
      const viandaId = await obtenerOCrearViandaGeneral(client, row.plato_id, cacheViandas);
      await client.query('UPDATE menu_semanal_dias SET vianda_id = $1 WHERE id = $2', [viandaId, row.id]);
      especialesAnclados++;
    }
    console.log(`✅ ${especialesAnclados} especial(es) anclado(s)`);

    // ── 2. Fijos: anclar por (menu_semanal_id, plato_id) -- sin distinción
    // de día, mismo modelo que menu_semanal_fijos_vianda ya usa ────────────
    const { rows: menus } = await client.query('SELECT id FROM menus_semanales');
    const { rows: fijos } = await client.query(
      `SELECT id AS plato_id FROM platos
       WHERE activo = true AND (tipo = 'fijo' OR disponibilidad IN ('fijo_dia', 'siempre'))`
    );
    console.log(`\n📋 ${menus.length} menú(s) semanal(es) × ${fijos.length} plato(s) fijo(s) a revisar`);

    let fijosAnclados = 0;
    for (const menu of menus) {
      for (const fijo of fijos) {
        const viandaId = await obtenerOCrearViandaGeneral(client, fijo.plato_id, cacheViandas);
        const res = await client.query(
          `INSERT INTO menu_semanal_fijos_vianda (menu_semanal_id, plato_id, vianda_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (menu_semanal_id, plato_id) DO NOTHING
           RETURNING id`,
          [menu.id, fijo.plato_id, viandaId]
        );
        if (res.rowCount > 0) fijosAnclados++;
      }
    }
    console.log(`✅ ${fijosAnclados} anclaje(s) de fijo(s) creado(s)`);

    await client.query('COMMIT');
    console.log(`\n🎉 Backfill completo — ${cacheViandas.size} vianda(s) general(es) usadas/creadas en el proceso`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Error, rollback ejecutado:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

backfill().catch((err) => {
  console.error(err);
  process.exit(1);
});
