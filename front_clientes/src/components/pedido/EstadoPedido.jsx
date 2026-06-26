import { CheckCircle2, Clock3, ClipboardList, LockKeyhole } from "lucide-react";
import { unirClases } from "../../compartido/utils/clases.js";

const configuracionEstado = {
  confirmado: {
    Icono: CheckCircle2,
    titulo: "Pedido confirmado",
    descripcion: ({ diasSeleccionados }) =>
      `${diasSeleccionados} días seleccionados`,
    clases: "border-[#cde5c8] bg-[#f0f7ee] text-[#2d5a27]",
  },
  pendiente: {
    Icono: Clock3,
    titulo: "Pedido pendiente",
    descripcion: () => "Todavía podés elegir tu menú",
    clases: "border-[#eadfbd] bg-[#fbf5e3] text-[#7b5f12]",
  },
  sin_pedido: {
    Icono: ClipboardList,
    titulo: "Sin pedido",
    descripcion: () => "No hay selecciones para esta semana",
    clases: "border-[#e8e3da] bg-[#faf8f4] text-[#5f5a52]",
  },
  cerrado: {
    Icono: LockKeyhole,
    titulo: "Semana cerrada",
    descripcion: ({ diasSeleccionados }) =>
      diasSeleccionados > 0
        ? `${diasSeleccionados} días registrados`
        : "El período de edición finalizó",
    clases: "border-[#e8e3da] bg-[#faf8f4] text-[#5f5a52]",
  },
};

export default function EstadoPedido({ estado, diasSeleccionados }) {
  const config = configuracionEstado[estado] || configuracionEstado.sin_pedido;
  const { Icono } = config;

  return (
    <section
      className={unirClases(
        "flex items-center gap-3 rounded-3xl border p-4",
        config.clases,
      )}
      aria-label={config.titulo}
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/80">
        <Icono className="h-6 w-6" aria-hidden="true" />
      </span>
      <div>
        <p className="text-base font-black leading-tight">{config.titulo}</p>
        <p className="mt-0.5 text-sm font-semibold opacity-80">
          {config.descripcion({ diasSeleccionados })}
        </p>
      </div>
    </section>
  );
}
