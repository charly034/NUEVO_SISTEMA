import { unirClases } from "../../compartido/utils/clases.js";

const estilos = {
  actual: "border-[#cfe3c9] bg-[#f0f7ee] text-[#2d5a27]",
  proxima: "border-[#eadfbd] bg-[#fbf5e3] text-[#7b5f12]",
  anterior: "border-[#e8e3da] bg-[#faf8f4] text-[#6b6760]",
  neutro: "border-[#e8e3da] bg-white text-[#5f5a52]",
};

export default function Badge({ children, tono = "neutro", className }) {
  return (
    <span
      className={unirClases(
        "inline-flex min-h-7 items-center rounded-full border px-3 text-xs font-bold",
        estilos[tono] || estilos.neutro,
        className,
      )}
    >
      {children}
    </span>
  );
}
