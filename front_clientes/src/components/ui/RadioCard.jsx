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
        "flex w-full items-start gap-3 rounded-[1.15rem] border bg-white text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#586b24]",
        compacto ? "px-5 py-4" : "p-4",
        seleccionado
          ? "border-[#c9d2b7] bg-[#eef3e9]"
          : "border-[#deded8] hover:border-[#c9d2b7] hover:bg-[#fffdf9]",
      )}
    >
      <span className="min-w-0 flex-1">{children}</span>
      <span
        className={unirClases(
          "mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2",
          seleccionado ? "border-[#586b24]" : "border-[#d6d6d0]",
        )}
        aria-hidden="true"
      >
        {seleccionado ? <span className="h-2.5 w-2.5 rounded-full bg-[#586b24]" /> : null}
      </span>
    </button>
  );
}
