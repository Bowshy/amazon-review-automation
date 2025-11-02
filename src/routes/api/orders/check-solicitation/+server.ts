import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { AmazonService } from '$lib/db/services/amazon';
import { logger } from '$lib/logger';

export const GET: RequestHandler = async ({ url, request }) => {
	const startTime = Date.now();

	try {
		const orderId = url.searchParams.get('orderId');

		if (!orderId) {
			return json(
				{
					success: false,
					error: 'Order ID is required'
				},
				{ status: 400 }
			);
		}

		logger.info('Checking solicitation actions for order', {
			endpoint: '/api/orders/check-solicitation',
			method: 'GET',
			orderId
		});

		const amazonService = new AmazonService();
		const result = await amazonService.checkSolicitationActions(orderId);

		const duration = Date.now() - startTime;

		logger.info('Solicitation actions check completed', {
			endpoint: '/api/orders/check-solicitation',
			duration,
			orderId,
			hasActions: result.hasActions,
			actionCount: result.actions?.length || 0
		});

		return json({
			success: true,
			data: result
		});
	} catch (error: any) {
		const duration = Date.now() - startTime;

		logger.error('Solicitation actions check failed', {
			endpoint: '/api/orders/check-solicitation',
			duration,
			error: error instanceof Error ? error.message : 'Unknown error'
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
