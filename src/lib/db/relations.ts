import { relations } from 'drizzle-orm/relations';
import { amazonOrders, reviewRequests, activityLogs } from './schema';

export const reviewRequestsRelations = relations(reviewRequests, ({ one }) => ({
	amazonOrder: one(amazonOrders, {
		fields: [reviewRequests.orderId],
		references: [amazonOrders.id]
	})
}));

export const amazonOrdersRelations = relations(amazonOrders, ({ many }) => ({
	reviewRequests: many(reviewRequests),
	activityLogs: many(activityLogs)
}));

export const activityLogsRelations = relations(activityLogs, ({ one }) => ({
	amazonOrder: one(amazonOrders, {
		fields: [activityLogs.orderId],
		references: [amazonOrders.id]
	})
}));
