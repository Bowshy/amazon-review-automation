import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { InventoryLedgerService } from '$lib/db/services/inventory-ledger';
import { logger } from '$lib/logger';

export const POST: RequestHandler = async () => {
  const startTime = Date.now();
  
  try {
    logger.info('Starting daily inventory ledger sync automation');

    const service = new InventoryLedgerService();

    // Calculate date range for yesterday (Amazon reports are typically available the next day)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dataStartTime = yesterday.toISOString();
    const dataEndTime = today.toISOString();

    logger.info('Inventory ledger sync date range', {
      dataStartTime,
      dataEndTime,
      yesterday: yesterday.toISOString().split('T')[0],
      today: today.toISOString().split('T')[0]
    });

    // Step 1: Fetch and process inventory ledger report
    const syncResult = await service.fetchAndProcessInventoryLedgerReport(
      dataStartTime,
      dataEndTime
    );

    // Step 2: Update event statuses based on current business logic
    const statusUpdateResult = await service.updateEventStatuses();

    const duration = Date.now() - startTime;
    logger.info('Daily inventory ledger sync automation completed', {
      aws: {
        operation: 'dailyInventoryLedgerSync',
        success: true
      },
      event: {
        duration
      },
      syncResult,
      statusUpdateResult,
      dataStartTime,
      dataEndTime
    });

    await service.disconnect();

    return json({
      success: true,
      data: {
        syncResult,
        statusUpdateResult,
        dataStartTime,
        dataEndTime,
        duration
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Daily inventory ledger sync automation failed', {
      aws: {
        operation: 'dailyInventoryLedgerSync',
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



