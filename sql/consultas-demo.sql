-- Consultas para demostrar en vivo (pgAdmin, DBeaver o psql) que los datos están en PostgreSQL.
-- psql: psql -U postgres -d polizas   (con Docker: docker exec -it polizas-postgres psql -U postgres -d polizas)

-- 1) Ver qué tablas existen
--    En psql también:  \dt   y   \d items_importacion
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';

-- 2) Cuántas pólizas (cabeceras) y cuántos ítems (detalle) hay
SELECT
  (SELECT COUNT(*) FROM importaciones)     AS total_polizas,
  (SELECT COUNT(*) FROM items_importacion) AS total_items;

-- 3) La relación uno-a-muchos: cada póliza con su número de ítems
SELECT p.correlativo, p.aduana, COUNT(i.id) AS items
FROM importaciones p
LEFT JOIN items_importacion i ON i.importacion_id = p.id
GROUP BY p.correlativo, p.aduana
ORDER BY items DESC;

-- 4) Lo mismo que devuelve GET /api/v1/importaciones/32642260
SELECT p.correlativo, p.fecha_declaracion, i.sac, i.descripcion, i.pais, i.valor_cif_uds
FROM importaciones p
JOIN items_importacion i ON i.importacion_id = p.id
WHERE p.correlativo = '32642260';

-- 5) Lo mismo que GET /api/v1/estadisticas/por-pais (para comparar con la API)
SELECT i.pais, COUNT(DISTINCT i.importacion_id) AS polizas, SUM(i.valor_cif_uds) AS cif_total
FROM items_importacion i
GROUP BY i.pais
ORDER BY cif_total DESC;

-- 6) Demostrar que las restricciones (CHECK) protegen los datos: esto DEBE fallar
-- INSERT INTO items_importacion (importacion_id, sac, descripcion, pais, tipo_unidad_medida,
--   cantidad_fraccion, tasa_dai, valor_dai, valor_cif_uds, tasa_cif_cantidad_fraccion)
-- VALUES (1, '123', 'PRUEBA', 'GT', 'LITROS', 1, 0, 0, 0, 0);
-- -> ERROR: violates check constraint "unidad_medida_valida"

-- 7) Ver los índices creados
SELECT indexname, tablename FROM pg_indexes WHERE schemaname = 'public';
