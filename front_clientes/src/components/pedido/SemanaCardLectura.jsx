import {
  obtenerAccionPrincipalSemana,
  obtenerMensajeLimiteModificacion,
  puedeModificarSemana,
} from "../../utils/reglasModificacionPedido.js";
import AccionesPedidoSemana from "./AccionesPedidoSemana.jsx";
import AvisoModificacion from "./AvisoModificacion.jsx";
import ContenidoSemanaSinMenu from "./ContenidoSemanaSinMenu.jsx";
import EstadoPedido from "./EstadoPedido.jsx";
import ListaDiasPedido from "./ListaDiasPedido.jsx";
import SemanaHeader from "./SemanaHeader.jsx";

export default function SemanaCardLectura({
  compacta = false,
  fechaActual,
  onDetalle,
  onEditar,
  onRecomendar,
  semana,
}) {
  const accionPrincipal = obtenerAccionPrincipalSemana(semana, fechaActual);
  const puedeEditar = puedeModificarSemana(semana, fechaActual);
  const mensajeLimite = obtenerMensajeLimiteModificacion(semana, fechaActual);
  const tonoAviso = semana.estado === "confirmado"
    ? "sutil"
    : puedeEditar
      ? "ayuda"
      : "bloqueado";
  const mostrarAviso = ["confirmado", "cerrado", "fuera_de_plazo"].includes(semana.estado);
  const esSemanaSugerencias = Boolean(semana.metadata?.esSemanaSugerencias);
  const sugerenciaEnviada =
    (semana.recomendacionesUsuario || []).length > 0 ||
    Boolean(semana.comentarioRecomendacion);
  const mostrarMenuPublicado = ["sin_pedido", "pendiente"].includes(semana.estado);
  const mostrarPedidoConfirmado = ["confirmado", "cerrado", "fuera_de_plazo"].includes(semana.estado);

  function manejarAccionPrincipal() {
    if (accionPrincipal === "Sugerir menú") {
      onRecomendar?.();
      return;
    }

    if (accionPrincipal === "Hacer mi pedido" || accionPrincipal === "Modificar pedido") {
      onEditar?.();
      return;
    }

    if (accionPrincipal === "Ver detalle") {
      onDetalle?.();
    }
  }

  return (
    <>
      <SemanaHeader semana={semana} compacta={compacta} />
      {!esSemanaSugerencias && (
        <EstadoPedido
          estado={semana.estado}
          diasSeleccionados={semana.diasSeleccionados}
          compacta={compacta}
        />
      )}
      {mostrarAviso && (
        <AvisoModificacion mensaje={mensajeLimite} tono={tonoAviso} />
      )}
      {esSemanaSugerencias ? (
        <ContenidoSemanaSinMenu
          onSugerir={onRecomendar}
          sugerenciaEnviada={sugerenciaEnviada}
        />
      ) : (
        <ListaDiasPedido
          dias={semana.dias}
          compacta={compacta}
          modoConfirmado={mostrarPedidoConfirmado}
          modoMenuPublicado={mostrarMenuPublicado}
        />
      )}
      {!esSemanaSugerencias && (
        <AccionesPedidoSemana
          accionPrincipal={accionPrincipal}
          onPrincipal={manejarAccionPrincipal}
        />
      )}
    </>
  );
}
