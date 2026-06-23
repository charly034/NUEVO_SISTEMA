import Swal from 'sweetalert2';

/**
 * Muestra un diálogo de confirmación con SweetAlert2.
 * Retorna true si el usuario confirmó, false si canceló.
 */
export async function confirmar({ titulo, texto, botonConfirmar = 'Sí, eliminar', color = '#e53e3e' } = {}) {
  const result = await Swal.fire({
    title: titulo,
    text: texto,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: color,
    cancelButtonColor: '#718096',
    confirmButtonText: botonConfirmar,
    cancelButtonText: 'Cancelar',
    reverseButtons: true,
    focusCancel: true,
  });
  return result.isConfirmed;
}

/**
 * Diálogo de confirmación suave (azul) — para acciones no destructivas.
 */
export async function confirmarAccion({ titulo, texto, botonConfirmar = 'Confirmar' } = {}) {
  const result = await Swal.fire({
    title: titulo,
    text: texto,
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#276749',
    cancelButtonColor: '#718096',
    confirmButtonText: botonConfirmar,
    cancelButtonText: 'Cancelar',
    reverseButtons: true,
  });
  return result.isConfirmed;
}
