import { readFile } from 'node:fs/promises';
import pg from 'pg';
import 'dotenv/config';

if (!process.env.DATABASE_URL) throw new Error('Define DATABASE_URL en .env');
const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: true } : false });

try {
  await client.connect();
  const schema = await readFile(new URL('../sql/schema.sql', import.meta.url), 'utf8');
  await client.query(schema);
  console.log('Esquema de polizas creado/verificado correctamente.');
} catch (error) {
  console.error('Error inicializando el esquema:', error.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
