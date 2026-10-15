import { Router } from 'express';
import {
  listImportaciones, getImportacion, getImportacionesBySac,
  getStatsByCountry, getStatsByCustoms
} from '../controllers/importaciones.controller.js';
import { validatePagination } from '../middlewares/validateQuery.js';
import { validateCorrelativo, validateSac } from '../validators/importacion.validators.js';

const router = Router();

// Las rutas específicas se declaran antes de las rutas con parámetros.
router.get('/estadisticas/por-pais', getStatsByCountry);
router.get('/estadisticas/por-aduana', getStatsByCustoms);
router.get('/importaciones', validatePagination, listImportaciones);
router.get('/importaciones/:correlativo', validateCorrelativo, getImportacion);
router.get('/sac/:sac', validateSac, validatePagination, getImportacionesBySac);

export default router;
