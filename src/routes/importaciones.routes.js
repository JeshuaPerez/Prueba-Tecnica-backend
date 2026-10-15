import { Router } from 'express';
import {
  listImportaciones, getImportacion, getImportacionesBySac,
  getStatsByCountry, getStatsByCustoms
} from '../controllers/importaciones.controller.js';
import { validatePagination } from '../middlewares/pagination.middleware.js';
import { validateCorrelativo, validateSac } from '../validators/importaciones.validator.js';

const router = Router();

// Las rutas fijas van antes de las que llevan parámetro para que ':param' no las capture.
// /sac/:sac reemplaza a /importaciones/:sac porque Express no distingue dos patrones idénticos.
router.get('/estadisticas/por-pais', getStatsByCountry);
router.get('/estadisticas/por-aduana', getStatsByCustoms);
router.get('/importaciones', validatePagination, listImportaciones);
router.get('/importaciones/:correlativo', validateCorrelativo, getImportacion);
router.get('/sac/:sac', validateSac, validatePagination, getImportacionesBySac);

export default router;
