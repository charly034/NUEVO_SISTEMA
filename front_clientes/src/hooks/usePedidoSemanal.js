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

const semanasActivasPedido = new Map();
const STALE_PEDIDO_SEMANAL_MS = 10 * 60 * 1000;
const GC_PEDIDO_SEMANAL_MS = 30 * 60 * 1000;
const STORAGE_SEMANA_ACTIVA_PREFIX = "la_quinta:pedido:semana_activa:v3:";

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

function guardarSemanaActivaPedido(clave, semanas, indiceActivo) {
  const indiceNormalizado = normalizarIndiceSemana(indiceActivo, semanas);
  const semanaId = semanas[indiceNormalizado]?.id || "";
  if (!semanaId) return;

  semanasActivasPedido.set(clave, semanaId);

  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      `${STORAGE_SEMANA_ACTIVA_PREFIX}${clave}`,
      String(semanaId),
    );
  } catch {
    // Si el storage no esta disponible, la cache en memoria conserva el contexto.
  }
}

function leerSemanaActivaGuardada(clave) {
  if (semanasActivasPedido.has(clave)) {
    return semanasActivasPedido.get(clave);
  }

  if (typeof window === "undefined") return null;

  try {
    return window.localStorage.getItem(
      `${STORAGE_SEMANA_ACTIVA_PREFIX}${clave}`,
    );
  } catch {
    return null;
  }
}

function obtenerIndiceSemanaGuardada(semanaId, semanas) {
  if (!semanaId) return null;
  const indice = semanas.findIndex((semana) => semana.id === semanaId);
  return indice >= 0 ? indice : null;
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
  const [semanaActivaGuardada, setSemanaActivaGuardada] = useState(() =>
    leerSemanaActivaGuardada(claveIndice),
  );
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

  const indiceSemanaGuardada = obtenerIndiceSemanaGuardada(semanaActivaGuardada, semanas);
  const indiceInicial = normalizarIndiceSemana(
    indiceSemanaGuardada ?? obtenerIndiceSemanaInicial(semanas),
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
      const semanaId = semanas[indiceNormalizado]?.id || null;
      setSemanaActivaGuardada(semanaId);
      guardarSemanaActivaPedido(claveIndice, semanas, indiceNormalizado);
    },
    [claveIndice, semanas, setSemanaActivaGuardada],
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
          guardarSemanaActivaPedido(claveIndice, semanasActualizadas, indiceInicial);
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
    [claveIndice, identidadUsuario, indiceInicial, invalidarPedidoSemanal, queryClient, queryKeyPedidoSemanal, semanas, service],
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
          guardarSemanaActivaPedido(claveIndice, semanasActualizadas, indiceInicial);
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
    [claveIndice, indiceInicial, invalidarPedidoSemanal, queryClient, queryKeyPedidoSemanal, semanas, service],
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
