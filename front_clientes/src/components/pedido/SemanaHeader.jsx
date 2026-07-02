import { formatearRangoPedido } from "../../utils/fechasPedido.js";

const etiquetaPorTipo = {
  actual: "Semana actual",
  proxima: "Proxima semana",
  anterior: "Semana anterior",
};

export default function SemanaHeader({ semana }) {
  return (
    <header className="shrink-0 bg-[#586b24] px-6 pb-7 pt-[calc(1.75rem+env(safe-area-inset-top))] text-white">
      <button
        type="button"
        className="-ml-1 mb-5 inline-flex items-center gap-2 text-[1rem] font-semibold text-white/78"
        onClick={() => window.dispatchEvent(new Event("pedido:ir-semana-actual"))}
      >
        <span className="text-3xl font-light leading-none" aria-hidden="true">
          &lsaquo;
        </span>
        Inicio
      </button>
      <h2 className="text-[1.78rem] font-extrabold leading-tight">
        {etiquetaPorTipo[semana.tipo] || semana.etiqueta || semana.titulo}
      </h2>
      <p className="mt-2 text-[1.12rem] font-semibold leading-tight text-white/58">
        {formatearRangoPedido(semana.rango)}
      </p>
      {semana.metadata?.tieneMenuPublicado && (
        <span className="mt-5 inline-flex rounded-full bg-[#f4f5ed] px-3 py-1 text-[0.82rem] font-extrabold uppercase tracking-wide text-[#3f4b20]">
          Menu publicado
        </span>
      )}
    </header>
  );
}
