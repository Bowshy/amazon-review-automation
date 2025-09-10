import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { InventoryLedgerService } from '$lib/db/services/inventory-ledger';
import { logger } from '$lib/logger';

export const POST: RequestHandler = async ({ request }) => {
  const startTime = Date.now();
  
  try {
    const service = new InventoryLedgerService();
    
    // Parse request body
    const body = await request.json();
    const { dataStartTime, dataEndTime } = body;

    if (!dataStartTime || !dataEndTime) {
      return json({
        success: false,
        error: 'dataStartTime and dataEndTime are required'
      }, { status: 400 });
    }

    // Validate date format
    const startDate = new Date(dataStartTime);
    const endDate = new Date(dataEndTime);
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return json({
        success: false,
        error: 'Invalid date format. Use ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)'
      }, { status: 400 });
    }

    // Fetch and process inventory ledger report
    const result = await service.fetchAndProcessInventoryLedgerReport(
      dataStartTime,
      dataEndTime
    );

    const duration = Date.now() - startTime;
    logger.info('API call: syncInventoryLedger', {
      aws: {
        operation: 'syncInventoryLedger',
        success: true
      },
      event: {
        duration
      },
      dataStartTime,
      dataEndTime,
      result
    });

    await service.disconnect();

    return json({
      success: true,
      data: result
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('API call: syncInventoryLedger', {
      aws: {
        operation: 'syncInventoryLedger',
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



