/**
 * build-dataset.mjs
 * Ensambla el dataset de carga a partir de:
 *   - menus-historicos.csv         (grilla A/C x dia x semana)
 *   - data/decomposicion.json      (celda -> plato base + guarnicion)
 *   - data/fijos.json              (platos fijos por dia del local)
 *   - data/guarniciones.json       (catalogo de guarniciones)
 *
 * Salida en data/out/:
 *   - guarniciones.json  (catalogo final)
 *   - platos.json        (catalogo final con canal/disponibilidad/dia_fijo/guarnicion_modo)
 *   - menus.json         (22-23 semanas -> dia -> opcion -> {plato, guarnicion})
 *   - UNMAPPED.txt       (celdas del CSV que no se pudieron descomponer)
 *
 * No toca la base de datos. Solo genera archivos para revisar.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, 'data');
const outDir = join(dataDir, 'out');
mkdirSync(outDir, { recursive: true });

const load = (f) => JSON.parse(readFileSync(join(dataDir, f), 'utf-8'));
const guarnicionesCat = load('guarniciones.json');
const { map: decomp } = load('decomposicion.json');
const { platos: fijos } = load('fijos.json');

// Fechas de inicio (lunes) por columna del CSV — reusa las correcciones del seed original.
const FECHAS_INICIO = [
  '2026-01-26', '2026-02-02', '2026-02-09', '2026-02-16', '2026-02-23',
  '2026-03-02', '2026-03-09', '2026-03-16', '2026-03-23', '2026-04-06',
  '2026-04-13', '2026-04-20', '2026-04-27', '2026-05-04', '2026-05-11',
  '2026-05-18', '2026-05-25', '2026-06-01', '2026-06-08', '2026-06-15',
  '2026-06-22', '2026-06-29', '2026-07-06', '2026-07-13',
];

const ROW_MAP = [
  { dia: 'lunes', opcion: 'A' }, { dia: 'lunes', opcion: 'C' },
  { dia: 'martes', opcion: 'A' }, { dia: 'martes', opcion: 'C' },
  { dia: 'miercoles', opcion: 'A' }, { dia: 'miercoles', opcion: 'C' },
  { dia: 'jueves', opcion: 'A' }, { dia: 'jueves', opcion: 'C' },
  { dia: 'viernes', opcion: 'A' }, { dia: 'viernes', opcion: 'C' },
];

const normalize = (s) =>
  s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // quita acentos (pure/puré, ñ->n)
    .replace(/^[abc]\s*:\s*/, '')       // quita prefijo A:/B:/C:
    .replace(/\.$/, '')                 // quita punto final
    .replace(/\s+/g, ' ')               // colapsa espacios
    .trim();

// Mapa de descomposicion re-indexado con las claves normalizadas (insensible a acentos).
const decompNorm = {};
for (const [k, v] of Object.entries(decomp)) decompNorm[normalize(k)] = v;

const csv = readFileSync(join(__dirname, 'menus-historicos.csv'), 'utf-8');
const rows = csv.split(/\r?\n/).map((l) => l.split(','));

const guarnValidas = new Set(guarnicionesCat.map((g) => g.nombre));

// ── Recolectar platos y grilla de menus ──────────────────────────────────────
const platosMap = new Map(); // nombre -> { guarnicionesUsadas:Set, canal, disponibilidad, dia_fijo, guarnicion_modo }
const unmapped = new Set();
const menus = [];

function ensurePlato(nombre) {
  if (!platosMap.has(nombre)) {
    platosMap.set(nombre, {
      nombre,
      guarnicionesUsadas: new Set(),
      enVianda: false,
      enFijo: false,
      dia_fijo: null,
      guarnicion_modo_fijo: null,
    });
  }
  return platosMap.get(nombre);
}

for (let semIdx = 0; semIdx < FECHAS_INICIO.length; semIdx++) {
  const csvCol = semIdx + 1;
  const fechaInicio = FECHAS_INICIO[semIdx];
  const dias = {};
  const feriados = new Set();

  for (let r = 0; r < ROW_MAP.length; r++) {
    const { dia, opcion } = ROW_MAP[r];
    const raw = (rows[r + 1]?.[csvCol] || '').trim();
    if (!raw) continue;
    if (/^feriado$/i.test(raw)) { feriados.add(dia); continue; }

    const key = normalize(raw);
    const entry = decompNorm[key];
    if (!entry) { unmapped.add(`col${csvCol} ${dia}/${opcion}: "${raw}"  [norm: ${key}]`); continue; }

    const p = ensurePlato(entry.plato);
    p.enVianda = true;
    if (entry.guarnicion) {
      if (!guarnValidas.has(entry.guarnicion)) {
        unmapped.add(`GUARNICION DESCONOCIDA "${entry.guarnicion}" en "${raw}"`);
      }
      p.guarnicionesUsadas.add(entry.guarnicion);
    }

    if (!dias[dia]) dias[dia] = {};
    dias[dia][opcion] = { plato: entry.plato, guarnicion: entry.guarnicion };
  }

  menus.push({
    semana: semIdx + 1,
    fecha_inicio: fechaInicio,
    feriados: [...feriados],
    dias,
  });
}

// ── Fusionar fijos ───────────────────────────────────────────────────────────
for (const f of fijos) {
  const p = ensurePlato(f.plato);
  p.enFijo = true;
  p.dia_fijo = f.dia;
  p.guarnicion_modo_fijo = f.guarnicion_modo;
}

// ── Resolver metadata final de cada plato ────────────────────────────────────
const platosFinal = [...platosMap.values()].map((p) => {
  const tieneGuarnLibre = p.guarnicionesUsadas.size > 0;
  let guarnicion_modo;
  if (tieneGuarnLibre) guarnicion_modo = 'libre';
  else if (p.enFijo) guarnicion_modo = p.guarnicion_modo_fijo;
  else guarnicion_modo = 'sin_guarnicion';

  let canal;
  if (p.enFijo && p.enVianda) canal = 'ambos';
  else if (p.enFijo) canal = 'local';
  else canal = 'vianda';

  const disponibilidad = p.enFijo ? 'fijo_dia' : 'especial';

  return {
    nombre: p.nombre,
    canal,
    disponibilidad,
    dia_fijo: p.enFijo ? p.dia_fijo : null,
    guarnicion_modo,
    guarniciones_historicas: [...p.guarnicionesUsadas].sort(),
  };
}).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));

// ── Escribir salida ──────────────────────────────────────────────────────────
writeFileSync(join(outDir, 'guarniciones.json'), JSON.stringify(guarnicionesCat, null, 2));
writeFileSync(join(outDir, 'platos.json'), JSON.stringify(platosFinal, null, 2));
writeFileSync(join(outDir, 'menus.json'), JSON.stringify(menus, null, 2));
writeFileSync(join(outDir, 'UNMAPPED.txt'), [...unmapped].sort().join('\n') || '(ninguna — todo mapeado)');

// ── Resumen ──────────────────────────────────────────────────────────────────
const porCanal = platosFinal.reduce((a, p) => ((a[p.canal] = (a[p.canal] || 0) + 1), a), {});
const porModo = platosFinal.reduce((a, p) => ((a[p.guarnicion_modo] = (a[p.guarnicion_modo] || 0) + 1), a), {});
console.log('=== RESUMEN DATASET ===');
console.log(`Guarniciones: ${guarnicionesCat.length}`);
console.log(`Platos:       ${platosFinal.length}`);
console.log(`  por canal:  ${JSON.stringify(porCanal)}`);
console.log(`  por modo:   ${JSON.stringify(porModo)}`);
console.log(`Semanas:      ${menus.length}`);
console.log(`Celdas sin mapear: ${unmapped.size}`);
if (unmapped.size) { console.log('\n--- UNMAPPED ---'); [...unmapped].sort().forEach((u) => console.log('  ' + u)); }
