import { ImportacionesRepository } from '../repositories/importaciones.repository.js';
import { AppError } from '../utils/AppError.js';

const repository = new ImportacionesRepository();

export class ImportacionesService {
  async list(pagination) {
    const { rows, total } = await repository.list(pagination);
    return {
      data: rows,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit)
      }
    };
  }

  async getByCorrelativo(correlativo) {
    const result = await repository.findByCorrelativo(correlativo);
    if (!result) throw new AppError(`No existe la póliza con correlativo ${correlativo}.`, 404, 'POLIZA_NOT_FOUND');
    return result;
  }

  async getBySac(sac, pagination) {
    const { rows, total } = await repository.findBySac(sac, pagination);
    return {
      data: rows,
      pagination: {
        page: pagination.page,
        limit: pagination.limit,
        total,
        totalPages: Math.ceil(total / pagination.limit)
      }
    };
  }

  getStatsByCountry() {
    return repository.statsByCountry();
  }

  getStatsByCustoms() {
    return repository.statsByCustoms();
  }
}
