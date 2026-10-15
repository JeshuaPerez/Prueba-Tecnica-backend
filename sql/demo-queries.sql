-- Consultas de verificación sobre la base "polizas". Ejecutar en pgAdmin, DBeaver o psql.
-- Cada bloque reproduce o contrasta lo que devuelve un endpoint de la API.

-- Tablas creadas por schema.sql (deben aparecer importaciones e items_importacion).
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

-- Totales de cabeceras y detalle tras importar el CSV.
SELECT
  (SELECT COUNT(*) FROM importaciones)     AS total_polizas,
  (SELECT COUNT(*) FROM items_importacion) AS total_items;

-- Relación 1-N: cuántas partidas tiene cada póliza.
SELECT p.correlativo, p.aduana, COUNT(i.id) AS items
FROM importaciones p
LEFT JOIN items_importacion i ON i.importacion_id = p.id
GROUP BY p.correlativo, p.aduana
ORDER BY items DESC;

-- Equivale a GET /api/v1/importaciones/32642260 (una fila por ítem).
SELECT p.correlativo, p.fecha_declaracion, i.sac, i.descripcion, i.pais, i.valor_cif_uds
FROM importaciones p
JOIN items_importacion i ON i.importacion_id = p.id
WHERE p.correlativo = '32642260';

-- Equivale a GET /api/v1/estadisticas/por-pais; sirve para validar los totales de la API.
SELECT i.pais, COUNT(DISTINCT i.importacion_id) AS polizas, SUM(i.valor_cif_uds) AS cif_total
FROM items_importacion i
GROUP BY i.pais
ORDER BY cif_total DESC;

-- Prueba negativa: la unidad "GALONES" incumple unidad_medida_valida, por lo que debe fallar.
-- Se deja comentada para no romper la ejecución del archivo completo.
-- INSERT INTO items_importacion (importacion_id, sac, descripcion, pais, tipo_unidad_medida,
--   cantidad_fraccion, tasa_dai, valor_dai, valor_cif_uds, tasa_cif_cantidad_fraccion)
-- VALUES (1, '123', 'PRUEBA', 'GT', 'GALONES', 1, 0, 0, 0, 0);

-- Índices existentes; deben verse los de fecha, aduana, SAC, país y la FK.
SELECT indexname, tablename FROM pg_indexes WHERE schemaname = 'public';
