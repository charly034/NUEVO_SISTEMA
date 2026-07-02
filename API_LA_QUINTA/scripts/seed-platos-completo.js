#!/usr/bin/env node
/**
 * seed-platos-completo.js
 * Inserta/actualiza todas las guarniciones y platos del sistema:
 *   - Platos FIJOS (del seed original + base)
 *   - Platos ESPECIALES (solo aparecen en rotación semanal, CSV <6 semanas)
 *   - Platos AMBOS (aparecen ≥6 semanas en el CSV, o coinciden con fijo)
 *
 * Uso: node scripts/seed-platos-completo.js
 */

import pool, { getClient } from '../src/database/connection.js';
import { normalizarClave } from './menu-normalizacion.js';

// ── Guarniciones ───────────────────────────────────────────────────────────────
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

// ── Platos FIJOS ───────────────────────────────────────────────────────────────
// Siempre disponibles, no rotan semanalmente
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

// ── Platos del CSV histórico ───────────────────────────────────────────────────
// tipo: 'especial' si aparece <6 semanas, 'ambos' si aparece ≥6 semanas
// (o coincide con un plato fijo → 'ambos')
//
// Conteo real de apariciones por semana (22 semanas analizadas):
//
// POLLO / AVES
//   Arroz con pollo                    → 4 veces  → especial
//   Pata Muslo al champiñon            → 5 veces  → especial  (agrupado: "Pata muslo al champiñon con ensalada", "con puré de zapallo")
//   Pollo al verdeo con puré           → 4 veces  → especial
//   Milanesa de pollo napolitana       → 3 veces  → especial
//   Pollo a la mostaza con puré        → 1 vez    → especial
//   Pollo al limón con puré de zapallo → 3 veces  → especial
//   Rollitos de pollo con puré         → 2 veces  → especial  (agrupado variantes)
//   Pollo al romero con papas rústicas → 2 veces  → especial
//   Wok de pollo                       → 5 veces  → especial
//   Pollo a la Portuguesa              → 3 veces  → especial
//   Pollo al escabeche con budín de calabaza → 1 vez → especial
//   Pollo a la crema con arroz primavera → 1 vez  → especial
//   Hamburguesa de pollo napolitana    → 1 vez    → especial
//   Suprema capresse con puré de papas → 2 veces  → especial
//   Tacos de pollo con ensalada        → 3 veces  → especial
//   Spaghetti con salsa de champiñones → 1 vez    → especial
//   Tarta de pollo con ensalada        → 1 vez    → especial
//
// CARNES / VACUNO
//   Hamburguesa de carne con puré      → 4 veces  → especial  (agrupado variantes)
//   Estofado de albóndigas             → 6 veces  → ambos
//   Napolitana de carne con papas      → 4 veces  → especial
//   Pan de carne                       → 4 veces  → especial  (agrupado variantes)
//   Carne a la olla                    → 3 veces  → especial
//   Carne al horno con vegetales       → 4 veces  → especial
//   Wok de carne con vegetales         → 2 veces  → especial
//   Hígado ensebollado con puré        → 1 vez    → especial
//   Bife a la criolla                  → 2 veces  → especial
//   Hamburguesa a la suiza con arroz   → 1 vez    → especial
//   Tacos de carne con ensalada        → 1 vez    → especial
//   Wok de arroz y ternera             → 2 veces  → especial
//
// CERDO
//   Cerdo a la barbacoa con puré       → 6 veces  → ambos     (agrupado variantes con puré mixto)
//   Costeletas de cerdo a la Riojana   → 5 veces  → especial  (agrupado variantes)
//   Cerdo al horno con papas           → 1 vez    → especial
//   Wok de cerdo                       → 2 veces  → especial
//   Risotto de Cerdo                   → 1 vez    → especial
//   Alitas rebozadas con puré          → 1 vez    → especial
//
// PESCADO
//   Medallones de merluza              → 4 veces  → especial  (agrupado: con ensalada rusa, con puré)
//   Filet de merluza con puré de papas → 1 vez    → especial
//   Papillot de merluza                → 2 veces  → especial
//   Bomba de papa rellena con ensalada → 2 veces  → especial
//   Arroz con calamar                  → 1 vez    → especial
//
// PASTA / GRANOS
//   Canelones de JyQ con salsa fileto  → 5 veces  → especial  (agrupado variantes bolognesa/fileto)
//   Ravioles con bolognesa             → 6 veces  → ambos
//   Ñoquis con bolognesa               → 4 veces  → especial  (agrupado variantes)
//   Fetuchini con salsa de hongos      → 3 veces  → especial
//   Lasaña de JyQ                      → 1 vez    → especial
//   Ravioles de jamón y queso          → 2 veces  → especial
//   Ravioles de acelga y ricota        → 1 vez    → especial
//   Sorrentinos de calabaza con bolognesa → 1 vez → especial
//   Tallarines con albóndigas          → 3 veces  → especial
//   Tallarines con salsa caruso        → 3 veces  → especial
//   Tallarines de espinacas con mixta  → 2 veces  → especial
//   Polenta con queso y bolognesa      → 1 vez    → especial
//   Polenta cremosa con cebolla caramelizada → 1 vez → especial
//   Spaguetti de espinaca con estofado → 1 vez    → especial
//   Ravioles con salsa caruso          → 3 veces  → especial
//   Ravioles de calabaza con salsa blanca → 1 vez → especial
//   Lasaña de berenjena                → 3 veces  → especial
//   Lasaña de zucchini                 → 1 vez    → especial
//
// VEGETARIANO
//   Pastel de papa                     → 7 veces  → ambos
//   Pastel de camote                   → 10 veces → ambos
//   Zapallitos Rellenos                → 8 veces  → ambos     (agrupado variantes)
//   Tortilla de papa rellena           → 4 veces  → especial
//   Tortilla de verduras               → 5 veces  → especial
//   Berenjenas rellenas con ensalada   → 1 vez    → especial
//   Ensalada Cesar                     → 3 veces  → especial
//   Wok de vegetales/cerdo/pollo (genérico)
//   Mil hojas de berenjena y zucchini  → 3 veces  → especial
//   Milanesa de berenjena napolitana   → 2 veces  → especial
//   Milanesa de zucchini napolitana    → 1 vez    → especial
//   Milanesa de calabaza napolitana    → 1 vez    → especial
//   Lasaña de JyQ                      → 1 vez    → especial
//   Guiso de lentejas                  → 5 veces  → especial
//   Guiso de fideos                    → 1 vez    → especial
//   Guiso de mondongo                  → 1 vez    → especial
//   Guiso de albóndigas con verduras   → 1 vez    → especial
//   Salpicón                           → 2 veces  → especial
//   Croquetas de papa con ensalada     → 2 veces  → especial
//   Croquetas de vegetales y semillas  → 1 vez    → especial
//   Bomba de papa rellena              → 2 veces  → especial
//   Torrejas de arroz y jamón          → 2 veces  → especial
//   Hamburguesas de acelga             → 5 veces  → especial  (agrupado variantes)
//   Hamburguesas de lentejas           → 1 vez    → especial
//   Canelones de JyQ con bolognesa     → agrupado con fileto
//   Rollitos de pollo con puré de zapallo → agrupado rollitos
//   Pizza de verduras con ensalada     → 2 veces  → especial
//   Puchero                            → 1 vez    → especial
//   Tarta caprese con puré mixto       → 1 vez    → especial
//   Tarta de atún con remolacha        → 2 veces  → especial
//   Tarta bicolor con ensalada         → 2 veces  → especial
//   Tarta de verduras con ensalada     → 3 veces  → especial
//   Ensalada Cesar con arroz integral  → agrupado ensalada cesar
//   Fetuchini de espinaca con estofado → 1 vez    → especial
//   Soufflé de espinaca con arroz      → 1 vez    → especial
//   Milhojas de papa con ensalada      → 1 vez    → especial
//   Buñuelos de arroz con ensalada     → 2 veces  → especial
//   Escalopes a la marsala con fideos  → 1 vez    → especial
//   Escalopes con ensalada             → 1 vez    → especial
//   Rotolo de verdura con salsa bolognesa → 1 vez → especial
//   Pollo a la portuguesa / clásico    → agrupado
//   Cerdo a la Barbacoa con puré mixto → agrupado cerdo barbacoa

const PLATOS_CSV = [
  // ── TIPO: ambos (≥6 apariciones en CSV) ─────────────────────────────────────
  { nombre: 'Estofado de albóndigas',              tipo: 'ambos',    tiene_guarnicion: false, tags: ['Carnes', 'Guisos'] },
  { nombre: 'Ravioles con bolognesa',              tipo: 'ambos',    tiene_guarnicion: false, tags: ['Pasta'] },
  { nombre: 'Pastel de papa',                      tipo: 'ambos',    tiene_guarnicion: false, tags: ['Vegetariano'] },
  { nombre: 'Pastel de camote',                    tipo: 'ambos',    tiene_guarnicion: false, tags: ['Vegetariano'] },
  { nombre: 'Zapallitos rellenos',                 tipo: 'ambos',    tiene_guarnicion: false, tags: ['Vegetariano'] },
  { nombre: 'Cerdo a la barbacoa con puré',        tipo: 'ambos',    tiene_guarnicion: false, tags: ['Cerdo'] },

  // ── TIPO: especial — POLLO ───────────────────────────────────────────────────
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
  { nombre: 'Pollo al escabeche con budín de calabaza',     tipo: 'especial', tiene_guarnicion: false, tags: ['Pollo'] },
  { nombre: 'Pollo a la crema con arroz primavera',         tipo: 'especial', tiene_guarnicion: false, tags: ['Pollo'] },
  { nombre: 'Hamburguesa de pollo napolitana con puré de zapallo', tipo: 'especial', tiene_guarnicion: false, tags: ['Pollo', 'Hamburguesas'] },
  { nombre: 'Suprema capresse con puré de papas',           tipo: 'especial', tiene_guarnicion: false, tags: ['Pollo'] },
  { nombre: 'Tacos de pollo con ensalada',                  tipo: 'especial', tiene_guarnicion: false, tags: ['Pollo'] },
  { nombre: 'Spaghetti con salsa de champiñones',           tipo: 'especial', tiene_guarnicion: false, tags: ['Pasta', 'Vegetariano'] },
  { nombre: 'Tarta de pollo con ensalada',                  tipo: 'especial', tiene_guarnicion: false, tags: ['Pollo', 'Tartas'] },

  // ── TIPO: especial — CARNES / VACUNO ────────────────────────────────────────
  { nombre: 'Hamburguesa de carne con puré de papas',    tipo: 'especial', tiene_guarnicion: false, tags: ['Carnes', 'Hamburguesas'] },
  { nombre: 'Hamburguesa de carne con ensalada',         tipo: 'especial', tiene_guarnicion: false, tags: ['Carnes', 'Hamburguesas'] },
  { nombre: 'Hamburguesa de carne a la suiza con arroz', tipo: 'especial', tiene_guarnicion: false, tags: ['Carnes', 'Hamburguesas'] },
  { nombre: 'Napolitana de carne con papas',             tipo: 'especial', tiene_guarnicion: false, tags: ['Carnes', 'Milanesas'] },
  { nombre: 'Napolitana de carne con puré de papas',     tipo: 'especial', tiene_guarnicion: false, tags: ['Carnes', 'Milanesas'] },
  { nombre: 'Pan de carne con verduras asadas',          tipo: 'especial', tiene_guarnicion: false, tags: ['Carnes'] },
  { nombre: 'Pan de carne con ensalada',                 tipo: 'especial', tiene_guarnicion: false, tags: ['Carnes'] },
  { nombre: 'Pan de carne con papas al horno',           tipo: 'especial', tiene_guarnicion: false, tags: ['Carnes'] },
  { nombre: 'Carne a la olla',                           tipo: 'especial', tiene_guarnicion: false, tags: ['Carnes', 'Guisos'] },
  { nombre: 'Carne al horno con vegetales',              tipo: 'especial', tiene_guarnicion: false, tags: ['Carnes'] },
  { nombre: 'Wok de carne con vegetales',                tipo: 'especial', tiene_guarnicion: false, tags: ['Carnes'] },
  { nombre: 'Hígado ensebollado con puré',               tipo: 'especial', tiene_guarnicion: false, tags: ['Carnes'] },
  { nombre: 'Bife a la criolla',                         tipo: 'especial', tiene_guarnicion: false, tags: ['Carnes'] },
  { nombre: 'Tacos de carne con ensalada',               tipo: 'especial', tiene_guarnicion: false, tags: ['Carnes'] },
  { nombre: 'Wok de arroz y ternera',                    tipo: 'especial', tiene_guarnicion: false, tags: ['Carnes'] },
  { nombre: 'Estofado de carne',                         tipo: 'especial', tiene_guarnicion: false, tags: ['Carnes', 'Guisos'] },
  { nombre: 'Hamburguesas de carne con papas al horno',  tipo: 'especial', tiene_guarnicion: false, tags: ['Carnes', 'Hamburguesas'] },

  // ── TIPO: especial — CERDO ───────────────────────────────────────────────────
  { nombre: 'Costeletas de cerdo a la Riojana',          tipo: 'especial', tiene_guarnicion: false, tags: ['Cerdo'] },
  { nombre: 'Costeletas de cerdo a la Riojana con puré', tipo: 'especial', tiene_guarnicion: false, tags: ['Cerdo'] },
  { nombre: 'Costeletas de cerdo con verduras al horno', tipo: 'especial', tiene_guarnicion: false, tags: ['Cerdo'] },
  { nombre: 'Cerdo al horno con papas',                  tipo: 'especial', tiene_guarnicion: false, tags: ['Cerdo'] },
  { nombre: 'Wok de cerdo',                              tipo: 'especial', tiene_guarnicion: false, tags: ['Cerdo'] },
  { nombre: 'Risotto de cerdo',                          tipo: 'especial', tiene_guarnicion: false, tags: ['Cerdo'] },
  { nombre: 'Alitas rebozadas con puré',                 tipo: 'especial', tiene_guarnicion: false, tags: ['Pollo'] },
  { nombre: 'Cerdo a la Barbacoa con puré mixto',        tipo: 'especial', tiene_guarnicion: false, tags: ['Cerdo'] },

  // ── TIPO: especial — PESCADO ─────────────────────────────────────────────────
  { nombre: 'Medallones de merluza con ensalada rusa',   tipo: 'especial', tiene_guarnicion: false, tags: ['Pescado'] },
  { nombre: 'Medallones de merluza con puré de papas',   tipo: 'especial', tiene_guarnicion: false, tags: ['Pescado'] },
  { nombre: 'Filet de merluza con puré de papas',        tipo: 'especial', tiene_guarnicion: false, tags: ['Pescado'] },
  { nombre: 'Papillot de merluza',                       tipo: 'especial', tiene_guarnicion: false, tags: ['Pescado'] },
  { nombre: 'Arroz con calamar',                         tipo: 'especial', tiene_guarnicion: false, tags: ['Pescado'] },
  { nombre: 'Tarta de atún con remolacha y zanahoria',   tipo: 'especial', tiene_guarnicion: false, tags: ['Pescado', 'Tartas'] },

  // ── TIPO: especial — PASTA / GRANOS ─────────────────────────────────────────
  { nombre: 'Canelones de JyQ con salsa fileto',         tipo: 'especial', tiene_guarnicion: false, tags: ['Pasta'] },
  { nombre: 'Canelones de JyQ con bolognesa',            tipo: 'especial', tiene_guarnicion: false, tags: ['Pasta'] },
  { nombre: 'Ravioles de jamón y queso con fileto',      tipo: 'especial', tiene_guarnicion: false, tags: ['Pasta'] },
  { nombre: 'Ravioles de acelga y ricota con bolognesa', tipo: 'especial', tiene_guarnicion: false, tags: ['Pasta', 'Vegetariano'] },
  { nombre: 'Ravioles con salsa caruso',                 tipo: 'especial', tiene_guarnicion: false, tags: ['Pasta'] },
  { nombre: 'Ravioles de calabaza con salsa blanca',     tipo: 'especial', tiene_guarnicion: false, tags: ['Pasta', 'Vegetariano'] },
  { nombre: 'Ñoquis con bolognesa',                      tipo: 'especial', tiene_guarnicion: false, tags: ['Pasta'] },
  { nombre: 'Fetuchini con salsa de hongos',             tipo: 'especial', tiene_guarnicion: false, tags: ['Pasta'] },
  { nombre: 'Fetuchini de espinaca con estofado',        tipo: 'especial', tiene_guarnicion: false, tags: ['Pasta'] },
  { nombre: 'Lasaña de JyQ',                            tipo: 'especial', tiene_guarnicion: false, tags: ['Pasta'] },
  { nombre: 'Lasaña de berenjena con ensalada',          tipo: 'especial', tiene_guarnicion: false, tags: ['Pasta', 'Vegetariano'] },
  { nombre: 'Lasaña de zucchini',                       tipo: 'especial', tiene_guarnicion: false, tags: ['Pasta', 'Vegetariano'] },
  { nombre: 'Sorrentinos de calabaza con bolognesa',     tipo: 'especial', tiene_guarnicion: false, tags: ['Pasta', 'Vegetariano'] },
  { nombre: 'Tallarines con albóndigas y salsa',         tipo: 'especial', tiene_guarnicion: false, tags: ['Pasta', 'Carnes'] },
  { nombre: 'Tallarines con salsa caruso',               tipo: 'especial', tiene_guarnicion: false, tags: ['Pasta'] },
  { nombre: 'Tallarines de espinacas con mixta',         tipo: 'especial', tiene_guarnicion: false, tags: ['Pasta', 'Vegetariano'] },
  { nombre: 'Polenta con queso y bolognesa',             tipo: 'especial', tiene_guarnicion: false, tags: ['Vegetariano'] },
  { nombre: 'Polenta cremosa con cebolla caramelizada y champiñones', tipo: 'especial', tiene_guarnicion: false, tags: ['Vegetariano'] },
  { nombre: 'Spaghetti de espinaca con estofado',        tipo: 'especial', tiene_guarnicion: false, tags: ['Pasta', 'Carnes'] },
  { nombre: 'Tallarines con salsa caruso',               tipo: 'especial', tiene_guarnicion: false, tags: ['Pasta'] },

  // ── TIPO: especial — VEGETARIANO / OTROS ────────────────────────────────────
  { nombre: 'Tortilla de papa rellena con ensalada',      tipo: 'especial', tiene_guarnicion: false, tags: ['Vegetariano'] },
  { nombre: 'Tortilla de verduras con ensalada',          tipo: 'especial', tiene_guarnicion: false, tags: ['Vegetariano'] },
  { nombre: 'Berenjenas rellenas con ensalada',           tipo: 'especial', tiene_guarnicion: false, tags: ['Vegetariano'] },
  { nombre: 'Ensalada Cesar',                             tipo: 'especial', tiene_guarnicion: false, tags: ['Ensaladas', 'Vegetariano'] },
  { nombre: 'Mil hojas de berenjena y zucchini',          tipo: 'especial', tiene_guarnicion: false, tags: ['Vegetariano'] },
  { nombre: 'Mil hojas de berenjena y zucchini con arroz integral', tipo: 'especial', tiene_guarnicion: false, tags: ['Vegetariano'] },
  { nombre: 'Milanesa de berenjena napolitana con ensalada', tipo: 'especial', tiene_guarnicion: false, tags: ['Vegetariano', 'Milanesas'] },
  { nombre: 'Milanesa de zucchini napolitana con puré',   tipo: 'especial', tiene_guarnicion: false, tags: ['Vegetariano', 'Milanesas'] },
  { nombre: 'Milanesa de calabaza napolitana con ensalada', tipo: 'especial', tiene_guarnicion: false, tags: ['Vegetariano', 'Milanesas'] },
  { nombre: 'Guiso de lentejas',                          tipo: 'especial', tiene_guarnicion: false, tags: ['Vegetariano', 'Guisos'] },
  { nombre: 'Guiso de fideos',                            tipo: 'especial', tiene_guarnicion: false, tags: ['Guisos'] },
  { nombre: 'Guiso de mondongo',                          tipo: 'especial', tiene_guarnicion: false, tags: ['Carnes', 'Guisos'] },
  { nombre: 'Guiso de albóndigas con verduras',           tipo: 'especial', tiene_guarnicion: false, tags: ['Carnes', 'Guisos'] },
  { nombre: 'Salpicón',                                   tipo: 'especial', tiene_guarnicion: false, tags: ['Ensaladas'] },
  { nombre: 'Croquetas de papa con ensalada',             tipo: 'especial', tiene_guarnicion: false, tags: ['Vegetariano'] },
  { nombre: 'Croquetas de vegetales y semillas con ensalada', tipo: 'especial', tiene_guarnicion: false, tags: ['Vegetariano'] },
  { nombre: 'Bomba de papa rellena con ensalada',         tipo: 'especial', tiene_guarnicion: false, tags: ['Vegetariano'] },
  { nombre: 'Torrejas de arroz y jamón con puré de zapallo', tipo: 'especial', tiene_guarnicion: false, tags: ['Cerdo'] },
  { nombre: 'Hamburguesas de acelga con puré',            tipo: 'especial', tiene_guarnicion: false, tags: ['Vegetariano', 'Hamburguesas'] },
  { nombre: 'Hamburguesas de acelga a la napo con ensalada', tipo: 'especial', tiene_guarnicion: false, tags: ['Vegetariano', 'Hamburguesas'] },
  { nombre: 'Hamburguesas de acelga napolitana con puré de zapallo', tipo: 'especial', tiene_guarnicion: false, tags: ['Vegetariano', 'Hamburguesas'] },
  { nombre: 'Hamburguesa de lentejas con puré de zapallo', tipo: 'especial', tiene_guarnicion: false, tags: ['Vegetariano', 'Hamburguesas'] },
  { nombre: 'Pizza de verduras con ensalada',             tipo: 'especial', tiene_guarnicion: false, tags: ['Vegetariano'] },
  { nombre: 'Puchero',                                    tipo: 'especial', tiene_guarnicion: false, tags: ['Carnes', 'Guisos'] },
  { nombre: 'Tarta caprese con puré mixto',               tipo: 'especial', tiene_guarnicion: false, tags: ['Vegetariano', 'Tartas'] },
  { nombre: 'Tarta bicolor con ensalada',                 tipo: 'especial', tiene_guarnicion: false, tags: ['Vegetariano', 'Tartas'] },
  { nombre: 'Tarta de verduras con ensalada',             tipo: 'especial', tiene_guarnicion: false, tags: ['Vegetariano', 'Tartas'] },
  { nombre: 'Soufflé de espinaca con arroz',              tipo: 'especial', tiene_guarnicion: false, tags: ['Vegetariano'] },
  { nombre: 'Milhojas de papa con ensalada',              tipo: 'especial', tiene_guarnicion: false, tags: ['Vegetariano'] },
  { nombre: 'Buñuelos de arroz con ensalada',             tipo: 'especial', tiene_guarnicion: false, tags: ['Vegetariano'] },
  { nombre: 'Escalopes a la marsala con fideos',          tipo: 'especial', tiene_guarnicion: false, tags: ['Carnes', 'Pasta'] },
  { nombre: 'Escalopes con ensalada',                     tipo: 'especial', tiene_guarnicion: false, tags: ['Carnes'] },
  { nombre: 'Rotolo de verdura con salsa bolognesa',      tipo: 'especial', tiene_guarnicion: false, tags: ['Vegetariano', 'Pasta'] },
  { nombre: 'Ensalada de cabello de ángel con mixta',     tipo: 'especial', tiene_guarnicion: false, tags: ['Ensaladas', 'Vegetariano'] },
  { nombre: 'Croquetas de papa con ensalada',             tipo: 'especial', tiene_guarnicion: false, tags: ['Vegetariano'] },
  { nombre: 'Zapallito relleno con salsa fileto',         tipo: 'especial', tiene_guarnicion: false, tags: ['Vegetariano'] },
  { nombre: 'Zapallitos rellenos con carne',              tipo: 'especial', tiene_guarnicion: false, tags: ['Carnes', 'Vegetariano'] },
  { nombre: 'Hamburguesa casera de pollo con vegetales asados', tipo: 'especial', tiene_guarnicion: false, tags: ['Pollo', 'Hamburguesas'] },
  { nombre: 'Pollo al horno con vegetales',               tipo: 'especial', tiene_guarnicion: false, tags: ['Pollo'] },
  { nombre: 'Pollo al limón con fideos al pesto',          tipo: 'especial', tiene_guarnicion: false, tags: ['Pollo', 'Pasta'] },
  { nombre: 'Carbonada de pollo',                          tipo: 'especial', tiene_guarnicion: false, tags: ['Pollo', 'Guisos'] },
  { nombre: 'Pata muslo con arroz primavera',              tipo: 'especial', tiene_guarnicion: false, tags: ['Pollo', 'Arroz'] },
  { nombre: 'Carne al wok con vegetales',                 tipo: 'especial', tiene_guarnicion: false, tags: ['Carnes'] },
  { nombre: 'Wok de carne con vegetales y arroz',         tipo: 'especial', tiene_guarnicion: false, tags: ['Carnes'] },
  { nombre: 'Bondiola de cerdo braseada con puré de batata', tipo: 'especial', tiene_guarnicion: false, tags: ['Cerdo'] },
  { nombre: 'Carne al horno con puré',                     tipo: 'especial', tiene_guarnicion: false, tags: ['Carnes'] },
  { nombre: 'Carne al horno con verduras grilladas',       tipo: 'especial', tiene_guarnicion: false, tags: ['Carnes'] },
  { nombre: 'Fetuchini con albóndigas',                    tipo: 'especial', tiene_guarnicion: false, tags: ['Pasta', 'Carnes'] },
  { nombre: 'Lasaña',                                      tipo: 'especial', tiene_guarnicion: false, tags: ['Pasta'] },
  { nombre: 'Lasaña de berenjena',                         tipo: 'especial', tiene_guarnicion: false, tags: ['Pasta', 'Vegetariano'] },
  { nombre: 'Ñoquis',                                      tipo: 'especial', tiene_guarnicion: false, tags: ['Pasta'] },
  { nombre: 'Pastel de calabaza',                          tipo: 'especial', tiene_guarnicion: false, tags: ['Vegetariano'] },
  { nombre: 'Tarta de atún con remolacha y zanahoria cocida', tipo: 'especial', tiene_guarnicion: false, tags: ['Pescado', 'Tartas'] },
  { nombre: 'Tortilla de papa con ensalada',               tipo: 'especial', tiene_guarnicion: false, tags: ['Vegetariano'] },
  { nombre: 'Tortilla de verduras con arroz integral',     tipo: 'especial', tiene_guarnicion: false, tags: ['Vegetariano'] },
  { nombre: 'Zapallitos rellenos con salsa fileto',        tipo: 'especial', tiene_guarnicion: false, tags: ['Vegetariano'] },
  { nombre: 'Canelones de Jamón y queso con salsa blanca', tipo: 'especial', tiene_guarnicion: false, tags: ['Pasta'] },
  { nombre: 'Ensalada Cesar con arroz integral',          tipo: 'especial', tiene_guarnicion: false, tags: ['Ensaladas', 'Vegetariano'] },
];

// ── Seed principal ─────────────────────────────────────────────────────────────
async function main() {
  const client = await getClient();

  try {
    await client.query('BEGIN');

    // 1. Guarniciones
    console.log('Insertando guarniciones...');
    for (const nombre of GUARNICIONES) {
      await client.query(
        `INSERT INTO guarniciones (nombre) VALUES ($1) ON CONFLICT (nombre) DO NOTHING`,
        [nombre]
      );
    }
    console.log(`  OK: ${GUARNICIONES.length} guarniciones procesadas`);

    // 2. Platos FIJOS
    console.log('\nInsertando platos FIJOS...');
    let fijoCount = 0;
    for (const p of PLATOS_FIJOS) {
      await client.query(
        `INSERT INTO platos (nombre, tipo, tiene_guarnicion, tags, activo)
         VALUES ($1, 'fijo', $2, $3, true)
         ON CONFLICT (nombre) DO UPDATE SET
           tipo = 'fijo',
           tiene_guarnicion = EXCLUDED.tiene_guarnicion,
           tags = EXCLUDED.tags`,
        [p.nombre, p.tiene_guarnicion, p.tags]
      );
      fijoCount++;
      console.log(`  + ${p.nombre}`);
    }
    console.log(`  OK: ${fijoCount} platos fijos`);

    // 3. Platos del CSV (especial / ambos)
    // Deduplicar por nombre normalizado antes de insertar
    const vistos = new Set();
    const platosUnicos = [];
    for (const p of PLATOS_CSV) {
      const key = normalizarClave(p.nombre);
      if (!vistos.has(key)) {
        vistos.add(key);
        platosUnicos.push(p);
      }
    }

    console.log(`\nInsertando platos del CSV (${platosUnicos.length} únicos)...`);
    let especialCount = 0;
    let ambosCount = 0;

    for (const p of platosUnicos) {
      await client.query(
        `INSERT INTO platos (nombre, tipo, tiene_guarnicion, tags, activo)
         VALUES ($1, $2, $3, $4, true)
         ON CONFLICT (nombre) DO UPDATE SET
           tipo = EXCLUDED.tipo,
           tiene_guarnicion = EXCLUDED.tiene_guarnicion,
           tags = EXCLUDED.tags`,
        [p.nombre, p.tipo, p.tiene_guarnicion, p.tags]
      );
      if (p.tipo === 'ambos') ambosCount++;
      else especialCount++;
      console.log(`  [${p.tipo}] ${p.nombre}`);
    }

    await client.query('COMMIT');

    console.log('\n=== Seed completado ===');
    console.log(`  Guarniciones : ${GUARNICIONES.length}`);
    console.log(`  Platos fijos : ${fijoCount}`);
    console.log(`  Platos especial: ${especialCount}`);
    console.log(`  Platos ambos : ${ambosCount}`);
    console.log(`  Total platos : ${fijoCount + especialCount + ambosCount}`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error en seed, rollback ejecutado:', err.message);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
