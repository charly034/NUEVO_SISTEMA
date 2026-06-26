import { toast } from "../lib/swal.js";

import {
  ORDEN_DIAS,
  construirTextoResumenLimite,
  construirTextoLimitePedido,
  construirDiasResumenPedido,
} from "./formulario/helpers.js";
import { Pantalla } from "./formulario/DiaCard.jsx";
import SelectorSemana from "./formulario/SelectorSemana.jsx";
import { useFormularioPedidoData } from "./formulario/useFormularioPedidoData.js";
import { useFormularioPedidoEditor } from "./formulario/useFormularioPedidoEditor.js";
import {
  PedidoConfirmadoCard,
  MenuSemanalCard,
  MenuNoDisponibleCard,
} from "./formulario/SemanaCards.jsx";
import {
  HeaderUsuario,
  LoadingMenuState,
  ConfirmacionPedidoState,
  NoMenusPublicadosState,
  PedidoCargandoState,
} from "./formulario/FormularioPedidoEstados.jsx";
import FormularioPedidoEditable from "./formulario/FormularioPedidoEditable.jsx";

const VISTA_PEDIDO = {
  CARGANDO_MENU: "cargando_menu",
  CONFIRMACION_RECIENTE: "confirmacion_reciente",
  SIN_MENUS_PUBLICADOS: "sin_menus_publicados",
  LIMITE_VENCIDO: "limite_vencido",
  SOLO_LECTURA_CON_PEDIDO: "solo_lectura_con_pedido",
  SOLO_LECTURA_CON_MENU: "solo_lectura_con_menu",
  SOLO_LECTURA_SIN_MENU: "solo_lectura_sin_menu",
  PEDIDO_GUARDADO: "pedido_guardado",
  PREVIEW_CREACION: "preview_creacion",
  CARGANDO_PEDIDO_EXISTENTE: "cargando_pedido_existente",
  EDITABLE: "editable",
};

function ordenarItemsPedido(items = []) {
  return items
    .slice()
    .sort((a, b) => ORDEN_DIAS.indexOf(a.dia) - ORDEN_DIAS.indexOf(b.dia));
}

function textoCantidadDias(cantidad, textoResumen) {
  return `${cantidad} día${cantidad !== 1 ? "s" : ""} · ${textoResumen}`;
}

function PedidoLayout({
  empleado,
  menusDisponibles,
  semanaSelIdx,
  onChangeSemana,
  children,
}) {
  return (
    <Pantalla noScroll>
      <HeaderUsuario empleado={empleado} />
      <SelectorSemana
        menus={menusDisponibles}
        selIdx={semanaSelIdx}
        onChange={onChangeSemana}
        noScroll
      />
      {children}
    </Pantalla>
  );
}

function obtenerVistaPedido({
  loadingMenu,
  confirmado,
  menusDisponibles,
  menuSemana,
  limiteEmpresaVencido,
  puedeModificarPedido,
  tienePedidoGuardado,
  modoEdicionPedido,
  semanaSelIdx,
  modoCreacionPedido,
  pedidoExistente,
}) {
  if (loadingMenu) return VISTA_PEDIDO.CARGANDO_MENU;
  if (confirmado) return VISTA_PEDIDO.CONFIRMACION_RECIENTE;
  if (menusDisponibles.length === 0) return VISTA_PEDIDO.SIN_MENUS_PUBLICADOS;

  if (menuSemana?.disponible && limiteEmpresaVencido) {
    return VISTA_PEDIDO.LIMITE_VENCIDO;
  }

  if (!puedeModificarPedido) {
    const pedidoHistorial = menuSemana?.pedidoHistorial;
    const tieneMenuPublicado =
      !menuSemana?.placeholder && !!menuSemana?.menu?.id;

    if (pedidoHistorial?.items?.length) {
      return VISTA_PEDIDO.SOLO_LECTURA_CON_PEDIDO;
    }
    if (tieneMenuPublicado) {
      return VISTA_PEDIDO.SOLO_LECTURA_CON_MENU;
    }
    return VISTA_PEDIDO.SOLO_LECTURA_SIN_MENU;
  }

  if (tienePedidoGuardado && !modoEdicionPedido) {
    return VISTA_PEDIDO.PEDIDO_GUARDADO;
  }

  if (!tienePedidoGuardado && semanaSelIdx > 0 && !modoCreacionPedido) {
    return VISTA_PEDIDO.PREVIEW_CREACION;
  }

  if (
    modoEdicionPedido &&
    tienePedidoGuardado &&
    !pedidoExistente?.items?.length
  ) {
    return VISTA_PEDIDO.CARGANDO_PEDIDO_EXISTENTE;
  }

  return VISTA_PEDIDO.EDITABLE;
}

export default function FormularioPedido({ empleado }) {
  const {
    semanaSelIdx,
    setSemanaSelIdx,
    loadingMenu,
    guarniciones,
    historial,
    menusDisponibles,
    menuSemana,
    semanaInicio,
    limiteEmpresaVencido,
    pedidoExistente,
    cargandoPedidoExistente,
    pedidoVisible,
    tienePedidoGuardado,
    puedeModificarPedido,
    menu,
    diasSemana,
    diasConFechaYBloqueo,
    diasSinServicio,
  } = useFormularioPedidoData({ empleado });

  const {
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
    envioBloqueado,
    textoBotonEnviar,
    mostrarFooterPedido,
  } = useFormularioPedidoEditor({
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
  });

  const vistaPedido = obtenerVistaPedido({
    loadingMenu,
    confirmado,
    menusDisponibles,
    menuSemana,
    limiteEmpresaVencido,
    puedeModificarPedido,
    tienePedidoGuardado,
    modoEdicionPedido,
    semanaSelIdx,
    modoCreacionPedido,
    pedidoExistente,
  });

  if (vistaPedido === VISTA_PEDIDO.CARGANDO_MENU) {
    return <LoadingMenuState />;
  }

  if (vistaPedido === VISTA_PEDIDO.CONFIRMACION_RECIENTE) {
    return (
      <ConfirmacionPedidoState
        diasSemana={diasSemana}
        semanaInicio={semanaInicio}
        empleado={empleado}
        selecciones={selecciones}
        guarniciones={guarniciones}
        onVerPedido={handleVerPedido}
        onCancelar={handleCancelarPedido}
        cancelando={mutationCancelar.isPending}
      />
    );
  }

  if (vistaPedido === VISTA_PEDIDO.SIN_MENUS_PUBLICADOS) {
    return <NoMenusPublicadosState empleado={empleado} />;
  }

  if (vistaPedido === VISTA_PEDIDO.LIMITE_VENCIDO) {
    const itemsExistentes = ordenarItemsPedido(pedidoExistente?.items ?? []);
    const textoResumenLimite = construirTextoResumenLimite({
      semanaInicio,
      limiteEmpresa: menuSemana.limiteEmpresa,
    });
    const diasResumen = construirDiasResumenPedido(itemsExistentes, diasSemana);

    return (
      <PedidoLayout
        empleado={empleado}
        menusDisponibles={menusDisponibles}
        semanaSelIdx={semanaSelIdx}
        onChangeSemana={setSemanaSelIdx}
      >
        {itemsExistentes.length > 0 ? (
          <PedidoConfirmadoCard
            dias={diasResumen}
            textoResumen={textoCantidadDias(
              itemsExistentes.length,
              textoResumenLimite,
            )}
          />
        ) : (
          <MenuSemanalCard
            menu={menuSemana.menu}
            textoResumen={textoResumenLimite}
          />
        )}
      </PedidoLayout>
    );
  }

  if (vistaPedido === VISTA_PEDIDO.SOLO_LECTURA_CON_PEDIDO) {
    const itemsExistentes = ordenarItemsPedido(
      menuSemana?.pedidoHistorial?.items ?? [],
    );
    const diasResumen = construirDiasResumenPedido(itemsExistentes, diasSemana);
    const textoResumen = construirTextoResumenLimite({ semanaInicio });

    return (
      <PedidoLayout
        empleado={empleado}
        menusDisponibles={menusDisponibles}
        semanaSelIdx={semanaSelIdx}
        onChangeSemana={setSemanaSelIdx}
      >
        <PedidoConfirmadoCard
          dias={diasResumen}
          textoResumen={textoCantidadDias(itemsExistentes.length, textoResumen)}
        />
      </PedidoLayout>
    );
  }

  if (vistaPedido === VISTA_PEDIDO.SOLO_LECTURA_CON_MENU) {
    return (
      <PedidoLayout
        empleado={empleado}
        menusDisponibles={menusDisponibles}
        semanaSelIdx={semanaSelIdx}
        onChangeSemana={setSemanaSelIdx}
      >
        <MenuSemanalCard
          menu={menuSemana.menu}
          textoResumen={construirTextoResumenLimite({ semanaInicio })}
        />
      </PedidoLayout>
    );
  }

  if (vistaPedido === VISTA_PEDIDO.SOLO_LECTURA_SIN_MENU) {
    return (
      <PedidoLayout
        empleado={empleado}
        menusDisponibles={menusDisponibles}
        semanaSelIdx={semanaSelIdx}
        onChangeSemana={setSemanaSelIdx}
      >
        <MenuNoDisponibleCard
          mensaje={
            menuSemana?.placeholder
              ? "Todavía no hay menú publicado para esta semana."
              : menuSemana?.mensaje || "Esta semana ya no acepta pedidos."
          }
        />
      </PedidoLayout>
    );
  }

  const fechaLimite = menu.fecha_limite_pedidos
    ? new Date(menu.fecha_limite_pedidos)
    : null;
  const textoLimitePedido = construirTextoLimitePedido({
    semanaInicio,
    fechaLimite,
    limiteEmpresa: menuSemana?.limiteEmpresa,
  });

  if (vistaPedido === VISTA_PEDIDO.PEDIDO_GUARDADO) {
    const itemsExistentes = ordenarItemsPedido(pedidoVisible?.items ?? []);
    const textoResumenPedido = construirTextoResumenLimite({
      semanaInicio,
      limiteEmpresa: menuSemana?.limiteEmpresa,
    });
    const diasResumen = construirDiasResumenPedido(itemsExistentes, diasSemana);

    return (
      <PedidoLayout
        empleado={empleado}
        menusDisponibles={menusDisponibles}
        semanaSelIdx={semanaSelIdx}
        onChangeSemana={setSemanaSelIdx}
      >
        <PedidoConfirmadoCard
          dias={diasResumen}
          textoResumen={textoCantidadDias(
            itemsExistentes.length,
            textoResumenPedido,
          )}
          onModificar={
            puedeModificarPedido
              ? () => {
                  if (
                    !pedidoExistente?.items?.length &&
                    cargandoPedidoExistente
                  ) {
                    toast.warning(
                      "Estamos cargando tu pedido. Probá de nuevo en unos segundos.",
                    );
                    return;
                  }
                  setModoEdicionPedido(true);
                  setExpandidoDia(null);
                }
              : null
          }
        />
      </PedidoLayout>
    );
  }

  if (vistaPedido === VISTA_PEDIDO.PREVIEW_CREACION) {
    return (
      <PedidoLayout
        empleado={empleado}
        menusDisponibles={menusDisponibles}
        semanaSelIdx={semanaSelIdx}
        onChangeSemana={setSemanaSelIdx}
      >
        <MenuSemanalCard
          menu={menu}
          textoResumen={construirTextoResumenLimite({
            semanaInicio,
            limiteEmpresa: menuSemana?.limiteEmpresa,
          })}
          onComenzar={() => {
            setModoCreacionPedido(true);
            setExpandidoDia(undefined);
          }}
        />
      </PedidoLayout>
    );
  }

  if (vistaPedido === VISTA_PEDIDO.CARGANDO_PEDIDO_EXISTENTE) {
    return (
      <PedidoCargandoState
        empleado={empleado}
        menusDisponibles={menusDisponibles}
        semanaSelIdx={semanaSelIdx}
        onChangeSemana={setSemanaSelIdx}
      />
    );
  }

  return (
    <FormularioPedidoEditable
      empleado={empleado}
      menusDisponibles={menusDisponibles}
      semanaSelIdx={semanaSelIdx}
      setSemanaSelIdx={setSemanaSelIdx}
      fechaLimiteVisible={!!(fechaLimite || menuSemana?.limiteEmpresa)}
      textoLimitePedido={textoLimitePedido}
      pedidoAnterior={pedidoAnterior}
      tienePedidoGuardado={tienePedidoGuardado}
      aplicarPedidoAnterior={aplicarPedidoAnterior}
      diasConFechaYBloqueo={diasConFechaYBloqueo}
      diasSinServicio={diasSinServicio}
      noAsiste={noAsiste}
      selecciones={selecciones}
      diaEfectivo={diaEfectivo}
      toggleExpandido={toggleExpandido}
      diaRefs={diaRefs}
      menuSemana={menuSemana}
      menu={menu}
      guarniciones={guarniciones}
      toggleNoAsiste={toggleNoAsiste}
      elegirPlato={elegirPlato}
      setGuarnicion={setGuarnicion}
      setNotas={setNotas}
      avanzarAlSiguiente={avanzarAlSiguiente}
      mostrarFooterPedido={mostrarFooterPedido}
      envioBloqueado={envioBloqueado}
      handleEnviar={handleEnviar}
      textoBotonEnviar={textoBotonEnviar}
      mutation={mutation}
    />
  );
}
