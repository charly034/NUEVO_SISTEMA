import { Lightbulb } from "lucide-react";

export default function ContenidoSemanaSinMenu({ onSugerir }) {
  return (
    <button
      type="button"
      onClick={onSugerir}
      className="flex min-h-0 flex-1 flex-col items-center justify-center rounded-3xl border border-[#d8e6d4] bg-[#f0f7ee] px-5 py-6 text-center text-[#2d5a27] transition hover:bg-[#eaf4e6] active:scale-[0.995] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2d5a27]"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white shadow-[0_10px_24px_rgba(45,90,39,0.08)]">
        <Lightbulb className="h-6 w-6" aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-xl font-black leading-tight">
        Enviános tu sugerencia
      </h3>
      <p className="mt-2 max-w-[18rem] text-sm font-bold leading-snug text-[#4f7448]">
        Ayudanos a armar el menú de esta semana.
      </p>
      <span className="mt-5 inline-flex min-h-11 items-center justify-center rounded-2xl bg-[#2d5a27] px-5 text-[0.95rem] font-black text-white shadow-[0_10px_24px_rgba(45,90,39,0.18)]">
        Sugerir menú
      </span>
    </button>
  );
}
