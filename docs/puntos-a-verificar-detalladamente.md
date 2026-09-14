# Puntos a verificar detalladamente

Documento de control para revisar el flujo de exportación de Programación y evitar regresiones entre frontend y backend.

## 1. Exportación LAB

- Confirmar que el frontend **elimina `costo_servicio`** antes de hacer `POST /programacion/export`.
- Verificar que el payload enviado en modo LAB no incluya campos de Comercial/Administración que no correspondan.
- Confirmar que el endpoint LAB devuelve **200 OK** con registros reales.
- Revisar que el Excel generado para LAB **no muestre la columna de costo del servicio**.
- Validar que la exportación siga funcionando aunque algunos registros tengan `costo_servicio` en memoria o en el objeto original.

## 2. Exportación Comercial

- Confirmar que `costo_servicio` **sí se conserva** en el payload.
- Verificar que el backend acepte valores:
  - numéricos
  - strings con formato monetario
  - strings simples con decimal
- Revisar que el archivo Excel Comercial formatee correctamente el costo.
- Confirmar que no se pierdan otros campos comerciales:
  - `fecha_solicitud_com`
  - `fecha_entrega_com`
  - `evidencia_solicitud_envio`
  - `motivo_dias_atraso_com`

## 3. Exportación Administración

- Confirmar que el flujo de Administración siga aceptando el payload compartido sin romper validación.
- Verificar que los campos administrativos no dependan del costo del servicio.
- Revisar que la generación de Excel siga estable después de cambios en el schema compartido.

## 4. Backend compartido

- Validar que el schema compartido de exportación no provoque **422** por tipos estrictos innecesarios.
- Confirmar que el backend sea tolerante solo donde hace falta.
- Mantener claro que la tolerancia del schema **no implica** que LAB exporte `costo_servicio`.
- Revisar si en el futuro conviene separar schemas por modo:
  - `ProgramacionExportLabRequest`
  - `ProgramacionExportComercialRequest`
  - `ProgramacionExportAdministracionRequest`

## 5. Frontend y validación de acceso

- Verificar que los usuarios sin permiso no lleguen al flujo de exportación.
- Confirmar que el cálculo de vista/rol siga sin bloquear el modo correcto.
- Revisar que la exportación use el endpoint correcto según el modo.
- Validar que la sanitización del payload no rompa otros campos del objeto.

## 6. Riesgos conocidos

- El endpoint es compartido, así que una validación demasiado estricta puede romper varios modos a la vez.
- Si LAB vuelve a enviar `costo_servicio` por accidente, el frontend debería seguir filtrándolo.
- Si el backend se vuelve estricto otra vez, el error reaparecerá como **422 Unprocessable Entity**.

## 7. Criterio de aceptación

Se considera correcto cuando:

- LAB exporta sin `costo_servicio`.
- Comercial y Administración siguen exportando con sus campos esperados.
- No aparecen errores 422 por validación de `costo_servicio`.
- El Excel final mantiene el formato esperado en cada modo.

