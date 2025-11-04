import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ReimbursementService } from '$lib/db/services/reimbursement';
import { logger } from '$lib/logger';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const category = url.searchParams.get('category') || undefined;
		const limit = parseInt(url.searchParams.get('limit') || '100');
		const offset = parseInt(url.searchParams.get('offset') || '0');
		const sortBy = url.searchParams.get('sortBy') || 'lastUpdated';
		const sortOrder = (url.searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';

		logger.info('Fetching reimbursement items', {
			category,
			limit,
			offset,
			sortBy,
			sortOrder
		});

		const service = new ReimbursementService();
		const result = await service.getReimbursementItemsByCategory(
			category,
			limit,
			offset,
			sortBy,
			sortOrder
		);

		logger.info('Reimbursement items retrieved', {
			itemCount: result.items.length,
			total: result.total,
			category
		});

		return json({
			success: true,
			items: result.items,
			total: result.total,
			limit,
			offset
		});
	} catch (error) {
		logger.error('Failed to fetch reimbursement items', {
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
