import { SIN_PEDIDO_ID } from "../constants/estadosPedido.js";

function obtenerIdPlato(plato) {
  return plato?.platoId || plato?.id || null;
}

function obtenerIdGuarnicion(guarnicion) {
  if (!guarnicion || typeof guarnicion === "string") return null;
  return guarnicion.id || guarnicion.guarnicionId || null;
}

function crearIdDesdeTexto(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
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
        const sinPedido = platoId === SIN_PEDIDO_ID || dia.seleccion.sinPedido;

        return {
          diaId: dia.id || dia.clave,
          fecha: dia.fecha,
          platoId: sinPedido ? null : platoId,
          guarnicionId:
            dia.seleccion.guarnicionId ||
            obtenerIdGuarnicion(dia.seleccion.guarnicion) ||
            crearIdDesdeTexto(dia.seleccion.guarnicion),
          sinPedido,
        };
      }),
  };
}
