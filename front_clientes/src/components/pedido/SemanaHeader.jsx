import Badge from "../ui/Badge.jsx";

const tonoPorTipo = {
  actual: "actual",
  proxima: "proxima",
  anterior: "anterior",
};

export default function SemanaHeader({ semana }) {
  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <Badge tono={tonoPorTipo[semana.tipo] || "neutro"}>
          {semana.etiqueta}
        </Badge>
        <span className="pt-1 text-right text-xs font-bold text-[#77736b]">
          {semana.rango}
        </span>
      </div>

      <div>
        <h2 className="text-xl font-black leading-tight text-[#1a1a1a]">
          {semana.titulo}
        </h2>
      </div>
    </div>
  );
}
