import { useCallback, useEffect, useRef, useState } from "react";
import { menuService } from "../services/menuService.js";

export function useOpcionesMenu({
  empresaId = "empresa_demo",
  service = menuService,
  semanaId,
} = {}) {
  const opcionesPorDiaRef = useRef({});
  const [opcionesPorDia, setOpcionesPorDia] = useState({});
  const [cargandoOpciones, setCargandoOpciones] = useState(false);
  const [errorOpciones, setErrorOpciones] = useState("");

  useEffect(() => {
    opcionesPorDiaRef.current = {};
    setOpcionesPorDia({});
  }, [empresaId, semanaId]);

  const obtenerOpcionesDia = useCallback(
    async (dia, opcionesCarga = {}) => {
      if (!dia) return [];
      if (dia.opciones?.length && !opcionesCarga.forzar) return dia.opciones;

      const diaId = dia.id || dia.clave;
      if (opcionesPorDiaRef.current[diaId] && !opcionesCarga.forzar) {
        return opcionesPorDiaRef.current[diaId];
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

        opcionesPorDiaRef.current = {
          ...opcionesPorDiaRef.current,
          [diaId]: opciones,
        };
        setOpcionesPorDia(opcionesPorDiaRef.current);
        return opciones;
      } catch (error) {
        setErrorOpciones(error.message || "No pudimos cargar las opciones de este dia.");
        return [];
      } finally {
        setCargandoOpciones(false);
      }
    },
    [empresaId, semanaId, service],
  );

  const recargarOpcionesDia = useCallback(
    (dia) => obtenerOpcionesDia(dia, { forzar: true }),
    [obtenerOpcionesDia],
  );

  return {
    cargandoOpciones,
    errorOpciones,
    obtenerOpcionesDia,
    opcionesPorDia,
    recargarOpcionesDia,
  };
}
