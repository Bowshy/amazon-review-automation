import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { InventoryLedgerService } from '$lib/db/services/inventory-ledger';
import { logger } from '$lib/logger';

export const GET: RequestHandler = async () => {
  const startTime = Date.now();
  
  try {
    const service = new InventoryLedgerService();
    const stats = await service.getInventoryLedgerStats();

    const duration = Date.now() - startTime;
    logger.info('API call: getInventoryLedgerStats', {
      aws: {
        operation: 'getInventoryLedgerStats',
        success: true
      },
      event: {
        duration
      },
      stats
    });

    await service.disconnect();

    return json({
      success: true,
      data: stats
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('API call: getInventoryLedgerStats', {
      aws: {
        operation: 'getInventoryLedgerStats',
        success: false
      },
      event: {
        duration
      },
      error: { message: error instanceof Error ? error.message : 'Unknown error' }
    });

    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
};

