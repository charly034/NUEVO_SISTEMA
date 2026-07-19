#!/usr/bin/env node
/**
 * seed-consolidado-catalogo.js
 *
 * Catálogo consolidado del "modelo nuevo", alineado al FORMULARIO EDISON real
 * (Google Form de pedido semanal) que es la autoridad de la ESTRUCTURA actual:
 *
 *  - Guarniciones: las 14 reales del form (elección libre). Cualquier otra
 *    guarnición existente se DESACTIVA para que el catálogo coincida con el form
 *    (esto también desactiva las filas residuales "Salsa ..." que quedaron de
 *    antes de separar Salsa como entidad — ver debt-guarniciones-filas-salsa-residuales).
 *  - Fijos de siempre: los 14 platos recurrentes del form (aparecen todos los
 *    días). Los que en el form dicen "+ guarnición" van con guarnicion_modo='libre';
 *    los prearmados (Canelones, Yogur) van 'sin_guarnicion'. Todos tipo='fijo'
 *    (materializarFijosMenu los toma como "Fijos de siempre") y disponible_vianda=true.
 *  - Salsas: NO se pueblan como entidad separada — en el form real la salsa va
 *    dentro del nombre del plato (ej. "...con salsa rosa"), no hay selector de salsa.
 *
 * Los ESPECIALES por semana NO se cargan acá: los importa scripts/import-menus-csv.js
 * desde el CSV histórico (nombre completo = prearmado, fiel al form), que ya
 * categoriza, ancla viandas y materializa fijos. Este script corre ANTES de ese
 * import para que los fijos existan cuando el import los ancle como vianda.
 *
 * Uso (parte de un solo comando):
 *   npm run seed:consolidado   (= este script + seed:menus)
 */
import pool, { getClient } from '../src/database/connection.js';

// ── Guarniciones del form (14, elección libre) ──────────────────────────────
const GUARNICIONES = [
  { nombre: 'Ensalada Rusa',                  tipo: 'fria' },
  { nombre: 'Ensalada Mixta',                 tipo: 'fria' },
  { nombre: 'Ensalada de remolacha',          tipo: 'fria' },
  { nombre: 'Ensalada de tomate cherry',      tipo: 'fria' },
  { nombre: 'Ensalada de rúcula',             tipo: 'fria' },
  { nombre: 'Ensalada de arroz con lentejas', tipo: 'fria' },
  { nombre: 'Zanahoria rallada',              tipo: 'fria' },
  { nombre: 'Ensalada de lechuga',            tipo: 'fria' },
  { nombre: 'Ensalada de rúcula y tomate',    tipo: 'fria' },
  { nombre: 'Ensalada de tomate',             tipo: 'fria' },
  { nombre: 'Puré de Papas',                  tipo: 'caliente' },
  { nombre: 'Puré de calabaza',               tipo: 'caliente' },
  { nombre: 'Papas al Horno',                 tipo: 'caliente' },
  { nombre: 'Arroz primavera',                tipo: 'caliente' },
];

// ── Fijos de siempre del form (14) ──────────────────────────────────────────
// libre = "+ guarnición" en el form (el cliente elige guarnición).
// sin   = prearmado (no lleva guarnición).
const FIJOS = [
  { nombre: 'Milanesa de pollo',                    modo: 'libre', tags: ['Pollo', 'Milanesas'] },
  { nombre: 'Milanesa de carne',                    modo: 'libre', tags: ['Carnes', 'Milanesas'] },
  { nombre: 'Tarta de JyQ',                         modo: 'libre', tags: ['Tartas', 'Vegetariano'] },
  { nombre: 'Pata Muslo',                           modo: 'libre', tags: ['Pollo'] },
  { nombre: 'Hamburguesas de Zanahoria',            modo: 'libre', tags: ['Vegetariano', 'Hamburguesas'] },
  { nombre: 'Hamburguesa de soja',                  modo: 'libre', tags: ['Vegetariano', 'Hamburguesas', 'Legumbres'] },
  { nombre: 'Tarta de Verduras',                    modo: 'libre', tags: ['Tartas', 'Vegetariano'] },
  { nombre: 'Camote relleno con queso',             modo: 'libre', tags: ['Vegetariano'] },
  { nombre: 'Zapallo relleno con queso',            modo: 'libre', tags: ['Vegetariano'] },
  { nombre: 'Medallones de merluza',                modo: 'libre', tags: ['Pescado'] },
  { nombre: 'Rollitos de pollo rellenos con JyQ',   modo: 'libre', tags: ['Pollo'] },
  { nombre: 'Canelones de Acelga',                  modo: 'sin_guarnicion', tags: ['Pasta', 'Vegetariano'] },
  { nombre: 'Canelones de Humita',                  modo: 'sin_guarnicion', tags: ['Pasta', 'Vegetariano'] },
  { nombre: 'Yogur + cereales + fruta',             modo: 'sin_guarnicion', tags: ['Vegetariano'] },
];

async function main() {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    // 1) Guarniciones: upsert las del form; desactivar el resto (incluye "Salsa ...").
    const nombresForm = GUARNICIONES.map((g) => g.nombre);
    for (const g of GUARNICIONES) {
      await client.query(
        `INSERT INTO guarniciones (nombre, tipo, activo)
         VALUES ($1, $2, true)
         ON CONFLICT (nombre) DO UPDATE SET tipo = EXCLUDED.tipo, activo = true`,
        [g.nombre, g.tipo],
      );
    }
    const desactivadas = (await client.query(
      `UPDATE guarniciones SET activo = false
       WHERE activo = true AND nombre <> ALL($1::text[])`,
      [nombresForm],
    )).rowCount;

    // 2) Fijos de siempre: upsert como tipo='fijo', disponible_vianda=true.
    for (const f of FIJOS) {
      const tieneGuarnicion = f.modo === 'libre';
      await client.query(
        `INSERT INTO platos (nombre, tipo, disponibilidad, tiene_guarnicion, guarnicion_modo, disponible_vianda, tags, activo)
         VALUES ($1, 'fijo', 'especial', $2, $3::guarnicion_modo, true, $4, true)
         ON CONFLICT (nombre) DO UPDATE SET
           tipo = 'fijo',
           tiene_guarnicion = EXCLUDED.tiene_guarnicion,
           guarnicion_modo = EXCLUDED.guarnicion_modo,
           disponible_vianda = true,
           activo = true`,
        [f.nombre, tieneGuarnicion, f.modo, f.tags],
      );
    }

    // 3) Reconciliar: cualquier OTRO plato que hoy sea fijo -- por tipo='fijo' O
    // por disponibilidad IN ('fijo_dia','siempre') (que materializarFijosMenu
    // también toma como fijo) -- pero que NO esté en la lista del form, deja de
    // ser fijo: pasa a 'especial' y se le limpia disponibilidad/dia_fijo. Así el
    // set de "Fijos" == el del form sobre cualquier catálogo previo (idempotente).
    const nombresFijos = FIJOS.map((f) => f.nombre);
    const degradados = (await client.query(
      `UPDATE platos SET tipo = 'especial', disponibilidad = 'especial', dia_fijo = NULL
       WHERE nombre <> ALL($1::text[])
         AND (tipo = 'fijo' OR disponibilidad IN ('fijo_dia', 'siempre'))`,
      [nombresFijos],
    )).rowCount;

    await client.query('COMMIT');

    console.log('=== Catálogo consolidado (form) ===');
    console.log(`  Guarniciones activas : ${GUARNICIONES.length} (desactivadas ${desactivadas} fuera del form)`);
    console.log(`  Fijos de siempre     : ${FIJOS.length} (${FIJOS.filter((f) => f.modo === 'libre').length} con guarnición libre, ${FIJOS.filter((f) => f.modo === 'sin_guarnicion').length} prearmados)`);
    console.log(`  Fijos legacy degradados a especial: ${degradados}`);
    console.log('  (Los especiales por semana los carga seed:menus desde el CSV.)');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error en seed consolidado, rollback ejecutado:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
