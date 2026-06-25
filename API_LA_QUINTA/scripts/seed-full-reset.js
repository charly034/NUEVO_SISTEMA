#!/usr/bin/env node
/**
 * seed-full-reset.js
 *
 * Resetea TODA la base de datos y crea un ambiente de testing completo:
 *   ✓ Superadmin
 *   ✓ Todos los platos (fijos, especiales, ambos) y guarniciones
 *   ✓ 22 semanas históricas de menús (desde CSV)
 *   ✓ 3 empresas de prueba + 1 empresa TEST
 *   ✓ 5 empleados por empresa (nombres únicos)
 *   ✓ Pedidos realistas en 2 semanas pasadas, semana actual y próxima
 *   ✓ Usuario TEST: test@test.com / 12345678
 *
 * Uso: node scripts/seed-full-reset.js
 * ⚠ BORRA TODO. Solo para entornos de desarrollo/testing.
 */

import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import pool, { getClient } from '../src/database/connection.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5); }

// ─── CSV — misma lógica que seed-menus-completo.js ───────────────────────────
const FECHAS_INICIO = [
  '2026-01-26', '2026-02-02', '2026-02-09', '2026-02-16', '2026-02-23',
  '2026-03-02', '2026-03-09', '2026-03-16', '2026-03-23', '2026-04-06',
  '2026-04-13', '2026-04-20', '2026-04-27', '2026-05-04', '2026-05-11',
  '2026-05-18', '2026-05-25', '2026-06-01', '2026-06-08', '2026-06-15',
  '2026-06-22', '2026-06-29',
];

const ROW_MAP = [
  { dia: 'lunes',     opcion: 'A', offset: 0 },
  { dia: 'lunes',     opcion: 'C', offset: 0 },
  { dia: 'martes',    opcion: 'A', offset: 1 },
  { dia: 'martes',    opcion: 'C', offset: 1 },
  { dia: 'miercoles', opcion: 'A', offset: 2 },
  { dia: 'miercoles', opcion: 'C', offset: 2 },
  { dia: 'jueves',    opcion: 'A', offset: 3 },
  { dia: 'jueves',    opcion: 'C', offset: 3 },
  { dia: 'viernes',   opcion: 'A', offset: 4 },
  { dia: 'viernes',   opcion: 'C', offset: 4 },
];

function domingoDe(fechaInicio) {
  const [y, m, d] = fechaInicio.split('-').map(Number);
  const dom = new Date(y, m - 1, d + 6);
  return dom.toISOString().split('T')[0];
}

function nombreSemana(fechaInicio) {
  const [y, m, d] = fechaInicio.split('-').map(Number);
  const lun = new Date(y, m - 1, d);
  const dom = new Date(y, m - 1, d + 6);
  const fmt = dt => `${dt.getDate()}/${dt.getMonth() + 1}`;
  return `Semana del ${fmt(lun)} al ${fmt(dom)}`;
}

function estadoDe(fechaInicio) {
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
  const [y, m, d] = fechaInicio.split('-').map(Number);
  const lunes = new Date(y, m - 1, d);
  const domingo = new Date(y, m - 1, d + 6);
  if (hoy > domingo) return 'cerrado';
  if (hoy >= lunes)  return 'publicado';
  return 'borrador';
}

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
  return content.split(/\r?\n/).map(line => line.split(','));
}

function fechaServicioDe(fechaInicio, offset) {
  const [y, m, d] = fechaInicio.split('-').map(Number);
  const dt = new Date(y, m - 1, d + offset);
  return dt.toISOString().split('T')[0];
}

// ─── Platos ───────────────────────────────────────────────────────────────────
const GUARNICIONES = [
  'Ensalada Rusa', 'Ensalada Mixta', 'Ensalada de remolacha',
  'Ensalada de tomate cherry', 'Verduras Asadas', 'Puré de Papas',
  'Puré de calabaza', 'Papas al Horno', 'Ensalada de rúcula',
  'Arroz primavera', 'Ensalada de arroz con lentejas', 'Zanahoria rallada',
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
  { nombre: 'Estofado de albóndigas',              tipo: 'ambos',    tiene_guarnicion: false, tags: ['Carnes', 'Guisos'] },
  { nombre: 'Ravioles con bolognesa',              tipo: 'ambos',    tiene_guarnicion: false, tags: ['Pasta'] },
  { nombre: 'Pastel de papa',                      tipo: 'ambos',    tiene_guarnicion: false, tags: ['Vegetariano'] },
  { nombre: 'Pastel de camote',                    tipo: 'ambos',    tiene_guarnicion: false, tags: ['Vegetariano'] },
  { nombre: 'Zapallitos rellenos',                 tipo: 'ambos',    tiene_guarnicion: false, tags: ['Vegetariano'] },
  { nombre: 'Cerdo a la barbacoa con puré',        tipo: 'ambos',    tiene_guarnicion: false, tags: ['Cerdo'] },
  { nombre: 'Arroz con pollo',                     tipo: 'especial', tiene_guarnicion: false, tags: ['Pollo'] },
  { nombre: 'Pata muslo al champiñon con ensalada',         tipo: 'especial', tiene_guarnicion: false, tags: ['Pollo'] },
  { nombre: 'Pata muslo al champiñon con puré de zapallo',  tipo: 'especial', tiene_guarnicion: false, tags: ['Pollo'] },
  { nombre: 'Pollo al verdeo con puré',            tipo: 'especial', tiene_guarnicion: false, tags: ['Pollo'] },
  { nombre: 'Milanesa de pollo napolitana con puré',        tipo: 'especial', tiene_guarnicion: false, tags: ['Pollo', 'Milanesas'] },
  { nombre: 'Milanesa de pollo napolitana con rusa',        tipo: 'especial', tiene_guarnicion: false, tags: ['Pollo', 'Milanesas'] },
  { nombre: 'Pollo a la mostaza con puré',         tipo: 'especial', tiene_guarnicion: false, tags: ['Pollo'] },
  { nombre: 'Pollo al limón con puré de zapallo',  tipo: 'especial', tiene_guarnicion: false, tags: ['Pollo'] },
  { nombre: 'Rollitos de pollo con puré',          tipo: 'especial', tiene_guarnicion: false, tags: ['Pollo'] },
  { nombre: 'Pollo al romero con papas rústicas',  tipo: 'especial', tiene_guarnicion: false, tags: ['Pollo'] },
  { nombre: 'Wok de pollo',                        tipo: 'especial', tiene_guarnicion: false, tags: ['Pollo'] },
  { nombre: 'Pollo a la Portuguesa',               tipo: 'especial', tiene_guarnicion: false, tags: ['Pollo'] },
  { nombre: 'Pollo a la crema con arroz primavera',tipo: 'especial', tiene_guarnicion: false, tags: ['Pollo'] },
  { nombre: 'Suprema capresse con puré de papas',  tipo: 'especial', tiene_guarnicion: false, tags: ['Pollo'] },
  { nombre: 'Tacos de pollo con ensalada',         tipo: 'especial', tiene_guarnicion: false, tags: ['Pollo'] },
  { nombre: 'Tarta de pollo con ensalada',         tipo: 'especial', tiene_guarnicion: false, tags: ['Pollo', 'Tartas'] },
  { nombre: 'Hamburguesa de carne con puré de papas',    tipo: 'especial', tiene_guarnicion: false, tags: ['Carnes', 'Hamburguesas'] },
  { nombre: 'Hamburguesa de carne con ensalada',         tipo: 'especial', tiene_guarnicion: false, tags: ['Carnes', 'Hamburguesas'] },
  { nombre: 'Hamburguesa de carne a la suiza con arroz', tipo: 'especial', tiene_guarnicion: false, tags: ['Carnes', 'Hamburguesas'] },
  { nombre: 'Napolitana de carne con papas',       tipo: 'especial', tiene_guarnicion: false, tags: ['Carnes', 'Milanesas'] },
  { nombre: 'Napolitana de carne con puré de papas',     tipo: 'especial', tiene_guarnicion: false, tags: ['Carnes', 'Milanesas'] },
  { nombre: 'Pan de carne con verduras asadas',    tipo: 'especial', tiene_guarnicion: false, tags: ['Carnes'] },
  { nombre: 'Pan de carne con ensalada',           tipo: 'especial', tiene_guarnicion: false, tags: ['Carnes'] },
  { nombre: 'Pan de carne con papas al horno',     tipo: 'especial', tiene_guarnicion: false, tags: ['Carnes'] },
  { nombre: 'Carne a la olla',                     tipo: 'especial', tiene_guarnicion: false, tags: ['Carnes', 'Guisos'] },
  { nombre: 'Carne al horno con vegetales',        tipo: 'especial', tiene_guarnicion: false, tags: ['Carnes'] },
  { nombre: 'Wok de carne con vegetales',          tipo: 'especial', tiene_guarnicion: false, tags: ['Carnes'] },
  { nombre: 'Bife a la criolla',                   tipo: 'especial', tiene_guarnicion: false, tags: ['Carnes'] },
  { nombre: 'Estofado de carne',                   tipo: 'especial', tiene_guarnicion: false, tags: ['Carnes', 'Guisos'] },
  { nombre: 'Hamburguesas de carne con papas al horno',  tipo: 'especial', tiene_guarnicion: false, tags: ['Carnes', 'Hamburguesas'] },
  { nombre: 'Costeletas de cerdo a la Riojana',    tipo: 'especial', tiene_guarnicion: false, tags: ['Cerdo'] },
  { nombre: 'Costeletas de cerdo con verduras al horno', tipo: 'especial', tiene_guarnicion: false, tags: ['Cerdo'] },
  { nombre: 'Cerdo al horno con papas',            tipo: 'especial', tiene_guarnicion: false, tags: ['Cerdo'] },
  { nombre: 'Wok de cerdo',                        tipo: 'especial', tiene_guarnicion: false, tags: ['Cerdo'] },
  { nombre: 'Risotto de cerdo',                    tipo: 'especial', tiene_guarnicion: false, tags: ['Cerdo'] },
  { nombre: 'Cerdo a la Barbacoa con puré mixto',  tipo: 'especial', tiene_guarnicion: false, tags: ['Cerdo'] },
  { nombre: 'Medallones de merluza con ensalada rusa',   tipo: 'especial', tiene_guarnicion: false, tags: ['Pescado'] },
  { nombre: 'Medallones de merluza con puré de papas',   tipo: 'especial', tiene_guarnicion: false, tags: ['Pescado'] },
  { nombre: 'Filet de merluza con puré de papas',  tipo: 'especial', tiene_guarnicion: false, tags: ['Pescado'] },
  { nombre: 'Papillot de merluza',                 tipo: 'especial', tiene_guarnicion: false, tags: ['Pescado'] },
  { nombre: 'Arroz con calamar',                   tipo: 'especial', tiene_guarnicion: false, tags: ['Pescado'] },
  { nombre: 'Tarta de atún con remolacha y zanahoria',   tipo: 'especial', tiene_guarnicion: false, tags: ['Pescado', 'Tartas'] },
  { nombre: 'Canelones de JyQ con salsa fileto',   tipo: 'especial', tiene_guarnicion: false, tags: ['Pasta'] },
  { nombre: 'Canelones de JyQ con bolognesa',      tipo: 'especial', tiene_guarnicion: false, tags: ['Pasta'] },
  { nombre: 'Ravioles de jamón y queso con fileto',      tipo: 'especial', tiene_guarnicion: false, tags: ['Pasta'] },
  { nombre: 'Ravioles de acelga y ricota con bolognesa', tipo: 'especial', tiene_guarnicion: false, tags: ['Pasta', 'Vegetariano'] },
  { nombre: 'Ravioles con salsa caruso',           tipo: 'especial', tiene_guarnicion: false, tags: ['Pasta'] },
  { nombre: 'Ñoquis con bolognesa',                tipo: 'especial', tiene_guarnicion: false, tags: ['Pasta'] },
  { nombre: 'Fetuchini con salsa de hongos',       tipo: 'especial', tiene_guarnicion: false, tags: ['Pasta'] },
  { nombre: 'Lasaña de JyQ',                       tipo: 'especial', tiene_guarnicion: false, tags: ['Pasta'] },
  { nombre: 'Lasaña de berenjena con ensalada',    tipo: 'especial', tiene_guarnicion: false, tags: ['Pasta', 'Vegetariano'] },
  { nombre: 'Lasaña de berenjena',                 tipo: 'especial', tiene_guarnicion: false, tags: ['Pasta', 'Vegetariano'] },
  { nombre: 'Lasaña de zucchini',                  tipo: 'especial', tiene_guarnicion: false, tags: ['Pasta', 'Vegetariano'] },
  { nombre: 'Sorrentinos de calabaza con bolognesa',     tipo: 'especial', tiene_guarnicion: false, tags: ['Pasta', 'Vegetariano'] },
  { nombre: 'Tallarines con albóndigas y salsa',   tipo: 'especial', tiene_guarnicion: false, tags: ['Pasta', 'Carnes'] },
  { nombre: 'Tallarines con salsa caruso',         tipo: 'especial', tiene_guarnicion: false, tags: ['Pasta'] },
  { nombre: 'Tallarines de espinacas con mixta',   tipo: 'especial', tiene_guarnicion: false, tags: ['Pasta', 'Vegetariano'] },
  { nombre: 'Polenta con queso y bolognesa',       tipo: 'especial', tiene_guarnicion: false, tags: ['Vegetariano'] },
  { nombre: 'Spaghetti con salsa de champiñones',  tipo: 'especial', tiene_guarnicion: false, tags: ['Pasta', 'Vegetariano'] },
  { nombre: 'Tortilla de papa rellena con ensalada',     tipo: 'especial', tiene_guarnicion: false, tags: ['Vegetariano'] },
  { nombre: 'Tortilla de verduras con ensalada',   tipo: 'especial', tiene_guarnicion: false, tags: ['Vegetariano'] },
  { nombre: 'Tortilla de Verdura con ensalada',    tipo: 'especial', tiene_guarnicion: false, tags: ['Vegetariano'] },
  { nombre: 'Ensalada Cesar',                      tipo: 'especial', tiene_guarnicion: false, tags: ['Ensaladas', 'Vegetariano'] },
  { nombre: 'Ensalada Cesar con arroz integral',   tipo: 'especial', tiene_guarnicion: false, tags: ['Ensaladas', 'Vegetariano'] },
  { nombre: 'Mil hojas de berenjena y zucchini',   tipo: 'especial', tiene_guarnicion: false, tags: ['Vegetariano'] },
  { nombre: 'Milanesa de berenjena napolitana con ensalada', tipo: 'especial', tiene_guarnicion: false, tags: ['Vegetariano', 'Milanesas'] },
  { nombre: 'Milanesa de calabaza napolitana con ensalada',  tipo: 'especial', tiene_guarnicion: false, tags: ['Vegetariano', 'Milanesas'] },
  { nombre: 'Guiso de lentejas',                   tipo: 'especial', tiene_guarnicion: false, tags: ['Vegetariano', 'Guisos'] },
  { nombre: 'Guiso de fideos',                     tipo: 'especial', tiene_guarnicion: false, tags: ['Guisos'] },
  { nombre: 'Guiso de mondongo',                   tipo: 'especial', tiene_guarnicion: false, tags: ['Carnes', 'Guisos'] },
  { nombre: 'Croquetas de papa con ensalada',      tipo: 'especial', tiene_guarnicion: false, tags: ['Vegetariano'] },
  { nombre: 'Croquetas de vegetales y semillas con ensalada', tipo: 'especial', tiene_guarnicion: false, tags: ['Vegetariano'] },
  { nombre: 'Bomba de papa rellena con ensalada',  tipo: 'especial', tiene_guarnicion: false, tags: ['Vegetariano'] },
  { nombre: 'Hamburguesas de acelga con puré',     tipo: 'especial', tiene_guarnicion: false, tags: ['Vegetariano', 'Hamburguesas'] },
  { nombre: 'Hamburguesas de acelga a la napo con ensalada', tipo: 'especial', tiene_guarnicion: false, tags: ['Vegetariano', 'Hamburguesas'] },
  { nombre: 'Hamburguesa de pollo napolitana con pure de zapallo', tipo: 'especial', tiene_guarnicion: false, tags: ['Pollo', 'Hamburguesas'] },
  { nombre: 'Pizza de verduras con ensalada',      tipo: 'especial', tiene_guarnicion: false, tags: ['Vegetariano'] },
  { nombre: 'Tarta caprese con puré mixto',        tipo: 'especial', tiene_guarnicion: false, tags: ['Vegetariano', 'Tartas'] },
  { nombre: 'Tarta de verduras con ensalada',      tipo: 'especial', tiene_guarnicion: false, tags: ['Vegetariano', 'Tartas'] },
  { nombre: 'Soufflé de espinaca con arroz',       tipo: 'especial', tiene_guarnicion: false, tags: ['Vegetariano'] },
  { nombre: 'Buñuelos de arroz con ensalada',      tipo: 'especial', tiene_guarnicion: false, tags: ['Vegetariano'] },
  { nombre: 'Salpicón',                            tipo: 'especial', tiene_guarnicion: false, tags: ['Ensaladas'] },
  { nombre: 'Torrejas de arroz y jamón con puré de zapallo', tipo: 'especial', tiene_guarnicion: false, tags: ['Cerdo'] },
  { nombre: 'Rotolo de verdura con salsa bolognesa',         tipo: 'especial', tiene_guarnicion: false, tags: ['Vegetariano', 'Pasta'] },
  { nombre: 'Escalopes a la marsala con fideos',   tipo: 'especial', tiene_guarnicion: false, tags: ['Carnes', 'Pasta'] },
  { nombre: 'Escalopes con ensalada',              tipo: 'especial', tiene_guarnicion: false, tags: ['Carnes'] },
  { nombre: 'Zapallitos rellenos con carne',       tipo: 'especial', tiene_guarnicion: false, tags: ['Carnes', 'Vegetariano'] },
  { nombre: 'Zapallito relleno con salsa fileto',  tipo: 'especial', tiene_guarnicion: false, tags: ['Vegetariano'] },
  { nombre: 'Pollo al horno con vegetales',        tipo: 'especial', tiene_guarnicion: false, tags: ['Pollo'] },
  { nombre: 'Hamburguesa de lentejas con puré de zapallo', tipo: 'especial', tiene_guarnicion: false, tags: ['Vegetariano', 'Hamburguesas'] },
  { nombre: 'Puchero',                             tipo: 'especial', tiene_guarnicion: false, tags: ['Carnes', 'Guisos'] },
  { nombre: 'Alitas rebozadas con puré',           tipo: 'especial', tiene_guarnicion: false, tags: ['Pollo'] },
  { nombre: 'Wok de arroz y ternera',              tipo: 'especial', tiene_guarnicion: false, tags: ['Carnes'] },
];

// ─── Empresas y empleados ─────────────────────────────────────────────────────
const EMPRESAS = [
  {
    nombre: 'Banco Hipotecario',
    slug: 'banco-hipotecario',
    plan: 'con_postre',
    modo_pedido: 'semanal',
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
    empleados: [
      { nombre: 'Sofía',     apellido: 'Torres',    email: 'sofia.torres@sol.test' },
      { nombre: 'Martín',    apellido: 'Sánchez',   email: 'martin.sanchez@sol.test' },
      { nombre: 'Florencia', apellido: 'Ruiz',      email: 'florencia.ruiz@sol.test' },
      { nombre: 'Ramiro',    apellido: 'Gómez',     email: 'ramiro.gomez@sol.test' },
      { nombre: 'Camila',    apellido: 'Fernández', email: 'camila.fernandez@sol.test' },
    ],
  },
  {
    nombre: 'Estudio Ferreyra',
    slug: 'estudio-ferreyra',
    plan: 'con_postre_bebida',
    modo_pedido: 'semanal',
    empleados: [
      { nombre: 'Pablo',     apellido: 'Morales',   email: 'pablo.morales@ef.test' },
      { nombre: 'Natalia',   apellido: 'Romero',    email: 'natalia.romero@ef.test' },
      { nombre: 'Sebastián', apellido: 'Díaz',      email: 'sebastian.diaz@ef.test' },
      { nombre: 'Julia',     apellido: 'Herrera',   email: 'julia.herrera@ef.test' },
      { nombre: 'Agustín',   apellido: 'Castro',    email: 'agustin.castro@ef.test' },
    ],
  },
  {
    nombre: 'TEST',
    slug: 'test',
    plan: 'con_postre',
    modo_pedido: 'semanal',
    empleados: [
      { nombre: 'Test',    apellido: 'Usuario',  email: 'test@test.com',         password: '12345678' },
      { nombre: 'María',   apellido: 'Prueba',   email: 'maria.prueba@test.test' },
      { nombre: 'Roberto', apellido: 'Demo',     email: 'roberto.demo@test.test' },
      { nombre: 'Laura',   apellido: 'Ejemplo',  email: 'laura.ejemplo@test.test' },
      { nombre: 'Jorge',   apellido: 'Testing',  email: 'jorge.testing@test.test' },
    ],
  },
];

const PROB_PEDIDO = { '-2': 0.70, '-1': 0.80, '0': 0.65, '+1': 0.40 };
const NOTAS_OPCIONALES = [null, null, null, null, 'Sin cebolla', 'Sin picante', 'Poca sal', 'Sin ajo'];

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
    const adminEmail = process.env.SUPERADMIN_EMAIL || 'admin@laquinta.com';
    const adminPass  = process.env.SUPERADMIN_PASSWORD || 'admin12345';
    const adminHash  = await bcrypt.hash(adminPass, 10);
    await client.query(
      `INSERT INTO usuarios_admin (nombre, apellido, email, password_hash, rol)
       VALUES ($1, $2, $3, $4, 'superadmin')`,
      ['Carlos', 'La Quinta', adminEmail, adminHash]
    );
    console.log(`    ✓ ${adminEmail}\n`);

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
    console.log('🍽   Insertando platos...');
    for (const p of PLATOS_FIJOS) {
      await client.query(
        `INSERT INTO platos (nombre, tipo, tiene_guarnicion, tags, activo)
         VALUES ($1, 'fijo', $2, $3, true)
         ON CONFLICT (nombre) DO UPDATE SET tipo='fijo', tiene_guarnicion=EXCLUDED.tiene_guarnicion, tags=EXCLUDED.tags`,
        [p.nombre, p.tiene_guarnicion, p.tags]
      );
    }
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
    console.log(`    ✓ ${PLATOS_FIJOS.length} fijos + ${varCount} variables\n`);

    // ── 5. Menús históricos desde CSV ──────────────────────────────────────────
    console.log('📅  Importando menús históricos desde CSV...');
    const csvPath = join(__dirname, '../src/database/seeds/menus-historicos.csv');
    const rows = parseCSV(readFileSync(csvPath, 'utf-8'));

    // Cache de platos por nombre normalizado (auto-crea si no existe)
    const platoCache = new Map();
    const platosExistentesRes = await client.query(`SELECT id, nombre FROM platos WHERE activo = true`);
    for (const p of platosExistentesRes.rows) {
      platoCache.set(p.nombre.toLowerCase().trim(), p.id);
    }

    async function getOrCreatePlatoId(nombre) {
      const key = nombre.toLowerCase().trim();
      if (platoCache.has(key)) return platoCache.get(key);
      // Buscar aproximado
      const res = await client.query(
        `SELECT id, nombre FROM platos WHERE LOWER(nombre) ILIKE $1 LIMIT 1`,
        [`%${key.replace(/\s+/g, '%')}%`]
      );
      if (res.rows.length > 0) {
        platoCache.set(key, res.rows[0].id);
        return res.rows[0].id;
      }
      // Crear nuevo
      const ins = await client.query(
        `INSERT INTO platos (nombre, activo) VALUES ($1, true) RETURNING id`,
        [nombre.trim()]
      );
      console.log(`    [nuevo plato desde CSV] ${nombre.trim()}`);
      platoCache.set(key, ins.rows[0].id);
      return ins.rows[0].id;
    }

    // Map: fecha_inicio → menu_id (para luego crear pedidos)
    const menuIdPorFecha = new Map();
    let totalDias = 0;

    for (let semIdx = 0; semIdx < FECHAS_INICIO.length; semIdx++) {
      const csvCol = semIdx + 1;
      const fechaInicio = FECHAS_INICIO[semIdx];
      const fechaFin    = domingoDe(fechaInicio);
      const nombre      = nombreSemana(fechaInicio);
      const estado      = estadoDe(fechaInicio);

      // fecha_limite_pedidos: viernes de la semana anterior a las 12:00
      const [y, m, d] = fechaInicio.split('-').map(Number);
      const fechaLimite = new Date(y, m - 1, d - 3);
      fechaLimite.setHours(12, 0, 0, 0);

      const menuRes = await client.query(
        `INSERT INTO menus_semanales
           (nombre, fecha_inicio, fecha_fin, estado, publicado_at, cerrado_at, fecha_limite_pedidos)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id`,
        [
          nombre, fechaInicio, fechaFin, estado,
          estado !== 'borrador' ? ahora : null,
          estado === 'cerrado' ? ahora : null,
          fechaLimite.toISOString(),
        ]
      );
      const menuId = menuRes.rows[0].id;
      menuIdPorFecha.set(fechaInicio, menuId);

      const feriadosDelDia = new Set();
      let platosImportados = 0;

      for (let rowOff = 0; rowOff < ROW_MAP.length; rowOff++) {
        const csvRow = rows[rowOff + 1];
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
               VALUES ($1, $2, 'Feriado') ON CONFLICT (menu_semanal_id, dia) DO NOTHING`,
              [menuId, dia]
            );
          }
          continue;
        }

        const platoId = await getOrCreatePlatoId(parsed.nombre);

        await client.query(
          `INSERT INTO menu_semanal_dias (menu_semanal_id, dia, opcion, plato_id)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (menu_semanal_id, dia, opcion) DO UPDATE SET plato_id = EXCLUDED.plato_id`,
          [menuId, dia, parsed.opcion, platoId]
        );
        platosImportados++;

        // Historial para semanas cerradas
        if (estado === 'cerrado') {
          const fechaServicio = fechaServicioDe(fechaInicio, offset);
          await client.query(
            `INSERT INTO historial_uso_platos
               (plato_id, plato_nombre_snapshot, menu_semanal_id, dia, opcion, fecha_servicio)
             VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT DO NOTHING`,
            [platoId, parsed.nombre, menuId, dia, parsed.opcion, fechaServicio]
          );
        }
        totalDias++;
      }

      const icon = estado === 'cerrado' ? '🔒' : estado === 'publicado' ? '✅' : '📝';
      console.log(`    ${icon} ${nombre} [${estado}] — ${platosImportados} platos`);
    }
    console.log(`    ✓ ${FECHAS_INICIO.length} semanas, ${totalDias} entradas de menú\n`);

    // ── 6. Empresas + empleados + pedidos ──────────────────────────────────────
    // Semanas objetivo para pedidos: -2, -1, actual, próxima
    const SEMANAS_PEDIDOS = [
      { offset: -2, key: '-2', estadoPedido: 'confirmado' },
      { offset: -1, key: '-1', estadoPedido: 'confirmado' },
      { offset:  0, key:  '0', estadoPedido: 'pendiente'  },
      { offset: +1, key: '+1', estadoPedido: 'pendiente'  },
    ];

    // Pre-cargar los platos disponibles por menuId (para elegir al crear items)
    const menuItems = new Map(); // menuId → [{ dia, opcion, plato_id }]
    for (const { offset } of SEMANAS_PEDIDOS) {
      const fechaLunes = getLunes(offset);
      const menuId = menuIdPorFecha.get(fechaLunes);
      if (!menuId) {
        console.warn(`    ⚠ No hay menú para semana ${fechaLunes} (offset ${offset})`);
        continue;
      }
      const diasRes = await client.query(
        `SELECT dia, opcion, plato_id FROM menu_semanal_dias WHERE menu_semanal_id = $1`,
        [menuId]
      );
      menuItems.set(menuId, diasRes.rows);
    }

    const defaultHash = await bcrypt.hash('Laquinta2024!', 10);
    const testHash    = await bcrypt.hash('12345678', 10);

    for (const emp of EMPRESAS) {
      console.log(`🏢  ${emp.nombre}`);

      const empRes = await client.query(
        `INSERT INTO empresas (nombre, slug, plan, modo_pedido)
         VALUES ($1, $2, $3, $4) RETURNING id`,
        [emp.nombre, emp.slug, emp.plan, emp.modo_pedido]
      );
      const empresaId = empRes.rows[0].id;

      const empleadosCreados = [];
      for (const persona of emp.empleados) {
        const hash = persona.password ? await bcrypt.hash(persona.password, 10) : defaultHash;
        const emlRes = await client.query(
          `INSERT INTO empleados (empresa_id, nombre, apellido, email, password_hash, rol)
           VALUES ($1, $2, $3, $4, $5, 'cliente') RETURNING id, nombre, apellido, email`,
          [empresaId, persona.nombre, persona.apellido, persona.email, hash]
        );
        empleadosCreados.push(emlRes.rows[0]);
        const tag = persona.password ? ` 🔑 ${persona.password}` : '';
        console.log(`    👤 ${persona.nombre} ${persona.apellido} — ${persona.email}${tag}`);
      }

      let pedidosEmpresa = 0;
      for (const { offset, key, estadoPedido } of SEMANAS_PEDIDOS) {
        const fechaLunes = getLunes(offset);
        const menuId = menuIdPorFecha.get(fechaLunes);
        if (!menuId) continue;
        const diasDisponibles = menuItems.get(menuId) ?? [];
        if (diasDisponibles.length === 0) continue;

        // Agrupar opciones por día
        const porDia = {};
        for (const item of diasDisponibles) {
          if (!porDia[item.dia]) porDia[item.dia] = [];
          porDia[item.dia].push(item);
        }
        const diasConOpciones = Object.entries(porDia);

        for (const empleado of empleadosCreados) {
          const esTest = empleado.email === 'test@test.com';
          const hacePedido = esTest ? (offset <= 0) : Math.random() < PROB_PEDIDO[key];
          if (!hacePedido) continue;

          const pedidoRes = await client.query(
            `INSERT INTO pedidos (empleado_id, empresa_id, menu_semanal_id, semana_inicio, estado)
             VALUES ($1, $2, $3, $4, $5) RETURNING id`,
            [empleado.id, empresaId, menuId, fechaLunes, estadoPedido]
          );
          const pedidoId = pedidoRes.rows[0].id;

          await client.query(
            `INSERT INTO pedido_eventos
               (pedido_id, tipo, actor_tipo, actor_nombre, estado_nuevo, resumen, metadata)
             VALUES ($1, 'pedido_creado', 'empleado', $2, $3, 'Pedido creado por seed de testing', '{}')`,
            [pedidoId, `${empleado.nombre} ${empleado.apellido}`, estadoPedido]
          );

          // Elegir 3-5 días al azar y una opción por día
          const diasElegidos = shuffle(diasConOpciones).slice(0, 3 + Math.floor(Math.random() * 3));
          for (const [dia, opciones] of diasElegidos) {
            const itemElegido = pick(opciones);
            await client.query(
              `INSERT INTO pedido_items (pedido_id, dia, plato_id, opcion, notas)
               VALUES ($1, $2, $3, $4, $5) ON CONFLICT (pedido_id, dia) DO NOTHING`,
              [pedidoId, dia, itemElegido.plato_id, itemElegido.opcion, pick(NOTAS_OPCIONALES)]
            );
          }
          pedidosEmpresa++;
        }
      }

      console.log(`    📦 ${pedidosEmpresa} pedidos en 4 semanas\n`);
    }

    await client.query('COMMIT');

    // ── 7. Resumen ─────────────────────────────────────────────────────────────
    const [pT, gT, mT, eT, emT, pdT, hT] = await Promise.all([
      pool.query(`SELECT COUNT(*) FROM platos`),
      pool.query(`SELECT COUNT(*) FROM guarniciones`),
      pool.query(`SELECT COUNT(*) FROM menus_semanales`),
      pool.query(`SELECT COUNT(*) FROM empresas`),
      pool.query(`SELECT COUNT(*) FROM empleados`),
      pool.query(`SELECT COUNT(*) FROM pedidos`),
      pool.query(`SELECT COUNT(*) FROM historial_uso_platos`),
    ]);

    console.log('═'.repeat(58));
    console.log('✅  Seed completado exitosamente');
    console.log('═'.repeat(58));
    console.log(`  Platos            : ${pT.rows[0].count}`);
    console.log(`  Guarniciones      : ${gT.rows[0].count}`);
    console.log(`  Menús semanales   : ${mT.rows[0].count} (historial completo CSV)`);
    console.log(`  Historial uso     : ${hT.rows[0].count} entradas`);
    console.log(`  Empresas          : ${eT.rows[0].count}`);
    console.log(`  Empleados         : ${emT.rows[0].count}`);
    console.log(`  Pedidos           : ${pdT.rows[0].count} (4 semanas × 4 empresas)`);
    console.log('─'.repeat(58));
    console.log('  👑 SUPERADMIN');
    console.log(`     ${adminEmail}  /  ${process.env.SUPERADMIN_PASSWORD ? '(env)' : adminPass}`);
    console.log('─'.repeat(58));
    console.log('  🧪 USUARIO TEST');
    console.log('     test@test.com  /  12345678  (empresa: TEST)');
    console.log('─'.repeat(58));
    console.log('  👥 Otros empleados: nombre.apellido@empresa.test  /  Laquinta2024!');
    console.log('═'.repeat(58));

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
