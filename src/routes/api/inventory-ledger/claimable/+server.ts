import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { InventoryLedgerService } from '$lib/db/services/inventory-ledger';
import { logger } from '$lib/logger';

export const GET: RequestHandler = async ({ url }) => {
  const startTime = Date.now();
  
  try {
    // Parse and validate query parameters
    const limitParam = url.searchParams.get('limit') || '100';
    const limit = Math.min(parseInt(limitParam, 10), 500);
    const offset = Math.max(parseInt(url.searchParams.get('offset') || '0', 10), 0);
    const sortBy = url.searchParams.get('sortBy') || 'eventDate';
    const sortOrder = url.searchParams.get('sortOrder') || 'desc';
    const cacheControl = url.searchParams.get('cache') || 'no-cache';

    // Validate parameters
    if (isNaN(limit) || limit < 1) {
      return error(400, {
        message: 'Invalid limit parameter',
        details: 'Limit must be a positive number'
      });
    }

    if (isNaN(offset) || offset < 0) {
      return error(400, {
        message: 'Invalid offset parameter', 
        details: 'Offset must be a non-negative number'
      });
    }

    const validSortFields = ['eventDate', 'fnsku', 'asin', 'sku', 'eventType', 'fulfillmentCenter', 'unreconciledQuantity'];
    if (!validSortFields.includes(sortBy)) {
      return error(400, {
        message: 'Invalid sortBy parameter',
        details: `Sort field must be one of: ${validSortFields.join(', ')}`
      });
    }

    const validSortOrders = ['asc', 'desc'];
    if (!validSortOrders.includes(sortOrder)) {
      return error(400, {
        message: 'Invalid sortOrder parameter',
        details: 'Sort order must be "asc" or "desc"'
      });
    }

    logger.info('API call: getClaimableEvents', {
      aws: {
        operation: 'getClaimableEvents',
        success: true
      },
      event: {
        startTime: new Date(startTime).toISOString()
      },
      request: {
        limit,
        offset,
        sortBy,
        sortOrder,
        cacheControl
      }
    });

    const service = new InventoryLedgerService();
    
    // Get claimable events with proper error handling
    const events = await service.getClaimableEvents(limit, offset, sortBy, sortOrder);

    const duration = Date.now() - startTime;
    
    logger.info('API call: getClaimableEvents completed', {
      aws: {
        operation: 'getClaimableEvents',
        success: true
      },
      event: {
        duration,
        endTime: new Date().toISOString()
      },
      response: {
        resultCount: events.length,
        limit,
        offset
      }
    });

    await service.disconnect();

    return json({
      success: true,
      data: events,
      meta: {
        timestamp: new Date().toISOString(),
        duration,
        pagination: {
          limit,
          offset,
          hasMore: events.length === limit
        },
        sorting: {
          sortBy,
          sortOrder
        }
      }
    }, {
      headers: {
        'Cache-Control': cacheControl === 'cache' ? 'public, max-age=60' : 'no-cache',
        'Content-Type': 'application/json'
      }
    });

  } catch (err) {
    const duration = Date.now() - startTime;
    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
    
    logger.error('API call: getClaimableEvents failed', {
      aws: {
        operation: 'getClaimableEvents',
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
      details: 'Failed to retrieve claimable events'
    });
  }
};

