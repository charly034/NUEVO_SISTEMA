import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { menuApi, pedidoApi, guarnicionesApi } from '../api.js';
import { DIAS_LABEL, getDiasSemana, formatFecha, addDias } from '../utils.js';
import { toast, confirmar, preguntarDiasIncompletos } from '../lib/swal.js';

function fechaLocalDesdeISO(fecha) {
  if (!fecha) return null;
  if (fecha instanceof Date) return fecha;
  const soloFecha = String(fecha).split('T')[0];
  const [y, m, d] = soloFecha.split('-').map(Number);
  if (!y || !m || !d) return new Date(fecha);
  return new Date(y, m - 1, d);
}

function fechaCorta(fecha) {
  const date = fechaLocalDesdeISO(fecha);
  if (!date || Number.isNaN(date.getTime())) return '';
  return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function fechaConDiaYHora(fecha) {
  const date = new Date(fecha);
  if (!date || Number.isNaN(date.getTime())) return '';
  const dia = date.toLocaleDateString('es-AR', { weekday: 'long' });
  const fechaTxt = fechaCorta(date);
  const hora = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  return `${dia} ${fechaTxt} a las ${hora} hs`;
}

function construirTextoResumenLimite({ semanaInicio, limiteEmpresa }) {
  const semanaTxt = semanaInicio ? `Semana del lunes ${fechaCorta(semanaInicio)}` : 'Semana seleccionada';
  if (!limiteEmpresa) return semanaTxt;
  const hora = limiteEmpresa.hora || '';
  const corte = limiteEmpresa.fechaCorte ? fechaConDiaYHora(limiteEmpresa.fechaCorte).replace(' a las ', ' ') : '';
  if (limiteEmpresa.tipo === 'semanal') return `${semanaTxt} · Límite ${corte || limiteEmpresa.texto || ''}`.trim();
  if (limiteEmpresa.tipo === 'diario') return `${semanaTxt} · Corte diario${hora ? ` ${hora} hs` : ''}`;
  if (limiteEmpresa.tipo === 'ambos') return `${semanaTxt} · Corte semanal y diario${hora ? ` ${hora} hs` : ''}`;
  return `${semanaTxt} · ${limiteEmpresa.texto || ''}`.trim();
}

function construirTextoLimitePedido({ semanaInicio, fechaLimite, limiteEmpresa }) {
  const semanaTxt = semanaInicio ? `Semana del lunes ${fechaCorta(semanaInicio)}.` : '';

  if (fechaLimite) {
    const fecha = fechaLimite.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' });
    const hora = fechaLimite.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
    return `${semanaTxt} Pedidos hasta el ${fecha} ${hora}.`.trim();
  }

  if (!limiteEmpresa) return semanaTxt;

  if (limiteEmpresa.tipo === 'semanal') {
    const corte = limiteEmpresa.fechaCorte ? fechaConDiaYHora(limiteEmpresa.fechaCorte) : '';
    return `${semanaTxt} Pedido semanal: cargá la semana completa${corte ? ` hasta el ${corte}` : ''}.`.trim();
  }

  if (limiteEmpresa.tipo === 'diario') {
    const hora = limiteEmpresa.hora || '';
    const cuando = Number(limiteEmpresa.anticipacion_dias ?? 0) === 0 ? 'el mismo día' : 'el día anterior';
    return `${semanaTxt} Pedido diario: podés cargar cada día hasta ${cuando}${hora ? ` a las ${hora} hs` : ''}.`.trim();
  }

  if (limiteEmpresa.tipo === 'ambos') {
    const corte = limiteEmpresa.fechaCorte ? fechaConDiaYHora(limiteEmpresa.fechaCorte) : '';
    const hora = limiteEmpresa.hora || '';
    const anticipacion = Number(limiteEmpresa.anticipacion_dias ?? 0) === 0 ? 'el mismo día' : 'el día anterior';
    return `${semanaTxt} Carga semanal${corte ? ` hasta el ${corte}` : ''}; después aplica corte diario hasta ${anticipacion}${hora ? ` a las ${hora} hs` : ''}.`.trim();
  }

  return `${semanaTxt} ${limiteEmpresa.texto || ''}`.trim();
}

export default function FormularioPedido({ empleado }) {
  const queryClient = useQueryClient();
  const [semanaSelIdx, setSemanaSelIdx] = useState(0);
  // undefined = auto (primer día incompleto), null = todos cerrados, string = día específico
  const [expandidoDia, setExpandidoDia] = useState(undefined);
  const inicializadoRef = useRef(false);

  const { data: menuData, isLoading: loadingMenu } = useQuery({
    queryKey: ['menus-publicados'],
    queryFn: menuApi.activo,
    refetchOnWindowFocus: false,
  });

  const menusDisponibles = menuData?.menus_disponibles ?? [];
  const menuSemana = menusDisponibles[semanaSelIdx] ?? null;
  const semanaInicio = menuSemana?.menu?.fecha_inicio?.split('T')[0] ?? null;
  const limiteEmpresaVencido = menuSemana?.limiteEmpresa?.vencido === true;

  const { data: guarniciones = [] } = useQuery({
    queryKey: ['guarniciones'],
    queryFn: guarnicionesApi.listar,
  });

  const { data: pedidoExistente } = useQuery({
    queryKey: ['mi-pedido', empleado.id, semanaInicio],
    queryFn: () => pedidoApi.miPedido(semanaInicio),
    enabled: !!semanaInicio && menuSemana?.disponible,
  });

  const { data: historial = [] } = useQuery({
    queryKey: ['mi-historial', empleado.id],
    queryFn: pedidoApi.miHistorial,
    staleTime: 5 * 60 * 1000,
  });

  const [selecciones, setSelecciones] = useState({});
  const [confirmado, setConfirmado] = useState(false);
  const [noAsiste, setNoAsiste] = useState({});
  const tienePedidoGuardado = (pedidoExistente?.items?.length ?? 0) > 0;

  function defaultNoAsiste(diasLaborales) {
    if (diasLaborales === 'lunes_sabado') return { sabado: true };
    if (diasLaborales === 'lunes_domingo') return { sabado: true, domingo: true };
    return {};
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      setSelecciones({});
      setConfirmado(false);
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
          notas: item.notas || '',
        };
        trabajaDias[item.dia] = false;
      }
      const timer = setTimeout(() => {
        setSelecciones(map);
        setNoAsiste(prev => ({ ...prev, ...trabajaDias }));
        // Con pedido existente, empezar colapsado
        if (!inicializadoRef.current) {
          inicializadoRef.current = true;
          setExpandidoDia(null);
        }
      }, 0);
      return () => clearTimeout(timer);
    } else if (pedidoExistente !== undefined && !inicializadoRef.current) {
      // Pedido resuelto como vacío → marcar inicializado, auto-expand queda en undefined
      inicializadoRef.current = true;
    }
  }, [pedidoExistente]);

  const diasSemana = getDiasSemana(menuSemana?.dias_laborales);
  const diasCerrados = new Set(menuSemana?.limiteEmpresa?.diasCerrados ?? []);
  const diasConFechaYBloqueo = semanaInicio
    ? diasSemana.map((dia, i) => ({ dia, fecha: addDias(semanaInicio, i), bloqueado: diasCerrados.has(dia) }))
    : [];

  const menu = menuSemana?.disponible ? menuSemana.menu : null;
  const diasSinServicio = new Map((menu?.sin_servicio || []).map(item => [item.dia, item.motivo]));

  const diaActivoParaPedido = ({ dia, bloqueado }) => !bloqueado && !diasSinServicio.has(dia) && !noAsiste[dia];
  const diaNecesitaGuarnicion = (dia, source = selecciones) =>
    !!source[dia]?.plato_id && source[dia]?.tiene_guarnicion && !source[dia]?.guarnicion_id;
  const diaTienePedidoCompleto = (dia, source = selecciones) =>
    !!source[dia]?.plato_id && !diaNecesitaGuarnicion(dia, source);

  // Día efectivamente expandido: si undefined → auto al primer incompleto
  const primerIncompleto = diasConFechaYBloqueo.find(
    item => diaActivoParaPedido(item) && !diaTienePedidoCompleto(item.dia)
  )?.dia ?? null;
  const diaEfectivo = expandidoDia === undefined ? primerIncompleto : expandidoDia;

  const avanzarAlSiguiente = (diaActual, seleccionesActuales) => {
    const diasActivos = diasConFechaYBloqueo.filter(diaActivoParaPedido);
    const idx = diasActivos.findIndex(x => x.dia === diaActual);
    for (let i = idx + 1; i < diasActivos.length; i++) {
      if (!diaTienePedidoCompleto(diasActivos[i].dia, seleccionesActuales)) {
        setExpandidoDia(diasActivos[i].dia);
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
    setNoAsiste(prev => ({ ...prev, [dia]: !prev[dia] }));
    if (marcandoNoAsiste) {
      setSelecciones(prev => { const next = { ...prev }; delete next[dia]; return next; });
      // Si el día colapsado era este, avanzar
      if (diaEfectivo === dia) setExpandidoDia(null);
    }
  };

  const elegirPlato = (dia, plato, opcion = null) => {
    const seleccionActual = selecciones[dia];
    const mismoPlato = seleccionActual?.plato_id === plato.plato_id && seleccionActual?.opcion === opcion;
    const requiereGuarnicion = plato.tiene_guarnicion === true;
    const nuevasSel = {
      ...selecciones,
      [dia]: {
        plato_id: plato.plato_id,
        opcion,
        plato_nombre: plato.plato_nombre,
        tiene_guarnicion: requiereGuarnicion,
        guarnicion_id: requiereGuarnicion && mismoPlato ? seleccionActual?.guarnicion_id ?? null : null,
        notas: seleccionActual?.notas ?? '',
      },
    };
    setSelecciones(nuevasSel);
    if (requiereGuarnicion) {
      setExpandidoDia(dia);
    } else {
      avanzarAlSiguiente(dia, nuevasSel);
    }
  };

  const setGuarnicion = (dia, guarnicion_id) => {
    const nuevasSel = {
      ...selecciones,
      [dia]: { ...selecciones[dia], guarnicion_id: guarnicion_id ? parseInt(guarnicion_id) : null },
    };
    setSelecciones(nuevasSel);
    avanzarAlSiguiente(dia, nuevasSel);
  };

  const setNotas = (dia, notas) => {
    setSelecciones(prev => ({ ...prev, [dia]: { ...prev[dia], notas } }));
  };

  // Pedido anterior para "Repetir"
  const pedidoAnterior = historial
    .filter(p => p.estado !== 'cancelado' && p.semana_inicio !== semanaInicio)
    .sort((a, b) => new Date(b.semana_inicio) - new Date(a.semana_inicio))[0] ?? null;

  const aplicarPedidoAnterior = () => {
    if (!pedidoAnterior || !menu) return;
    const platosDisponibles = new Map();
    for (const p of (menu.fijos || [])) platosDisponibles.set(p.plato_id, p);
    for (const p of (menu.variables || [])) platosDisponibles.set(p.plato_id, p);

    let aplicados = 0;
    const nuevasSel = { ...selecciones };
    for (const item of (pedidoAnterior.items || [])) {
      const plato = platosDisponibles.get(item.plato_id);
      if (plato && !noAsiste[item.dia]) {
        nuevasSel[item.dia] = {
          plato_id: item.plato_id,
          opcion: item.opcion,
          plato_nombre: item.plato_nombre,
          tiene_guarnicion: item.tiene_guarnicion === true,
          guarnicion_id: item.guarnicion_id ?? null,
          notas: item.notas || '',
        };
        aplicados++;
      }
    }
    setSelecciones(nuevasSel);
    if (aplicados > 0) {
      toast.success(`${aplicados} día${aplicados !== 1 ? 's' : ''} pre-cargados del pedido anterior`);
      setExpandidoDia(null);
    } else {
      toast.warning('Los platos de la semana anterior no están en este menú');
    }
  };

  const mutation = useMutation({
    mutationFn: (data) => pedidoApi.guardar(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mi-pedido', empleado.id, semanaInicio] });
      setConfirmado(true);
      toast.success(tienePedidoGuardado ? 'Pedido actualizado. La cocina ya ve tus cambios.' : 'Pedido enviado. La cocina ya lo recibió.');
    },
    onError: (e) => toast.error(e?.message || 'Error al enviar el pedido'),
  });

  const mutationCancelar = useMutation({
    mutationFn: () => pedidoApi.cancelar(semanaInicio),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mi-pedido', empleado.id, semanaInicio] });
      setSelecciones({});
      setConfirmado(false);
      setExpandidoDia(undefined);
      toast.success('Pedido cancelado');
    },
    onError: (e) => toast.error(e?.message || 'Error al cancelar'),
  });

  const handleEnviar = async () => {
    const diasActivosLista = diasConFechaYBloqueo.filter(diaActivoParaPedido);
    const diasSinGuarnicion = diasActivosLista.filter(({ dia }) => diaNecesitaGuarnicion(dia));
    if (diasSinGuarnicion.length > 0) {
      setExpandidoDia(diasSinGuarnicion[0].dia);
      toast.warning(`Te falta elegir guarnición para ${DIAS_LABEL[diasSinGuarnicion[0].dia].toLowerCase()}.`);
      return;
    }

    const faltanDias = diasActivosLista.filter(({ dia }) => !selecciones[dia]?.plato_id).length;
    if (faltanDias > 0 && !await preguntarDiasIncompletos(faltanDias)) return;

    const items = diasSemana
      .filter(d => {
        const bloqueado = diasConFechaYBloqueo.find(x => x.dia === d)?.bloqueado;
        if (bloqueado) return !!selecciones[d]?.plato_id;
        return !!selecciones[d]?.plato_id && !noAsiste[d];
      })
      .map(d => ({
        dia: d,
        plato_id: selecciones[d].plato_id,
        opcion: selecciones[d].opcion || null,
        guarnicion_id: selecciones[d].guarnicion_id || null,
        notas: selecciones[d].notas || null,
      }));
    if (items.length === 0) return;
    const accion = tienePedidoGuardado ? 'Actualizar pedido' : 'Enviar pedido';
    const texto = tienePedidoGuardado
      ? `Vas a actualizar ${items.length} día${items.length !== 1 ? 's' : ''}. Los cambios recién se guardan al confirmar.`
      : `Vas a enviar ${items.length} día${items.length !== 1 ? 's' : ''}. Después vas a poder modificarlo mientras el plazo siga abierto.`;
    if (!await confirmar({
      titulo: `${accion}?`,
      texto,
      botonConfirmar: tienePedidoGuardado ? 'Sí, actualizar' : 'Sí, enviar',
      color: '#276749',
    })) return;
    mutation.mutate({ semana_inicio: semanaInicio, menu_semanal_id: menuSemana?.menu?.id || null, items });
  };

  // ── Pantallas de estado ───────────────────────────────────

  if (loadingMenu) {
    return <Pantalla><p style={{ textAlign: 'center', padding: 60, color: 'var(--subtexto)' }}>Cargando menú...</p></Pantalla>;
  }

  if (confirmado) {
    return (
      <Pantalla>
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: 'var(--verde)', marginBottom: 8 }}>¡Pedido enviado!</h2>
          <p style={{ color: 'var(--subtexto)', marginBottom: 4 }}>Semana del {formatFecha(semanaInicio)}</p>
          <p style={{ color: 'var(--subtexto)', fontSize: 14, marginBottom: 28 }}>
            {empleado.nombre} {empleado.apellido} — {empleado.empresa.nombre}
          </p>
          <div style={{ background: '#fff', borderRadius: 16, padding: 20, marginBottom: 24, textAlign: 'left' }}>
            {getDiasSemana(menuSemana?.dias_laborales).filter(d => selecciones[d]?.plato_id).map(d => (
              <div key={d} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--borde)' }}>
                <span style={{ fontWeight: 700, minWidth: 90, color: 'var(--verde)' }}>{DIAS_LABEL[d]}</span>
                <div>
                  <div style={{ fontWeight: 600 }}>{selecciones[d].plato_nombre}</div>
                  {selecciones[d].guarnicion_id && (
                    <div style={{ fontSize: 13, color: 'var(--subtexto)' }}>
                      + {guarniciones.find(g => g.id === selecciones[d].guarnicion_id)?.nombre}
                    </div>
                  )}
                  {selecciones[d].notas && (
                    <div style={{ fontSize: 12, color: 'var(--subtexto)', fontStyle: 'italic' }}>{selecciones[d].notas}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => { setConfirmado(false); setExpandidoDia(null); }} style={s.btnSecundario}>
            Modificar pedido
          </button>
          <button
            onClick={async () => {
              if (await confirmar({ titulo: '¿Cancelar el pedido?', texto: 'Se eliminará tu pedido de esta semana.', botonConfirmar: 'Sí, cancelar pedido' })) {
                mutationCancelar.mutate();
              }
            }}
            disabled={mutationCancelar.isPending}
            style={{ ...s.btnSecundario, color: '#c0392b', borderColor: '#e74c3c', marginTop: 8 }}
          >
            {mutationCancelar.isPending ? 'Cancelando...' : 'Cancelar pedido'}
          </button>
        </div>
      </Pantalla>
    );
  }

  // ── Pantalla sin menús publicados ───────────────────────────────────────────
  if (menusDisponibles.length === 0) {
    return (
      <Pantalla>
        <HeaderUsuario empleado={empleado} />
        <div style={sHome.heroCerrado}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>⏳</div>
          <h2 style={sHome.heroCerradoTitulo}>Menú no disponible</h2>
          <p style={sHome.heroCerradoSub}>El menú de esta semana aún no fue publicado. Volvé a revisar más tarde.</p>
        </div>
      </Pantalla>
    );
  }

  // Primera semana abierta para pedir (para el CTA de "pedir próxima")
  const proximaSemanaAbiertaIdx = menusDisponibles.findIndex(
    (m, i) => i !== semanaSelIdx && m.disponible && !m.limiteEmpresa?.vencido
  );

  // ── Semana seleccionada CERRADA por límite de empresa ────────────────────────
  if (menuSemana?.disponible && limiteEmpresaVencido) {
    const ORDEN_DIAS = ['lunes','martes','miercoles','jueves','viernes','sabado','domingo'];
    const itemsExistentes = (pedidoExistente?.items ?? [])
      .slice()
      .sort((a, b) => ORDEN_DIAS.indexOf(a.dia) - ORDEN_DIAS.indexOf(b.dia));
    const textoResumenLimite = construirTextoResumenLimite({ semanaInicio, limiteEmpresa: menuSemana.limiteEmpresa });

    return (
      <Pantalla>
        <HeaderUsuario empleado={empleado} />
        <SelectorSemana menus={menusDisponibles} selIdx={semanaSelIdx} onChange={setSemanaSelIdx} />

        {/* Hero: confirmado vs sin pedido */}
        {itemsExistentes.length > 0 ? (
          <div style={sHome.heroOk}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
              <span style={{ fontSize: 28 }}>✅</span>
              <div>
                <div style={sHome.heroOkTitulo}>Pedido confirmado</div>
                <div style={sHome.heroOkSub}>
                  {itemsExistentes.length} día{itemsExistentes.length !== 1 ? 's' : ''} · {textoResumenLimite}
                </div>
              </div>
            </div>
            <div style={sHome.diasResumen}>
              {itemsExistentes.map(item => (
                <div key={item.dia} style={sHome.diaFila}>
                  <span style={sHome.diaLabel}>{DIAS_LABEL[item.dia]}</span>
                  <div>
                    <div style={sHome.diaPlato}>{item.plato_nombre}</div>
                    {item.guarnicion_nombre && (
                      <div style={sHome.diaGuarnicion}>+ {item.guarnicion_nombre}</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={sHome.heroCerrado}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>😔</div>
            <h2 style={sHome.heroCerradoTitulo}>Sin pedido esta semana</h2>
            <p style={sHome.heroCerradoSub}>{textoResumenLimite}</p>
          </div>
        )}

        {/* CTA: pedir próxima semana disponible */}
        {proximaSemanaAbiertaIdx >= 0 && (
          <ProximaSemanaCard
            menu={menusDisponibles[proximaSemanaAbiertaIdx]}
            onIr={() => setSemanaSelIdx(proximaSemanaAbiertaIdx)}
          />
        )}
      </Pantalla>
    );
  }

  // ── Semana seleccionada CERRADA por límite del sistema ──────────────────────
  if (!menuSemana?.disponible) {
    return (
      <Pantalla>
        <HeaderUsuario empleado={empleado} />
        <SelectorSemana menus={menusDisponibles} selIdx={semanaSelIdx} onChange={setSemanaSelIdx} />
        <div style={sHome.heroCerrado}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🔒</div>
          <h2 style={sHome.heroCerradoTitulo}>Pedidos cerrados</h2>
          <p style={sHome.heroCerradoSub}>{menuSemana?.mensaje || 'Esta semana ya no acepta pedidos.'}</p>
        </div>
        {proximaSemanaAbiertaIdx >= 0 && (
          <ProximaSemanaCard
            menu={menusDisponibles[proximaSemanaAbiertaIdx]}
            onIr={() => setSemanaSelIdx(proximaSemanaAbiertaIdx)}
          />
        )}
      </Pantalla>
    );
  }

  const fechaLimite = menu.fecha_limite_pedidos ? new Date(menu.fecha_limite_pedidos) : null;
  const textoLimitePedido = construirTextoLimitePedido({ semanaInicio, fechaLimite, limiteEmpresa: menuSemana?.limiteEmpresa });

  const diasActivosLista = diasConFechaYBloqueo.filter(diaActivoParaPedido);
  const diasFaltanPlato = diasActivosLista.filter(({ dia }) => !selecciones[dia]?.plato_id);
  const diasFaltanGuarnicion = diasActivosLista.filter(({ dia }) => diaNecesitaGuarnicion(dia));
  const diasActivos = diasActivosLista.length;
  const diasCompletados = diasActivosLista.filter(({ dia }) => diaTienePedidoCompleto(dia)).length;
  const diasPendientes = diasFaltanPlato.length + diasFaltanGuarnicion.length;
  const detallePendientes = [
    diasFaltanPlato.length ? `Falta plato: ${diasFaltanPlato.map(({ dia }) => DIAS_LABEL[dia]).join(', ')}` : null,
    diasFaltanGuarnicion.length ? `Falta guarnición: ${diasFaltanGuarnicion.map(({ dia }) => DIAS_LABEL[dia]).join(', ')}` : null,
  ].filter(Boolean).join(' · ');
  const envioBloqueado = mutation.isPending || diasCompletados === 0 || diasFaltanGuarnicion.length > 0;
  const textoBotonEnviar = mutation.isPending
    ? 'Enviando...'
    : diasFaltanGuarnicion.length > 0
      ? 'Completar guarnición'
      : diasCompletados === 0
        ? 'Elegí al menos un plato'
        : tienePedidoGuardado ? 'Guardar cambios del pedido' : 'Confirmar pedido';

  return (
    <Pantalla>
      <HeaderUsuario empleado={empleado} />

      <SelectorSemana menus={menusDisponibles} selIdx={semanaSelIdx} onChange={setSemanaSelIdx} />

      {(fechaLimite || menuSemana?.limiteEmpresa) && (
        <div style={s.fechaLimiteChip}>
          ⏰ {textoLimitePedido}
        </div>
      )}

      <div style={s.estadoPedidoInfo}>
        <strong>{tienePedidoGuardado ? 'Ya tenés un pedido para esta semana' : 'Armá tu pedido semanal'}</strong>
        <span>
          {tienePedidoGuardado
            ? 'Podés editarlo mientras el plazo esté abierto. Los cambios se guardan recién al confirmar.'
            : 'Elegí plato por día. Si un plato requiere guarnición, ese día queda pendiente hasta completarla.'}
        </span>
      </div>

      {/* Botón: repetir semana anterior */}
      {pedidoAnterior && !tienePedidoGuardado && (
        <button onClick={aplicarPedidoAnterior} style={s.btnRepetir}>
          ↩ Repetir pedido semana anterior
        </button>
      )}

      <ResumenPedido
        dias={diasConFechaYBloqueo}
        selecciones={selecciones}
        guarniciones={guarniciones}
        diasSinServicio={diasSinServicio}
        noAsiste={noAsiste}
        onEditar={(dia) => setExpandidoDia(dia)}
      />

      {/* Stepper de progreso */}
      <StepperProgreso
        dias={diasConFechaYBloqueo}
        diasSinServicio={diasSinServicio}
        noAsiste={noAsiste}
        selecciones={selecciones}
        diaActivo={diaEfectivo}
        onDia={toggleExpandido}
      />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 160 }}>
        {diasConFechaYBloqueo.map(({ dia, fecha, bloqueado }) => (
          diasSinServicio.has(dia) ? (
            <div key={dia} style={{ ...s.diaCard, opacity: 0.6 }}>
              <div style={{ padding: '14px 16px' }}>
                <strong>{DIAS_LABEL[dia]}</strong>
                <span style={{ color: 'var(--subtexto)', fontSize: 13 }}> {formatFecha(fecha)}</span>
                <p style={{ marginTop: 6, color: 'var(--subtexto)', fontSize: 14 }}>
                  Sin servicio{diasSinServicio.get(dia) ? `: ${diasSinServicio.get(dia)}` : ''}
                </p>
              </div>
            </div>
          ) : (
            <DiaCard
              key={dia}
              dia={dia}
              fecha={fecha}
              bloqueado={bloqueado}
              bloqueadoTexto={menuSemana?.limiteEmpresa?.hora ? `Cerrado ${menuSemana.limiteEmpresa.hora}` : 'Plazo cerrado'}
              noAsiste={!!noAsiste[dia]}
              onToggleAsiste={() => toggleNoAsiste(dia)}
              variablesDia={(menu.variables || []).filter(p => p.dia === dia)}
              fijosDia={menu.fijos || []}
              seleccion={selecciones[dia]}
              guarniciones={guarniciones}
              onElegir={(plato, opcion) => elegirPlato(dia, plato, opcion)}
              onGuarnicion={(gId) => setGuarnicion(dia, gId)}
              onNotas={(n) => setNotas(dia, n)}
              expandido={diaEfectivo === dia}
              onToggleExpand={() => toggleExpandido(dia)}
              onAvanzar={() => avanzarAlSiguiente(dia, selecciones)}
            />
          )
        ))}
      </div>

      <div style={s.footer}>
        <StepperMini completados={diasCompletados} pendientes={diasPendientes} total={diasActivos} detalle={detallePendientes} />
        <button
          style={{ ...s.btnEnviar, opacity: envioBloqueado ? 0.55 : 1 }}
          onClick={handleEnviar}
          disabled={envioBloqueado}
        >
          {textoBotonEnviar}
        </button>
        {mutation.isError && (
          <p style={{ color: 'var(--error)', fontSize: 13, marginTop: 6, textAlign: 'center' }}>
            {mutation.error?.message || 'Error al enviar. Intentá de nuevo.'}
          </p>
        )}
      </div>
    </Pantalla>
  );
}

// ── Stepper de progreso ────────────────────────────────────────────────────────

function StepperProgreso({ dias, diasSinServicio, noAsiste, selecciones, diaActivo, onDia }) {
  return (
    <div style={sStep.wrap}>
      {dias.map(({ dia, bloqueado }) => {
        const sinServicio = diasSinServicio.has(dia);
        const ausente = !!noAsiste[dia];
        const faltaGuarnicion = !!selecciones[dia]?.plato_id && selecciones[dia]?.tiene_guarnicion && !selecciones[dia]?.guarnicion_id;
        const completado = !bloqueado && !sinServicio && !ausente && !!selecciones[dia]?.plato_id && !faltaGuarnicion;
        const activo = diaActivo === dia;
        const inactivo = bloqueado || sinServicio || ausente;

        return (
          <button
            key={dia}
            onClick={() => !inactivo && onDia(dia)}
            style={{
              ...sStep.chip,
              ...(completado ? sStep.chipOk : {}),
              ...(faltaGuarnicion ? sStep.chipWarning : {}),
              ...(activo && !completado ? sStep.chipActivo : {}),
              ...(inactivo ? sStep.chipInactivo : {}),
            }}
          >
            <span style={sStep.label}>{DIAS_LABEL[dia].slice(0, 3)}</span>
            <span style={sStep.icono}>
              {sinServicio ? '—' : ausente ? '✕' : bloqueado ? '🔒' : faltaGuarnicion ? '!' : completado ? '✓' : '·'}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function StepperMini({ completados, pendientes, total, detalle }) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 13, color: '#374151', fontWeight: 700, marginBottom: 7 }}>
        {pendientes === 0
          ? 'Pedido completo'
          : detalle || `Te falta completar ${pendientes} día${pendientes !== 1 ? 's' : ''}`}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
      <div style={{ display: 'flex', gap: 4 }}>
        {Array.from({ length: total }).map((_, i) => (
          <div
            key={i}
            style={{
              width: 28,
              height: 4,
              borderRadius: 2,
              background: i < completados ? 'var(--verde)' : '#e5e7eb',
              transition: 'background 0.2s',
            }}
          />
        ))}
      </div>
      <span style={{ fontSize: 12, color: 'var(--subtexto)', fontWeight: 600 }}>
        {completados}/{total}
      </span>
      </div>
    </div>
  );
}

// ── Resumen compacto (cuando hay pedido existente) ─────────────────────────────

function ResumenPedido({ dias, selecciones, guarniciones, diasSinServicio, noAsiste, onEditar }) {
  if (dias.length === 0) return null;

  const getEstado = ({ dia, bloqueado }) => {
    const seleccion = selecciones[dia];
    if (diasSinServicio.has(dia)) return { texto: 'Sin servicio', estilo: sRes.estadoNeutro, detalle: diasSinServicio.get(dia) || '' };
    if (bloqueado) return { texto: 'Cerrado', estilo: sRes.estadoNeutro, detalle: seleccion?.plato_nombre || 'Plazo cerrado' };
    if (noAsiste[dia]) return { texto: 'No necesitás vianda', estilo: sRes.estadoNeutro, detalle: 'Marcado por vos' };
    if (!seleccion?.plato_id) return { texto: 'Falta plato', estilo: sRes.estadoPendiente, detalle: 'Tocá para elegir' };
    if (seleccion.tiene_guarnicion && !seleccion.guarnicion_id) {
      return { texto: 'Falta guarnición', estilo: sRes.estadoWarning, detalle: seleccion.plato_nombre };
    }
    const guarnicion = guarniciones.find(g => g.id === seleccion.guarnicion_id)?.nombre;
    return { texto: 'Listo', estilo: sRes.estadoOk, detalle: guarnicion ? `${seleccion.plato_nombre} + ${guarnicion}` : seleccion.plato_nombre };
  };

  return (
    <div style={sRes.wrap}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--subtexto)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Resumen del pedido
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {dias.map(item => {
          const estado = getEstado(item);
          const editable = !item.bloqueado && !diasSinServicio.has(item.dia);
          return (
            <button
              key={item.dia}
              style={{ ...sRes.fila, ...(editable ? {} : sRes.filaInactiva) }}
              onClick={() => editable && onEditar(item.dia)}
              disabled={!editable}
            >
              <span style={sRes.dia}>{DIAS_LABEL[item.dia].slice(0, 3)}</span>
              <div style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{estado.texto}</div>
                {estado.detalle && (
                  <div style={sRes.detalle}>{estado.detalle}</div>
                )}
              </div>
              <span style={{ ...sRes.estado, ...estado.estilo }}>{editable ? 'editar' : 'info'}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Selector de semana ─────────────────────────────────────────────────────────

function SelectorSemana({ menus, selIdx, onChange }) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  return (
    <div style={s.selectorSemana}>
      {menus.map((m, i) => {
        const fecha = m.menu?.fecha_inicio?.split('T')[0];
        let rango = 'Sem.';
        let etiqueta = i === 0 ? 'Semana' : `Semana ${i + 1}`;
        if (fecha) {
          const [y, mo, d] = fecha.split('-').map(Number);
          const lunes = new Date(y, mo - 1, d);
          const domingo = new Date(y, mo - 1, d + 6);
          const esCurrent = hoy >= lunes && hoy <= domingo;
          rango = `${lunes.getDate()}/${lunes.getMonth() + 1}–${domingo.getDate()}/${domingo.getMonth() + 1}`;
          etiqueta = esCurrent ? 'Semana actual' : i === 1 ? 'Próxima semana' : `Semana ${i + 1}`;
        }
        const abierta = m.disponible && !m.limiteEmpresa?.vencido;
        const activo = selIdx === i;
        return (
          <button
            key={i}
            onClick={() => onChange(i)}
            style={{ ...s.selectorTab, ...(activo ? s.selectorTabActivo : {}) }}
          >
            <span style={{ display: 'block', fontSize: 11, marginBottom: 2 }}>
              {abierta ? '🟢 Abierta' : '🔒 Cerrada'}
            </span>
            <span style={{ display: 'block', fontSize: 13, fontWeight: 800 }}>
              {etiqueta}
            </span>
            <span style={{ display: 'block', fontSize: 11, fontWeight: 600, marginTop: 1, opacity: 0.8 }}>
              {rango}
            </span>
          </button>
        );
      })}
    </div>
  );
}

// ── HeaderUsuario ──────────────────────────────────────────────────────────────

function HeaderUsuario({ empleado }) {
  return (
    <div style={{ marginBottom: 16, paddingTop: 8 }}>
      <p style={{ fontSize: 13, color: 'var(--subtexto)', marginBottom: 2 }}>{empleado.empresa.nombre}</p>
      <h1 style={s.titulo}>Hola, {empleado.nombre} 👋</h1>
    </div>
  );
}

// ── ProximaSemanaCard ──────────────────────────────────────────────────────────

function ProximaSemanaCard({ menu, onIr }) {
  const fecha = menu?.menu?.fecha_inicio?.split('T')[0];
  let rango = '';
  if (fecha) {
    const [y, m, d] = fecha.split('-').map(Number);
    const lunes = new Date(y, m - 1, d);
    const viernes = new Date(y, m - 1, d + 4);
    rango = `${lunes.getDate()}/${lunes.getMonth() + 1} al ${viernes.getDate()}/${viernes.getMonth() + 1}`;
  }
  return (
    <button onClick={onIr} style={sHome.ctaProxima}>
      <div style={{ flex: 1, textAlign: 'left' }}>
        <div style={sHome.ctaProximaTitulo}>📅 Pedir próxima semana</div>
        <div style={sHome.ctaProximaSub}>Semana del {rango} · Abierta</div>
      </div>
      <span style={sHome.ctaProximaArrow}>→</span>
    </button>
  );
}

// ── DiaCard ────────────────────────────────────────────────────────────────────

function DiaCard({
  dia, fecha, variablesDia, fijosDia, seleccion, guarniciones,
  onElegir, onGuarnicion, onNotas,
  bloqueado, bloqueadoTexto, noAsiste, onToggleAsiste,
  expandido, onToggleExpand,
}) {
  const [mostrarNota, setMostrarNota] = useState(false);

  if (bloqueado) {
    return (
      <div style={{ ...s.diaCard, opacity: 0.5, background: '#f9f9f9' }}>
        <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontWeight: 700, fontSize: 16 }}>{DIAS_LABEL[dia]}</span>
            <span style={{ color: 'var(--subtexto)', fontSize: 13 }}> {formatFecha(fecha)}</span>
            {seleccion?.plato_id && (
              <p style={{ fontSize: 13, color: '#555', marginTop: 4 }}>✓ {seleccion.plato_nombre}</p>
            )}
          </div>
          <span style={{ fontSize: 12, color: 'var(--subtexto)', background: '#eee', borderRadius: 8, padding: '4px 9px' }}>
            🔒 {bloqueadoTexto}
          </span>
        </div>
      </div>
    );
  }

  if (noAsiste) {
    return (
      <div style={{ ...s.diaCard, background: '#fff5f5', borderColor: '#fecaca' }}>
        <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontWeight: 700, fontSize: 17 }}>{DIAS_LABEL[dia]}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#dc2626', background: '#fee2e2', borderRadius: 20, padding: '2px 10px' }}>
                No necesitás vianda
              </span>
            </div>
            <span style={{ color: '#9ca3af', fontSize: 13 }}>{formatFecha(fecha)}</span>
          </div>
          <button onClick={onToggleAsiste} style={s.chipVerde}>Pedir vianda este día</button>
        </div>
      </div>
    );
  }

  const platosOrdenados = [
    ...variablesDia.map(p => ({ ...p, esEspecial: true })),
    ...fijosDia.map(p => ({ ...p, esEspecial: false })),
  ];

  const hayGuarnicionPendiente = seleccion?.plato_id && seleccion?.tiene_guarnicion && !seleccion?.guarnicion_id;

  return (
    <div style={{
      ...s.diaCard,
      ...(seleccion?.plato_id && !hayGuarnicionPendiente ? { borderColor: 'var(--verde)' } : {}),
      ...(hayGuarnicionPendiente ? { borderColor: '#f59e0b' } : {}),
    }}>
      <button style={s.diaHeader} onClick={onToggleExpand}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 17 }}>{DIAS_LABEL[dia]}</span>
            <span style={{ color: 'var(--subtexto)', fontSize: 14 }}>{formatFecha(fecha)}</span>
          </div>
          {seleccion?.plato_id && (
            <span style={hayGuarnicionPendiente ? s.selBadgeWarning : s.selBadge}>
              {hayGuarnicionPendiente ? '⚠ Elegí la guarnición' : `✓ ${(seleccion.plato_nombre?.length ?? 0) > 22 ? seleccion.plato_nombre.slice(0, 22) + '…' : (seleccion.plato_nombre ?? '')}`}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <button
            onClick={(e) => { e.stopPropagation(); onToggleAsiste(); }}
            style={s.chipNoVoy}
          >
            ✕ No necesito
          </button>
          <span style={{ color: 'var(--subtexto)', fontSize: 18 }}>{expandido ? '▲' : '▼'}</span>
        </div>
      </button>

      {expandido && (
        <div style={{ padding: '0 14px 14px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {platosOrdenados.length === 0 ? (
              <p style={{ color: 'var(--subtexto)', fontSize: 14, padding: '8px 0' }}>No hay platos disponibles para este día.</p>
            ) : (
              platosOrdenados.map((p, i) => {
                const key = p.esEspecial ? `esp-${p.opcion ?? i}` : `fijo-${p.plato_id}`;
                const sepAntes = !p.esEspecial && i > 0 && platosOrdenados[i - 1]?.esEspecial;
                const esteSeleccionado = seleccion?.plato_id === p.plato_id && seleccion?.opcion === (p.esEspecial ? (p.opcion ?? null) : null);
                return (
                  <div key={key}>
                    {sepAntes && variablesDia.length > 0 && (
                      <div style={s.separadorFijos}>
                        <span style={s.separadorTexto}>Platos fijos</span>
                      </div>
                    )}
                    <OpcionBtn
                      plato={p}
                      badge={p.esEspecial ? `Opción ${p.opcion ?? ''}`.trim() : null}
                      seleccionado={esteSeleccionado}
                      guarnicionId={esteSeleccionado ? seleccion?.guarnicion_id : null}
                      guarniciones={p.tiene_guarnicion ? guarniciones : []}
                      onElegir={() => onElegir(p, p.esEspecial ? (p.opcion ?? null) : null)}
                      onGuarnicion={(gId) => onGuarnicion(gId)}
                    />
                  </div>
                );
              })
            )}
          </div>

          {/* Nota opcional */}
          {seleccion?.plato_id && (
            <div style={{ marginTop: 12 }}>
              {!mostrarNota && !seleccion.notas ? (
                <button
                  onClick={() => setMostrarNota(true)}
                  style={{ fontSize: 14, color: 'var(--subtexto)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                >
                  + Agregar nota (sin sal, sin cebolla…)
                </button>
              ) : (
                <input
                  autoFocus={mostrarNota && !seleccion.notas}
                  style={s.inputNotas}
                  value={seleccion.notas || ''}
                  onChange={e => onNotas(e.target.value)}
                  placeholder="Sin sal, sin cebolla..."
                />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function OpcionBtn({ plato, badge, seleccionado, guarnicionId, guarniciones, onElegir, onGuarnicion }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      <button
        style={{
          ...s.opcionBtn,
          ...(seleccionado ? { borderColor: 'var(--verde)', background: 'var(--verde-bg)', borderBottomLeftRadius: seleccionado && plato.tiene_guarnicion ? 0 : undefined, borderBottomRightRadius: seleccionado && plato.tiene_guarnicion ? 0 : undefined, borderBottom: seleccionado && plato.tiene_guarnicion ? 'none' : undefined } : {}),
        }}
        onClick={onElegir}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {badge && <span style={s.badge}>{badge}</span>}
          <span style={{ fontWeight: 600, fontSize: 16 }}>{plato.plato_nombre}</span>
        </div>
        {!seleccionado && plato.tiene_guarnicion && (
          <span style={{ fontSize: 13, color: 'var(--subtexto)', fontStyle: 'italic' }}>Requiere guarnición</span>
        )}
      </button>

      {/* Chips de guarnición inline — solo cuando este plato está seleccionado */}
      {seleccionado && plato.tiene_guarnicion && (
        <div style={sG.panel}>
          <span style={sG.label}>Elegí una guarnición para completar este día</span>
          {!guarnicionId && (
            <p style={sG.help}>Este plato necesita una guarnición antes de confirmar el pedido.</p>
          )}
          <div style={sG.chips}>
            {guarniciones.map(g => (
              <button
                key={g.id}
                style={{ ...sG.chip, ...(guarnicionId === g.id ? sG.chipSel : {}) }}
                onClick={() => onGuarnicion(g.id)}
              >
                {g.nombre}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Pantalla({ children }) {
  return <div style={{ maxWidth: 560, margin: '0 auto', padding: '16px 14px 74px' }}>{children}</div>;
}

// ── Estilos ────────────────────────────────────────────────────────────────────

const sStep = {
  wrap:        { display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto', paddingBottom: 2 },
  chip:        { flex: 1, minWidth: 48, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '7px 4px', borderRadius: 10, border: '1.5px solid var(--borde)', background: '#fff', cursor: 'pointer' },
  chipOk:      { border: '1.5px solid var(--verde)', background: 'var(--verde-bg)' },
  chipWarning: { border: '1.5px solid #f59e0b', background: '#fffbeb' },
  chipActivo:  { border: '1.5px solid var(--verde)', background: '#fff', boxShadow: '0 0 0 2px var(--verde-bg)' },
  chipInactivo:{ opacity: 0.4, cursor: 'default' },
  label:       { fontSize: 12, fontWeight: 700, color: '#374151' },
  icono:       { fontSize: 14, color: 'var(--verde)', fontWeight: 700 },
};

const sRes = {
  wrap:  { background: '#fff', borderRadius: 14, border: '1.5px solid var(--borde)', padding: '14px', marginBottom: 14 },
  fila:  { display: 'flex', alignItems: 'center', gap: 10, width: '100%', background: 'none', border: 'none', padding: '7px 0', borderBottom: '1px solid var(--borde)', cursor: 'pointer', textAlign: 'left' },
  filaInactiva: { cursor: 'default', opacity: 0.72 },
  dia:   { fontSize: 14, fontWeight: 700, color: 'var(--verde)', minWidth: 36 },
  detalle: { fontSize: 12, color: 'var(--subtexto)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  estado: { fontSize: 12, borderRadius: 20, padding: '3px 8px', fontWeight: 800, whiteSpace: 'nowrap' },
  estadoOk: { background: 'var(--verde-bg)', color: 'var(--verde)' },
  estadoWarning: { background: '#fef3c7', color: '#92400e' },
  estadoPendiente: { background: '#eff6ff', color: '#1d4ed8' },
  estadoNeutro: { background: '#f1f5f9', color: '#64748b' },
};

const s = {
  titulo:           { fontSize: 24, fontWeight: 800, color: 'var(--verde)', margin: '2px 0 4px' },
  selectorSemana:   { display: 'flex', gap: 6, marginBottom: 16, background: '#f1f5f9', borderRadius: 14, padding: 5 },
  selectorTab:      { flex: 1, padding: '8px 4px', borderRadius: 10, border: 'none', background: 'transparent', color: 'var(--subtexto)', cursor: 'pointer', textAlign: 'center' },
  selectorTabActivo:{ background: '#fff', color: 'var(--verde)', boxShadow: '0 1px 6px rgba(0,0,0,0.10)' },
  fechaLimiteChip:  { display: 'block', background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 10, padding: '9px 13px', fontSize: 14, color: '#7a5800', marginBottom: 12 },
  btnRepetir:       { display: 'flex', alignItems: 'center', gap: 6, width: '100%', background: '#f0fdf4', border: '1.5px solid #bbf7d0', borderRadius: 12, padding: '12px 16px', fontSize: 15, fontWeight: 700, color: '#166534', cursor: 'pointer', marginBottom: 14 },
  estadoBanner:     { textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: 16, margin: '24px 0' },
  diaCard:          { background: '#fff', borderRadius: 14, border: '2px solid var(--borde)', overflow: 'hidden' },
  diaHeader:        { width: '100%', background: 'none', border: 'none', padding: '14px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left', cursor: 'pointer', gap: 8 },
  selBadge:         { display: 'inline-block', fontSize: 13, background: 'var(--verde-bg)', color: 'var(--verde)', padding: '3px 10px', borderRadius: 20, fontWeight: 600 },
  selBadgeWarning:  { display: 'inline-block', fontSize: 13, background: '#fef3c7', color: '#92400e', padding: '3px 10px', borderRadius: 20, fontWeight: 700 },
  chipVerde:        { fontSize: 14, color: 'var(--verde)', background: 'var(--verde-bg)', border: '1.5px solid var(--verde)', borderRadius: 20, padding: '7px 14px', cursor: 'pointer', fontWeight: 700, flexShrink: 0 },
  estadoPedidoInfo: { display: 'flex', flexDirection: 'column', gap: 3, background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 12, padding: '11px 13px', fontSize: 13, color: '#475569', marginBottom: 12, lineHeight: 1.35 },
  chipNoVoy:        { fontSize: 13, color: '#b91c1c', background: '#fff5f5', border: '1.5px solid #fecaca', borderRadius: 20, padding: '8px 13px', minHeight: 36, cursor: 'pointer', fontWeight: 700, flexShrink: 0 },
  separadorFijos:   { display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0 10px' },
  separadorTexto:   { fontSize: 12, fontWeight: 700, color: 'var(--subtexto)', textTransform: 'uppercase', letterSpacing: 0.5, background: '#f8fafc', padding: '3px 10px', borderRadius: 6 },
  opcionBtn:        { display: 'flex', flexDirection: 'column', gap: 4, padding: '14px 14px', minHeight: 52, borderRadius: 10, border: '1.5px solid var(--borde)', background: '#fff', textAlign: 'left', width: '100%', cursor: 'pointer' },
  badge:            { fontSize: 12, background: 'var(--verde)', color: '#fff', padding: '3px 9px', borderRadius: 20, fontWeight: 700, whiteSpace: 'nowrap' },
  inputNotas:       { width: '100%', padding: '10px 13px', borderRadius: 9, border: '1.5px solid var(--borde)', fontSize: 15, boxSizing: 'border-box' },
  footer:           { position: 'fixed', bottom: 60, left: 0, right: 0, background: '#fff', borderTop: '1px solid var(--borde)', padding: '10px 20px calc(12px + env(safe-area-inset-bottom))', textAlign: 'center', zIndex: 10, boxShadow: '0 -8px 24px rgba(15,23,42,0.06)' },
  btnEnviar:        { background: 'var(--verde)', color: '#fff', border: 'none', borderRadius: 12, padding: '14px 32px', fontSize: 17, fontWeight: 700, width: '100%', maxWidth: 400, cursor: 'pointer' },
  btnSecundario:    { background: '#fff', color: 'var(--verde)', border: '2px solid var(--verde)', borderRadius: 12, padding: '12px 24px', fontSize: 16, fontWeight: 700, cursor: 'pointer' },
};

const sHome = {
  heroOk:           { background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', border: '2px solid #86efac', borderRadius: 18, padding: '18px 18px 14px', marginBottom: 14 },
  heroOkTitulo:     { fontSize: 18, fontWeight: 800, color: '#15803d', lineHeight: 1.2 },
  heroOkSub:        { fontSize: 13, marginTop: 2, color: '#166534' },
  diasResumen:      { marginTop: 14, display: 'flex', flexDirection: 'column', gap: 0, borderTop: '1px solid #bbf7d0', paddingTop: 12 },
  diaFila:          { display: 'flex', gap: 12, padding: '9px 0', borderBottom: '1px solid #dcfce7', alignItems: 'flex-start' },
  diaLabel:         { fontWeight: 700, fontSize: 14, color: '#15803d', minWidth: 72, flexShrink: 0 },
  diaPlato:         { fontWeight: 600, fontSize: 15, color: '#1a1a1a' },
  diaGuarnicion:    { fontSize: 13, color: '#4b7c5a', marginTop: 1 },
  heroCerrado:      { background: '#f8fafc', border: '2px solid #e2e8f0', borderRadius: 18, padding: '32px 20px', textAlign: 'center', marginBottom: 14 },
  heroCerradoTitulo:{ fontSize: 19, fontWeight: 800, color: '#1a1a1a', marginBottom: 8 },
  heroCerradoSub:   { fontSize: 14, color: 'var(--subtexto)', maxWidth: 280, margin: '0 auto' },
  ctaProxima:       { display: 'flex', alignItems: 'center', gap: 12, width: '100%', background: 'var(--verde)', borderRadius: 16, padding: '16px 18px', border: 'none', cursor: 'pointer', marginBottom: 16, boxShadow: '0 4px 12px rgba(39,103,73,0.25)' },
  ctaProximaTitulo: { fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 2 },
  ctaProximaSub:    { fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  ctaProximaArrow:  { fontSize: 22, color: '#fff', fontWeight: 700 },
};

const sG = {
  panel:   { background: 'var(--verde-bg)', border: '1.5px solid var(--verde)', borderTop: 'none', borderRadius: '0 0 10px 10px', padding: '10px 14px 12px' },
  label:   { display: 'block', fontSize: 12, fontWeight: 700, color: 'var(--verde)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.4 },
  help:    { margin: '-2px 0 10px', color: '#7a5800', fontSize: 13, lineHeight: 1.35 },
  chips:   { display: 'flex', flexWrap: 'wrap', gap: 8 },
  chip:    { padding: '8px 16px', borderRadius: 20, border: '1.5px solid #c3dfc0', background: '#fff', fontSize: 15, fontWeight: 500, color: '#374151', cursor: 'pointer' },
  chipSel: { background: 'var(--verde)', color: '#fff', border: '1.5px solid var(--verde)', fontWeight: 700 },
};
