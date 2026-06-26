import { formatearRangoPedido } from "../../utils/fechasPedido.js";
import Badge from "../ui/Badge.jsx";

const tonoPorTipo = {
  actual: "actual",
  proxima: "proxima",
  anterior: "anterior",
};

const etiquetaCortaPorTipo = {
  actual: "Actual",
  proxima: "Próxima",
  anterior: "Anterior",
};

export default function SemanaHeader({ semana }) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-3">
      <Badge tono={tonoPorTipo[semana.tipo] || "neutro"}>
        {etiquetaCortaPorTipo[semana.tipo] || semana.etiqueta}
      </Badge>
      <span className="text-right text-[0.95rem] font-black text-[#1a1a1a]">
        {formatearRangoPedido(semana.rango)}
      </span>
    </div>
  );
}
