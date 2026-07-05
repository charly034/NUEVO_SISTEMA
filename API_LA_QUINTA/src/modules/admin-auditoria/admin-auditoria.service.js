import * as repo from './admin-auditoria.repository.js';

export function adminActor(adminUser = {}) {
  const nombre = `${adminUser.nombre ?? ''} ${adminUser.apellido ?? ''}`.trim();
  return {
    admin_id: adminUser.sub ?? adminUser.id ?? null,
    admin_email: adminUser.email ?? null,
    admin_nombre: nombre || adminUser.email || adminUser.rol || 'Admin',
  };
}

export const registrarAdminAction = async ({ adminUser, ...evento }, db) => {
  return repo.create({
    ...adminActor(adminUser),
    ...evento,
  }, db);
};

export const listar = async ({ page = 1, limit = 80, entidad_tipo, accion, admin_id } = {}) => {
  const pageNum = Number.parseInt(page, 10) || 1;
  const limitNum = Math.min(Number.parseInt(limit, 10) || 80, 200);
  const offset = (pageNum - 1) * limitNum;
  const filtros = { entidad_tipo, accion, admin_id };
  const [eventos, total] = await Promise.all([
    repo.findAll({ ...filtros, limit: limitNum, offset }),
    repo.countAll(filtros),
  ]);
  return {
    eventos,
    pagination: {
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    },
  };
};
