import { Suspense, lazy, useEffect, useRef, useState } from "react";
import { obtenerMensajeLimiteModificacion } from "../../utils/reglasModificacionPedido.js";
import { reproducirSonidoConfirmacion } from "../../utils/sonidoConfirmacionPedido.js";
import Card from "../ui/Card.jsx";
import { tieneJornadaExtendida } from "./adaptadoresPedido.js";
import SemanaCardEditable from "./SemanaCardEditable.jsx";
import SemanaCardDetalle from "./SemanaCardDetalle.jsx";
import SemanaCardLectura from "./SemanaCardLectura.jsx";
import SemanaCardMenuInteractivo from "./SemanaCardMenuInteractivo.jsx";
import SemanaCardRecomendacion from "./SemanaCardRecomendacion.jsx";

const ConfirmacionPedido = lazy(() => import("./ConfirmacionPedido.jsx"));

export default function SemanaPedidoCard({
  fechaActual,
  modoCard,
  onCambiarModo,
  onActualizarSemana,
  onDirtyChange,
  onGuardarSugerencia,
  semana,
}) {
  const [modoCardInterno, setModoCardInterno] = useState("lectura");
  const [confirmacion, setConfirmacion] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [errorGuardado, setErrorGuardado] = useState("");
  const temporizadorConfirmacion = useRef(null);
  const compacta = tieneJornadaExtendida(semana);
  const mensajeLimite = obtenerMensajeLimiteModificacion(semana, fechaActual);
  const modoActual = modoCard || modoCardInterno;

  function cambiarModo(nuevoModo, opciones) {
    if (onCambiarModo) return onCambiarModo(nuevoModo, opciones);
    setModoCardInterno(nuevoModo);
    return true;
  }

  useEffect(() => {
    if (!onCambiarModo) {
      queueMicrotask(() => setModoCardInterno("lectura"));
    }
  }, [onCambiarModo, semana.id]);

  useEffect(() => () => {
    window.clearTimeout(temporizadorConfirmacion.current);
  }, []);

  async function guardarSemana(semanaActualizada) {
    setGuardando(true);
    setErrorGuardado("");

    try {
      await onActualizarSemana?.(semanaActualizada);
      onDirtyChange?.(false);
      cambiarModo("lectura", { forzar: true });
      setConfirmacion(semanaActualizada.feedback || "Pedido guardado");
      reproducirSonidoConfirmacion();

      window.clearTimeout(temporizadorConfirmacion.current);
      temporizadorConfirmacion.current = window.setTimeout(() => {
        setConfirmacion(null);
      }, 1900);
    } catch (error) {
      setErrorGuardado(error.message || "No pudimos guardar el pedido.");
    } finally {
      setGuardando(false);
    }
  }

  async function guardarRecomendacion(semanaActualizada) {
    setGuardando(true);
    setErrorGuardado("");

    try {
      await onGuardarSugerencia?.(semanaActualizada);
      onDirtyChange?.(false);
      cambiarModo("lectura", { forzar: true });
      setConfirmacion(semanaActualizada.feedback || "Gracias por tu sugerencia");
      reproducirSonidoConfirmacion();

      window.clearTimeout(temporizadorConfirmacion.current);
      temporizadorConfirmacion.current = window.setTimeout(() => {
        setConfirmacion(null);
      }, 1900);
    } catch (error) {
      setErrorGuardado(error.message || "No pudimos guardar la sugerencia.");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Card
      className="h-full min-h-0 overflow-hidden rounded-[1.5rem] border-0 bg-[#f5f6f0] p-0 shadow-none"
      aria-label={semana.titulo}
    >
      <div className="flex h-full min-h-0 flex-col">
        {modoActual === "detalle" ? (
          <SemanaCardDetalle
            compacta={compacta}
            mensajeLimite={mensajeLimite}
            semana={semana}
            onVolver={() => cambiarModo("lectura")}
          />
        ) : modoActual === "menu" ? (
          <SemanaCardMenuInteractivo
            fechaActual={fechaActual}
            guardando={guardando}
            semana={semana}
            onCancelar={(opciones) => cambiarModo("lectura", opciones)}
            onDirtyChange={onDirtyChange}
            onGuardar={guardarSemana}
          />
        ) : modoActual === "edicion" ? (
          <SemanaCardEditable
            compacta={compacta}
            fechaActual={fechaActual}
            mensajeLimite={mensajeLimite}
            semana={semana}
            onCancelar={(opciones) => cambiarModo("lectura", opciones)}
            onDirtyChange={onDirtyChange}
            onGuardar={guardarSemana}
            guardando={guardando}
          />
        ) : modoActual === "recomendacion" ? (
          <SemanaCardRecomendacion
            compacta={compacta}
            guardando={guardando}
            semana={semana}
            onCancelar={() => cambiarModo("lectura")}
            onGuardar={guardarRecomendacion}
          />
        ) : (
          <SemanaCardLectura
            compacta={compacta}
            fechaActual={fechaActual}
            semana={semana}
            onDetalle={() => cambiarModo("detalle")}
            onEditar={() => cambiarModo("edicion")}
            onRecomendar={() => cambiarModo("recomendacion")}
          />
        )}
      </div>

      {errorGuardado && (
        <p className="mt-2 rounded-2xl bg-[#fff0ed] px-3 py-2 text-[0.82rem] font-extrabold text-[#8a3d30]">
          {errorGuardado}
        </p>
      )}

      {confirmacion && (
        <Suspense fallback={null}>
          <ConfirmacionPedido mensaje={confirmacion} />
        </Suspense>
      )}
    </Card>
  );
}
