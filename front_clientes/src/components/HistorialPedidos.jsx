import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Trash2,
} from "lucide-react";
import Boton from "../compartido/ui/Boton.jsx";
import Pagina from "../compartido/ui/Pagina.jsx";
import { confirmar, toast } from "../lib/swal.js";
import { menuApi, pedidoApi } from "../services/api.js";
import { DIAS_LABEL, getDiasSemana } from "../utils/dias.js";

const ESTADO_CONFIG = {
  pendiente: { label: "Pendiente", tono: "pendiente" },
  en_proceso: { label: "Pendiente", tono: "pendiente" },
  listo: { label: "Confirmado", tono: "confirmado" },
  entregado: { label: "Confirmado", tono: "confirmado" },
  cancelado: { label: "Cancelado", tono: "cancelado" },
};
const STALE_HISTORIAL_MS = 5 * 60 * 1000;
const GC_HISTORIAL_MS = 30 * 60 * 1000;

const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

function formatSemanaCorta(fechaISO) {
  if (!fechaISO) return "";
  const [y, m, d] = String(fechaISO).split("T")[0].split("-").map(Number);
  const lunes = new Date(y, m - 1, d);
  const viernes = new Date(y, m - 1, d + 4);
  const mesLunes = meses[lunes.getMonth()];
  const mesViernes = meses[viernes.getMonth()];
  const inicio = mesLunes === mesViernes ? `${lunes.getDate()}` : `${lunes.getDate()} ${mesLunes}`;
  return `${inicio} - ${viernes.getDate()} ${mesViernes}`;
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

function contarSinVianda(diasPedido) {
  return diasPedido.filter(({ item }) => !item || item.sin_pedido).length;
}

function EstadoPedido({ tono, label }) {
  const confirmado = tono === "confirmado";
  return (
    <span
      className={
        confirmado
          ? "inline-flex items-center gap-1.5 text-[0.95rem] font-extrabold text-[#1d8a78]"
          : "inline-flex items-center gap-1.5 text-[0.95rem] font-extrabold text-[#b17623]"
      }
    >
      {confirmado ? (
        <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
      ) : (
        <span className="flex h-4 w-4 items-center justify-center rounded-full border-2 border-current text-[0.65rem] leading-none">
          !
        </span>
      )}
      {label}
    </span>
  );
}

function ResumenDerecha({ diasPedido, items }) {
  const total = items.length;
  const sinVianda = contarSinVianda(diasPedido);

  if (total === 0) return <span>Sin dias cargados</span>;
  return (
    <span className="text-right leading-tight">
      <span className="block">{total} dias</span>
      {sinVianda > 0 && (
        <span className="block text-[0.88rem] font-semibold text-[#aaa79f]">
          {sinVianda} sin vianda
        </span>
      )}
    </span>
  );
}

function SkeletonHistorial() {
  return (
    <div className="space-y-4 px-6 pt-8">
      <div className="h-24 animate-pulse rounded-[1.15rem] bg-white" />
      <div className="h-24 animate-pulse rounded-[1.15rem] bg-white" />
      <div className="h-24 animate-pulse rounded-[1.15rem] bg-white" />
    </div>
  );
}

export default function HistorialPedidos({ empleado }) {
  const queryClient = useQueryClient();
  const [expandido, setExpandido] = useState(null);

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ["mi-historial", empleado.id],
    queryFn: pedidoApi.miHistorial,
    enabled: Boolean(empleado?.id),
    staleTime: STALE_HISTORIAL_MS,
    gcTime: GC_HISTORIAL_MS,
    refetchOnWindowFocus: false,
  });

  const { data: menuData } = useQuery({
    queryKey: ["menus-publicados"],
    queryFn: menuApi.activo,
    staleTime: STALE_HISTORIAL_MS,
    gcTime: GC_HISTORIAL_MS,
    refetchOnWindowFocus: false,
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
      queryClient.invalidateQueries({ queryKey: ["pedido-semanal", empleado.id] });
      queryClient.invalidateQueries({ queryKey: ["menus-publicados"] });
      setExpandido(null);
      toast.success("Pedido eliminado. Podes volver a cargarlo mientras siga abierto.");
    },
    onError: (error) =>
      toast.error(error?.message || "No se pudo eliminar el pedido"),
  });

  const eliminarPedido = async (pedido) => {
    if (
      !(await confirmar({
        titulo: "Eliminar pedido?",
        texto:
          "Se eliminara el pedido completo de esa semana. Si el plazo sigue abierto, vas a poder cargarlo de nuevo.",
        botonConfirmar: "Si, eliminar",
        color: "#dc2626",
      }))
    ) {
      return;
    }
    mutationCancelar.mutate(fechaKey(pedido.semana_inicio));
  };

  return (
    <Pagina className="min-h-dvh max-w-[480px] overflow-hidden bg-[#f7f8f3] px-0 pt-0 md:max-w-[480px] md:px-0 md:pt-0 lg:max-w-[480px]">
      <header className="shrink-0 bg-[#586b24] px-6 pb-8 pt-[calc(4.75rem+env(safe-area-inset-top))] text-white">
        <h1 className="text-[1.82rem] font-extrabold leading-tight">Mis pedidos</h1>
        <p className="mt-2 text-[1.13rem] font-semibold text-white/58">
          Historial de semanas
        </p>
      </header>

      {isLoading ? (
        <SkeletonHistorial />
      ) : pedidosVisibles.length === 0 ? (
        <div className="px-6 pt-8">
          <section className="rounded-[1.15rem] border border-[#deded8] bg-white px-5 py-14 text-center shadow-[0_2px_8px_rgba(26,26,26,0.12)]">
            <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[#eef3e9] text-[#586b24]">
              <ClipboardList className="h-7 w-7" aria-hidden="true" />
            </span>
            <p className="text-sm font-bold text-[#716c64]">
              Todavia no tenes pedidos registrados.
            </p>
          </section>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-8 pt-7">
          <div className="space-y-4">
            {pedidosVisibles.map((pedido) => {
              const cfg = ESTADO_CONFIG[pedido.estado] ?? ESTADO_CONFIG.pendiente;
              const abierto = expandido === pedido.id;
              const items = pedido.items ?? [];
              const menuSemana = menusPorSemana.get(fechaKey(pedido.semana_inicio));
              const diasPedido = construirDiasPedido(pedido, menuSemana);
              const puedeEliminar =
                ["pendiente", "en_proceso"].includes(pedido.estado) &&
                menuSemana?.disponible &&
                !menuSemana?.limiteEmpresa?.vencido;

              return (
                <section
                  key={pedido.id}
                  className="overflow-hidden rounded-[1.15rem] border border-[#deded8] bg-white shadow-[0_2px_8px_rgba(26,26,26,0.12)]"
                >
                  <button
                    type="button"
                    className="flex w-full items-start gap-3 px-5 py-4 text-left transition hover:bg-[#fbfbf7]"
                    onClick={() => setExpandido(abierto ? null : pedido.id)}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[1.22rem] font-extrabold leading-tight text-[#272723]">
                        {formatSemanaCorta(pedido.semana_inicio)}
                      </p>
                      <div className="mt-2">
                        <EstadoPedido tono={cfg.tono} label={cfg.label} />
                      </div>
                    </div>
                    <div className="flex shrink-0 items-start gap-3 text-[1rem] font-semibold text-[#8c8981]">
                      <ResumenDerecha diasPedido={diasPedido} items={items} />
                      {abierto ? (
                        <ChevronUp className="mt-1 h-5 w-5" aria-hidden="true" />
                      ) : (
                        <ChevronDown className="mt-1 h-5 w-5" aria-hidden="true" />
                      )}
                    </div>
                  </button>

                  {abierto && (
                    <div className="border-t border-[#ecebe5] px-5 py-5">
                      {items.length === 0 ? (
                        <p className="text-[0.98rem] font-semibold text-[#aaa79f]">
                          Pedido pendiente, sin platos cargados aun.
                        </p>
                      ) : (
                        <div className="space-y-4">
                          {diasPedido.map(({ dia, item }) => (
                            <div key={dia} className="grid grid-cols-[6.5rem_1fr] gap-3">
                              <span className="text-[1rem] font-extrabold text-[#848178]">
                                {DIAS_LABEL[dia] ?? dia}
                              </span>
                              <span className="text-right text-[1rem] font-semibold text-[#272723]">
                                {item && !item.sin_pedido ? item.plato_nombre : "Sin vianda"}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {puedeEliminar && (
                        <div className="mt-5 border-t border-[#ecebe5] pt-4">
                          <Boton
                            type="button"
                            variante="peligro"
                            disabled={mutationCancelar.isPending}
                            onClick={() => eliminarPedido(pedido)}
                            className="min-h-11 rounded-full px-5 text-[1rem]"
                          >
                            {!mutationCancelar.isPending && (
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            )}
                            {mutationCancelar.isPending ? "Eliminando..." : "Eliminar pedido"}
                          </Boton>
                        </div>
                      )}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        </div>
      )}
    </Pagina>
  );
}
