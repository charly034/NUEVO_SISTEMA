import { unirClases } from "../utils/clases.js";

const variantes = {
  primario:
    "border-transparent bg-[var(--verde)] text-white hover:bg-[var(--verde-light)] focus-visible:outline-[var(--verde)]",
  secundario:
    "border-[var(--verde)] bg-white text-[var(--verde)] hover:bg-[var(--verde-bg)] focus-visible:outline-[var(--verde)]",
  suave:
    "border-green-200 bg-green-50 text-green-800 hover:bg-green-100 focus-visible:outline-[var(--verde)]",
  fantasma:
    "border-transparent bg-transparent text-slate-600 underline-offset-4 hover:text-[var(--verde)] hover:underline focus-visible:outline-[var(--verde)]",
  peligro:
    "border-red-200 bg-red-50 text-red-700 hover:bg-red-100 focus-visible:outline-red-600",
};

export default function Boton({
  children,
  variante = "primario",
  anchoCompleto = false,
  cargando = false,
  disabled,
  className,
  type = "button",
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || cargando}
      className={unirClases(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border px-4 py-3 text-center text-base font-bold transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-70",
        anchoCompleto && "w-full",
        variantes[variante] || variantes.primario,
        className,
      )}
      {...props}
    >
      {cargando && (
        <svg
          className="h-4 w-4 animate-spin"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 0 1 8-8v8z"
          />
        </svg>
      )}
      {children}
    </button>
  );
}
