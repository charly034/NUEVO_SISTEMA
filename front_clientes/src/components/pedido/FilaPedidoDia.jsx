import { CheckCircle2, CircleDashed } from "lucide-react";
import { unirClases } from "../../compartido/utils/clases.js";

const textosSinSeleccion = ["Sin seleccionar", "Sin pedido", "Sin pedido para este día"];
const letrasOpciones = ["A", "B"];

function esSinSeleccion(plato) {
  return !plato || textosSinSeleccion.includes(plato);
}

function obtenerMenusPublicados(opciones = []) {
  return opciones.filter((opcion) => opcion.destacado).slice(0, 2);
}

export default function FilaPedidoDia({
  dia,
  modoConfirmado = false,
  modoMenuPublicado = false,
  opciones = [],
  plato,
}) {
  const sinSeleccion = esSinSeleccion(plato);
  const menusPublicados = obtenerMenusPublicados(opciones);

  if (modoMenuPublicado && sinSeleccion) {
    return (
      <li className="flex min-h-0 flex-1 border-b border-[#f0ebe2] py-0.5 last:border-b-0">
        <div className="grid min-h-0 w-full grid-cols-[4.65rem_1fr] items-center gap-2 rounded-2xl px-1.5 py-1">
          <span className="text-[0.98rem] font-black leading-none text-[#2d5a27]">
            {dia}
          </span>

          <div className="min-w-0 space-y-1 text-right">
            {menusPublicados.length > 0 ? (
              menusPublicados.map((opcion, indice) => (
                <div
                  key={opcion.id}
                  className="flex min-w-0 items-baseline justify-end gap-1.5"
                >
                  <span className="shrink-0 rounded-full bg-[#f0f7ee] px-1.5 py-0.5 text-[0.72rem] font-black leading-none text-[#2d5a27] ring-1 ring-[#d8e6d4]">
                    {letrasOpciones[indice] || indice + 1}:
                  </span>
                  <span className="line-clamp-1 min-w-0 text-[1rem] font-black leading-tight text-[#1a1a1a]">
                    {opcion.nombre}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-[1rem] font-black leading-tight text-[#1a1a1a]">
                Menú a confirmar
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

          {sinSeleccion && menusPublicados.length > 0 && (
            <div className="mt-0.5 space-y-0.5">
              {menusPublicados.map((opcion) => (
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
