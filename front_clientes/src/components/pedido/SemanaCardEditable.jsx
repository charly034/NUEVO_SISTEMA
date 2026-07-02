import { useCallback, useEffect, useMemo, useState } from "react";
import { confirmar } from "../../lib/swal.js";
import { obtenerEstadoVisualDia } from "../../utils/reglasModificacionPedido.js";
import { contarSeleccionesValidas } from "../../utils/reglasSeleccionPedido.js";
import AccionesPedidoSemana from "./AccionesPedidoSemana.jsx";
import BottomSheetSeleccionDia from "./BottomSheetSeleccionDia.jsx";
import Boton from "../ui/Boton.jsx";
import SemanaHeader from "./SemanaHeader.jsx";
import { DiaPedidoCard, ProgresoSemana } from "./SemanaPedidoVisual.jsx";

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
  const [diasIniciales] = useState(() => serializarDias(semana.dias));
  const modoCreacion = ["sin_pedido", "pendiente"].includes(semana.estado);

  const diasSeleccionados = useMemo(
    () => contarSeleccionesValidas(diasEditados),
    [diasEditados],
  );
  const cambiosSinGuardar = useMemo(
    () => serializarDias(diasEditados) !== diasIniciales,
    [diasEditados, diasIniciales],
  );

  useEffect(() => {
    onDirtyChange?.(cambiosSinGuardar);
  }, [cambiosSinGuardar, onDirtyChange]);

  useEffect(() => () => {
    onDirtyChange?.(false);
  }, [onDirtyChange]);

  const puedeEditarDia = useCallback((dia) => {
    const estadoVisual = obtenerEstadoVisualDia(dia, semana, fechaActual);
    return !["bloqueado", "feriado", "vencido"].includes(estadoVisual);
  }, [fechaActual, semana]);

  const diasEditables = useMemo(
    () => diasEditados.filter((dia) => puedeEditarDia(dia)).length,
    [diasEditados, puedeEditarDia],
  );

  const diasConRespuesta = useMemo(
    () => diasEditados.filter((dia) => {
      if (!puedeEditarDia(dia)) return false;
      return Boolean(dia.seleccion?.plato) ||
        (Boolean(dia.plato) && dia.plato !== "" && dia.plato !== "Sin seleccionar");
    }).length,
    [diasEditados, puedeEditarDia],
  );

  function obtenerSiguienteDiaEditable(dias, claveActual) {
    const indiceActual = dias.findIndex((dia) => dia.clave === claveActual);
    if (indiceActual === -1) return null;
    return dias.slice(indiceActual + 1).find((dia) => puedeEditarDia(dia)) || null;
  }

  function obtenerDiaEditableAnterior(dias, claveActual) {
    const indiceActual = dias.findIndex((dia) => dia.clave === claveActual);
    if (indiceActual === -1) return null;
    return dias
      .slice(0, indiceActual)
      .reverse()
      .find((dia) => puedeEditarDia(dia)) || null;
  }

  function abrirSeleccionDia(dia, estadoVisual) {
    if (["bloqueado", "feriado", "vencido"].includes(estadoVisual)) return;
    setMensajeError("");
    setDiaActivo(dia);
  }

  function actualizarDia(diaActualizado) {
    setDiasEditados((diasActuales) =>
      diasActuales.map((dia) =>
        dia.clave === diaActualizado.clave ? diaActualizado : dia,
      ),
    );
  }

  async function cancelarEdicion() {
    if (cambiosSinGuardar) {
      const descartar = await confirmar({
        titulo: "Descartar cambios?",
        texto: "Los platos que cambiaste no se van a guardar.",
        botonConfirmar: "Descartar cambios",
        color: "#8a4b12",
      });

      if (!descartar) return;
    }

    onCancelar?.({ forzar: true });
  }

  function guardarCambios() {
    if (modoCreacion) {
      const faltantes = diasEditables - diasConRespuesta;
      if (faltantes > 0) {
        setMensajeError(
          `Faltan ${faltantes} ${faltantes === 1 ? "dia sin completar" : "dias sin completar"}.`,
        );
        return;
      }
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
      <ProgresoSemana
        completados={diasConRespuesta}
        total={diasEditables || diasEditados.length}
      />

      {mensajeLimite && !modoCreacion && (
        <p className="mx-6 mt-4 rounded-2xl bg-[#eef2e9] px-4 py-3 text-sm font-bold leading-snug text-[#4e5f29]">
          {mensajeLimite}
        </p>
      )}

      <ul className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto bg-[#f5f6f0] px-6 py-6">
        {diasEditados.map((dia) => {
          const estadoVisual = obtenerEstadoVisualDia(dia, semana, fechaActual);
          const habilitado = puedeEditarDia(dia);

          return (
            <DiaPedidoCard
              key={dia.clave}
              dia={dia}
              estadoVisual={habilitado ? estadoVisual : "bloqueado"}
              onAbrir={() => abrirSeleccionDia(dia, estadoVisual)}
            />
          );
        })}
      </ul>

      {mensajeError && (
        <p className="mx-6 mb-3 rounded-2xl bg-[#fff5eb] px-3 py-2 text-[0.82rem] font-extrabold text-[#8a4b12]">
          {mensajeError}
        </p>
      )}

      {diasEditables > 0 ? (
        <AccionesPedidoSemana
          editando
          guardando={guardando}
          modoCreacion={modoCreacion}
          onCancelar={cancelarEdicion}
          onConfirmar={guardarCambios}
        />
      ) : (
        <div className="mt-auto shrink-0 border-t border-[#ecebe5] bg-white px-6 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4">
          <Boton variante="secundario" anchoCompleto onClick={cancelarEdicion}>
            Volver
          </Boton>
        </div>
      )}

      <BottomSheetSeleccionDia
        abierto={Boolean(diaActivo)}
        cerrarAlConfirmar={true}
        dia={diaActivo}
        dias={diasEditados}
        diasEditables={[]}
        semanaId={semana.id}
        onCerrar={() => setDiaActivo(null)}
        onConfirmar={actualizarDia}
        onDiaAnterior={(diaActual) => {
          const diaAnterior = obtenerDiaEditableAnterior(diasEditados, diaActual?.clave);
          if (diaAnterior) setDiaActivo(diaAnterior);
        }}
        onDiaSiguiente={(diaActual) => {
          const diaSiguiente = obtenerSiguienteDiaEditable(diasEditados, diaActual?.clave);
          if (diaSiguiente) setDiaActivo(diaSiguiente);
        }}
      />
    </>
  );
}
