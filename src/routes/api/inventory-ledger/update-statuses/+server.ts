import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { InventoryLedgerService } from '$lib/db/services/inventory-ledger';
import { logger } from '$lib/logger';

export const POST: RequestHandler = async () => {
  const startTime = Date.now();
  
  try {
    const service = new InventoryLedgerService();
    
    // Update event statuses based on current business logic
    const result = await service.updateEventStatuses();

    const duration = Date.now() - startTime;
    logger.info('API call: updateInventoryLedgerStatuses', {
      aws: {
        operation: 'updateInventoryLedgerStatuses',
        success: true
      },
      event: {
        duration
      },
      result
    });

    await service.disconnect();

    return json({
      success: true,
      data: result
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('API call: updateInventoryLedgerStatuses', {
      aws: {
        operation: 'updateInventoryLedgerStatuses',
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



