import fs from 'fs/promises';
import path from 'path';
import { logger } from '$lib/logger';
import type { InventoryLedgerEvent, InventoryLedgerStats } from '$lib/types';

export interface DebugReportData {
  timestamp: string;
  reportId?: string;
  dataStartTime: string;
  dataEndTime: string;
  syncResult?: {
    processedCount: number;
    newEventsCount: number;
    updatedEventsCount: number;
  };
  statusUpdateResult?: {
    updatedCount: number;
    waitingToClaimable: number;
    claimableToResolved: number;
  };
  stats: InventoryLedgerStats;
  claimableEvents: InventoryLedgerEvent[];
  apiResponses?: {
    createReportResponse?: any;
    reportStatusResponse?: any;
    reportDataResponse?: any;
  };
  errors?: any[];
  duration: number;
}

export interface DebugApiResponse {
  timestamp: string;
  operation: string;
  request: any;
  response: any;
  duration: number;
  success: boolean;
  error?: any;
}

export class InventoryLedgerDebugUtils {
  private static readonly DEBUG_DIR = path.join(process.cwd(), 'debug', 'inventory-ledger');
  private static readonly REPORTS_DIR = path.join(this.DEBUG_DIR, 'reports');
  private static readonly API_LOGS_DIR = path.join(this.DEBUG_DIR, 'api-logs');
  private static readonly STATS_DIR = path.join(this.DEBUG_DIR, 'stats');

  /**
   * Ensure debug directories exist
   */
  private static async ensureDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.DEBUG_DIR, { recursive: true });
      await fs.mkdir(this.REPORTS_DIR, { recursive: true });
      await fs.mkdir(this.API_LOGS_DIR, { recursive: true });
      await fs.mkdir(this.STATS_DIR, { recursive: true });
    } catch (error) {
      logger.error('Failed to create debug directories', {
        error: { message: error instanceof Error ? error.message : 'Unknown error' },
        debugDir: this.DEBUG_DIR
      });
      throw error;
    }
  }

  /**
   * Save complete inventory ledger sync report data for debugging
   */
  static async saveSyncReport(data: DebugReportData): Promise<string> {
    try {
      await this.ensureDirectories();
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `inventory-ledger-sync-${timestamp}.json`;
      const filepath = path.join(this.REPORTS_DIR, filename);
      
      const debugData = {
        ...data,
        metadata: {
          savedAt: new Date().toISOString(),
          version: '1.0',
          environment: process.env.NODE_ENV || 'development'
        }
      };

      await fs.writeFile(filepath, JSON.stringify(debugData, null, 2));
      
      logger.info('Saved inventory ledger sync report for debugging', {
        filepath,
        filename,
        reportId: data.reportId,
        dataStartTime: data.dataStartTime,
        dataEndTime: data.dataEndTime,
        processedCount: data.syncResult?.processedCount,
        newEventsCount: data.syncResult?.newEventsCount,
        updatedEventsCount: data.syncResult?.updatedEventsCount,
        claimableEventsCount: data.claimableEvents.length,
        totalClaimableUnits: data.stats.totalClaimableUnits,
        duration: data.duration
      });

      return filepath;
    } catch (error) {
      logger.error('Failed to save inventory ledger sync report', {
        error: { message: error instanceof Error ? error.message : 'Unknown error' },
        dataStartTime: data.dataStartTime,
        dataEndTime: data.dataEndTime
      });
      throw error;
    }
  }

  /**
   * Save API response data for debugging
   */
  static async saveApiResponse(data: DebugApiResponse): Promise<string> {
    try {
      await this.ensureDirectories();
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `api-response-${data.operation}-${timestamp}.json`;
      const filepath = path.join(this.API_LOGS_DIR, filename);
      
      const debugData = {
        ...data,
        metadata: {
          savedAt: new Date().toISOString(),
          version: '1.0',
          environment: process.env.NODE_ENV || 'development'
        }
      };

      await fs.writeFile(filepath, JSON.stringify(debugData, null, 2));
      
      logger.info('Saved API response for debugging', {
        filepath,
        filename,
        operation: data.operation,
        success: data.success,
        duration: data.duration
      });

      return filepath;
    } catch (error) {
      logger.error('Failed to save API response', {
        error: { message: error instanceof Error ? error.message : 'Unknown error' },
        operation: data.operation
      });
      throw error;
    }
  }

  /**
   * Save current inventory ledger statistics for debugging
   */
  static async saveCurrentStats(stats: InventoryLedgerStats, claimableEvents: InventoryLedgerEvent[]): Promise<string> {
    try {
      await this.ensureDirectories();
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `inventory-ledger-stats-${timestamp}.json`;
      const filepath = path.join(this.STATS_DIR, filename);
      
      const debugData = {
        timestamp: new Date().toISOString(),
        stats,
        claimableEvents,
        metadata: {
          savedAt: new Date().toISOString(),
          version: '1.0',
          environment: process.env.NODE_ENV || 'development',
          totalClaimableEvents: claimableEvents.length
        }
      };

      await fs.writeFile(filepath, JSON.stringify(debugData, null, 2));
      
      logger.info('Saved current inventory ledger stats for debugging', {
        filepath,
        filename,
        totalClaimableUnits: stats.totalClaimableUnits,
        totalWaiting: stats.totalWaiting,
        claimableEventsCount: stats.claimableEventsCount,
        waitingEventsCount: stats.waitingEventsCount,
        totalResolved: stats.totalResolved,
        claimableEventsLength: claimableEvents.length
      });

      return filepath;
    } catch (error) {
      logger.error('Failed to save current inventory ledger stats', {
        error: { message: error instanceof Error ? error.message : 'Unknown error' }
      });
      throw error;
    }
  }

  /**
   * List all saved debug reports
   */
  static async listDebugReports(): Promise<string[]> {
    try {
      await this.ensureDirectories();
      const files = await fs.readdir(this.REPORTS_DIR);
      return files.filter(file => file.endsWith('.json')).sort().reverse();
    } catch (error) {
      logger.error('Failed to list debug reports', {
        error: { message: error instanceof Error ? error.message : 'Unknown error' }
      });
      return [];
    }
  }

  /**
   * List all saved API logs
   */
  static async listApiLogs(): Promise<string[]> {
    try {
      await this.ensureDirectories();
      const files = await fs.readdir(this.API_LOGS_DIR);
      return files.filter(file => file.endsWith('.json')).sort().reverse();
    } catch (error) {
      logger.error('Failed to list API logs', {
        error: { message: error instanceof Error ? error.message : 'Unknown error' }
      });
      return [];
    }
  }

  /**
   * List all saved stats files
   */
  static async listStatsFiles(): Promise<string[]> {
    try {
      await this.ensureDirectories();
      const files = await fs.readdir(this.STATS_DIR);
      return files.filter(file => file.endsWith('.json')).sort().reverse();
    } catch (error) {
      logger.error('Failed to list stats files', {
        error: { message: error instanceof Error ? error.message : 'Unknown error' }
      });
      return [];
    }
  }

  /**
   * Load a specific debug report
   */
  static async loadDebugReport(filename: string): Promise<DebugReportData | null> {
    try {
      const filepath = path.join(this.REPORTS_DIR, filename);
      const content = await fs.readFile(filepath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      logger.error('Failed to load debug report', {
        error: { message: error instanceof Error ? error.message : 'Unknown error' },
        filename
      });
      return null;
    }
  }

  /**
   * Load a specific API log
   */
  static async loadApiLog(filename: string): Promise<DebugApiResponse | null> {
    try {
      const filepath = path.join(this.API_LOGS_DIR, filename);
      const content = await fs.readFile(filepath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      logger.error('Failed to load API log', {
        error: { message: error instanceof Error ? error.message : 'Unknown error' },
        filename
      });
      return null;
    }
  }

  /**
   * Clean up old debug files (older than specified days)
   */
  static async cleanupOldFiles(daysOld: number = 30): Promise<{ deletedCount: number; errors: string[] }> {
    try {
      await this.ensureDirectories();
      
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);
      
      let deletedCount = 0;
      const errors: string[] = [];
      
      // Clean up reports
      try {
        const reportFiles = await fs.readdir(this.REPORTS_DIR);
        for (const file of reportFiles) {
          const filepath = path.join(this.REPORTS_DIR, file);
          const stats = await fs.stat(filepath);
          if (stats.mtime < cutoffDate) {
            await fs.unlink(filepath);
            deletedCount++;
          }
        }
      } catch (error) {
        errors.push(`Failed to cleanup reports: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
      // Clean up API logs
      try {
        const apiLogFiles = await fs.readdir(this.API_LOGS_DIR);
        for (const file of apiLogFiles) {
          const filepath = path.join(this.API_LOGS_DIR, file);
          const stats = await fs.stat(filepath);
          if (stats.mtime < cutoffDate) {
            await fs.unlink(filepath);
            deletedCount++;
          }
        }
      } catch (error) {
        errors.push(`Failed to cleanup API logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
      // Clean up stats
      try {
        const statsFiles = await fs.readdir(this.STATS_DIR);
        for (const file of statsFiles) {
          const filepath = path.join(this.STATS_DIR, file);
          const stats = await fs.stat(filepath);
          if (stats.mtime < cutoffDate) {
            await fs.unlink(filepath);
            deletedCount++;
          }
        }
      } catch (error) {
        errors.push(`Failed to cleanup stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      
      logger.info('Cleaned up old debug files', {
        deletedCount,
        daysOld,
        errors: errors.length > 0 ? errors : undefined
      });
      
      return { deletedCount, errors };
    } catch (error) {
      logger.error('Failed to cleanup old debug files', {
        error: { message: error instanceof Error ? error.message : 'Unknown error' },
        daysOld
      });
      throw error;
    }
  }

  /**
   * Save raw report data for debugging
   */
  static async saveRawReportData(reportDocumentId: string, rawData: string): Promise<string> {
    try {
      await this.ensureDirectories();
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `raw-report-${reportDocumentId}-${timestamp}.tsv`;
      const filepath = path.join(this.REPORTS_DIR, filename);
      
      await fs.writeFile(filepath, rawData);
      
      logger.info('Saved raw inventory ledger report data for debugging', {
        filepath,
        filename,
        reportDocumentId,
        dataLength: rawData.length,
        lineCount: rawData.split('\n').length
      });

      return filepath;
    } catch (error) {
      logger.error('Failed to save raw report data', {
        error: { message: error instanceof Error ? error.message : 'Unknown error' },
        reportDocumentId
      });
      throw error;
    }
  }

  /**
   * Get debug directory information
   */
  static async getDebugInfo(): Promise<{
    debugDir: string;
    reportsCount: number;
    apiLogsCount: number;
    statsCount: number;
    totalSize: number;
  }> {
    try {
      await this.ensureDirectories();
      
      const reportFiles = await fs.readdir(this.REPORTS_DIR);
      const apiLogFiles = await fs.readdir(this.API_LOGS_DIR);
      const statsFiles = await fs.readdir(this.STATS_DIR);
      
      let totalSize = 0;
      
      // Calculate total size
      for (const file of [...reportFiles, ...apiLogFiles, ...statsFiles]) {
        try {
          const filepath = path.join(this.DEBUG_DIR, file);
          const stats = await fs.stat(filepath);
          totalSize += stats.size;
        } catch (error) {
          // Ignore individual file errors
        }
      }
      
      return {
        debugDir: this.DEBUG_DIR,
        reportsCount: reportFiles.length,
        apiLogsCount: apiLogFiles.length,
        statsCount: statsFiles.length,
        totalSize
      };
    } catch (error) {
      logger.error('Failed to get debug info', {
        error: { message: error instanceof Error ? error.message : 'Unknown error' }
      });
      return {
        debugDir: this.DEBUG_DIR,
        reportsCount: 0,
        apiLogsCount: 0,
        statsCount: 0,
        totalSize: 0
      };
    }
  }
}
