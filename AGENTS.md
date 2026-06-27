# AGENTS.md

## Idioma y estilo

- Responder y documentar en español, salvo que se solicite explicitamente otro idioma.
- Usar nombres reales del proyecto. No inventar rutas, modulos, contratos, endpoints, variables ni claves.
- Preferir cambios pequeños, seguros y verificables.
- No agregar funcionalidades no solicitadas.
- Si el proyecto usa nombres del dominio en español, mantener ese criterio.

## Regla de documentos de IA primero

Este proyecto debe mantener una memoria tecnica durable en `docs/ai/`.

Antes de cualquier trabajo sustancial:

1. Comprobar si existe `docs/ai/`.
2. Si existe, leer primero:
   - `docs/ai/00-index.yaml`
   - `docs/ai/05-admin.yaml`
   - `docs/ai/10-system-map.yaml`
   - `docs/ai/30-contracts.yaml`
3. Segun la tarea, leer tambien:
   - `docs/ai/20-modules.yaml`
   - `docs/ai/40-flows.yaml`
   - `docs/ai/50-guardrails.yaml`
   - `docs/ai/60-debt.yaml`
   - `docs/ai/70-project-history.yaml`
   - `docs/ai/project-structure.txt`
4. Usar esos documentos como mapa principal antes de buscar ampliamente en el repositorio.

## Si falta `docs/ai/`

Si `docs/ai/` no existe o faltan documentos fundamentales, crear primero el paquete minimo de memoria de IA antes de implementar cambios grandes.

Archivos esperados:

- `docs/ai/00-index.yaml`
- `docs/ai/05-admin.yaml`
- `docs/ai/10-system-map.yaml`
- `docs/ai/20-modules.yaml`
- `docs/ai/30-contracts.yaml`
- `docs/ai/40-flows.yaml`
- `docs/ai/50-guardrails.yaml`
- `docs/ai/60-debt.yaml`
- `docs/ai/70-project-history.yaml`
- `docs/ai/project-structure.txt`

## Politica de documentacion

- Usar el repositorio real como fuente de verdad.
- No copiar estructuras de otros proyectos si no coinciden con este.
- No forzar secciones que no apliquen: adaptar los documentos al proyecto real.
- Mantener los documentos concisos, densos y utiles para navegacion futura.
- Preferir YAML estructurado antes que prosa larga.
- Incluir rutas exactas, modulos, contratos, comandos, claves, endpoints, migraciones y flujos cuando existan.
- No guardar secretos ni valores reales de `.env`.
- Se pueden documentar nombres de variables de entorno, pero nunca sus valores reales.
- Si algo no esta claro, marcarlo como `unknown` o `needs_verification`.

## Politica de consistencia

Cada ejecucion debe mantener la misma estructura documental.

No crear nuevos formatos casualmente. Si aparece un concepto nuevo, ubicarlo en el archivo existente mas adecuado.

## Politica de edicion

- Tratar `owner_module` como autoridad principal para saber donde debe vivir la logica.
- Tratar `allowed_edit_paths` como superficie segura de edicion por defecto.
- Tratar `must_not_move_without` como advertencia de coordinacion.
- Antes de mover scripts, modulos, rutas, migraciones o globales, revisar los contratos documentados en `docs/ai/`.
- Para refactorizaciones grandes, trabajar por capas:
  1. ayudantes
  2. cableado del modulo/orquestador
  3. documentacion
- Preferir varios cambios pequeños por subsistema a un unico parche gigante.

## Politica de mutacion

Despues de tocar codigo, actualizar cualquier archivo de `docs/ai/` que haya quedado obsoleto.

Revisar especialmente:

- propiedad de modulos
- rutas permitidas de edicion
- contratos de API
- endpoints
- middlewares
- migraciones
- variables de entorno
- scripts
- orden de carga
- flujos criticos
- pruebas requeridas
- deuda tecnica
- estructura general del proyecto
- decisiones historicas del producto

## Validacion

Antes de finalizar:

1. Ejecutar las pruebas o comandos disponibles del area modificada.
2. Si no se pueden ejecutar, explicar claramente por que.
3. Mostrar resumen de archivos modificados.
4. Indicar que documentos de `docs/ai/` fueron actualizados.
5. Separar:
   - hechos verificados en el repo
   - inferencias razonables
   - dudas pendientes
6. No dejar codigo y documentos desalineados.
