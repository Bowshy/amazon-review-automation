import { PrismaClient } from '@prisma/client';
import { AmazonSPAPI } from '$lib/amazon-api';
import { getAmazonConfig, validateAmazonConfig } from '$lib/config/amazon';
import { logger } from '$lib/logger';
import type { 
  InventoryLedgerEventData, 
  InventoryLedgerEvent, 
  InventoryLedgerStats,
  InventoryLedgerFilters
} from '$lib/types';

export class InventoryLedgerService {
  private db: PrismaClient;
  private api: AmazonSPAPI | null = null;

  constructor() {
    this.db = new PrismaClient();
  }

  /**
   * Initialize Amazon API with configuration from environment variables
   */
  private async initializeApi(): Promise<AmazonSPAPI> {
    if (this.api) {
      return this.api;
    }

    const config = getAmazonConfig();
    
    if (!validateAmazonConfig(config)) {
      throw new Error('Amazon API configuration not found. Please configure your Amazon API credentials in environment variables.');
    }

    this.api = new AmazonSPAPI({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      refreshToken: config.refreshToken,
      marketplaceId: config.marketplaceId
    });

    return this.api;
  }

  // ===== INVENTORY LEDGER REPORT PROCESSING =====

  /**
   * Fetch and process inventory ledger report for a date range
   */
  async fetchAndProcessInventoryLedgerReport(dataStartTime: string, dataEndTime: string): Promise<{
    reportId: string;
    processedCount: number;
    newEventsCount: number;
    updatedEventsCount: number;
  }> {
    const startTime = Date.now();
    
    try {
      logger.info('Starting inventory ledger report fetch and process', {
        dataStartTime,
        dataEndTime
      });

      const api = await this.initializeApi();

      // Step 1: Create the report
      const createResponse = await api.createInventoryLedgerReport(dataStartTime, dataEndTime);
      const reportId = (createResponse as any).reportId;

      if (!reportId) {
        throw new Error('No report ID returned from Amazon API');
      }

      logger.info('Inventory ledger report created', { reportId });

      // Step 2: Wait for report to be ready
      const report = await api.waitForReportReady(reportId);
      
      if (!report.reportDocumentId) {
        throw new Error('No report document ID found in completed report');
      }

      // Step 3: Download and parse report data
      const reportData = await api.downloadInventoryLedgerReport(report.reportDocumentId);
      
      logger.info('Inventory ledger report data downloaded', {
        reportId,
        reportDocumentId: report.reportDocumentId,
        rowCount: reportData.length
      });

      // Step 4: Process and store the data
      const result = await this.processInventoryLedgerData(reportData);

      const duration = Date.now() - startTime;
      logger.info('Inventory ledger report fetch and process completed', {
        aws: {
          operation: 'fetchAndProcessInventoryLedgerReport',
          success: true
        },
        event: {
          duration
        },
        reportId,
        processedCount: result.processedCount,
        newEventsCount: result.newEventsCount,
        updatedEventsCount: result.updatedEventsCount
      });

      return {
        reportId,
        processedCount: result.processedCount,
        newEventsCount: result.newEventsCount,
        updatedEventsCount: result.updatedEventsCount
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Failed to fetch and process inventory ledger report', {
        aws: {
          operation: 'fetchAndProcessInventoryLedgerReport',
          success: false
        },
        event: {
          duration
        },
        error: { message: error instanceof Error ? error.message : 'Unknown error' },
        dataStartTime,
        dataEndTime
      });
      throw error;
    }
  }

  /**
   * Process inventory ledger data and apply business logic
   */
  private async processInventoryLedgerData(data: InventoryLedgerEventData[]): Promise<{
    processedCount: number;
    newEventsCount: number;
    updatedEventsCount: number;
  }> {
    let processedCount = 0;
    let newEventsCount = 0;
    let updatedEventsCount = 0;

    // Filter eligible event types (Phase 1 business logic)
    const eligibleEventTypes = ['Shipments', 'WhseTransfers', 'Adjustments', 'Receipts'];
    const eligibleData = data.filter(event => 
      eligibleEventTypes.includes(event.eventType) &&
      event.quantity < 0 && // Negative movement = unit left inventory
      event.unreconciledQuantity > 0 // Amazon has not resolved it yet
    );

    logger.info('Filtered eligible inventory ledger events', {
      totalEvents: data.length,
      eligibleEvents: eligibleData.length,
      eligibleEventTypes
    });

    for (const eventData of eligibleData) {
      try {
        // Check if event already exists (by unique combination of fields)
        const existingEvent = await this.db.inventoryLedgerEvent.findFirst({
          where: {
            fnsku: eventData.fnsku,
            asin: eventData.asin,
            eventDate: eventData.eventDate,
            eventType: eventData.eventType,
            referenceId: eventData.referenceId,
            fulfillmentCenter: eventData.fulfillmentCenter
          }
        });

        if (existingEvent) {
          // Update existing event if data has changed
          const hasChanges = this.hasEventDataChanged(existingEvent, eventData);
          
          if (hasChanges) {
            await this.updateInventoryLedgerEvent(existingEvent.id, eventData);
            updatedEventsCount++;
          }
        } else {
          // Create new event
          await this.createInventoryLedgerEvent(eventData);
          newEventsCount++;
        }

        processedCount++;
      } catch (error) {
        logger.error('Failed to process inventory ledger event', {
          error: { message: error instanceof Error ? error.message : 'Unknown error' },
          eventData: {
            fnsku: eventData.fnsku,
            asin: eventData.asin,
            eventType: eventData.eventType,
            eventDate: eventData.eventDate
          }
        });
      }
    }

    return { processedCount, newEventsCount, updatedEventsCount };
  }

  /**
   * Create a new inventory ledger event
   */
  private async createInventoryLedgerEvent(data: InventoryLedgerEventData): Promise<InventoryLedgerEvent> {
    const status = this.calculateEventStatus(data);
    
    const event = await this.db.inventoryLedgerEvent.create({
      data: {
        eventDate: data.eventDate,
        fnsku: data.fnsku,
        asin: data.asin,
        sku: data.sku,
        productTitle: data.productTitle,
        eventType: data.eventType,
        referenceId: data.referenceId,
        quantity: data.quantity,
        fulfillmentCenter: data.fulfillmentCenter,
        disposition: data.disposition,
        reconciledQuantity: data.reconciledQuantity,
        unreconciledQuantity: data.unreconciledQuantity,
        country: data.country,
        rawTimestamp: data.rawTimestamp,
        storeId: data.storeId,
        status
      }
    });

    logger.info('Created inventory ledger event', {
      eventId: event.id,
      fnsku: event.fnsku,
      asin: event.asin,
      eventType: event.eventType,
      status: event.status,
      quantity: event.quantity,
      unreconciledQuantity: event.unreconciledQuantity
    });

    return event;
  }

  /**
   * Update an existing inventory ledger event
   */
  private async updateInventoryLedgerEvent(eventId: string, data: InventoryLedgerEventData): Promise<InventoryLedgerEvent> {
    const status = this.calculateEventStatus(data);
    
    const event = await this.db.inventoryLedgerEvent.update({
      where: { id: eventId },
      data: {
        eventDate: data.eventDate,
        fnsku: data.fnsku,
        asin: data.asin,
        sku: data.sku,
        productTitle: data.productTitle,
        eventType: data.eventType,
        referenceId: data.referenceId,
        quantity: data.quantity,
        fulfillmentCenter: data.fulfillmentCenter,
        disposition: data.disposition,
        reconciledQuantity: data.reconciledQuantity,
        unreconciledQuantity: data.unreconciledQuantity,
        country: data.country,
        rawTimestamp: data.rawTimestamp,
        storeId: data.storeId,
        status
      }
    });

    logger.info('Updated inventory ledger event', {
      eventId: event.id,
      fnsku: event.fnsku,
      asin: event.asin,
      eventType: event.eventType,
      status: event.status,
      quantity: event.quantity,
      unreconciledQuantity: event.unreconciledQuantity
    });

    return event;
  }

  /**
   * Calculate event status based on business logic
   */
  private calculateEventStatus(data: InventoryLedgerEventData): string {
    const now = new Date();
    const eventAge = now.getTime() - data.eventDate.getTime();
    const daysOld = Math.floor(eventAge / (1000 * 60 * 60 * 24));

    // If event is less than 7 days old, mark as WAITING
    if (daysOld < 7) {
      return 'WAITING';
    }

    // If 7+ days old and still unreconciled, mark as CLAIMABLE
    if (data.unreconciledQuantity > 0) {
      return 'CLAIMABLE';
    }

    // If reconciled (unreconciled = 0), mark as RESOLVED
    return 'RESOLVED';
  }

  /**
   * Check if event data has changed
   */
  private hasEventDataChanged(existing: any, newData: InventoryLedgerEventData): boolean {
    return (
      existing.quantity !== newData.quantity ||
      existing.reconciledQuantity !== newData.reconciledQuantity ||
      existing.unreconciledQuantity !== newData.unreconciledQuantity ||
      existing.disposition !== newData.disposition ||
      existing.productTitle !== newData.productTitle
    );
  }

  // ===== STATUS MANAGEMENT =====

  /**
   * Update statuses for all events based on current business logic
   */
  async updateEventStatuses(): Promise<{
    updatedCount: number;
    waitingToClaimable: number;
    claimableToResolved: number;
  }> {
    const startTime = Date.now();
    
    try {
      logger.info('Starting inventory ledger event status update');

      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - (7 * 24 * 60 * 60 * 1000));

      // Update WAITING events that are now 7+ days old to CLAIMABLE
      const waitingToClaimable = await this.db.inventoryLedgerEvent.updateMany({
        where: {
          status: 'WAITING',
          eventDate: {
            lte: sevenDaysAgo
          },
          unreconciledQuantity: {
            gt: 0
          }
        },
        data: {
          status: 'CLAIMABLE'
        }
      });

      // Update CLAIMABLE events that are now reconciled to RESOLVED
      const claimableToResolved = await this.db.inventoryLedgerEvent.updateMany({
        where: {
          status: 'CLAIMABLE',
          unreconciledQuantity: 0
        },
        data: {
          status: 'RESOLVED'
        }
      });

      const updatedCount = waitingToClaimable.count + claimableToResolved.count;

      const duration = Date.now() - startTime;
      logger.info('Inventory ledger event status update completed', {
        aws: {
          operation: 'updateEventStatuses',
          success: true
        },
        event: {
          duration
        },
        updatedCount,
        waitingToClaimable: waitingToClaimable.count,
        claimableToResolved: claimableToResolved.count
      });

      return {
        updatedCount,
        waitingToClaimable: waitingToClaimable.count,
        claimableToResolved: claimableToResolved.count
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Failed to update inventory ledger event statuses', {
        aws: {
          operation: 'updateEventStatuses',
          success: false
        },
        event: {
          duration
        },
        error: { message: error instanceof Error ? error.message : 'Unknown error' }
      });
      throw error;
    }
  }

  // ===== DATA RETRIEVAL =====

  /**
   * Get inventory ledger events with filtering and pagination
   */
  async getInventoryLedgerEvents(
    filters: InventoryLedgerFilters = {},
    page: number = 1,
    limit: number = 50
  ): Promise<{
    events: InventoryLedgerEvent[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const skip = (page - 1) * limit;
    
    const where: any = {};

    // Apply filters
    if (filters.status && filters.status.length > 0) {
      where.status = { in: filters.status };
    }

    if (filters.eventType && filters.eventType.length > 0) {
      where.eventType = { in: filters.eventType };
    }

    if (filters.fulfillmentCenter && filters.fulfillmentCenter.length > 0) {
      where.fulfillmentCenter = { in: filters.fulfillmentCenter };
    }

    if (filters.dateFrom || filters.dateTo) {
      where.eventDate = {};
      if (filters.dateFrom) {
        where.eventDate.gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        where.eventDate.lte = filters.dateTo;
      }
    }

    if (filters.fnsku) {
      where.fnsku = { contains: filters.fnsku, mode: 'insensitive' };
    }

    if (filters.asin) {
      where.asin = { contains: filters.asin, mode: 'insensitive' };
    }

    if (filters.sku) {
      where.sku = { contains: filters.sku, mode: 'insensitive' };
    }

    const [events, total] = await Promise.all([
      this.db.inventoryLedgerEvent.findMany({
        where,
        orderBy: { eventDate: 'desc' },
        skip,
        take: limit
      }),
      this.db.inventoryLedgerEvent.count({ where })
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      events,
      total,
      page,
      limit,
      totalPages
    };
  }

  /**
   * Get inventory ledger statistics
   */
  async getInventoryLedgerStats(): Promise<InventoryLedgerStats> {
    try {
      const [
        claimableEvents,
        waitingEvents,
        resolvedEvents,
        claimedEvents,
        paidEvents
      ] = await Promise.all([
        this.db.inventoryLedgerEvent.findMany({
          where: { status: 'CLAIMABLE' },
          select: { quantity: true, unreconciledQuantity: true }
        }),
        this.db.inventoryLedgerEvent.findMany({
          where: { status: 'WAITING' },
          select: { quantity: true, unreconciledQuantity: true }
        }),
        this.db.inventoryLedgerEvent.count({
          where: { status: 'RESOLVED' }
        }),
        this.db.inventoryLedgerEvent.count({
          where: { status: 'CLAIMED' }
        }),
        this.db.inventoryLedgerEvent.count({
          where: { status: 'PAID' }
        })
      ]);

      const totalClaimableUnits = claimableEvents.reduce((sum, event) => 
        sum + Math.abs(event.unreconciledQuantity), 0
      );

      const totalWaiting = waitingEvents.reduce((sum, event) => 
        sum + Math.abs(event.unreconciledQuantity), 0
      );

      // TODO: Calculate estimated value based on COGS (Phase 2)
      const totalEstimatedValue = 0;

      return {
        totalClaimableUnits,
        totalEstimatedValue,
        totalWaiting,
        totalResolved: resolvedEvents,
        totalClaimed: claimedEvents,
        totalPaid: paidEvents,
        claimableEventsCount: claimableEvents.length,
        waitingEventsCount: waitingEvents.length
      };
    } catch (error) {
      // If table doesn't exist, return empty stats
      if (error instanceof Error && error.message.includes('does not exist')) {
        logger.warn('Inventory ledger events table does not exist, returning empty stats');
        return {
          totalClaimableUnits: 0,
          totalEstimatedValue: 0,
          totalWaiting: 0,
          totalResolved: 0,
          totalClaimed: 0,
          totalPaid: 0,
          claimableEventsCount: 0,
          waitingEventsCount: 0
        };
      }
      throw error;
    }
  }

  /**
   * Get claimable events for dashboard display
   */
  async getClaimableEvents(limit: number = 100): Promise<InventoryLedgerEvent[]> {
    try {
      return await this.db.inventoryLedgerEvent.findMany({
        where: { status: 'CLAIMABLE' },
        orderBy: { eventDate: 'desc' },
        take: limit
      });
    } catch (error) {
      // If table doesn't exist, return empty array
      if (error instanceof Error && error.message.includes('does not exist')) {
        logger.warn('Inventory ledger events table does not exist, returning empty events');
        return [];
      }
      throw error;
    }
  }

  /**
   * Generate claim text for an event
   */
  generateClaimText(event: InventoryLedgerEvent): string {
    const eventDate = event.eventDate.toISOString().split('T')[0];
    const quantity = Math.abs(event.unreconciledQuantity);
    
    return `FNSKU ${event.fnsku} (ASIN ${event.asin}) lost in FC ${event.fulfillmentCenter || 'Unknown'} on ${eventDate}. Quantity unreconciled: ${quantity}. Please review and reimburse.`;
  }

  /**
   * Update event status to CLAIMED
   */
  async markEventAsClaimed(eventId: string): Promise<InventoryLedgerEvent> {
    return this.db.inventoryLedgerEvent.update({
      where: { id: eventId },
      data: { status: 'CLAIMED' }
    });
  }

  /**
   * Update event status to PAID
   */
  async markEventAsPaid(eventId: string): Promise<InventoryLedgerEvent> {
    return this.db.inventoryLedgerEvent.update({
      where: { id: eventId },
      data: { status: 'PAID' }
    });
  }

  /**
   * Clean up old resolved events (optional maintenance)
   */
  async cleanupOldResolvedEvents(daysOld: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    const result = await this.db.inventoryLedgerEvent.deleteMany({
      where: {
        status: 'RESOLVED',
        updatedAt: {
          lt: cutoffDate
        }
      }
    });

    logger.info('Cleaned up old resolved inventory ledger events', {
      deletedCount: result.count,
      cutoffDate
    });

    return result.count;
  }

  /**
   * Close database connection
   */
  async disconnect(): Promise<void> {
    await this.db.$disconnect();
  }
}
