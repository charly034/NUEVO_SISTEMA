import { CalendarDays, Clock3, ClipboardCheck } from "lucide-react";
import { formatearRangoPedido } from "../../utils/fechasPedido.js";
import Boton from "../ui/Boton.jsx";
import AvisoModificacion from "./AvisoModificacion.jsx";
import EstadoPedido from "./EstadoPedido.jsx";
import ListaDiasPedido from "./ListaDiasPedido.jsx";
import SemanaHeader from "./SemanaHeader.jsx";

const textosEstado = {
  cerrado: "Pedido cerrado",
  confirmado: "Pedido confirmado",
  pendiente: "Pedido pendiente",
  sin_pedido: "Sin pedido cargado",
};

export default function SemanaCardDetalle({
  compacta = false,
  mensajeLimite,
  onVolver,
  semana,
}) {
  const estado = textosEstado[semana.estado] || "Detalle del pedido";

  return (
    <>
      <SemanaHeader semana={semana} compacta={compacta} />
      <EstadoPedido
        estado={semana.estado}
        diasSeleccionados={semana.diasSeleccionados}
        totalDias={semana.metadata?.cantidadDias || semana.dias?.length || 0}
        compacta={compacta}
      />

      <section className="rounded-3xl border border-[#e4ddcf] bg-white px-3 py-3 shadow-[0_10px_24px_rgba(45,90,39,0.06)]">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#f0f7ee] text-[#2d5a27]">
            <ClipboardCheck className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="text-[1.05rem] font-black leading-tight text-[#1a1a1a]">
              {estado}
            </h3>
            <p className="mt-1 text-sm font-bold leading-snug text-[#716c64]">
              {semana.diasSeleccionados || 0} días elegidos para esta semana.
            </p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-sm font-extrabold text-[#4f4a43]">
          <div className="rounded-2xl bg-[#faf8f4] px-3 py-2">
            <span className="flex items-center gap-1.5 text-[#2d5a27]">
              <CalendarDays className="h-4 w-4" aria-hidden="true" />
              Rango
            </span>
            <p className="mt-1">{formatearRangoPedido(semana.rango)}</p>
          </div>
          <div className="rounded-2xl bg-[#faf8f4] px-3 py-2">
            <span className="flex items-center gap-1.5 text-[#2d5a27]">
              <Clock3 className="h-4 w-4" aria-hidden="true" />
              Entrega
            </span>
            <p className="mt-1">Mediodía</p>
          </div>
        </div>
      </section>

      <AvisoModificacion mensaje={mensajeLimite} tono="ayuda" />
      <ListaDiasPedido dias={semana.dias} compacta={compacta} />

      <div className="mt-auto shrink-0 pt-1 max-[700px]:pt-0">
        <Boton anchoCompleto variante="secundario" onClick={onVolver}>
          Volver al pedido
        </Boton>
      </div>
    </>
  );
}
