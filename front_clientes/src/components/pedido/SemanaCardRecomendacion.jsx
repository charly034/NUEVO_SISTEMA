import { CheckCircle2, Plus, Send, X } from "lucide-react";
import { useMemo, useState } from "react";
import { unirClases } from "../../compartido/utils/clases.js";
import Boton from "../ui/Boton.jsx";
import SemanaHeader from "./SemanaHeader.jsx";

const ideasRapidas = [
  "Pastel de papa",
  "Ravioles con fileto",
  "Pollo al horno con calabaza",
  "Tarta de verduras",
  "Milanesa con puré",
  "Wok de vegetales",
];

export default function SemanaCardRecomendacion({
  guardando = false,
  onCancelar,
  onGuardar,
  semana,
}) {
  const yaEnviada =
    (semana.recomendacionesUsuario || []).length > 0 ||
    Boolean(semana.comentarioRecomendacion);
  const [idea, setIdea] = useState("");
  const [comentario, setComentario] = useState("");
  const [seleccionadas, setSeleccionadas] = useState(
    semana.recomendacionesUsuario || [],
  );

  const opciones = useMemo(
    () => [
      ...(semana.sugerencias || []).map((sugerencia) => sugerencia.plato),
      ...ideasRapidas,
    ].filter((opcion, indice, lista) => lista.indexOf(opcion) === indice),
    [semana.sugerencias],
  );

  const puedeEnviar = seleccionadas.length > 0 || comentario.trim().length > 0;

  function agregarIdea(nuevaIdea) {
    const valor = nuevaIdea.trim();
    if (!valor || seleccionadas.includes(valor)) return;
    setSeleccionadas((actuales) => [...actuales, valor]);
  }

  function quitarIdea(valor) {
    setSeleccionadas((actuales) =>
      actuales.filter((item) => item !== valor),
    );
  }

  function enviarSugerencias() {
    if (!puedeEnviar || yaEnviada || guardando) return;

    onGuardar?.({
      ...semana,
      recomendacionesUsuario: seleccionadas,
      comentarioRecomendacion: comentario.trim(),
      feedback: "Gracias por tu sugerencia",
    });
  }

  if (yaEnviada) {
    return (
      <>
        <SemanaHeader semana={semana} />
        <section className="flex min-h-0 flex-1 flex-col items-center justify-center rounded-3xl border border-[#d8e6d4] bg-[#f0f7ee] px-5 py-4 text-center text-[#2d5a27]">
          <CheckCircle2 className="h-9 w-9" aria-hidden="true" />
          <h3 className="mt-3 text-xl font-black leading-tight">
            Gracias por tu sugerencia
          </h3>
          <p className="mt-1 text-sm font-bold leading-snug text-[#4f7448]">
            Ya la registramos para esta semana.
          </p>
        </section>
        <Boton variante="secundario" onClick={onCancelar}>
          Volver
        </Boton>
      </>
    );
  }

  return (
    <>
      <SemanaHeader semana={semana} />

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-3xl border border-[#d8e6d4] bg-[#f0f7ee] p-3 text-[#1a1a1a]">
        <div className="flex flex-wrap gap-2">
          {opciones.slice(0, 8).map((opcion) => {
            const seleccionada = seleccionadas.includes(opcion);

            return (
              <button
                key={opcion}
                type="button"
                onClick={() =>
                  seleccionada ? quitarIdea(opcion) : agregarIdea(opcion)
                }
                className={unirClases(
                  "rounded-full border px-3 py-1.5 text-[0.86rem] font-black leading-tight transition",
                  seleccionada
                    ? "border-[#2d5a27] bg-[#2d5a27] text-white"
                    : "border-[#cfe2c8] bg-white text-[#2d5a27]",
                )}
              >
                {opcion}
              </button>
            );
          })}
        </div>

        <div className="mt-2 grid grid-cols-[1fr_auto] gap-2">
          <input
            value={idea}
            onChange={(event) => setIdea(event.target.value)}
            placeholder="Otra idea"
            className="min-w-0 rounded-2xl border border-[#cfe2c8] bg-white px-3 py-2 text-sm font-bold text-[#1a1a1a] outline-none focus:border-[#2d5a27] focus:ring-2 focus:ring-[#d8e9d2]"
          />
          <button
            type="button"
            aria-label="Agregar idea"
            onClick={() => {
              agregarIdea(idea);
              setIdea("");
            }}
            className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#2d5a27] text-white disabled:opacity-45"
            disabled={!idea.trim()}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {seleccionadas.length > 0 && (
          <ul className="mt-2 flex max-h-16 shrink-0 flex-wrap gap-1.5 overflow-hidden">
            {seleccionadas.map((item) => (
              <li key={item}>
                <button
                  type="button"
                  onClick={() => quitarIdea(item)}
                  className="inline-flex max-w-full items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-black text-[#4c4a45]"
                >
                  <span className="truncate">{item}</span>
                  <X className="h-3 w-3 shrink-0" aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <textarea
          value={comentario}
          onChange={(event) => setComentario(event.target.value)}
          placeholder="Comentario opcional"
          className="mt-2 min-h-0 flex-1 resize-none rounded-2xl border border-[#cfe2c8] bg-white px-3 py-2 text-sm font-bold text-[#1a1a1a] outline-none focus:border-[#2d5a27] focus:ring-2 focus:ring-[#d8e9d2]"
        />
      </section>

      <div className="mt-auto grid shrink-0 grid-cols-[0.8fr_1.2fr] gap-2 pt-1 max-[700px]:pt-0">
        <Boton variante="secundario" onClick={onCancelar} disabled={guardando}>
          Cancelar
        </Boton>
        <Boton onClick={enviarSugerencias} disabled={!puedeEnviar || guardando}>
          <span className="inline-flex items-center gap-2">
            <Send className="h-4 w-4" aria-hidden="true" />
            {guardando ? "Enviando..." : "Enviar"}
          </span>
        </Boton>
      </div>
    </>
  );
}
