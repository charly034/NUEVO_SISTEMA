import { useEffect, useRef } from "react";
import { useSeleccionDia } from "../../hooks/useSeleccionDia.js";
import { platoRequiereGuarnicion } from "../../utils/reglasSeleccionPedido.js";
import BottomSheet from "../ui/BottomSheet.jsx";
import Boton from "../ui/Boton.jsx";
import Buscador from "../ui/Buscador.jsx";
import ChipSeleccionable from "../ui/ChipSeleccionable.jsx";
import ListaOpcionesPlato from "./ListaOpcionesPlato.jsx";
import OpcionPlatoCard from "./OpcionPlatoCard.jsx";
import ResumenSeleccionDia from "./ResumenSeleccionDia.jsx";
import SelectorGuarnicion from "./SelectorGuarnicion.jsx";

export default function BottomSheetSeleccionDia({
  abierto,
  cerrarAlConfirmar = true,
  dia,
  dias = [],
  onCerrar,
  onConfirmar,
  semanaId,
}) {
  const guarnicionRef = useRef(null);
  const scrollRef = useRef(null);
  const indiceDiaActivo = dias.findIndex((item) => item.clave === dia?.clave);
  const totalDias = dias.length || 1;
  const numeroDiaActivo = indiceDiaActivo >= 0 ? indiceDiaActivo + 1 : 1;
  const {
    busqueda,
    cambiarBusqueda,
    cambiarFiltro,
    cargandoOpciones,
    errorOpciones,
    filtrosPlatos,
    filtroActivo,
    mensajeMenu,
    mensajeValidacion,
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

  useEffect(() => {
    window.requestAnimationFrame(() => {
      if (scrollRef.current) scrollRef.current.scrollTop = 0;
    });
  }, [dia]);

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
      titulo={`Elegí tu plato del ${dia?.dia?.toLowerCase() || "día"}`}
      subtitulo={`${opcionesDia.length || 0} opciones disponibles`}
      onCerrar={onCerrar}
    >
      <div ref={scrollRef} className="min-h-0 flex-1 scroll-smooth overflow-y-auto px-4 py-2">
        <section
          aria-live="polite"
          className="mb-3 rounded-3xl border border-[#cde5c8] bg-[#f0f7ee] p-3 text-[#2d5a27]"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[0.72rem] font-black uppercase tracking-wide text-[#5f7f55]">
                Día {numeroDiaActivo} de {totalDias}
              </p>
              <p className="mt-1 text-xl font-black leading-none">
                {dia?.dia || "Día"}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-black text-[#2d5a27] ring-1 ring-[#d8e6d4]">
              {seleccion?.plato ? "Elegido" : `${opcionesDia.length || 0} opciones`}
            </span>
          </div>
          <div className="mt-3 flex gap-1.5" aria-hidden="true">
            {dias.map((item) => {
              const activo = item.clave === dia?.clave;
              const elegido = item.seleccion?.plato || (item.plato && item.plato !== "Sin seleccionar");

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
      </div>

      <footer className="shrink-0 border-t border-[#eee8df] bg-[#faf8f4] px-4 py-3">
        <ResumenSeleccionDia seleccion={seleccion} />
        {mensajeValidacion && (
          <p className="mt-2 text-[0.8rem] font-extrabold text-[#8a4b12]">
            {mensajeValidacion}
          </p>
        )}
        <div className="mt-3">
          <Boton variante="secundario" onClick={onCerrar}>
            Cancelar
          </Boton>
        </div>
      </footer>
    </BottomSheet>
  );
}
