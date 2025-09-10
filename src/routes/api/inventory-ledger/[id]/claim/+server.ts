import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { InventoryLedgerService } from '$lib/db/services/inventory-ledger';
import { logger } from '$lib/logger';

export const POST: RequestHandler = async ({ params }) => {
  const startTime = Date.now();
  
  try {
    const service = new InventoryLedgerService();
    
    // Check if event exists
    const event = await service.db.inventoryLedgerEvent.findUnique({
      where: { id: params.id }
    });

    if (!event) {
      return json({
        success: false,
        error: 'Event not found'
      }, { status: 404 });
    }

    if (event.status !== 'CLAIMABLE') {
      return json({
        success: false,
        error: 'Event is not in CLAIMABLE status'
      }, { status: 400 });
    }

    // Mark event as claimed
    const updatedEvent = await service.markEventAsClaimed(params.id);

    const duration = Date.now() - startTime;
    logger.info('API call: markEventAsClaimed', {
      aws: {
        operation: 'markEventAsClaimed',
        success: true
      },
      event: {
        duration
      },
      eventId: params.id,
      fnsku: updatedEvent.fnsku,
      asin: updatedEvent.asin
    });

    await service.disconnect();

    return json({
      success: true,
      data: updatedEvent
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('API call: markEventAsClaimed', {
      aws: {
        operation: 'markEventAsClaimed',
        success: false
      },
      event: {
        duration
      },
      error: { message: error instanceof Error ? error.message : 'Unknown error' },
      eventId: params.id
    });

    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
};



