import { Router } from 'express';
import v1Routes from './v1.routes.js';

const router = Router();

router.use('/v1', v1Routes);

// Futuras versiones:
// router.use('/v2', v2Routes);

export default router;
