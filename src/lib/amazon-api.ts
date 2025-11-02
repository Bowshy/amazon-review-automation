import { SellingPartner } from 'amazon-sp-api';
import type {
	AmazonAPIConfig,
	GetOrdersResponse,
	CreateProductReviewAndSellerFeedbackSolicitationResponse,
	GetSolicitationActionsForOrderResponse,
	InventoryLedgerEventData
} from './types';
import { logger } from './logger';

export class AmazonSPAPI {
	private client: SellingPartner;
	private config: AmazonAPIConfig;

	constructor(config: AmazonAPIConfig) {
		this.config = config;
		logger.info('Initializing Amazon SP-API client', {
			hasClientId: !!config.clientId,
			hasClientSecret: !!config.clientSecret,
			hasRefreshToken: !!config.refreshToken,
			hasMarketplaceId: !!config.marketplaceId,
			marketplaceId: config.marketplaceId
		});

		// Initialize the Selling Partner API client using amazon-sp-api SDK
		this.client = new SellingPartner({
			region: this.getRegionFromMarketplaceId(config.marketplaceId),
			refresh_token: config.refreshToken,
			credentials: {
				SELLING_PARTNER_APP_CLIENT_ID: config.clientId,
				SELLING_PARTNER_APP_CLIENT_SECRET: config.clientSecret
			},
			options: {
				auto_request_tokens: true,
				auto_request_throttled: true,
				version_fallback: true,
				use_sandbox: config.isTest || false,
				debug_log: process.env.NODE_ENV === 'development'
			}
		});
	}

	// Helper method to determine region from marketplace ID
	private getRegionFromMarketplaceId(marketplaceId: string): 'na' | 'eu' | 'fe' {
		// North America marketplaces
		if (
			marketplaceId.startsWith('ATVPDKIKX0DER') || // US
			marketplaceId.startsWith('A2EUQ1WTGCTBG2') || // Canada
			marketplaceId.startsWith('A1AM78C64UM0Y8') || // Mexico
			marketplaceId.startsWith('A2Q3Y263D00KWC')
		) {
			// Brazil
			return 'na';
		}
		// Europe marketplaces
		else if (
			marketplaceId.startsWith('A1PA6795UKMFR9') || // Germany
			marketplaceId.startsWith('A1RKKUPIHCS9HS') || // Spain
			marketplaceId.startsWith('A1F83G8C2ARO7P') || // UK
			marketplaceId.startsWith('A13V1IB3VIYZZH') || // France
			marketplaceId.startsWith('A21TJRUUN4KGV') || // India
			marketplaceId.startsWith('APJ6JRA9NG5V4') || // Italy
			marketplaceId.startsWith('A1805F23G6M6Q9') || // Netherlands
			marketplaceId.startsWith('A1C3SOZRARQ6R3') || // Poland
			marketplaceId.startsWith('A17E79C6D8DWNP') || // Sweden
			marketplaceId.startsWith('A2VIGQ35RCS4UG') || // UAE
			marketplaceId.startsWith('A33AVAJ2PDY3EV') || // Turkey
			marketplaceId.startsWith('AMEN7PMS3EDWL') || // Belgium
			marketplaceId.startsWith('A2NODRKZP88ZB9') || // Saudi Arabia
			marketplaceId.startsWith('A1VC38T7YXB528') || // Japan
			marketplaceId.startsWith('AAHKV2X7AFYLW')
		) {
			// Singapore
			return 'eu';
		}
		// Far East marketplaces
		else if (
			marketplaceId.startsWith('A19VAU5U5O7RUS') || // Australia
			marketplaceId.startsWith('A39IBJ37TRP1C6')
		) {
			// Japan (alternative)
			return 'fe';
		}
		return 'na'; // Default to North America
	}

	// Get LWA Access Token (handled automatically by SDK)
	async getAccessToken(): Promise<{ access_token: string; expires_in: number }> {
		try {
			// The SDK handles token management automatically
			// We can access the current token if needed
			const token = this.client.access_token;
			if (!token) {
				// Force a token refresh
				await this.client.refreshAccessToken();
			}

			return {
				access_token: this.client.access_token || '',
				expires_in: 3600 // Default expiry time
			};
		} catch (error: any) {
			logger.error('Failed to get access token', {
				error: { message: error.message, stack_trace: error.stack },
				operation: 'getAccessToken'
			});
			throw new Error('Failed to authenticate with Amazon SP-API');
		}
	}

	// Get Orders using the SDK
	async getOrders(createdAfter: string, nextToken?: string): Promise<GetOrdersResponse> {
		const startTime = Date.now();

		try {
			const query: Record<string, unknown> = {
				MarketplaceIds: [this.config.marketplaceId],
				CreatedAfter: createdAfter,
				MaxResultsPerPage: 50
			};

			if (nextToken) {
				query.NextToken = nextToken;
			}

			logger.info('Calling Amazon SP-API getOrders', {
				marketplaceId: this.config.marketplaceId,
				createdAfter,
				hasNextToken: !!nextToken
			});

			const response = await this.client.callAPI({
				operation: 'getOrders',
				endpoint: 'orders',
				query
			});

			const duration = Date.now() - startTime;
			const orderCount = (response as GetOrdersResponse).Orders?.length || 0;

			logger.info('Amazon API call: getOrders', {
				aws: {
					operation: 'getOrders',
					success: true
				},
				event: {
					duration
				},
				orderCount,
				hasNextToken: !!(response as GetOrdersResponse).NextToken,
				marketplaceId: this.config.marketplaceId
			});

			return response as GetOrdersResponse;
		} catch (error) {
			const duration = Date.now() - startTime;

			logger.error('Amazon API call: getOrders', {
				aws: {
					operation: 'getOrders',
					success: false
				},
				event: {
					duration
				},
				error: { message: error instanceof Error ? error.message : 'Unknown error' },
				marketplaceId: this.config.marketplaceId
			});

			throw new Error(
				`Failed to fetch orders: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}

	// Get Order Items using the SDK
	async getOrderItems(orderId: string): Promise<Record<string, unknown> | unknown> {
		const startTime = Date.now();

		try {
			const response = await this.client.callAPI({
				operation: 'getOrderItems',
				endpoint: 'orders',
				path: {
					orderId
				}
			});

			const duration = Date.now() - startTime;
			logger.info('Amazon API call: getOrderItems', {
				aws: {
					operation: 'getOrderItems',
					success: true
				},
				event: {
					duration
				},
				orderId
			});

			return response;
		} catch (error) {
			const duration = Date.now() - startTime;
			logger.error('Amazon API call: getOrderItems', {
				aws: {
					operation: 'getOrderItems',
					success: false
				},
				event: {
					duration
				},
				error: { message: error instanceof Error ? error.message : 'Unknown error' },
				orderId
			});
			throw new Error(
				`Failed to fetch order items: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}

	// Create Returns Report using the SDK
	async createReturnsReport(
		dataStartTime: string,
		dataEndTime: string
	): Promise<Record<string, unknown> | unknown> {
		const startTime = Date.now();

		try {
			const response = await this.client.callAPI({
				operation: 'createReport',
				endpoint: 'reports',
				body: {
					marketplaceIds: [this.config.marketplaceId],
					reportType: 'GET_FLAT_FILE_RETURNS_DATA_BY_RETURN_DATE',
					dataStartTime,
					dataEndTime
				}
			});

			const duration = Date.now() - startTime;
			logger.info('Amazon API call: createReturnsReport', {
				aws: {
					operation: 'createReturnsReport',
					success: true
				},
				event: {
					duration
				},
				dataStartTime,
				dataEndTime,
				marketplaceId: this.config.marketplaceId
			});

			return response;
		} catch (error) {
			const duration = Date.now() - startTime;
			logger.error('Amazon API call: createReturnsReport', {
				aws: {
					operation: 'createReturnsReport',
					success: false
				},
				event: {
					duration
				},
				error: { message: error instanceof Error ? error.message : 'Unknown error' },
				dataStartTime,
				dataEndTime,
				marketplaceId: this.config.marketplaceId
			});
			throw new Error(
				`Failed to create returns report: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}

	// Get Report Status using the SDK
	async getReport(reportId: string): Promise<Record<string, unknown> | unknown> {
		const startTime = Date.now();

		try {
			const response = await this.client.callAPI({
				operation: 'getReport',
				endpoint: 'reports',
				path: {
					reportId
				}
			});

			const duration = Date.now() - startTime;
			logger.info('Amazon API call: getReport', {
				aws: {
					operation: 'getReport',
					success: true
				},
				event: {
					duration
				},
				reportId
			});

			return response;
		} catch (error) {
			const duration = Date.now() - startTime;
			logger.error('Amazon API call: getReport', {
				aws: {
					operation: 'getReport',
					success: false
				},
				event: {
					duration
				},
				error: { message: error instanceof Error ? error.message : 'Unknown error' },
				reportId
			});
			throw new Error(
				`Failed to get report: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}

	// Get Report Document using the SDK
	async getReportDocument(reportDocumentId: string): Promise<any> {
		const startTime = Date.now();

		try {
			const response = await this.client.callAPI({
				operation: 'getReportDocument',
				endpoint: 'reports',
				path: {
					reportDocumentId
				}
			});

			const duration = Date.now() - startTime;
			logger.info('Amazon API call: getReportDocument', {
				aws: {
					operation: 'getReportDocument',
					success: true
				},
				event: {
					duration
				},
				reportDocumentId
			});

			return response;
		} catch (error) {
			const duration = Date.now() - startTime;
			logger.error('Amazon API call: getReportDocument', {
				aws: {
					operation: 'getReportDocument',
					success: false
				},
				event: {
					duration
				},
				error: { message: error instanceof Error ? error.message : 'Unknown error' },
				reportDocumentId
			});
			throw new Error(
				`Failed to get report document: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}

	// Download and parse returns report data
	async downloadReturnsReport(reportDocumentId: string): Promise<Record<string, string>[]> {
		const startTime = Date.now();

		try {
			// First get the report document URL
			const reportDocument = await this.getReportDocument(reportDocumentId);

			if (!reportDocument.url) {
				throw new Error('No download URL found in report document');
			}

			logger.info('Downloading returns report data', {
				reportDocumentId,
				url: reportDocument.url
			});

			// Download the report data using the SDK's download method
			const reportData = (await this.client.download(reportDocument)) as string;
			console.log('Report Data: ////////////////////////////' + reportData);
			// Parse the TSV data
			const lines = reportData.split('\n').filter((line: string) => line.trim());
			const headers = lines[0].split('\t');
			const data = lines.slice(1).map((line: string) => {
				const values = line.split('\t');
				const row: Record<string, string> = {};
				headers.forEach((header: string, index: number) => {
					row[header.trim()] = values[index]?.trim() || '';
				});
				return row;
			});

			const duration = Date.now() - startTime;
			logger.info('Returns report downloaded and parsed successfully', {
				aws: {
					operation: 'downloadReturnsReport',
					success: true
				},
				event: {
					duration
				},
				reportDocumentId,
				rowCount: data.length
			});

			return data;
		} catch (error) {
			const duration = Date.now() - startTime;
			logger.error('Failed to download returns report', {
				aws: {
					operation: 'downloadReturnsReport',
					success: false
				},
				event: {
					duration
				},
				error: { message: error instanceof Error ? error.message : 'Unknown error' },
				reportDocumentId
			});
			throw new Error(
				`Failed to download returns report: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}

	// Wait for report to be ready with polling
	async waitForReportReady(reportId: string, maxWaitTime: number = 300000): Promise<any> {
		const startTime = Date.now();
		const pollInterval = 10000; // 10 seconds

		logger.info('Waiting for report to be ready', { reportId });

		while (Date.now() - startTime < maxWaitTime) {
			try {
				const report = (await this.getReport(reportId)) as Record<string, unknown>;

				// Log the full report status for debugging
				logger.info('Report status check', {
					reportId,
					processingStatus: report.processingStatus,
					processingStartTime: report.processingStartTime,
					processingEndTime: report.processingEndTime,
					dataStartTime: report.dataStartTime,
					dataEndTime: report.dataEndTime,
					reportDocumentId: report.reportDocumentId
				});

				if (report.processingStatus === 'DONE') {
					logger.info('Report is ready', {
						reportId,
						processingTime: Date.now() - startTime,
						reportDocumentId: report.reportDocumentId
					});
					return report;
				} else if (report.processingStatus === 'FATAL' || report.processingStatus === 'CANCELLED') {
					const errorDetails = {
						reportId,
						processingStatus: report.processingStatus,
						dataStartTime: report.dataStartTime,
						dataEndTime: report.dataEndTime,
						processingStartTime: report.processingStartTime,
						processingEndTime: report.processingEndTime
					};
					
					logger.error('Report processing failed with FATAL status', errorDetails);
					
					throw new Error(
						`Report processing failed with status ${report.processingStatus}. ` +
						`Date range: ${report.dataStartTime} to ${report.dataEndTime}. ` +
						`This typically means the date range is too recent or contains no data. ` +
						`Try using a date range that's at least 48 hours old.`
					);
				}

				// Wait before next poll
				await new Promise((resolve) => setTimeout(resolve, pollInterval));
			} catch (error) {
				logger.error('Error checking report status', {
					reportId,
					error: error instanceof Error ? error.message : 'Unknown error'
				});
				throw error;
			}
		}

		throw new Error(`Report did not complete within ${maxWaitTime}ms`);
	}

	// Get Solicitation Actions for Order using the SDK
	async getSolicitationActions(orderId: string): Promise<GetSolicitationActionsForOrderResponse> {
		const startTime = Date.now();

		try {
			logger.info(`Checking solicitation actions for order ${orderId}`);

			const response = await this.client.callAPI({
				operation: 'getSolicitationActionsForOrder',
				endpoint: 'solicitations',
				path: {
					amazonOrderId: orderId
				},
				query: {
					marketplaceIds: [this.config.marketplaceId]
				}
			});

			const duration = Date.now() - startTime;

			// Handle the response structure properly
			// Actions can be in either _embedded.actions or directly in actions (legacy)
			const responseData = response as any;
			const actions = responseData._embedded?.actions || responseData.actions || [];
			const actionCount = actions.length;

			logger.info('Amazon API call: getSolicitationActions', {
				aws: {
					operation: 'getSolicitationActions',
					success: true
				},
				event: {
					duration
				},
				orderId,
				actionCount,
				hasErrors: !!response.errors,
				marketplaceId: this.config.marketplaceId,
				availableActions: actions.map((action: any) => action.name)
			});

			// Return response with normalized actions structure
			return {
				...response,
				actions: actions // Ensure actions are always available at the top level
			} as GetSolicitationActionsForOrderResponse;
		} catch (error) {
			const duration = Date.now() - startTime;
			logger.error('Amazon API call: getSolicitationActions', {
				aws: {
					operation: 'getSolicitationActions',
					success: false
				},
				event: {
					duration
				},
				error: { message: error instanceof Error ? error.message : 'Unknown error' },
				orderId,
				marketplaceId: this.config.marketplaceId
			});
			throw new Error(
				`Failed to get solicitation actions: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}

	// Create Product Review and Seller Feedback Solicitation using the SDK
	async createReviewSolicitation(
		orderId: string
	): Promise<
		CreateProductReviewAndSellerFeedbackSolicitationResponse | { notEligible: true; reason: string }
	> {
		const startTime = Date.now();

		try {
			logger.info(`Creating review solicitation for order ${orderId}`);

			// First check if solicitation actions are available
			const solicitationActions = await this.getSolicitationActions(orderId);

			if (solicitationActions.errors && solicitationActions.errors.length > 0) {
				throw new Error(
					`Solicitation actions check failed: ${solicitationActions.errors[0].message}`
				);
			}

			// Log available actions for debugging
			logger.info('Available solicitation actions', {
				orderId,
				availableActions: solicitationActions.actions?.map((action) => action.name) || [],
				actionCount: solicitationActions.actions?.length || 0
			});

			// Check if productReviewAndSellerFeedback action is available
			const hasProductReviewAction = solicitationActions.actions?.some(
				(action) => action.name === 'productReviewAndSellerFeedback'
			);

			if (!hasProductReviewAction) {
				const duration = Date.now() - startTime;
				const reason = 'Product review solicitation is not available for this order';

				logger.info('Amazon API call: createReviewSolicitation - not eligible', {
					aws: {
						operation: 'createReviewSolicitation',
						success: false,
						reason: 'not_eligible'
					},
					event: {
						duration
					},
					orderId,
					marketplaceId: this.config.marketplaceId,
					reason,
					actionCount: solicitationActions.actions?.length || 0
				});

				return { notEligible: true, reason };
			}

			const response = await this.client.callAPI({
				operation: 'createProductReviewAndSellerFeedbackSolicitation',
				endpoint: 'solicitations',
				path: {
					amazonOrderId: orderId,
					solicitationType: 'productReviewAndSellerFeedback'
				},
				query: {
					marketplaceIds: [this.config.marketplaceId]
				}
				// No body is required for this operation as per Amazon SP-API documentation
			});

			const duration = Date.now() - startTime;

			// Log the response for debugging
			logger.info('Amazon API call: createReviewSolicitation - response received', {
				aws: {
					operation: 'createReviewSolicitation',
					success: true
				},
				event: {
					duration
				},
				orderId,
				marketplaceId: this.config.marketplaceId,
				responseStatus: response.status || 'unknown',
				responseData: response
			});

			// According to Amazon SP-API documentation, successful response returns 201 status
			// Check if the response indicates success
			if (response && (response.status === 201 || Object.keys(response).length === 0)) {
				logger.info('Amazon API call: createReviewSolicitation - success confirmed', {
					orderId,
					marketplaceId: this.config.marketplaceId,
					responseStatus: response.status || 'empty_response'
				});
				return response as CreateProductReviewAndSellerFeedbackSolicitationResponse;
			} else {
				// If response has errors, handle them
				if (response && response.errors && response.errors.length > 0) {
					const errorMessage = response.errors[0].message;
					logger.error('Amazon API call: createReviewSolicitation - API returned errors', {
						orderId,
						marketplaceId: this.config.marketplaceId,
						errors: response.errors
					});
					throw new Error(`API returned errors: ${errorMessage}`);
				}

				// If we get here, something unexpected happened
				logger.warn('Amazon API call: createReviewSolicitation - unexpected response', {
					orderId,
					marketplaceId: this.config.marketplaceId,
					response,
					responseStatus: response?.status || 'unknown'
				});
				return response as CreateProductReviewAndSellerFeedbackSolicitationResponse;
			}
		} catch (error) {
			const duration = Date.now() - startTime;
			logger.error('Amazon API call: createReviewSolicitation', {
				aws: {
					operation: 'createReviewSolicitation',
					success: false
				},
				event: {
					duration
				},
				error: { message: error instanceof Error ? error.message : 'Unknown error' },
				orderId,
				marketplaceId: this.config.marketplaceId
			});
			throw new Error(
				`Failed to create review solicitation: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}

	// Helper method to get valid access token (handled by SDK)
	private async getValidAccessToken(): Promise<string | null> {
		try {
			// The SDK handles token management automatically
			if (!this.client.access_token) {
				await this.client.refreshAccessToken();
			}
			return this.client.access_token;
		} catch (error) {
			console.error('Failed to get valid access token:', error);
			return null;
		}
	}

	// Update config
	updateConfig(newConfig: Partial<AmazonAPIConfig>): void {
		this.config = { ...this.config, ...newConfig };

		// Reinitialize client if credentials changed
		if (newConfig.clientId || newConfig.clientSecret || newConfig.refreshToken) {
			this.client = new SellingPartner({
				region: this.getRegionFromMarketplaceId(this.config.marketplaceId),
				refresh_token: this.config.refreshToken,
				credentials: {
					SELLING_PARTNER_APP_CLIENT_ID: this.config.clientId,
					SELLING_PARTNER_APP_CLIENT_SECRET: this.config.clientSecret
				},
				options: {
					auto_request_tokens: true,
					auto_request_throttled: true,
					version_fallback: true,
					use_sandbox: this.config.isTest || false,
					debug_log: process.env.NODE_ENV === 'development'
				}
			});
		}
	}

	// Get the underlying client for advanced usage
	getClient(): SellingPartner {
		return this.client;
	}

	// Test API connection
	async testConnection(): Promise<boolean> {
		const startTime = Date.now();

		try {
			// Try to get marketplace participations as a simple test
			await this.client.callAPI({
				operation: 'getMarketplaceParticipations',
				endpoint: 'sellers'
			});

			const duration = Date.now() - startTime;
			logger.info('Amazon API call: testConnection', {
				aws: {
					operation: 'testConnection',
					success: true
				},
				event: {
					duration
				},
				marketplaceId: this.config.marketplaceId
			});
			return true;
		} catch (error) {
			const duration = Date.now() - startTime;
			logger.error('Amazon API call: testConnection', {
				aws: {
					operation: 'testConnection',
					success: false
				},
				event: {
					duration
				},
				error: { message: error instanceof Error ? error.message : 'Unknown error' },
				marketplaceId: this.config.marketplaceId
			});
			return false;
		}
	}

	// ===== REIMBURSEMENT REPORTS METHODS =====

	// Create Reimbursement Report
	async createReimbursementReport(
		dataStartTime: string,
		dataEndTime: string
	): Promise<Record<string, unknown> | unknown> {
		const startTime = Date.now();

		try {
			console.log('🔄 Creating Reimbursement Report...', {
				dataStartTime,
				dataEndTime,
				marketplaceId: this.config.marketplaceId
			});
			logger.info('Creating Reimbursement Report - GET_FBA_REIMBURSEMENTS_DATA', {
				dataStartTime,
				dataEndTime,
				marketplaceId: this.config.marketplaceId
			});

			const response = await this.client.callAPI({
				operation: 'createReport',
				endpoint: 'reports',
				body: {
					marketplaceIds: [this.config.marketplaceId],
					reportType: 'GET_FBA_REIMBURSEMENTS_DATA',
					dataStartTime,
					dataEndTime
				}
			});

			const duration = Date.now() - startTime;
			console.log('✅ Reimbursement report created successfully:', {
				reportId: (response as any).reportId,
				duration
			});

			logger.info('Amazon API call: createReimbursementReport', {
				aws: {
					operation: 'createReimbursementReport',
					success: true
				},
				event: {
					duration
				},
				dataStartTime,
				dataEndTime,
				marketplaceId: this.config.marketplaceId,
				reportId: (response as any).reportId
			});

			return response;
		} catch (error) {
			const duration = Date.now() - startTime;
			console.error('❌ Failed to create reimbursement report:', error);

			logger.error('Amazon API call: createReimbursementReport', {
				aws: {
					operation: 'createReimbursementReport',
					success: false
				},
				event: {
					duration
				},
				error: { message: error instanceof Error ? error.message : 'Unknown error' },
				dataStartTime,
				dataEndTime,
				marketplaceId: this.config.marketplaceId
			});
			throw new Error(
				`Failed to create reimbursement report: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}

	// Create Inventory Adjustments Report
	async createInventoryAdjustmentReport(
		dataStartTime: string,
		dataEndTime: string
	): Promise<Record<string, unknown> | unknown> {
		const startTime = Date.now();

		try {
			console.log('🔄 Creating Inventory Adjustments Report...', {
				dataStartTime,
				dataEndTime,
				marketplaceId: this.config.marketplaceId
			});
			logger.info('Creating Inventory Adjustments Report - GET_LEDGER_DETAIL_VIEW_DATA', {
				dataStartTime,
				dataEndTime,
				marketplaceId: this.config.marketplaceId
			});

			const response = await this.client.callAPI({
				operation: 'createReport',
				endpoint: 'reports',
				body: {
					marketplaceIds: [this.config.marketplaceId],
					reportType: 'GET_LEDGER_DETAIL_VIEW_DATA',
					reportOptions: {
						eventType: 'Adjustments'
					},
					dataStartTime,
					dataEndTime
				}
			});

			const duration = Date.now() - startTime;
			logger.info('Amazon API call: createInventoryAdjustmentReport', {
				aws: {
					operation: 'createInventoryAdjustmentReport',
					success: true
				},
				event: {
					duration
				},
				dataStartTime,
				dataEndTime,
				marketplaceId: this.config.marketplaceId,
				reportId: (response as any).reportId
			});

			return response;
		} catch (error) {
			const duration = Date.now() - startTime;
			logger.error('Amazon API call: createInventoryAdjustmentReport', {
				aws: {
					operation: 'createInventoryAdjustmentReport',
					success: false
				},
				event: {
					duration
				},
				error: { message: error instanceof Error ? error.message : 'Unknown error' },
				dataStartTime,
				dataEndTime,
				marketplaceId: this.config.marketplaceId
			});
			throw new Error(
				`Failed to create inventory adjustment report: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}

	// Create Customer Returns Report
	async createInboundShipmentsReport(
		dataStartTime: string,
		dataEndTime: string
	): Promise<Record<string, unknown> | unknown> {
		const startTime = Date.now();

		try {
			console.log('🔄 Creating Inbound Shipments Report...', {
				dataStartTime,
				dataEndTime,
				marketplaceId: this.config.marketplaceId
			});
			logger.info('Creating Inbound Shipments Report - Fulfillment Inbound API', {
				dataStartTime,
				dataEndTime,
				marketplaceId: this.config.marketplaceId
			});

			// Use Fulfillment Inbound API to get shipments
			// Note: Amazon requires at least one of ShipmentStatusList or ShipmentIdList
			const response = await this.client.callAPI({
				operation: 'getShipments',
				endpoint: 'fulfillmentInbound',
				query: {
					QueryStartDate: dataStartTime,
					QueryEndDate: dataEndTime,
					MarketplaceId: this.config.marketplaceId,
					ShipmentStatusList: ['SHIPPED', 'RECEIVING', 'CLOSED', 'CANCELLED']
				}
			});

			const duration = Date.now() - startTime;
			console.log('✅ Inbound shipments report created in', duration, 'ms');

			logger.info('Amazon API call: createInboundShipmentsReport', {
				aws: {
					operation: 'createInboundShipmentsReport',
					success: true
				},
				event: {
					duration
				},
				dataStartTime,
				dataEndTime,
				marketplaceId: this.config.marketplaceId
			});

			return response;
		} catch (error) {
			const duration = Date.now() - startTime;
			console.error('❌ Failed to create inbound shipments report:', error);

			logger.error('Amazon API call: createInboundShipmentsReport', {
				aws: {
					operation: 'createInboundShipmentsReport',
					success: false
				},
				event: {
					duration
				},
				error: { message: error instanceof Error ? error.message : 'Unknown error' },
				dataStartTime,
				dataEndTime,
				marketplaceId: this.config.marketplaceId
			});

			throw error;
		}
	}

	async downloadInboundShipmentsReport(reportDocumentId: string): Promise<any[]> {
		const startTime = Date.now();

		try {
			console.log('📦 Downloading inbound shipments report data...', { reportDocumentId });
			logger.info('Downloading inbound shipments report data', { reportDocumentId });

			// Get report document
			const reportResponse = await this.client.callAPI({
				operation: 'getReportDocument',
				endpoint: 'reports',
				path: { reportDocumentId }
			});

			const downloadUrl = reportResponse.url;
			if (!downloadUrl) {
				throw new Error('No download URL in report document');
			}

			// Download the report data
			const response = await fetch(downloadUrl);
			if (!response.ok) {
				throw new Error(`Failed to download report: ${response.status} ${response.statusText}`);
			}

			const csvText = await response.text();
			const lines = csvText.split('\n').filter((line) => line.trim());

			if (lines.length === 0) {
				return [];
			}

			// Parse CSV data (assuming first line is headers)
			const headers = lines[0].split('\t'); // Amazon reports are tab-separated
			const shipmentsData = [];

			for (let i = 1; i < lines.length; i++) {
				const values = lines[i].split('\t');
				const shipment: any = {};

				headers.forEach((header, index) => {
					shipment[header.trim()] = values[index]?.trim() || '';
				});

				shipmentsData.push(shipment);
			}

			const duration = Date.now() - startTime;
			console.log('✅ Inbound shipments report data downloaded in', duration, 'ms');

			logger.info('Amazon API call: downloadInboundShipmentsReport', {
				aws: {
					operation: 'downloadInboundShipmentsReport',
					success: true
				},
				event: {
					duration
				},
				reportDocumentId,
				rowCount: shipmentsData.length
			});

			return shipmentsData;
		} catch (error) {
			const duration = Date.now() - startTime;
			console.error('❌ Failed to download inbound shipments report:', error);

			logger.error('Amazon API call: downloadInboundShipmentsReport', {
				aws: {
					operation: 'downloadInboundShipmentsReport',
					success: false
				},
				event: {
					duration
				},
				error: { message: error instanceof Error ? error.message : 'Unknown error' },
				reportDocumentId
			});

			throw error;
		}
	}

	async createCustomerReturnsReport(
		dataStartTime: string,
		dataEndTime: string
	): Promise<Record<string, unknown> | unknown> {
		const startTime = Date.now();

		try {
			logger.info('Creating Customer Returns Report - GET_FBA_FULFILLMENT_CUSTOMER_RETURNS_DATA', {
				dataStartTime,
				dataEndTime,
				marketplaceId: this.config.marketplaceId
			});

			const response = await this.client.callAPI({
				operation: 'createReport',
				endpoint: 'reports',
				body: {
					marketplaceIds: [this.config.marketplaceId],
					reportType: 'GET_FBA_FULFILLMENT_CUSTOMER_RETURNS_DATA',
					dataStartTime,
					dataEndTime
				}
			});

			const duration = Date.now() - startTime;
			logger.info('Amazon API call: createCustomerReturnsReport', {
				aws: {
					operation: 'createCustomerReturnsReport',
					success: true
				},
				event: {
					duration
				},
				dataStartTime,
				dataEndTime,
				marketplaceId: this.config.marketplaceId,
				reportId: (response as any).reportId
			});

			return response;
		} catch (error) {
			const duration = Date.now() - startTime;
			logger.error('Amazon API call: createCustomerReturnsReport', {
				aws: {
					operation: 'createCustomerReturnsReport',
					success: false
				},
				event: {
					duration
				},
				error: { message: error instanceof Error ? error.message : 'Unknown error' },
				dataStartTime,
				dataEndTime,
				marketplaceId: this.config.marketplaceId
			});
			throw new Error(
				`Failed to create customer returns report: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}

	// Download and parse reimbursement report data
	async downloadReimbursementReport(reportDocumentId: string): Promise<any[]> {
		const startTime = Date.now();

		try {
			logger.info('Downloading reimbursement report data', {
				reportDocumentId,
				marketplaceId: this.config.marketplaceId
			});

			const response = await this.client.callAPI({
				operation: 'getReportDocument',
				endpoint: 'reports',
				path: {
					reportDocumentId
				}
			});

			const documentUrl = (response as any).url;
			if (!documentUrl) {
				throw new Error('No document URL in response');
			}

			// Download the document
			const documentResponse = await fetch(documentUrl);
			if (!documentResponse.ok) {
				throw new Error(`Failed to download document: ${documentResponse.statusText}`);
			}

			const csvText = await documentResponse.text();
			const lines = csvText.split('\n').filter((line) => line.trim());

			if (lines.length === 0) {
				logger.warn('Empty reimbursement report data');
				return [];
			}

			// Parse CSV data (assuming first line is header)
			const headers = lines[0].split('\t');
			const data = lines.slice(1).map((line) => {
				const values = line.split('\t');
				const record: any = {};
				headers.forEach((header, index) => {
					record[header.trim()] = values[index]?.trim() || '';
				});
				return record;
			});

			const duration = Date.now() - startTime;
			logger.info('Amazon API call: downloadReimbursementReport', {
				aws: {
					operation: 'downloadReimbursementReport',
					success: true
				},
				event: {
					duration
				},
				reportDocumentId,
				rowCount: data.length,
				marketplaceId: this.config.marketplaceId
			});

			return data;
		} catch (error) {
			const duration = Date.now() - startTime;
			logger.error('Amazon API call: downloadReimbursementReport', {
				aws: {
					operation: 'downloadReimbursementReport',
					success: false
				},
				event: {
					duration
				},
				error: { message: error instanceof Error ? error.message : 'Unknown error' },
				reportDocumentId,
				marketplaceId: this.config.marketplaceId
			});
			throw new Error(
				`Failed to download reimbursement report: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}

	// Download and parse inventory adjustment report data
	async downloadInventoryAdjustmentReport(reportDocumentId: string): Promise<any[]> {
		const startTime = Date.now();

		try {
			logger.info('Downloading inventory adjustment report data', {
				reportDocumentId,
				marketplaceId: this.config.marketplaceId
			});

			const response = await this.client.callAPI({
				operation: 'getReportDocument',
				endpoint: 'reports',
				path: {
					reportDocumentId
				}
			});

			const documentUrl = (response as any).url;
			if (!documentUrl) {
				throw new Error('No document URL in response');
			}

			// Download the document
			const documentResponse = await fetch(documentUrl);
			if (!documentResponse.ok) {
				throw new Error(`Failed to download document: ${documentResponse.statusText}`);
			}

			const csvText = await documentResponse.text();
			const lines = csvText.split('\n').filter((line) => line.trim());

			if (lines.length === 0) {
				logger.warn('Empty inventory adjustment report data');
				return [];
			}

			// Parse CSV data (assuming first line is header)
			const headers = lines[0].split('\t');
			const data = lines.slice(1).map((line) => {
				const values = line.split('\t');
				const record: any = {};
				headers.forEach((header, index) => {
					record[header.trim()] = values[index]?.trim() || '';
				});
				return record;
			});

			const duration = Date.now() - startTime;
			logger.info('Amazon API call: downloadInventoryAdjustmentReport', {
				aws: {
					operation: 'downloadInventoryAdjustmentReport',
					success: true
				},
				event: {
					duration
				},
				reportDocumentId,
				rowCount: data.length,
				marketplaceId: this.config.marketplaceId
			});

			return data;
		} catch (error) {
			const duration = Date.now() - startTime;
			logger.error('Amazon API call: downloadInventoryAdjustmentReport', {
				aws: {
					operation: 'downloadInventoryAdjustmentReport',
					success: false
				},
				event: {
					duration
				},
				error: { message: error instanceof Error ? error.message : 'Unknown error' },
				reportDocumentId,
				marketplaceId: this.config.marketplaceId
			});
			throw new Error(
				`Failed to download inventory adjustment report: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}

	// Download and parse customer returns report data
	async downloadCustomerReturnsReport(reportDocumentId: string): Promise<any[]> {
		const startTime = Date.now();

		try {
			logger.info('Downloading customer returns report data', {
				reportDocumentId,
				marketplaceId: this.config.marketplaceId
			});

			const response = await this.client.callAPI({
				operation: 'getReportDocument',
				endpoint: 'reports',
				path: {
					reportDocumentId
				}
			});

			const documentUrl = (response as any).url;
			if (!documentUrl) {
				throw new Error('No document URL in response');
			}

			// Download the document
			const documentResponse = await fetch(documentUrl);
			if (!documentResponse.ok) {
				throw new Error(`Failed to download document: ${documentResponse.statusText}`);
			}

			const csvText = await documentResponse.text();
			const lines = csvText.split('\n').filter((line) => line.trim());

			if (lines.length === 0) {
				logger.warn('Empty customer returns report data');
				return [];
			}

			// Parse CSV data (assuming first line is header)
			const headers = lines[0].split('\t');
			const data = lines.slice(1).map((line) => {
				const values = line.split('\t');
				const record: any = {};
				headers.forEach((header, index) => {
					record[header.trim()] = values[index]?.trim() || '';
				});
				return record;
			});

			const duration = Date.now() - startTime;
			logger.info('Amazon API call: downloadCustomerReturnsReport', {
				aws: {
					operation: 'downloadCustomerReturnsReport',
					success: true
				},
				event: {
					duration
				},
				reportDocumentId,
				rowCount: data.length,
				marketplaceId: this.config.marketplaceId
			});

			return data;
		} catch (error) {
			const duration = Date.now() - startTime;
			logger.error('Amazon API call: downloadCustomerReturnsReport', {
				aws: {
					operation: 'downloadCustomerReturnsReport',
					success: false
				},
				event: {
					duration
				},
				error: { message: error instanceof Error ? error.message : 'Unknown error' },
				reportDocumentId,
				marketplaceId: this.config.marketplaceId
			});
			throw new Error(
				`Failed to download customer returns report: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}

	// ===== INVENTORY LEDGER REPORT (AIRPA) METHODS =====

	// Create Inventory Ledger Report (AIRPA)
	async createInventoryLedgerReport(
		dataStartTime: string,
		dataEndTime: string
	): Promise<Record<string, unknown> | unknown> {
		const startTime = Date.now();

		try {
			logger.info('Creating Inventory Ledger Report (AIRPA) - GET_LEDGER_DETAIL_VIEW_DATA', {
				dataStartTime,
				dataEndTime,
				marketplaceId: this.config.marketplaceId
			});

			const response = await this.client.callAPI({
				operation: 'createReport',
				endpoint: 'reports',
				body: {
					marketplaceIds: [this.config.marketplaceId],
					reportType: 'GET_LEDGER_DETAIL_VIEW_DATA',
					dataStartTime,
					dataEndTime,
					reportOptions: {
						aggregatedByTimePeriod: 'DAILY'
					}
				}
			});

			const duration = Date.now() - startTime;
			logger.info('Amazon API call: createInventoryLedgerReport', {
				aws: {
					operation: 'createInventoryLedgerReport',
					success: true
				},
				event: {
					duration
				},
				dataStartTime,
				dataEndTime,
				marketplaceId: this.config.marketplaceId,
				reportId: (response as any).reportId
			});

			return response;
		} catch (error) {
			const duration = Date.now() - startTime;
			logger.error('Amazon API call: createInventoryLedgerReport', {
				aws: {
					operation: 'createInventoryLedgerReport',
					success: false
				},
				event: {
					duration
				},
				error: { message: error instanceof Error ? error.message : 'Unknown error' },
				dataStartTime,
				dataEndTime,
				marketplaceId: this.config.marketplaceId
			});
			throw new Error(
				`Failed to create inventory ledger report: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}

	// Download and parse inventory ledger report data
	async downloadInventoryLedgerReport(
		reportDocumentId: string
	): Promise<InventoryLedgerEventData[]> {
		const startTime = Date.now();

		try {
			// First get the report document URL
			const reportDocument = await this.getReportDocument(reportDocumentId);

			if (!reportDocument.url) {
				throw new Error('No download URL found in report document');
			}

			logger.info('Downloading inventory ledger report data', {
				reportDocumentId,
				url: reportDocument.url
			});

			// Download the report data using the SDK's download method
			const reportData = (await this.client.download(reportDocument)) as string;

			logger.info('Raw inventory ledger report data received', {
				reportDocumentId,
				dataLength: reportData.length,
				firstChars: reportData.substring(0, 500), // Log first 500 characters
				lastChars: reportData.substring(Math.max(0, reportData.length - 500)), // Log last 500 characters
				hasData: reportData.length > 0,
				lineCount: reportData.split('\n').length
			});

			// Parse the TSV data (handling quoted fields)
			const lines = reportData.split('\n').filter((line: string) => line.trim());
			if (lines.length === 0) {
				logger.warn('No data found in inventory ledger report', {
					reportDocumentId,
					rawDataLength: reportData.length,
					rawDataPreview: reportData.substring(0, 1000)
				});
				return [];
			}

			// Helper function to parse TSV line with quoted fields
			const parseTSVLine = (line: string): string[] => {
				const result: string[] = [];
				let current = '';
				let inQuotes = false;

				for (let i = 0; i < line.length; i++) {
					const char = line[i];

					if (char === '"') {
						inQuotes = !inQuotes;
					} else if (char === '\t' && !inQuotes) {
						result.push(current.trim());
						current = '';
					} else {
						current += char;
					}
				}
				result.push(current.trim());
				return result;
			};

			const headers = parseTSVLine(lines[0]);

			logger.info('Parsing inventory ledger report headers', {
				reportDocumentId,
				headerCount: headers.length,
				headers: headers,
				firstLine: lines[0],
				totalLines: lines.length
			});

			const data: InventoryLedgerEventData[] = lines.slice(1).map((line: string, index: number) => {
				const values = parseTSVLine(line);
				const row: Record<string, string> = {};
				headers.forEach((header: string, colIndex: number) => {
					// Remove quotes from header names and values
					const cleanHeader = header.replace(/"/g, '').trim();
					const cleanValue = (values[colIndex] || '').replace(/"/g, '').trim();
					row[cleanHeader] = cleanValue;
				});

				// Log first few rows for debugging
				if (index < 3) {
					logger.info('Parsing inventory ledger report row', {
						reportDocumentId,
						rowIndex: index,
						headers: headers,
						values: values,
						parsedRow: row
					});
				}

				// Map the row data to our InventoryLedgerEventData interface
				return {
					eventDate: this.parseAmazonDate(row['Date'] || ''),
					fnsku: row['FNSKU'] || '',
					asin: row['ASIN'] || '',
					sku: row['MSKU'] || '',
					productTitle: row['Title'] || '',
					eventType: row['Event Type'] || '',
					referenceId: row['Reference ID'] || null,
					quantity: parseInt(row['Quantity'] || '0', 10),
					fulfillmentCenter: row['Fulfillment Center'] || null,
					disposition: row['Disposition'] || null,
					reason: row['Reason'] || null,
					reconciledQuantity: parseInt(row['Reconciled Quantity'] || '0', 10),
					unreconciledQuantity: parseInt(row['Unreconciled Quantity'] || '0', 10),
					country: row['Country'] || 'US',
					rawTimestamp: this.parseAmazonDateTime(row['Date and Time'] || ''),
					storeId: row['Store'] || null
				};
			});

			// Log filtering results
			const validData = data.filter((event) => event.fnsku && event.asin);
			const invalidData = data.filter((event) => !event.fnsku || !event.asin);

			logger.info('Inventory ledger report parsing completed', {
				reportDocumentId,
				totalRows: data.length,
				validRows: validData.length,
				invalidRows: invalidData.length,
				invalidRowReasons: invalidData.map((event) => ({
					hasFNSKU: !!event.fnsku,
					hasASIN: !!event.asin,
					fnsku: event.fnsku,
					asin: event.asin
				}))
			});

			const duration = Date.now() - startTime;
			logger.info('Inventory ledger report downloaded and parsed successfully', {
				aws: {
					operation: 'downloadInventoryLedgerReport',
					success: true
				},
				event: {
					duration
				},
				reportDocumentId,
				rowCount: validData.length,
				totalLines: lines.length,
				validRows: validData.length,
				invalidRows: invalidData.length
			});

			return validData;
		} catch (error) {
			const duration = Date.now() - startTime;
			logger.error('Failed to download inventory ledger report', {
				aws: {
					operation: 'downloadInventoryLedgerReport',
					success: false
				},
				event: {
					duration
				},
				error: { message: error instanceof Error ? error.message : 'Unknown error' },
				reportDocumentId
			});
			throw new Error(
				`Failed to download inventory ledger report: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}

	// Create Unsuppressed Inventory Report
	async createUnsuppressedInventoryReport(
		dataStartTime: string,
		dataEndTime: string
	): Promise<Record<string, unknown> | unknown> {
		const startTime = Date.now();

		try {
			console.log('🔄 Creating Unsuppressed Inventory Report...', {
				dataStartTime,
				dataEndTime,
				marketplaceId: this.config.marketplaceId
			});
			logger.info('Creating Unsuppressed Inventory Report - GET_FBA_MYI_UNSUPPRESSED_INVENTORY_DATA', {
				dataStartTime,
				dataEndTime,
				marketplaceId: this.config.marketplaceId
			});

			const response = await this.client.callAPI({
				operation: 'createReport',
				endpoint: 'reports',
				body: {
					marketplaceIds: [this.config.marketplaceId],
					reportType: 'GET_FBA_MYI_UNSUPPRESSED_INVENTORY_DATA',
					dataStartTime,
					dataEndTime
				}
			});

			const duration = Date.now() - startTime;
			console.log('✅ Unsuppressed inventory report created successfully:', {
				reportId: (response as any).reportId,
				duration
			});

			logger.info('Amazon API call: createUnsuppressedInventoryReport', {
				aws: {
					operation: 'createUnsuppressedInventoryReport',
					success: true
				},
				event: {
					duration
				},
				dataStartTime,
				dataEndTime,
				marketplaceId: this.config.marketplaceId,
				reportId: (response as any).reportId
			});

			return response;
		} catch (error) {
			const duration = Date.now() - startTime;
			console.error('❌ Failed to create unsuppressed inventory report:', error);

			logger.error('Amazon API call: createUnsuppressedInventoryReport', {
				aws: {
					operation: 'createUnsuppressedInventoryReport',
					success: false
				},
				event: {
					duration
				},
				error: { message: error instanceof Error ? error.message : 'Unknown error' },
				dataStartTime,
				dataEndTime,
				marketplaceId: this.config.marketplaceId
			});
			throw new Error(
				`Failed to create unsuppressed inventory report: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}

	// Download and parse unsuppressed inventory report data
	async downloadUnsuppressedInventoryReport(reportDocumentId: string): Promise<any[]> {
		const startTime = Date.now();

		try {
			logger.info('Downloading unsuppressed inventory report data', {
				reportDocumentId,
				marketplaceId: this.config.marketplaceId
			});

			const response = await this.client.callAPI({
				operation: 'getReportDocument',
				endpoint: 'reports',
				path: {
					reportDocumentId
				}
			});

			const documentUrl = (response as any).url;
			if (!documentUrl) {
				throw new Error('No document URL in response');
			}

			// Download the document
			const documentResponse = await fetch(documentUrl);
			if (!documentResponse.ok) {
				throw new Error(`Failed to download document: ${documentResponse.statusText}`);
			}

			const csvText = await documentResponse.text();
			const lines = csvText.split('\n').filter((line) => line.trim());

			if (lines.length === 0) {
				logger.warn('Empty unsuppressed inventory report data');
				return [];
			}

			// Parse CSV data (assuming first line is header)
			const headers = lines[0].split('\t');
			const data = lines.slice(1).map((line) => {
				const values = line.split('\t');
				const record: any = {};
				headers.forEach((header, index) => {
					record[header.trim()] = values[index]?.trim() || '';
				});
				return record;
			});

			const duration = Date.now() - startTime;
			logger.info('Amazon API call: downloadUnsuppressedInventoryReport', {
				aws: {
					operation: 'downloadUnsuppressedInventoryReport',
					success: true
				},
				event: {
					duration
				},
				reportDocumentId,
				rowCount: data.length,
				marketplaceId: this.config.marketplaceId
			});

			return data;
		} catch (error) {
			const duration = Date.now() - startTime;
			logger.error('Amazon API call: downloadUnsuppressedInventoryReport', {
				aws: {
					operation: 'downloadUnsuppressedInventoryReport',
					success: false
				},
				event: {
					duration
				},
				error: { message: error instanceof Error ? error.message : 'Unknown error' },
				reportDocumentId,
				marketplaceId: this.config.marketplaceId
			});
			throw new Error(
				`Failed to download unsuppressed inventory report: ${error instanceof Error ? error.message : 'Unknown error'}`
			);
		}
	}

	// Helper method to parse Amazon date format
	private parseAmazonDate(dateStr: string): Date {
		if (!dateStr) return new Date();

		// Try different date formats that Amazon might use
		const formats = [
			/^\d{4}-\d{2}-\d{2}$/, // YYYY-MM-DD
			/^\d{2}\/\d{2}\/\d{4}$/, // MM/DD/YYYY
			/^\d{2}-\d{2}-\d{4}$/ // MM-DD-YYYY
		];

		for (const format of formats) {
			if (format.test(dateStr)) {
				const date = new Date(dateStr);
				if (!isNaN(date.getTime())) {
					return date;
				}
			}
		}

		// Fallback to current date if parsing fails
		logger.warn('Failed to parse Amazon date', { dateStr });
		return new Date();
	}

	// Helper method to parse Amazon datetime format
	private parseAmazonDateTime(dateTimeStr: string): Date {
		if (!dateTimeStr) return new Date();

		// Try different datetime formats
		const formats = [
			/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/, // ISO format
			/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/, // YYYY-MM-DD HH:MM:SS
			/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}:\d{2}/ // MM/DD/YYYY HH:MM:SS
		];

		for (const format of formats) {
			if (format.test(dateTimeStr)) {
				const date = new Date(dateTimeStr);
				if (!isNaN(date.getTime())) {
					return date;
				}
			}
		}

		// Fallback to current date if parsing fails
		logger.warn('Failed to parse Amazon datetime', { dateTimeStr });
		return new Date();
	}
}
