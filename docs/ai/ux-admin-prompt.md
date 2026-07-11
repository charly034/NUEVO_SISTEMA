# Prompt de normalizacion UX - Panel Admin La Quinta

Usar este documento al inicio de cualquier sesion donde se vaya a modificar, crear o auditar vistas del panel admin (`front_menu`). Define los principios, patrones y reglas que gobiernan toda la interfaz admin.

## Contexto

Panel admin de La Quinta, sistema de catering B2B.

- App: `front_menu`
- Stack: React 18 + Vite + Tailwind 3
- Componentes base: `SideDrawer`, `Spinner`, `toast` (`front_menu/src/lib/toast.js`) y `confirm` (`front_menu/src/lib/confirm.js`, SweetAlert2)

## Principio rector: Simplicidad Radical

El objetivo de cada vista debe ser visible y alcanzable en 1-2 clicks, sin scroll, al entrar a la pantalla.

Todo lo demas (detalles, historial, acciones secundarias, datos relacionados) se accede de forma progresiva mediante drawers, modales simples o secciones colapsables.

Pregunta guia: "Que quiere hacer el usuario en los proximos 10 segundos?"

Eso va arriba, visible y claro. Lo secundario va detras de un click.

## Estructura estandar de una vista

```text
[Header de pagina]
  Titulo + descripcion breve
  Boton de accion principal (ej: Nueva empresa, Imprimir, Exportar)

[Filtros - maximo 3 visibles]
  Si hay mas de 3 filtros, agruparlos bajo Filtros avanzados colapsable
  Los filtros siempre tienen label visible, no solo placeholder

[Lista / Tabla]
  Solo columnas clave, las que permiten identificar el registro
  Click en fila abre SideDrawer con el detalle completo
  Sin acciones destructivas en la tabla

[SideDrawer]
  width="md" para formularios simples
  width="lg" para formularios con subsecciones o listas relacionadas
  Pie siempre: Guardar / Cancelar
  Acciones destructivas al final, separadas y con confirm()
  Si hay mucho contenido, usar tabs dentro del drawer
```

## Reglas por elemento

### Tablas

- Maximo 5-6 columnas. El resto va al SideDrawer.
- Columnas clave primero: nombre/identificador, estado, dato mas relevante, fecha.
- Estado con badge de color: verde, amarillo, rojo o gris.
- Ultima columna: solo icono de ver detalle, o fila entera clickeable.
- Acciones masivas: barra visible debajo del header de tabla, con fondo diferenciado.

### Filtros

- Maximo 3 controles visibles por defecto.
- Agrupar por tema: Empresa/Empleado, Estado, Fechas, Financiero.
- Filtros rapidos tipo chips separados de inputs de rango personalizado.
- Al aplicar filtros, mostrar tag "Filtrado por: {valor}" bajo el header.
- Preservar filtros al cambiar de tab dentro de la misma vista.

### Modales vs SideDrawers

- Usar SideDrawer cuando el usuario necesita mantener contexto de la lista o tabla mientras edita.
- Usar modal solo para confirmaciones simples, alertas destructivas o formularios de 1-2 campos.
- No usar modales anidados. Si hace falta segundo nivel de detalle, usar tabs dentro del drawer o navegar a otra vista.

### Acciones por fila

- Maximo 1 icono/boton visible en la fila.
- Si hay multiples acciones, moverlas a un dropdown o bloque Acciones dentro del SideDrawer.
- Acciones destructivas como eliminar, desactivar o anular siempre al final del drawer/modal y con `confirm()`.

### KPIs y resumenes

- El numero mas importante de la vista va en los primeros 100px: total viandas, saldo pendiente, vendidos, etc.
- Formato: numero grande + etiqueta corta + color de contexto.
- En vistas filtrables, los KPIs deben responder a los filtros activos.

### Listas largas

- Mostrar primeros 5-8 items y boton "Ver todos (X)" colapsable.
- Evitar paginacion si la lista cabe mejor en un acordeon.

### Indicadores de interactividad

- Filas clickeables: `hover:bg-gray-50` y `cursor-pointer`.
- Celdas editables inline: icono lapiz en hover.
- Botones no aplicables deben tener estado deshabilitado explicito y razon visible cuando corresponda.

### Mobile-first

- El panel admin es mobile-first.
- Evitar layouts horizontales y scroll horizontal.
- Si hay multiples variantes o columnas, usar tabs o bloques apilados verticalmente.
- En mobile, filtros bajo boton "Filtrar" o seccion colapsable.

## Patrones frecuentes

### Estado financiero

- KPIs sticky o superiores: Total vendido, Cobrado, Pendiente.
- Detalles de pagos y movimientos en SideDrawer o ficha de cuenta corriente.

### Empresa + empleados

- Tabla de empresas: nombre, plan, empleados activos, estado.
- SideDrawer con tabs: Detalles, Empleados, Acciones.

### Semana + menu

- Vista de semana como grid/lista de dias.
- Click en dia abre SideDrawer para agregar o quitar plato.
- Mostrar estado de semana: borrador, publicado, cerrado.
- Diferenciar acciones de agregar/quitar con color y texto claro.

### Pedidos del dia

- Objetivo primario: cuantas viandas hay y para que empresa.
- Imprimir desde boton de header con `window.print()` y layout `@media print`.
- Exportar etiquetas XLSX con columnas `empresa`, `nombre_apellido`, `plato`, `guarnicion`, `fecha`.

## No hacer

- No poner acciones destructivas en tablas.
- No usar modales centrados para editar registros con muchos campos.
- No mostrar mas de 3 filtros visibles sin agrupar.
- No usar scroll horizontal en mobile.
- No ocultar el KPI principal debajo del fold.
- No resetear filtros al cambiar de tab dentro de la misma vista.
- No renderizar secciones JSON o detalles tecnicos vacios; aplicar null-check antes.

## Vocabulario del sistema

- Vianda: pedido de comida de un empleado para un dia.
- Semana: periodo de servicio, lunes a viernes o ampliado segun empresa.
- Plan: contrato de vianda de una empresa, incluyendo gramaje, postre y bebida.
- Empresa: cliente del sistema de catering.
- Empleado: usuario de la app de clientes, pertenece a una empresa.
- Guarnicion: acompanamiento del plato principal.
- Estado de semana: borrador, publicado, cerrado.
- Estado de pedido: pendiente, confirmado o cancelado, con variantes operativas documentadas en contratos.

## Checklist al trabajar una vista

1. Identificar el objetivo primario de la vista en una frase.
2. Verificar que ese objetivo este visible sin scroll al cargar.
3. Aplicar estructura: header, filtros, lista, drawer.
4. Revisar la lista "No hacer".
5. Probar mobile antes de dar por terminado.
