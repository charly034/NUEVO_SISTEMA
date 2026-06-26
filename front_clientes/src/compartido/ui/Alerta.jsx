import { unirClases } from "../utils/clases.js";

const variantes = {
  error: "border-red-200 bg-red-50 text-red-700",
  exito: "border-green-200 bg-green-50 text-green-700",
  info: "border-slate-200 bg-slate-50 text-slate-600",
};

export default function Alerta({ children, variante = "info", className }) {
  return (
    <p
      role={variante === "error" ? "alert" : undefined}
      className={unirClases(
        "rounded-lg border px-3 py-2 text-center text-sm leading-snug",
        variantes[variante] || variantes.info,
        className,
      )}
    >
      {children}
    </p>
  );
}
