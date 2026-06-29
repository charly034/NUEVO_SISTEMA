# Flujo de pedido cliente

Esta nota documenta el flujo real de pedidos semanales desde la app cliente. La pantalla usa React, Tailwind y componentes propios; el guardado ya está conectado a la API.

## Endpoints usados

- `GET /api/v1/pedidos/semanas`
  - Requiere `Authorization: Bearer <token>`.
  - El backend toma empleado y empresa desde el token.
  - Devuelve semanas, días, estado del pedido, plazos, menú asociado y selecciones guardadas.

- `GET /api/v1/menu/semanas/:semanaId/opciones?empresaId=:empresaId`
  - Devuelve opciones del menú semanal, platos especiales, platos fijos y guarniciones activas.
  - `semanaId` puede ser el identificador de semana usado por el frontend.

- `POST /api/v1/pedidos`
  - Requiere token.
  - Crea o reconstruye el pedido del empleado autenticado para una semana.
  - No debe recibir `usuarioId` ni `empresaId` desde el frontend.

- `PUT /api/v1/pedidos/:pedidoId`
  - Requiere token.
  - Solo permite modificar pedidos propios del empleado autenticado y su empresa.

- `PATCH /api/v1/pedidos/:pedidoId/confirmar`
  - Requiere token.
  - Confirma un pedido propio.

- `POST /api/v1/pedidos/sugerencias`
  - Requiere token.
  - Guarda sugerencias del empleado autenticado para una semana sin menú publicado.
  - No debe recibir `usuarioId` ni `empresaId` desde el frontend.

## Payload de crear pedido

```json
{
  "semana_inicio": "2026-06-29",
  "menu_semanal_id": 22,
  "items": [
    {
      "dia": "lunes",
      "plato_id": 10,
      "opcion": "A",
      "guarnicion_id": 2,
      "sin_pedido": false
    }
  ]
}
```

## Payload de modificar pedido

```json
{
  "pedidoId": 123,
  "semana_inicio": "2026-06-29",
  "menu_semanal_id": 22,
  "items": [
    {
      "dia": "martes",
      "plato_id": 14,
      "opcion": "B",
      "guarnicion_id": null,
      "sin_pedido": false
    }
  ]
}
```

## Payload de sugerencias

```json
{
  "semana_inicio": "2026-07-06",
  "ideas": ["Milanesa con pure", "Pollo al horno"],
  "comentario": "Opciones livianas para esa semana"
}
```

## Reglas de negocio

- El frontend no manda `usuarioId` ni `empresaId` al crear, modificar o confirmar. El backend usa el token.
- Un empleado solo puede ver y modificar pedidos de su empresa y de su propio usuario.
- Cada empleado puede tener un solo pedido por semana. La base debe impedir duplicados por empleado y semana.
- Si llega un segundo `POST /pedidos` para el mismo empleado y semana, la regla actual es `upsert`: se actualiza el mismo pedido y no se crea un duplicado.
- Crear, modificar y confirmar deben usar transacción. Si falla un día, no debe quedar un pedido parcial.
- Si `sin_pedido` es `true`, `plato_id` y `guarnicion_id` deben llegar vacíos.
- Si un plato requiere guarnición, `guarnicion_id` es obligatorio.
- Si un plato no requiere guarnición, no debe aceptarse una guarnición.
- Sábado y domingo pueden venir como `sin_pedido` por defecto en empresas que trabajan lunes a domingo.
- Si un día no tiene menú especial, se pueden mostrar platos fijos con el aviso: "Todavía no hay menú especial para este día. Podés elegir un plato fijo".
- Si un día no tiene servicio o está vencido, no se puede editar.
- Si la semana está fuera de plazo, el backend debe rechazar POST/PUT aunque el frontend haya mostrado el botón por error.
- El plazo vigente para POST/PUT lo define la empresa (`modo_pedido`, `limite_hora`, `limite_dia_semana`, `limite_anticipacion_dias` y `plazo_override_hasta` si aplica); `menus_semanales.fecha_limite_pedidos` no debe bloquear el pedido cliente.
- En la pantalla de sugerencias no se debe llamar a crear/modificar pedido ni exigir días seleccionados; debe usar `POST /pedidos/sugerencias`.
- `PATCH /pedidos/:pedidoId/confirmar` no revalida plazo en la implementación actual porque no cambia selecciones; solo registra confirmación del pedido propio.

## Validaciones backend críticas

- Semana inexistente.
- Pedido inexistente.
- Pedido ajeno.
- Semana fuera de plazo.
- Día vencido.
- Día sin servicio.
- Día no laboral para la empresa.
- Plato inexistente, agotado o deshabilitado.
- Plato especial que no pertenece al menú/día enviado.
- Guarnición inexistente o inactiva.
- Guarnición faltante cuando es obligatoria.
- Guarnición enviada cuando no corresponde.
- `sin_pedido: true` con plato o guarnición cargados.
- Pedido duplicado para la misma semana y empleado.

## Estados frontend esperados

- Mientras guarda: botón deshabilitado y texto `Guardando...`.
- Error de API: mensaje claro sin exponer detalles internos.
- Guardado OK: la card se sincroniza con la respuesta real.
- Recarga de página: el pedido confirmado o modificado se reconstruye desde DB.
- Semana sin menú asignado: mostrar pantalla de sugerencia de menú.

## Decisiones UX cliente 2026-06-28

- La navegación principal de semanas ya no depende de un carrusel de cards como mecanismo primario.
- `Pedido semanal` muestra siempre la semana en curso como opcion principal; la accion dice `Ver pedido` si ya hay pedido cargado, `Ver menu` si hay menu publicado o `Ver semana` si aun no hay menu.
- Debajo solo aparecen acciones futuras relevantes: hacer pedido para la próxima semana con menú publicado y sin pedido cargado, o sugerir menú para una próxima semana sin menú.
- Las opciones de pantalla principal son cards grandes por semana/accion: semana actual, semanas proximas con menu publicado y sugerir menu cuando todavia no hay menu.
- Las semanas con menú se abren primero en lectura para mostrar fecha, días y todas las opciones especiales publicadas antes de entrar a cargar pedido.
- Las semanas futuras montan la vista completa recién cuando el usuario toca la acción correspondiente y ocultan el resto para ocupar el alto disponible.
- La semana activa se conserva por `semana.id` en `localStorage` para mantener contexto al recargar.
- La tab principal `Pedido` vuelve a la pantalla principal de pedido si el usuario quedó mirando otra acción.
- El estado de pedido muestra progreso como `X de Y días` o `Faltan N días` durante edición.
- Las semanas sin menu aparecen como CTA de sugerencia cuando todavia no hay sugerencia enviada; al abrirlas, la pantalla explica que no se esta cargando un pedido sino dejando ideas para esa semana.
- El selector de día aclara que elegir un plato todavía no guarda el pedido; el guardado ocurre al tocar `Confirmar pedido` o `Guardar cambios`.
- El selector hace foco visual en el día/fecha y permite ir al día anterior o siguiente.

## Prueba local

1. Levantar backend y frontend.
2. Iniciar sesión como empleado.
3. Ir a `Pedido semanal`.
4. Ver semanas reales.
5. Abrir una semana abierta.
6. Elegir plato.
7. Elegir guarnición si corresponde.
8. Confirmar pedido.
9. Recargar y verificar que el estado viene desde DB.
10. Modificar el pedido y guardar.
11. Probar una semana o día fuera de plazo y verificar bloqueo visual y error backend.

## Warnings conocidos

- La confirmacion de pedido usa SVG/CSS liviano; `lottie-react` fue removido para evitar el warning de `eval` de `lottie-web`.
- El build del cliente separa `sweetalert2` por import dinamico y las paginas principales por `React.lazy`. En la validacion del 2026-06-27 no hubo warning de chunk mayor a 500 kB.

## Medicion de performance cliente

- `front_clientes/src/utils/performance.js` usa `performance.mark` y `performance.measure`.
- Las metricas se loguean con `console.debug("[La Quinta perf]", ...)` solo en development o con `VITE_DEBUG_PERFORMANCE=true`.
- Se miden auth/check sesion, login, carga de semanas, opciones por semana, navegacion bottom nav, apertura de bottom sheet, filtrado de busqueda, guardado de pedido, sugerencias y requests fetch/axios.
- Los logs no incluyen tokens ni payloads completos; solo operacion, ruta sin query cuando aplica, metodo, status y duracion.
