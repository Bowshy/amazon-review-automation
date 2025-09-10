#!/usr/bin/env tsx

/**
 * Daily Inventory Ledger Sync Script
 * 
 * This script fetches and processes Amazon Inventory Ledger Report (AIRPA) data
 * and updates event statuses based on business logic.
 * 
 * Usage:
 *   npm run automation:inventory-ledger-sync
 *   or
 *   tsx src/scripts/inventory-ledger-daily-sync.ts
 */

import { InventoryLedgerService } from '../lib/db/services/inventory-ledger';
import { logger } from '../lib/logger';

async function runDailyInventoryLedgerSync() {
  const startTime = Date.now();
  
  try {
    logger.info('Starting daily inventory ledger sync script');

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
    logger.info('Step 1: Fetching and processing inventory ledger report');
    const syncResult = await service.fetchAndProcessInventoryLedgerReport(
      dataStartTime,
      dataEndTime
    );

    logger.info('Inventory ledger report sync completed', {
      reportId: syncResult.reportId,
      processedCount: syncResult.processedCount,
      newEventsCount: syncResult.newEventsCount,
      updatedEventsCount: syncResult.updatedEventsCount
    });

    // Step 2: Update event statuses based on current business logic
    logger.info('Step 2: Updating event statuses');
    const statusUpdateResult = await service.updateEventStatuses();

    logger.info('Event status update completed', {
      updatedCount: statusUpdateResult.updatedCount,
      waitingToClaimable: statusUpdateResult.waitingToClaimable,
      claimableToResolved: statusUpdateResult.claimableToResolved
    });

    // Step 3: Get current statistics
    logger.info('Step 3: Getting current statistics');
    const stats = await service.getInventoryLedgerStats();

    logger.info('Current inventory ledger statistics', {
      totalClaimableUnits: stats.totalClaimableUnits,
      totalWaiting: stats.totalWaiting,
      claimableEventsCount: stats.claimableEventsCount,
      waitingEventsCount: stats.waitingEventsCount,
      totalResolved: stats.totalResolved,
      totalClaimed: stats.totalClaimed,
      totalPaid: stats.totalPaid
    });

    const duration = Date.now() - startTime;
    logger.info('Daily inventory ledger sync script completed successfully', {
      aws: {
        operation: 'dailyInventoryLedgerSync',
        success: true
      },
      event: {
        duration
      },
      summary: {
        syncResult,
        statusUpdateResult,
        stats,
        dataStartTime,
        dataEndTime
      }
    });

    await service.disconnect();

    console.log('✅ Daily inventory ledger sync completed successfully');
    console.log(`📊 Processed ${syncResult.processedCount} events`);
    console.log(`🆕 Created ${syncResult.newEventsCount} new events`);
    console.log(`🔄 Updated ${syncResult.updatedEventsCount} existing events`);
    console.log(`📈 Status updates: ${statusUpdateResult.updatedCount} events`);
    console.log(`💰 Claimable units: ${stats.totalClaimableUnits}`);
    console.log(`⏳ Waiting events: ${stats.waitingEventsCount}`);
    console.log(`✅ Claimable events: ${stats.claimableEventsCount}`);

    process.exit(0);

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Daily inventory ledger sync script failed', {
      aws: {
        operation: 'dailyInventoryLedgerSync',
        success: false
      },
      event: {
        duration
      },
      error: { 
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      }
    });

    console.error('❌ Daily inventory ledger sync failed:');
    console.error(error instanceof Error ? error.message : 'Unknown error');
    
    if (error instanceof Error && error.stack) {
      console.error('Stack trace:', error.stack);
    }

    process.exit(1);
  }
}

// Run the script if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runDailyInventoryLedgerSync();
}

export { runDailyInventoryLedgerSync };



