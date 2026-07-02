import { useCallback, useEffect, useMemo, useState } from "react";
import { confirmar } from "../../lib/swal.js";
import { obtenerEstadoVisualDia } from "../../utils/reglasModificacionPedido.js";
import {
  contarSeleccionesValidas,
  platoRequiereGuarnicion,
} from "../../utils/reglasSeleccionPedido.js";
import AccionesPedidoSemana from "./AccionesPedidoSemana.jsx";
import BottomSheetSeleccionDia from "./BottomSheetSeleccionDia.jsx";
import SemanaHeader from "./SemanaHeader.jsx";
import { DiaPedidoCard, ProgresoSemana } from "./SemanaPedidoVisual.jsx";

export default function SemanaCardMenuInteractivo({
  fechaActual,
  guardando = false,
  onCancelar,
  onDirtyChange,
  onGuardar,
  semana,
}) {
  const [diasEditados, setDiasEditados] = useState(semana.dias);
  const [diaActivo, setDiaActivo] = useState(null);
  const [mensajeError, setMensajeError] = useState("");

  const puedeEditarDia = useCallback(
    (dia) => {
      const estadoVisual = obtenerEstadoVisualDia(dia, semana, fechaActual);
      return !["bloqueado", "feriado", "vencido"].includes(estadoVisual);
    },
    [fechaActual, semana],
  );

  const diasEditables = useMemo(
    () => diasEditados.filter(puedeEditarDia).length,
    [diasEditados, puedeEditarDia],
  );

  const diasConRespuesta = useMemo(
    () =>
      diasEditados.filter((dia) => {
        if (!puedeEditarDia(dia)) return false;
        return (
          Boolean(dia.seleccion?.plato) ||
          (Boolean(dia.plato) && dia.plato !== "" && dia.plato !== "Sin seleccionar")
        );
      }).length,
    [diasEditados, puedeEditarDia],
  );

  const hayCambios = diasConRespuesta > 0;

  useEffect(() => {
    onDirtyChange?.(hayCambios);
  }, [hayCambios, onDirtyChange]);

  useEffect(
    () => () => {
      onDirtyChange?.(false);
    },
    [onDirtyChange],
  );

  function actualizarDia(diaActualizado) {
    setDiasEditados((actuales) =>
      actuales.map((d) => (d.clave === diaActualizado.clave ? diaActualizado : d)),
    );
  }

  function abrirDia(dia) {
    setMensajeError("");
    setDiaActivo(dia);
  }

  async function cancelar() {
    if (hayCambios) {
      const descartar = await confirmar({
        titulo: "Descartar selecciones?",
        texto: "Las opciones que elegiste no se van a guardar.",
        botonConfirmar: "Descartar",
        color: "#8a4b12",
      });
      if (!descartar) return;
    }
    onCancelar?.({ forzar: true });
  }

  function confirmarPedido() {
    const faltantes = diasEditables - diasConRespuesta;
    if (faltantes > 0) {
      setMensajeError(
        `Faltan ${faltantes} ${faltantes === 1 ? "dia sin completar" : "dias sin completar"}.`,
      );
      return;
    }

    const diasSinGuarnicion = diasEditados.filter(
      (dia) =>
        puedeEditarDia(dia) &&
        dia.seleccion?.plato &&
        platoRequiereGuarnicion(dia.seleccion.plato) &&
        !dia.seleccion.guarnicion,
    );
    if (diasSinGuarnicion.length > 0) {
      setMensajeError(`Falta elegir guarnicion para el ${diasSinGuarnicion[0].dia}.`);
      return;
    }

    const diasSeleccionados = contarSeleccionesValidas(diasEditados);
    onGuardar?.({
      ...semana,
      estado: "confirmado",
      diasSeleccionados,
      dias: diasEditados,
      feedback: "Pedido confirmado",
    });
  }

  return (
    <>
      <SemanaHeader semana={semana} />
      <ProgresoSemana
        completados={diasConRespuesta}
        total={diasEditables || diasEditados.length}
      />

      <ul className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto bg-[#f5f6f0] px-6 py-6">
        {diasEditados.map((dia) => {
          const estadoVisual = obtenerEstadoVisualDia(dia, semana, fechaActual);
          const habilitado = puedeEditarDia(dia);

          return (
            <DiaPedidoCard
              key={dia.clave}
              dia={dia}
              estadoVisual={habilitado ? estadoVisual : "bloqueado"}
              onAbrir={() => habilitado && abrirDia(dia)}
            />
          );
        })}
      </ul>

      {mensajeError && (
        <p className="mx-6 mb-3 shrink-0 rounded-2xl bg-[#fff5eb] px-3 py-2 text-[0.82rem] font-extrabold text-[#8a4b12]">
          {mensajeError}
        </p>
      )}

      {diasEditables > 0 ? (
        <AccionesPedidoSemana
          editando
          guardando={guardando}
          modoCreacion={true}
          onCancelar={cancelar}
          onConfirmar={confirmarPedido}
        />
      ) : (
        <AccionesPedidoSemana accionPrincipal="Volver" onPrincipal={cancelar} />
      )}

      <BottomSheetSeleccionDia
        abierto={Boolean(diaActivo)}
        cerrarAlConfirmar={true}
        dia={diaActivo}
        dias={diasEditados}
        diasEditables={[]}
        semanaId={semana.id}
        sinNavegacion={true}
        onCerrar={() => setDiaActivo(null)}
        onConfirmar={actualizarDia}
        onDiaAnterior={() => {}}
        onDiaSiguiente={() => {}}
      />
    </>
  );
}
