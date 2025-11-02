import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { ReimbursementService } from '$lib/db/services/reimbursement';
import { logger } from '$lib/logger';

export const PUT: RequestHandler = async ({ params, request }) => {
	try {
		const { ticketId } = params;
		const body = await request.json();
		const { status, resolution, caseId } = body;

		if (!ticketId || !status) {
			return json(
				{
					success: false,
					error: 'Missing required fields: ticketId and status'
				},
				{ status: 400 }
			);
		}

		logger.info('Updating ticket status', {
			ticketId,
			status,
			resolution,
			caseId
		});

		const service = new ReimbursementService();
		await service.updateTicketStatus(ticketId, status, resolution, caseId);

		logger.info('Ticket status updated successfully', {
			ticketId,
			status
		});

		return json({
			success: true,
			message: 'Ticket status updated successfully'
		});
	} catch (error) {
		logger.error('Failed to update ticket status', {
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
