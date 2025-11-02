import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ReimbursementService } from '$lib/db/services/reimbursement';
import { logger } from '$lib/logger';

export const GET: RequestHandler = async () => {
	try {
		logger.info('Fetching reimbursement statistics');

		const service = new ReimbursementService();
		const stats = await service.getReimbursementStats();

		logger.info('Reimbursement statistics retrieved', {
			statsCount: stats.length,
			totalItems: stats.reduce((sum, stat) => sum + stat.itemCount, 0),
			totalValue: stats.reduce((sum, stat) => sum + stat.totalValue, 0)
		});

		return json({
			success: true,
			stats
		});
	} catch (error) {
		logger.error('Failed to fetch reimbursement statistics', {
			error: { message: error instanceof Error ? error.message : 'Unknown error' }
		});

		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};
