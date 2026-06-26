import { platoRequiereGuarnicion } from "../../utils/reglasSeleccionPedido.js";

export default function ResumenSeleccionDia({ seleccion }) {
  const nombreGuarnicion =
    typeof seleccion?.guarnicion === "string"
      ? seleccion.guarnicion
      : seleccion?.guarnicion?.nombre;

  if (!seleccion?.plato) {
    return (
      <p className="text-sm font-bold text-[#716c64]">
        Seleccioná un plato para este día.
      </p>
    );
  }

  if (platoRequiereGuarnicion(seleccion.plato) && !seleccion.guarnicion) {
    return (
      <p className="text-sm font-black text-[#7b5f12]">
        Elegí una guarnición para confirmar este plato.
      </p>
    );
  }

  if (!platoRequiereGuarnicion(seleccion.plato)) {
    return (
      <p className="text-sm font-bold text-[#2d5a27]">
        Listo, este plato no requiere guarnición.
      </p>
    );
  }

  return (
    <p className="text-sm font-bold text-[#2d5a27]">
      Guarnición elegida: {nombreGuarnicion}
    </p>
  );
}
