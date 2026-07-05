import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/response.js';
import * as service from './admin-auditoria.service.js';

export const getAuditoria = asyncHandler(async (req, res) => {
  sendSuccess(res, await service.listar(req.query), 'Auditoria admin obtenida');
});
