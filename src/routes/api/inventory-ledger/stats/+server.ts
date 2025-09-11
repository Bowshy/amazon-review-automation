import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { InventoryLedgerService } from '$lib/db/services/inventory-ledger';
import { logger } from '$lib/logger';

export const GET: RequestHandler = async ({ url }) => {
  const startTime = Date.now();
  
  try {
    // Validate request parameters
    const cacheControl = url.searchParams.get('cache') || 'no-cache';
    
    logger.info('API call: getInventoryLedgerStats', {
      aws: {
        operation: 'getInventoryLedgerStats',
        success: true
      },
      event: {
        startTime: new Date(startTime).toISOString()
      },
      request: {
        cacheControl,
        userAgent: url.searchParams.get('userAgent') || 'unknown'
      }
    });

    const service = new InventoryLedgerService();
    
    // Get stats with proper error handling
    const stats = await service.getInventoryLedgerStats();

    const duration = Date.now() - startTime;
    
    logger.info('API call: getInventoryLedgerStats completed', {
      aws: {
        operation: 'getInventoryLedgerStats',
        success: true
      },
      event: {
        duration,
        endTime: new Date().toISOString()
      },
      response: {
        totalClaimableUnits: stats.totalClaimableUnits,
        totalWaiting: stats.totalWaiting,
        claimableEventsCount: stats.claimableEventsCount,
        waitingEventsCount: stats.waitingEventsCount
      }
    });

    await service.disconnect();

    return json({
      success: true,
      data: stats,
      meta: {
        timestamp: new Date().toISOString(),
        duration
      }
    }, {
      headers: {
        'Cache-Control': cacheControl === 'cache' ? 'public, max-age=300' : 'no-cache',
        'Content-Type': 'application/json'
      }
    });

  } catch (err) {
    const duration = Date.now() - startTime;
    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
    
    logger.error('API call: getInventoryLedgerStats failed', {
      aws: {
        operation: 'getInventoryLedgerStats',
        success: false
      },
      event: {
        duration,
        endTime: new Date().toISOString()
      },
      error: { 
        message: errorMessage,
        stack: err instanceof Error ? err.stack : undefined,
        name: err instanceof Error ? err.name : 'UnknownError'
      }
    });

    // Return appropriate HTTP status based on error type
    if (errorMessage.includes('does not exist') || errorMessage.includes('table')) {
      return error(503, {
        message: 'Service temporarily unavailable',
        details: 'Database schema not initialized'
      });
    }

    if (errorMessage.includes('connection') || errorMessage.includes('timeout')) {
      return error(503, {
        message: 'Service temporarily unavailable', 
        details: 'Database connection issue'
      });
    }

    return error(500, {
      message: 'Internal server error',
      details: 'Failed to retrieve inventory ledger statistics'
    });
  }
};

