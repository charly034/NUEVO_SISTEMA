import { ArrowDown, ChevronLeft, Home, History, Layers, Map, User } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { rutasCliente } from "../routes/rutasCliente.js";

const grupos = [
  { label: "Tab", color: "bg-[#EDF0E4] text-[#5B6B2A]" },
  { label: "Pantalla", color: "bg-white text-[#2A2C1F]" },
  { label: "Sheet", color: "bg-[#FEF3E8] text-[#A65F18]" },
  { label: "Modal", color: "bg-red-50 text-red-700" },
];

function Chip({ children, className = "" }) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wide ${className}`}>
      {children}
    </span>
  );
}

function Nodo({ children, tono = "pantalla", icono: Icono = Layers }) {
  const clases = {
    tab: "border-[#C9D8BC] bg-[#EDF0E4]",
    pantalla: "border-[#E8E5DC] bg-white",
    sheet: "border-[#F1D4B6] bg-[#FEF3E8]",
    modal: "border-red-200 bg-red-50",
  };
  return (
    <div className={`rounded-2xl border px-4 py-3 shadow-sm ${clases[tono]}`}>
      <div className="flex items-start gap-3">
        <Icono className="mt-0.5 h-5 w-5 shrink-0 text-[#5B6B2A]" aria-hidden="true" />
        <div className="min-w-0 text-sm font-bold leading-snug text-[#2A2C1F]">{children}</div>
      </div>
    </div>
  );
}

export default function NavMapScreen() {
  const navigate = useNavigate();

  return (
    <main className="mx-auto flex h-dvh max-w-[760px] flex-col overflow-hidden bg-[#FAF8F3] text-[#2A2C1F]">
      <header className="shrink-0 bg-[#5B6B2A] px-5 pb-5 pt-12 text-white">
        <button
          type="button"
          onClick={() => navigate(rutasCliente.inicio)}
          className="-ml-1 mb-3 flex items-center gap-1 text-white/70 hover:text-white"
        >
          <ChevronLeft size={20} />
          <span className="text-[13px] font-bold">Inicio</span>
        </button>
        <div className="flex items-center gap-3">
          <Map className="h-7 w-7" aria-hidden="true" />
          <div>
            <h1 className="font-serif text-2xl font-bold">Mapa de navegacion</h1>
            <p className="text-sm text-white/60">Cliente La Quinta</p>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        <section className="mb-5 rounded-2xl border border-[#E8E5DC] bg-white p-4">
          <p className="mb-3 text-sm font-black uppercase tracking-wide text-[#9A9885]">Referencias</p>
          <div className="flex flex-wrap gap-2">
            {grupos.map((grupo) => (
              <Chip key={grupo.label} className={grupo.color}>{grupo.label}</Chip>
            ))}
          </div>
        </section>

        <div className="space-y-3">
          <Nodo tono="pantalla">Splash {"->"} Onboarding {"->"} Login</Nodo>
          <ArrowDown className="mx-auto h-5 w-5 text-[#C8C5BC]" />
          <Nodo tono="tab" icono={Home}>Inicio: destino fijo al home de pedidos.</Nodo>
          <Nodo tono="tab" icono={History}>Historial: pedidos anteriores y cancelacion in-place.</Nodo>
          <Nodo tono="tab" icono={User}>Perfil: cuenta, preferencias y sesion in-place.</Nodo>
          <Nodo tono="pantalla">Desde Inicio: Ver menu, Hacer pedido, Ver pedido cerrado.</Nodo>
          <Nodo tono="sheet">SuggestionSheet: sugerencias para semanas sin menu.</Nodo>
          <Nodo tono="sheet">Bottom sheets globales: selector de plato, detalle de plato, sugerencias y salir sin guardar.</Nodo>
          <Nodo tono="modal">Modal de confirmacion para salir sin guardar.</Nodo>
        </div>

        <section className="mt-5 grid grid-cols-3 gap-2">
          {[
            ["3", "tabs"],
            ["5", "pantallas"],
            ["4", "sheets"],
            ["2", "modales"],
            ["9", "total"],
            ["0", "nav ambigua"],
          ].map(([valor, label]) => (
            <div key={label} className="rounded-2xl border border-[#E8E5DC] bg-white px-3 py-4 text-center">
              <p className="font-serif text-2xl font-bold text-[#5B6B2A]">{valor}</p>
              <p className="text-[11px] font-black uppercase tracking-wide text-[#9A9885]">{label}</p>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}
