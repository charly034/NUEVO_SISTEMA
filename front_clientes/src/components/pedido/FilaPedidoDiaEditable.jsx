import { ChevronRight, LockKeyhole } from "lucide-react";
import { unirClases } from "../../compartido/utils/clases.js";

const textoEstado = {
  editable: "Editable",
  feriado: "Sin servicio",
  sin_seleccionar: "Editable",
  sin_menu: "Sin menu especial",
  sin_pedido_por_defecto: "Por defecto",
  sin_servicio: "Sin servicio",
  seleccionado: "Elegido",
  bloqueado: "Bloqueado",
  vencido: "Vencido",
};

export default function FilaPedidoDiaEditable({
  dia,
  estadoVisual,
  onAbrir,
}) {
  const deshabilitado = ["bloqueado", "feriado", "sin_servicio", "vencido"].includes(estadoVisual);
  const sinSeleccion = !dia.plato || dia.plato === "Sin seleccionar";
  const textoPlato = sinSeleccion ? "Sin elegir" : dia.plato;
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
        aria-label={`${dia.dia}. ${textoEstado[estadoVisual] || "Editable"}. ${textoPlato}. ${ayudaAccion}.`}
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
              "mt-1 text-[0.68rem] font-black uppercase tracking-wide",
              deshabilitado ? "text-[#7b756d]" : "text-[#6c8f5d]",
            )}
          >
            {textoEstado[estadoVisual] || "Editable"}
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
