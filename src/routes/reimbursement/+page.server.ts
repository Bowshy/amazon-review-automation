import type { PageServerLoad } from './$types';
import { ReimbursementService } from '$lib/db/services/reimbursement';
import { logger } from '$lib/logger';

export const load: PageServerLoad = async () => {
	try {
		logger.info('Loading reimbursement dashboard data');

		const service = new ReimbursementService();

		// Get initial statistics
		const stats = await service.getReimbursementStats();

		// Get categories
		const categories = await service.getCategories();

		logger.info('Reimbursement dashboard data loaded', {
			statsCount: stats.length,
			categoryCount: categories.length
		});

		return {
			stats,
			categories
		};
	} catch (error) {
		logger.error('Failed to load reimbursement dashboard data', {
			error: { message: error instanceof Error ? error.message : 'Unknown error' }
		});

		return {
			stats: [],
			categories: [],
			error: error instanceof Error ? error.message : 'Unknown error'
		};
	}
};
