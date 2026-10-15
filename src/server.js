import app from './app.js';
import { env } from './config/env.js';
import { pool } from './config/db.js';

try {
  // Verifica la conexión a PostgreSQL antes de aceptar tráfico.
  await pool.query('SELECT 1');
  const server = app.listen(env.port, () => {
    console.log(`API escuchando en http://localhost:${env.port}/api/v1`);
  });

  // Cierre ordenado: deja de aceptar peticiones y libera el pool antes de salir.
  const shutdown = async (signal) => {
    console.log(`Señal ${signal}: cerrando servidor...`);
    server.close(async () => {
      await pool.end();
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
} catch (error) {
  console.error('No se pudo conectar a PostgreSQL:', error.message);
  await pool.end();
  process.exit(1);
}
