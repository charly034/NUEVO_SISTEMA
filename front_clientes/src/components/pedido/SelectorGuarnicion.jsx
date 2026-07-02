import { forwardRef } from "react";
import { unirClases } from "../../compartido/utils/clases.js";

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
      className="mt-3 rounded-[1.15rem] border border-[#deded8] bg-white px-5 py-4 outline-none focus-visible:ring-2 focus-visible:ring-[#586b24]/25"
    >
      <h3 className="text-[0.95rem] font-extrabold uppercase tracking-wide text-[#7d7b75]">
        Elegi una guarnicion
      </h3>
      <div className="mt-3 space-y-2">
        {guarniciones.map((opcion) => {
          const seleccionada = estaSeleccionada(opcion);
          return (
            <button
              key={obtenerId(opcion)}
              type="button"
              aria-pressed={seleccionada}
              onClick={() => onSeleccionar?.(opcion)}
              className={unirClases(
                "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[1.08rem] font-semibold transition",
                seleccionada
                  ? "bg-[#eef3e9] text-[#3f4b20]"
                  : "text-[#2f2f2b] hover:bg-[#f5f6f0]",
              )}
            >
              <span
                className={unirClases(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2",
                  seleccionada ? "border-[#586b24]" : "border-[#d6d6d0]",
                )}
                aria-hidden="true"
              >
                {seleccionada ? <span className="h-2 w-2 rounded-full bg-[#586b24]" /> : null}
              </span>
              {obtenerNombre(opcion)}
            </button>
          );
        })}
      </div>
    </section>
  );
});

export default SelectorGuarnicion;
