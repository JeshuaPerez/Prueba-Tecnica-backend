import { ImportacionesService } from '../services/importaciones.service.js';

const service = new ImportacionesService();

export const listImportaciones = async (req, res, next) => {
  try {
    res.json(await service.list(req.pagination));
  } catch (error) { next(error); }
};

export const getImportacion = async (req, res, next) => {
  try {
    res.json({ data: await service.getByCorrelativo(req.params.correlativo) });
  } catch (error) { next(error); }
};

export const getImportacionesBySac = async (req, res, next) => {
  try {
    res.json(await service.getBySac(req.params.sac, req.pagination));
  } catch (error) { next(error); }
};

export const getStatsByCountry = async (req, res, next) => {
  try { res.json({ data: await service.getStatsByCountry() }); }
  catch (error) { next(error); }
};

export const getStatsByCustoms = async (req, res, next) => {
  try { res.json({ data: await service.getStatsByCustoms() }); }
  catch (error) { next(error); }
};
