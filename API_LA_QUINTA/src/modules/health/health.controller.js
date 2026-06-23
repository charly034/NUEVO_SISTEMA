import { query } from '../../database/connection.js';
import { sendSuccess } from '../../utils/response.js';
import { asyncHandler } from '../../utils/asyncHandler.js';

export const healthCheck = asyncHandler(async (req, res) => {
  const dbResult = await query('SELECT NOW() as now');

  sendSuccess(res, {
    status: 'ok',
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
    database: {
      connected: true,
      serverTime: dbResult.rows[0].now,
    },
  }, 'API funcionando correctamente');
});
