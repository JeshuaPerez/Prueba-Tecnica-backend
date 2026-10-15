import { createReadStream } from 'node:fs';
import { access } from 'node:fs/promises';
import { resolve } from 'node:path';
import { parse } from 'csv-parse';
import pg from 'pg';
import 'dotenv/config';

const csvPath = resolve(process.env.CSV_PATH ?? './data/importaciones.csv');
if (!process.env.DATABASE_URL) throw new Error('Define DATABASE_URL en .env');

// Se comprueba antes de abrir la conexión para dar un mensaje claro en vez de un stack trace de ENOENT.
try {
  await access(csvPath);
} catch {
  console.error(`No se encontró el archivo CSV: ${csvPath}
Colócalo en data/importaciones.csv o define CSV_PATH en .env.`);
  process.exit(1);
}

const requiredHeaders = [
  'correlativo', 'fecha_declaracion', 'aduana', 'tipo_regimen', 'tipo_cambio_dolar',
  'sac', 'descripcion', 'pais', 'tipo_unidad_medida', 'cantidad_fraccion',
  'tasa_dai', 'valor_dai', 'valor_cif_uds', 'tasa_cif_cantidad_fraccion'
];
// Normaliza variantes de unidad al conjunto que acepta el CHECK de la base.
const unitMap = new Map([
  ['PIEZA', 'PIEZAS'], ['PIEZAS', 'PIEZAS'], ['PIECE', 'PIEZAS'],
  ['KG', 'KG'], ['KGS', 'KG'], ['KILOGRAMO', 'KG'], ['KILOGRAMOS', 'KG'],
  ['M2', 'M2'], ['M²', 'M2'], ['M^2', 'M2']
]);

function required(row, key, line) {
  const value = String(row[key] ?? '').trim();
  if (!value) throw new Error(`Fila ${line}: el campo obligatorio "${key}" está vacío.`);
  return value;
}
function decimal(row, key, line, { min = 0 } = {}) {
  const raw = required(row, key, line).replace(',', '.');
  if (!/^-?\d+(\.\d+)?$/.test(raw)) throw new Error(`Fila ${line}: "${key}" no es un número decimal válido.`);
  const n = Number(raw);
  if (!Number.isFinite(n) || n < min) throw new Error(`Fila ${line}: "${key}" debe ser >= ${min}.`);
  // Se devuelve el texto original, no Number, para no introducir error de coma flotante antes de llegar a NUMERIC.
  return raw;
}
function dateOnly(value, line) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`Fila ${line}: fecha_declaracion debe tener formato YYYY-MM-DD.`);
  const d = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) throw new Error(`Fila ${line}: fecha_declaracion no es una fecha real.`);
  return value;
}
function validateRow(row, line) {
  for (const key of requiredHeaders) required(row, key, line);
  const correlativo = required(row, 'correlativo', line);
  const sac = required(row, 'sac', line);
  if (!/^\d{1,40}$/.test(correlativo)) throw new Error(`Fila ${line}: correlativo debe ser numérico y tener hasta 40 dígitos.`);
  if (!/^\d{1,32}$/.test(sac)) throw new Error(`Fila ${line}: sac debe ser numérico y tener hasta 32 dígitos.`);
  const unitOriginal = required(row, 'tipo_unidad_medida', line).toUpperCase().trim();
  const unit = unitMap.get(unitOriginal);
  if (!unit) throw new Error(`Fila ${line}: unidad "${unitOriginal}" no permitida. Use PIEZAS, KG o M2.`);
  return {
    correlativo,
    fecha: dateOnly(required(row, 'fecha_declaracion', line), line),
    aduana: required(row, 'aduana', line),
    regimen: required(row, 'tipo_regimen', line),
    cambio: decimal(row, 'tipo_cambio_dolar', line, { min: Number.MIN_VALUE }),
    sac,
    descripcion: required(row, 'descripcion', line),
    pais: required(row, 'pais', line),
    unidad: unit,
    cantidad: decimal(row, 'cantidad_fraccion', line),
    tasaDai: decimal(row, 'tasa_dai', line),
    valorDai: decimal(row, 'valor_dai', line),
    cif: decimal(row, 'valor_cif_uds', line),
    tasaCif: decimal(row, 'tasa_cif_cantidad_fraccion', line)
  };
}

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : false
});
// Un solo cliente dedicado: BEGIN/COMMIT deben ejecutarse sobre la misma conexión.
const client = await pool.connect();
let line = 1;
let imported = 0;
let rejected = 0;

try {
  // Todo o nada: una fila inválida revierte la carga completa para no dejar estadísticas a medias.
  await client.query('BEGIN');
  const parser = createReadStream(csvPath).pipe(parse({
    bom: true,
    columns: (headers) => {
      const found = headers.map((h) => h.trim());
      // Se valida el encabezado completo para reportar columnas faltantes, no un campo "vacío" de la fila 2.
      const missing = requiredHeaders.filter((h) => !found.includes(h));
      if (missing.length) throw new Error(`Encabezado inválido: faltan las columnas ${missing.join(', ')}.`);
      return found;
    },
    skip_empty_lines: true,
    trim: true,
    relax_column_count: false
  }));

  for await (const row of parser) {
    line += 1;
    const data = validateRow(row, line);
    // Upsert de cabecera: si el correlativo ya existe lo reutiliza y abajo se comprueba que sus datos coincidan.
    const header = await client.query(
      `INSERT INTO importaciones (correlativo, fecha_declaracion, aduana, tipo_regimen, tipo_cambio_dolar)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (correlativo) DO UPDATE SET correlativo = EXCLUDED.correlativo
       RETURNING id, fecha_declaracion, aduana, tipo_regimen, tipo_cambio_dolar`,
      [data.correlativo, data.fecha, data.aduana, data.regimen, data.cambio]
    );
    const p = header.rows[0];
    if (p.fecha_declaracion.toISOString?.().slice(0,10) !== data.fecha &&
        String(p.fecha_declaracion).slice(0,10) !== data.fecha) {
      throw new Error(`Fila ${line}: el correlativo ${data.correlativo} ya existe con otra fecha.`);
    }
    if (p.aduana !== data.aduana || p.tipo_regimen !== data.regimen || Number(p.tipo_cambio_dolar) !== Number(data.cambio)) {
      throw new Error(`Fila ${line}: el correlativo ${data.correlativo} ya existe con datos de cabecera diferentes.`);
    }

    // Idempotencia: no reinserta un ítem idéntico si se corre el CSV otra vez.
    // Los parámetros se castean al tipo de la columna; sin eso 670.780029296875 no iguala al valor ya redondeado por PostgreSQL.
    const exists = await client.query(
      `SELECT id FROM items_importacion
       WHERE importacion_id = $1 AND sac = $2 AND descripcion = $3 AND pais = $4
         AND tipo_unidad_medida = $5
         AND cantidad_fraccion = $6::numeric(20,6)
         AND tasa_dai = $7::numeric(12,6) AND valor_dai = $8::numeric(20,6)
         AND valor_cif_uds = $9::numeric(20,6)
         AND tasa_cif_cantidad_fraccion = $10::numeric(20,8) LIMIT 1`,
      [p.id, data.sac, data.descripcion, data.pais, data.unidad, data.cantidad, data.tasaDai, data.valorDai, data.cif, data.tasaCif]
    );
    if (exists.rowCount === 0) {
      await client.query(
        `INSERT INTO items_importacion
         (importacion_id, sac, descripcion, pais, tipo_unidad_medida, cantidad_fraccion,
          tasa_dai, valor_dai, valor_cif_uds, tasa_cif_cantidad_fraccion)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [p.id, data.sac, data.descripcion, data.pais, data.unidad, data.cantidad, data.tasaDai, data.valorDai, data.cif, data.tasaCif]
      );
    }
    imported += 1;
  }
  // Un archivo sin filas no es un éxito: probablemente es el archivo equivocado o una exportación vacía.
  if (imported === 0) throw new Error('el archivo no contiene filas de datos.');
  await client.query('COMMIT');
  console.log(`Importación finalizada. Filas procesadas: ${imported}. Filas rechazadas: ${rejected}.`);
} catch (error) {
  await client.query('ROLLBACK');
  console.error(`Importación cancelada en la fila aproximada ${line}: ${error.message}`);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
