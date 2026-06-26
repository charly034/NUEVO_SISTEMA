import { unirClases } from "../../compartido/utils/clases.js";

const estilos = {
  primario:
    "border-transparent bg-[#2d5a27] text-white shadow-[0_10px_24px_rgba(45,90,39,0.22)] hover:bg-[#244820] focus-visible:outline-[#2d5a27]",
  secundario:
    "border-[#d8e6d4] bg-white text-[#2d5a27] hover:bg-[#f0f7ee] focus-visible:outline-[#2d5a27]",
  suave:
    "border-[#d8e6d4] bg-[#f0f7ee] text-[#2d5a27] hover:bg-[#e5f1e1] focus-visible:outline-[#2d5a27]",
  neutro:
    "border-[#e8e3da] bg-white text-[#4c4a45] hover:bg-[#faf8f4] focus-visible:outline-[#2d5a27]",
};

export default function Boton({
  children,
  variante = "primario",
  anchoCompleto = false,
  className,
  type = "button",
  ...props
}) {
  return (
    <button
      type={type}
      className={unirClases(
        "inline-flex min-h-12 items-center justify-center rounded-2xl border px-4 py-3 text-sm font-bold transition active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
        anchoCompleto && "w-full",
        estilos[variante] || estilos.primario,
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
