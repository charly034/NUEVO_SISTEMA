import { resolve } from 'path';
import { fileURLToPath } from 'url';
import { query } from '../src/database/connection.js';

const ALERGENOS = {
  gluten: ['milanesa', 'rebozada', 'canelon', 'raviol', 'noqui', 'ñoqui', 'fetuchini', 'tallar', 'spaghetti', 'lasaña', 'pasta', 'pizza', 'tarta', 'empanada', 'pan', 'croqueta'],
  lactosa: ['queso', 'jyq', 'jamon y queso', 'j&q', 'salsa blanca', 'crema', 'caruso', 'caprese', 'ricota', 'gratinado'],
  huevo: ['tortilla', 'milanesa', 'rebozada', 'buñuelo', 'torreja', 'canelon', 'raviol', 'noqui', 'ñoqui', 'pasta'],
  pescado: ['merluza', 'atun', 'atún', 'calamar', 'pescado'],
  soja: ['soja'],
  frutos_secos: ['nuez', 'nueces', 'almendra'],
};

const BASE_KCAL = [
  { keys: ['yogur'], kcal: 260 },
  { keys: ['ensalada cesar', 'salpicon', 'salpicón'], kcal: 360 },
  { keys: ['ensalada'], kcal: 330 },
  { keys: ['sopa'], kcal: 280 },
  { keys: ['guiso', 'estofado', 'carbonada', 'puchero'], kcal: 520 },
  { keys: ['milanesa', 'napolitana', 'escalope'], kcal: 640 },
  { keys: ['hamburguesa'], kcal: 560 },
  { keys: ['canelon', 'raviol', 'noqui', 'ñoqui', 'fetuchini', 'tallar', 'spaghetti', 'lasaña', 'sorrentino', 'rotolo', 'pasta'], kcal: 540 },
  { keys: ['tarta', 'pizza'], kcal: 470 },
  { keys: ['pollo', 'suprema', 'pata muslo', 'rollito'], kcal: 460 },
  { keys: ['cerdo', 'bondiola', 'costeleta'], kcal: 560 },
  { keys: ['carne', 'bife', 'pan de carne', 'higado', 'hígado'], kcal: 540 },
  { keys: ['merluza', 'atun', 'atún', 'calamar', 'papillot'], kcal: 420 },
  { keys: ['tortilla', 'souffle', 'soufflé', 'buñuelo', 'croqueta', 'bomba'], kcal: 430 },
  { keys: ['pastel'], kcal: 500 },
  { keys: ['wok', 'arroz', 'risotto'], kcal: 500 },
  { keys: ['verdura', 'berenjena', 'zucchini', 'zapallito', 'calabaza', 'lenteja'], kcal: 410 },
];

function normalizar(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function contiene(texto, keys) {
  return keys.some((key) => texto.includes(normalizar(key)));
}

function estimarKcal(nombre, tags = []) {
  const base = normalizar(`${nombre} ${tags.join(' ')}`);
  const match = BASE_KCAL.find((item) => contiene(base, item.keys));
  return match?.kcal ?? 450;
}

function estimarAlergenos(nombre, tags = []) {
  const base = normalizar(`${nombre} ${tags.join(' ')}`);
  return Object.entries(ALERGENOS)
    .filter(([, keys]) => contiene(base, keys))
    .map(([alergeno]) => alergeno);
}

function esVegetariano(nombre, tags = []) {
  const base = normalizar(`${nombre} ${tags.join(' ')}`);
  if (base.includes('vegetariano') || base.includes('vegano')) return true;
  if (contiene(base, ['pollo', 'carne', 'cerdo', 'bondiola', 'merluza', 'atun', 'atún', 'calamar', 'higado', 'hígado', 'jamon', 'j&q', 'jyq'])) {
    return false;
  }
  return contiene(base, ['verdura', 'berenjena', 'zucchini', 'zapallito', 'calabaza', 'lenteja', 'acelga', 'humita', 'soja', 'zanahoria', 'caprese', 'tortilla', 'croqueta', 'buñuelo']);
}

function categoria(nombre, tags = []) {
  const base = normalizar(`${nombre} ${tags.join(' ')}`);
  if (contiene(base, ['pollo', 'suprema', 'pata muslo'])) return 'pollo';
  if (contiene(base, ['carne', 'bife', 'higado', 'hígado', 'albondiga', 'albóndiga'])) return 'carne';
  if (contiene(base, ['cerdo', 'bondiola', 'costeleta'])) return 'cerdo';
  if (contiene(base, ['merluza', 'atun', 'atún', 'calamar'])) return 'pescado';
  if (contiene(base, ['canelon', 'raviol', 'noqui', 'ñoqui', 'fetuchini', 'tallar', 'spaghetti', 'lasaña', 'sorrentino', 'pasta'])) return 'pasta';
  if (contiene(base, ['tarta', 'pizza'])) return 'tarta';
  if (contiene(base, ['guiso', 'estofado', 'puchero', 'carbonada'])) return 'guiso';
  if (esVegetariano(nombre, tags)) return 'vegetariano';
  return 'casero';
}

function descripcion(nombre, tags = []) {
  const tipo = categoria(nombre, tags);
  const textos = {
    pollo: `Plato casero a base de pollo, pensado como vianda completa y de sabor suave.`,
    carne: `Preparacion casera con carne, de perfil contundente y acompanamiento integrado.`,
    cerdo: `Plato principal con cerdo, coccion sabrosa y porcion de vianda completa.`,
    pescado: `Opcion con pescado, liviana y apta para alternar proteinas durante la semana.`,
    pasta: `Pasta o preparacion al horno con salsa, pensada como plato principal.`,
    tarta: `Preparacion de tarta o masa horneada con relleno salado y guarnicion integrada.`,
    guiso: `Comida de olla, abundante y rendidora, con salsa o fondo de coccion.`,
    vegetariano: `Opcion vegetariana con verduras, legumbres o queso segun la preparacion.`,
    casero: `Plato casero de vianda, preparado para servicio semanal.`,
  };
  return textos[tipo];
}

function receta(nombre, tags = []) {
  const tipo = categoria(nombre, tags);
  const textos = {
    pollo: `Preparacion aproximada: condimentar el pollo, cocinar al horno o en salsa hasta que quede tierno y completar con la guarnicion indicada en el nombre del plato.`,
    carne: `Preparacion aproximada: dorar la carne, sumar vegetales o salsa base y cocinar hasta lograr una textura tierna; servir con el acompanamiento indicado.`,
    cerdo: `Preparacion aproximada: marinar o condimentar el cerdo, cocinar al horno o braseado y acompanar con pure, papas o verduras segun corresponda.`,
    pescado: `Preparacion aproximada: cocinar el pescado al horno o plancha con condimentos suaves y acompanar con pure, arroz o ensalada segun el plato.`,
    pasta: `Preparacion aproximada: hervir o armar la pasta, rellenar si aplica, cubrir con salsa y terminar al horno cuando corresponda.`,
    tarta: `Preparacion aproximada: preparar el relleno salado, colocarlo sobre masa de tarta y hornear hasta dorar; acompanar con ensalada o pure si el plato lo indica.`,
    guiso: `Preparacion aproximada: saltear una base de vegetales, incorporar proteina o legumbres, cubrir con caldo o salsa y cocinar lentamente hasta integrar sabores.`,
    vegetariano: `Preparacion aproximada: cocinar las verduras o legumbres, condimentar y combinar con queso, arroz, masa o guarnicion segun el plato.`,
    casero: `Preparacion aproximada: elaborar con tecnica casera tradicional y ajustar guarnicion, salsa y porcion al formato de vianda.`,
  };
  return textos[tipo];
}

function ejecutar(db, text, params) {
  if (typeof db === 'function') return db(text, params);
  return db.query(text, params);
}

export function metadataParaPlato(nombre, tags = []) {
  return {
    descripcion: descripcion(nombre, tags),
    descripcion_larga: receta(nombre, tags),
    calorias: estimarKcal(nombre, tags),
    alergenos: estimarAlergenos(nombre, tags),
    vegetariano: esVegetariano(nombre, tags),
  };
}

export async function actualizarMetadataPlatos(db = query) {
  const { rows: platos } = await ejecutar(db, `
    SELECT id, nombre, tags
    FROM platos
    ORDER BY id
  `);

  let actualizados = 0;
  for (const plato of platos) {
    const tags = Array.isArray(plato.tags) ? plato.tags : [];
    const metadata = metadataParaPlato(plato.nombre, tags);

    await ejecutar(
      db,
      `UPDATE platos
       SET descripcion = $1,
           descripcion_larga = $2,
           calorias = $3,
           alergenos = $4,
           vegetariano = $5,
           updated_at = NOW()
       WHERE id = $6`,
      [
        metadata.descripcion,
        metadata.descripcion_larga,
        metadata.calorias,
        metadata.alergenos,
        metadata.vegetariano,
        plato.id,
      ],
    );
    actualizados++;
  }

  return actualizados;
}

async function main() {
  const actualizados = await actualizarMetadataPlatos();
  console.log(`Metadata aproximada actualizada en ${actualizados} platos.`);
  process.exit(0);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
