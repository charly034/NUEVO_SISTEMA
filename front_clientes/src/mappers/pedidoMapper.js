import { SIN_PEDIDO_ID, TIPOS_OPERACION_PEDIDO } from "../constants/estadosPedido.js";
import { contarSeleccionesValidas } from "../utils/reglasSeleccionPedido.js";

function crearIdDesdeTexto(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function obtenerIdPlato(seleccion) {
  return seleccion?.platoId || seleccion?.plato?.platoId || seleccion?.plato?.id || null;
}

function obtenerIdGuarnicion(seleccion) {
  if (seleccion?.guarnicionId) return seleccion.guarnicionId;
  const guarnicion = seleccion?.guarnicion;
  if (!guarnicion) return null;
  if (typeof guarnicion === "string") return crearIdDesdeTexto(guarnicion);
  return guarnicion.id || null;
}

function mapearDiasPayload(semana) {
  return (semana.dias || [])
    .filter((dia) => dia.seleccion?.plato)
    .map((dia) => {
      const platoId = obtenerIdPlato(dia.seleccion);
      const sinPedido = dia.seleccion.sinPedido || platoId === SIN_PEDIDO_ID;

      return {
        diaId: dia.id || dia.clave,
        fecha: dia.fecha,
        platoId: sinPedido ? null : platoId,
        guarnicionId: sinPedido ? null : obtenerIdGuarnicion(dia.seleccion),
        sinPedido,
        origen: sinPedido ? dia.seleccion.origenSinPedido || "usuario" : null,
      };
    });
}

export function construirPayloadCrearPedido({ empresaId, usuarioId, semana }) {
  return {
    empresaId,
    usuarioId,
    semanaId: semana.id,
    tipoOperacion: TIPOS_OPERACION_PEDIDO.CREAR,
    dias: mapearDiasPayload(semana),
  };
}

export function construirPayloadActualizarPedido({ pedidoId, empresaId, usuarioId, semana }) {
  return {
    pedidoId,
    empresaId,
    usuarioId,
    semanaId: semana.id,
    tipoOperacion: TIPOS_OPERACION_PEDIDO.MODIFICAR,
    dias: mapearDiasPayload(semana),
  };
}

export function mapearSemanaApiAEstado(apiSemana) {
  const esSemanaSugerencias =
    Boolean(apiSemana.metadata?.esSemanaSugerencias) ||
    (apiSemana.estado === "sin_menu" && apiSemana.tipo === "proxima");

  return {
    ...apiSemana,
    diasSeleccionados: contarSeleccionesValidas(apiSemana.dias || []),
    metadata: {
      ...(apiSemana.metadata || {}),
      cantidadDias: apiSemana.dias?.length || 5,
      esSemanaSugerencias,
    },
  };
}

export function mapearPedidoApiAEstado(apiPedido) {
  return apiPedido;
}
