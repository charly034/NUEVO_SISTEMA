import path from 'path';
import { mkdir, unlink } from 'fs/promises';
import sharp from 'sharp';
import { ApiError } from '../../utils/ApiError.js';

const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads', 'platos');
const PUBLIC_PREFIX = '/uploads/platos';

function normalizarNombre(nombre = 'plato') {
  return String(nombre)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70) || 'plato';
}

export async function guardarImagenPlato(file, nombrePlato) {
  if (!file) return null;

  await mkdir(UPLOADS_DIR, { recursive: true });
  const baseName = `${normalizarNombre(nombrePlato)}-${Date.now()}.webp`;
  const destino = path.join(UPLOADS_DIR, baseName);

  try {
    await sharp(file.buffer, { failOn: 'warning' })
      .rotate()
      .resize({ width: 1200, height: 900, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 78, effort: 4 })
      .toFile(destino);
  } catch {
    throw ApiError.badRequest('La imagen del plato no se pudo leer o convertir a WebP.');
  }

  return `${PUBLIC_PREFIX}/${baseName}`;
}

export async function borrarImagenPlato(fotoUrl) {
  if (!fotoUrl || !String(fotoUrl).startsWith(`${PUBLIC_PREFIX}/`)) return;
  const fileName = path.basename(fotoUrl);
  if (!fileName.endsWith('.webp')) return;
  try {
    await unlink(path.join(UPLOADS_DIR, fileName));
  } catch {
    // Si el archivo ya no existe no bloquea la actualizacion del plato.
  }
}
