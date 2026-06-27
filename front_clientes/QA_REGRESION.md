# QA de Regresion - Front Clientes

## Validaciones ejecutables

- `npm run lint`
- `npm run build`
- `npm test`
- `npm run test:e2e` para smoke de pantalla de login; si el runner queda colgado, validar manualmente el login y revisar Playwright/Vite preview.

## Alcance minimo a revisar

- Login de cliente
- Registro con codigo de empresa
- Recuperacion de contrasena
- Perfil del cliente
- Carga, edicion y cancelacion de pedido semanal
- Historial de pedidos

## Checklist manual sugerido

### 1. Autenticacion

- Ingresar con credenciales validas y confirmar redireccion a `/pedido-semanal`.
- Ingresar con credenciales invalidas y confirmar mensaje visible de error.
- Activar y desactivar visibilidad de contrasena con mouse y teclado.
- Verificar que el checkbox de "Mantener sesion activa" conserve la sesion correcta.
- Confirmar que un usuario autenticado no pueda volver a `/login`, `/registro` o `/recuperar`.

### 2. Registro

- Ingresar un codigo invalido y confirmar error.
- Ingresar un codigo valido y confirmar paso 2 con empresa visible.
- Completar alta con password distinta en confirmacion y validar error.
- Completar alta correcta y confirmar alta de sesion y navegacion a `/pedido-semanal`.

### 3. Recuperacion de contrasena

- Probar codigo corto o invalido y confirmar validacion local/remota.
- Cambiar contrasena correctamente y confirmar vuelta al login.
- Verificar toggle de visibilidad de password con teclado.

### 4. Perfil

- Editar nombre/apellido y confirmar persistencia visual tras guardar.
- Probar guardar sin nombre o apellido y confirmar validacion.
- Cambiar contrasena desde perfil y confirmar mensaje de exito.
- Cerrar sesion y confirmar redireccion a `/login`.

### 5. Pedido semanal

- Cambiar de semana y confirmar reinicio controlado del formulario.
- Seleccionar plato simple y validar avance automatico al siguiente dia.
- Seleccionar plato con guarnicion y validar que no permita confirmar sin completarla.
- Marcar un dia como no asiste y validar que se limpie su seleccion.
- Repetir pedido anterior y verificar que no cargue dias bloqueados o sin servicio.
- Confirmar pedido nuevo y validar pantalla de confirmacion.
- Volver desde confirmacion y revisar que el resumen siga consistente.

### 6. Pedido guardado y edicion

- Abrir una semana con pedido existente y validar tarjeta resumen.
- Entrar a modificar pedido y confirmar carga del pedido actual.
- Guardar cambios y validar refresco en resumen, historial y menus publicados.
- Cancelar pedido y validar desaparicion del pedido en resumen e historial.

### 7. Historial

- Confirmar que el historial muestre semanas previas esperadas.
- Expandir una semana y validar detalle por dia.
- Si una semana editable permite eliminar pedido, verificar flujo completo de eliminacion.

## Riesgos actuales a vigilar

- El flujo de pedido depende mucho de estado local y transiciones por semana.
- La navegacion entre semanas y el reuso de pedidos anteriores merecen revision manual despues de cada refactor.
- Hay Vitest y Playwright configurados. En la validacion RC del 2026-06-27, Vitest paso en ejecucion aislada; Playwright mostro el smoke como iniciado/ok pero el comando no finalizo antes del timeout del runner.
