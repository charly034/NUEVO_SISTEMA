import { useCallback, useEffect, useMemo, useState } from "react";
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

function obtenerIndiceSemanaInicial(semanas) {
  const indiceActual = semanas.findIndex((semana) => semana.tipo === "actual");
  return indiceActual >= 0 ? indiceActual : 0;
}

function obtenerTipoOperacion(semana) {
  return semana?.metadata?.pedidoId
    ? TIPOS_OPERACION_PEDIDO.MODIFICAR
    : TIPOS_OPERACION_PEDIDO.CREAR;
}

export function usePedidoSemanal({
  empleado,
  fechaActual,
  service = pedidoService,
} = {}) {
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
  const [semanas, setSemanas] = useState([]);
  const [indiceInicial, setIndiceInicial] = useState(0);
  const [modoActivo, setModoActivo] = useState({ semanaId: null, modo: "lectura" });
  const [cambiosPendientes, setCambiosPendientes] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [errorGuardado, setErrorGuardado] = useState("");
  const [feedback, setFeedback] = useState("");

  const recargarPedido = useCallback(async () => {
    setCargando(true);
    setError("");
    setErrorGuardado("");

    try {
      const semanasApi = await service.obtenerSemanasPedido({
        ...identidadUsuario,
        empleado,
        fechaReferencia,
      });
      const semanasMapeadas = semanasApi.map((semana) => mapearSemanaApiAEstado(semana));
      setSemanas(semanasMapeadas);
      setIndiceInicial(obtenerIndiceSemanaInicial(semanasMapeadas));
    } catch (errorCarga) {
      if (errorCarga.status === 401 || errorCarga.codigo === "sin_token") {
        setError("No pudimos cargar tu pedido. Inicia sesion nuevamente.");
      } else {
        setError("No pudimos cargar tu pedido. Intenta nuevamente.");
      }
    } finally {
      setCargando(false);
    }
  }, [empleado, fechaReferencia, identidadUsuario, service]);

  useEffect(() => {
    recargarPedido();
  }, [recargarPedido]);

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
    [cambiosPendientes, modoActivo],
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
        const respuestaGuardado =
          tipoOperacion === TIPOS_OPERACION_PEDIDO.CREAR
            ? await service.crearPedido(payload)
            : await service.actualizarPedido(payload.pedidoId, payload);
        const pedidoGuardado = mapearPedidoApiAEstado(respuestaGuardado);
        const respuestaFinal =
          tipoOperacion === TIPOS_OPERACION_PEDIDO.CREAR && pedidoGuardado.id
            ? await service.confirmarPedido(pedidoGuardado.id)
            : respuestaGuardado;
        const pedidoFinal = mapearPedidoApiAEstado(respuestaFinal);

        setSemanas((semanasActuales) =>
          semanasActuales.map((semana) =>
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
          ),
        );
        setCambiosPendientes(false);
        setFeedback(pedidoFinal.mensaje || semanaActualizada.feedback || "Pedido guardado");
      } catch (errorGuardar) {
        setErrorGuardado(errorGuardar.message || "No pudimos guardar el pedido.");
        throw errorGuardar;
      } finally {
        setGuardando(false);
      }
    },
    [identidadUsuario, service],
  );

  const confirmarPedido = useCallback(
    (semanaActualizada) => guardarCambios(semanaActualizada),
    [guardarCambios],
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
    guardando,
    indiceInicial,
    iniciarModificacion,
    iniciarPedido,
    modoActivo,
    cargarPedidoSemanal: recargarPedido,
    recargar: recargarPedido,
    recargarPedido,
    registrarCambiosEdicion: setCambiosPendientes,
    semanas,
  };
}
