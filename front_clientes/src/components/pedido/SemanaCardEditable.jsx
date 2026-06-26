import { useEffect, useMemo, useRef, useState } from "react";
import { confirmar } from "../../lib/swal.js";
import { obtenerEstadoVisualDia } from "../../utils/reglasModificacionPedido.js";
import { contarSeleccionesValidas } from "../../utils/reglasSeleccionPedido.js";
import AccionesPedidoSemana from "./AccionesPedidoSemana.jsx";
import AvisoModificacion from "./AvisoModificacion.jsx";
import BottomSheetSeleccionDia from "./BottomSheetSeleccionDia.jsx";
import EstadoPedido from "./EstadoPedido.jsx";
import FilaPedidoDiaEditable from "./FilaPedidoDiaEditable.jsx";
import SemanaHeader from "./SemanaHeader.jsx";

function serializarDias(dias = []) {
  return JSON.stringify(
    dias.map((dia) => ({
      clave: dia.clave,
      plato: dia.plato || "",
      platoId: dia.seleccion?.plato?.id || "",
      guarnicion: dia.seleccion?.guarnicion || "",
    })),
  );
}

export default function SemanaCardEditable({
  compacta = false,
  fechaActual,
  guardando = false,
  mensajeLimite,
  onCancelar,
  onDirtyChange,
  onGuardar,
  semana,
}) {
  const [diasEditados, setDiasEditados] = useState(semana.dias);
  const [diaActivo, setDiaActivo] = useState(null);
  const [mensajeError, setMensajeError] = useState("");
  const aperturaInicialRealizada = useRef(false);
  const diasInicialesRef = useRef(serializarDias(semana.dias));
  const modoCreacion = ["sin_pedido", "pendiente"].includes(semana.estado);

  const diasSeleccionados = useMemo(
    () => contarSeleccionesValidas(diasEditados),
    [diasEditados],
  );
  const cambiosSinGuardar = useMemo(
    () => serializarDias(diasEditados) !== diasInicialesRef.current,
    [diasEditados],
  );
  const mensajeAyudaEdicion = modoCreacion
    ? "Completá los días que quieras. Te abrimos el primer día editable para empezar."
    : mensajeLimite;

  useEffect(() => {
    onDirtyChange?.(cambiosSinGuardar);
  }, [cambiosSinGuardar, onDirtyChange]);

  useEffect(() => () => {
    onDirtyChange?.(false);
  }, []);

  function puedeEditarDia(dia) {
    const estadoVisual = obtenerEstadoVisualDia(dia, semana, fechaActual);
    return !["bloqueado", "vencido"].includes(estadoVisual);
  }

  function obtenerSiguienteDiaEditable(dias, claveActual) {
    const indiceActual = dias.findIndex((dia) => dia.clave === claveActual);
    if (indiceActual === -1) return null;
    return dias.slice(indiceActual + 1).find((dia) => puedeEditarDia(dia)) || null;
  }

  useEffect(() => {
    if (!modoCreacion || aperturaInicialRealizada.current) return;

    const primerDiaEditable = diasEditados.find((dia) => puedeEditarDia(dia));
    if (!primerDiaEditable) return;

    aperturaInicialRealizada.current = true;
    setDiaActivo(primerDiaEditable);
  }, [diasEditados, modoCreacion]);

  function abrirSeleccionDia(dia, estadoVisual) {
    if (["bloqueado", "vencido"].includes(estadoVisual)) return;
    setMensajeError("");
    setDiaActivo(dia);
  }

  function actualizarDia(diaActualizado) {
    setDiasEditados((diasActuales) => {
      const diasActualizados = diasActuales.map((dia) =>
        dia.clave === diaActualizado.clave ? diaActualizado : dia,
      );

      if (modoCreacion) {
        setDiaActivo(obtenerSiguienteDiaEditable(diasActualizados, diaActualizado.clave));
      }

      return diasActualizados;
    });
  }

  async function cancelarEdicion() {
    if (cambiosSinGuardar) {
      const descartar = await confirmar({
        titulo: "¿Descartar cambios?",
        texto: "Los platos que cambiaste no se van a guardar.",
        botonConfirmar: "Descartar cambios",
        color: "#8a4b12",
      });

      if (!descartar) return;
    }

    onCancelar?.({ forzar: true });
  }

  function guardarCambios() {
    if (modoCreacion && diasSeleccionados === 0) {
      setMensajeError("Elegí al menos un día para confirmar el pedido.");
      return;
    }

    onGuardar?.({
      ...semana,
      estado: "confirmado",
      diasSeleccionados,
      dias: diasEditados,
      feedback: modoCreacion ? "Pedido confirmado" : "Pedido actualizado",
    });
  }

  return (
    <>
      <SemanaHeader semana={semana} compacta={compacta} />
      <EstadoPedido
        estado="editable"
        diasSeleccionados={diasSeleccionados}
        compacta={compacta}
      />
      <AvisoModificacion mensaje={mensajeAyudaEdicion} tono="ayuda" />

      <ul className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {diasEditados.map((dia) => {
          const estadoVisual = obtenerEstadoVisualDia(dia, semana, fechaActual);

          return (
            <FilaPedidoDiaEditable
              key={dia.clave}
              dia={dia}
              estadoVisual={estadoVisual}
              onAbrir={() => abrirSeleccionDia(dia, estadoVisual)}
            />
          );
        })}
      </ul>

      {mensajeError && (
        <p className="rounded-2xl bg-[#fff5eb] px-3 py-2 text-[0.82rem] font-extrabold text-[#8a4b12]">
          {mensajeError}
        </p>
      )}

      <AccionesPedidoSemana
        editando
        guardando={guardando}
        modoCreacion={modoCreacion}
        onCancelar={cancelarEdicion}
        onConfirmar={guardarCambios}
      />

      <BottomSheetSeleccionDia
        abierto={Boolean(diaActivo)}
        cerrarAlConfirmar={!modoCreacion}
        dia={diaActivo}
        dias={diasEditados}
        onCerrar={() => setDiaActivo(null)}
        onConfirmar={actualizarDia}
      />
    </>
  );
}
