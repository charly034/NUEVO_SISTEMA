import { forwardRef } from "react";
import ChipSeleccionable from "../ui/ChipSeleccionable.jsx";

const SelectorGuarnicion = forwardRef(function SelectorGuarnicion(
  {
    guarnicion,
    guarniciones = [],
    onSeleccionar,
  },
  ref,
) {
  if (guarniciones.length === 0) return null;

  function obtenerId(opcion) {
    return typeof opcion === "string" ? opcion : opcion.id;
  }

  function obtenerNombre(opcion) {
    return typeof opcion === "string" ? opcion : opcion.nombre;
  }

  function estaSeleccionada(opcion) {
    if (!guarnicion) return false;
    const idSeleccionado = typeof guarnicion === "string" ? guarnicion : guarnicion.id;
    return idSeleccionado === obtenerId(opcion);
  }

  return (
    <section
      ref={ref}
      tabIndex={-1}
      className="rounded-3xl border border-[#d8e6d4] bg-[#f0f7ee] p-3 outline-none focus-visible:ring-2 focus-visible:ring-[#2d5a27]/25"
    >
      <h3 className="text-base font-black text-[#2d5a27]">
        Elegí la guarnición
      </h3>
      <p className="mt-0.5 text-sm font-bold text-[#5f7f55]">
        Es necesaria para confirmar este plato.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {guarniciones.map((opcion) => (
          <ChipSeleccionable
            key={obtenerId(opcion)}
            seleccionado={estaSeleccionada(opcion)}
            onClick={() => onSeleccionar?.(opcion)}
          >
            {obtenerNombre(opcion)}
          </ChipSeleccionable>
        ))}
      </div>
    </section>
  );
});

export default SelectorGuarnicion;
