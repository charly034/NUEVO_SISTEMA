import { X } from "lucide-react";
import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";

export default function BottomSheet({
  abierto,
  children,
  encabezadoCompacto = false,
  onCerrar,
  subtitulo,
  titulo,
}) {
  const tituloId = useId();
  const subtituloId = useId();
  const botonCerrarRef = useRef(null);

  useEffect(() => {
    if (!abierto) return undefined;
    const overflowPrevio = document.body.style.overflow;

    function manejarEscape(event) {
      if (event.key === "Escape") onCerrar?.();
    }

    document.body.style.overflow = "hidden";
    window.requestAnimationFrame(() => botonCerrarRef.current?.focus());
    document.addEventListener("keydown", manejarEscape);
    return () => {
      document.body.style.overflow = overflowPrevio;
      document.removeEventListener("keydown", manejarEscape);
    };
  }, [abierto, onCerrar]);

  if (!abierto || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[120]" role="presentation">
      <button
        type="button"
        className="absolute inset-0 bg-[#1a1a1a]/28 backdrop-blur-[2px]"
        aria-label="Cerrar selección"
        onClick={onCerrar}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        aria-describedby={subtitulo ? subtituloId : undefined}
        className="absolute inset-x-0 bottom-0 mx-auto flex max-h-[88dvh] min-h-[70dvh] max-w-[480px] animate-[sheetUp_180ms_ease-out] flex-col overflow-hidden rounded-t-[2rem] bg-[#faf8f4] shadow-[0_-18px_44px_rgba(26,26,26,0.18)]"
      >
        <div className={[
          "shrink-0 border-b border-[#eee8df] bg-[#faf8f4] px-4",
          encabezadoCompacto ? "pt-1.5 pb-1" : "pt-3 pb-3",
        ].join(" ")}>
          <div className={[
            "mx-auto h-1.5 w-12 rounded-full bg-[#d8d2c8]",
            encabezadoCompacto ? "mb-1.5" : "mb-3",
          ].join(" ")} />
          <div className={encabezadoCompacto ? "flex justify-end" : "flex items-start justify-between gap-3"}>
            <div className={encabezadoCompacto ? "sr-only" : undefined}>
              <h2 id={tituloId} className={encabezadoCompacto ? undefined : "text-xl font-black text-[#1a1a1a]"}>
                {titulo}
              </h2>
              {subtitulo && (
                <p id={subtituloId} className={encabezadoCompacto ? undefined : "mt-0.5 text-sm font-bold text-[#716c64]"}>
                  {subtitulo}
                </p>
              )}
            </div>
            <button
              ref={botonCerrarRef}
              type="button"
              aria-label="Cerrar"
              onClick={onCerrar}
              className={[
                "flex shrink-0 items-center justify-center rounded-full bg-white text-[#5f5a52] shadow-[0_8px_22px_rgba(45,90,39,0.08)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2d5a27]",
                encabezadoCompacto ? "h-10 w-10" : "h-11 w-11",
              ].join(" ")}
            >
              <X className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
        </div>

        {children}
      </section>
    </div>,
    document.body,
  );
}
