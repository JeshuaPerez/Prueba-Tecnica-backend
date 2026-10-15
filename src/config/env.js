import 'dotenv/config';

const required = ['DATABASE_URL'];
for (const key of required) {
  if (!process.env[key]) throw new Error(`Falta la variable de entorno obligatoria: ${key}`);
}

export const env = {
  port: Number.parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv: process.env.NODE_ENV ?? 'development',
  databaseUrl: process.env.DATABASE_URL,
  dbSsl: process.env.DB_SSL === 'true',
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
  csvPath: process.env.CSV_PATH ?? './data/importaciones.csv'
};
