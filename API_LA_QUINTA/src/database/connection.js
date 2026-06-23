import pg from 'pg';
import { dbConfig } from '../config/database.js';

const { Pool } = pg;

// Pool mantiene un conjunto de conexiones reutilizables.
// Es mucho más eficiente que abrir/cerrar una conexión por cada request.
const pool = new Pool(dbConfig);

pool.on('error', (err) => {
  console.error('Error inesperado en el pool de PostgreSQL:', err.message);
  process.exit(1);
});

export const query = (text, params) => pool.query(text, params);

export const getClient = () => pool.connect();

export const testConnection = async () => {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    console.log('✅ Conexión a PostgreSQL exitosa');
  } finally {
    client.release();
  }
};

export default pool;
