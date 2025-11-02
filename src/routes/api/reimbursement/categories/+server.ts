import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ReimbursementService } from '$lib/db/services/reimbursement';
import { logger } from '$lib/logger';

export const GET: RequestHandler = async () => {
	try {
		logger.info('Fetching reimbursement categories');

		const service = new ReimbursementService();
		const categories = await service.getCategories();

		logger.info('Reimbursement categories retrieved', {
			categoryCount: categories.length
		});

		return json({
			success: true,
			categories
		});
	} catch (error) {
		logger.error('Failed to fetch reimbursement categories', {
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
