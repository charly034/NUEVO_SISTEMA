import { unirClases } from "../utils/clases.js";

const variantes = {
  verde: "bg-green-100 text-green-800",
  gris: "bg-slate-100 text-slate-600",
  azul: "bg-blue-100 text-blue-800",
  naranja: "bg-orange-100 text-orange-800",
  rojo: "bg-red-100 text-red-700",
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
