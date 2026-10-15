import 'dotenv/config';

// Falla al arrancar si falta configuración crítica, en vez de fallar en la primera consulta.
const required = ['DATABASE_URL'];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Falta la variable de entorno obligatoria: ${key}`);
}

export const env = {
  port: Number.parseInt(process.env.PORT ?? '3000', 10),
  databaseUrl: process.env.DATABASE_URL,
  dbSsl: process.env.DB_SSL === 'true'
};
