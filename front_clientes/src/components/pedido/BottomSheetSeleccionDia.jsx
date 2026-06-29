import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSeleccionDia } from "../../hooks/useSeleccionDia.js";
import { formatearFechaPedido } from "../../utils/fechasPedido.js";
import { iniciarMedicionPerformance } from "../../utils/performance.js";
import { platoRequiereGuarnicion } from "../../utils/reglasSeleccionPedido.js";
import BottomSheet from "../ui/BottomSheet.jsx";
import Boton from "../ui/Boton.jsx";
import Buscador from "../ui/Buscador.jsx";
import ChipSeleccionable from "../ui/ChipSeleccionable.jsx";
import ListaOpcionesPlato from "./ListaOpcionesPlato.jsx";
import OpcionPlatoCard from "./OpcionPlatoCard.jsx";
import ResumenSeleccionDia from "./ResumenSeleccionDia.jsx";
import SelectorGuarnicion from "./SelectorGuarnicion.jsx";

function formatearFechaDia(fecha) {
  if (!fecha) return "";
  const [anio, mes, dia] = String(fecha).split("T")[0].split("-").map(Number);
  if (!anio || !mes || !dia) return "";
  return formatearFechaPedido(new Date(anio, mes - 1, dia));
}

export default function BottomSheetSeleccionDia({
  abierto,
  cerrarAlConfirmar = true,
  dia,
  dias = [],
  onCerrar,
  onConfirmar,
  onDiaAnterior,
  onDiaSiguiente,
  semanaId,
}) {
  const guarnicionRef = useRef(null);
  const scrollRef = useRef(null);
  const [hayMasOpcionesAbajo, setHayMasOpcionesAbajo] = useState(false);
  const indiceDiaActivo = dias.findIndex((item) => item.clave === dia?.clave);
  const totalDias = dias.length || 1;
  const numeroDiaActivo = indiceDiaActivo >= 0 ? indiceDiaActivo + 1 : 1;
  const diaAnteriorDisponible = indiceDiaActivo > 0;
  const diaSiguienteDisponible = indiceDiaActivo >= 0 && indiceDiaActivo < dias.length - 1;
  const fechaDia = formatearFechaDia(dia?.fecha);
  const {
    busqueda,
    cambiarBusqueda,
    cambiarFiltro,
    cargandoOpciones,
    errorOpciones,
    filtrosPlatos,
    filtroActivo,
    mensajeMenu,
    opcionNoPedir,
    opcionesDia,
    opcionesFiltradas,
    reintentarCargaOpciones,
    seleccion,
    seleccionarGuarnicion,
    seleccionarPlato,
  } = useSeleccionDia({
    cerrarAlConfirmar,
    dia,
    onCerrar,
    onConfirmar,
    semanaId,
  });

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
      titulo={`Elegi tu plato del ${dia?.dia?.toLowerCase() || "dia"}`}
      subtitulo={`${opcionesDia.length || 0} opciones disponibles. Guardas el pedido al final.`}
      onCerrar={onCerrar}
    >
      <div
        ref={scrollRef}
        className="min-h-0 flex-1 scroll-smooth overflow-y-auto px-4 py-2"
        onScroll={actualizarIndicadorScroll}
      >
        <section
          aria-live="polite"
          className="mb-3 rounded-3xl border border-[#cde5c8] bg-[#f0f7ee] p-3 text-[#2d5a27]"
        >
          <div className="flex items-start justify-between gap-3">
            <button
              type="button"
              disabled={!diaAnteriorDisponible}
              onClick={() => onDiaAnterior?.(dia)}
              className="mt-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#2d5a27] ring-1 ring-[#d8e6d4] disabled:cursor-not-allowed disabled:opacity-35"
              aria-label="Volver al dia anterior"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <div className="min-w-0 flex-1 text-center">
              <p className="text-[0.72rem] font-black uppercase tracking-wide text-[#5f7f55]">
                Dia {numeroDiaActivo} de {totalDias}
              </p>
              <p className="mt-1 text-[1.7rem] font-black leading-none">
                {dia?.dia || "Dia"}
              </p>
              {fechaDia && (
                <p className="mt-1 text-sm font-black uppercase tracking-wide text-[#4f7448]">
                  {fechaDia}
                </p>
              )}
            </div>
            <button
              type="button"
              disabled={!diaSiguienteDisponible}
              onClick={() => onDiaSiguiente?.(dia)}
              className="mt-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#2d5a27] ring-1 ring-[#d8e6d4] disabled:cursor-not-allowed disabled:opacity-35"
              aria-label="Ir al dia siguiente"
            >
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </div>
          <div className="mt-3 flex justify-center">
            <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-[#2d5a27] ring-1 ring-[#d8e6d4]">
              {seleccion?.plato ? "Elegido" : `${opcionesDia.length || 0} opciones`}
            </span>
          </div>
          <div className="mt-3 flex gap-1.5" aria-hidden="true">
            {dias.map((item) => {
              const activo = item.clave === dia?.clave;
              const elegido = item.seleccion?.plato ||
                (item.plato && item.plato !== "Sin seleccionar");

              return (
                <span
                  key={item.clave}
                  className={[
                    "h-2 flex-1 rounded-full",
                    activo
                      ? "bg-[#2d5a27]"
                      : elegido
                        ? "bg-[#9cc58f]"
                        : "bg-white",
                  ].join(" ")}
                />
              );
            })}
          </div>
        </section>
        <Buscador
          value={busqueda}
          onChange={cambiarBusqueda}
          placeholder="Buscar plato"
        />
        {mensajeMenu && (
          <p className="mt-3 rounded-2xl border border-[#edd9b8] bg-[#fff7eb] px-3 py-2 text-sm font-bold text-[#8a5a18]">
            {mensajeMenu}
          </p>
        )}
        <div className="-mx-4 mt-3 overflow-x-auto px-4 pb-1">
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
        <div className="mt-2">
          <OpcionPlatoCard
            plato={opcionNoPedir}
            seleccionado={seleccion?.plato?.id === opcionNoPedir.id}
            onSeleccionar={seleccionarPlato}
          />
        </div>
        {cargandoOpciones && (
          <p className="mt-3 rounded-2xl bg-[#f0f7ee] px-3 py-2 text-sm font-black text-[#2d5a27]">
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
        <div className="mt-3">
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
        {hayMasOpcionesAbajo && (
          <div className="sticky bottom-0 z-10 -mx-4 mt-2 bg-gradient-to-t from-[#faf8f4] via-[#faf8f4] to-transparent px-4 pb-2 pt-7">
            <div className="mx-auto flex w-fit items-center gap-1.5 rounded-full border border-[#d8e6d4] bg-white px-3 py-1.5 text-xs font-black text-[#2d5a27] shadow-[0_8px_20px_rgba(45,90,39,0.12)]">
              <span>Desliza para ver mas opciones</span>
              <ChevronDown className="h-4 w-4" aria-hidden="true" />
            </div>
          </div>
        )}
      </div>

      <footer className="shrink-0 border-t border-[#eee8df] bg-[#faf8f4] px-4 py-3">
        <ResumenSeleccionDia seleccion={seleccion} />
        <p className="mt-1 text-xs font-bold leading-snug text-[#716c64]">
          Esta eleccion queda en la semana. Confirmala con el boton de guardar.
        </p>
        <div className="mt-3">
          <Boton variante="secundario" onClick={onCerrar}>
            Cancelar
          </Boton>
        </div>
      </footer>
    </BottomSheet>
  );
}
