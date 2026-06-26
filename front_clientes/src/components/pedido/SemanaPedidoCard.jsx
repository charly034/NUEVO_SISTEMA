import Boton from "../ui/Boton.jsx";
import Card from "../ui/Card.jsx";
import EstadoPedido from "./EstadoPedido.jsx";
import ListaDiasPedido from "./ListaDiasPedido.jsx";
import SemanaHeader from "./SemanaHeader.jsx";

function obtenerAccionPrincipal(semana) {
  if (semana.estado === "pendiente" || semana.estado === "sin_pedido") {
    return "Elegir menú";
  }

  return "Ver detalle del pedido";
}

export default function SemanaPedidoCard({
  semana,
  onVerDetalle,
  onModificar,
  onElegirMenu,
}) {
  const accionPrincipal = obtenerAccionPrincipal(semana);
  const puedeElegir = semana.estado === "pendiente" || semana.estado === "sin_pedido";

  function manejarAccionPrincipal() {
    if (puedeElegir) {
      onElegirMenu?.(semana);
      return;
    }

    onVerDetalle?.(semana);
  }

  return (
    <Card className="h-full p-5">
      <div className="flex h-full flex-col gap-5">
        <SemanaHeader semana={semana} />
        <EstadoPedido
          estado={semana.estado}
          diasSeleccionados={semana.diasSeleccionados}
        />
        <ListaDiasPedido dias={semana.dias} />

        <div className="mt-auto space-y-3 pt-1">
          <Boton anchoCompleto onClick={manejarAccionPrincipal}>
            {accionPrincipal}
          </Boton>

          {semana.editable && semana.estado === "confirmado" && (
            <Boton anchoCompleto variante="secundario" onClick={() => onModificar?.(semana)}>
              Modificar pedido
            </Boton>
          )}

        </div>
      </div>
    </Card>
  );
}
