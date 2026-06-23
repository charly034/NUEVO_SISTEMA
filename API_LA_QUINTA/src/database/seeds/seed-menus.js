#!/usr/bin/env node
/**
 * seed-menus.js
 * Lee el CSV histórico de menús semanales, borra todos los menús existentes
 * e importa las 22 semanas con platos y días sin servicio.
 *
 * Uso: node src/database/seeds/seed-menus.js
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pool, { getClient } from '../connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Fechas de inicio reales (lunes) para cada columna del CSV ────────────────
// Se corrigen los errores tipográficos del CSV (ej: semana 20 dice 16/06 pero
// el lunes correcto es 15/06; semana 22 dice 26/06 pero el lunes es 29/06).
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

// ── Mapeo filas CSV → día + opción por defecto ────────────────────────────────
// El CSV tiene 10 filas de datos (filas 2-11, ignorando la fila 1 de headers):
const ROW_MAP = [
  { dia: 'lunes',     opcion: 'A' }, // fila 2
  { dia: 'lunes',     opcion: 'C' }, // fila 3
  { dia: 'martes',    opcion: 'A' }, // fila 4
  { dia: 'martes',    opcion: 'C' }, // fila 5
  { dia: 'miercoles', opcion: 'A' }, // fila 6
  { dia: 'miercoles', opcion: 'C' }, // fila 7
  { dia: 'jueves',    opcion: 'A' }, // fila 8
  { dia: 'jueves',    opcion: 'C' }, // fila 9
  { dia: 'viernes',   opcion: 'A' }, // fila 10
  { dia: 'viernes',   opcion: 'C' }, // fila 11
];

// ── Helpers ────────────────────────────────────────────────────────────────────

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

// Parsea una celda del CSV y devuelve { opcion, nombre } o 'FERIADO' o null
function parseCelda(celda, defaultOpcion) {
  if (!celda) return null;
  const txt = celda.trim();
  if (!txt) return null;
  if (txt.toUpperCase() === 'FERIADO' || txt.toLowerCase() === 'feriado') return 'FERIADO';

  // Prefijo "A:", "B:", "C:", etc. (con o sin espacio)
  const match = txt.match(/^([A-Ca-c]):\s*/);
  if (match) {
    const nombre = txt.slice(match[0].length).trim();
    if (!nombre) return null;
    return { opcion: match[1].toUpperCase(), nombre };
  }

  // Sin prefijo: usa la opción por defecto de la fila
  return { opcion: defaultOpcion, nombre: txt };
}

// Parseo simple de CSV (los nombres de platos no tienen comas)
function parseCSV(content) {
  return content
    .split(/\r?\n/)
    .map(line => line.split(','));
}

// ── Seed principal ─────────────────────────────────────────────────────────────

async function seedMenus() {
  const csvPath = join(__dirname, 'menus-historicos.csv');
  const content = readFileSync(csvPath, 'utf-8');
  const rows = parseCSV(content);

  console.log(`\n📄 CSV cargado: ${rows.length} filas`);
  console.log(`📅 Importando ${FECHAS_INICIO.length} semanas...\n`);

  const client = await getClient();

  try {
    await client.query('BEGIN');

    // ── 1. Borrar todos los menús existentes (CASCADE a días y sin_servicio) ──
    const { rowCount } = await client.query('DELETE FROM menus_semanales');
    console.log(`🗑️  ${rowCount} menú(s) anterior(es) eliminado(s)`);

    // ── 2. Cache de platos: nombre_normalizado → id ──────────────────────────
    const platoCache = new Map();
    let platosNuevos = 0;
    const platosNoEncontrados = [];

    async function getOrCreatePlato(nombre) {
      const key = nombre.toLowerCase().trim();
      if (platoCache.has(key)) return platoCache.get(key);

      // Buscar por nombre exacto (insensible a mayúsculas)
      const res = await client.query(
        'SELECT id FROM platos WHERE LOWER(nombre) = $1 LIMIT 1',
        [key]
      );

      if (res.rows.length > 0) {
        platoCache.set(key, res.rows[0].id);
        return res.rows[0].id;
      }

      // Buscar de forma aproximada (ILIKE con espacios extra, tildes, etc.)
      const res2 = await client.query(
        'SELECT id, nombre FROM platos WHERE LOWER(nombre) ILIKE $1 LIMIT 1',
        [`%${key.replace(/\s+/g, '%')}%`]
      );

      if (res2.rows.length > 0) {
        platoCache.set(key, res2.rows[0].id);
        return res2.rows[0].id;
      }

      // Crear el plato nuevo
      const inserted = await client.query(
        'INSERT INTO platos (nombre, activo) VALUES ($1, true) RETURNING id',
        [nombre.trim()]
      );
      const id = inserted.rows[0].id;
      platoCache.set(key, id);
      platosNuevos++;
      return id;
    }

    // ── 3. Importar cada semana ──────────────────────────────────────────────
    for (let semIdx = 0; semIdx < FECHAS_INICIO.length; semIdx++) {
      const csvCol = semIdx + 1; // col 0 es el label del día
      const fechaInicio = FECHAS_INICIO[semIdx];
      const fechaFin = domingoDe(fechaInicio);
      const nombre = nombreSemana(fechaInicio);
      const estado = estadoDe(fechaInicio);

      const ahora = new Date().toISOString();
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

      // Track feriados para no duplicar
      const feriadosDelDia = new Set();
      let platosImportados = 0;

      // Recorrer las 10 filas de datos (rows[1] a rows[10])
      for (let rowOff = 0; rowOff < ROW_MAP.length; rowOff++) {
        const csvRow = rows[rowOff + 1]; // +1 porque row 0 son los headers
        if (!csvRow) continue;

        const celda = csvRow[csvCol];
        const { dia, opcion: defaultOpcion } = ROW_MAP[rowOff];
        const parsed = parseCelda(celda, defaultOpcion);

        if (!parsed) continue;

        if (parsed === 'FERIADO') {
          // Insertar sin_servicio una vez por día (solo cuando se encuentra por primera vez)
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

        const platoId = await getOrCreatePlato(parsed.nombre);

        await client.query(
          `INSERT INTO menu_semanal_dias (menu_semanal_id, dia, opcion, plato_id)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (menu_semanal_id, dia, opcion) DO UPDATE SET plato_id = EXCLUDED.plato_id`,
          [menuId, dia, parsed.opcion, platoId]
        );
        platosImportados++;
      }

      const feriadosStr = feriadosDelDia.size > 0
        ? ` [${[...feriadosDelDia].join(', ')} feriado]`
        : '';
      console.log(`  ✅ ${nombre} (${estado}) — ${platosImportados} platos${feriadosStr}`);
    }

    await client.query('COMMIT');

    console.log(`\n🎉 Seed completado:`);
    console.log(`   ${FECHAS_INICIO.length} semanas importadas`);
    console.log(`   ${platosNuevos} platos nuevos creados`);
    if (platosNoEncontrados.length > 0) {
      console.log(`\n⚠️  Platos sin coincidencia en DB (creados como nuevos):`);
      platosNoEncontrados.forEach(n => console.log(`   - ${n}`));
    }

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error en seed, rollback ejecutado:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seedMenus().catch(err => {
  console.error(err);
  process.exit(1);
});
