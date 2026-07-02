import { unirClases } from "../../compartido/utils/clases.js";

const estilos = {
  primario:
    "border-transparent bg-[#586b24] text-white shadow-[0_10px_24px_rgba(88,107,36,0.20)] hover:bg-[#4c5d1f] focus-visible:outline-[#586b24]",
  secundario:
    "border-[#d8e6d4] bg-white text-[#586b24] hover:bg-[#f0f7ee] focus-visible:outline-[#586b24]",
  suave:
    "border-[#d8e6d4] bg-[#eef3e9] text-[#3f4b20] hover:bg-[#e5f1e1] focus-visible:outline-[#586b24]",
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
        "inline-flex min-h-14 items-center justify-center rounded-[1.15rem] border px-4 py-3 text-[1.08rem] font-extrabold leading-none transition active:scale-[0.99] focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60",
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
