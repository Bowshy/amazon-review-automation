import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ReimbursementService } from '$lib/db/services/reimbursement';
import { logger } from '$lib/logger';

export const POST: RequestHandler = async ({ request }) => {
	const startTime = Date.now();

	try {
		console.log('🌐 Reimbursement sync API endpoint called');
		const body = await request.json();
		const { dataStartTime, dataEndTime } = body;

		console.log('📥 Request body received:', { dataStartTime, dataEndTime });

		// If no dates provided, use last 30 days
		let startTimeIso = dataStartTime;
		let endTimeIso = dataEndTime;

		if (!startTimeIso || !endTimeIso) {
			console.log('📅 No dates provided, using recommended date range');
			const now = new Date();
			
			// Amazon SP-API reports typically have a 48-72 hour delay for reimbursement data
			// Use 3 days ago as end time to ensure data availability
			const endTimeDate = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000); // 3 days ago
			
			// Request last 90 days of data (Amazon allows up to 365 days for most reports)
			const startTimeDate = new Date(endTimeDate.getTime() - 90 * 24 * 60 * 60 * 1000); // 90 days before end time

			startTimeIso = startTimeDate.toISOString();
			endTimeIso = endTimeDate.toISOString();

			console.log('📅 Generated date range (optimized for Amazon SP-API report availability):', { 
				startTime: startTimeIso, 
				endTime: endTimeIso,
				daysRange: 90,
				endTimeAgoFromNow: '3 days ago'
			});
		}

		console.log('✅ Parameters validated, starting sync...');
		logger.info('Starting reimbursement reports sync', {
			aws: {
				operation: 'reimbursementSync',
				success: true
			},
			event: {
				startTime: new Date(startTime).toISOString()
			},
			dataStartTime: startTimeIso,
			dataEndTime: endTimeIso
		});

		const service = new ReimbursementService();
		console.log('🔄 Calling syncAllReports...');
		const result = await service.syncAllReports(startTimeIso, endTimeIso);
		console.log('📊 Sync result received:', result);

		const duration = Date.now() - startTime;
		console.log('⏱️ Sync completed in', duration, 'ms');

		logger.info('Reimbursement reports sync completed', {
			aws: {
				operation: 'reimbursementSync',
				success: result.success
			},
			event: {
				duration,
				endTime: new Date().toISOString()
			},
			result: {
				reportIds: result.reportIds,
				processedCounts: result.processedCounts,
				errorCount: result.errors.length
			}
		});

		console.log('📤 Returning response:', {
			success: result.success,
			reportIds: result.reportIds,
			processedCounts: result.processedCounts,
			errors: result.errors,
			duration
		});

		return json({
			success: result.success,
			reportIds: result.reportIds,
			processedCounts: result.processedCounts,
			errors: result.errors,
			duration
		});
	} catch (error) {
		const duration = Date.now() - startTime;
		console.error('💥 API endpoint error:', error);

		logger.error('Reimbursement reports sync failed', {
			aws: {
				operation: 'reimbursementSync',
				success: false
			},
			event: {
				duration,
				endTime: new Date().toISOString()
			},
			error
		});

		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : String(error),
				duration
			},
			{ status: 500 }
		);
	}
};
