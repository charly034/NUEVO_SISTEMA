import { CheckCircle2, Circle } from "lucide-react";
import { unirClases } from "../../compartido/utils/clases.js";

export default function RadioCard({
  children,
  compacto = false,
  seleccionado = false,
  onClick,
}) {
  return (
    <button
      type="button"
      aria-pressed={seleccionado}
      onClick={onClick}
      className={unirClases(
        "flex w-full items-start gap-3 rounded-3xl border bg-white text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2d5a27]",
        compacto ? "p-2.5" : "p-3",
        seleccionado
          ? "border-[#2d5a27] bg-[#f0f7ee] shadow-[0_10px_26px_rgba(45,90,39,0.12)]"
          : "border-[#ebe6dc] hover:border-[#d8e6d4] hover:bg-[#fffdf9]",
      )}
    >
      {seleccionado ? (
        <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-[#2d5a27]" aria-hidden="true" />
      ) : (
        <Circle className="mt-0.5 h-5 w-5 shrink-0 text-[#b8b0a4]" aria-hidden="true" />
      )}
      <span className="min-w-0 flex-1">{children}</span>
    </button>
  );
}
