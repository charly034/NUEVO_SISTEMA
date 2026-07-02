import { unirClases } from "../utils/clases.js";

const variantes = {
  verde: "bg-[#dff4e2] text-[#216029]",
  gris: "bg-[#f1f2ee] text-[#667085]",
  azul: "bg-[#e6f0ff] text-[#2454a6]",
  naranja: "bg-[#fff1d8] text-[#9a5a11]",
  rojo: "bg-[#ffe7e7] text-[#b91c1c]",
};

export default function Badge({ children, variante = "gris", className }) {
  return (
    <span
      className={unirClases(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold leading-5",
        variantes[variante] || variantes.gris,
        className,
      )}
    >
      {children}
    </span>
  );
}
