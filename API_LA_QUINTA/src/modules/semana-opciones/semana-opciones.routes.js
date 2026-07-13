import { Router } from 'express';
import { validate } from '../../middlewares/validation.middleware.js';
import { requireAdmin } from '../../middlewares/auth.middleware.js';
import {
  menuParamsSchema, empresaOpcionParamsSchema, slotParamsSchema,
  opcionExcepcionSchema, disponiblePorKiloSchema, fijoViandaParamsSchema, setEmpresasFijoSchema,
  guarnicionSemanaParamsSchema, salsaSemanaParamsSchema,
} from './semana-opciones.schema.js';
import {
  getSemanaOpciones, postExcepcionEmpresaOpcion, deleteExcepcionEmpresaOpcion, putDisponiblePorKilo,
  postMarcarFijoVianda, deleteQuitarFijoVianda, postMarcarSlotVianda, deleteQuitarSlotVianda,
  putFijoDisponiblePorKilo, putEmpresasFijo,
  postAgregarGuarnicionSemana, deleteQuitarGuarnicionSemana, postAgregarSalsaSemana, deleteQuitarSalsaSemana,
} from './semana-opciones.controller.js';

const router = Router();
router.use(requireAdmin);

router.get('/:menuSemanalId', validate({ params: menuParamsSchema }), getSemanaOpciones);

router.post(
  '/:menuSemanalId/empresas/:empresaId/opcion-excepcion',
  validate({ params: empresaOpcionParamsSchema, body: opcionExcepcionSchema }),
  postExcepcionEmpresaOpcion
);
router.delete(
  '/:menuSemanalId/empresas/:empresaId/opcion-excepcion',
  validate({ params: empresaOpcionParamsSchema }),
  deleteExcepcionEmpresaOpcion
);

router.put(
  '/slots/:slotId/disponible-por-kilo',
  validate({ params: slotParamsSchema, body: disponiblePorKiloSchema }),
  putDisponiblePorKilo
);

router.post(
  '/slots/:slotId/vianda',
  validate({ params: slotParamsSchema }),
  postMarcarSlotVianda
);
router.delete(
  '/slots/:slotId/vianda',
  validate({ params: slotParamsSchema }),
  deleteQuitarSlotVianda
);

router.post(
  '/:menuSemanalId/fijos/:platoId/vianda',
  validate({ params: fijoViandaParamsSchema }),
  postMarcarFijoVianda
);
router.delete(
  '/:menuSemanalId/fijos/:platoId/vianda',
  validate({ params: fijoViandaParamsSchema }),
  deleteQuitarFijoVianda
);

router.put(
  '/:menuSemanalId/fijos/:platoId/disponible-por-kilo',
  validate({ params: fijoViandaParamsSchema, body: disponiblePorKiloSchema }),
  putFijoDisponiblePorKilo
);

router.put(
  '/:menuSemanalId/fijos/:platoId/empresas',
  validate({ params: fijoViandaParamsSchema, body: setEmpresasFijoSchema }),
  putEmpresasFijo
);

router.post(
  '/:menuSemanalId/guarniciones/:guarnicionId',
  validate({ params: guarnicionSemanaParamsSchema }),
  postAgregarGuarnicionSemana
);
router.delete(
  '/:menuSemanalId/guarniciones/:guarnicionId',
  validate({ params: guarnicionSemanaParamsSchema }),
  deleteQuitarGuarnicionSemana
);

router.post(
  '/:menuSemanalId/salsas/:salsaId',
  validate({ params: salsaSemanaParamsSchema }),
  postAgregarSalsaSemana
);
router.delete(
  '/:menuSemanalId/salsas/:salsaId',
  validate({ params: salsaSemanaParamsSchema }),
  deleteQuitarSalsaSemana
);

export default router;
