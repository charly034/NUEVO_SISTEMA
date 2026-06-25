import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { pedidoApi } from "../../services/api.js";
import { DIAS_LABEL } from "../../utils/dias.js";
import { toast, confirmar, preguntarDiasIncompletos } from "../../lib/swal.js";
import { ORDEN_DIAS } from "./helpers.js";

function normalizarItemPedido(item) {
  return {
    dia: item.dia,
    plato_id: Number(item.plato_id),
    opcion: item.opcion || null,
    guarnicion_id: item.guarnicion_id ? Number(item.guarnicion_id) : null,
    notas: item.notas || null,
  };
}

function serializarItemsPedido(items = []) {
  return JSON.stringify(
    items
      .map(normalizarItemPedido)
      .sort((a, b) => ORDEN_DIAS.indexOf(a.dia) - ORDEN_DIAS.indexOf(b.dia)),
  );
}

function construirItemsPedido({
  diasSemana,
  diasConFechaYBloqueo,
  selecciones,
  noAsiste,
}) {
  return diasSemana
    .filter((dia) => {
      const bloqueado = diasConFechaYBloqueo.find(
        (item) => item.dia === dia,
      )?.bloqueado;
      if (bloqueado) return !!selecciones[dia]?.plato_id;
      return !!selecciones[dia]?.plato_id && !noAsiste[dia];
    })
    .map((dia) => ({
      dia,
      plato_id: selecciones[dia].plato_id,
      opcion: selecciones[dia].opcion || null,
      guarnicion_id: selecciones[dia].guarnicion_id || null,
      notas: selecciones[dia].notas || null,
    }));
}

function defaultNoAsiste(diasLaborales) {
  if (diasLaborales === "lunes_sabado") return { sabado: true };
  if (diasLaborales === "lunes_domingo") {
    return { sabado: true, domingo: true };
  }
  return {};
}

export function useFormularioPedidoEditor({
  empleado,
  semanaSelIdx,
  menuSemana,
  semanaInicio,
  historial,
  pedidoExistente,
  pedidoVisible,
  tienePedidoGuardado,
  menu,
  diasSemana,
  diasConFechaYBloqueo,
  diasSinServicio,
}) {
  const queryClient = useQueryClient();
  const [expandidoDia, setExpandidoDia] = useState(undefined);
  const inicializadoRef = useRef(false);
  const diaRefs = useRef({});
  const [selecciones, setSelecciones] = useState({});
  const [confirmado, setConfirmado] = useState(false);
  const [noAsiste, setNoAsiste] = useState({});
  const [modoEdicionPedido, setModoEdicionPedido] = useState(false);
  const [modoCreacionPedido, setModoCreacionPedido] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSelecciones({});
      setConfirmado(false);
      setModoEdicionPedido(false);
      setModoCreacionPedido(false);
      setNoAsiste(defaultNoAsiste(menuSemana?.dias_laborales));
      setExpandidoDia(undefined);
      inicializadoRef.current = false;
    }, 0);
    return () => clearTimeout(timer);
  }, [semanaSelIdx, menuSemana?.menu?.id, menuSemana?.dias_laborales]);

  useEffect(() => {
    if (pedidoExistente?.items?.length) {
      const map = {};
      const trabajaDias = {};
      for (const item of pedidoExistente.items) {
        map[item.dia] = {
          plato_id: item.plato_id,
          opcion: item.opcion,
          plato_nombre: item.plato_nombre,
          tiene_guarnicion: item.tiene_guarnicion === true,
          guarnicion_id: item.guarnicion_id,
          notas: item.notas || "",
        };
        trabajaDias[item.dia] = false;
      }
      const timer = setTimeout(() => {
        setSelecciones(map);
        setNoAsiste((prev) => ({ ...prev, ...trabajaDias }));
        setModoEdicionPedido(false);
        setModoCreacionPedido(false);
        if (!inicializadoRef.current) {
          inicializadoRef.current = true;
          setExpandidoDia(null);
        }
      }, 0);
      return () => clearTimeout(timer);
    }

    if (pedidoExistente !== undefined && !inicializadoRef.current) {
      inicializadoRef.current = true;
    }
  }, [pedidoExistente]);

  const diaActivoParaPedido = ({ dia, bloqueado }) =>
    !bloqueado && !diasSinServicio.has(dia) && !noAsiste[dia];

  const diaNecesitaGuarnicion = (dia, source = selecciones) =>
    !!source[dia]?.plato_id &&
    source[dia]?.tiene_guarnicion &&
    !source[dia]?.guarnicion_id;

  const diaTienePedidoCompleto = (dia, source = selecciones) =>
    !!source[dia]?.plato_id && !diaNecesitaGuarnicion(dia, source);

  const primerIncompleto =
    diasConFechaYBloqueo.find(
      (item) => diaActivoParaPedido(item) && !diaTienePedidoCompleto(item.dia),
    )?.dia ?? null;
  const diaEfectivo =
    expandidoDia === undefined ? primerIncompleto : expandidoDia;

  useEffect(() => {
    if (!diaEfectivo) return;
    const timer = setTimeout(() => {
      diaRefs.current[diaEfectivo]?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 60);
    return () => clearTimeout(timer);
  }, [diaEfectivo]);

  const avanzarAlSiguiente = (diaActual, seleccionesActuales) => {
    const diasActivos = diasConFechaYBloqueo.filter(diaActivoParaPedido);
    const idx = diasActivos.findIndex((item) => item.dia === diaActual);
    for (let i = idx + 1; i < diasActivos.length; i++) {
      if (!diaTienePedidoCompleto(diasActivos[i].dia, seleccionesActuales)) {
        const siguienteDia = diasActivos[i].dia;
        setExpandidoDia(null);
        setTimeout(() => {
          setExpandidoDia(siguienteDia);
          setTimeout(() => {
            const elemento = diaRefs.current[siguienteDia];
            if (elemento) {
              elemento.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          }, 80);
        }, 380);
        return;
      }
    }
    setExpandidoDia(null);
  };

  const toggleExpandido = (dia) => {
    setExpandidoDia(diaEfectivo === dia ? null : dia);
  };

  const toggleNoAsiste = (dia) => {
    const marcandoNoAsiste = !noAsiste[dia];
    setNoAsiste((prev) => ({ ...prev, [dia]: !prev[dia] }));
    if (marcandoNoAsiste) {
      setSelecciones((prev) => {
        const next = { ...prev };
        delete next[dia];
        return next;
      });
      if (diaEfectivo === dia) setExpandidoDia(null);
    }
  };

  const elegirPlato = (dia, plato, opcion = null) => {
    const seleccionActual = selecciones[dia];
    const mismoPlato =
      seleccionActual?.plato_id === plato.plato_id &&
      seleccionActual?.opcion === opcion;
    const requiereGuarnicion = plato.tiene_guarnicion === true;
    const nuevasSel = {
      ...selecciones,
      [dia]: {
        plato_id: plato.plato_id,
        opcion,
        plato_nombre: plato.plato_nombre,
        tiene_guarnicion: requiereGuarnicion,
        guarnicion_id:
          requiereGuarnicion && mismoPlato
            ? (seleccionActual?.guarnicion_id ?? null)
            : null,
        notas: seleccionActual?.notas ?? "",
      },
    };
    setSelecciones(nuevasSel);
    if (requiereGuarnicion) {
      setExpandidoDia(dia);
    } else {
      avanzarAlSiguiente(dia, nuevasSel);
    }
  };

  const setGuarnicion = (dia, guarnicionId) => {
    setSelecciones((prev) => ({
      ...prev,
      [dia]: {
        ...prev[dia],
        guarnicion_id: guarnicionId ? parseInt(guarnicionId) : null,
      },
    }));
  };

  const setNotas = (dia, notas) => {
    setSelecciones((prev) => ({ ...prev, [dia]: { ...prev[dia], notas } }));
  };

  const pedidoAnterior =
    historial
      .filter(
        (pedido) =>
          pedido.estado !== "cancelado" &&
          pedido.semana_inicio !== semanaInicio,
      )
      .sort(
        (a, b) => new Date(b.semana_inicio) - new Date(a.semana_inicio),
      )[0] ?? null;

  const aplicarPedidoAnterior = () => {
    if (!pedidoAnterior || !menu) return;
    const platosDisponibles = new Map();
    for (const plato of menu.fijos || [])
      platosDisponibles.set(plato.plato_id, plato);
    for (const plato of menu.variables || []) {
      platosDisponibles.set(plato.plato_id, plato);
    }

    let aplicados = 0;
    const nuevasSel = { ...selecciones };
    for (const item of pedidoAnterior.items || []) {
      const plato = platosDisponibles.get(item.plato_id);
      const diaBloqueado = diasConFechaYBloqueo.find(
        (diaSemana) => diaSemana.dia === item.dia,
      )?.bloqueado;
      const diaSinServicio = diasSinServicio.has(item.dia);

      if (plato && !noAsiste[item.dia] && !diaBloqueado && !diaSinServicio) {
        nuevasSel[item.dia] = {
          plato_id: item.plato_id,
          opcion: item.opcion,
          plato_nombre: item.plato_nombre,
          tiene_guarnicion: item.tiene_guarnicion === true,
          guarnicion_id: item.guarnicion_id ?? null,
          notas: item.notas || "",
        };
        aplicados++;
      }
    }
    setSelecciones(nuevasSel);
    if (aplicados > 0) {
      toast.success(
        `${aplicados} día${aplicados !== 1 ? "s" : ""} pre-cargados del pedido anterior`,
      );
      setExpandidoDia(null);
    } else {
      toast.warning("Los platos de la semana anterior no están en este menú");
    }
  };

  const mutation = useMutation({
    mutationFn: (data) => pedidoApi.guardar(data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["mi-pedido", empleado.id, semanaInicio],
      });
      queryClient.invalidateQueries({
        queryKey: ["mi-historial", empleado.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["menus-publicados"],
      });
      setConfirmado(true);
      toast.success(
        tienePedidoGuardado
          ? "Pedido actualizado. La cocina ya ve tus cambios."
          : "Pedido enviado. La cocina ya lo recibió.",
      );
    },
    onError: (error) =>
      toast.error(error?.message || "Error al enviar el pedido"),
  });

  const mutationCancelar = useMutation({
    mutationFn: () => pedidoApi.cancelar(semanaInicio),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["mi-pedido", empleado.id, semanaInicio],
      });
      queryClient.invalidateQueries({
        queryKey: ["mi-historial", empleado.id],
      });
      queryClient.invalidateQueries({
        queryKey: ["menus-publicados"],
      });
      setSelecciones({});
      setConfirmado(false);
      setExpandidoDia(undefined);
      toast.success("Pedido cancelado");
    },
    onError: (error) => toast.error(error?.message || "Error al cancelar"),
  });

  const itemsActuales = construirItemsPedido({
    diasSemana,
    diasConFechaYBloqueo,
    selecciones,
    noAsiste,
  });
  const hayCambiosSinGuardar = tienePedidoGuardado
    ? serializarItemsPedido(itemsActuales) !==
      serializarItemsPedido(pedidoVisible?.items ?? [])
    : itemsActuales.length > 0;

  const handleEnviar = async () => {
    const diasActivosLista = diasConFechaYBloqueo.filter(diaActivoParaPedido);
    const diasSinGuarnicion = diasActivosLista.filter(({ dia }) =>
      diaNecesitaGuarnicion(dia),
    );
    if (diasSinGuarnicion.length > 0) {
      setExpandidoDia(diasSinGuarnicion[0].dia);
      toast.warning(
        `Te falta elegir guarnición para ${DIAS_LABEL[diasSinGuarnicion[0].dia].toLowerCase()}.`,
      );
      return;
    }

    const faltanDias = diasActivosLista.filter(
      ({ dia }) => !selecciones[dia]?.plato_id,
    ).length;
    if (faltanDias > 0 && !(await preguntarDiasIncompletos(faltanDias))) return;

    const items = itemsActuales;
    if (items.length === 0) return;
    if (tienePedidoGuardado && !hayCambiosSinGuardar) {
      toast.warning("Tu pedido ya está guardado. No hay cambios para enviar.");
      return;
    }

    const accion = tienePedidoGuardado ? "Actualizar pedido" : "Enviar pedido";
    const texto = tienePedidoGuardado
      ? `Vas a actualizar ${items.length} día${items.length !== 1 ? "s" : ""}. Los cambios recién se guardan al confirmar.`
      : `Vas a enviar ${items.length} día${items.length !== 1 ? "s" : ""}. Después vas a poder modificarlo mientras el plazo siga abierto.`;

    if (
      !(await confirmar({
        titulo: `${accion}?`,
        texto,
        botonConfirmar: tienePedidoGuardado ? "Sí, actualizar" : "Sí, enviar",
        color: "#276749",
      }))
    ) {
      return;
    }

    mutation.mutate({
      semana_inicio: semanaInicio,
      menu_semanal_id: menu?.id || null,
      items,
    });
  };

  const handleCancelarPedido = async () => {
    if (
      await confirmar({
        titulo: "¿Cancelar el pedido?",
        texto: "Se eliminará tu pedido de esta semana.",
        botonConfirmar: "Sí, cancelar pedido",
      })
    ) {
      mutationCancelar.mutate();
    }
  };

  const handleVerPedido = () => {
    setConfirmado(false);
    setExpandidoDia(null);
  };

  const diasActivosLista = diasConFechaYBloqueo.filter(diaActivoParaPedido);
  const diasFaltanGuarnicion = diasActivosLista.filter(({ dia }) =>
    diaNecesitaGuarnicion(dia),
  );
  const diasCompletados = diasActivosLista.filter(({ dia }) =>
    diaTienePedidoCompleto(dia),
  ).length;
  const envioBloqueado =
    mutation.isPending ||
    diasCompletados === 0 ||
    diasFaltanGuarnicion.length > 0 ||
    (tienePedidoGuardado && !hayCambiosSinGuardar);
  const textoBotonEnviar = mutation.isPending
    ? "Enviando..."
    : diasFaltanGuarnicion.length > 0
      ? "Completá la guarnición"
      : diasCompletados === 0
        ? "Elegí un plato"
        : tienePedidoGuardado && !hayCambiosSinGuardar
          ? "Sin cambios"
          : tienePedidoGuardado
            ? "Guardar cambios"
            : "Confirmar pedido";
  const mostrarFooterPedido =
    hayCambiosSinGuardar ||
    (!tienePedidoGuardado && diasCompletados > 0) ||
    mutation.isPending ||
    mutation.isError;

  return {
    diaRefs,
    selecciones,
    confirmado,
    noAsiste,
    modoEdicionPedido,
    modoCreacionPedido,
    diaEfectivo,
    pedidoAnterior,
    mutation,
    mutationCancelar,
    handleEnviar,
    handleCancelarPedido,
    handleVerPedido,
    toggleExpandido,
    toggleNoAsiste,
    elegirPlato,
    setGuarnicion,
    setNotas,
    aplicarPedidoAnterior,
    avanzarAlSiguiente,
    setModoEdicionPedido,
    setModoCreacionPedido,
    setExpandidoDia,
    tieneCambiosSinGuardar: hayCambiosSinGuardar,
    envioBloqueado,
    textoBotonEnviar,
    mostrarFooterPedido,
  };
}
