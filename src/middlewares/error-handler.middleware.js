import { AppError } from '../utils/app-error.js';

export function notFoundHandler(req, res, next) {
  next(new AppError(`Ruta no encontrada: ${req.method} ${req.originalUrl}`, 404, 'ROUTE_NOT_FOUND'));
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  // Códigos SQLSTATE de PostgreSQL traducidos a 4xx, sin exponer el detalle interno de la base.
  const pgErrors = {
    '23505': [409, 'CONFLICT', 'El registro ya existe.'],
    '23503': [400, 'FOREIGN_KEY_VIOLATION', 'La referencia indicada no existe.'],
    '23514': [400, 'CHECK_CONSTRAINT', 'Uno o más valores incumplen las reglas de negocio.'],
    '22P02': [400, 'INVALID_VALUE', 'Uno o más valores tienen un formato incorrecto.'],
    '22007': [400, 'INVALID_DATE', 'La fecha no tiene un formato válido.'],
    '23502': [400, 'REQUIRED_FIELD', 'Falta un campo obligatorio.']
  };

  if (pgErrors[error.code]) {
    const [statusCode, code, message] = pgErrors[error.code];
    return res.status(statusCode).json({ error: { code, message } });
  }

  // Cualquier otro error: 500 por defecto; en producción se oculta el mensaje real.
  // body-parser marca el JSON inválido con este type; se responde sin filtrar el mensaje interno del parser.
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { code: 'INVALID_JSON', message: 'El cuerpo de la petición no es un JSON válido.' } });
  }

  const statusCode = error.statusCode ?? 500;
  const body = {
    error: {
      code: error.code ?? 'INTERNAL_ERROR',
      message: statusCode >= 500 && process.env.NODE_ENV === 'production'
        ? 'Ocurrió un error interno.'
        : error.message ?? 'Ocurrió un error interno.'
    }
  };
  if (process.env.NODE_ENV !== 'production' && statusCode >= 500) body.error.stack = error.stack;
  res.status(statusCode).json(body);
}
