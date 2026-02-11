-- SCRIPT PARA CORREGIR LA NUMERACIÓN DE ITEMS EN PROGRAMACIÓN
-- OBJETIVO: Mover la secuencia actual (aprox item 31) para que inicie en el 209
-- CÁLCULO: 209 - 31 = 178 (Este es el offset que sumaremos)

BEGIN;

-- 1. Actualizar los registros existentes
-- Sumamos 178 a todos los items para "empujarlos" hacia adelante
UPDATE programacion_lab
SET item_numero = item_numero + 178
WHERE item_numero IS NOT NULL;

-- 2. Reiniciar la secuencia automática
-- Aseguramos que el próximo insert tome el valor máximo actual + 1
SELECT setval('programacion_lab_item_numero_seq', (SELECT MAX(item_numero) FROM programacion_lab));

-- 3. Verificación rápida (Opcional, solo muestra los resultados)
SELECT item_numero, recep_numero, proyecto FROM programacion_lab ORDER BY item_numero ASC LIMIT 10;

COMMIT;
