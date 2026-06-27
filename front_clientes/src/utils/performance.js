const DEBUG_PERFORMANCE =
  import.meta.env.DEV || import.meta.env.VITE_DEBUG_PERFORMANCE === "true";

let contadorMediciones = 0;

function puedeMedir() {
  return (
    DEBUG_PERFORMANCE &&
    typeof performance !== "undefined" &&
    typeof performance.mark === "function" &&
    typeof performance.measure === "function"
  );
}

export function performanceHabilitada() {
  return puedeMedir();
}

export function iniciarMedicionPerformance(nombre, detalle = {}) {
  if (!puedeMedir()) return () => {};

  contadorMediciones += 1;
  const id = contadorMediciones;
  const inicio = `lq:${nombre}:inicio:${id}`;
  const fin = `lq:${nombre}:fin:${id}`;
  const medida = `lq:${nombre}:${id}`;

  performance.mark(inicio);

  return (detalleFin = {}) => {
    performance.mark(fin);
    performance.measure(medida, inicio, fin);

    const entrada = performance.getEntriesByName(medida).at(-1);
    const duracion = entrada ? Math.round(entrada.duration) : 0;
    console.debug("[La Quinta perf]", nombre, `${duracion}ms`, {
      ...detalle,
      ...detalleFin,
    });

    performance.clearMarks(inicio);
    performance.clearMarks(fin);
    performance.clearMeasures(medida);
  };
}

export async function medirPromesaPerformance(nombre, tarea, detalle = {}) {
  const finalizar = iniciarMedicionPerformance(nombre, detalle);

  try {
    const resultado = await tarea();
    finalizar({ estado: "ok" });
    return resultado;
  } catch (error) {
    finalizar({ estado: "error", status: error?.status });
    throw error;
  }
}

export function medirBloquePerformance(nombre, tarea, detalle = {}) {
  const finalizar = iniciarMedicionPerformance(nombre, detalle);

  try {
    return tarea();
  } finally {
    finalizar({ estado: "ok" });
  }
}
