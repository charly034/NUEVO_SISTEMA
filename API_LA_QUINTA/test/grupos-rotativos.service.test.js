import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularIndiceRotacion } from '../src/modules/grupos-rotativos/grupos-rotativos.service.js';

test('0 grupos activos devuelve null (sin fijo configurado)', () => {
  assert.equal(calcularIndiceRotacion('2026-07-06', '2026-07-13', 0), null);
});

test('1 grupo activo siempre devuelve indice 0', () => {
  assert.equal(calcularIndiceRotacion('2026-07-06', '2026-07-06', 1), 0);
  assert.equal(calcularIndiceRotacion('2026-07-06', '2026-08-03', 1), 0);
});

test('N grupos rotan semana a semana en orden', () => {
  const ancla = '2026-07-06'; // lunes, semana 0
  assert.equal(calcularIndiceRotacion(ancla, '2026-07-06', 3), 0); // semana 0
  assert.equal(calcularIndiceRotacion(ancla, '2026-07-13', 3), 1); // semana 1
  assert.equal(calcularIndiceRotacion(ancla, '2026-07-20', 3), 2); // semana 2
  assert.equal(calcularIndiceRotacion(ancla, '2026-07-27', 3), 0); // semana 3, vuelve a rotar
});

test('fechaInicioSemana anterior al ancla no da un indice negativo', () => {
  const ancla = '2026-07-06';
  // Una semana antes del ancla: semanas = -1 -> indice debe normalizarse a positivo
  const indice = calcularIndiceRotacion(ancla, '2026-06-29', 3);
  assert.ok(indice >= 0 && indice < 3, `indice debe estar en [0,3), fue ${indice}`);
  assert.equal(indice, 2);
});

test('semana salteada (feriado) sigue avanzando el ciclo correctamente', () => {
  // Aritmetica de fecha calendario, no contador de semanas creadas: saltear
  // la semana 1 (nunca se crea un menu_semanal para ella) no rompe el
  // calculo de la semana 2 -- debe dar el mismo resultado que si hubiera
  // existido.
  const ancla = '2026-07-06';
  const indiceConSemana1 = calcularIndiceRotacion(ancla, '2026-07-20', 3);
  assert.equal(indiceConSemana1, 2, 'semana 2 (saltear la 1 en la practica no cambia el calculo, es aritmetica de fecha)');
});
