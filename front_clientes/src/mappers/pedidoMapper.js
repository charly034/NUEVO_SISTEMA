import { SIN_PEDIDO_ID, TIPOS_OPERACION_PEDIDO } from "../constants/estadosPedido.js";
import { contarSeleccionesValidas } from "../utils/reglasSeleccionPedido.js";
import { crearIdDesdeTexto } from "../utils/texto.js";

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
        opcion: sinPedido ? null : dia.seleccion?.plato?.opcion || null,
      };
    });
}

function obtenerMenuSemanalId(semana) {
  const valor = (
    semana?.metadata?.menuSemanalId ||
    semana?.metadata?.menuSemana?.menu?.id ||
    semana?.metadata?.pedido?.menu_semanal_id ||
    null
  );
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0 ? numero : null;
}

export function construirPayloadCrearPedido({ semana }) {
  return {
    semanaId: semana.id,
    menuSemanalId: obtenerMenuSemanalId(semana),
    tipoOperacion: TIPOS_OPERACION_PEDIDO.CREAR,
    dias: mapearDiasPayload(semana),
  };
}

export function construirPayloadActualizarPedido({ pedidoId, semana }) {
  return {
    pedidoId,
    semanaId: semana.id,
    menuSemanalId: obtenerMenuSemanalId(semana),
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
  const pedido = apiPedido?.pedido || apiPedido?.data?.pedido || apiPedido;

  return {
    id: pedido?.id || apiPedido?.id || null,
    estado: pedido?.estado || apiPedido?.estado || null,
    mensaje: apiPedido?.mensaje || apiPedido?.message || "",
    semanaId: pedido?.semanaId || pedido?.semana_inicio || apiPedido?.semanaId || null,
    dias: pedido?.dias || apiPedido?.dias || [],
    fechaConfirmacion: pedido?.fechaConfirmacion || pedido?.fecha_confirmacion || null,
    fechaUltimaModificacion:
      pedido?.fechaUltimaModificacion || pedido?.updated_at || apiPedido?.actualizadoEn || null,
  };
}
