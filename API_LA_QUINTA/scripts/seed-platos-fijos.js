import { query } from '../src/database/connection.js';

const GUARNICIONES = [
  'Ensalada Rusa',
  'Ensalada Mixta',
  'Ensalada de remolacha',
  'Ensalada de tomate cherry',
  'Verduras Asadas',
  'Puré de Papas',
  'Puré de calabaza',
  'Papas al Horno',
  'Ensalada de rúcula',
  'Arroz primavera',
  'Ensalada de arroz con lentejas',
  'Zanahoria rallada',
];

const PLATOS_FIJOS = [
  { nombre: 'Canelones de Acelga',                  tiene_guarnicion: false, tags: ['Vegetariano', 'Pasta'] },
  { nombre: 'Canelones de Humita',                  tiene_guarnicion: false, tags: ['Vegetariano', 'Pasta'] },
  { nombre: 'Milanesa de pollo',                    tiene_guarnicion: true,  tags: ['Pollo', 'Milanesas'] },
  { nombre: 'Milanesa de carne',                    tiene_guarnicion: true,  tags: ['Carnes', 'Milanesas'] },
  { nombre: 'Tarta de Jamón y Queso',               tiene_guarnicion: true,  tags: ['Tartas'] },
  { nombre: 'Pata Muslo',                           tiene_guarnicion: true,  tags: ['Pollo'] },
  { nombre: 'Hamburguesa de Zanahoria',             tiene_guarnicion: true,  tags: ['Vegetariano', 'Hamburguesas'] },
  { nombre: 'Hamburguesa de Soja',                  tiene_guarnicion: true,  tags: ['Vegetariano', 'Hamburguesas'] },
  { nombre: 'Tarta de Verduras',                    tiene_guarnicion: true,  tags: ['Vegetariano', 'Tartas'] },
  { nombre: 'Camote relleno con queso',             tiene_guarnicion: true,  tags: ['Vegetariano'] },
  { nombre: 'Zapallo relleno con queso',            tiene_guarnicion: true,  tags: ['Vegetariano'] },
  { nombre: 'Medallones de merluza',                tiene_guarnicion: true,  tags: ['Pescado'] },
  { nombre: 'Rollitos de pollo rellenos con J&Q',   tiene_guarnicion: true,  tags: ['Pollo'] },
  { nombre: 'Yogur + cereales + fruta',             tiene_guarnicion: false, tags: ['Vegetariano'] },
];

async function main() {
  console.log('Insertando guarniciones...');
  for (const nombre of GUARNICIONES) {
    await query(
      `INSERT INTO guarniciones (nombre) VALUES ($1) ON CONFLICT (nombre) DO NOTHING`,
      [nombre]
    );
  }
  console.log(`✓ ${GUARNICIONES.length} guarniciones`);

  console.log('Insertando platos fijos...');
  let insertados = 0;
  for (const p of PLATOS_FIJOS) {
    const existe = await query('SELECT id FROM platos WHERE nombre = $1', [p.nombre]);
    if (existe.rows.length > 0) {
      await query(
        `UPDATE platos SET tipo = 'fijo', tiene_guarnicion = $1, tags = $2 WHERE nombre = $3`,
        [p.tiene_guarnicion, p.tags, p.nombre]
      );
      console.log(`  ~ actualizado: ${p.nombre}`);
    } else {
      await query(
        `INSERT INTO platos (nombre, tipo, tiene_guarnicion, tags) VALUES ($1, 'fijo', $2, $3)`,
        [p.nombre, p.tiene_guarnicion, p.tags]
      );
      console.log(`  + insertado: ${p.nombre}`);
      insertados++;
    }
  }
  console.log(`✓ ${PLATOS_FIJOS.length} platos fijos procesados`);

  console.log('\nSeed completado.');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
