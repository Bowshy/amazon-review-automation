import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { InventoryLedgerService } from '$lib/db/services/inventory-ledger';
import { InventoryLedgerDebugUtils } from '$lib/debug/inventory-ledger-debug';
import { logger } from '$lib/logger';

export const POST: RequestHandler = async ({ request }) => {
  const startTime = Date.now();
  
  try {
    logger.info('Starting manual inventory ledger sync', {
      aws: {
        operation: 'syncInventoryLedger',
        success: true
      },
      event: {
        startTime: new Date(startTime).toISOString()
      }
    });

    const service = new InventoryLedgerService();
    
    // Parse request body
    const body = await request.json();
    const { dataStartTime, dataEndTime } = body;

    logger.info('Parsing sync request parameters', {
      dataStartTime,
      dataEndTime,
      requestBody: body
    });

    if (!dataStartTime || !dataEndTime) {
      const errorMsg = 'dataStartTime and dataEndTime are required';
      logger.error('Invalid sync request parameters', {
        error: { message: errorMsg },
        providedData: { dataStartTime, dataEndTime }
      });
      return json({
        success: false,
        error: errorMsg
      }, { status: 400 });
    }

    // Validate date format
    const startDate = new Date(dataStartTime);
    const endDate = new Date(dataEndTime);
    
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      const errorMsg = 'Invalid date format. Use ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)';
      logger.error('Invalid date format in sync request', {
        error: { message: errorMsg },
        providedDates: { dataStartTime, dataEndTime }
      });
      return json({
        success: false,
        error: errorMsg
      }, { status: 400 });
    }

    logger.info('Date validation passed', {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
      dateRangeDays: Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24))
    });

    // Fetch and process inventory ledger report (this includes comprehensive logging and debug saving)
    logger.info('Step 1: Fetching and processing inventory ledger report');
    const result = await service.fetchAndProcessInventoryLedgerReport(
      dataStartTime,
      dataEndTime
    );

    logger.info('Inventory ledger report sync completed', {
      aws: {
        operation: 'fetchAndProcessInventoryLedgerReport',
        success: true
      },
      reportId: result.reportId,
      processedCount: result.processedCount,
      newEventsCount: result.newEventsCount,
      updatedEventsCount: result.updatedEventsCount
    });

    // Get current stats for comprehensive logging
    logger.info('Step 2: Getting current statistics');
    const stats = await service.getInventoryLedgerStats();
    const claimableEvents = await service.getClaimableEvents(100, 0, 'eventDate', 'desc');

    logger.info('Current statistics retrieved', {
      aws: {
        operation: 'getInventoryLedgerStats',
        success: true
      },
      totalClaimableUnits: stats.totalClaimableUnits,
      totalWaiting: stats.totalWaiting,
      claimableEventsCount: stats.claimableEventsCount,
      waitingEventsCount: stats.waitingEventsCount,
      totalResolved: stats.totalResolved
    });

    // Save comprehensive debug report for this manual sync
    logger.info('Step 3: Saving comprehensive debug report');
    try {
      const debugReportPath = await InventoryLedgerDebugUtils.saveSyncReport({
        timestamp: new Date().toISOString(),
        reportId: result.reportId,
        dataStartTime,
        dataEndTime,
        syncResult: result,
        stats,
        claimableEvents,
        duration: Date.now() - startTime
      });
      
      logger.info('Debug report saved successfully', {
        debugReportPath,
        reportId: result.reportId,
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
    logger.info('Manual inventory ledger sync completed successfully', {
      aws: {
        operation: 'syncInventoryLedger',
        success: true
      },
      event: {
        duration,
        endTime: new Date().toISOString()
      },
      summary: {
        dataStartTime,
        dataEndTime,
        result,
        stats,
        claimableEventsCount: claimableEvents.length
      }
    });

    await service.disconnect();

    return json({
      success: true,
      data: {
        ...result,
        stats,
        claimableEventsCount: claimableEvents.length,
        duration,
        message: `Manual sync completed successfully. Processed ${result.processedCount} events, created ${result.newEventsCount} new events, updated ${result.updatedEventsCount} existing events. Total claimable units: ${stats.totalClaimableUnits}`
      }
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    const errorData = {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    };
    
    logger.error('Manual inventory ledger sync failed', {
      aws: {
        operation: 'syncInventoryLedger',
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



