import { unirClases } from "../../compartido/utils/clases.js";

export default function IndicadoresCarrusel({
  cantidad,
  etiquetas = [],
  indiceActivo,
  onSeleccionar,
}) {
  return (
    <div className="mt-2 flex shrink-0 justify-center gap-2" aria-label="Indicadores de semana">
      {Array.from({ length: cantidad }).map((_, indice) => {
        const activo = indiceActivo === indice;

        return (
          <button
            key={indice}
            type="button"
            aria-label={etiquetas[indice] ? `Ver ${etiquetas[indice]}` : `Ver semana ${indice + 1}`}
            aria-current={activo ? "true" : undefined}
            aria-pressed={activo}
            onClick={() => onSeleccionar?.(indice)}
            className={unirClases(
              "flex h-8 items-center justify-center rounded-full transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2d5a27]",
              activo ? "w-9" : "w-8",
            )}
          >
            <span
              className={unirClases(
                "h-2.5 rounded-full transition-all",
                activo ? "w-7 bg-[#2d5a27]" : "w-2.5 bg-[#d8d2c8]",
              )}
            />
          </button>
        );
      })}
    </div>
  );
}
