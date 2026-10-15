import pg from 'pg';
import { env } from './env.js';

const { Pool, types } = pg;

// OID 1082 = tipo DATE. Se devuelve tal cual ('YYYY-MM-DD') en vez de convertirlo a Date de JS,
// que le aplica la zona horaria y lo muestra como '2023-08-30T06:00:00.000Z'.
types.setTypeParser(1082, (value) => value);
export const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: env.dbSsl ? { rejectUnauthorized: true } : false,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000
});

pool.on('error', (error) => {
  console.error('Error inesperado en una conexión PostgreSQL inactiva:', error);
});
