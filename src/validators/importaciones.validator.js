import { AppError } from '../utils/app-error.js';

// Se validan como texto de dígitos (no Number): son identificadores y pueden tener ceros a la izquierda.
const CORRELATIVO = /^[0-9]{1,40}$/;
const SAC = /^[0-9]{1,32}$/;

export function validateCorrelativo(req, res, next) {
  const value = req.params.correlativo;
  if (!CORRELATIVO.test(value)) {
    return next(new AppError('correlativo debe contener únicamente dígitos y tener entre 1 y 40 caracteres.', 400, 'INVALID_CORRELATIVO'));
  }
  next();
}

export function validateSac(req, res, next) {
  const value = req.params.sac;
  if (!SAC.test(value)) {
    return next(new AppError('sac debe contener únicamente dígitos y tener entre 1 y 32 caracteres.', 400, 'INVALID_SAC'));
  }
  next();
}
