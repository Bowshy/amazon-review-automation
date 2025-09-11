import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { InventoryLedgerService } from '$lib/db/services/inventory-ledger';
import { logger } from '$lib/logger';

export const GET: RequestHandler = async ({ params }) => {
  const startTime = Date.now();
  
  try {
    const service = new InventoryLedgerService();
    
    // Get the event
    const event = await service.db.inventoryLedgerEvent.findUnique({
      where: { id: params.id }
    });

    if (!event) {
      return json({
        success: false,
        error: 'Event not found'
      }, { status: 404 });
    }

    // Generate claim text
    const claimText = service.generateClaimText(event);

    const duration = Date.now() - startTime;
    logger.info('API call: generateClaimText', {
      aws: {
        operation: 'generateClaimText',
        success: true
      },
      event: {
        duration
      },
      eventId: params.id,
      fnsku: event.fnsku,
      asin: event.asin
    });

    await service.disconnect();

    return json({
      success: true,
      data: {
        claimText,
        event: {
          id: event.id,
          fnsku: event.fnsku,
          asin: event.asin,
          sku: event.sku,
          productTitle: event.productTitle,
          eventType: event.eventType,
          fulfillmentCenter: event.fulfillmentCenter,
          unreconciledQuantity: event.unreconciledQuantity,
          eventDate: event.eventDate
        }
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('API call: generateClaimText failed', {
      aws: {
        operation: 'generateClaimText',
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
