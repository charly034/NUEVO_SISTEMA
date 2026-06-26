import { Info } from "lucide-react";
import { unirClases } from "../../compartido/utils/clases.js";

export default function AvisoModificacion({ mensaje, tono = "ayuda" }) {
  if (!mensaje) return null;

  return (
    <div
      className={unirClases(
        "flex min-h-8 items-start gap-2 rounded-2xl border px-3 py-1.5 text-[0.82rem] font-bold leading-snug",
        tono === "sutil"
          ? "min-h-0 border-transparent bg-transparent px-1 py-0 text-[0.78rem] text-[#5f6f59]"
          : tono === "bloqueado"
          ? "border-[#e8e3da] bg-[#faf8f4] text-[#5f5a52]"
          : "border-[#d8e6d4] bg-[#f0f7ee] text-[#2d5a27]",
      )}
      role="status"
    >
      <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <p className="line-clamp-2">{mensaje}</p>
    </div>
  );
}
