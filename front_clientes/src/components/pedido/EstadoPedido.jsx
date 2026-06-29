import {
  CalendarClock,
  CheckCircle2,
  Clock3,
  ClipboardList,
  LockKeyhole,
} from "lucide-react";
import { unirClases } from "../../compartido/utils/clases.js";

function textoProgreso({ diasSeleccionados = 0, totalDias = 0 }) {
  if (!totalDias) return `${diasSeleccionados} dias`;
  return `${diasSeleccionados} de ${totalDias} dias`;
}

function textoDiasPendientes(cantidad) {
  return `Faltan ${cantidad} ${cantidad === 1 ? "día" : "días"}`;
}

const configuracionEstado = {
  confirmado: {
    Icono: CheckCircle2,
    titulo: "Confirmado",
    descripcion: textoProgreso,
    clases: "border-[#cde5c8] bg-[#f0f7ee] text-[#2d5a27]",
  },
  editable: {
    Icono: Clock3,
    titulo: "Editando",
    descripcion: ({ diasPendientes, diasSeleccionados, totalDias }) => {
      if (!diasSeleccionados) return "Elegi tus platos";
      if (diasPendientes > 0) return textoDiasPendientes(diasPendientes);
      return totalDias ? textoProgreso({ diasSeleccionados, totalDias }) : "Completo";
    },
    clases: "border-[#cde5c8] bg-[#f0f7ee] text-[#2d5a27]",
  },
  pendiente: {
    Icono: Clock3,
    titulo: "Pendiente",
    descripcion: ({ diasPendientes }) =>
      diasPendientes > 0 ? textoDiasPendientes(diasPendientes) : "Elegi tus platos",
    clases: "border-[#eadfbd] bg-[#fbf5e3] text-[#7b5f12]",
  },
  sin_pedido: {
    Icono: ClipboardList,
    titulo: "Todavia no pediste",
    descripcion: ({ totalDias }) => totalDias ? `0 de ${totalDias} dias` : "Menu disponible",
    clases: "border-[#eadfbd] bg-[#fbf5e3] text-[#7b5f12]",
  },
  sin_menu: {
    Icono: CalendarClock,
    titulo: "En preparacion",
    descripcion: () => "Sugerencias abiertas",
    clases: "border-[#eadfbd] bg-[#fbf5e3] text-[#7b5f12]",
  },
  cerrado: {
    Icono: LockKeyhole,
    titulo: "Cerrada",
    descripcion: textoProgreso,
    clases: "border-[#e8e3da] bg-[#faf8f4] text-[#5f5a52]",
  },
  fuera_de_plazo: {
    Icono: LockKeyhole,
    titulo: "Fuera de plazo",
    descripcion: () => "Solo detalle",
    clases: "border-[#e8e3da] bg-[#faf8f4] text-[#5f5a52]",
  },
};

export default function EstadoPedido({
  estado,
  diasSeleccionados = 0,
  totalDias = 0,
}) {
  const config = configuracionEstado[estado] || configuracionEstado.sin_pedido;
  const { Icono } = config;
  const diasPendientes = Math.max(totalDias - diasSeleccionados, 0);
  const descripcion = config.descripcion({
    diasPendientes,
    diasSeleccionados,
    totalDias,
  });

  return (
    <section
      className={unirClases(
        "flex min-h-10 shrink-0 items-center gap-2 rounded-2xl border px-3 py-2",
        config.clases,
      )}
      aria-label={`${config.titulo}: ${descripcion}`}
    >
      <Icono className="h-4 w-4 shrink-0" aria-hidden="true" />
      <p className="min-w-0 flex-1 truncate text-base font-black leading-none">
        {config.titulo}
      </p>
      <p className="shrink-0 text-right text-sm font-black leading-none opacity-80">
        {descripcion}
      </p>
    </section>
  );
}
