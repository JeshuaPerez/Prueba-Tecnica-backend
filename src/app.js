import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import routes from './routes/importaciones.routes.js';
import { notFoundHandler, errorHandler } from './middlewares/errorHandler.js';

const app = express();
app.disable('x-powered-by');
app.use(helmet());
app.use(cors({ origin: process.env.CORS_ORIGIN ?? '*', credentials: false }));
app.use(express.json({ limit: '1mb' }));

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'polizas-backend' }));
app.use('/api/v1', routes);
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
