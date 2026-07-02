import { unirClases } from "../../compartido/utils/clases.js";
import RadioCard from "../ui/RadioCard.jsx";

const estilosEtiqueta = {
  "Especial del día": "bg-[#eef7ea] text-[#2d5a27] border-[#d6e8cf]",
  Pollo: "bg-[#fff6df] text-[#7a5511] border-[#f1dfac]",
  Carne: "bg-[#fff0ed] text-[#8a3d30] border-[#f0ccc3]",
  Pescado: "bg-[#eef8f5] text-[#24675c] border-[#cbe6df]",
  Milanesas: "bg-[#fff4e8] text-[#8a5418] border-[#eed5b5]",
  Pastas: "bg-[#f7f0ff] text-[#674293] border-[#ddcef0]",
  Vegetariano: "bg-[#f0f7ee] text-[#2d5a27] border-[#d8e6d4]",
  Liviano: "bg-[#eef7f4] text-[#3f7569] border-[#cfe6df]",
  "Incluye ensalada": "bg-[#f3f8ea] text-[#5c7a28] border-[#dce9bd]",
  "Plato completo": "bg-[#f5f1e9] text-[#5f5a52] border-[#e5ded2]",
  "Requiere guarnición": "bg-[#fff7eb] text-[#8a5a18] border-[#edd9b8]",
};

function estiloEtiqueta(etiqueta) {
  return estilosEtiqueta[etiqueta] || "bg-[#f5f1e9] text-[#5f5a52] border-[#e5ded2]";
}

export default function OpcionPlatoCard({
  onSeleccionar,
  plato,
  seleccionado = false,
}) {
  return (
    <RadioCard compacto seleccionado={seleccionado} onClick={() => onSeleccionar?.(plato)}>
      <span className="block">
        <span className="flex items-start justify-between gap-2">
          <span className="block min-w-0 text-[1.12rem] font-extrabold leading-tight text-[#292925]">
            {plato.nombre}
          </span>
          {plato.destacado && (
            <span className="shrink-0 rounded-full bg-[#586b24] px-2 py-1 text-[0.68rem] font-black uppercase tracking-wide text-white">
              Especial
            </span>
          )}
        </span>
        <span className="mt-1 block text-[0.98rem] font-semibold leading-snug text-[#6e6b64]">
          {plato.descripcion}
        </span>
        {(plato.etiquetas?.length > 0 || plato.guarniciones?.length > 0) && (
          <span className="mt-1.5 flex flex-wrap gap-1.5">
            {plato.guarniciones?.length > 0 &&
              !plato.etiquetas?.includes("Requiere guarnición") && (
                <span
                  className={unirClases(
                    "rounded-full border px-2 py-0.5 text-[0.72rem] font-extrabold",
                    estiloEtiqueta("Requiere guarnición"),
                  )}
                >
                  Requiere guarnición
                </span>
              )}
            {plato.etiquetas?.map((etiqueta) => (
              <span
                key={etiqueta}
                className={unirClases(
                  "rounded-full border px-2 py-0.5 text-[0.72rem] font-black",
                  estiloEtiqueta(etiqueta),
                )}
              >
                {etiqueta}
              </span>
            ))}
          </span>
        )}
      </span>
    </RadioCard>
  );
}
