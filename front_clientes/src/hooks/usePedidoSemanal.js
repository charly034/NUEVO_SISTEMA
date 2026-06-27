import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ESTADOS_PEDIDO,
  IDENTIDAD_PEDIDO_DEMO,
  TIPOS_OPERACION_PEDIDO,
} from "../constants/estadosPedido.js";
import { confirmar } from "../lib/swal.js";
import {
  construirPayloadActualizarPedido,
  construirPayloadCrearPedido,
  mapearPedidoApiAEstado,
  mapearSemanaApiAEstado,
} from "../mappers/pedidoMapper.js";
import { pedidoService } from "../services/pedidoService.js";
import { medirPromesaPerformance } from "../utils/performance.js";

const indicesPedidoSemanal = new Map();
const STALE_PEDIDO_SEMANAL_MS = 10 * 60 * 1000;
const GC_PEDIDO_SEMANAL_MS = 30 * 60 * 1000;

function obtenerIndiceSemanaInicial(semanas) {
  const indiceActual = semanas.findIndex((semana) => semana.tipo === "actual");
  return indiceActual >= 0 ? indiceActual : 0;
}

function normalizarIndiceSemana(indice, semanas) {
  if (!semanas.length) return 0;
  if (!Number.isInteger(indice)) return obtenerIndiceSemanaInicial(semanas);
  return Math.min(Math.max(indice, 0), semanas.length - 1);
}

function obtenerTipoOperacion(semana) {
  return semana?.metadata?.pedidoId
    ? TIPOS_OPERACION_PEDIDO.MODIFICAR
    : TIPOS_OPERACION_PEDIDO.CREAR;
}

function obtenerFechaCache(fechaReferencia) {
  if (fechaReferencia instanceof Date) {
    return fechaReferencia.toISOString().split("T")[0];
  }

  return String(fechaReferencia || "").split("T")[0];
}

function crearClaveCachePedido({ empleado, fechaReferencia, identidadUsuario }) {
  return [
    identidadUsuario.empresaId || "sin_empresa",
    identidadUsuario.usuarioId || empleado?.id || "sin_usuario",
    obtenerFechaCache(fechaReferencia),
  ].join(":");
}

function guardarIndicePedido(clave, semanas, indiceActivo) {
  indicesPedidoSemanal.set(clave, normalizarIndiceSemana(indiceActivo, semanas));
}

export function usePedidoSemanal({
  empleado,
  fechaActual,
  service = pedidoService,
} = {}) {
  const queryClient = useQueryClient();
  const identidadUsuario = useMemo(
    () => ({
      empresaId:
        empleado?.empresa?.id ||
        empleado?.empresaId ||
        empleado?.empresa_id ||
        IDENTIDAD_PEDIDO_DEMO.empresaId,
      usuarioId: empleado?.id || empleado?.usuarioId || IDENTIDAD_PEDIDO_DEMO.usuarioId,
    }),
    [empleado],
  );
  const [fechaReferencia] = useState(() => fechaActual || new Date());
  const fechaReferenciaKey = useMemo(() => obtenerFechaCache(fechaReferencia), [fechaReferencia]);
  const claveIndice = useMemo(
    () => crearClaveCachePedido({ empleado, fechaReferencia, identidadUsuario }),
    [empleado, fechaReferencia, identidadUsuario],
  );
  const queryKeyPedidoSemanal = useMemo(
    () => [
      "pedido-semanal",
      identidadUsuario.usuarioId || "sin_usuario",
      identidadUsuario.empresaId || "sin_empresa",
      fechaReferenciaKey,
    ],
    [fechaReferenciaKey, identidadUsuario],
  );
  const [indiceActivo, setIndiceActivo] = useState(() => indicesPedidoSemanal.get(claveIndice) ?? null);
  const [modoActivo, setModoActivo] = useState({ semanaId: null, modo: "lectura" });
  const [cambiosPendientes, setCambiosPendientes] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [errorGuardado, setErrorGuardado] = useState("");
  const [feedback, setFeedback] = useState("");

  const {
    data: semanas = [],
    error: errorCargaQuery,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: queryKeyPedidoSemanal,
    queryFn: () => medirPromesaPerformance("pedido:carga-semanas", async () => {
      const semanasApi = await service.obtenerSemanasPedido({
        ...identidadUsuario,
        empleado,
        fechaReferencia,
      });
      return semanasApi.map((semana) => mapearSemanaApiAEstado(semana));
    }, { fechaReferencia: fechaReferenciaKey }),
    staleTime: STALE_PEDIDO_SEMANAL_MS,
    gcTime: GC_PEDIDO_SEMANAL_MS,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const error = useMemo(() => {
    if (!errorCargaQuery) return "";
    if (errorCargaQuery.status === 401 || errorCargaQuery.codigo === "sin_token") {
      return "No pudimos cargar tu pedido. Inicia sesion nuevamente.";
    }
    return "No pudimos cargar tu pedido. Intenta nuevamente.";
  }, [errorCargaQuery]);

  const indiceInicial = normalizarIndiceSemana(
    indiceActivo ?? obtenerIndiceSemanaInicial(semanas),
    semanas,
  );
  const cargando = isLoading && semanas.length === 0;

  const recargarPedido = useCallback(async () => {
    setErrorGuardado("");
    await refetch();
  }, [refetch, setErrorGuardado]);

  const registrarIndiceActivo = useCallback(
    (indice) => {
      const indiceNormalizado = normalizarIndiceSemana(indice, semanas);
      setIndiceActivo(indiceNormalizado);
      guardarIndicePedido(claveIndice, semanas, indiceNormalizado);
    },
    [claveIndice, semanas, setIndiceActivo],
  );

  const invalidarPedidoSemanal = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: ["pedido-semanal", identidadUsuario.usuarioId, identidadUsuario.empresaId],
    });
    queryClient.invalidateQueries({ queryKey: ["mi-historial", identidadUsuario.usuarioId] });
  }, [identidadUsuario, queryClient]);

  const cambiarModoSemana = useCallback(
    async (semanaId, modo, opciones = {}) => {
      const saleDeEdicion =
        modoActivo.modo === "edicion" &&
        (modoActivo.semanaId !== semanaId || modo !== "edicion");

      if (!opciones.forzar && saleDeEdicion && cambiosPendientes) {
        const descartar = await confirmar({
          titulo: "¿Descartar cambios?",
          texto: "Tenés cambios sin guardar en esta semana.",
          botonConfirmar: "Descartar cambios",
          color: "#8a4b12",
        });

        if (!descartar) return false;
      }

      setModoActivo(
        modo === "lectura"
          ? { semanaId: null, modo: "lectura" }
          : { semanaId, modo },
      );

      if (modo !== "edicion" || modoActivo.semanaId !== semanaId) {
        setCambiosPendientes(false);
      }

      return true;
    },
    [cambiosPendientes, modoActivo, setCambiosPendientes, setModoActivo],
  );

  const iniciarPedido = useCallback(
    (semanaId) => cambiarModoSemana(semanaId, "edicion"),
    [cambiarModoSemana],
  );

  const iniciarModificacion = useCallback(
    (semanaId) => cambiarModoSemana(semanaId, "edicion"),
    [cambiarModoSemana],
  );

  const cancelarEdicion = useCallback(
    (semanaId, opciones) => cambiarModoSemana(semanaId, "lectura", opciones),
    [cambiarModoSemana],
  );

  const guardarCambios = useCallback(
    async (semanaActualizada) => {
      setGuardando(true);
      setErrorGuardado("");
      setFeedback("");

      const tipoOperacion = obtenerTipoOperacion(semanaActualizada);
      const payload =
        tipoOperacion === TIPOS_OPERACION_PEDIDO.CREAR
          ? construirPayloadCrearPedido({
              ...identidadUsuario,
              semana: semanaActualizada,
            })
          : construirPayloadActualizarPedido({
              ...identidadUsuario,
              pedidoId: semanaActualizada.metadata?.pedidoId,
              semana: semanaActualizada,
            });

      if (payload.dias.length === 0) {
        const errorValidacion = new Error("Elegí al menos un día para guardar el pedido.");
        setErrorGuardado(errorValidacion.message);
        setGuardando(false);
        throw errorValidacion;
      }

      try {
        const respuestaFinal = await medirPromesaPerformance("pedido:guardado", async () => {
          const respuestaGuardado =
            tipoOperacion === TIPOS_OPERACION_PEDIDO.CREAR
              ? await service.crearPedido(payload)
              : await service.actualizarPedido(payload.pedidoId, payload);
          const pedidoGuardadoParcial = mapearPedidoApiAEstado(respuestaGuardado);
          return tipoOperacion === TIPOS_OPERACION_PEDIDO.CREAR && pedidoGuardadoParcial.id
            ? service.confirmarPedido(pedidoGuardadoParcial.id)
            : respuestaGuardado;
        }, { tipoOperacion });
        const pedidoGuardado = mapearPedidoApiAEstado(respuestaFinal);
        const pedidoFinal = mapearPedidoApiAEstado(respuestaFinal);

        queryClient.setQueryData(queryKeyPedidoSemanal, (semanasActuales = semanas) => {
          const semanasActualizadas = semanasActuales.map((semana) =>
            semana.id === semanaActualizada.id
              ? mapearSemanaApiAEstado({
                  ...semanaActualizada,
                  estado: ESTADOS_PEDIDO.CONFIRMADO,
                  metadata: {
                    ...(semanaActualizada.metadata || {}),
                    pedidoId: pedidoFinal.id || pedidoGuardado.id || payload.pedidoId,
                    pedido: pedidoFinal.id ? pedidoFinal : semanaActualizada.metadata?.pedido,
                    fechaUltimaModificacion: pedidoFinal.fechaUltimaModificacion,
                  },
                })
              : semana,
          );
          guardarIndicePedido(claveIndice, semanasActualizadas, indiceActivo);
          return semanasActualizadas;
        });
        invalidarPedidoSemanal();
        setCambiosPendientes(false);
        setFeedback(pedidoFinal.mensaje || semanaActualizada.feedback || "Pedido guardado");
      } catch (errorGuardar) {
        setErrorGuardado(errorGuardar.message || "No pudimos guardar el pedido.");
        throw errorGuardar;
      } finally {
        setGuardando(false);
      }
    },
    [claveIndice, identidadUsuario, indiceActivo, invalidarPedidoSemanal, queryClient, queryKeyPedidoSemanal, semanas, service],
  );

  const confirmarPedido = useCallback(
    (semanaActualizada) => guardarCambios(semanaActualizada),
    [guardarCambios],
  );

  const guardarSugerencia = useCallback(
    async (semanaActualizada) => {
      setGuardando(true);
      setErrorGuardado("");
      setFeedback("");

      const payload = {
        semana_inicio: semanaActualizada.id,
        ideas: semanaActualizada.recomendacionesUsuario || [],
        comentario: semanaActualizada.comentarioRecomendacion || "",
      };

      try {
        const respuesta = await medirPromesaPerformance("pedido:guardar-sugerencia", () =>
          service.guardarSugerenciaPedido(payload),
        );
        const sugerencia = respuesta?.sugerencia || respuesta?.data?.sugerencia || {};

        queryClient.setQueryData(queryKeyPedidoSemanal, (semanasActuales = semanas) => {
          const semanasActualizadas = semanasActuales.map((semana) =>
            semana.id === semanaActualizada.id
              ? mapearSemanaApiAEstado({
                  ...semana,
                  recomendacionesUsuario:
                    sugerencia.recomendacionesUsuario ||
                    semanaActualizada.recomendacionesUsuario ||
                    [],
                  comentarioRecomendacion:
                    sugerencia.comentarioRecomendacion ||
                    semanaActualizada.comentarioRecomendacion ||
                    "",
                  metadata: {
                    ...(semana.metadata || {}),
                    sugerenciaId: sugerencia.id || semana.metadata?.sugerenciaId || null,
                    fechaUltimaSugerencia: sugerencia.fechaUltimaModificacion || null,
                  },
                })
              : semana,
          );
          guardarIndicePedido(claveIndice, semanasActualizadas, indiceActivo);
          return semanasActualizadas;
        });
        invalidarPedidoSemanal();
        setCambiosPendientes(false);
        setFeedback(respuesta?.mensaje || respuesta?.message || "Gracias por tu sugerencia");
      } catch (errorGuardar) {
        setErrorGuardado(errorGuardar.message || "No pudimos guardar la sugerencia.");
        throw errorGuardar;
      } finally {
        setGuardando(false);
      }
    },
    [claveIndice, indiceActivo, invalidarPedidoSemanal, queryClient, queryKeyPedidoSemanal, semanas, service],
  );

  return {
    cambiosPendientes,
    cancelarEdicion,
    cargando,
    cargandoSemanas: cargando,
    cambiarModoSemana,
    confirmarPedido,
    error,
    errorCarga: error,
    errorSemanas: error,
    errorGuardado,
    fechaReferencia,
    feedback,
    guardarCambios,
    guardarSugerencia,
    guardando,
    indiceInicial,
    iniciarModificacion,
    iniciarPedido,
    modoActivo,
    registrarIndiceActivo,
    cargarPedidoSemanal: recargarPedido,
    recargar: recargarPedido,
    recargarPedido,
    registrarCambiosEdicion: setCambiosPendientes,
    semanas,
  };
}
