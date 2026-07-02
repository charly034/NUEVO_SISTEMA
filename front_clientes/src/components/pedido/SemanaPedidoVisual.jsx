import { CheckCircle2 } from "lucide-react";
import { unirClases } from "../../compartido/utils/clases.js";
import { formatearFechaDia, obtenerEstadoDiaMockup } from "./semanaPedidoVisualUtils.js";

export function ProgresoSemana({ completados, guardado = false, total }) {
  const porcentaje = total > 0 ? Math.min((completados / total) * 100, 100) : 0;

  return (
    <section className="shrink-0 border-b border-[#ecebe5] bg-white px-6 py-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[1rem] font-extrabold leading-tight text-[#2c2b29]">
          {completados} de {total} dias completados
        </p>
        {guardado && (
          <p className="inline-flex shrink-0 items-center gap-1 text-[0.95rem] font-extrabold text-[#2f8c78]">
            <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
            Pedido guardado
          </p>
        )}
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[#ecece6]">
        <div
          className="h-full rounded-full bg-[#586b24] transition-[width]"
          style={{ width: `${porcentaje}%` }}
        />
      </div>
    </section>
  );
}

export function DiaPedidoCard({ dia, estadoVisual, onAbrir }) {
  const fechaDia = formatearFechaDia(dia.fecha);
  const estado = obtenerEstadoDiaMockup(dia, estadoVisual);
  const deshabilitado = estado.tono === "bloqueado";

  return (
    <li className="shrink-0">
      <button
        type="button"
        disabled={deshabilitado}
        onClick={onAbrir}
        className={unirClases(
          "w-full rounded-[1.15rem] border bg-white px-5 py-4 text-left shadow-[0_2px_8px_rgba(26,26,26,0.12)] transition",
          estado.tono === "seleccionado"
            ? "border-[#d6dcc9]"
            : "border-[#deded8]",
          deshabilitado
            ? "cursor-not-allowed opacity-60"
            : "hover:border-[#bcc8a3] active:scale-[0.995]",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-2">
              <span
                className={unirClases(
                  "h-2.5 w-2.5 shrink-0 rounded-full",
                  estado.tono === "pendiente" ? "bg-[#dde2d4]" : "bg-[#65792b]",
                )}
                aria-hidden="true"
              />
              <p className="truncate text-[1.08rem] font-extrabold leading-tight text-[#2b2b28]">
                {dia.dia}
                {fechaDia && (
                  <span className="ml-2 font-semibold text-[#b1b1aa]">
                    {fechaDia}
                  </span>
                )}
              </p>
            </div>
            <p
              className={unirClases(
                "mt-2 pl-5 text-[1.08rem] font-semibold leading-snug",
                estado.tono === "pendiente" ? "text-[#b0b0aa]" : "text-[#3a3935]",
              )}
            >
              {estado.texto}
            </p>
            {estado.detalle && (
              <p className="mt-1 pl-5 text-[0.95rem] font-semibold leading-snug text-[#77736c]">
                {estado.detalle}
              </p>
            )}
          </div>

          <span
            className={unirClases(
              "mt-0.5 shrink-0 rounded-full px-3 py-1 text-[0.78rem] font-extrabold uppercase tracking-wide",
              estado.tono === "seleccionado"
                ? "bg-[#eef1e7] text-[#566824]"
                : estado.tono === "sinVianda"
                  ? "bg-[#f4f4f1] text-[#696964]"
                  : "bg-transparent text-[#b0b0aa]",
            )}
          >
            {estado.etiqueta}
          </span>
        </div>
      </button>
    </li>
  );
}
