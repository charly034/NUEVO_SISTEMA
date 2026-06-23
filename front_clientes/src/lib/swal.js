import Swal from 'sweetalert2';

const Toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
  didOpen: (t) => {
    t.addEventListener('mouseenter', Swal.stopTimer);
    t.addEventListener('mouseleave', Swal.resumeTimer);
  },
});

export const toast = {
  success: (message) => Toast.fire({ icon: 'success', title: message }),
  error: (message) => Toast.fire({ icon: 'error', title: message, timer: 4500 }),
  warning: (message) => Toast.fire({ icon: 'warning', title: message }),
};

export async function confirmar({ titulo, texto, botonConfirmar = 'Confirmar', color = '#e53e3e' } = {}) {
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

export async function preguntarDiasIncompletos(faltanDias) {
  const result = await Swal.fire({
    title: `Faltan ${faltanDias} día${faltanDias !== 1 ? 's' : ''} sin elegir`,
    text: '¿Querés enviar el pedido igual con los días que completaste?',
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#276749',
    cancelButtonColor: '#718096',
    confirmButtonText: 'Sí, enviar igual',
    cancelButtonText: 'Volver a completar',
    reverseButtons: true,
    focusCancel: true,
  });
  return result.isConfirmed;
}
