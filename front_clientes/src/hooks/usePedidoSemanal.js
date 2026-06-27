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
  mapearSemanaApiAEstado,
} from "../mappers/pedidoMapper.js";
import { pedidoService } from "../services/pedidoService.js";

function obtenerIndiceSemanaInicial(semanas) {
  const indiceActual = semanas.findIndex((semana) => semana.tipo === "actual");
  return indiceActual >= 0 ? indiceActual : 0;
}

function obtenerTipoOperacion(semana) {
  return [ESTADOS_PEDIDO.SIN_PEDIDO, ESTADOS_PEDIDO.PENDIENTE].includes(semana.estado)
    ? TIPOS_OPERACION_PEDIDO.CREAR
    : TIPOS_OPERACION_PEDIDO.MODIFICAR;
}

export function usePedidoSemanal({
  empleado,
  fechaActual,
  service = pedidoService,
} = {}) {
  const identidadUsuario = useMemo(
    () => ({
      empresaId: empleado?.empresaId || empleado?.empresa_id || IDENTIDAD_PEDIDO_DEMO.empresaId,
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

  const semanaActiva = semanas[indiceInicial] || semanas.find((semana) => semana.tipo === "actual") || null;
  const pedidoActual = semanas.find((semana) => semana.estado === ESTADOS_PEDIDO.CONFIRMADO) || null;
  const modoEdicion = modoActivo.modo === "edicion";

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
      setError(errorCarga.message || "No pudimos cargar el pedido semanal.");
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

  const actualizarSeleccionDia = useCallback((semanaId, diaActualizado) => {
    setSemanas((semanasActuales) =>
      semanasActuales.map((semana) =>
        semana.id === semanaId
          ? mapearSemanaApiAEstado({
              ...semana,
              dias: semana.dias.map((dia) =>
                dia.clave === diaActualizado.clave ? diaActualizado : dia,
              ),
            })
          : semana,
      ),
    );
  }, []);

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

      console.log("Payload enviado a API mock:", payload);

      try {
        const respuesta =
          tipoOperacion === TIPOS_OPERACION_PEDIDO.CREAR
            ? await service.crearPedido(payload)
            : await service.actualizarPedido(payload.pedidoId, payload);

        setSemanas((semanasActuales) =>
          semanasActuales.map((semana) =>
            semana.id === semanaActualizada.id
              ? mapearSemanaApiAEstado({
                  ...semanaActualizada,
                  estado: ESTADOS_PEDIDO.CONFIRMADO,
                  metadata: {
                    ...(semanaActualizada.metadata || {}),
                    pedidoId: respuesta.id || payload.pedidoId,
                  },
                })
              : semana,
          ),
        );
        setCambiosPendientes(false);
        setFeedback(semanaActualizada.feedback || "Pedido guardado");
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
    actualizarSeleccionDia,
    cambiosPendientes,
    cancelarEdicion,
    cargando,
    cambiarModoSemana,
    confirmarPedido,
    error,
    errorCarga: error,
    errorGuardado,
    fechaReferencia,
    feedback,
    guardarCambios,
    guardando,
    indiceInicial,
    iniciarModificacion,
    iniciarPedido,
    modoActivo,
    modoEdicion,
    pedidoActual,
    recargarPedido,
    registrarCambiosEdicion: setCambiosPendientes,
    semanaActiva,
    semanas,
  };
}
