import { unirClases } from "../../compartido/utils/clases.js";

export default function ChipSeleccionable({
  children,
  onClick,
  seleccionado = false,
}) {
  return (
    <button
      type="button"
      aria-pressed={seleccionado}
      onClick={onClick}
      className={unirClases(
        "min-h-10 rounded-full border px-3 py-2 text-sm font-black transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2d5a27]",
        seleccionado
          ? "border-[#2d5a27] bg-[#2d5a27] text-white"
          : "border-[#d8e6d4] bg-white text-[#2d5a27] hover:bg-[#f0f7ee]",
      )}
    >
      {children}
    </button>
  );
}
