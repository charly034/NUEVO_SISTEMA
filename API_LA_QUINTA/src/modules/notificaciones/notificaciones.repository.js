import { query } from '../../database/connection.js';

const execute = (db, text, params) => (
  typeof db === 'function' ? db(text, params) : db.query(text, params)
);

export async function findByEmpleado(empleadoId, limit = 50) {
  const { rows } = await query(
    `SELECT id, tipo, titulo, cuerpo, leida, created_at
     FROM notificaciones
     WHERE empleado_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [empleadoId, limit]
  );
  return rows;
}

export async function countNoLeidas(empleadoId) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS count FROM notificaciones WHERE empleado_id = $1 AND leida = FALSE`,
    [empleadoId]
  );
  return rows[0].count;
}

export async function marcarLeida(id, empleadoId) {
  const { rows } = await query(
    `UPDATE notificaciones SET leida = TRUE
     WHERE id = $1 AND empleado_id = $2
     RETURNING id`,
    [id, empleadoId]
  );
  return rows[0] || null;
}

export async function marcarTodasLeidas(empleadoId) {
  const { rowCount } = await query(
    `UPDATE notificaciones SET leida = TRUE WHERE empleado_id = $1 AND leida = FALSE`,
    [empleadoId]
  );
  return rowCount;
}

export async function findDestinatarios({ alcance = 'todos', empresaId = null, empleadoId = null } = {}) {
  const conditions = [
    'e.activo = TRUE',
    'emp.activo = TRUE',
    "e.rol <> 'admin'",
  ];
  const values = [];

  if (alcance === 'empresa') {
    values.push(empresaId);
    conditions.push(`e.empresa_id = $${values.length}`);
  }

  if (alcance === 'empleado') {
    values.push(empleadoId);
    conditions.push(`e.id = $${values.length}`);
  }

  const { rows } = await query(
    `SELECT e.id, e.nombre, e.apellido, e.email, e.telefono, e.rol, e.activo,
            e.preferencias_alimentarias, e.empresa_id, emp.nombre AS empresa_nombre,
            emp.plan_id, emp.modo_pedido, emp.dias_laborales
     FROM empleados e
     JOIN empresas emp ON emp.id = e.empresa_id
     WHERE ${conditions.join(' AND ')}
     ORDER BY emp.nombre ASC, e.apellido ASC, e.nombre ASC`,
    values
  );

  return rows;
}

export async function findAllAdmin({ limit = 50, offset = 0, empresaId = null, empleadoId = null, tipo = null, leida = null } = {}) {
  const conditions = [];
  const values = [];

  if (empresaId) {
    values.push(empresaId);
    conditions.push(`e.empresa_id = $${values.length}`);
  }
  if (empleadoId) {
    values.push(empleadoId);
    conditions.push(`n.empleado_id = $${values.length}`);
  }
  if (tipo) {
    values.push(tipo);
    conditions.push(`n.tipo = $${values.length}`);
  }
  if (leida !== null && leida !== undefined && leida !== '') {
    values.push(Boolean(leida));
    conditions.push(`n.leida = $${values.length}`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  values.push(limit, offset);

  const { rows } = await query(
    `SELECT n.id, n.tipo, n.titulo, n.cuerpo, n.leida, n.created_at,
            n.empleado_id, e.nombre AS empleado_nombre, e.apellido AS empleado_apellido,
            e.email, e.empresa_id, emp.nombre AS empresa_nombre
     FROM notificaciones n
     JOIN empleados e ON e.id = n.empleado_id
     JOIN empresas emp ON emp.id = e.empresa_id
     ${where}
     ORDER BY n.created_at DESC, n.id DESC
     LIMIT $${values.length - 1} OFFSET $${values.length}`,
    values
  );

  return rows;
}

export async function crear({ empleadoId, tipo = 'sistema', titulo, cuerpo, dedupeKey = null }, db = query) {
  const { rows } = await execute(db,
    `INSERT INTO notificaciones (empleado_id, tipo, titulo, cuerpo, dedupe_key)
     SELECT e.id, $2, $3, $4, $5
     FROM empleados e
     JOIN empresas emp ON emp.id = e.empresa_id
     WHERE e.id = $1
       AND e.activo = TRUE
       AND emp.activo = TRUE
     ON CONFLICT DO NOTHING
     RETURNING *`,
    [empleadoId, tipo, titulo, cuerpo, dedupeKey]
  );
  return rows[0] || null;
}

export async function crearParaEmpleados({ empleadoIds, tipo = 'sistema', titulo, cuerpo, dedupeKeyPrefix = null }, db = query) {
  const creadas = [];
  for (const empleadoId of empleadoIds) {
    const dedupeKey = dedupeKeyPrefix ? `${dedupeKeyPrefix}:${empleadoId}` : null;
    const notificacion = await crear({ empleadoId, tipo, titulo, cuerpo, dedupeKey }, db);
    if (notificacion) creadas.push(notificacion);
  }
  return creadas;
}

export async function findReglas({ canal = null, evento = null, soloActivas = false } = {}) {
  const conditions = [];
  const values = [];

  if (canal) {
    values.push(canal);
    conditions.push(`canal = $${values.length}`);
  }
  if (evento) {
    values.push(evento);
    conditions.push(`evento = $${values.length}`);
  }
  if (soloActivas) {
    conditions.push('activo = TRUE');
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const { rows } = await query(
    `SELECT id, canal, evento, nombre, activo, filtros, titulo, cuerpo, programacion, created_at, updated_at
     FROM notificacion_reglas
     ${where}
     ORDER BY canal ASC, evento ASC, nombre ASC`,
    values
  );
  return rows;
}

export async function findReglaById(id) {
  const { rows } = await query(
    `SELECT id, canal, evento, nombre, activo, filtros, titulo, cuerpo, programacion, created_at, updated_at
     FROM notificacion_reglas
     WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

export async function crearRegla({ canal, evento, nombre, activo, filtros, titulo, cuerpo, programacion = {} }) {
  const { rows } = await query(
    `INSERT INTO notificacion_reglas (canal, evento, nombre, activo, filtros, titulo, cuerpo, programacion)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8::jsonb)
     RETURNING id, canal, evento, nombre, activo, filtros, titulo, cuerpo, programacion, created_at, updated_at`,
    [canal, evento, nombre, activo, JSON.stringify(filtros || {}), titulo, cuerpo, JSON.stringify(programacion || {})]
  );
  return rows[0];
}

export async function actualizarRegla(id, fields) {
  const keys = Object.keys(fields);
  const values = Object.values(fields).map((value, index) => (
    keys[index] === 'filtros' || keys[index] === 'programacion' ? JSON.stringify(value || {}) : value
  ));
  const set = keys.map((key, index) => (
    key === 'filtros' || key === 'programacion'
      ? `${key} = $${index + 1}::jsonb`
      : `${key} = $${index + 1}`
  ));
  values.push(id);

  const { rows } = await query(
    `UPDATE notificacion_reglas
     SET ${set.join(', ')}, updated_at = NOW()
     WHERE id = $${values.length}
     RETURNING id, canal, evento, nombre, activo, filtros, titulo, cuerpo, programacion, created_at, updated_at`,
    values
  );
  return rows[0] || null;
}

export async function eliminarRegla(id) {
  const { rows } = await query('DELETE FROM notificacion_reglas WHERE id = $1 RETURNING id', [id]);
  return rows[0] || null;
}

export async function getConfiguracion(clave) {
  const { rows } = await query(
    `SELECT clave, valor, updated_at
     FROM notificacion_configuracion
     WHERE clave = $1`,
    [clave]
  );
  return rows[0] || null;
}

export async function upsertConfiguracion(clave, valor) {
  const { rows } = await query(
    `INSERT INTO notificacion_configuracion (clave, valor, updated_at)
     VALUES ($1, $2::jsonb, NOW())
     ON CONFLICT (clave)
     DO UPDATE SET valor = EXCLUDED.valor, updated_at = NOW()
     RETURNING clave, valor, updated_at`,
    [clave, JSON.stringify(valor || {})]
  );
  return rows[0];
}

export async function findDestinatariosWhatsapp({ soloActivos = false } = {}) {
  const where = soloActivos ? 'WHERE d.activo = TRUE' : '';
  const { rows } = await query(
    `SELECT d.id, d.nombre, d.telefono, d.email, d.empresa_id, d.activo, d.created_at, d.updated_at,
            emp.nombre AS empresa_nombre
     FROM notificacion_destinatarios_whatsapp d
     LEFT JOIN empresas emp ON emp.id = d.empresa_id
     ${where}
     ORDER BY d.activo DESC, emp.nombre ASC NULLS LAST, d.nombre ASC`
  );
  return rows;
}

export async function findDestinatarioWhatsappById(id) {
  const { rows } = await query(
    `SELECT id, nombre, telefono, email, empresa_id, activo, created_at, updated_at
     FROM notificacion_destinatarios_whatsapp
     WHERE id = $1`,
    [id]
  );
  return rows[0] || null;
}

export async function crearDestinatarioWhatsapp({ nombre, telefono, email = null, empresaId = null, activo = true }) {
  const { rows } = await query(
    `INSERT INTO notificacion_destinatarios_whatsapp (nombre, telefono, email, empresa_id, activo)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, nombre, telefono, email, empresa_id, activo, created_at, updated_at`,
    [nombre, telefono, email, empresaId, activo]
  );
  return rows[0];
}

export async function actualizarDestinatarioWhatsapp(id, fields) {
  const keys = Object.keys(fields);
  const values = Object.values(fields);
  const set = keys.map((key, index) => `${key} = $${index + 1}`).join(', ');
  values.push(id);
  const { rows } = await query(
    `UPDATE notificacion_destinatarios_whatsapp
     SET ${set}, updated_at = NOW()
     WHERE id = $${values.length}
     RETURNING id, nombre, telefono, email, empresa_id, activo, created_at, updated_at`,
    values
  );
  return rows[0] || null;
}

export async function eliminarDestinatarioWhatsapp(id) {
  const { rows } = await query(
    'DELETE FROM notificacion_destinatarios_whatsapp WHERE id = $1 RETURNING id',
    [id]
  );
  return rows[0] || null;
}

export async function crearEnvioWhatsapp({ reglaId = null, evento, destinatario, payload, estado = 'pendiente' }) {
  const { rows } = await query(
    `INSERT INTO notificacion_envios_whatsapp (regla_id, evento, destinatario, payload, estado)
     VALUES ($1, $2, $3::jsonb, $4::jsonb, $5)
     RETURNING id, regla_id, evento, destinatario, payload, estado, created_at`,
    [reglaId, evento, JSON.stringify(destinatario), JSON.stringify(payload), estado]
  );
  return rows[0];
}

export async function actualizarEnvioWhatsapp(id, { estado, statusCode = null, respuesta = null, error = null }) {
  const { rows } = await query(
    `UPDATE notificacion_envios_whatsapp
     SET estado = $1::varchar, status_code = $2, respuesta = $3, error = $4,
         enviado_at = CASE WHEN $1::varchar IN ('enviado', 'fallido') THEN NOW() ELSE enviado_at END
     WHERE id = $5
     RETURNING id, regla_id, evento, destinatario, payload, estado, status_code, respuesta, error, created_at, enviado_at`,
    [estado, statusCode, respuesta, error, id]
  );
  return rows[0] || null;
}

export async function findEnviosWhatsapp({ limit = 50, offset = 0 } = {}) {
  const { rows } = await query(
    `SELECT e.id, e.regla_id, r.nombre AS regla_nombre, e.evento, e.destinatario, e.payload,
            e.estado, e.status_code, e.respuesta, e.error, e.created_at, e.enviado_at
     FROM notificacion_envios_whatsapp e
     LEFT JOIN notificacion_reglas r ON r.id = e.regla_id
     ORDER BY e.created_at DESC, e.id DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  return rows;
}

export async function crearWhatsappTestLog({
  destinatario,
  telefono,
  nombre,
  mensaje,
  statusCode = null,
  success,
  responseBody = null,
  errorCode = null,
  requestedBy = null,
}) {
  const { rows } = await query(
    `INSERT INTO whatsapp_test_logs (
       destinatario, telefono, nombre, mensaje, status_code, success,
       response_body, error_code, requested_by
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)
     RETURNING id, created_at, destinatario, telefono, nombre, mensaje,
       status_code, success, response_body, error_code, requested_by`,
    [
      destinatario,
      telefono,
      nombre,
      mensaje,
      statusCode,
      success,
      JSON.stringify(responseBody ?? null),
      errorCode,
      requestedBy,
    ]
  );
  return rows[0];
}

export async function findWhatsappTestLogs({ limit = 10 } = {}) {
  const { rows } = await query(
    `SELECT id, created_at, destinatario, telefono, nombre, mensaje,
            status_code, success, response_body, error_code, requested_by
     FROM whatsapp_test_logs
     ORDER BY created_at DESC, id DESC
     LIMIT $1`,
    [limit]
  );
  return rows;
}

export async function findSemanaPublicadaObjetivo() {
  const { rows } = await query(
    `SELECT id, nombre, fecha_inicio, fecha_fin
     FROM menus_semanales
     WHERE estado = 'publicado'
       AND fecha_fin >= CURRENT_DATE
     ORDER BY fecha_inicio ASC
     LIMIT 1`
  );
  return rows[0] || null;
}

export async function findEmpleadosSinPedidoSemanal(semanaInicio) {
  const { rows } = await query(
    `SELECT e.id, e.nombre, e.apellido, e.email, e.telefono, e.rol, e.activo,
            e.preferencias_alimentarias, e.empresa_id, emp.nombre AS empresa_nombre,
            emp.plan_id, emp.modo_pedido, emp.dias_laborales
     FROM empleados e
     JOIN empresas emp ON emp.id = e.empresa_id
     LEFT JOIN pedidos p
       ON p.empleado_id = e.id
      AND p.semana_inicio = $1
      AND p.estado <> 'cancelado'
     WHERE e.activo = TRUE
       AND emp.activo = TRUE
       AND e.rol <> 'admin'
       AND p.id IS NULL
     ORDER BY emp.nombre ASC, e.apellido ASC, e.nombre ASC`,
    [semanaInicio]
  );
  return rows;
}

export async function crearEjecucionProgramada({ reglaId, runKey }) {
  const { rows } = await query(
    `INSERT INTO notificacion_ejecuciones_programadas (regla_id, run_key)
     VALUES ($1, $2)
     ON CONFLICT (regla_id, run_key) DO NOTHING
     RETURNING id, regla_id, run_key, estado, started_at`,
    [reglaId, runKey]
  );
  return rows[0] || null;
}

export async function finalizarEjecucionProgramada(id, { estado, resultado = {}, error = null }) {
  const { rows } = await query(
    `UPDATE notificacion_ejecuciones_programadas
     SET estado = $1, resultado = $2::jsonb, error = $3, finished_at = NOW()
     WHERE id = $4
     RETURNING id, regla_id, run_key, estado, resultado, error, started_at, finished_at`,
    [estado, JSON.stringify(resultado || {}), error, id]
  );
  return rows[0] || null;
}
