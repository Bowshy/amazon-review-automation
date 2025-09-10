import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { InventoryLedgerService } from '$lib/db/services/inventory-ledger';
import { logger } from '$lib/logger';
import type { InventoryLedgerFilters } from '$lib/types';

export const GET: RequestHandler = async ({ url }) => {
  const startTime = Date.now();
  
  try {
    const service = new InventoryLedgerService();

    // Parse query parameters
    const page = parseInt(url.searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 100);
    
    // Parse filters
    const filters: InventoryLedgerFilters = {};
    
    const statusParam = url.searchParams.get('status');
    if (statusParam) {
      filters.status = statusParam.split(',').filter(s => s.trim());
    }
    
    const eventTypeParam = url.searchParams.get('eventType');
    if (eventTypeParam) {
      filters.eventType = eventTypeParam.split(',').filter(s => s.trim());
    }
    
    const fulfillmentCenterParam = url.searchParams.get('fulfillmentCenter');
    if (fulfillmentCenterParam) {
      filters.fulfillmentCenter = fulfillmentCenterParam.split(',').filter(s => s.trim());
    }
    
    const dateFromParam = url.searchParams.get('dateFrom');
    if (dateFromParam) {
      filters.dateFrom = new Date(dateFromParam);
    }
    
    const dateToParam = url.searchParams.get('dateTo');
    if (dateToParam) {
      filters.dateTo = new Date(dateToParam);
    }
    
    const fnskuParam = url.searchParams.get('fnsku');
    if (fnskuParam) {
      filters.fnsku = fnskuParam;
    }
    
    const asinParam = url.searchParams.get('asin');
    if (asinParam) {
      filters.asin = asinParam;
    }
    
    const skuParam = url.searchParams.get('sku');
    if (skuParam) {
      filters.sku = skuParam;
    }

    const result = await service.getInventoryLedgerEvents(filters, page, limit);

    const duration = Date.now() - startTime;
    logger.info('API call: getInventoryLedgerEvents', {
      aws: {
        operation: 'getInventoryLedgerEvents',
        success: true
      },
      event: {
        duration
      },
      filters,
      page,
      limit,
      resultCount: result.events.length,
      totalCount: result.total
    });

    await service.disconnect();

    return json({
      success: true,
      data: result
    });

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('API call: getInventoryLedgerEvents', {
      aws: {
        operation: 'getInventoryLedgerEvents',
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

