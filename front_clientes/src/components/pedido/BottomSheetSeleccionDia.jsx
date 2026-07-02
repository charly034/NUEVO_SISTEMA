import { ChevronDown } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSeleccionDia } from "../../hooks/useSeleccionDia.js";
import { iniciarMedicionPerformance } from "../../utils/performance.js";
import { platoRequiereGuarnicion } from "../../utils/reglasSeleccionPedido.js";
import BottomSheet from "../ui/BottomSheet.jsx";
import Boton from "../ui/Boton.jsx";
import Buscador from "../ui/Buscador.jsx";
import ChipSeleccionable from "../ui/ChipSeleccionable.jsx";
import ListaOpcionesPlato from "./ListaOpcionesPlato.jsx";
import OpcionPlatoCard from "./OpcionPlatoCard.jsx";
import SelectorGuarnicion from "./SelectorGuarnicion.jsx";
import { formatearFechaDia } from "./semanaPedidoVisualUtils.js";

export default function BottomSheetSeleccionDia({
  abierto,
  cerrarAlConfirmar = true,
  dia,
  onCerrar,
  onConfirmar,
  semanaId,
}) {
  const guarnicionRef = useRef(null);
  const scrollRef = useRef(null);
  const [hayMasOpcionesAbajo, setHayMasOpcionesAbajo] = useState(false);
  const {
    busqueda,
    cambiarBusqueda,
    cambiarFiltro,
    cargandoOpciones,
    confirmarSeleccionDia,
    errorOpciones,
    filtrosPlatos,
    filtroActivo,
    mensajeMenu,
    opcionNoPedir,
    opcionesDia,
    opcionesFiltradas,
    reintentarCargaOpciones,
    requiereGuarnicion,
    seleccion,
    seleccionValida,
    seleccionarGuarnicion,
    seleccionarPlato,
  } = useSeleccionDia({
    cerrarAlConfirmar,
    dia,
    onCerrar,
    onConfirmar,
    semanaId,
  });

  const fechaDia = formatearFechaDia(dia?.fecha);

  const actualizarIndicadorScroll = useCallback(() => {
    const contenedor = scrollRef.current;
    if (!contenedor) return;

    const distanciaAlFinal =
      contenedor.scrollHeight - contenedor.scrollTop - contenedor.clientHeight;
    setHayMasOpcionesAbajo(distanciaAlFinal > 24);
  }, []);

  useEffect(() => {
    if (!abierto) return undefined;
    const finalizar = iniciarMedicionPerformance("bottom-sheet:apertura", {
      dia: dia?.clave || dia?.dia || "sin_dia",
    });
    const frame = requestAnimationFrame(() => finalizar({ estado: "abierto" }));
    return () => cancelAnimationFrame(frame);
  }, [abierto, dia]);

  useEffect(() => {
    window.requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = 0;
        actualizarIndicadorScroll();
      }
    });
  }, [actualizarIndicadorScroll, dia]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(actualizarIndicadorScroll);
    window.addEventListener("resize", actualizarIndicadorScroll);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", actualizarIndicadorScroll);
    };
  }, [actualizarIndicadorScroll, opcionesFiltradas.length, seleccion?.plato]);

  useEffect(() => {
    if (!seleccion?.plato || !platoRequiereGuarnicion(seleccion.plato)) return;

    window.requestAnimationFrame(() => {
      guarnicionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
      });
      guarnicionRef.current?.focus({ preventScroll: true });
    });
  }, [seleccion?.plato]);

  return (
    <BottomSheet
      abierto={abierto}
      encabezadoCompacto
      titulo={`Elegir plato del ${dia?.dia || "dia"}`}
      subtitulo={`${opcionesDia.length || 0} opciones disponibles`}
      onCerrar={onCerrar}
    >
      <div className="relative min-h-0 flex-1 bg-[#fbfbf7]">
        <div
          ref={scrollRef}
          className="h-full scroll-smooth overflow-y-auto overscroll-contain px-6 pb-7"
          onScroll={actualizarIndicadorScroll}
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          <div className="sticky top-0 z-20 -mx-6 bg-[#fbfbf7]/98 px-6 pb-4 shadow-[0_14px_18px_rgba(251,251,247,0.96)] backdrop-blur">
            <p className="text-[0.95rem] font-semibold text-[#6d6a63]">Elegir plato</p>
            <h2 className="mt-1 text-[1.55rem] font-extrabold leading-tight text-[#272723]">
              {dia?.dia || "Dia"}
              {fechaDia && (
                <span className="ml-2 font-semibold text-[#8f8d86]">{fechaDia}</span>
              )}
            </h2>
            <p className="mt-5 rounded-2xl bg-[#eef3e9] px-4 py-3 text-[0.98rem] font-semibold leading-snug text-[#3f4530]">
              Elegir un plato no confirma el pedido. Usa el boton "Confirmar pedido" al finalizar.
            </p>
            <div className="mt-4">
              <OpcionPlatoCard
                plato={opcionNoPedir}
                seleccionado={seleccion?.plato?.id === opcionNoPedir.id}
                onSeleccionar={seleccionarPlato}
              />
            </div>
            <div className="mt-3">
              <Buscador
                value={busqueda}
                onChange={cambiarBusqueda}
                placeholder="Buscar platos..."
              />
            </div>
            <div className="-mx-6 mt-3 overflow-x-auto px-6 pb-1 scrollbar-none">
              <div className="flex min-w-max gap-2">
                {filtrosPlatos.map((filtro) => (
                  <ChipSeleccionable
                    key={filtro.id}
                    seleccionado={filtroActivo === filtro.id}
                    onClick={() => cambiarFiltro(filtro.id)}
                  >
                    {filtro.label}
                  </ChipSeleccionable>
                ))}
              </div>
            </div>
          </div>

          <div className="pt-3">
            {mensajeMenu && (
              <p className="mb-3 rounded-2xl border border-[#edd9b8] bg-[#fff7eb] px-3 py-2 text-sm font-bold text-[#8a5a18]">
                {mensajeMenu}
              </p>
            )}
            {cargandoOpciones && (
              <p className="mt-3 rounded-2xl bg-[#eef3e9] px-3 py-2 text-sm font-extrabold text-[#586b24]">
                Cargando opciones...
              </p>
            )}
            {errorOpciones && (
              <div className="mt-3 rounded-2xl bg-[#fff0ed] px-3 py-2 text-sm font-bold text-[#8a3d30]">
                <p>{errorOpciones}</p>
                <button
                  type="button"
                  className="mt-1 font-black underline underline-offset-2"
                  onClick={reintentarCargaOpciones}
                >
                  Reintentar
                </button>
              </div>
            )}
            <ListaOpcionesPlato
              opciones={opcionesFiltradas}
              platoSeleccionado={seleccion?.plato}
              onSeleccionar={seleccionarPlato}
              renderSeleccion={(plato) =>
                platoRequiereGuarnicion(plato) ? (
                  <SelectorGuarnicion
                    ref={guarnicionRef}
                    guarnicion={seleccion.guarnicion}
                    guarniciones={plato.guarniciones}
                    onSeleccionar={seleccionarGuarnicion}
                  />
                ) : null
              }
            />
          </div>
        </div>

        {hayMasOpcionesAbajo && (
          <div className="pointer-events-none absolute inset-x-0 bottom-2 z-10 flex justify-center">
            <div className="flex items-center gap-1.5 rounded-full border border-[#d8e6d4] bg-white/95 px-3 py-1.5 text-xs font-black text-[#586b24] shadow-[0_8px_20px_rgba(45,90,39,0.14)] backdrop-blur">
              <span>Mas opciones</span>
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            </div>
          </div>
        )}
      </div>

      <footer className="shrink-0 border-t border-[#ecebe5] bg-white/95 px-6 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 shadow-[0_-12px_24px_rgba(26,26,26,0.06)]">
        <Boton
          anchoCompleto
          disabled={!seleccionValida}
          onClick={confirmarSeleccionDia}
        >
          {requiereGuarnicion && !seleccion?.guarnicion
            ? "Falta elegir guarnicion"
            : `Confirmar seleccion del ${dia?.dia || "dia"}`}
        </Boton>
      </footer>
    </BottomSheet>
  );
}
