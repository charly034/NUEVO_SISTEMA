import { useMemo, useState } from "react";
import { AlertCircle, CheckCircle2, Lightbulb } from "lucide-react";
import BottomSheet from "../ui/BottomSheet.jsx";
import BtnPrimary from "../ui/BtnPrimary.jsx";

export default function SuggestionSheet({ abierto, onCerrar, onGuardar, semana }) {
  const [seleccionadas, setSeleccionadas] = useState([]);
  const [comentario, setComentario] = useState("");
  const [enviado, setEnviado] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");

  const toggle = (sugerencia) => {
    setSeleccionadas((previas) =>
      previas.includes(sugerencia)
        ? previas.filter((item) => item !== sugerencia)
        : [...previas, sugerencia],
    );
  };

  const opcionesSugeridas = useMemo(() => {
    const opciones = Array.isArray(semana?.opcionesSugerencia) && semana.opcionesSugerencia.length > 0
      ? semana.opcionesSugerencia.map((opcion) => opcion.nombre || opcion.plato_nombre)
      : (semana?.sugerencias || []).map((sugerencia) => sugerencia.plato);
    return [...new Set(opciones.map((opcion) => String(opcion || "").trim()).filter(Boolean))];
  }, [semana]);

  const guardar = async () => {
    setGuardando(true);
    setError("");
    try {
      await onGuardar?.({
        ...semana,
        recomendacionesUsuario: seleccionadas,
        comentarioRecomendacion: comentario,
      });
      setEnviado(true);
    } catch (err) {
      setError(err?.message || "No pudimos enviar la sugerencia.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <BottomSheet
      abierto={abierto}
      onCerrar={onCerrar}
      titulo="Sugerir platos"
      subtitulo={semana?.rango ? `Semana ${semana.rango}` : "Semana sin menu publicado"}
    >
      {enviado ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-5 px-8 pb-10 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#EDF0E4]">
            <CheckCircle2 size={32} className="text-[#5B6B2A]" />
          </div>
          <div>
            <p className="mb-2 font-serif text-xl font-bold text-[#2A2C1F]">Gracias</p>
            <p className="text-sm leading-relaxed text-[#7A7868]">
              Tu sugerencia fue enviada. La tendremos en cuenta para preparar el menu.
            </p>
          </div>
          <BtnPrimary onClick={onCerrar} variant="secondary" className="mt-2">
            Volver
          </BtnPrimary>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="space-y-5 pb-6">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <Lightbulb size={16} className="text-[#C8782A]" />
                <p className="text-sm font-bold text-[#2A2C1F]">Que te gustaria comer?</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {opcionesSugeridas.length === 0 && (
                  <p className="rounded-xl border border-[#E8E2D4] bg-[#FAF8F3] px-4 py-3 text-sm text-[#7A7868]">
                    Todavia no hay platos sugeridos para esta semana. Podes dejarnos un comentario.
                  </p>
                )}
                {opcionesSugeridas.map((sugerencia) => {
                  const activa = seleccionadas.includes(sugerencia);
                  return (
                    <button
                      key={sugerencia}
                      type="button"
                      onClick={() => toggle(sugerencia)}
                      className={[
                        "rounded-xl border px-3.5 py-2 text-sm font-semibold transition-colors",
                        activa
                          ? "border-[#5B6B2A] bg-[#5B6B2A] text-white"
                          : "border-[#D8D5C8] bg-white text-[#5B6B2A]",
                      ].join(" ")}
                    >
                      {sugerencia}
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <p className="mb-2 text-sm font-bold text-[#2A2C1F]">Comentario adicional</p>
              <textarea
                value={comentario}
                onChange={(event) => setComentario(event.target.value)}
                placeholder="Ej: algo mas liviano, sin carne roja, con opciones veganas..."
                rows={4}
                className="w-full resize-none rounded-xl border border-[#D8D5C8] bg-white px-4 py-3 text-sm text-[#2A2C1F] focus:border-[#5B6B2A] focus:outline-none focus:ring-2 focus:ring-[#5B6B2A]/12"
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3">
                <AlertCircle size={15} className="mt-0.5 shrink-0 text-red-500" />
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <BtnPrimary
              onClick={guardar}
              loading={guardando}
              disabled={seleccionadas.length === 0 && !comentario.trim()}
              className="w-full"
            >
              Enviar sugerencia
            </BtnPrimary>
          </div>
        </div>
      )}
    </BottomSheet>
  );
}
