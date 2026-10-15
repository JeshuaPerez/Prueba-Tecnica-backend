import { AppError } from '../utils/app-error.js';

export function validatePagination(req, res, next) {
  const page = req.query.page === undefined ? 1 : Number(req.query.page);
  const limit = req.query.limit === undefined ? 20 : Number(req.query.limit);

  if (!Number.isInteger(page) || page < 1) {
    return next(new AppError('page debe ser un entero mayor o igual a 1.', 400, 'INVALID_PAGE'));
  }
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return next(new AppError('limit debe ser un entero entre 1 y 100.', 400, 'INVALID_LIMIT'));
  }

  // Se calcula offset aquí para que servicios y repositorios solo reciban datos ya validados.
  req.pagination = { page, limit, offset: (page - 1) * limit };
  next();
}
