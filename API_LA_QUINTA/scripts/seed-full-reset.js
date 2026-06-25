#!/usr/bin/env node
/**
 * seed-full-reset.js
 *
 * Resetea TODA la base de datos y crea un ambiente de testing completo:
 *   ✓ Superadmin
 *   ✓ Todos los platos (fijos, especiales, ambos) y guarniciones
 *   ✓ 4 semanas de menús (2 pasadas cerradas, actual publicada, próxima en borrador)
 *   ✓ 3 empresas de prueba + 1 empresa TEST
 *   ✓ 5 empleados por empresa (nombres únicos)
 *   ✓ Pedidos realistas en 2 semanas pasadas, semana actual y próxima (algunos sí, otros no)
 *   ✓ Usuario TEST: test@test.com / 12345678
 *
 * Uso: node scripts/seed-full-reset.js
 * ⚠ BORRA TODO. Solo para entornos de desarrollo/testing.
 */

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import pool, { getClient } from '../src/database/connection.js';

// ─── Guard de seguridad ───────────────────────────────────────────────────────
if (process.env.NODE_ENV === 'production') {
  console.error('❌  Este seed no puede ejecutarse en producción.');
  process.exit(1);
}

// ─── Helpers de fechas ────────────────────────────────────────────────────────
function getLunes(offsetSemanas = 0) {
  const hoy = new Date();
  const diff = hoy.getDay() === 0 ? -6 : 1 - hoy.getDay();
  const d = new Date(hoy);
  d.setDate(hoy.getDate() + diff + offsetSemanas * 7);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().split('T')[0];
}

function getDomingo(lunes) {
  const [y, m, d] = lunes.split('-').map(Number);
  const dom = new Date(y, m - 1, d + 6);
  return dom.toISOString().split('T')[0];
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle(arr) {
  return [...arr].sort(() => Math.random() - 0.5);
}

// ─── Datos fijos ──────────────────────────────────────────────────────────────
const SUPERADMIN = {
  nombre: 'Carlos',
  apellido: 'La Quinta',
  email: process.env.SUPERADMIN_EMAIL || 'admin@laquinta.com',
  password: process.env.SUPERADMIN_PASSWORD || 'admin12345',
};

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
  { nombre: 'Canelones de Acelga',                tiene_guarnicion: false, tags: ['Vegetariano', 'Pasta'] },
  { nombre: 'Canelones de Humita',                tiene_guarnicion: false, tags: ['Vegetariano', 'Pasta'] },
  { nombre: 'Milanesa de pollo',                  tiene_guarnicion: true,  tags: ['Pollo', 'Milanesas'] },
  { nombre: 'Milanesa de carne',                  tiene_guarnicion: true,  tags: ['Carnes', 'Milanesas'] },
  { nombre: 'Tarta de Jamón y Queso',             tiene_guarnicion: true,  tags: ['Tartas'] },
  { nombre: 'Pata Muslo',                         tiene_guarnicion: true,  tags: ['Pollo'] },
  { nombre: 'Hamburguesa de Zanahoria',           tiene_guarnicion: true,  tags: ['Vegetariano', 'Hamburguesas'] },
  { nombre: 'Hamburguesa de Soja',                tiene_guarnicion: true,  tags: ['Vegetariano', 'Hamburguesas'] },
  { nombre: 'Tarta de Verduras',                  tiene_guarnicion: true,  tags: ['Vegetariano', 'Tartas'] },
  { nombre: 'Camote relleno con queso',           tiene_guarnicion: true,  tags: ['Vegetariano'] },
  { nombre: 'Zapallo relleno con queso',          tiene_guarnicion: true,  tags: ['Vegetariano'] },
  { nombre: 'Medallones de merluza',              tiene_guarnicion: true,  tags: ['Pescado'] },
  { nombre: 'Rollitos de pollo rellenos con J&Q', tiene_guarnicion: true,  tags: ['Pollo'] },
  { nombre: 'Yogur + cereales + fruta',           tiene_guarnicion: false, tags: ['Vegetariano'] },
];

const PLATOS_VARIABLES = [
  // ambos
  { nombre: 'Estofado de albóndigas',              tipo: 'ambos',    tiene_guarnicion: false, tags: ['Carnes', 'Guisos'] },
  { nombre: 'Ravioles con bolognesa',              tipo: 'ambos',    tiene_guarnicion: false, tags: ['Pasta'] },
  { nombre: 'Pastel de papa',                      tipo: 'ambos',    tiene_guarnicion: false, tags: ['Vegetariano'] },
  { nombre: 'Pastel de camote',                    tipo: 'ambos',    tiene_guarnicion: false, tags: ['Vegetariano'] },
  { nombre: 'Zapallitos rellenos',                 tipo: 'ambos',    tiene_guarnicion: false, tags: ['Vegetariano'] },
  { nombre: 'Cerdo a la barbacoa con puré',        tipo: 'ambos',    tiene_guarnicion: false, tags: ['Cerdo'] },
  // especial — pollo
  { nombre: 'Arroz con pollo',                              tipo: 'especial', tiene_guarnicion: false, tags: ['Pollo'] },
  { nombre: 'Pata muslo al champiñon con ensalada',         tipo: 'especial', tiene_guarnicion: false, tags: ['Pollo'] },
  { nombre: 'Pata muslo al champiñon con puré de zapallo',  tipo: 'especial', tiene_guarnicion: false, tags: ['Pollo'] },
  { nombre: 'Pollo al verdeo con puré',                     tipo: 'especial', tiene_guarnicion: false, tags: ['Pollo'] },
  { nombre: 'Milanesa de pollo napolitana con puré',        tipo: 'especial', tiene_guarnicion: false, tags: ['Pollo', 'Milanesas'] },
  { nombre: 'Milanesa de pollo napolitana con rusa',        tipo: 'especial', tiene_guarnicion: false, tags: ['Pollo', 'Milanesas'] },
  { nombre: 'Pollo a la mostaza con puré',                  tipo: 'especial', tiene_guarnicion: false, tags: ['Pollo'] },
  { nombre: 'Pollo al limón con puré de zapallo',           tipo: 'especial', tiene_guarnicion: false, tags: ['Pollo'] },
  { nombre: 'Rollitos de pollo con puré',                   tipo: 'especial', tiene_guarnicion: false, tags: ['Pollo'] },
  { nombre: 'Pollo al romero con papas rústicas',           tipo: 'especial', tiene_guarnicion: false, tags: ['Pollo'] },
  { nombre: 'Wok de pollo',                                 tipo: 'especial', tiene_guarnicion: false, tags: ['Pollo'] },
  { nombre: 'Pollo a la Portuguesa',                        tipo: 'especial', tiene_guarnicion: false, tags: ['Pollo'] },
  { nombre: 'Pollo a la crema con arroz primavera',         tipo: 'especial', tiene_guarnicion: false, tags: ['Pollo'] },
  { nombre: 'Suprema capresse con puré de papas',           tipo: 'especial', tiene_guarnicion: false, tags: ['Pollo'] },
  { nombre: 'Tacos de pollo con ensalada',                  tipo: 'especial', tiene_guarnicion: false, tags: ['Pollo'] },
  { nombre: 'Tarta de pollo con ensalada',                  tipo: 'especial', tiene_guarnicion: false, tags: ['Pollo', 'Tartas'] },
  // especial — carnes
  { nombre: 'Hamburguesa de carne con puré de papas',    tipo: 'especial', tiene_guarnicion: false, tags: ['Carnes', 'Hamburguesas'] },
  { nombre: 'Hamburguesa de carne con ensalada',         tipo: 'especial', tiene_guarnicion: false, tags: ['Carnes', 'Hamburguesas'] },
  { nombre: 'Napolitana de carne con papas',             tipo: 'especial', tiene_guarnicion: false, tags: ['Carnes', 'Milanesas'] },
  { nombre: 'Pan de carne con verduras asadas',          tipo: 'especial', tiene_guarnicion: false, tags: ['Carnes'] },
  { nombre: 'Pan de carne con ensalada',                 tipo: 'especial', tiene_guarnicion: false, tags: ['Carnes'] },
  { nombre: 'Carne a la olla',                           tipo: 'especial', tiene_guarnicion: false, tags: ['Carnes', 'Guisos'] },
  { nombre: 'Carne al horno con vegetales',              tipo: 'especial', tiene_guarnicion: false, tags: ['Carnes'] },
  { nombre: 'Wok de carne con vegetales',                tipo: 'especial', tiene_guarnicion: false, tags: ['Carnes'] },
  { nombre: 'Bife a la criolla',                         tipo: 'especial', tiene_guarnicion: false, tags: ['Carnes'] },
  { nombre: 'Estofado de carne',                         tipo: 'especial', tiene_guarnicion: false, tags: ['Carnes', 'Guisos'] },
  // especial — cerdo
  { nombre: 'Costeletas de cerdo a la Riojana',          tipo: 'especial', tiene_guarnicion: false, tags: ['Cerdo'] },
  { nombre: 'Costeletas de cerdo con verduras al horno', tipo: 'especial', tiene_guarnicion: false, tags: ['Cerdo'] },
  { nombre: 'Cerdo al horno con papas',                  tipo: 'especial', tiene_guarnicion: false, tags: ['Cerdo'] },
  { nombre: 'Wok de cerdo',                              tipo: 'especial', tiene_guarnicion: false, tags: ['Cerdo'] },
  { nombre: 'Risotto de cerdo',                          tipo: 'especial', tiene_guarnicion: false, tags: ['Cerdo'] },
  // especial — pescado
  { nombre: 'Medallones de merluza con ensalada rusa',   tipo: 'especial', tiene_guarnicion: false, tags: ['Pescado'] },
  { nombre: 'Medallones de merluza con puré de papas',   tipo: 'especial', tiene_guarnicion: false, tags: ['Pescado'] },
  { nombre: 'Filet de merluza con puré de papas',        tipo: 'especial', tiene_guarnicion: false, tags: ['Pescado'] },
  { nombre: 'Papillot de merluza',                       tipo: 'especial', tiene_guarnicion: false, tags: ['Pescado'] },
  { nombre: 'Tarta de atún con remolacha y zanahoria',   tipo: 'especial', tiene_guarnicion: false, tags: ['Pescado', 'Tartas'] },
  // especial — pasta
  { nombre: 'Canelones de JyQ con salsa fileto',         tipo: 'especial', tiene_guarnicion: false, tags: ['Pasta'] },
  { nombre: 'Canelones de JyQ con bolognesa',            tipo: 'especial', tiene_guarnicion: false, tags: ['Pasta'] },
  { nombre: 'Ravioles de jamón y queso con fileto',      tipo: 'especial', tiene_guarnicion: false, tags: ['Pasta'] },
  { nombre: 'Ravioles de acelga y ricota con bolognesa', tipo: 'especial', tiene_guarnicion: false, tags: ['Pasta', 'Vegetariano'] },
  { nombre: 'Ravioles con salsa caruso',                 tipo: 'especial', tiene_guarnicion: false, tags: ['Pasta'] },
  { nombre: 'Ñoquis con bolognesa',                      tipo: 'especial', tiene_guarnicion: false, tags: ['Pasta'] },
  { nombre: 'Fetuchini con salsa de hongos',             tipo: 'especial', tiene_guarnicion: false, tags: ['Pasta'] },
  { nombre: 'Lasaña de JyQ',                             tipo: 'especial', tiene_guarnicion: false, tags: ['Pasta'] },
  { nombre: 'Lasaña de berenjena con ensalada',          tipo: 'especial', tiene_guarnicion: false, tags: ['Pasta', 'Vegetariano'] },
  { nombre: 'Sorrentinos de calabaza con bolognesa',     tipo: 'especial', tiene_guarnicion: false, tags: ['Pasta', 'Vegetariano'] },
  { nombre: 'Tallarines con albóndigas y salsa',         tipo: 'especial', tiene_guarnicion: false, tags: ['Pasta', 'Carnes'] },
  { nombre: 'Tallarines con salsa caruso',               tipo: 'especial', tiene_guarnicion: false, tags: ['Pasta'] },
  { nombre: 'Polenta con queso y bolognesa',             tipo: 'especial', tiene_guarnicion: false, tags: ['Vegetariano'] },
  // especial — vegetariano
  { nombre: 'Tortilla de papa rellena con ensalada',      tipo: 'especial', tiene_guarnicion: false, tags: ['Vegetariano'] },
  { nombre: 'Tortilla de verduras con ensalada',          tipo: 'especial', tiene_guarnicion: false, tags: ['Vegetariano'] },
  { nombre: 'Ensalada Cesar',                             tipo: 'especial', tiene_guarnicion: false, tags: ['Ensaladas', 'Vegetariano'] },
  { nombre: 'Mil hojas de berenjena y zucchini',          tipo: 'especial', tiene_guarnicion: false, tags: ['Vegetariano'] },
  { nombre: 'Milanesa de berenjena napolitana con ensalada', tipo: 'especial', tiene_guarnicion: false, tags: ['Vegetariano', 'Milanesas'] },
  { nombre: 'Guiso de lentejas',                          tipo: 'especial', tiene_guarnicion: false, tags: ['Vegetariano', 'Guisos'] },
  { nombre: 'Guiso de fideos',                            tipo: 'especial', tiene_guarnicion: false, tags: ['Guisos'] },
  { nombre: 'Croquetas de papa con ensalada',             tipo: 'especial', tiene_guarnicion: false, tags: ['Vegetariano'] },
  { nombre: 'Hamburguesas de acelga con puré',            tipo: 'especial', tiene_guarnicion: false, tags: ['Vegetariano', 'Hamburguesas'] },
  { nombre: 'Hamburguesas de acelga a la napo con ensalada', tipo: 'especial', tiene_guarnicion: false, tags: ['Vegetariano', 'Hamburguesas'] },
  { nombre: 'Pizza de verduras con ensalada',             tipo: 'especial', tiene_guarnicion: false, tags: ['Vegetariano'] },
  { nombre: 'Tarta caprese con puré mixto',               tipo: 'especial', tiene_guarnicion: false, tags: ['Vegetariano', 'Tartas'] },
  { nombre: 'Tarta de verduras con ensalada',             tipo: 'especial', tiene_guarnicion: false, tags: ['Vegetariano', 'Tartas'] },
  { nombre: 'Soufflé de espinaca con arroz',              tipo: 'especial', tiene_guarnicion: false, tags: ['Vegetariano'] },
  { nombre: 'Buñuelos de arroz con ensalada',             tipo: 'especial', tiene_guarnicion: false, tags: ['Vegetariano'] },
  { nombre: 'Salpicón',                                   tipo: 'especial', tiene_guarnicion: false, tags: ['Ensaladas'] },
];

// Menús hardcodeados: 2 platos por día, 5 días
// Índice 0 = semana -2, 1 = semana -1, 2 = semana actual, 3 = semana +1
const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];

const MENUS_SEMANAS = [
  { // semana -2
    lunes:     { A: 'Pastel de camote',              B: 'Ravioles con bolognesa' },
    martes:    { A: 'Cerdo a la barbacoa con puré',  B: 'Tortilla de papa rellena con ensalada' },
    miercoles: { A: 'Wok de pollo',                  B: 'Guiso de lentejas' },
    jueves:    { A: 'Pan de carne con verduras asadas', B: 'Zapallitos rellenos' },
    viernes:   { A: 'Lasaña de berenjena con ensalada', B: 'Arroz con pollo' },
  },
  { // semana -1
    lunes:     { A: 'Estofado de albóndigas',         B: 'Pastel de papa' },
    martes:    { A: 'Pollo al verdeo con puré',        B: 'Ñoquis con bolognesa' },
    miercoles: { A: 'Carne al horno con vegetales',    B: 'Hamburguesas de acelga con puré' },
    jueves:    { A: 'Pata muslo al champiñon con ensalada', B: 'Canelones de JyQ con bolognesa' },
    viernes:   { A: 'Costeletas de cerdo a la Riojana', B: 'Pizza de verduras con ensalada' },
  },
  { // semana actual
    lunes:     { A: 'Pollo a la Portuguesa',           B: 'Ravioles con salsa caruso' },
    martes:    { A: 'Pastel de camote',                B: 'Wok de carne con vegetales' },
    miercoles: { A: 'Suprema capresse con puré de papas', B: 'Tallarines con albóndigas y salsa' },
    jueves:    { A: 'Cerdo al horno con papas',        B: 'Mil hojas de berenjena y zucchini' },
    viernes:   { A: 'Medallones de merluza con ensalada rusa', B: 'Tortilla de verduras con ensalada' },
  },
  { // semana +1
    lunes:     { A: 'Estofado de carne',               B: 'Lasaña de JyQ' },
    martes:    { A: 'Pollo al romero con papas rústicas', B: 'Guiso de fideos' },
    miercoles: { A: 'Pastel de papa',                  B: 'Fetuchini con salsa de hongos' },
    jueves:    { A: 'Bife a la criolla',               B: 'Tarta caprese con puré mixto' },
    viernes:   { A: 'Papillot de merluza',             B: 'Buñuelos de arroz con ensalada' },
  },
];

// ─── Empresas y empleados ─────────────────────────────────────────────────────
const EMPRESAS = [
  {
    nombre: 'Banco Hipotecario',
    slug: 'banco-hipotecario',
    plan: 'con_postre',
    modo_pedido: 'semanal',
    email: 'admin@bancohipotecario.com',
    telefono: '+54 261 420-1000',
    empleados: [
      { nombre: 'Ana',       apellido: 'Pérez',     email: 'ana.perez@bh.test' },
      { nombre: 'Carlos',    apellido: 'Rodríguez', email: 'carlos.rodriguez@bh.test' },
      { nombre: 'Lucía',     apellido: 'Martínez',  email: 'lucia.martinez@bh.test' },
      { nombre: 'Diego',     apellido: 'López',     email: 'diego.lopez@bh.test' },
      { nombre: 'Valentina', apellido: 'García',    email: 'valentina.garcia@bh.test' },
    ],
  },
  {
    nombre: 'Clínica del Sol',
    slug: 'clinica-del-sol',
    plan: 'basico',
    modo_pedido: 'semanal',
    email: 'contacto@clinicadelsol.com',
    telefono: '+54 261 430-2000',
    empleados: [
      { nombre: 'Sofía',    apellido: 'Torres',    email: 'sofia.torres@sol.test' },
      { nombre: 'Martín',   apellido: 'Sánchez',   email: 'martin.sanchez@sol.test' },
      { nombre: 'Florencia',apellido: 'Ruiz',       email: 'florencia.ruiz@sol.test' },
      { nombre: 'Ramiro',   apellido: 'Gómez',     email: 'ramiro.gomez@sol.test' },
      { nombre: 'Camila',   apellido: 'Fernández', email: 'camila.fernandez@sol.test' },
    ],
  },
  {
    nombre: 'Estudio Ferreyra',
    slug: 'estudio-ferreyra',
    plan: 'con_postre_bebida',
    modo_pedido: 'semanal',
    email: 'info@estudioferreyra.com',
    telefono: '+54 261 445-3000',
    empleados: [
      { nombre: 'Pablo',    apellido: 'Morales',   email: 'pablo.morales@ef.test' },
      { nombre: 'Natalia',  apellido: 'Romero',    email: 'natalia.romero@ef.test' },
      { nombre: 'Sebastián',apellido: 'Díaz',      email: 'sebastian.diaz@ef.test' },
      { nombre: 'Julia',    apellido: 'Herrera',   email: 'julia.herrera@ef.test' },
      { nombre: 'Agustín',  apellido: 'Castro',    email: 'agustin.castro@ef.test' },
    ],
  },
  {
    nombre: 'TEST',
    slug: 'test',
    plan: 'con_postre',
    modo_pedido: 'semanal',
    email: 'test@test.com',
    telefono: '+54 261 000-0000',
    empleados: [
      { nombre: 'Test',     apellido: 'Usuario',   email: 'test@test.com', password: '12345678' },
      { nombre: 'María',    apellido: 'Prueba',    email: 'maria.prueba@test.test' },
      { nombre: 'Roberto',  apellido: 'Demo',      email: 'roberto.demo@test.test' },
      { nombre: 'Laura',    apellido: 'Ejemplo',   email: 'laura.ejemplo@test.test' },
      { nombre: 'Jorge',    apellido: 'Testing',   email: 'jorge.testing@test.test' },
    ],
  },
];

// Probabilidades de participación por semana (0 = nadie, 1 = todos)
const PROB_PEDIDO = {
  '-2': 0.70,   // 2 semanas atrás: la mayoría sí
  '-1': 0.80,   // semana pasada: casi todos
  '0':  0.65,   // semana actual: bastante participación
  '+1': 0.40,   // próxima: más floja (todavía temprano)
};

const NOTAS_OPCIONALES = [
  null, null, null, null,
  'Sin cebolla',
  'Sin picante',
  'Poca sal por favor',
  'Sin ajo',
];

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🌱  seed-full-reset — Iniciando...\n');

  const ahora = new Date().toISOString();
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // ── 1. Limpiar todo ────────────────────────────────────────────────────────
    console.log('🗑   Limpiando base de datos...');
    await client.query(`
      TRUNCATE
        pedido_eventos, pedido_items, pedidos,
        historial_uso_platos,
        menu_semanal_sin_servicio, menu_semanal_dias, menus_semanales,
        empleados, usuarios_admin, empresas,
        guarniciones, platos
      RESTART IDENTITY CASCADE
    `);
    console.log('    ✓ Tablas vaciadas\n');

    // ── 2. Superadmin ──────────────────────────────────────────────────────────
    console.log('👤  Creando superadmin...');
    const adminHash = await bcrypt.hash(SUPERADMIN.password, 10);
    await client.query(
      `INSERT INTO usuarios_admin (nombre, apellido, email, password_hash, rol)
       VALUES ($1, $2, $3, $4, 'superadmin')`,
      [SUPERADMIN.nombre, SUPERADMIN.apellido, SUPERADMIN.email, adminHash]
    );
    console.log(`    ✓ ${SUPERADMIN.email} / (ver SUPERADMIN_PASSWORD o default)\n`);

    // ── 3. Guarniciones ────────────────────────────────────────────────────────
    console.log('🥗  Insertando guarniciones...');
    for (const nombre of GUARNICIONES) {
      await client.query(
        `INSERT INTO guarniciones (nombre) VALUES ($1) ON CONFLICT (nombre) DO NOTHING`,
        [nombre]
      );
    }
    const guarnRes = await client.query(`SELECT id FROM guarniciones WHERE activo = true ORDER BY id`);
    const guarnIds = guarnRes.rows.map(r => r.id);
    console.log(`    ✓ ${GUARNICIONES.length} guarniciones\n`);

    // ── 4. Platos ──────────────────────────────────────────────────────────────
    console.log('🍽   Insertando platos fijos...');
    for (const p of PLATOS_FIJOS) {
      await client.query(
        `INSERT INTO platos (nombre, tipo, tiene_guarnicion, tags, activo)
         VALUES ($1, 'fijo', $2, $3, true)
         ON CONFLICT (nombre) DO UPDATE SET tipo='fijo', tiene_guarnicion=EXCLUDED.tiene_guarnicion, tags=EXCLUDED.tags`,
        [p.nombre, p.tiene_guarnicion, p.tags]
      );
    }
    console.log(`    ✓ ${PLATOS_FIJOS.length} platos fijos`);

    console.log('🍽   Insertando platos variables...');
    const vistos = new Set();
    let varCount = 0;
    for (const p of PLATOS_VARIABLES) {
      const key = p.nombre.toLowerCase().trim();
      if (vistos.has(key)) continue;
      vistos.add(key);
      await client.query(
        `INSERT INTO platos (nombre, tipo, tiene_guarnicion, tags, activo)
         VALUES ($1, $2, $3, $4, true)
         ON CONFLICT (nombre) DO UPDATE SET tipo=EXCLUDED.tipo, tiene_guarnicion=EXCLUDED.tiene_guarnicion, tags=EXCLUDED.tags`,
        [p.nombre, p.tipo, p.tiene_guarnicion, p.tags]
      );
      varCount++;
    }
    console.log(`    ✓ ${varCount} platos variables\n`);

    // Cache de IDs de platos por nombre normalizado
    const platosAllRes = await client.query(`SELECT id, nombre FROM platos WHERE activo = true`);
    const platoByNombre = new Map(platosAllRes.rows.map(p => [p.nombre.toLowerCase().trim(), p.id]));

    function getPlatoId(nombre) {
      const id = platoByNombre.get(nombre.toLowerCase().trim());
      if (!id) throw new Error(`Plato no encontrado: "${nombre}"`);
      return id;
    }

    // ── 5. Menus semanales ─────────────────────────────────────────────────────
    console.log('📅  Creando menús semanales...');
    const SEMANA_OFFSETS = [-2, -1, 0, +1];
    const menuIds = {};

    for (let i = 0; i < SEMANA_OFFSETS.length; i++) {
      const offset = SEMANA_OFFSETS[i];
      const lunes = getLunes(offset);
      const domingo = getDomingo(lunes);

      // Estado según la posición temporal
      let estado, publicado_at, cerrado_at;
      if (offset < 0) {
        estado = 'cerrado';
        publicado_at = ahora;
        cerrado_at = ahora;
      } else if (offset === 0) {
        estado = 'publicado';
        publicado_at = ahora;
        cerrado_at = null;
      } else {
        estado = 'borrador';
        publicado_at = null;
        cerrado_at = null;
      }

      const [y, m, d] = lunes.split('-').map(Number);
      const lunDt = new Date(y, m - 1, d);
      const domDt = new Date(y, m - 1, d + 6);
      const fmt = (dt) => `${dt.getDate()}/${dt.getMonth() + 1}`;
      const nombre = `Semana del ${fmt(lunDt)} al ${fmt(domDt)}`;

      // fecha_limite_pedidos: viernes de la semana anterior a las 12:00
      const fechaLimite = new Date(y, m - 1, d - 3); // viernes anterior
      fechaLimite.setHours(12, 0, 0, 0);

      const menuRes = await client.query(
        `INSERT INTO menus_semanales
           (nombre, fecha_inicio, fecha_fin, estado, publicado_at, cerrado_at, fecha_limite_pedidos)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [nombre, lunes, domingo, estado, publicado_at, cerrado_at, fechaLimite.toISOString()]
      );
      const menuId = menuRes.rows[0].id;
      menuIds[offset] = { id: menuId, lunes, estado };

      // Insertar dias del menú
      const menuData = MENUS_SEMANAS[i];
      for (const dia of DIAS) {
        const opciones = menuData[dia];
        if (!opciones) continue;
        for (const [opcion, nombrePlato] of Object.entries(opciones)) {
          const platoId = getPlatoId(nombrePlato);
          await client.query(
            `INSERT INTO menu_semanal_dias (menu_semanal_id, dia, opcion, plato_id)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (menu_semanal_id, dia, opcion) DO UPDATE SET plato_id = EXCLUDED.plato_id`,
            [menuId, dia, opcion, platoId]
          );

          // Historial para semanas pasadas
          if (offset < 0) {
            const diaIdx = DIAS.indexOf(dia);
            const [fy, fm, fd] = lunes.split('-').map(Number);
            const fechaServ = new Date(fy, fm - 1, fd + diaIdx);
            await client.query(
              `INSERT INTO historial_uso_platos
                 (plato_id, plato_nombre_snapshot, menu_semanal_id, dia, opcion, fecha_servicio)
               VALUES ($1, $2, $3, $4, $5, $6)
               ON CONFLICT DO NOTHING`,
              [platoId, nombrePlato, menuId, dia, opcion, fechaServ.toISOString().split('T')[0]]
            );
          }
        }
      }

      const lockIcon = estado === 'cerrado' ? '🔒' : estado === 'publicado' ? '✅' : '📝';
      console.log(`    ${lockIcon} ${nombre} [${estado}] — id=${menuId}`);
    }
    console.log();

    // ── 6. Empresas + empleados + pedidos ──────────────────────────────────────
    const defaultHash = await bcrypt.hash('Laquinta2024!', 10);
    const testHash = await bcrypt.hash('12345678', 10);

    for (const emp of EMPRESAS) {
      console.log(`🏢  ${emp.nombre}`);

      const empRes = await client.query(
        `INSERT INTO empresas (nombre, slug, plan, modo_pedido, email, telefono)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [emp.nombre, emp.slug, emp.plan, emp.modo_pedido, emp.email, emp.telefono]
      );
      const empresaId = empRes.rows[0].id;

      const empleadosCreados = [];
      for (const persona of emp.empleados) {
        const hash = persona.password ? await bcrypt.hash(persona.password, 10) : defaultHash;
        const emlRes = await client.query(
          `INSERT INTO empleados (empresa_id, nombre, apellido, email, password_hash, rol)
           VALUES ($1, $2, $3, $4, $5, 'cliente')
           RETURNING id, nombre, apellido, email`,
          [empresaId, persona.nombre, persona.apellido, persona.email, hash]
        );
        empleadosCreados.push(emlRes.rows[0]);
        const passLabel = persona.password ? ` [pwd: ${persona.password}]` : '';
        console.log(`    👤 ${persona.nombre} ${persona.apellido} — ${persona.email}${passLabel}`);
      }

      // Pedidos por semana
      const SEMANAS_PEDIDOS = [
        { offset: -2, prob: PROB_PEDIDO['-2'], estado: 'confirmado' },
        { offset: -1, prob: PROB_PEDIDO['-1'], estado: 'confirmado' },
        { offset:  0, prob: PROB_PEDIDO['0'],  estado: 'pendiente'  },
        { offset: +1, prob: PROB_PEDIDO['+1'], estado: 'pendiente'  },
      ];

      for (const { offset, prob, estado: estadoPedido } of SEMANAS_PEDIDOS) {
        const { id: menuId, lunes: semanaInicio } = menuIds[offset];

        for (const empleado of empleadosCreados) {
          // Test user siempre hace pedido en semana actual y la próxima
          const esTest = empleado.email === 'test@test.com';
          const hacePedido = esTest ? (offset <= 0) : Math.random() < prob;
          if (!hacePedido) continue;

          const pedidoRes = await client.query(
            `INSERT INTO pedidos (empleado_id, empresa_id, menu_semanal_id, semana_inicio, estado)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id`,
            [empleado.id, empresaId, menuId, semanaInicio, estadoPedido]
          );
          const pedidoId = pedidoRes.rows[0].id;

          // Evento inicial
          await client.query(
            `INSERT INTO pedido_eventos
               (pedido_id, tipo, actor_tipo, actor_nombre, estado_nuevo, resumen, metadata)
             VALUES ($1, 'pedido_creado', 'empleado', $2, $3, 'Pedido creado por seed', '{}')`,
            [pedidoId, `${empleado.nombre} ${empleado.apellido}`, estadoPedido]
          );

          // Items: 3-5 días aleatorios
          const menuData = MENUS_SEMANAS[SEMANA_OFFSETS.indexOf(offset)];
          const diasConMenu = DIAS.filter(d => menuData[d]);
          const diasElegidos = shuffle(diasConMenu).slice(0, 3 + Math.floor(Math.random() * 3));

          for (const dia of diasElegidos) {
            const opciones = Object.keys(menuData[dia]);
            const opcionElegida = pick(opciones); // 'A' o 'B'
            const platoNombre = menuData[dia][opcionElegida];
            const platoId = getPlatoId(platoNombre);
            const notas = pick(NOTAS_OPCIONALES);

            await client.query(
              `INSERT INTO pedido_items (pedido_id, dia, plato_id, opcion, notas)
               VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT (pedido_id, dia) DO NOTHING`,
              [pedidoId, dia, platoId, opcionElegida, notas]
            );
          }
        }
      }

      // Conteo rápido de pedidos de esta empresa
      const { rows: [{ count }] } = await client.query(
        `SELECT COUNT(*) FROM pedidos WHERE empresa_id = $1`, [empresaId]
      );
      console.log(`    📦 ${count} pedidos en 4 semanas\n`);
    }

    await client.query('COMMIT');

    // ── 7. Resumen final ───────────────────────────────────────────────────────
    const [platosTotal, guarnTotal, menusTotal, empresasTotal, empleadosTotal, pedidosTotal] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM platos`),
      pool.query(`SELECT COUNT(*) FROM guarniciones`),
      pool.query(`SELECT COUNT(*) FROM menus_semanales`),
      pool.query(`SELECT COUNT(*) FROM empresas`),
      pool.query(`SELECT COUNT(*) FROM empleados`),
      pool.query(`SELECT COUNT(*) FROM pedidos`),
    ]);

    console.log('═'.repeat(55));
    console.log('✅  Seed completado exitosamente');
    console.log('═'.repeat(55));
    console.log(`  Platos         : ${platosTotal.rows[0].count}`);
    console.log(`  Guarniciones   : ${guarnTotal.rows[0].count}`);
    console.log(`  Menús semanales: ${menusTotal.rows[0].count} (2 cerrados, 1 publicado, 1 borrador)`);
    console.log(`  Empresas       : ${empresasTotal.rows[0].count}`);
    console.log(`  Empleados      : ${empleadosTotal.rows[0].count}`);
    console.log(`  Pedidos totales: ${pedidosTotal.rows[0].count}`);
    console.log('─'.repeat(55));
    console.log('  👑 SUPERADMIN');
    console.log(`     Email    : ${SUPERADMIN.email}`);
    console.log(`     Password : ${process.env.SUPERADMIN_PASSWORD ? '(desde env)' : SUPERADMIN.password}`);
    console.log('─'.repeat(55));
    console.log('  🧪 USUARIO TEST');
    console.log('     Email    : test@test.com');
    console.log('     Password : 12345678');
    console.log('     Empresa  : TEST');
    console.log('─'.repeat(55));
    console.log('  📧 Emails de empleados: nombre.apellido@empresa.test');
    console.log('     Password default   : Laquinta2024!');
    console.log('     (excepto test@test.com que tiene 12345678)');
    console.log('═'.repeat(55));

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('\n❌  Error en seed, rollback ejecutado:', err.message);
    if (process.env.DEBUG) console.error(err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(e => { console.error(e); process.exit(1); });
