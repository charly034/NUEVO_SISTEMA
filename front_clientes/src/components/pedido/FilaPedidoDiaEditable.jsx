import {
  Ban,
  CalendarX,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  Clock3,
  LockKeyhole,
} from "lucide-react";
import { unirClases } from "../../compartido/utils/clases.js";
import { formatearFechaPedido } from "../../utils/fechasPedido.js";

function formatearFechaDia(fecha) {
  if (!fecha) return "";
  const [anio, mes, dia] = String(fecha).split("T")[0].split("-").map(Number);
  if (!anio || !mes || !dia) return "";
  return formatearFechaPedido(new Date(anio, mes - 1, dia));
}

const estadoBase = {
  Icono: CircleDashed,
  texto: "Sin elegir",
  clases: "text-[#8a6a1f]",
};

const configuracionEstado = {
  editable: {
    Icono: CheckCircle2,
    texto: "Elegido",
    clases: "text-[#2d5a27]",
  },
  feriado: {
    Icono: CalendarX,
    texto: "Feriado",
    clases: "text-[#7b756d]",
  },
  sin_seleccionar: estadoBase,
  sin_menu: {
    Icono: Clock3,
    texto: "Sin menu especial",
    clases: "text-[#8a6a1f]",
  },
  sin_pedido_por_defecto: {
    Icono: CircleDashed,
    texto: "Por defecto",
    clases: "text-[#8a6a1f]",
  },
  sin_servicio: {
    Icono: Ban,
    texto: "Sin servicio",
    clases: "text-[#7b756d]",
  },
  seleccionado: {
    Icono: CheckCircle2,
    texto: "Elegido",
    clases: "text-[#2d5a27]",
  },
  bloqueado: {
    Icono: LockKeyhole,
    texto: "Bloqueado",
    clases: "text-[#7b756d]",
  },
  vencido: {
    Icono: LockKeyhole,
    texto: "Vencido",
    clases: "text-[#7b756d]",
  },
};

export default function FilaPedidoDiaEditable({
  dia,
  estadoVisual,
  onAbrir,
  onSinVianda,
}) {
  const deshabilitado = ["bloqueado", "feriado", "vencido"].includes(estadoVisual);
  const sinSeleccion = !dia.plato || dia.plato === "Sin seleccionar";
  const esSinVianda = dia.plato === "Sin pedido" || dia.plato === "Sin pedido por defecto";
  const textoPlato = sinSeleccion ? "Sin elegir" : dia.plato;
  const estado = configuracionEstado[estadoVisual] || estadoBase;
  const { Icono } = estado;
  const ayudaAccion = deshabilitado
    ? dia.motivo || "Ya no se puede modificar"
    : "Tocar para elegir o cambiar plato";
  const menusPublicados = (dia.opciones || [])
    .filter((opcion) => opcion.destacado)
    .slice(0, 3);
  const fechaDia = formatearFechaDia(dia.fecha);

  return (
    <li className="border-b border-[#f0ebe2] py-0.5 last:border-b-0">
      <div className="flex items-center">
        <button
          type="button"
          aria-label={`${dia.dia}. ${estado.texto}. ${textoPlato}. ${ayudaAccion}.`}
          disabled={deshabilitado}
          onClick={onAbrir}
          className={unirClases(
            "grid min-w-0 flex-1 grid-cols-[4.6rem_1fr] items-start gap-2 rounded-2xl px-1 py-1.5 text-left transition",
            deshabilitado
              ? "cursor-not-allowed bg-[#faf8f4]"
              : "hover:bg-[#faf8f4] active:bg-[#f0f7ee]",
          )}
        >
          <div className="min-w-0">
            <p className="text-[0.95rem] font-black leading-none text-[#2d5a27]">{dia.dia}</p>
            {fechaDia && (
              <p className="mt-0.5 text-[0.65rem] font-bold leading-none text-[#9c968d]">
                {fechaDia}
              </p>
            )}
            <p
              className={unirClases(
                "mt-1 inline-flex items-center gap-1 text-[0.68rem] font-black uppercase tracking-wide",
                estado.clases,
              )}
            >
              <Icono className="h-3 w-3 shrink-0" aria-hidden="true" />
              {estado.texto}
            </p>
          </div>

          <div className="min-w-0 text-right">
            <p className="line-clamp-2 text-[1rem] font-black leading-tight text-[#1a1a1a]">
              {textoPlato}
            </p>
            {sinSeleccion && !deshabilitado && menusPublicados.length > 0 && (
              <div className="mt-0.5 space-y-0.5">
                {menusPublicados.map((opcion) => (
                  <p
                    key={opcion.id}
                    className="truncate text-[0.74rem] font-bold leading-none text-[#8a6a1f]"
                  >
                    {opcion.nombre}
                  </p>
                ))}
              </div>
            )}
            {deshabilitado && (
              <p className="mt-0.5 truncate text-[0.72rem] font-bold leading-none text-[#8a857c]">
                {dia.motivo || "Ya no se puede modificar"}
              </p>
            )}
            {!deshabilitado && dia.motivo && (
              <p className="mt-0.5 line-clamp-1 text-[0.72rem] font-bold leading-none text-[#8a6a1f]">
                {dia.motivo}
              </p>
            )}
            {!deshabilitado && dia.mensajeMenu && (
              <p className="mt-0.5 line-clamp-1 text-[0.72rem] font-bold leading-none text-[#8a6a1f]">
                {dia.mensajeMenu}
              </p>
            )}
          </div>
        </button>

        <div className="shrink-0 pl-0.5 pr-1">
          {deshabilitado ? (
            <LockKeyhole className="h-[1.125rem] w-[1.125rem] text-[#9c968d]" aria-hidden="true" />
          ) : (
            <div className="flex items-center gap-1">
              <button
                type="button"
                aria-label={esSinVianda ? "Quitar sin vianda" : "Sin vianda este día"}
                onClick={(e) => { e.stopPropagation(); onSinVianda?.(dia); }}
                className={unirClases(
                  "flex h-7 w-7 items-center justify-center rounded-full border transition",
                  esSinVianda
                    ? "border-[#f0ccc3] bg-[#fff0ed] text-[#c04c2f]"
                    : "border-transparent text-[#c0b9b0] hover:border-[#e8e3da] hover:text-[#716c64]",
                )}
              >
                <Ban className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
              <ChevronRight className="h-5 w-5 text-[#2d5a27]" aria-hidden="true" />
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
