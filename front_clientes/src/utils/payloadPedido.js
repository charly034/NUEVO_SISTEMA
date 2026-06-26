import { opcionSinPedido } from "../data/opcionesMenuMock.js";

function obtenerIdPlato(plato) {
  return plato?.platoId || plato?.id || null;
}

function obtenerIdGuarnicion(guarnicion) {
  if (!guarnicion || typeof guarnicion === "string") return null;
  return guarnicion.id || guarnicion.guarnicionId || null;
}

export function construirPayloadPedido({
  empresaId,
  semana,
  tipoOperacion,
  usuarioId,
}) {
  return {
    empresaId,
    usuarioId,
    semanaId: semana.id,
    tipoOperacion,
    dias: (semana.dias || [])
      .filter((dia) => dia.seleccion?.plato)
      .map((dia) => {
        const platoId = obtenerIdPlato(dia.seleccion.plato);
        const sinPedido = platoId === opcionSinPedido.id;

        return {
          diaId: dia.id || dia.clave,
          fecha: dia.fecha,
          platoId: sinPedido ? null : platoId,
          guarnicionId: obtenerIdGuarnicion(dia.seleccion.guarnicion),
          sinPedido,
        };
      }),
  };
}
