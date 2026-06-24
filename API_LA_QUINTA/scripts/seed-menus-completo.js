#!/usr/bin/env node
/**
 * seed-menus-completo.js
 * Lee el CSV histórico, importa las 22 semanas de menú Y registra cada entrada
 * en historial_uso_platos para tener trazabilidad histórica.
 *
 * Extiende seed-menus.js con:
 *   - INSERT en historial_uso_platos (plato_id, plato_nombre_snapshot,
 *     menu_semanal_id, dia, opcion, fecha_servicio)
 *   - ON CONFLICT DO NOTHING en historial
 *
 * Uso: node scripts/seed-menus-completo.js
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pool, { getClient } from '../src/database/connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Fechas de inicio reales (lunes) para cada columna del CSV ─────────────────
const FECHAS_INICIO = [
  '2026-01-26', // sem  1: 26/01
  '2026-02-02', // sem  2: 02/02
  '2026-02-09', // sem  3: 09/02
  '2026-02-16', // sem  4: 16/02  (L+M feriado – Carnaval)
  '2026-02-23', // sem  5: 23/02
  '2026-03-02', // sem  6: 02/03
  '2026-03-09', // sem  7: 09/03
  '2026-03-16', // sem  8: 16/03
  '2026-03-23', // sem  9: 23/03  (L+M feriado – Semana Santa)
  '2026-04-06', // sem 10: 06/04
  '2026-04-13', // sem 11: 13/04
  '2026-04-20', // sem 12: 20/04
  '2026-04-27', // sem 13: 27/04  (V feriado – 1 de Mayo)
  '2026-05-04', // sem 14: 04/05
  '2026-05-11', // sem 15: 11/05
  '2026-05-18', // sem 16: 18/05
  '2026-05-25', // sem 17: 25/05  (L feriado – 25 de Mayo)
  '2026-06-01', // sem 18: 01/06
  '2026-06-08', // sem 19: 08/06
  '2026-06-15', // sem 20: 15/06  (L feriado; CSV dice 16/06 por error)
  '2026-06-22', // sem 21: 22/06
  '2026-06-29', // sem 22: 29/06  (CSV dice 26/06 por error)
];

// ── Mapeo filas CSV → día + offset para fecha_servicio ───────────────────────
// offset: días desde el lunes de la semana (lunes=0, martes=1, ..., viernes=4)
const ROW_MAP = [
  { dia: 'lunes',     opcion: 'A', offset: 0 }, // fila 2
  { dia: 'lunes',     opcion: 'C', offset: 0 }, // fila 3
  { dia: 'martes',    opcion: 'A', offset: 1 }, // fila 4
  { dia: 'martes',    opcion: 'C', offset: 1 }, // fila 5
  { dia: 'miercoles', opcion: 'A', offset: 2 }, // fila 6
  { dia: 'miercoles', opcion: 'C', offset: 2 }, // fila 7
  { dia: 'jueves',    opcion: 'A', offset: 3 }, // fila 8
  { dia: 'jueves',    opcion: 'C', offset: 3 }, // fila 9
  { dia: 'viernes',   opcion: 'A', offset: 4 }, // fila 10
  { dia: 'viernes',   opcion: 'C', offset: 4 }, // fila 11
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function domingoDe(fechaInicio) {
  const [y, m, d] = fechaInicio.split('-').map(Number);
  const dom = new Date(y, m - 1, d + 6);
  return [
    dom.getFullYear(),
    String(dom.getMonth() + 1).padStart(2, '0'),
    String(dom.getDate()).padStart(2, '0'),
  ].join('-');
}

function nombreSemana(fechaInicio) {
  const [y, m, d] = fechaInicio.split('-').map(Number);
  const lun = new Date(y, m - 1, d);
  const dom = new Date(y, m - 1, d + 6);
  const fmt = (dt) => `${dt.getDate()}/${dt.getMonth() + 1}`;
  return `Semana del ${fmt(lun)} al ${fmt(dom)}`;
}

function estadoDe(fechaInicio) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const [y, m, d] = fechaInicio.split('-').map(Number);
  const lunes = new Date(y, m - 1, d);
  const domingo = new Date(y, m - 1, d + 6);
  if (hoy > domingo) return 'cerrado';
  if (hoy >= lunes)  return 'publicado';
  return 'borrador';
}

/**
 * Calcula la fecha de servicio como fecha_inicio + offset días.
 * Retorna string 'YYYY-MM-DD'.
 */
function fechaServicioDe(fechaInicio, offset) {
  const [y, m, d] = fechaInicio.split('-').map(Number);
  const dt = new Date(y, m - 1, d + offset);
  return [
    dt.getFullYear(),
    String(dt.getMonth() + 1).padStart(2, '0'),
    String(dt.getDate()).padStart(2, '0'),
  ].join('-');
}

/** Parsea una celda del CSV: retorna { opcion, nombre } | 'FERIADO' | null */
function parseCelda(celda, defaultOpcion) {
  if (!celda) return null;
  const txt = celda.trim();
  if (!txt) return null;
  if (txt.toUpperCase() === 'FERIADO') return 'FERIADO';

  const match = txt.match(/^([A-Ca-c]):\s*/);
  if (match) {
    const nombre = txt.slice(match[0].length).trim();
    if (!nombre) return null;
    return { opcion: match[1].toUpperCase(), nombre };
  }

  return { opcion: defaultOpcion, nombre: txt };
}

function parseCSV(content) {
  return content
    .split(/\r?\n/)
    .map(line => line.split(','));
}

// ── Seed principal ─────────────────────────────────────────────────────────────

async function seedMenusCompleto() {
  const csvPath = join(__dirname, '../src/database/seeds/menus-historicos.csv');
  const content = readFileSync(csvPath, 'utf-8');
  const rows = parseCSV(content);

  console.log(`CSV cargado: ${rows.length} filas`);
  console.log(`Importando ${FECHAS_INICIO.length} semanas con historial...\n`);

  const client = await getClient();

  // Cache: nombre_normalizado → { id, nombre_canonical }
  const platoCache = new Map();
  let platosNuevos = 0;

  async function getOrCreatePlato(nombre) {
    const key = nombre.toLowerCase().trim();
    if (platoCache.has(key)) return platoCache.get(key);

    // Buscar exacto
    const res = await client.query(
      'SELECT id, nombre FROM platos WHERE LOWER(nombre) = $1 LIMIT 1',
      [key]
    );
    if (res.rows.length > 0) {
      platoCache.set(key, res.rows[0]);
      return res.rows[0];
    }

    // Buscar aproximado
    const res2 = await client.query(
      `SELECT id, nombre FROM platos WHERE LOWER(nombre) ILIKE $1 LIMIT 1`,
      [`%${key.replace(/\s+/g, '%')}%`]
    );
    if (res2.rows.length > 0) {
      platoCache.set(key, res2.rows[0]);
      return res2.rows[0];
    }

    // Crear nuevo
    const inserted = await client.query(
      `INSERT INTO platos (nombre, activo) VALUES ($1, true) RETURNING id, nombre`,
      [nombre.trim()]
    );
    const row = inserted.rows[0];
    platoCache.set(key, row);
    platosNuevos++;
    console.log(`  [nuevo plato] ${row.nombre}`);
    return row;
  }

  try {
    await client.query('BEGIN');

    // Borrar menús existentes (CASCADE elimina menu_semanal_dias y sin_servicio)
    const { rowCount } = await client.query('DELETE FROM menus_semanales');
    console.log(`${rowCount} menú(s) anterior(es) eliminado(s)\n`);

    let totalPlatosImportados = 0;
    let totalHistorialInsertado = 0;

    for (let semIdx = 0; semIdx < FECHAS_INICIO.length; semIdx++) {
      const csvCol = semIdx + 1; // col 0 es el label del día
      const fechaInicio = FECHAS_INICIO[semIdx];
      const fechaFin = domingoDe(fechaInicio);
      const nombre = nombreSemana(fechaInicio);
      const estado = estadoDe(fechaInicio);
      const ahora = new Date().toISOString();

      // Insertar menú semanal
      const menuRes = await client.query(
        `INSERT INTO menus_semanales
           (nombre, fecha_inicio, fecha_fin, estado, publicado_at, cerrado_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [
          nombre,
          fechaInicio,
          fechaFin,
          estado,
          estado === 'publicado' || estado === 'cerrado' ? ahora : null,
          estado === 'cerrado' ? ahora : null,
        ]
      );
      const menuId = menuRes.rows[0].id;

      const feriadosDelDia = new Set();
      let platosImportados = 0;
      let historialInsertado = 0;

      for (let rowOff = 0; rowOff < ROW_MAP.length; rowOff++) {
        const csvRow = rows[rowOff + 1]; // +1 porque row 0 son los headers
        if (!csvRow) continue;

        const celda = csvRow[csvCol];
        const { dia, opcion: defaultOpcion, offset } = ROW_MAP[rowOff];
        const parsed = parseCelda(celda, defaultOpcion);

        if (!parsed) continue;

        if (parsed === 'FERIADO') {
          if (!feriadosDelDia.has(dia)) {
            feriadosDelDia.add(dia);
            await client.query(
              `INSERT INTO menu_semanal_sin_servicio (menu_semanal_id, dia, motivo)
               VALUES ($1, $2, 'Feriado')
               ON CONFLICT (menu_semanal_id, dia) DO NOTHING`,
              [menuId, dia]
            );
          }
          continue;
        }

        // Obtener o crear el plato
        const plato = await getOrCreatePlato(parsed.nombre);
        const platoId = plato.id;
        const platoNombreSnapshot = plato.nombre;

        // Insertar en menu_semanal_dias
        await client.query(
          `INSERT INTO menu_semanal_dias (menu_semanal_id, dia, opcion, plato_id)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (menu_semanal_id, dia, opcion) DO UPDATE SET plato_id = EXCLUDED.plato_id`,
          [menuId, dia, parsed.opcion, platoId]
        );
        platosImportados++;

        // Insertar en historial_uso_platos
        const fechaServicio = fechaServicioDe(fechaInicio, offset);
        const histRes = await client.query(
          `INSERT INTO historial_uso_platos
             (plato_id, plato_nombre_snapshot, menu_semanal_id, dia, opcion, fecha_servicio)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT DO NOTHING`,
          [platoId, platoNombreSnapshot, menuId, dia, parsed.opcion, fechaServicio]
        );
        historialInsertado += histRes.rowCount ?? 1;
      }

      totalPlatosImportados += platosImportados;
      totalHistorialInsertado += historialInsertado;

      const feriadosStr = feriadosDelDia.size > 0
        ? ` [${[...feriadosDelDia].join(', ')} feriado]`
        : '';
      console.log(
        `  OK: ${nombre} (${estado}) — ${platosImportados} platos, ${historialInsertado} historial${feriadosStr}`
      );
    }

    await client.query('COMMIT');

    console.log('\n=== Seed completado ===');
    console.log(`  ${FECHAS_INICIO.length} semanas importadas`);
    console.log(`  ${totalPlatosImportados} entradas en menu_semanal_dias`);
    console.log(`  ${totalHistorialInsertado} entradas en historial_uso_platos`);
    console.log(`  ${platosNuevos} platos nuevos creados en DB`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error en seed, rollback ejecutado:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seedMenusCompleto().catch(err => {
  console.error(err);
  process.exit(1);
});
