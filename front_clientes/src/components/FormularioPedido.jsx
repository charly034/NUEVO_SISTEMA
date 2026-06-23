import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { menuApi, pedidoApi, guarnicionesApi } from '../api.js';
import { DIAS_LABEL, getDiasSemana, formatFecha, addDias } from '../utils.js';
import { toast, confirmar, preguntarDiasIncompletos } from '../lib/swal.js';

export default function FormularioPedido({ empleado }) {
  const queryClient = useQueryClient();

  // Índice de la semana seleccionada (0 = esta semana, 1 = próxima semana)
  const [semanaSelIdx, setSemanaSelIdx] = useState(0);

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

  const [selecciones, setSelecciones] = useState({});
  const [confirmado, setConfirmado] = useState(false);
  const [noAsiste, setNoAsiste] = useState({});

  // Calcular defaults de noAsiste según días laborales
  function defaultNoAsiste(diasLaborales) {
    if (diasLaborales === 'lunes_sabado') return { sabado: true };
    if (diasLaborales === 'lunes_domingo') return { sabado: true, domingo: true };
    return {};
  }

  // Resetear todo al cambiar de semana
  useEffect(() => {
    const timer = setTimeout(() => {
      setSelecciones({});
      setConfirmado(false);
      setNoAsiste(defaultNoAsiste(menuSemana?.dias_laborales));
    }, 0);
    return () => clearTimeout(timer);
  }, [semanaSelIdx, menuSemana?.menu?.id, menuSemana?.dias_laborales]);

  // Cargar pedido existente — si tiene ítem en un día, ese día se trabaja
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
        trabajaDias[item.dia] = false; // tiene pedido → sí asiste
      }
      const timer = setTimeout(() => {
        setSelecciones(map);
        setNoAsiste(prev => ({ ...prev, ...trabajaDias }));
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [pedidoExistente]);

  const toggleNoAsiste = (dia) => {
    setNoAsiste(prev => ({ ...prev, [dia]: !prev[dia] }));
    if (!noAsiste[dia]) {
      // Al marcar "no asiste", limpiar selección del día
      setSelecciones(prev => { const next = { ...prev }; delete next[dia]; return next; });
    }
  };

  const mutation = useMutation({
    mutationFn: (data) => pedidoApi.guardar(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mi-pedido', empleado.id, semanaInicio] });
      setConfirmado(true);
      toast.success('¡Pedido enviado correctamente!');
    },
    onError: (e) => toast.error(e?.message || 'Error al enviar el pedido'),
  });

  const mutationCancelar = useMutation({
    mutationFn: () => pedidoApi.cancelar(semanaInicio),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mi-pedido', empleado.id, semanaInicio] });
      setSelecciones({});
      setConfirmado(false);
      toast.success('Pedido cancelado');
    },
    onError: (e) => toast.error(e?.message || 'Error al cancelar'),
  });

  const elegirPlato = (dia, plato, opcion = null) => {
    setSelecciones(prev => ({
      ...prev,
      [dia]: {
        plato_id: plato.plato_id,
        opcion,
        plato_nombre: plato.plato_nombre,
        tiene_guarnicion: plato.tiene_guarnicion,
        guarnicion_id: prev[dia]?.guarnicion_id ?? null,
        notas: prev[dia]?.notas ?? '',
      },
    }));
  };

  const setGuarnicion = (dia, guarnicion_id) => {
    setSelecciones(prev => ({ ...prev, [dia]: { ...prev[dia], guarnicion_id: parseInt(guarnicion_id) || null } }));
  };

  const setNotas = (dia, notas) => {
    setSelecciones(prev => ({ ...prev, [dia]: { ...prev[dia], notas } }));
  };

  const diasSemana = getDiasSemana(menuSemana?.dias_laborales);
  const diasCerrados = new Set(menuSemana?.limiteEmpresa?.diasCerrados ?? []);

  const diasConFechaYBloqueo = semanaInicio
    ? diasSemana.map((dia, i) => {
        const fecha = addDias(semanaInicio, i);
        return { dia, fecha, bloqueado: diasCerrados.has(dia) };
      })
    : [];

  // handleEnviar accede a diasSinServicio y diasConFechaYBloqueo vía closure —
  // funciona correctamente porque se llama desde un click (después del render completo)
  const handleEnviar = async (diasSinServicio) => {
    const faltanDias = diasConFechaYBloqueo.filter(
      ({ dia, bloqueado }) => !bloqueado && !diasSinServicio.has(dia) && !noAsiste[dia] && !selecciones[dia]?.plato_id
    ).length;
    if (faltanDias > 0 && !await preguntarDiasIncompletos(faltanDias)) return;

    const items = diasSemana
      .filter(d => {
        const bloqueado = diasConFechaYBloqueo.find(x => x.dia === d)?.bloqueado;
        if (bloqueado) return !!selecciones[d]?.plato_id; // preservar bloqueados con selección
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
    mutation.mutate({
      semana_inicio: semanaInicio,
      menu_semanal_id: menuSemana?.menu?.id || null,
      items,
    });
  };

  // ── Pantallas de estado ───────────────────────────────────────────

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
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => setConfirmado(false)} style={s.btnSecundario}>Modificar pedido</button>
          <button
            onClick={async () => {
              if (await confirmar({ titulo: '¿Cancelar el pedido?', texto: 'Se eliminará tu pedido de esta semana. Esta acción no se puede deshacer.', botonConfirmar: 'Sí, cancelar pedido' })) {
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

  // Sin menús publicados
  if (menusDisponibles.length === 0) {
    return (
      <Pantalla>
        <HeaderUsuario empleado={empleado} semanaInicio={null} />
        <div style={s.estadoBanner}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>⏳</div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a', marginBottom: 6 }}>Menú no disponible</h2>
          <p style={{ color: 'var(--subtexto)', fontSize: 14, maxWidth: 300, margin: '0 auto' }}>
            El menú de esta semana aún no está disponible.
          </p>
        </div>
      </Pantalla>
    );
  }

  // Menú publicado pero límite de empresa vencido
  if (menuSemana?.disponible && limiteEmpresaVencido) {
    const itemsExistentes = pedidoExistente?.items ?? [];
    return (
      <Pantalla>
        <HeaderUsuario empleado={empleado} semanaInicio={semanaInicio} />
        {menusDisponibles.length > 1 && (
          <SelectorSemana menus={menusDisponibles} selIdx={semanaSelIdx} onChange={setSemanaSelIdx} />
        )}
        <div style={s.estadoBanner}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a', marginBottom: 6 }}>Plazo de pedido cerrado</h2>
          <p style={{ color: 'var(--subtexto)', fontSize: 14, maxWidth: 300, margin: '0 auto' }}>
            {menuSemana.limiteEmpresa.texto}
          </p>
        </div>
        {itemsExistentes.length > 0 && (
          <div style={{ background: '#fff', borderRadius: 16, padding: 20, margin: '0 0 24px' }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--subtexto)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: 1 }}>
              Tu pedido de esta semana
            </p>
            {itemsExistentes.map(item => (
              <div key={item.dia} style={{ display: 'flex', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--borde)' }}>
                <span style={{ fontWeight: 700, minWidth: 90, color: 'var(--verde)' }}>{DIAS_LABEL[item.dia]}</span>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{item.plato_nombre}</div>
                  {item.guarnicion_nombre && (
                    <div style={{ fontSize: 13, color: 'var(--subtexto)' }}>+ {item.guarnicion_nombre}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Pantalla>
    );
  }

  // Menú no disponible (límite del sistema vencido)
  if (!menuSemana?.disponible) {
    return (
      <Pantalla>
        <HeaderUsuario empleado={empleado} semanaInicio={semanaInicio} />
        {menusDisponibles.length > 1 && (
          <SelectorSemana menus={menusDisponibles} selIdx={semanaSelIdx} onChange={setSemanaSelIdx} />
        )}
        <div style={s.estadoBanner}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🔒</div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1a1a1a', marginBottom: 6 }}>Pedidos cerrados</h2>
          <p style={{ color: 'var(--subtexto)', fontSize: 14, maxWidth: 300, margin: '0 auto' }}>
            {menuSemana?.mensaje}
          </p>
        </div>
      </Pantalla>
    );
  }

  const menu = menuSemana.menu;
  const diasSinServicio = new Map((menu.sin_servicio || []).map(item => [item.dia, item.motivo]));
  const fechaLimite = menu.fecha_limite_pedidos ? new Date(menu.fecha_limite_pedidos) : null;

  const diasActivos = diasConFechaYBloqueo.filter(
    ({ dia, bloqueado }) => !bloqueado && !diasSinServicio.has(dia) && !noAsiste[dia]
  ).length;
  const diasCompletados = diasConFechaYBloqueo.filter(
    ({ dia, bloqueado }) => !bloqueado && !diasSinServicio.has(dia) && !noAsiste[dia] && selecciones[dia]?.plato_id
  ).length;

  return (
    <Pantalla>
      <HeaderUsuario empleado={empleado} semanaInicio={semanaInicio} />

      {/* Selector de semana cuando hay múltiples menús publicados */}
      {menusDisponibles.length > 1 && (
        <SelectorSemana menus={menusDisponibles} selIdx={semanaSelIdx} onChange={setSemanaSelIdx} />
      )}

      {/* Info de la semana y fecha límite */}
      <div style={s.infoSemana}>
        <span style={{ fontWeight: 700, color: 'var(--verde)' }}>{menu.nombre}</span>
        {fechaLimite && (
          <span style={s.fechaLimiteChip}>
            ⏰ Pedidos hasta el {fechaLimite.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })} {fechaLimite.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
        {!fechaLimite && menuSemana?.limiteEmpresa && (
          <span style={s.fechaLimiteChip}>⏰ {menuSemana.limiteEmpresa.texto}</span>
        )}
      </div>

      {pedidoExistente && (
        <div style={s.avisoExistente}>📋 Ya tenés un pedido esta semana. Podés modificarlo.</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingBottom: 180 }}>
        {diasConFechaYBloqueo.map(({ dia, fecha, bloqueado }) => (
          diasSinServicio.has(dia) ? (
            <div key={dia} style={s.diaCard}>
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
              bloqueadoTexto={menuSemana?.limiteEmpresa?.hora
                ? `Cerrado ${menuSemana.limiteEmpresa.hora}`
                : 'Plazo cerrado'}
              noAsiste={!!noAsiste[dia]}
              onToggleAsiste={() => toggleNoAsiste(dia)}
              variablesDia={(menu.variables || []).filter(p => p.dia === dia)}
              fijosDia={menu.fijos || []}
              seleccion={selecciones[dia]}
              guarniciones={guarniciones}
              onElegir={(plato, opcion) => elegirPlato(dia, plato, opcion)}
              onGuarnicion={(gId) => setGuarnicion(dia, gId)}
              onNotas={(n) => setNotas(dia, n)}
            />
          )
        ))}
      </div>

      <div style={s.footer}>
        <p style={{ fontSize: 13, color: 'var(--subtexto)', marginBottom: 8 }}>
          {diasCompletados} de {diasActivos} días completados
        </p>
        <button
          style={{ ...s.btnEnviar, opacity: diasCompletados === 0 ? 0.5 : 1 }}
          onClick={() => handleEnviar(diasSinServicio)}
          disabled={mutation.isPending || diasCompletados === 0}
        >
          {mutation.isPending ? 'Enviando...' : pedidoExistente ? 'Actualizar pedido' : 'Enviar pedido'}
        </button>
        {mutation.isError && (
          <p style={{ color: 'var(--error)', fontSize: 13, marginTop: 8, textAlign: 'center' }}>
            {mutation.error?.message || 'Error al enviar. Intentá de nuevo.'}
          </p>
        )}
      </div>
    </Pantalla>
  );
}

// ── Selector de semana ─────────────────────────────────────────────────────────

function SelectorSemana({ menus, selIdx, onChange }) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const etiquetas = menus.map((m) => {
    const fecha = m.menu?.fecha_inicio?.split('T')[0];
    if (!fecha) return 'Semana';
    const [y, mo, d] = fecha.split('-').map(Number);
    const lunes = new Date(y, mo - 1, d);
    const domingo = new Date(y, mo - 1, d + 6);
    const esCurrent = hoy >= lunes && hoy <= domingo;
    const rango = `${lunes.getDate()}/${lunes.getMonth() + 1} – ${domingo.getDate()}/${domingo.getMonth() + 1}`;
    return esCurrent ? `Esta semana\n${rango}` : rango;
  });

  return (
    <div style={s.selectorSemana}>
      {menus.map((_, i) => (
        <button
          key={i}
          style={{ ...s.selectorTab, ...(selIdx === i ? s.selectorTabActivo : {}) }}
          onClick={() => onChange(i)}
        >
          {etiquetas[i].split('\n').map((linea, j) => (
            <span key={j} style={{ display: 'block', fontSize: j === 0 ? 13 : 11, opacity: j === 1 ? 0.75 : 1 }}>
              {linea}
            </span>
          ))}
        </button>
      ))}
    </div>
  );
}

// ── Sub-componentes ────────────────────────────────────────────────────────────

function HeaderUsuario({ empleado, semanaInicio }) {
  return (
    <div style={{ marginBottom: 16, paddingTop: 8 }}>
      <p style={{ fontSize: 13, color: 'var(--subtexto)' }}>{empleado.empresa.nombre}</p>
      <h1 style={s.titulo}>Hola, {empleado.nombre} 👋</h1>
      {semanaInicio && (
        <p style={{ color: 'var(--subtexto)', fontSize: 14 }}>
          Semana del {formatFecha(semanaInicio)}
        </p>
      )}
    </div>
  );
}

function DiaCard({ dia, fecha, variablesDia, fijosDia, seleccion, guarniciones, onElegir, onGuarnicion, onNotas, bloqueado, bloqueadoTexto, noAsiste, onToggleAsiste }) {
  const [expandido, setExpandido] = useState(!seleccion?.plato_id);
  const [seccion, setSeccion] = useState('especiales');

  if (bloqueado) {
    return (
      <div style={{ ...s.diaCard, opacity: 0.55, background: '#f9f9f9' }}>
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
      <div style={{ ...s.diaCard, opacity: 0.6, background: '#fafafa' }}>
        <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <span style={{ fontWeight: 700, fontSize: 16 }}>{DIAS_LABEL[dia]}</span>
            <span style={{ color: 'var(--subtexto)', fontSize: 13 }}> {formatFecha(fecha)}</span>
            <p style={{ fontSize: 12, color: 'var(--subtexto)', marginTop: 3 }}>No trabajo este día</p>
          </div>
          <button
            onClick={onToggleAsiste}
            style={{ fontSize: 12, color: 'var(--verde)', background: 'var(--verde-bg)', border: 'none', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', fontWeight: 600 }}
          >
            Sí voy a ir
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...s.diaCard, ...(seleccion?.plato_id ? { borderColor: 'var(--verde)' } : {}) }}>
      <button style={s.diaHeader} onClick={() => setExpandido(e => !e)}>
        <div>
          <span style={{ fontWeight: 700, fontSize: 16 }}>{DIAS_LABEL[dia]}</span>
          <span style={{ color: 'var(--subtexto)', fontSize: 13 }}> {formatFecha(fecha)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {seleccion?.plato_id && (
            <span style={s.selBadge}>
              ✓ {(seleccion.plato_nombre?.length ?? 0) > 22 ? seleccion.plato_nombre.slice(0, 22) + '…' : (seleccion.plato_nombre ?? '')}
            </span>
          )}
          <span style={{ color: 'var(--subtexto)', fontSize: 18 }}>{expandido ? '▲' : '▼'}</span>
        </div>
      </button>

      {expandido && (
        <div style={{ padding: '0 16px 16px' }}>
          <div style={s.tabs}>
            <button
              style={{ ...s.tab, ...(seccion === 'especiales' ? s.tabActivo : {}) }}
              onClick={() => setSeccion('especiales')}
            >Especiales del día</button>
            <button
              style={{ ...s.tab, ...(seccion === 'fijos' ? s.tabActivo : {}) }}
              onClick={() => setSeccion('fijos')}
            >Fijos</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {seccion === 'especiales' ? (
              variablesDia.length > 0
                ? variablesDia.map(p => (
                  <OpcionBtn
                    key={p.opcion}
                    plato={p}
                    badge={`Opción ${p.opcion}`}
                    seleccionado={seleccion?.plato_id === p.plato_id}
                    onElegir={() => onElegir(p, p.opcion)}
                  />
                ))
                : <p style={{ color: 'var(--subtexto)', fontSize: 14, padding: '8px 0' }}>No hay especiales para este día.</p>
            ) : (
              fijosDia.map(p => (
                <OpcionBtn
                  key={p.plato_id}
                  plato={p}
                  seleccionado={seleccion?.plato_id === p.plato_id}
                  onElegir={() => onElegir(p, null)}
                />
              ))
            )}
          </div>

          {seleccion?.plato_id && seleccion?.tiene_guarnicion && (
            <div style={{ marginTop: 12 }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 5 }}>
                Elegí tu guarnición
              </label>
              <select
                style={s.select}
                value={seleccion.guarnicion_id || ''}
                onChange={e => onGuarnicion(e.target.value)}
              >
                <option value="">-- Sin guarnición --</option>
                {guarniciones.map(g => (
                  <option key={g.id} value={g.id}>{g.nombre}</option>
                ))}
              </select>
            </div>
          )}

          {seleccion?.plato_id && (
            <div style={{ marginTop: 10 }}>
              <label style={{ display: 'block', fontWeight: 600, fontSize: 13, marginBottom: 5 }}>
                Observaciones (opcional)
              </label>
              <input
                style={s.inputNotas}
                value={seleccion.notas || ''}
                onChange={e => onNotas(e.target.value)}
                placeholder="Sin sal, sin cebolla..."
              />
            </div>
          )}

          <button
            onClick={onToggleAsiste}
            style={{ marginTop: 14, fontSize: 12, color: '#999', background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
          >
            No voy a trabajar este día
          </button>
        </div>
      )}
    </div>
  );
}

function OpcionBtn({ plato, badge, seleccionado, onElegir }) {
  return (
    <button
      style={{
        ...s.opcionBtn,
        ...(seleccionado ? { borderColor: 'var(--verde)', background: 'var(--verde-bg)' } : {}),
      }}
      onClick={onElegir}
    >
      {badge && <span style={s.badge}>{badge}</span>}
      <span style={{ fontWeight: 600, fontSize: 15 }}>{plato.plato_nombre}</span>
      {plato.tiene_guarnicion && <span style={{ fontSize: 12, color: 'var(--subtexto)', fontStyle: 'italic' }}>+ elegís guarnición</span>}
    </button>
  );
}

function Pantalla({ children }) {
  return <div style={{ maxWidth: 560, margin: '0 auto', padding: '16px 14px' }}>{children}</div>;
}

const s = {
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, paddingTop: 8 },
  titulo: { fontSize: 22, fontWeight: 800, color: 'var(--verde)', margin: '2px 0 4px' },
  logoutBtn: { background: 'none', border: '1px solid var(--borde)', borderRadius: 8, padding: '6px 12px', fontSize: 13, color: 'var(--subtexto)' },
  selectorSemana: { display: 'flex', gap: 8, marginBottom: 16, background: '#f5f5f5', borderRadius: 12, padding: 4 },
  selectorTab: { flex: 1, padding: '8px 4px', borderRadius: 9, border: 'none', background: 'transparent', fontSize: 13, fontWeight: 600, color: 'var(--subtexto)', cursor: 'pointer', transition: 'all 0.15s' },
  selectorTabActivo: { background: '#fff', color: 'var(--verde)', boxShadow: '0 1px 4px rgba(0,0,0,0.12)' },
  infoSemana: { display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 },
  fechaLimiteChip: { display: 'inline-block', background: '#fff8e1', border: '1px solid #ffe082', borderRadius: 8, padding: '4px 10px', fontSize: 12, color: '#7a5800' },
  estadoBanner: { textAlign: 'center', padding: '60px 20px', background: '#fff', borderRadius: 16, margin: '24px 0' },
  avisoExistente: { background: 'var(--verde-bg)', border: '1px solid #c3dfc0', borderRadius: 12, padding: '10px 14px', fontSize: 14, marginBottom: 16, color: '#2a5225' },
  diaCard: { background: '#fff', borderRadius: 14, border: '2px solid var(--borde)', overflow: 'hidden' },
  diaHeader: { width: '100%', background: 'none', border: 'none', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left' },
  selBadge: { fontSize: 12, background: 'var(--verde-bg)', color: 'var(--verde)', padding: '3px 8px', borderRadius: 20, fontWeight: 600 },
  tabs: { display: 'flex', gap: 6, marginBottom: 12 },
  tab: { flex: 1, padding: '7px', borderRadius: 8, border: '1.5px solid var(--borde)', background: '#fff', fontSize: 13, fontWeight: 600, color: 'var(--subtexto)' },
  tabActivo: { background: 'var(--verde)', color: '#fff', borderColor: 'var(--verde)' },
  opcionBtn: { display: 'flex', flexDirection: 'column', gap: 3, padding: '12px 14px', borderRadius: 10, border: '1.5px solid var(--borde)', background: '#fff', textAlign: 'left', width: '100%' },
  badge: { fontSize: 11, background: 'var(--verde)', color: '#fff', padding: '2px 8px', borderRadius: 20, fontWeight: 700, width: 'fit-content' },
  select: { width: '100%', padding: '9px 12px', borderRadius: 9, border: '1.5px solid var(--borde)', fontSize: 15, background: '#fff' },
  inputNotas: { width: '100%', padding: '9px 12px', borderRadius: 9, border: '1.5px solid var(--borde)', fontSize: 14 },
  footer: { position: 'fixed', bottom: 60, left: 0, right: 0, background: '#fff', borderTop: '1px solid var(--borde)', padding: '12px 20px 14px', textAlign: 'center' },
  btnEnviar: { background: 'var(--verde)', color: '#fff', border: 'none', borderRadius: 12, padding: '13px 32px', fontSize: 16, fontWeight: 700, width: '100%', maxWidth: 400 },
  btnSecundario: { background: '#fff', color: 'var(--verde)', border: '2px solid var(--verde)', borderRadius: 12, padding: '12px 24px', fontSize: 15, fontWeight: 700 },
};
