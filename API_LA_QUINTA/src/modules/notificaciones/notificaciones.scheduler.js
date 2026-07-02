import * as notificacionesService from './notificaciones.service.js';

const INTERVALO_MS = 60 * 1000;

function pad(value) {
  return String(value).padStart(2, '0');
}

function marcaLocal(date = new Date()) {
  return {
    diaSemana: date.getDay(),
    fecha: `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    hora: `${pad(date.getHours())}:${pad(date.getMinutes())}`,
  };
}

function reglaDebeEjecutar(regla, marca) {
  const programacion = regla.programacion || {};
  return programacion.tipo === 'semanal'
    && Number(programacion.dia_semana) === marca.diaSemana
    && programacion.hora === marca.hora;
}

export function startNotificacionesScheduler() {
  let running = false;

  const tick = async () => {
    if (running) return;
    running = true;

    try {
      const marca = marcaLocal();
      const reglas = await notificacionesService.listarReglasProgramadasActivas();
      const reglasDelMinuto = reglas.filter((regla) => reglaDebeEjecutar(regla, marca));

      for (const regla of reglasDelMinuto) {
        const runKey = `${marca.fecha}:${marca.hora}`;
        try {
          const resultado = await notificacionesService.ejecutarReglaProgramada({ regla, runKey });
          console.log(
            `Scheduler notificaciones: regla ${regla.id} (${regla.nombre}) -> ${JSON.stringify(resultado)}`
          );
        } catch (error) {
          console.error(`Scheduler notificaciones: error en regla ${regla.id}:`, error.message);
        }
      }
    } catch (error) {
      if (error?.code === '42P01' || error?.code === '42703') {
        console.log('Scheduler notificaciones: tablas nuevas aun no migradas, se omite tick.');
      } else {
        console.error('Scheduler notificaciones: error general:', error.message);
      }
    } finally {
      running = false;
    }
  };

  const interval = setInterval(() => {
    void tick();
  }, INTERVALO_MS);
  interval.unref();

  void tick();
  return () => clearInterval(interval);
}
