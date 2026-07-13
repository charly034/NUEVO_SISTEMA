/**
 * Script de importación de menús desde CSV histórico.
 *
 * Uso:
 *   node scripts/import-menus-csv.js <ruta-al-csv>
 *
 * Ejemplo:
 *   node scripts/import-menus-csv.js "C:/Users/charl/OneDrive/Escritorio/MENUS SEMANALES - Hoja 1.csv"
 *
 * Qué hace:
 *   1. Borra todos los menús semanales existentes (menus_semanales, dias, sin_servicio).
 *   2. NO borra los platos ya existentes.
 *   3. Crea o reutiliza platos por nombre exacto (ignorando mayúsculas).
 *   4. Crea cada semana del CSV con sus días, opciones A y C, y feriados.
 *
 * Estructura del CSV:
 *   Fila 0 → encabezados con el rango de fechas de cada semana
 *   Filas en pares por día:
 *     fila impar  → opción A del día (col 0 = nombre del día)
 *     fila par    → opción C del día (col 0 vacío)
 *   Días en orden: LUNES, MARTES, MIERCOLES, JUEVES, VIERNES
 *   Celda "FERIADO" → marca ese día como sin servicio
 */

import pg from 'pg';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import 'dotenv/config';
import {
  FECHAS_INICIO_MENUS_HISTORICOS,
  canonicalizarNombrePlato,
  estadoMenuHistorico,
  fechaFinSemanaHistorica,
  nombreSemanaHistorica,
  normalizarClave,
} from './menu-normalizacion.js';
import { actualizarMetadataPlatos } from './backfill-platos-metadata-aproximada.js';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// ── Parser CSV manual (sin dependencias extra) ───────────────────
function parseCSV(content) {
  const rows = [];
  const lines = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');

  for (const line of lines) {
    const cols = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes) {
        cols.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    cols.push(current.trim());
    rows.push(cols);
  }

  return rows;
}

// ── Parsear fecha "26/01" o "26 /01" con año fijo ───────────────
function parseDate(str, year = 2026) {
  const clean = str.replace(/\s/g, '');
  const match = clean.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!match) return null;
  const d = match[1].padStart(2, '0');
  const m = match[2].padStart(2, '0');
  return `${year}-${m}-${d}`;
}

// ── Extraer fechas del encabezado de semana ─────────────────────
// Soporta: "🗓️ SEMANA 26/01 al 30/01", "Semana del 2/3 al 7 /3", etc.
function parsearEncabezadoSemana(header) {
  // Extraer todos los patrones dd/mm o d/m (con posibles espacios)
  const matches = [...header.matchAll(/(\d{1,2}\s*\/\s*\d{1,2})/g)];
  if (matches.length < 2) return null;

  const inicio = parseDate(matches[0][1]);
  const fin    = parseDate(matches[1][1]);
  if (!inicio || !fin) return null;

  return { inicio, fin };
}

// ── Limpiar prefijo "A: " o "C: " del nombre del plato ──────────
function limpiarNombre(str) {
  if (!str) return '';
  return str.replace(/^[A-Za-z]:\s*/u, '').trim();
}

// ── Normalizar nombre para comparar (sin mayúsculas/tildes extra) ─
function normalizar(str) {
  return normalizarClave(str);
}

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];

// ── Inferir tags a partir del nombre del plato ───────────────────
// Reglas aditivas: un plato puede tener varios tags.
// "Vegetariano" se asigna cuando no aparece ninguna proteína animal.
function inferirTags(nombre) {
  const n = nombre.toLowerCase();
  const tags = new Set();

  // Proteínas animales
  if (/pollo|pata\s*muslo|alita/.test(n))                              tags.add('Pollo');
  if (/\bcarne\b|bife|ternera|albóndiga|albondiga|hígado|higado|mondongo|costillar/.test(n)) tags.add('Carnes');
  if (/cerdo|costeleta/.test(n))                                        tags.add('Cerdo');
  if (/merluza|calamar|atún|atun|\bpescado\b|mariscos|camarón/.test(n)) tags.add('Pescado');

  // Vegetariano: ninguna proteína animal detectada
  const proteínaAnimal = [
    'pollo', 'pata muslo', 'alita',
    'carne', 'bife', 'ternera', 'albondiga', 'albóndiga', 'hígado', 'higado', 'mondongo', 'costillar',
    'cerdo', 'costeleta',
    'merluza', 'calamar', 'atun', 'atún', 'pescado', 'mariscos',
    'jamon', 'jamón', 'jyq',   // JyQ = Jamón y Queso
  ];
  if (!proteínaAnimal.some((k) => n.includes(k))) tags.add('Vegetariano');

  // Tipo de preparación / ingrediente base
  if (/ravioles?|canel[oó]n|lasaña|lasagna|ñoquis?|fett?uchini|tallarin|spaguetti|spaghetti|sorrentino|rotolo|polenta/.test(n)) tags.add('Pasta');
  if (/\barroz\b|risotto/.test(n))                 tags.add('Arroz');
  if (/guiso|estofado|puchero/.test(n))            tags.add('Guisos');
  if (/ensalada|salpic[oó]n|c[eé]sar/.test(n))    tags.add('Ensaladas');
  if (/\bwok\b/.test(n))                           tags.add('Wok');
  if (/tarta|souffl/.test(n))                      tags.add('Tartas');
  if (/\btortilla\b/.test(n))                      tags.add('Tartas');
  if (/milanesa/.test(n))                          tags.add('Milanesas');
  if (/hamburguesa/.test(n))                       tags.add('Hamburguesas');
  if (/lentejas|garbanzos|legumbres/.test(n))      tags.add('Legumbres');
  if (/pizza|focaccia/.test(n))                    tags.add('Pizza');
  if (/tacos/.test(n))                             tags.add('Tacos');
  if (/pastel\s*de\s*papa|pastel\s*de\s*camote|budín|budin/.test(n)) tags.add('Gratinados');

  return [...tags];
}

// ── Main ─────────────────────────────────────────────────────────
async function main() {
  const rutaCSV = process.argv[2] ?? resolve(new URL('.', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'), 'menus-historicos.csv').replace(/%20/g, ' ');
  console.log(`📂  Leyendo: ${rutaCSV}`);

  const csvContent = readFileSync(resolve(rutaCSV), 'utf-8');
  const rows = parseCSV(csvContent);

  if (rows.length < 2) {
    console.error('❌  El CSV está vacío o mal formateado.');
    process.exit(1);
  }

  const encabezados = rows[0]; // fila 0: nombres de semanas
  const filasDatos  = rows.slice(1); // filas 1-10: datos

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1 ── Limpiar datos existentes
    await client.query('DELETE FROM historial_uso_platos');
    const { rowCount: menusEliminados } = await client.query('DELETE FROM menus_semanales');
    console.log(`🗑️  ${menusEliminados} menú(s) existente(s) eliminado(s).`);

    // 2 ── Cache de platos (nombre normalizado → id)
    const platosExistentes = await client.query('SELECT id, nombre FROM platos');
    const cachePlatos = new Map();
    for (const row of platosExistentes.rows) {
      cachePlatos.set(normalizar(row.nombre), row.id);
    }

    // Vianda "general" (sin guarnicion/salsa) por plato -- especiales se
    // ofrecen como vianda por defecto (decision 2026-07-13, mismo criterio
    // que agregarPlatoDia en vivo), asi que cada fila de menu_semanal_dias
    // que este script crea arranca con vianda_id seteado. Sin esto, un
    // reseed completo volveria a dejar todos los especiales sin vianda
    // anclada (hallazgo real: 222 de 223 en produccion antes del backfill
    // de scripts/backfill-vianda-anchors.js).
    const cacheViandas = new Map();
    async function obtenerOCrearViandaGeneral(platoId) {
      if (cacheViandas.has(platoId)) return cacheViandas.get(platoId);
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
      cacheViandas.set(platoId, viandaId);
      return viandaId;
    }

    async function obtenerOCrearPlato(nombre) {
      const nombreCanonico = canonicalizarNombrePlato(nombre);
      const key = normalizar(nombreCanonico);
      if (cachePlatos.has(key)) return cachePlatos.get(key);

      const tags = inferirTags(nombreCanonico);

      const { rows: ins } = await client.query(
        `INSERT INTO platos (nombre, activo, tags)
         VALUES ($1, true, $2)
         ON CONFLICT DO NOTHING
         RETURNING id`,
        [nombreCanonico, tags]
      );

      if (ins.length > 0) {
        cachePlatos.set(key, ins[0].id);
        return ins[0].id;
      }

      // Si ya existía, actualizar sus tags si los tiene vacíos
      const { rows: found } = await client.query('SELECT id, nombre, tags FROM platos');
      const plato = found.find((row) => normalizar(row.nombre) === key);
      if (!plato) {
        throw new Error(`No se pudo resolver el plato "${nombreCanonico}" luego del INSERT`);
      }
      if (plato.tags.length === 0 && tags.length > 0) {
        await client.query('UPDATE platos SET tags = $1 WHERE id = $2', [tags, plato.id]);
      }
      cachePlatos.set(key, plato.id);
      return plato.id;
    }

    // Actualizar tags en platos existentes que no tienen ninguno
    const { rows: platosVacios } = await client.query(
      `SELECT id, nombre FROM platos WHERE array_length(tags, 1) IS NULL OR array_length(tags, 1) = 0`
    );
    let platosActualizados = 0;
    for (const p of platosVacios) {
      const tags = inferirTags(p.nombre);
      if (tags.length > 0) {
        await client.query('UPDATE platos SET tags = $1 WHERE id = $2', [tags, p.id]);
        platosActualizados++;
      }
    }
    if (platosActualizados > 0) {
      console.log(`🏷️  ${platosActualizados} plato(s) existente(s) actualizado(s) con tags.`);
    }

    // 3 ── Procesar cada columna de semana
    let semanasImportadas = 0;
    let platosNuevos = 0;
    const platosAntesCount = cachePlatos.size;

    for (let col = 1; col < encabezados.length; col++) {
      const encabezado = encabezados[col];
      if (!encabezado || !encabezado.trim()) continue;

      const fechaInicioHistorica = FECHAS_INICIO_MENUS_HISTORICOS[col - 1];
      const fechas = fechaInicioHistorica
        ? { inicio: fechaInicioHistorica, fin: fechaFinSemanaHistorica(fechaInicioHistorica) }
        : parsearEncabezadoSemana(encabezado);
      if (!fechas) {
        console.warn(`⚠️  Columna ${col}: no se pudo parsear la fecha "${encabezado}" — omitida.`);
        continue;
      }

      const nombre = nombreSemanaHistorica(fechas.inicio);
      const estado = estadoMenuHistorico(fechas.inicio);
      const ahora = new Date().toISOString();

      const { rows: menuIns } = await client.query(
        `INSERT INTO menus_semanales (nombre, fecha_inicio, fecha_fin, estado, publicado_at, cerrado_at)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [
          nombre,
          fechas.inicio,
          fechas.fin,
          estado,
          estado === 'publicado' || estado === 'cerrado' ? ahora : null,
          estado === 'cerrado' ? ahora : null,
        ]
      );
      const menuId = menuIns[0].id;
      semanasImportadas++;

      // Para cada día (par de filas)
      for (let d = 0; d < DIAS.length; d++) {
        const filaA = filasDatos[d * 2];     // opción A
        const filaC = filasDatos[d * 2 + 1]; // opción C
        const dia   = DIAS[d];

        const celdaA = filaA?.[col] ?? '';
        const celdaC = filaC?.[col] ?? '';

        // Detectar feriado (basta con que cualquiera de las dos lo diga)
        if (
          celdaA.toUpperCase().includes('FERIADO') ||
          celdaC.toUpperCase().includes('FERIADO')
        ) {
          await client.query(
            `INSERT INTO menu_semanal_sin_servicio (menu_semanal_id, dia)
             VALUES ($1, $2)
             ON CONFLICT DO NOTHING`,
            [menuId, dia]
          );
          continue;
        }

        // Opción A
        const nombreA = canonicalizarNombrePlato(limpiarNombre(celdaA));
        if (nombreA) {
          const platoId = await obtenerOCrearPlato(nombreA);
          const viandaId = await obtenerOCrearViandaGeneral(platoId);
          await client.query(
            `INSERT INTO menu_semanal_dias (menu_semanal_id, dia, opcion, plato_id, vianda_id)
             VALUES ($1, $2, 'A', $3, $4)
             ON CONFLICT DO NOTHING`,
            [menuId, dia, platoId, viandaId]
          );
        }

        // Opción C
        const nombreC = canonicalizarNombrePlato(limpiarNombre(celdaC));
        if (nombreC) {
          const platoId = await obtenerOCrearPlato(nombreC);
          const viandaId = await obtenerOCrearViandaGeneral(platoId);
          await client.query(
            `INSERT INTO menu_semanal_dias (menu_semanal_id, dia, opcion, plato_id, vianda_id)
             VALUES ($1, $2, 'C', $3, $4)
             ON CONFLICT DO NOTHING`,
            [menuId, dia, platoId, viandaId]
          );
        }
      }
    }

    platosNuevos = cachePlatos.size - platosAntesCount;

    await client.query('COMMIT');

    // ── Poblar historial desde los menús importados ──────────────
    const { rowCount: historialRows } = await client.query(`
      INSERT INTO historial_uso_platos
        (plato_id, menu_semanal_id, plato_nombre_snapshot, dia, opcion, fecha_servicio)
      SELECT
        msd.plato_id,
        msd.menu_semanal_id,
        p.nombre,
        msd.dia,
        msd.opcion,
        ms.fecha_inicio + CASE msd.dia::text
          WHEN 'lunes'     THEN 0
          WHEN 'martes'    THEN 1
          WHEN 'miercoles' THEN 2
          WHEN 'jueves'    THEN 3
          WHEN 'viernes'   THEN 4
          WHEN 'sabado'    THEN 5
          WHEN 'domingo'   THEN 6
          ELSE 0
        END
      FROM menu_semanal_dias msd
      JOIN menus_semanales ms ON ms.id = msd.menu_semanal_id
      JOIN platos p           ON p.id  = msd.plato_id
    `);
    const metadataActualizada = await actualizarMetadataPlatos(client);

    // ── Anclar fijos como vianda para cada semana importada ───────
    // Mismo criterio que los especiales: un fijo se ofrece como vianda por
    // defecto (decision 2026-07-13). Sin esto, un reseed completo dejaria
    // los fijos sin anclaje por semana (ver scripts/backfill-vianda-anchors.js,
    // que resuelve el mismo gap sobre datos que ya existian).
    const { rows: menusImportados } = await client.query('SELECT id FROM menus_semanales');
    const { rows: fijosDelCatalogo } = await client.query(
      `SELECT id AS plato_id FROM platos
       WHERE activo = true AND (tipo = 'fijo' OR disponibilidad IN ('fijo_dia', 'siempre'))`
    );
    let fijosAnclados = 0;
    for (const menu of menusImportados) {
      for (const fijo of fijosDelCatalogo) {
        const viandaId = await obtenerOCrearViandaGeneral(fijo.plato_id);
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

    console.log('');
    console.log('✅  Importación completada exitosamente.');
    console.log(`   📅  ${semanasImportadas} semanas importadas`);
    console.log(`   🍽️   ${platosNuevos} platos nuevos creados`);
    console.log(`   📦  ${cachePlatos.size} platos totales en la base de datos`);
    console.log(`   🧾  ${metadataActualizada} platos con metadata aproximada`);
    console.log(`   📖  ${historialRows} registros de historial generados`);
    console.log(`   🍱  ${fijosAnclados} anclaje(s) de fijo(s) como vianda por semana`);
    console.log('');
    console.log('   Tags asignados automáticamente:');
    console.log('   Pollo · Carnes · Cerdo · Pescado · Vegetariano');
    console.log('   Pasta · Arroz · Guisos · Ensaladas · Wok');
    console.log('   Tartas · Milanesas · Hamburguesas · Legumbres · Pizza · Tacos · Gratinados');

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌  Error durante la importación — se revirtieron todos los cambios.');
    console.error('   ', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
