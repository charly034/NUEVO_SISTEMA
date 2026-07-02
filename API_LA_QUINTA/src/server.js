import 'dotenv/config';
import app from './app.js';
import { env } from './config/env.js';
import pool, { testConnection } from './database/connection.js';
import { startNotificacionesScheduler } from './modules/notificaciones/notificaciones.scheduler.js';

let server;
let stopNotificacionesScheduler = null;

const shutdown = (signal) => {
  console.log(`Recibida senal ${signal}. Cerrando servidor...`);
  if (stopNotificacionesScheduler) {
    stopNotificacionesScheduler();
    stopNotificacionesScheduler = null;
  }

  const forceExit = setTimeout(() => {
    console.error('Timeout durante shutdown. Forzando salida.');
    process.exit(1);
  }, 10000);
  forceExit.unref();

  const closePoolAndExit = async (exitCode = 0) => {
    try {
      await pool.end();
      console.log('Pool de PostgreSQL cerrado.');
    } catch (error) {
      console.error('Error al cerrar el pool de PostgreSQL:', error.message);
      exitCode = 1;
    } finally {
      clearTimeout(forceExit);
      process.exit(exitCode);
    }
  };

  if (!server) {
    void closePoolAndExit(0);
    return;
  }

  server.close((error) => {
    if (error) {
      console.error('Error al cerrar el servidor HTTP:', error.message);
      void closePoolAndExit(1);
      return;
    }

    console.log('Servidor HTTP cerrado.');
    void closePoolAndExit(0);
  });
};

const startServer = async () => {
  try {
    // Verificar conexión a la base de datos antes de levantar el servidor
    await testConnection();

    server = app.listen(env.PORT, () => {
      console.log(`🚀 Servidor corriendo en http://localhost:${env.PORT}`);
      console.log(`📌 Entorno: ${env.NODE_ENV}`);
      console.log(`🏥 Health check: http://localhost:${env.PORT}/api/v1/health`);
    });
    stopNotificacionesScheduler = startNotificacionesScheduler();
  } catch (error) {
    console.error('❌ Error al iniciar el servidor:', error.message);
    await pool.end().catch(() => {});
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

startServer();
