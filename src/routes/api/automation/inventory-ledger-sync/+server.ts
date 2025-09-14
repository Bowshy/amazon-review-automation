import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { InventoryLedgerService } from '$lib/db/services/inventory-ledger';
import { InventoryLedgerDebugUtils } from '$lib/debug/inventory-ledger-debug';
import { logger } from '$lib/logger';

export const POST: RequestHandler = async () => {
  const startTime = Date.now();
  
  try {
    logger.info('Starting daily inventory ledger sync automation', {
      aws: {
        operation: 'dailyInventoryLedgerSync',
        success: true
      },
      event: {
        startTime: new Date(startTime).toISOString()
      }
    });

    const service = new InventoryLedgerService();

    // Calculate date range for yesterday (Amazon reports are typically available the next day)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dataStartTime = yesterday.toISOString();
    const dataEndTime = today.toISOString();

    logger.info('Inventory ledger sync date range calculated', {
      aws: {
        operation: 'calculateDateRange',
        success: true
      },
      event: {
        startTime: new Date(startTime).toISOString()
      },
      dataStartTime,
      dataEndTime,
      yesterday: yesterday.toISOString().split('T')[0],
      today: today.toISOString().split('T')[0]
    });

    // Step 1: Fetch and process inventory ledger report (this already includes comprehensive logging and debug saving)
    logger.info('Step 1: Fetching and processing inventory ledger report');
    const syncResult = await service.fetchAndProcessInventoryLedgerReport(
      dataStartTime,
      dataEndTime
    );

    logger.info('Inventory ledger report sync completed', {
      aws: {
        operation: 'fetchAndProcessInventoryLedgerReport',
        success: true
      },
      reportId: syncResult.reportId,
      processedCount: syncResult.processedCount,
      newEventsCount: syncResult.newEventsCount,
      updatedEventsCount: syncResult.updatedEventsCount
    });

    // Step 2: Update event statuses based on current business logic
    logger.info('Step 2: Updating event statuses based on business logic');
    const statusUpdateResult = await service.updateEventStatuses();

    logger.info('Event status update completed', {
      aws: {
        operation: 'updateEventStatuses',
        success: true
      },
      updatedCount: statusUpdateResult.updatedCount,
      waitingToClaimable: statusUpdateResult.waitingToClaimable,
      claimableToResolved: statusUpdateResult.claimableToResolved
    });

    // Step 3: Get current statistics for comprehensive logging
    logger.info('Step 3: Getting current statistics');
    const stats = await service.getInventoryLedgerStats();
    const claimableEvents = await service.getClaimableEvents(100, 0, 'eventDate', 'desc');

    logger.info('Current inventory ledger statistics retrieved', {
      aws: {
        operation: 'getInventoryLedgerStats',
        success: true
      },
      totalClaimableUnits: stats.totalClaimableUnits,
      totalWaiting: stats.totalWaiting,
      claimableEventsCount: stats.claimableEventsCount,
      waitingEventsCount: stats.waitingEventsCount,
      totalResolved: stats.totalResolved,
      totalClaimed: stats.totalClaimed,
      totalPaid: stats.totalPaid
    });

    // Step 4: Save comprehensive debug report for this sync operation
    logger.info('Step 4: Saving comprehensive debug report');
    try {
      const debugReportPath = await InventoryLedgerDebugUtils.saveSyncReport({
        timestamp: new Date().toISOString(),
        reportId: syncResult.reportId,
        dataStartTime,
        dataEndTime,
        syncResult,
        statusUpdateResult,
        stats,
        claimableEvents,
        duration: Date.now() - startTime
      });
      
      logger.info('Debug report saved successfully', {
        debugReportPath,
        reportId: syncResult.reportId,
        dataStartTime,
        dataEndTime
      });
    } catch (debugError) {
      logger.warn('Failed to save debug report', {
        error: { message: debugError instanceof Error ? debugError.message : 'Unknown error' }
      });
    }

    const duration = Date.now() - startTime;
    
    // Final comprehensive log
    logger.info('Daily inventory ledger sync automation completed successfully', {
      aws: {
        operation: 'dailyInventoryLedgerSync',
        success: true
      },
      event: {
        duration,
        endTime: new Date().toISOString()
      },
      summary: {
        syncResult,
        statusUpdateResult,
        stats,
        dataStartTime,
        dataEndTime,
        claimableEventsCount: claimableEvents.length
      }
    });

    await service.disconnect();

    return json({
      success: true,
      data: {
        syncResult,
        statusUpdateResult,
        stats,
        dataStartTime,
        dataEndTime,
        duration,
        claimableEventsCount: claimableEvents.length,
        message: `Sync completed successfully. Processed ${syncResult.processedCount} events, created ${syncResult.newEventsCount} new events, updated ${syncResult.updatedEventsCount} existing events. Status updates: ${statusUpdateResult.updatedCount} events. Total claimable units: ${stats.totalClaimableUnits}`
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorData = {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    };
    
    logger.error('Daily inventory ledger sync automation failed', {
      aws: {
        operation: 'dailyInventoryLedgerSync',
        success: false
      },
      event: {
        duration,
        endTime: new Date().toISOString()
      },
      error: errorData
    });

    // Try to save error debug report
    try {
      await InventoryLedgerDebugUtils.saveSyncReport({
        timestamp: new Date().toISOString(),
        dataStartTime: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        dataEndTime: new Date().toISOString(),
        stats: {
          totalClaimableUnits: 0,
          totalEstimatedValue: 0,
          totalWaiting: 0,
          totalResolved: 0,
          totalClaimed: 0,
          totalPaid: 0,
          claimableEventsCount: 0,
          waitingEventsCount: 0
        },
        claimableEvents: [],
        errors: [errorData],
        duration
      });
    } catch (debugError) {
      logger.warn('Failed to save error debug report', {
        error: { message: debugError instanceof Error ? debugError.message : 'Unknown error' }
      });
    }

    return json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration,
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
};



