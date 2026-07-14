#!/usr/bin/env node
/**
 * seed-catalogo-menus.js
 * Carga el dataset generado por build-dataset.mjs (data/out/) a la base:
 *   1. Guarniciones  (upsert por nombre)
 *   2. Platos        (upsert por nombre, con canal/disponibilidad/dia_fijo/guarnicion_modo)
 *   3. Menus semanales + dias, con guarnicion_fija_override_id por celda
 *
 * Requiere haber corrido antes:  node src/database/seeds/build-dataset.mjs
 * Uso:                           node src/database/seeds/seed-catalogo-menus.js
 *
 * NO destruye platos ajenos: solo inserta/actualiza los del dataset.
 * SÍ reemplaza por completo los menus_semanales (DELETE + recreate), igual que el seed original.
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pool, { getClient } from '../connection.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outDir = join(__dirname, 'data', 'out');
const load = (f) => JSON.parse(readFileSync(join(outDir, f), 'utf-8'));

const guarniciones = load('guarniciones.json');
const platos = load('platos.json');
const menus = load('menus.json');

function domingoDe(fechaInicio) {
  const [y, m, d] = fechaInicio.split('-').map(Number);
  const dom = new Date(y, m - 1, d + 6);
  return [dom.getFullYear(), String(dom.getMonth() + 1).padStart(2, '0'), String(dom.getDate()).padStart(2, '0')].join('-');
}
function nombreSemana(fechaInicio) {
  const [y, m, d] = fechaInicio.split('-').map(Number);
  const lun = new Date(y, m - 1, d);
  const dom = new Date(y, m - 1, d + 6);
  const fmt = (dt) => `${dt.getDate()}/${dt.getMonth() + 1}`;
  return `Semana del ${fmt(lun)} al ${fmt(dom)}`;
}
function estadoDe(fechaInicio) {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const [y, m, d] = fechaInicio.split('-').map(Number);
  const domingo = new Date(y, m - 1, d + 6);
  // Semana pasada -> cerrado. Semana actual o futura (menú ya planificado) -> publicado.
  if (hoy > domingo) return 'cerrado';
  return 'publicado';
}

async function seed() {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // ── 1. Guarniciones ──────────────────────────────────────────────────────
    const guarnId = new Map();
    for (const g of guarniciones) {
      const res = await client.query(
        `INSERT INTO guarniciones (nombre, tipo, activo)
         VALUES ($1, $2, true)
         ON CONFLICT (nombre) DO UPDATE SET tipo = EXCLUDED.tipo, activo = true
         RETURNING id`,
        [g.nombre, g.tipo]
      );
      guarnId.set(g.nombre, res.rows[0].id);
    }
    console.log(`✅ ${guarniciones.length} guarniciones`);

    // ── 2. Platos ────────────────────────────────────────────────────────────
    const platoId = new Map();
    for (const p of platos) {
      const res = await client.query(
        `INSERT INTO platos
           (nombre, activo, canal, disponibilidad, dia_fijo, guarnicion_modo, tiene_guarnicion)
         VALUES ($1, true, $2, $3, $4, $5, $6)
         ON CONFLICT (nombre) DO UPDATE SET
           canal = EXCLUDED.canal,
           disponibilidad = EXCLUDED.disponibilidad,
           dia_fijo = EXCLUDED.dia_fijo,
           guarnicion_modo = EXCLUDED.guarnicion_modo,
           tiene_guarnicion = EXCLUDED.tiene_guarnicion,
           activo = true
         RETURNING id`,
        [p.nombre, p.canal, p.disponibilidad, p.dia_fijo, p.guarnicion_modo, p.guarnicion_modo === 'libre']
      );
      platoId.set(p.nombre, res.rows[0].id);
    }
    console.log(`✅ ${platos.length} platos`);

    // ── 3. Menus semanales ───────────────────────────────────────────────────
    // historial_uso_platos es data derivada de menu_semanal_dias: se reconstruye
    // por completo en cada carga para evitar duplicados y filas huérfanas.
    await client.query('DELETE FROM historial_uso_platos');
    const { rowCount } = await client.query('DELETE FROM menus_semanales');
    console.log(`🗑️  ${rowCount} menú(s) anterior(es) eliminado(s)`);

    const ahora = new Date().toISOString();
    for (const sem of menus) {
      const fechaInicio = sem.fecha_inicio;
      const estado = estadoDe(fechaInicio);
      const menuRes = await client.query(
        `INSERT INTO menus_semanales (nombre, fecha_inicio, fecha_fin, estado, publicado_at, cerrado_at)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [
          nombreSemana(fechaInicio), fechaInicio, domingoDe(fechaInicio), estado,
          estado === 'publicado' || estado === 'cerrado' ? ahora : null,
          estado === 'cerrado' ? ahora : null,
        ]
      );
      const menuId = menuRes.rows[0].id;

      for (const dia of sem.feriados) {
        await client.query(
          `INSERT INTO menu_semanal_sin_servicio (menu_semanal_id, dia, motivo)
           VALUES ($1, $2, 'Feriado') ON CONFLICT (menu_semanal_id, dia) DO NOTHING`,
          [menuId, dia]
        );
      }

      for (const [dia, opciones] of Object.entries(sem.dias)) {
        for (const [opcion, cell] of Object.entries(opciones)) {
          const pid = platoId.get(cell.plato);
          if (!pid) throw new Error(`Plato no encontrado en catalogo: ${cell.plato}`);
          const gid = cell.guarnicion ? guarnId.get(cell.guarnicion) : null;
          // Coherencia atómica (plan-eng-review T2): si se pinnea una guarnición
          // por id, se fija también el modo. Antes se seteaba solo el id y el read
          // per-columna lo arrastraba vía COALESCE; con resolución atómica el modo
          // debe acompañar al id o el pin se ignora.
          const gModo = gid ? 'fija' : null;
          await client.query(
            `INSERT INTO menu_semanal_dias
               (menu_semanal_id, dia, opcion, plato_id, guarnicion_modo_override, guarnicion_fija_override_id)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (menu_semanal_id, dia, opcion)
               DO UPDATE SET plato_id = EXCLUDED.plato_id,
                             guarnicion_modo_override = EXCLUDED.guarnicion_modo_override,
                             guarnicion_fija_override_id = EXCLUDED.guarnicion_fija_override_id`,
            [menuId, dia, opcion, pid, gModo, gid]
          );
        }
      }

      // Historial de uso de platos: una fila por día/opción, con fecha_servicio
      // calculada desde fecha_inicio + offset del día (igual que el flujo de la API).
      await client.query(
        `INSERT INTO historial_uso_platos
           (plato_id, plato_nombre_snapshot, menu_semanal_id, dia, opcion, fecha_servicio)
         SELECT msd.plato_id, p.nombre, $1, msd.dia, msd.opcion,
                ($2::date + (CASE msd.dia
                  WHEN 'lunes' THEN 0 WHEN 'martes' THEN 1 WHEN 'miercoles' THEN 2
                  WHEN 'jueves' THEN 3 WHEN 'viernes' THEN 4 WHEN 'sabado' THEN 5
                  WHEN 'domingo' THEN 6 END) * INTERVAL '1 day')::date
         FROM menu_semanal_dias msd
         JOIN platos p ON p.id = msd.plato_id
         WHERE msd.menu_semanal_id = $1`,
        [menuId, fechaInicio]
      );

      console.log(`  ✅ ${nombreSemana(fechaInicio)} (${estado})`);
    }

    await client.query('COMMIT');
    console.log('\n🎉 Seed de catálogo + menús completado.');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error, rollback ejecutado:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => { console.error(err); process.exit(1); });
