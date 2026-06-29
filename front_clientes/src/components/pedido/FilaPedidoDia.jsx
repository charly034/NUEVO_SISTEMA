import { CheckCircle2, CircleDashed } from "lucide-react";
import { unirClases } from "../../compartido/utils/clases.js";
import { formatearFechaPedido } from "../../utils/fechasPedido.js";

const textosSinSeleccion = ["Sin seleccionar", "Sin pedido", "Sin pedido para este dia"];

function esSinSeleccion(plato) {
  return !plato || textosSinSeleccion.includes(plato);
}

function obtenerEspecialesPublicados(opciones = []) {
  return opciones.filter((opcion) => opcion.destacado);
}

function formatearFechaDia(fecha) {
  if (!fecha) return "";
  const [anio, mes, dia] = String(fecha).split("T")[0].split("-").map(Number);
  if (!anio || !mes || !dia) return "";
  return formatearFechaPedido(new Date(anio, mes - 1, dia));
}

export default function FilaPedidoDia({
  dia,
  fecha,
  modoConfirmado = false,
  modoMenuPublicado = false,
  opciones = [],
  plato,
}) {
  const sinSeleccion = esSinSeleccion(plato);
  const especialesPublicados = obtenerEspecialesPublicados(opciones);
  const fechaTexto = formatearFechaDia(fecha);

  if (modoMenuPublicado && sinSeleccion) {
    return (
      <li className="border-b border-[#f0ebe2] py-2 last:border-b-0">
        <div className="rounded-2xl bg-[#fffdf8] px-3 py-3 ring-1 ring-[#f0ebe2]">
          <div className="flex items-baseline justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[1.05rem] font-black leading-tight text-[#2d5a27]">
                {dia}
              </p>
              {fechaTexto && (
                <p className="mt-0.5 text-[0.78rem] font-black uppercase tracking-wide text-[#716c64]">
                  {fechaTexto}
                </p>
              )}
            </div>
            <span className="shrink-0 rounded-full bg-[#f0f7ee] px-2 py-1 text-[0.72rem] font-black text-[#2d5a27] ring-1 ring-[#d8e6d4]">
              {especialesPublicados.length || 0} opciones
            </span>
          </div>

          <div className="mt-3 space-y-2">
            {especialesPublicados.length > 0 ? (
              especialesPublicados.map((opcion) => (
                <div
                  key={opcion.id}
                  className="rounded-2xl border border-[#e8e3da] bg-white px-3 py-2"
                >
                  <p className="text-[0.95rem] font-black leading-tight text-[#1a1a1a]">
                    {opcion.nombre}
                  </p>
                  {opcion.descripcion && (
                    <p className="mt-0.5 line-clamp-2 text-[0.78rem] font-bold leading-snug text-[#716c64]">
                      {opcion.descripcion}
                    </p>
                  )}
                </div>
              ))
            ) : (
              <p className="rounded-2xl border border-[#edd9b8] bg-[#fff7eb] px-3 py-2 text-[0.9rem] font-black leading-tight text-[#8a5a18]">
                Menu a confirmar
              </p>
            )}
          </div>
        </div>
      </li>
    );
  }

  return (
    <li className="flex min-h-0 flex-1 border-b border-[#f0ebe2] py-0.5 last:border-b-0">
      <div
        className={unirClases(
          "grid min-h-0 w-full grid-cols-[4.8rem_1fr] items-center gap-2 rounded-2xl px-1.5 py-1",
          sinSeleccion && "bg-[#fffaf0]",
        )}
      >
        <span className="text-[0.98rem] font-black leading-none text-[#2d5a27]">
          {dia}
        </span>

        <div className="min-w-0 text-right">
          <span
            className={unirClases(
              "flex items-start justify-end gap-1.5 font-black leading-tight",
              sinSeleccion ? "text-[#8a6a1f]" : "text-[#1a1a1a]",
            )}
          >
            {sinSeleccion ? (
              <CircleDashed className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#b58b24]" aria-hidden="true" />
            ) : !modoConfirmado ? (
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#2d5a27]" aria-hidden="true" />
            ) : null}
            <span className="line-clamp-2 min-w-0 text-[1rem]">
              {sinSeleccion ? "Sin elegir" : plato}
            </span>
          </span>

          {sinSeleccion && especialesPublicados.length > 0 && (
            <div className="mt-0.5 space-y-0.5">
              {especialesPublicados.slice(0, 2).map((opcion) => (
                <p
                  key={opcion.id}
                  className="truncate text-[0.76rem] font-extrabold leading-none text-[#716c64]"
                >
                  {opcion.nombre}
                </p>
              ))}
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
