import pg from 'pg';
import { env } from './env.js';

const { Pool, types } = pg;

// DATE (OID 1082) se devuelve como texto 'YYYY-MM-DD'.
// Con el parser por defecto pg crea un Date de JS y la zona horaria (UTC-6) corre la fecha.
types.setTypeParser(1082, (value) => value);
// Un único pool compartido: reutiliza conexiones entre peticiones.
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
