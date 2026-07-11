import { SIN_PEDIDO_ID, TIPOS_OPERACION_PEDIDO } from "../constants/estadosPedido.js";
import { contarSeleccionesValidas } from "../utils/reglasSeleccionPedido.js";
import { diaEsEditablePedido } from "../utils/permisosPedido.js";

function normalizarTexto(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function normalizarEnteroPositivo(valor) {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero > 0 ? numero : null;
}

function obtenerIdPlato(seleccion) {
  const valor = seleccion?.platoId ?? seleccion?.plato_id ?? seleccion?.plato?.platoId ?? seleccion?.plato?.plato_id ?? seleccion?.plato?.id;
  return normalizarEnteroPositivo(valor);
}

function obtenerIdGuarnicion(seleccion, dia) {
  const valorDirecto = seleccion?.guarnicionId ?? seleccion?.guarnicion_id;
  if (valorDirecto !== null && valorDirecto !== undefined && valorDirecto !== "") {
    return normalizarEnteroPositivo(valorDirecto);
  }

  const guarnicion = seleccion?.guarnicion;
  if (typeof guarnicion === "string") {
    const idDesdeTextoNumerico = normalizarEnteroPositivo(guarnicion);
    if (idDesdeTextoNumerico) return idDesdeTextoNumerico;
  } else if (guarnicion) {
    const idDesdeObjeto = normalizarEnteroPositivo(
      guarnicion.id ?? guarnicion.guarnicionId ?? guarnicion.guarnicion_id,
    );
    if (idDesdeObjeto) return idDesdeObjeto;
  }

  const nombreGuarnicion = normalizarTexto(
    seleccion?.nombreGuarnicion ||
      seleccion?.guarnicion_nombre ||
      (typeof guarnicion === "string" ? guarnicion : guarnicion?.nombre),
  );
  const textoDia = normalizarTexto(dia?.plato);
  const guarnicionPorNombre = (seleccion?.plato?.guarniciones || []).find((opcion) => {
    const nombre = normalizarTexto(opcion?.nombre ?? opcion?.guarnicion_nombre ?? opcion);
    return nombre && (nombre === nombreGuarnicion || textoDia.includes(nombre));
  });

  return normalizarEnteroPositivo(
    guarnicionPorNombre?.id ??
      guarnicionPorNombre?.guarnicionId ??
      guarnicionPorNombre?.guarnicion_id,
  );
}

function obtenerIdSalsa(seleccion, dia) {
  const valorDirecto = seleccion?.salsaId ?? seleccion?.salsa_id;
  if (valorDirecto !== null && valorDirecto !== undefined && valorDirecto !== "") {
    return normalizarEnteroPositivo(valorDirecto);
  }

  const salsa = seleccion?.salsa;
  if (typeof salsa === "string") {
    const idDesdeTextoNumerico = normalizarEnteroPositivo(salsa);
    if (idDesdeTextoNumerico) return idDesdeTextoNumerico;
  } else if (salsa) {
    const idDesdeObjeto = normalizarEnteroPositivo(
      salsa.id ?? salsa.salsaId ?? salsa.salsa_id,
    );
    if (idDesdeObjeto) return idDesdeObjeto;
  }

  const nombreSalsa = normalizarTexto(
    seleccion?.nombreSalsa ||
      seleccion?.salsa_nombre ||
      (typeof salsa === "string" ? salsa : salsa?.nombre),
  );
  const textoDia = normalizarTexto(dia?.plato);
  const salsaPorNombre = (seleccion?.plato?.salsas || []).find((opcion) => {
    const nombre = normalizarTexto(opcion?.nombre ?? opcion?.salsa_nombre ?? opcion);
    return nombre && (nombre === nombreSalsa || textoDia.includes(nombre));
  });

  return normalizarEnteroPositivo(
    salsaPorNombre?.id ??
      salsaPorNombre?.salsaId ??
      salsaPorNombre?.salsa_id,
  );
}

function mapearDiasPayload(semana) {
  return (semana.dias || [])
    .filter((dia) => dia.seleccion?.plato && diaEsEditablePedido(dia, semana))
    .map((dia) => {
      const platoId = obtenerIdPlato(dia.seleccion);
      const sinPedido = dia.seleccion.sinPedido || platoId === SIN_PEDIDO_ID;

      return {
        diaId: dia.id || dia.clave,
        fecha: dia.fecha,
        platoId: sinPedido ? null : platoId,
        guarnicionId: sinPedido ? null : obtenerIdGuarnicion(dia.seleccion, dia),
        salsaId: sinPedido ? null : obtenerIdSalsa(dia.seleccion, dia),
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
