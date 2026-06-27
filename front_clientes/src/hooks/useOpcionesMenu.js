import { useCallback, useMemo, useState } from "react";
import { menuService } from "../services/menuService.js";

export function useOpcionesMenu({
  empresaId = "empresa_demo",
  service = menuService,
  semanaId,
} = {}) {
  const [opcionesPorDia, setOpcionesPorDia] = useState({});
  const [cargandoOpciones, setCargandoOpciones] = useState(false);
  const [errorOpciones, setErrorOpciones] = useState("");
  const [textoBusqueda, setTextoBusqueda] = useState("");

  const obtenerOpcionesDia = useCallback(
    async (dia, opcionesCarga = {}) => {
      if (!dia) return [];
      if (dia.opciones?.length && !opcionesCarga.forzar) return dia.opciones;

      const diaId = dia.id || dia.clave;
      if (opcionesPorDia[diaId] && !opcionesCarga.forzar) {
        return opcionesPorDia[diaId];
      }

      setCargandoOpciones(true);
      setErrorOpciones("");

      try {
        if (!semanaId) {
          throw new Error("No pudimos identificar la semana para cargar opciones.");
        }

        const opciones = await service.obtenerOpcionesMenuPorDia({
          diaId,
          empresaId,
          semanaId,
        });

        if (opciones.length === 0) {
          setErrorOpciones("No hay opciones disponibles para este dia.");
        }

        setOpcionesPorDia((actuales) => ({
          ...actuales,
          [diaId]: opciones,
        }));
        return opciones;
      } catch (error) {
        setErrorOpciones(error.message || "No pudimos cargar las opciones de este dia.");
        return [];
      } finally {
        setCargandoOpciones(false);
      }
    },
    [empresaId, opcionesPorDia, semanaId, service],
  );

  const recargarOpcionesDia = useCallback(
    (dia) => obtenerOpcionesDia(dia, { forzar: true }),
    [obtenerOpcionesDia],
  );

  const buscarOpciones = useCallback((texto) => {
    setTextoBusqueda(texto);
  }, []);

  const limpiarBusqueda = useCallback(() => {
    setTextoBusqueda("");
  }, []);

  const estadoOpciones = useMemo(
    () => ({
      cargandoOpciones,
      errorOpciones,
      textoBusqueda,
    }),
    [cargandoOpciones, errorOpciones, textoBusqueda],
  );

  return {
    buscarOpciones,
    cargandoOpciones,
    errorOpciones,
    estadoOpciones,
    limpiarBusqueda,
    obtenerOpcionesDia,
    opcionesPorDia,
    recargarOpcionesDia,
    textoBusqueda,
  };
}
