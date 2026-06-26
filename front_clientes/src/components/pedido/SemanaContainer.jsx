import useEmblaCarousel from "embla-carousel-react";
import { useCallback, useEffect, useState } from "react";
import { unirClases } from "../../compartido/utils/clases.js";
import SemanaPedidoCard from "./SemanaPedidoCard.jsx";

export default function SemanaContainer({ semanas }) {
  const [indiceActivo, setIndiceActivo] = useState(1);
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "center",
    containScroll: "trimSnaps",
    dragFree: false,
    loop: false,
    startIndex: 1,
  });

  const actualizarIndice = useCallback(() => {
    if (!emblaApi) return;
    setIndiceActivo(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return undefined;
    emblaApi.on("select", actualizarIndice);
    emblaApi.on("reInit", actualizarIndice);

    return () => {
      emblaApi.off("select", actualizarIndice);
      emblaApi.off("reInit", actualizarIndice);
    };
  }, [actualizarIndice, emblaApi]);

  return (
    <section aria-label="Semanas de pedido" className="-mx-4">
      <div ref={emblaRef} className="overflow-hidden px-4">
        <div className="flex touch-pan-y gap-3">
          {semanas.map((semana) => (
            <div
              key={semana.id}
              className="min-w-0 flex-[0_0_91%] sm:flex-[0_0_88%]"
            >
              <SemanaPedidoCard semana={semana} />
            </div>
          ))}
        </div>
      </div>

      <div className="mt-5 flex justify-center gap-2" aria-label="Indicadores de semana">
        {semanas.map((semana, indice) => (
          <button
            key={semana.id}
            type="button"
            aria-label={`Ver ${semana.etiqueta}`}
            aria-current={indiceActivo === indice ? "true" : undefined}
            onClick={() => emblaApi?.scrollTo(indice)}
            className={unirClases(
              "h-2.5 rounded-full transition-all focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2d5a27]",
              indiceActivo === indice
                ? "w-7 bg-[#2d5a27]"
                : "w-2.5 bg-[#d8d2c8]",
            )}
          />
        ))}
      </div>
    </section>
  );
}
