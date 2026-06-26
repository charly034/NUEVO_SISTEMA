import { useCallback, useEffect, useMemo, useState } from "react";
import { fechaActualMockPedido, indiceInicialSemanaMock } from "../data/semanasMock.js";
import { usuarioPedidoMock } from "../data/pedidoMock.js";
import { confirmar } from "../lib/swal.js";
import { pedidoService } from "../services/pedidoService.js";
import { construirPayloadPedido } from "../utils/payloadPedido.js";
import { contarSeleccionesValidas } from "../utils/reglasSeleccionPedido.js";

function normalizarSemana(semana) {
  return {
    ...semana,
    diasSeleccionados: contarSeleccionesValidas(semana.dias || []),
    metadata: {
      ...(semana.metadata || {}),
      cantidadDias: semana.dias?.length || 5,
    },
  };
}

function obtenerTipoOperacion(semana) {
  return ["sin_pedido", "pendiente"].includes(semana.estado) ? "crear" : "modificar";
}

export function usePedidoSemanal({
  empleado,
  fechaActual = fechaActualMockPedido,
  service = pedidoService,
} = {}) {
  const identidadUsuario = useMemo(
    () => ({
      empresaId: empleado?.empresaId || empleado?.empresa_id || usuarioPedidoMock.empresaId,
      usuarioId: empleado?.id || empleado?.usuarioId || usuarioPedidoMock.usuarioId,
    }),
    [empleado],
  );
  const fechaReferencia = useMemo(() => fechaActual, [fechaActual]);
  const [semanas, setSemanas] = useState([]);
  const [indiceInicial, setIndiceInicial] = useState(indiceInicialSemanaMock);
  const [modoActivo, setModoActivo] = useState({ semanaId: null, modo: "lectura" });
  const [edicionConCambios, setEdicionConCambios] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [errorCarga, setErrorCarga] = useState("");
  const [errorGuardado, setErrorGuardado] = useState("");
  const [feedback, setFeedback] = useState("");

  const semanaActiva = semanas[indiceInicial] || semanas.find((semana) => semana.tipo === "actual") || null;
  const pedidoActual = semanas.find((semana) => semana.estado === "confirmado") || null;

  const cargarPedidoSemanal = useCallback(async () => {
    setCargando(true);
    setErrorCarga("");
    setErrorGuardado("");

    try {
      const semanasMock = await service.obtenerSemanasPedido();
      setSemanas(semanasMock.map((semana) => normalizarSemana(semana)));
      setIndiceInicial(indiceInicialSemanaMock);
    } catch (error) {
      setErrorCarga(error.message || "No pudimos cargar el pedido semanal.");
    } finally {
      setCargando(false);
    }
  }, [service]);

  useEffect(() => {
    cargarPedidoSemanal();
  }, [cargarPedidoSemanal]);

  const cambiarModoSemana = useCallback(
    async (semanaId, modo, opciones = {}) => {
      const saleDeEdicion =
        modoActivo.modo === "edicion" &&
        (modoActivo.semanaId !== semanaId || modo !== "edicion");

      if (!opciones.forzar && saleDeEdicion && edicionConCambios) {
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
        setEdicionConCambios(false);
      }

      return true;
    },
    [edicionConCambios, modoActivo],
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
          ? normalizarSemana({
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
      const payload = construirPayloadPedido({
        ...identidadUsuario,
        semana: semanaActualizada,
        tipoOperacion,
      });

      if (payload.dias.length === 0) {
        const error = new Error("Elegí al menos un día para guardar el pedido.");
        setErrorGuardado(error.message);
        setGuardando(false);
        throw error;
      }

      console.log("Payload pedido semanal", payload);

      try {
        if (tipoOperacion === "crear") {
          await service.crearPedido(payload);
        } else {
          await service.actualizarPedido(semanaActualizada.metadata?.pedidoId, payload);
        }

        setSemanas((semanasActuales) =>
          semanasActuales.map((semana) =>
            semana.id === semanaActualizada.id
              ? normalizarSemana({
                  ...semanaActualizada,
                  estado: "confirmado",
                })
              : semana,
          ),
        );
        setEdicionConCambios(false);
        setFeedback(semanaActualizada.feedback || "Pedido guardado");
      } catch (error) {
        setErrorGuardado(error.message || "No pudimos guardar el pedido.");
        throw error;
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
    cancelarEdicion,
    cargarPedidoSemanal,
    cargando,
    cambiarModoSemana,
    confirmarPedido,
    edicionConCambios,
    errorCarga,
    errorGuardado,
    fechaReferencia,
    feedback,
    guardarCambios,
    guardando,
    indiceInicial,
    iniciarModificacion,
    iniciarPedido,
    modoActivo,
    pedidoActual,
    registrarCambiosEdicion: setEdicionConCambios,
    semanaActiva,
    semanas,
    actualizarSeleccionDia,
  };
}
