import { Router } from 'express';
import { validate } from '../../middlewares/validation.middleware.js';
import { createUserSchema, updateUserSchema, userParamsSchema, getUsersQuerySchema } from './users.schema.js';
import { getUsers, getUser, createUser, updateUser, deleteUser } from './users.controller.js';
import { requireAdmin } from '../../middlewares/auth.middleware.js';

const router = Router();
router.use(requireAdmin);

router.get('/', validate({ query: getUsersQuerySchema }), getUsers);
router.get('/:id', validate({ params: userParamsSchema }), getUser);
router.post('/', validate({ body: createUserSchema }), createUser);
router.put('/:id', validate({ params: userParamsSchema, body: updateUserSchema }), updateUser);
router.delete('/:id', validate({ params: userParamsSchema }), deleteUser);

export default router;
