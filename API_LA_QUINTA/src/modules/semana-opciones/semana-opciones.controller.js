import * as service from './semana-opciones.service.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { sendSuccess } from '../../utils/response.js';

export const getSemanaOpciones = asyncHandler(async (req, res) => {
  const vista = await service.getSemanaOpciones(Number(req.params.menuSemanalId));
  sendSuccess(res, vista, 'Semana por Opción obtenida');
});

export const postExcepcionEmpresaOpcion = asyncHandler(async (req, res) => {
  const excepcion = await service.setExcepcionEmpresaOpcion(
    Number(req.params.menuSemanalId),
    Number(req.params.empresaId),
    req.body.opcion
  );
  sendSuccess(res, excepcion, 'Excepción de opción aplicada para esta semana');
});

export const deleteExcepcionEmpresaOpcion = asyncHandler(async (req, res) => {
  await service.quitarExcepcionEmpresaOpcion(Number(req.params.menuSemanalId), Number(req.params.empresaId));
  sendSuccess(res, { ok: true }, 'Excepción de opción eliminada, vuelve al default de la empresa');
});

export const putDisponiblePorKilo = asyncHandler(async (req, res) => {
  await service.setDisponiblePorKilo(Number(req.params.slotId), req.body.disponible);
  sendSuccess(res, { ok: true }, 'Disponibilidad por-kilo actualizada');
});

export const postMarcarFijoVianda = asyncHandler(async (req, res) => {
  const anchor = await service.marcarFijoVianda(Number(req.params.menuSemanalId), Number(req.params.platoId));
  sendSuccess(res, anchor, 'Fijo marcado como vianda para esta semana');
});

export const deleteQuitarFijoVianda = asyncHandler(async (req, res) => {
  await service.quitarFijoVianda(Number(req.params.menuSemanalId), Number(req.params.platoId));
  sendSuccess(res, { ok: true }, 'Fijo desmarcado como vianda para esta semana');
});

export const postMarcarSlotVianda = asyncHandler(async (req, res) => {
  const anchor = await service.marcarSlotVianda(Number(req.params.slotId));
  sendSuccess(res, anchor, 'Slot marcado como vianda para esta semana');
});

export const deleteQuitarSlotVianda = asyncHandler(async (req, res) => {
  await service.quitarSlotVianda(Number(req.params.slotId));
  sendSuccess(res, { ok: true }, 'Slot desmarcado como vianda para esta semana');
});

export const putFijoDisponiblePorKilo = asyncHandler(async (req, res) => {
  await service.setFijoDisponiblePorKilo(Number(req.params.menuSemanalId), Number(req.params.platoId), req.body.disponible);
  sendSuccess(res, { ok: true }, 'Disponibilidad por-kilo del fijo actualizada');
});

export const putEmpresasFijo = asyncHandler(async (req, res) => {
  await service.setEmpresasFijo(Number(req.params.menuSemanalId), Number(req.params.platoId), req.body.empresa_ids);
  sendSuccess(res, { ok: true }, 'Visibilidad del fijo actualizada para esta semana');
});

export const postAgregarGuarnicionSemana = asyncHandler(async (req, res) => {
  await service.agregarGuarnicionSemana(Number(req.params.menuSemanalId), Number(req.params.guarnicionId));
  sendSuccess(res, { ok: true }, 'Guarnición agregada a esta semana');
});

export const deleteQuitarGuarnicionSemana = asyncHandler(async (req, res) => {
  await service.quitarGuarnicionSemana(Number(req.params.menuSemanalId), Number(req.params.guarnicionId));
  sendSuccess(res, { ok: true }, 'Guarnición quitada de esta semana');
});

export const postAgregarSalsaSemana = asyncHandler(async (req, res) => {
  await service.agregarSalsaSemana(Number(req.params.menuSemanalId), Number(req.params.salsaId));
  sendSuccess(res, { ok: true }, 'Salsa agregada a esta semana');
});

export const deleteQuitarSalsaSemana = asyncHandler(async (req, res) => {
  await service.quitarSalsaSemana(Number(req.params.menuSemanalId), Number(req.params.salsaId));
  sendSuccess(res, { ok: true }, 'Salsa quitada de esta semana');
});
