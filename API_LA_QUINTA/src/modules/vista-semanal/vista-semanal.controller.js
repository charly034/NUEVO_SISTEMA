import * as vistaSemanalService from './vista-semanal.service.js';
import { sendSuccess } from '../../utils/response.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const getVistaSemanal = asyncHandler(async (req, res) => {
  const vista = await vistaSemanalService.getVistaSemanal(Number(req.params.menuSemanalId));
  sendSuccess(res, vista, 'Vista semanal obtenida exitosamente');
});
