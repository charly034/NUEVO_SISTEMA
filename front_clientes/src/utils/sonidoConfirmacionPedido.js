export function reproducirSonidoConfirmacion() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  const contexto = new AudioContext();
  const ganancia = contexto.createGain();
  ganancia.connect(contexto.destination);
  ganancia.gain.setValueAtTime(0.0001, contexto.currentTime);
  ganancia.gain.exponentialRampToValueAtTime(0.075, contexto.currentTime + 0.04);
  ganancia.gain.exponentialRampToValueAtTime(0.045, contexto.currentTime + 0.72);
  ganancia.gain.exponentialRampToValueAtTime(0.0001, contexto.currentTime + 1.28);

  [
    { frecuencia: 523.25, inicio: 0, duracion: 0.24 },
    { frecuencia: 659.25, inicio: 0.16, duracion: 0.26 },
    { frecuencia: 783.99, inicio: 0.34, duracion: 0.34 },
    { frecuencia: 1046.5, inicio: 0.72, duracion: 0.36 },
  ].forEach(({ frecuencia, inicio, duracion }) => {
    const oscilador = contexto.createOscillator();
    oscilador.type = "sine";
    oscilador.frequency.setValueAtTime(frecuencia, contexto.currentTime + inicio);
    oscilador.connect(ganancia);
    oscilador.start(contexto.currentTime + inicio);
    oscilador.stop(contexto.currentTime + inicio + duracion);
  });

  window.setTimeout(() => {
    contexto.close().catch(() => {});
  }, 1600);
}
