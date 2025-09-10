import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { InventoryLedgerService } from '$lib/db/services/inventory-ledger';
import { logger } from '$lib/logger';

export const GET: RequestHandler = async ({ url }) => {
  const startTime = Date.now();
  
  try {
    const service = new InventoryLedgerService();
    
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '100', 10), 500);
    const events = await service.getClaimableEvents(limit);

    const duration = Date.now() - startTime;
    logger.info('API call: getClaimableEvents', {
      aws: {
        operation: 'getClaimableEvents',
        success: true
      },
      event: {
        duration
      },
      limit,
      resultCount: events.length
    });

    await service.disconnect();

    return json({
      success: true,
      data: events
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('API call: getClaimableEvents', {
      aws: {
        operation: 'getClaimableEvents',
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

