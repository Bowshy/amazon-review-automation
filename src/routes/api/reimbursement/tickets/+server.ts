import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ReimbursementService } from '$lib/db/services/reimbursement';
import { logger } from '$lib/logger';

export const GET: RequestHandler = async ({ url }) => {
	try {
		const status = url.searchParams.get('status') || undefined;
		const priority = url.searchParams.get('priority') || undefined;
		const category = url.searchParams.get('category') || undefined;
		const page = parseInt(url.searchParams.get('page') || '1');
		const limit = parseInt(url.searchParams.get('limit') || '50');

		logger.info('Fetching reimbursement tickets', {
			status,
			priority,
			category,
			page,
			limit
		});

		const service = new ReimbursementService();
		const result = await service.getReimbursementTickets(
			{ status, priority, category },
			page,
			limit
		);

		logger.info('Reimbursement tickets retrieved', {
			ticketCount: result.tickets.length,
			total: result.total,
			page,
			limit
		});

		return json({
			success: true,
			tickets: result.tickets,
			total: result.total,
			page: result.page,
			limit: result.limit,
			totalPages: result.totalPages
		});
	} catch (error) {
		logger.error('Failed to fetch reimbursement tickets', {
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
