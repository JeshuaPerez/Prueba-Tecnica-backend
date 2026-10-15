import { pool } from '../config/db.js';

const ITEM_COLUMNS = `
  i.id AS item_id, i.sac, i.descripcion, i.pais, i.tipo_unidad_medida,
  i.cantidad_fraccion, i.tasa_dai, i.valor_dai, i.valor_cif_uds,
  i.tasa_cif_cantidad_fraccion
`;
const HEADER_COLUMNS = `
  p.id, p.correlativo, p.fecha_declaracion, p.aduana, p.tipo_regimen,
  p.tipo_cambio_dolar, p.created_at, p.updated_at
`;

export class ImportacionesRepository {
  async list({ limit, offset }) {
    const [rows, count] = await Promise.all([
      pool.query(
        `SELECT ${HEADER_COLUMNS},
          COALESCE(json_agg(json_build_object(
            'id', x.item_id, 'sac', x.sac, 'descripcion', x.descripcion,
            'pais', x.pais, 'tipo_unidad_medida', x.tipo_unidad_medida,
            'cantidad_fraccion', x.cantidad_fraccion, 'tasa_dai', x.tasa_dai,
            'valor_dai', x.valor_dai, 'valor_cif_uds', x.valor_cif_uds,
            'tasa_cif_cantidad_fraccion', x.tasa_cif_cantidad_fraccion
          )) FILTER (WHERE x.item_id IS NOT NULL), '[]'::json) AS items
         FROM importaciones p
         LEFT JOIN (
           SELECT ${ITEM_COLUMNS} FROM items_importacion i
         ) x ON x.importacion_id = p.id
         GROUP BY p.id
         ORDER BY p.fecha_declaracion DESC, p.correlativo
         LIMIT $1 OFFSET $2`,
        [limit, offset]
      ),
      pool.query('SELECT COUNT(*)::int AS total FROM importaciones')
    ]);
    return { rows: rows.rows, total: count.rows[0].total };
  }

  async findByCorrelativo(correlativo) {
    const result = await pool.query(
      `SELECT ${HEADER_COLUMNS},
        COALESCE(json_agg(json_build_object(
          'id', i.id, 'sac', i.sac, 'descripcion', i.descripcion, 'pais', i.pais,
          'tipo_unidad_medida', i.tipo_unidad_medida, 'cantidad_fraccion', i.cantidad_fraccion,
          'tasa_dai', i.tasa_dai, 'valor_dai', i.valor_dai, 'valor_cif_uds', i.valor_cif_uds,
          'tasa_cif_cantidad_fraccion', i.tasa_cif_cantidad_fraccion
        )) FILTER (WHERE i.id IS NOT NULL), '[]'::json) AS items
       FROM importaciones p LEFT JOIN items_importacion i ON i.importacion_id = p.id
       WHERE p.correlativo = $1
       GROUP BY p.id`,
      [correlativo]
    );
    return result.rows[0] ?? null;
  }

  async findBySac(sac, { limit, offset }) {
    const [rows, count] = await Promise.all([
      pool.query(
        `SELECT ${HEADER_COLUMNS},
          json_agg(json_build_object(
            'id', i.id, 'sac', i.sac, 'descripcion', i.descripcion, 'pais', i.pais,
            'tipo_unidad_medida', i.tipo_unidad_medida, 'cantidad_fraccion', i.cantidad_fraccion,
            'tasa_dai', i.tasa_dai, 'valor_dai', i.valor_dai, 'valor_cif_uds', i.valor_cif_uds,
            'tasa_cif_cantidad_fraccion', i.tasa_cif_cantidad_fraccion
          )) AS items
         FROM importaciones p
         JOIN items_importacion i ON i.importacion_id = p.id
         WHERE i.sac = $1
         GROUP BY p.id
         ORDER BY p.fecha_declaracion DESC, p.correlativo
         LIMIT $2 OFFSET $3`,
        [sac, limit, offset]
      ),
      pool.query('SELECT COUNT(DISTINCT p.id)::int AS total FROM importaciones p JOIN items_importacion i ON i.importacion_id = p.id WHERE i.sac = $1', [sac])
    ]);
    return { rows: rows.rows, total: count.rows[0].total };
  }

  async statsByCountry() {
    const result = await pool.query(
      `SELECT i.pais,
        COUNT(DISTINCT p.id)::int AS cantidad_polizas,
        COUNT(i.id)::int AS cantidad_items,
        COALESCE(SUM(i.cantidad_fraccion), 0) AS cantidad_total,
        COALESCE(SUM(i.valor_cif_uds), 0) AS valor_cif_total,
        COALESCE(SUM(i.valor_dai), 0) AS valor_dai_total
       FROM items_importacion i
       JOIN importaciones p ON p.id = i.importacion_id
       GROUP BY i.pais
       ORDER BY valor_cif_total DESC, i.pais ASC`
    );
    return result.rows;
  }

  async statsByCustoms() {
    const result = await pool.query(
      `SELECT p.aduana,
        COUNT(DISTINCT p.id)::int AS cantidad_polizas,
        COUNT(i.id)::int AS cantidad_items,
        COALESCE(SUM(i.valor_cif_uds), 0) AS valor_cif_total,
        COALESCE(SUM(i.valor_dai), 0) AS valor_dai_total
       FROM importaciones p
       LEFT JOIN items_importacion i ON i.importacion_id = p.id
       GROUP BY p.aduana
       ORDER BY valor_cif_total DESC, p.aduana ASC`
    );
    return result.rows;
  }
}
