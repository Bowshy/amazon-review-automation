import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { InventoryLedgerService } from '$lib/db/services/inventory-ledger';
import { logger } from '$lib/logger';

export const load: PageServerLoad = async ({ url, fetch }) => {
  const startTime = Date.now();
  
  try {
    logger.info('Loading inventory ledger page data', {
      aws: {
        operation: 'loadInventoryLedgerPage',
        success: true
      },
      event: {
        startTime: new Date(startTime).toISOString()
      },
      request: {
        url: url.toString(),
        userAgent: url.searchParams.get('userAgent') || 'unknown'
      }
    });

    // Use SvelteKit's special fetch for server-side requests
    const [statsResponse, claimableResponse] = await Promise.all([
      fetch('/api/inventory-ledger/stats?cache=cache'),
      fetch('/api/inventory-ledger/claimable?limit=100&cache=cache')
    ]);

    if (!statsResponse.ok) {
      const errorData = await statsResponse.json().catch(() => ({}));
      logger.error('Failed to load inventory ledger stats', {
        aws: {
          operation: 'loadInventoryLedgerPage',
          success: false
        },
        error: {
          status: statsResponse.status,
          statusText: statsResponse.statusText,
          ...errorData
        }
      });
      
      if (statsResponse.status >= 500) {
        throw error(503, {
          message: 'Service temporarily unavailable',
          details: 'Unable to load inventory ledger statistics'
        });
      }
      
      throw error(statsResponse.status, {
        message: 'Failed to load statistics',
        details: errorData.message || statsResponse.statusText
      });
    }

    if (!claimableResponse.ok) {
      const errorData = await claimableResponse.json().catch(() => ({}));
      logger.error('Failed to load claimable events', {
        aws: {
          operation: 'loadInventoryLedgerPage',
          success: false
        },
        error: {
          status: claimableResponse.status,
          statusText: claimableResponse.statusText,
          ...errorData
        }
      });
      
      if (claimableResponse.status >= 500) {
        throw error(503, {
          message: 'Service temporarily unavailable',
          details: 'Unable to load claimable events'
        });
      }
      
      throw error(claimableResponse.status, {
        message: 'Failed to load claimable events',
        details: errorData.message || claimableResponse.statusText
      });
    }

    const statsData = await statsResponse.json();
    const claimableData = await claimableResponse.json();

    if (!statsData.success) {
      throw error(500, {
        message: 'Invalid response from stats API',
        details: statsData.error || 'Unknown error'
      });
    }

    if (!claimableData.success) {
      throw error(500, {
        message: 'Invalid response from claimable events API',
        details: claimableData.error || 'Unknown error'
      });
    }

    const duration = Date.now() - startTime;
    
    logger.info('Inventory ledger page data loaded successfully', {
      aws: {
        operation: 'loadInventoryLedgerPage',
        success: true
      },
      event: {
        duration,
        endTime: new Date().toISOString()
      },
      response: {
        statsLoaded: !!statsData.data,
        claimableEventsCount: claimableData.data?.length || 0,
        totalClaimableUnits: statsData.data?.totalClaimableUnits || 0
      }
    });

    return {
      stats: statsData.data,
      claimableEvents: claimableData.data || [],
      meta: {
        timestamp: new Date().toISOString(),
        duration,
        statsMeta: statsData.meta,
        claimableMeta: claimableData.meta
      }
    };

  } catch (err) {
    const duration = Date.now() - startTime;
    const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
    
    logger.error('Failed to load inventory ledger page data', {
      aws: {
        operation: 'loadInventoryLedgerPage',
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

    // Re-throw SvelteKit errors as-is
    if (err && typeof err === 'object' && 'status' in err) {
      throw err;
    }

    // Handle other errors
    if (errorMessage.includes('does not exist') || errorMessage.includes('table')) {
      throw error(503, {
        message: 'Service temporarily unavailable',
        details: 'Database schema not initialized'
      });
    }

    if (errorMessage.includes('connection') || errorMessage.includes('timeout')) {
      throw error(503, {
        message: 'Service temporarily unavailable', 
        details: 'Database connection issue'
      });
    }

    throw error(500, {
      message: 'Internal server error',
      details: 'Failed to load inventory ledger data'
    });
  }
};

