import {
  Ban,
  CheckCircle2,
  ChevronRight,
  CircleDashed,
  Clock3,
  LockKeyhole,
} from "lucide-react";
import { unirClases } from "../../compartido/utils/clases.js";

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
    Icono: Ban,
    texto: "Sin servicio",
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
}) {
  const deshabilitado = ["bloqueado", "feriado", "sin_servicio", "vencido"].includes(estadoVisual);
  const sinSeleccion = !dia.plato || dia.plato === "Sin seleccionar";
  const textoPlato = sinSeleccion ? "Sin elegir" : dia.plato;
  const estado = configuracionEstado[estadoVisual] || estadoBase;
  const { Icono } = estado;
  const ayudaAccion = deshabilitado
    ? dia.motivo || "Ya no se puede modificar"
    : "Tocar para elegir o cambiar plato";
  const menusPublicados = (dia.opciones || [])
    .filter((opcion) => opcion.destacado)
    .slice(0, 2);

  return (
    <li className="flex min-h-0 flex-1 border-b border-[#f0ebe2] py-0.5 last:border-b-0">
      <button
        type="button"
        aria-label={`${dia.dia}. ${estado.texto}. ${textoPlato}. ${ayudaAccion}.`}
        disabled={deshabilitado}
        onClick={onAbrir}
        className={unirClases(
          "grid min-h-0 w-full grid-cols-[4.6rem_1fr_auto] items-center gap-2 rounded-2xl px-1 py-1 text-left transition",
          deshabilitado
            ? "cursor-not-allowed bg-[#faf8f4]"
            : "hover:bg-[#faf8f4] active:bg-[#f0f7ee]",
        )}
      >
        <div className="min-w-0">
          <p className="text-[0.95rem] font-black leading-none text-[#2d5a27]">{dia.dia}</p>
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
          {!deshabilitado && dia.mensajeMenu && (
            <p className="mt-0.5 line-clamp-1 text-[0.72rem] font-bold leading-none text-[#8a6a1f]">
              {dia.mensajeMenu}
            </p>
          )}
        </div>

        {deshabilitado ? (
          <LockKeyhole className="h-[1.125rem] w-[1.125rem] shrink-0 text-[#9c968d]" aria-hidden="true" />
        ) : (
          <ChevronRight className="h-5 w-5 shrink-0 text-[#2d5a27]" aria-hidden="true" />
        )}
      </button>
    </li>
  );
}
