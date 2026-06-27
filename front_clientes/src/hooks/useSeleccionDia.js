import { useEffect, useMemo, useState } from "react";
import { SIN_PEDIDO_ID } from "../constants/estadosPedido.js";
import { useOpcionesMenu } from "./useOpcionesMenu.js";
import {
  construirTextoPlatoSeleccionado,
  crearOpcionSinPedido,
  crearSeleccionPedido,
  crearSeleccionDesdeTexto,
  platoRequiereGuarnicion,
  seleccionDiaEsValida,
} from "../utils/reglasSeleccionPedido.js";
import { medirBloquePerformance } from "../utils/performance.js";

const filtrosIniciales = [
  { id: "todos", label: "Todos" },
  { id: "especiales", label: "Especiales" },
  { id: "pollo", label: "Pollo" },
  { id: "carne", label: "Carne" },
  { id: "vegetariano", label: "Vegetariano" },
  { id: "completos", label: "Completos" },
  { id: "guarnicion", label: "Con guarnicion" },
];

function obtenerSeleccionInicial(dia, opciones = []) {
  if (dia?.seleccion) return dia.seleccion;
  if (dia?.estado === "sin_pedido_por_defecto") {
    return crearSeleccionPedido(crearOpcionSinPedido({ porDefecto: true }), "", {
      origenSinPedido: "default",
    });
  }
  return crearSeleccionDesdeTexto(dia?.plato, opciones) || null;
}

function coincideFiltro(plato, filtroActivo) {
  if (filtroActivo === "todos") return true;
  if (filtroActivo === "especiales") return Boolean(plato.destacado) || plato.grupo === "especiales";
  if (filtroActivo === "completos") return plato.tipo === "plato_completo";
  if (filtroActivo === "guarnicion") return platoRequiereGuarnicion(plato);
  return plato.categoria === filtroActivo;
}

export function useSeleccionDia({
  cerrarAlConfirmar = true,
  dia,
  empresaId,
  onCerrar,
  onConfirmar,
  semanaId,
}) {
  const [busqueda, setBusqueda] = useState("");
  const [filtroActivo, setFiltroActivo] = useState("todos");
  const [opcionesDia, setOpcionesDia] = useState(dia?.opciones || []);
  const [seleccion, setSeleccion] = useState(() => obtenerSeleccionInicial(dia, opcionesDia));
  const {
    cargandoOpciones,
    errorOpciones,
    obtenerOpcionesDia,
    recargarOpcionesDia,
  } = useOpcionesMenu({ empresaId, semanaId });

  useEffect(() => {
    let activo = true;
    queueMicrotask(() => {
      if (!activo) return;
      setBusqueda("");
      setFiltroActivo("todos");
      setOpcionesDia(dia?.opciones || []);
      setSeleccion(obtenerSeleccionInicial(dia, dia?.opciones || []));
    });

    obtenerOpcionesDia(dia).then((opciones) => {
      if (!activo || opciones.length === 0) return;
      setOpcionesDia(opciones);
      setSeleccion((seleccionActual) =>
        seleccionActual || obtenerSeleccionInicial(dia, opciones),
      );
    });

    return () => {
      activo = false;
    };
  }, [dia, obtenerOpcionesDia]);

  const opcionesFiltradas = useMemo(() => {
    return medirBloquePerformance("busqueda:filtrado-platos", () => {
      const termino = busqueda.trim().toLowerCase();
      return opcionesDia
        .filter((plato) => plato.id !== SIN_PEDIDO_ID)
        .filter((plato) => coincideFiltro(plato, filtroActivo))
        .filter((plato) => {
          if (!termino) return true;
          return `${plato.nombre} ${plato.descripcion} ${plato.etiquetas?.join(" ")}`
            .toLowerCase()
            .includes(termino);
        });
    }, {
      cantidadOpciones: opcionesDia.length,
      filtroActivo,
      tieneBusqueda: Boolean(busqueda.trim()),
    });
  }, [busqueda, filtroActivo, opcionesDia]);

  const especialesDia = useMemo(
    () => opcionesDia.filter((plato) => plato.grupo === "especiales" || plato.destacado),
    [opcionesDia],
  );
  const fijosDia = useMemo(
    () => opcionesDia.filter((plato) => plato.grupo === "fijos" && !plato.destacado),
    [opcionesDia],
  );
  const mensajeMenu = dia?.mensajeMenu ||
    (especialesDia.length === 0 && fijosDia.length > 0
      ? "Todavia no hay menu especial para este dia. Podes elegir un plato fijo."
      : "");

  const opcionNoPedir = useMemo(
    () => opcionesDia.find((plato) => plato.id === SIN_PEDIDO_ID) ||
      crearOpcionSinPedido({ porDefecto: dia?.estado === "sin_pedido_por_defecto" }),
    [dia?.estado, opcionesDia],
  );

  const requiereGuarnicion = platoRequiereGuarnicion(seleccion?.plato);
  const seleccionValida = seleccionDiaEsValida(seleccion);
  const mensajeValidacion = !seleccion?.plato
    ? "Selecciona un plato para este dia."
    : requiereGuarnicion && !seleccion?.guarnicion
      ? "Elegi una guarnicion para confirmar este plato."
      : "";

  function confirmarSeleccionCompleta(seleccionCompleta) {
    if (!seleccionDiaEsValida(seleccionCompleta)) return false;

    onConfirmar?.({
      ...dia,
      estado: seleccionCompleta?.sinPedido &&
        seleccionCompleta.origenSinPedido === "default"
        ? "sin_pedido_por_defecto"
        : "seleccionado",
      seleccion: seleccionCompleta,
      plato: construirTextoPlatoSeleccionado(seleccionCompleta),
    });

    if (cerrarAlConfirmar) onCerrar?.();
    return true;
  }

  function seleccionarPlato(plato) {
    const seleccionNueva = crearSeleccionPedido(plato);

    setSeleccion(seleccionNueva);

    if (!platoRequiereGuarnicion(plato)) {
      confirmarSeleccionCompleta(seleccionNueva);
    }
  }

  function seleccionarGuarnicion(guarnicion) {
    const seleccionCompleta = crearSeleccionPedido(seleccion?.plato, guarnicion);

    setSeleccion(seleccionCompleta);
    confirmarSeleccionCompleta(seleccionCompleta);
  }

  function confirmarSeleccionDia() {
    return confirmarSeleccionCompleta(seleccion);
  }

  function cancelarSeleccion() {
    setSeleccion(obtenerSeleccionInicial(dia, opcionesDia));
    onCerrar?.();
  }

  return {
    busqueda,
    cambiarBusqueda: setBusqueda,
    cambiarFiltro: setFiltroActivo,
    cancelarSeleccion,
    cargandoOpciones,
    confirmarSeleccionDia,
    errorOpciones,
    especialesDia,
    filtrosPlatos: filtrosIniciales,
    filtroActivo,
    fijosDia,
    guarnicionTemporal: seleccion?.guarnicion || "",
    mensajeMenu,
    mensajeValidacion,
    opcionNoPedir,
    opcionesDia,
    opcionesFiltradas,
    platoTemporal: seleccion?.plato || null,
    reintentarCargaOpciones: () => recargarOpcionesDia(dia).then((opciones) => {
      if (opciones.length === 0) return;
      setOpcionesDia(opciones);
      setSeleccion((seleccionActual) =>
        seleccionActual || obtenerSeleccionInicial(dia, opciones),
      );
    }),
    requiereGuarnicion,
    seleccion,
    seleccionValida,
    seleccionarGuarnicion,
    seleccionarPlato,
  };
}
