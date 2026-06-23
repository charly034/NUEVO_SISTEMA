import { asyncHandler } from '../../utils/asyncHandler.js';
import * as repo from './estadisticas.repository.js';

export const getResumen          = asyncHandler(async (req, res) => res.json({ data: await repo.resumenGeneral() }));
export const getPlatosmasUsados  = asyncHandler(async (req, res) => res.json({ data: await repo.platosmasUsados(req.query) }));
export const getDistribucionTags = asyncHandler(async (req, res) => res.json({ data: await repo.distribucionTags(req.query) }));
export const getUsoPorDia        = asyncHandler(async (req, res) => res.json({ data: await repo.usoPorDia() }));
export const getTendencia        = asyncHandler(async (req, res) => res.json({ data: await repo.tendenciaMensual() }));
export const getTopPorDia        = asyncHandler(async (req, res) => res.json({ data: await repo.topPlatosPorDia(req.query) }));
