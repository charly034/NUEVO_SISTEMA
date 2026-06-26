import { useEffect, useRef, useState } from "react";
import { obtenerMensajeLimiteModificacion } from "../../utils/reglasModificacionPedido.js";
import { reproducirSonidoConfirmacion } from "../../utils/sonidoConfirmacionPedido.js";
import Card from "../ui/Card.jsx";
import ConfirmacionPedido from "./ConfirmacionPedido.jsx";
import { tieneJornadaExtendida } from "./adaptadoresPedido.js";
import SemanaCardEditable from "./SemanaCardEditable.jsx";
import SemanaCardDetalle from "./SemanaCardDetalle.jsx";
import SemanaCardLectura from "./SemanaCardLectura.jsx";
import SemanaCardRecomendacion from "./SemanaCardRecomendacion.jsx";

export default function SemanaPedidoCard({
  fechaActual,
  modoCard,
  onCambiarModo,
  onActualizarSemana,
  onDirtyChange,
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
    if (!onCambiarModo) setModoCardInterno("lectura");
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

  return (
    <Card
      className="h-full min-h-0 p-3 max-[700px]:p-2.5"
      aria-label={semana.titulo}
    >
      <div className="flex h-full min-h-0 flex-col gap-2">
        {modoActual === "detalle" ? (
          <SemanaCardDetalle
            compacta={compacta}
            mensajeLimite={mensajeLimite}
            semana={semana}
            onVolver={() => cambiarModo("lectura")}
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
            semana={semana}
            onCancelar={() => cambiarModo("lectura")}
            onGuardar={guardarSemana}
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

      {confirmacion && <ConfirmacionPedido mensaje={confirmacion} />}
    </Card>
  );
}
