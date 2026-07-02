import { unirClases } from "../utils/clases.js";

const variantes = {
  primario:
    "border-transparent bg-[#2d5a27] text-white shadow-[0_10px_20px_rgba(45,90,39,0.12)] hover:bg-[#3d7a35] focus-visible:outline-[#2d5a27]",
  secundario:
    "border-[#9fb998] bg-white text-[#2d5a27] hover:bg-[#f0f7ee] focus-visible:outline-[#2d5a27]",
  suave:
    "border-[#cde5c8] bg-[#f0f7ee] text-[#2d5a27] hover:bg-[#e7f2e4] focus-visible:outline-[#2d5a27]",
  fantasma:
    "border-transparent bg-transparent text-[#716c64] underline-offset-4 hover:text-[#2d5a27] hover:underline focus-visible:outline-[#2d5a27]",
  peligro:
    "border-[#f4c7c7] bg-[#fff3f3] text-[#b91c1c] hover:bg-[#ffe8e8] focus-visible:outline-[#b91c1c]",
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
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-center text-base font-black transition focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-70",
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
