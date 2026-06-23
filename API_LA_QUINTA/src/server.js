import 'dotenv/config';
import app from './app.js';
import { env } from './config/env.js';
import { testConnection } from './database/connection.js';

const startServer = async () => {
  try {
    // Verificar conexión a la base de datos antes de levantar el servidor
    await testConnection();

    app.listen(env.PORT, () => {
      console.log(`🚀 Servidor corriendo en http://localhost:${env.PORT}`);
      console.log(`📌 Entorno: ${env.NODE_ENV}`);
      console.log(`🏥 Health check: http://localhost:${env.PORT}/api/v1/health`);
    });
  } catch (error) {
    console.error('❌ Error al iniciar el servidor:', error.message);
    process.exit(1);
  }
};

startServer();
