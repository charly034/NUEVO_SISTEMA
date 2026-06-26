import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import Badge from "../compartido/ui/Badge.jsx";
import Boton from "../compartido/ui/Boton.jsx";
import Pagina from "../compartido/ui/Pagina.jsx";
import Tarjeta from "../compartido/ui/Tarjeta.jsx";
import { confirmar, toast } from "../lib/swal.js";
import { menuApi, pedidoApi } from "../services/api.js";
import { DIAS_LABEL, getDiasSemana } from "../utils/dias.js";

const ESTADO_CONFIG = {
  pendiente: { label: "Confirmado", variante: "verde" },
  en_proceso: { label: "En proceso", variante: "naranja" },
  listo: { label: "Listo", variante: "azul" },
  entregado: { label: "Entregado", variante: "gris" },
  cancelado: { label: "Cancelado", variante: "rojo" },
};

function formatSemana(fechaISO) {
  if (!fechaISO) return "";
  const [y, m, d] = String(fechaISO).split("T")[0].split("-").map(Number);
  const lunes = new Date(y, m - 1, d);
  const viernes = new Date(y, m - 1, d + 4);
  const fmt = (dt) => `${dt.getDate()}/${dt.getMonth() + 1}`;
  return `${fmt(lunes)} al ${fmt(viernes)} de ${viernes.getFullYear()}`;
}

function lunesDeHoy() {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const dia = hoy.getDay();
  const diff = dia === 0 ? -6 : 1 - dia;
  hoy.setDate(hoy.getDate() + diff);
  return hoy;
}

function esEstaSemana(fechaISO) {
  if (!fechaISO) return false;
  const [y, m, d] = String(fechaISO).split("T")[0].split("-").map(Number);
  const semana = new Date(y, m - 1, d);
  const lunes = lunesDeHoy();
  return semana.getTime() === lunes.getTime();
}

function fechaKey(fechaISO) {
  return String(fechaISO || "").split("T")[0];
}

function construirDiasPedido(pedido, menuSemana) {
  const items = pedido.items ?? [];
  const porDia = new Map(items.map((item) => [item.dia, item]));
  const dias = menuSemana
    ? getDiasSemana(menuSemana.dias_laborales)
    : items.map((item) => item.dia);
  return dias.map((dia) => ({ dia, item: porDia.get(dia) || null }));
}

function EncabezadoPagina({ cantidad }) {
  return (
    <header className="mb-4">
      <h2 className="text-2xl font-extrabold text-slate-950">Mis pedidos</h2>
      {cantidad !== undefined && (
        <p className="mt-1 text-sm text-slate-500">
          {cantidad} semana{cantidad !== 1 ? "s" : ""} registrada
          {cantidad !== 1 ? "s" : ""}
        </p>
      )}
    </header>
  );
}

export default function HistorialPedidos({ empleado }) {
  const queryClient = useQueryClient();
  const [expandido, setExpandido] = useState(null);

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ["mi-historial", empleado.id],
    queryFn: pedidoApi.miHistorial,
    staleTime: 60 * 1000,
  });

  const { data: menuData } = useQuery({
    queryKey: ["menus-publicados"],
    queryFn: menuApi.activo,
    staleTime: 60 * 1000,
  });

  const menusPorSemana = new Map(
    (menuData?.menus_disponibles ?? []).map((menuSemana) => [
      fechaKey(menuSemana.menu?.fecha_inicio),
      menuSemana,
    ]),
  );

  const pedidosVisibles = pedidos.filter((pedido) => pedido.estado !== "cancelado");

  const mutationCancelar = useMutation({
    mutationFn: pedidoApi.cancelar,
    onSuccess: (_data, semanaInicio) => {
      queryClient.invalidateQueries({ queryKey: ["mi-historial", empleado.id] });
      queryClient.invalidateQueries({
        queryKey: ["mi-pedido", empleado.id, semanaInicio],
      });
      queryClient.invalidateQueries({ queryKey: ["menus-publicados"] });
      setExpandido(null);
      toast.success(
        "Pedido eliminado. Podés volver a cargarlo mientras siga abierto.",
      );
    },
    onError: (error) =>
      toast.error(error?.message || "No se pudo eliminar el pedido"),
  });

  const eliminarPedido = async (pedido) => {
    if (
      !(await confirmar({
        titulo: "¿Eliminar pedido?",
        texto:
          "Se eliminará el pedido completo de esa semana. Si el plazo sigue abierto, vas a poder cargarlo de nuevo.",
        botonConfirmar: "Sí, eliminar",
        color: "#dc2626",
      }))
    ) {
      return;
    }
    mutationCancelar.mutate(fechaKey(pedido.semana_inicio));
  };

  if (isLoading) {
    return (
      <Pagina>
        <p className="py-16 text-center text-sm text-slate-500">
          Cargando pedidos...
        </p>
      </Pagina>
    );
  }

  if (pedidosVisibles.length === 0) {
    return (
      <Pagina>
        <EncabezadoPagina />
        <Tarjeta className="mt-6 px-5 py-14 text-center">
          <div className="mb-3 text-5xl" aria-hidden="true">
            📋
          </div>
          <p className="text-sm text-slate-500">
            Todavía no tenés pedidos registrados.
          </p>
        </Tarjeta>
      </Pagina>
    );
  }

  return (
    <Pagina>
      <EncabezadoPagina cantidad={pedidosVisibles.length} />

      <div className="flex flex-col gap-2.5">
        {pedidosVisibles.map((pedido) => {
          const cfg = ESTADO_CONFIG[pedido.estado] ?? ESTADO_CONFIG.pendiente;
          const esActual = esEstaSemana(pedido.semana_inicio);
          const abierto = expandido === pedido.id;
          const items = pedido.items ?? [];
          const menuSemana = menusPorSemana.get(fechaKey(pedido.semana_inicio));
          const diasPedido = construirDiasPedido(pedido, menuSemana);
          const puedeEliminar =
            ["pendiente", "en_proceso"].includes(pedido.estado) &&
            menuSemana?.disponible &&
            !menuSemana?.limiteEmpresa?.vencido;

          return (
            <Tarjeta key={pedido.id} className="overflow-hidden">
              <button
                type="button"
                className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
                onClick={() => setExpandido(abierto ? null : pedido.id)}
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[15px] font-bold text-slate-950">
                      Semana del {formatSemana(pedido.semana_inicio)}
                    </span>
                    {esActual && <Badge variante="verde">Esta semana</Badge>}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <Badge variante={cfg.variante}>{cfg.label}</Badge>
                    <span className="text-xs text-slate-500">
                      {items.length} día{items.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
                <span className="shrink-0 text-lg text-slate-500">
                  {abierto ? "▲" : "▼"}
                </span>
              </button>

              {abierto && (
                <div className="flex flex-col gap-2 border-t border-[var(--borde)] px-4 py-3">
                  {diasPedido.length === 0 ? (
                    <p className="text-sm text-slate-500">
                      Sin platos registrados.
                    </p>
                  ) : (
                    diasPedido.map(({ dia, item }) => (
                      <div
                        key={dia}
                        className={item ? "flex gap-3" : "flex gap-3 opacity-80"}
                      >
                        <span
                          className={
                            item
                              ? "w-[72px] shrink-0 text-sm font-bold text-[var(--verde)]"
                              : "w-[72px] shrink-0 text-sm font-bold text-slate-500"
                          }
                        >
                          {DIAS_LABEL[dia] ?? dia}
                        </span>
                        <div className="min-w-0 flex-1">
                          {item ? (
                            <>
                              <div className="text-sm font-semibold text-slate-950">
                                {item.plato_nombre}
                              </div>
                              {item.guarnicion_nombre && (
                                <div className="mt-0.5 text-xs text-slate-500">
                                  + {item.guarnicion_nombre}
                                </div>
                              )}
                            </>
                          ) : (
                            <Badge variante="gris">No pedís vianda</Badge>
                          )}
                        </div>
                      </div>
                    ))
                  )}

                  {puedeEliminar && (
                    <Boton
                      type="button"
                      variante="peligro"
                      anchoCompleto
                      disabled={mutationCancelar.isPending}
                      onClick={() => eliminarPedido(pedido)}
                      className="mt-2 text-sm"
                    >
                      {mutationCancelar.isPending
                        ? "Eliminando..."
                        : "Eliminar pedido de esta semana"}
                    </Boton>
                  )}
                </div>
              )}
            </Tarjeta>
          );
        })}
      </div>
    </Pagina>
  );
}
