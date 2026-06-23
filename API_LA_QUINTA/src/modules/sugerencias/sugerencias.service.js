import { query as dbQuery } from '../../database/connection.js';

const DIAS = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes'];
const DIA_OFFSET = { lunes: 0, martes: 1, miercoles: 2, jueves: 3, viernes: 4 };
const PROTEINAS  = ['Pollo', 'Carnes', 'Cerdo', 'Pescado'];

// Mezcla determinista según variación (sin Math.random para reproducibilidad)
function mezclarPorVariacion(arr, variacion) {
  if (variacion === 0) return arr;
  // Rotación: la variación desplaza el punto de inicio del pool de candidatos
  // v=1: omite el primer candidato top (elige el 2do mejor)
  // v=2: omite los dos primeros y además prioriza los menos usados globalmente
  const copia = [...arr];
  if (variacion === 1) {
    // Intercala el 2do con el 1ro en cada grupo de 3
    for (let i = 0; i < copia.length - 1; i += 3) {
      [copia[i], copia[i + 1]] = [copia[i + 1], copia[i]];
    }
  } else if (variacion === 2) {
    // Prioriza los menos usados globalmente (menor total_usos primero)
    copia.sort((a, b) => (a.total_usos ?? 0) - (b.total_usos ?? 0));
  }
  return copia;
}

async function generarVariacion(platos, fechaInicio, variacion, diasRotacion) {
  const ref    = new Date(fechaInicio + 'T12:00:00');
  const haceDias = new Date(ref);
  haceDias.setDate(ref.getDate() - diasRotacion);
  const hace7  = new Date(ref);
  hace7.setDate(ref.getDate() - 7);

  function score(plato, dia) {
    let s = 0;
    s += (plato.usos_por_dia?.[dia] ?? 0) * 4;
    if (plato.ultimo_uso) {
      const diff = Math.floor((ref - new Date(plato.ultimo_uso)) / 86400000);
      s += Math.min(diff, 60);
    } else {
      s += 80;
    }
    // Variación 2: bonus adicional para platos poco usados
    if (variacion === 2) s += Math.max(0, 20 - (plato.total_usos ?? 0));
    return s;
  }

  const usadosEsta = new Set();
  const sugerencias = [];

  for (const dia of DIAS) {
    const fechaDia = new Date(ref);
    fechaDia.setDate(ref.getDate() + DIA_OFFSET[dia]);
    const fecha = fechaDia.toISOString().split('T')[0];

    let pool = platos
      .filter(p => !usadosEsta.has(p.id))
      .filter(p => !p.ultimo_uso || new Date(p.ultimo_uso) < haceDias)
      .sort((a, b) => score(b, dia) - score(a, dia));

    // Fallback si hay pocos candidatos
    if (pool.length < 4) {
      pool = platos
        .filter(p => !usadosEsta.has(p.id))
        .filter(p => !p.ultimo_uso || new Date(p.ultimo_uso) < hace7)
        .sort((a, b) => score(b, dia) - score(a, dia));
    }

    pool = mezclarPorVariacion(pool, variacion);

    const opcionA = pool.find(p => p.tags?.some(t => PROTEINAS.includes(t))) ?? pool[0] ?? null;
    if (opcionA) usadosEsta.add(opcionA.id);

    const aTags = new Set(opcionA?.tags ?? []);
    const resto = pool.filter(p => !usadosEsta.has(p.id));
    const opcionC = resto.find(p => !p.tags?.some(t => aTags.has(t))) ?? resto[0] ?? null;
    if (opcionC) usadosEsta.add(opcionC.id);

    sugerencias.push({
      dia,
      fecha,
      opcionA: opcionA ? { id: opcionA.id, nombre: opcionA.nombre, tags: opcionA.tags ?? [] } : null,
      opcionC: opcionC ? { id: opcionC.id, nombre: opcionC.nombre, tags: opcionC.tags ?? [] } : null,
    });
  }

  return sugerencias;
}

export async function sugerirSemana(fechaInicio, { diasRotacion = 14 } = {}) {
  const { rows: platos } = await dbQuery(`
    SELECT
      p.id, p.nombre, p.tags,
      MAX(h.fecha_servicio) AS ultimo_uso,
      COUNT(h.id)::int      AS total_usos,
      (SELECT json_object_agg(d.dia::text, d.cnt)
       FROM (SELECT dia, COUNT(*)::int AS cnt
             FROM historial_uso_platos
             WHERE plato_id = p.id
             GROUP BY dia) d
      ) AS usos_por_dia
    FROM platos p
    LEFT JOIN historial_uso_platos h ON h.plato_id = p.id
    WHERE p.activo = true
    GROUP BY p.id, p.nombre, p.tags
  `);

  // Generar 3 variaciones en paralelo
  const [v0, v1, v2] = await Promise.all([
    generarVariacion(platos, fechaInicio, 0, diasRotacion),
    generarVariacion(platos, fechaInicio, 1, diasRotacion),
    generarVariacion(platos, fechaInicio, 2, diasRotacion),
  ]);

  return [
    { variacion: 1, label: 'Opción A',  dias: v0 },
    { variacion: 2, label: 'Opción B',  dias: v1 },
    { variacion: 3, label: 'Opción C',  dias: v2 },
  ];
}
