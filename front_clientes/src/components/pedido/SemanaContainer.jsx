import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { unirClases } from "../../compartido/utils/clases.js";
import BotonIcono from "../ui/BotonIcono.jsx";
import IndicadoresCarrusel from "../ui/IndicadoresCarrusel.jsx";
import SemanaPedidoCard from "./SemanaPedidoCard.jsx";

export default function SemanaContainer({
  fechaActual,
  indiceInicial = 0,
  modoActivo = { semanaId: null, modo: "lectura" },
  onActualizarSemana,
  onCambiarModoSemana,
  onDirtyChange,
  onGuardarSugerencia,
  onIndiceActivoChange,
  semanas,
}) {
  const [indiceActivo, setIndiceActivo] = useState(indiceInicial);
  const puedeIrAnterior = indiceActivo > 0;
  const puedeIrSiguiente = indiceActivo < semanas.length - 1;
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "center",
    dragFree: false,
    loop: false,
    startIndex: indiceInicial,
  });

  const actualizarIndice = useCallback(() => {
    if (!emblaApi) return;
    const nuevoIndice = emblaApi.selectedScrollSnap();
    setIndiceActivo(nuevoIndice);
    onIndiceActivoChange?.(nuevoIndice);
  }, [emblaApi, onIndiceActivoChange]);

  const irAnterior = useCallback(() => {
    emblaApi?.scrollPrev();
  }, [emblaApi]);

  const irSiguiente = useCallback(() => {
    emblaApi?.scrollNext();
  }, [emblaApi]);

  const irSemanaActual = useCallback(() => {
    if (!emblaApi) return;
    const indiceSemanaActual = semanas.findIndex((semana) => semana.tipo === "actual");
    emblaApi.scrollTo(indiceSemanaActual >= 0 ? indiceSemanaActual : indiceInicial);
  }, [emblaApi, indiceInicial, semanas]);

  useEffect(() => {
    if (!emblaApi) return undefined;
    const frameInicial = window.requestAnimationFrame(actualizarIndice);
    emblaApi.on("select", actualizarIndice);
    emblaApi.on("reInit", actualizarIndice);

    return () => {
      window.cancelAnimationFrame(frameInicial);
      emblaApi.off("select", actualizarIndice);
      emblaApi.off("reInit", actualizarIndice);
    };
  }, [actualizarIndice, emblaApi]);

  useEffect(() => {
    window.addEventListener("pedido:ir-semana-actual", irSemanaActual);
    return () => {
      window.removeEventListener("pedido:ir-semana-actual", irSemanaActual);
    };
  }, [irSemanaActual]);

  return (
    <section aria-label="Semanas de pedido" className="-mx-4 flex min-h-0 flex-1 flex-col md:-mx-6">
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div ref={emblaRef} className="h-full overflow-hidden">
          <div className="flex h-full touch-pan-y gap-3 md:gap-4">
            {semanas.map((semana, indice) => (
              <div
                key={semana.id}
                className={unirClases(
                  "min-h-0 min-w-0 flex-[0_0_84%] sm:flex-[0_0_82%] md:flex-[0_0_72%] lg:flex-[0_0_62%]",
                  indice === 0 && "ml-[8%] sm:ml-[9%] md:ml-[14%] lg:ml-[19%]",
                  indice === semanas.length - 1 && "mr-[8%] sm:mr-[9%] md:mr-[14%] lg:mr-[19%]",
                )}
              >
                <SemanaPedidoCard
                  fechaActual={fechaActual}
                  modoCard={modoActivo.semanaId === semana.id ? modoActivo.modo : "lectura"}
                  semana={semana}
                  onCambiarModo={(modo, opciones) =>
                    onCambiarModoSemana?.(semana.id, modo, opciones)
                  }
                  onDirtyChange={(hayCambios) => {
                    if (modoActivo.semanaId === semana.id) {
                      onDirtyChange?.(hayCambios);
                    }
                  }}
                  onActualizarSemana={onActualizarSemana}
                  onGuardarSugerencia={onGuardarSugerencia}
                />
              </div>
            ))}
          </div>
        </div>

        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 bottom-0 left-0 z-20 w-12 bg-gradient-to-r from-[#fbfaf7] via-[#fbfaf7]/75 to-transparent md:w-16"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute top-0 right-0 bottom-0 z-20 w-12 bg-gradient-to-l from-[#fbfaf7] via-[#fbfaf7]/75 to-transparent md:w-16"
        />

        <BotonIcono
          aria-label="Ver semana anterior"
          className="absolute top-1/2 left-2 z-30 -translate-y-1/2"
          disabled={!puedeIrAnterior}
          onClick={irAnterior}
        >
          <ChevronLeft className="size-5" aria-hidden="true" />
        </BotonIcono>
        <BotonIcono
          aria-label="Ver semana siguiente"
          className="absolute top-1/2 right-2 z-30 -translate-y-1/2"
          disabled={!puedeIrSiguiente}
          onClick={irSiguiente}
        >
          <ChevronRight className="size-5" aria-hidden="true" />
        </BotonIcono>
      </div>

      <IndicadoresCarrusel
        cantidad={semanas.length}
        etiquetas={semanas.map((semana) => semana.etiqueta)}
        indiceActivo={indiceActivo}
        onSeleccionar={(indice) => emblaApi?.scrollTo(indice)}
      />
    </section>
  );
}
