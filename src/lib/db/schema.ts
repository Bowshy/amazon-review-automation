import {
	pgTable,
	index,
	uuid,
	varchar,
	timestamp,
	integer,
	text,
	boolean,
	uniqueIndex,
	jsonb,
	foreignKey,
	numeric,
	unique,
	pgEnum
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const inventoryLedgerStatus = pgEnum('InventoryLedgerStatus', [
	'WAITING',
	'CLAIMABLE',
	'RESOLVED',
	'CLAIMED',
	'PAID'
]);
export const claimCategory = pgEnum('claim_category', [
	'LOST_WAREHOUSE',
	'DAMAGED_WAREHOUSE',
	'LOST_INBOUND',
	'DAMAGED_INBOUND',
	'CUSTOMER_RETURN_NOT_RECEIVED',
	'CUSTOMER_RETURN_DAMAGED',
	'OTHER'
]);
export const claimStatus = pgEnum('claim_status', [
	'PENDING',
	'CLAIMABLE',
	'CLAIMED',
	'REIMBURSED',
	'DENIED',
	'EXPIRED'
]);

export const reimbursementSyncLogs = pgTable(
	'reimbursement_sync_logs',
	{
		id: uuid().defaultRandom().primaryKey().notNull(),
		syncType: varchar('sync_type', { length: 50 }).notNull(),
		startDate: timestamp('start_date', { withTimezone: true, mode: 'string' }),
		endDate: timestamp('end_date', { withTimezone: true, mode: 'string' }),
		status: varchar({ length: 50 }).notNull(),
		recordsProcessed: integer('records_processed').default(0).notNull(),
		recordsAdded: integer('records_added').default(0).notNull(),
		recordsUpdated: integer('records_updated').default(0).notNull(),
		errorMessage: text('error_message'),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
			.defaultNow()
			.notNull(),
		completedAt: timestamp('completed_at', { withTimezone: true, mode: 'string' })
	},
	(table) => [
		index('idx_reimbursement_sync_logs_created_at').using(
			'btree',
			table.createdAt.asc().nullsLast().op('timestamptz_ops')
		),
		index('idx_reimbursement_sync_logs_status').using(
			'btree',
			table.status.asc().nullsLast().op('text_ops')
		),
		index('idx_reimbursement_sync_logs_sync_type').using(
			'btree',
			table.syncType.asc().nullsLast().op('text_ops')
		)
	]
);

export const amazonApiConfig = pgTable('amazon_api_config', {
	id: uuid()
		.default(sql`uuid_generate_v4()`)
		.primaryKey()
		.notNull(),
	clientId: varchar('client_id', { length: 255 }).notNull(),
	clientSecret: varchar('client_secret', { length: 255 }).notNull(),
	refreshToken: text('refresh_token').notNull(),
	marketplaceId: varchar('marketplace_id', { length: 50 }).notNull(),
	accessToken: text('access_token'),
	tokenExpiresAt: timestamp('token_expires_at', {
		precision: 6,
		withTimezone: true,
		mode: 'string'
	}),
	isActive: boolean('is_active').default(true),
	createdAt: timestamp('created_at', { precision: 6, withTimezone: true, mode: 'string' }).default(
		sql`CURRENT_TIMESTAMP`
	),
	updatedAt: timestamp('updated_at', { precision: 6, withTimezone: true, mode: 'string' }).default(
		sql`CURRENT_TIMESTAMP`
	)
});

export const inventoryLedgerEvents = pgTable(
	'inventory_ledger_events',
	{
		id: uuid()
			.default(sql`uuid_generate_v4()`)
			.primaryKey()
			.notNull(),
		eventDate: timestamp('event_date', { precision: 3, mode: 'string' }).notNull(),
		fnsku: varchar({ length: 50 }).notNull(),
		asin: varchar({ length: 20 }).notNull(),
		sku: varchar({ length: 100 }).notNull(),
		productTitle: text('product_title').notNull(),
		eventType: varchar('event_type', { length: 50 }).notNull(),
		referenceId: varchar('reference_id', { length: 100 }),
		quantity: integer().notNull(),
		fulfillmentCenter: varchar('fulfillment_center', { length: 20 }),
		disposition: varchar({ length: 50 }),
		reason: varchar({ length: 10 }),
		reconciledQuantity: integer('reconciled_quantity').default(0).notNull(),
		unreconciledQuantity: integer('unreconciled_quantity').default(0).notNull(),
		country: varchar({ length: 10 }).default('US').notNull(),
		rawTimestamp: timestamp('raw_timestamp', { withTimezone: true, mode: 'string' }).notNull(),
		storeId: uuid('store_id'),
		status: inventoryLedgerStatus().default('WAITING').notNull(),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
			.default(sql`CURRENT_TIMESTAMP`)
			.notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull()
	},
	(table) => [
		index('idx_inventory_ledger_events_asin').using(
			'btree',
			table.asin.asc().nullsLast().op('text_ops')
		),
		index('idx_inventory_ledger_events_event_date').using(
			'btree',
			table.eventDate.asc().nullsLast().op('timestamp_ops')
		),
		index('idx_inventory_ledger_events_event_type').using(
			'btree',
			table.eventType.asc().nullsLast().op('text_ops')
		),
		index('idx_inventory_ledger_events_event_type_reason').using(
			'btree',
			table.eventType.asc().nullsLast().op('text_ops'),
			table.reason.asc().nullsLast().op('text_ops')
		),
		index('idx_inventory_ledger_events_event_type_status').using(
			'btree',
			table.eventType.asc().nullsLast().op('enum_ops'),
			table.status.asc().nullsLast().op('enum_ops')
		),
		index('idx_inventory_ledger_events_fnsku').using(
			'btree',
			table.fnsku.asc().nullsLast().op('text_ops')
		),
		index('idx_inventory_ledger_events_fnsku_event_date').using(
			'btree',
			table.fnsku.asc().nullsLast().op('timestamp_ops'),
			table.eventDate.asc().nullsLast().op('text_ops')
		),
		index('idx_inventory_ledger_events_fulfillment_center').using(
			'btree',
			table.fulfillmentCenter.asc().nullsLast().op('text_ops')
		),
		index('idx_inventory_ledger_events_raw_timestamp').using(
			'btree',
			table.rawTimestamp.asc().nullsLast().op('timestamptz_ops')
		),
		index('idx_inventory_ledger_events_sku').using(
			'btree',
			table.sku.asc().nullsLast().op('text_ops')
		),
		index('idx_inventory_ledger_events_status').using(
			'btree',
			table.status.asc().nullsLast().op('enum_ops')
		),
		index('idx_inventory_ledger_events_status_event_date').using(
			'btree',
			table.status.asc().nullsLast().op('timestamp_ops'),
			table.eventDate.asc().nullsLast().op('enum_ops')
		),
		index('idx_inventory_ledger_events_store_id').using(
			'btree',
			table.storeId.asc().nullsLast().op('uuid_ops')
		),
		index('idx_inventory_ledger_events_unreconciled_quantity').using(
			'btree',
			table.unreconciledQuantity.asc().nullsLast().op('int4_ops')
		)
	]
);

export const amazonOrders = pgTable(
	'amazon_orders',
	{
		id: uuid()
			.default(sql`uuid_generate_v4()`)
			.primaryKey()
			.notNull(),
		amazonOrderId: varchar('amazon_order_id', { length: 255 }).notNull(),
		purchaseDate: timestamp('purchase_date', {
			precision: 6,
			withTimezone: true,
			mode: 'string'
		}).notNull(),
		deliveryDate: timestamp('delivery_date', { precision: 6, withTimezone: true, mode: 'string' }),
		orderStatus: varchar('order_status', { length: 50 }).default('Shipped').notNull(),
		orderTotal: jsonb('order_total').notNull(),
		marketplaceId: varchar('marketplace_id', { length: 50 }).notNull(),
		buyerInfo: jsonb('buyer_info').default({}),
		items: jsonb().default([]),
		isReturned: boolean('is_returned').default(false),
		returnDate: timestamp('return_date', { precision: 6, withTimezone: true, mode: 'string' }),
		reviewRequestSent: boolean('review_request_sent').default(false),
		reviewRequestDate: timestamp('review_request_date', {
			precision: 6,
			withTimezone: true,
			mode: 'string'
		}),
		reviewRequestStatus: varchar('review_request_status', { length: 50 }),
		reviewRequestError: text('review_request_error'),
		createdAt: timestamp('created_at', {
			precision: 6,
			withTimezone: true,
			mode: 'string'
		}).default(sql`CURRENT_TIMESTAMP`),
		updatedAt: timestamp('updated_at', {
			precision: 6,
			withTimezone: true,
			mode: 'string'
		}).default(sql`CURRENT_TIMESTAMP`)
	},
	(table) => [
		uniqueIndex('amazon_orders_amazon_order_id_key').using(
			'btree',
			table.amazonOrderId.asc().nullsLast().op('text_ops')
		),
		index('idx_amazon_orders_amazon_order_id').using(
			'btree',
			table.amazonOrderId.asc().nullsLast().op('text_ops')
		),
		index('idx_amazon_orders_delivery_date').using(
			'btree',
			table.deliveryDate.asc().nullsLast().op('timestamptz_ops')
		),
		index('idx_amazon_orders_is_returned').using(
			'btree',
			table.isReturned.asc().nullsLast().op('bool_ops')
		),
		index('idx_amazon_orders_marketplace_id').using(
			'btree',
			table.marketplaceId.asc().nullsLast().op('text_ops')
		),
		index('idx_amazon_orders_order_status').using(
			'btree',
			table.orderStatus.asc().nullsLast().op('text_ops')
		),
		index('idx_amazon_orders_review_request_sent').using(
			'btree',
			table.reviewRequestSent.asc().nullsLast().op('bool_ops')
		)
	]
);

export const reviewRequests = pgTable(
	'review_requests',
	{
		id: uuid()
			.default(sql`uuid_generate_v4()`)
			.primaryKey()
			.notNull(),
		orderId: uuid('order_id').notNull(),
		amazonOrderId: varchar('amazon_order_id', { length: 255 }).notNull(),
		status: varchar({ length: 50 }).default('pending').notNull(),
		sentAt: timestamp('sent_at', { precision: 6, withTimezone: true, mode: 'string' }),
		errorMessage: text('error_message'),
		retryCount: integer('retry_count').default(0),
		createdAt: timestamp('created_at', {
			precision: 6,
			withTimezone: true,
			mode: 'string'
		}).default(sql`CURRENT_TIMESTAMP`),
		updatedAt: timestamp('updated_at', {
			precision: 6,
			withTimezone: true,
			mode: 'string'
		}).default(sql`CURRENT_TIMESTAMP`)
	},
	(table) => [
		index('idx_review_requests_amazon_order_id').using(
			'btree',
			table.amazonOrderId.asc().nullsLast().op('text_ops')
		),
		index('idx_review_requests_created_at').using(
			'btree',
			table.createdAt.asc().nullsLast().op('timestamptz_ops')
		),
		index('idx_review_requests_order_id').using(
			'btree',
			table.orderId.asc().nullsLast().op('uuid_ops')
		),
		index('idx_review_requests_status').using(
			'btree',
			table.status.asc().nullsLast().op('text_ops')
		),
		foreignKey({
			columns: [table.orderId],
			foreignColumns: [amazonOrders.id],
			name: 'review_requests_order_id_fkey'
		}).onDelete('cascade')
	]
);

export const activityLogs = pgTable(
	'activity_logs',
	{
		id: uuid()
			.default(sql`uuid_generate_v4()`)
			.primaryKey()
			.notNull(),
		action: varchar({ length: 100 }).notNull(),
		details: jsonb().default({}),
		orderId: uuid('order_id'),
		createdAt: timestamp('created_at', {
			precision: 6,
			withTimezone: true,
			mode: 'string'
		}).default(sql`CURRENT_TIMESTAMP`)
	},
	(table) => [
		index('idx_activity_logs_action').using('btree', table.action.asc().nullsLast().op('text_ops')),
		index('idx_activity_logs_created_at').using(
			'btree',
			table.createdAt.asc().nullsLast().op('timestamptz_ops')
		),
		index('idx_activity_logs_order_id').using(
			'btree',
			table.orderId.asc().nullsLast().op('uuid_ops')
		),
		foreignKey({
			columns: [table.orderId],
			foreignColumns: [amazonOrders.id],
			name: 'activity_logs_order_id_fkey'
		}).onDelete('set null')
	]
);

export const reimbursedItems = pgTable(
	'reimbursed_items',
	{
		id: uuid().defaultRandom().primaryKey().notNull(),
		approvalDate: timestamp('approval_date', { withTimezone: true, mode: 'string' }).notNull(),
		reimbursementId: varchar('reimbursement_id', { length: 100 }),
		caseId: varchar('case_id', { length: 100 }),
		amazonOrderId: varchar('amazon_order_id', { length: 100 }),
		reason: varchar({ length: 255 }),
		sku: varchar({ length: 100 }).notNull(),
		fnsku: varchar({ length: 50 }).notNull(),
		asin: varchar({ length: 20 }).notNull(),
		productName: text('product_name').notNull(),
		condition: varchar({ length: 50 }),
		currencyUnit: varchar('currency_unit', { length: 10 }).default('USD').notNull(),
		amountPerUnit: numeric('amount_per_unit', { precision: 10, scale: 2 }).notNull(),
		amountTotal: numeric('amount_total', { precision: 10, scale: 2 }).notNull(),
		quantityReimbursedCash: integer('quantity_reimbursed_cash').default(0).notNull(),
		quantityReimbursedInventory: integer('quantity_reimbursed_inventory').default(0).notNull(),
		quantityReimbursedTotal: integer('quantity_reimbursed_total').notNull(),
		originalReimbursementId: varchar('original_reimbursement_id', { length: 100 }),
		originalReimbursementType: varchar('original_reimbursement_type', { length: 100 }),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
			.defaultNow()
			.notNull()
	},
	(table) => [
		index('idx_reimbursed_items_approval_date').using(
			'btree',
			table.approvalDate.asc().nullsLast().op('timestamptz_ops')
		),
		index('idx_reimbursed_items_asin').using('btree', table.asin.asc().nullsLast().op('text_ops')),
		index('idx_reimbursed_items_case_id').using(
			'btree',
			table.caseId.asc().nullsLast().op('text_ops')
		),
		index('idx_reimbursed_items_fnsku').using(
			'btree',
			table.fnsku.asc().nullsLast().op('text_ops')
		),
		index('idx_reimbursed_items_sku').using('btree', table.sku.asc().nullsLast().op('text_ops')),
		// Unique constraint on reimbursement ID to prevent duplicates
		uniqueIndex('idx_reimbursed_items_reimbursement_id_unique').on(table.reimbursementId)
	]
);

export const customerReturns = pgTable(
	'customer_returns',
	{
		id: uuid().defaultRandom().primaryKey().notNull(),
		returnDate: timestamp('return_date', { withTimezone: true, mode: 'string' }).notNull(),
		orderId: varchar('order_id', { length: 100 }).notNull(),
		orderDate: timestamp('order_date', { withTimezone: true, mode: 'string' }),
		returnRequestDate: timestamp('return_request_date', { withTimezone: true, mode: 'string' }),
		returnRequestStatus: varchar('return_request_status', { length: 50 }),
		amazonRmaId: varchar('amazon_rma_id', { length: 100 }),
		merchantRmaId: varchar('merchant_rma_id', { length: 100 }),
		labelType: varchar('label_type', { length: 50 }),
		labelCost: numeric('label_cost', { precision: 10, scale: 2 }),
		currencyCode: varchar('currency_code', { length: 10 }),
		returnCarrier: varchar('return_carrier', { length: 100 }),
		trackingId: varchar('tracking_id', { length: 100 }),
		labelToBePaidBy: varchar('label_to_be_paid_by', { length: 50 }),
		aToZClaim: boolean('a_to_z_claim').default(false),
		isPrime: boolean('is_prime').default(false),
		asin: varchar({ length: 20 }).notNull(),
		sku: varchar({ length: 100 }).notNull(),
		merchantSku: varchar('merchant_sku', { length: 100 }),
		fnsku: varchar({ length: 50 }).notNull(),
		productName: text('product_name'),
		itemName: text('item_name'),
		quantity: integer('quantity').default(1).notNull(),
		returnQuantity: integer('return_quantity'),
		fulfillmentCenterId: varchar('fulfillment_center_id', { length: 20 }),
		detailedDisposition: varchar('detailed_disposition', { length: 100 }),
		reason: varchar('reason', { length: 255 }),
		returnReason: varchar('return_reason', { length: 255 }),
		status: varchar('status', { length: 100 }),
		licensePlateNumber: varchar('license_plate_number', { length: 100 }),
		customerComments: text('customer_comments'),
		inPolicy: boolean('in_policy'),
		returnType: varchar('return_type', { length: 50 }),
		resolution: varchar({ length: 100 }),
		invoiceNumber: varchar('invoice_number', { length: 100 }),
		returnDeliveryDate: timestamp('return_delivery_date', { withTimezone: true, mode: 'string' }),
		orderAmount: numeric('order_amount', { precision: 10, scale: 2 }),
		orderQuantity: integer('order_quantity'),
		sagaId: varchar('saga_id', { length: 100 }),
		reasonId: varchar('reason_id', { length: 100 }),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
			.defaultNow()
			.notNull()
	},
	(table) => [
		index('idx_customer_returns_asin').using('btree', table.asin.asc().nullsLast().op('text_ops')),
		index('idx_customer_returns_sku').using('btree', table.sku.asc().nullsLast().op('text_ops')),
		index('idx_customer_returns_fnsku').using(
			'btree',
			table.fnsku.asc().nullsLast().op('text_ops')
		),
		index('idx_customer_returns_return_date').using(
			'btree',
			table.returnDate.asc().nullsLast().op('timestamptz_ops')
		),
		index('idx_customer_returns_order_id').using(
			'btree',
			table.orderId.asc().nullsLast().op('text_ops')
		),
		index('idx_customer_returns_return_request_date').using(
			'btree',
			table.returnRequestDate.asc().nullsLast().op('timestamptz_ops')
		),
		index('idx_customer_returns_status').using(
			'btree',
			table.status.asc().nullsLast().op('text_ops')
		),
		// Unique constraint on composite key to prevent duplicates
		unique('idx_customer_returns_order_fnsku_date_unique').on(
			table.orderId,
			table.fnsku,
			table.returnDate
		)
	]
);

export const unsuppressedInventory = pgTable(
	'unsuppressed_inventory',
	{
		id: uuid().defaultRandom().primaryKey().notNull(),
		sku: varchar({ length: 100 }).notNull(),
		fnsku: varchar({ length: 50 }).notNull(),
		asin: varchar({ length: 20 }).notNull(),
		productName: text('product_name').notNull(),
		condition: varchar({ length: 50 }),
		yourPrice: numeric('your_price', { precision: 10, scale: 2 }),
		mfnListingExists: boolean('mfn_listing_exists'),
		mfnFulfillableQuantity: integer('mfn_fulfillable_quantity'),
		afnListingExists: boolean('afn_listing_exists'),
		afnWarehouseQuantity: integer('afn_warehouse_quantity'),
		afnFulfillableQuantity: integer('afn_fulfillable_quantity'),
		afnUnsellableQuantity: integer('afn_unsellable_quantity'),
		afnReservedQuantity: integer('afn_reserved_quantity'),
		afnTotalQuantity: integer('afn_total_quantity'),
		perUnitVolume: numeric('per_unit_volume', { precision: 10, scale: 4 }),
		afnInboundWorkingQuantity: integer('afn_inbound_working_quantity'),
		afnInboundShippedQuantity: integer('afn_inbound_shipped_quantity'),
		afnInboundReceivingQuantity: integer('afn_inbound_receiving_quantity'),
		afnResearchingQuantity: integer('afn_researching_quantity'),
		afnReservedFutureSupply: integer('afn_reserved_future_supply'),
		afnFutureSupplyBuyable: integer('afn_future_supply_buyable'),
		syncDate: timestamp('sync_date', { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
			.defaultNow()
			.notNull()
	},
	(table) => [
		index('idx_unsuppressed_inventory_asin').using(
			'btree',
			table.asin.asc().nullsLast().op('text_ops')
		),
		index('idx_unsuppressed_inventory_fnsku').using(
			'btree',
			table.fnsku.asc().nullsLast().op('text_ops')
		),
		index('idx_unsuppressed_inventory_sku').using(
			'btree',
			table.sku.asc().nullsLast().op('text_ops')
		),
		index('idx_unsuppressed_inventory_sync_date').using(
			'btree',
			table.syncDate.asc().nullsLast().op('timestamptz_ops')
		),
		unique('unsuppressed_inventory_sku_fnsku_asin_sync_date_key').on(
			table.sku,
			table.fnsku,
			table.asin,
			table.syncDate
		)
	]
);

export const claimableItems = pgTable(
	'claimable_items',
	{
		id: uuid().defaultRandom().primaryKey().notNull(),
		fnsku: varchar({ length: 50 }).notNull(),
		asin: varchar({ length: 20 }).notNull(),
		sku: varchar({ length: 100 }).notNull(),
		productName: text('product_name').notNull(),
		category: claimCategory().notNull(),
		status: claimStatus().default('PENDING').notNull(),
		quantity: integer().notNull(),
		estimatedValue: numeric('estimated_value', { precision: 10, scale: 2 }),
		currency: varchar({ length: 10 }).default('USD').notNull(),
		fulfillmentCenter: varchar('fulfillment_center', { length: 20 }),
		eventDate: timestamp('event_date', { withTimezone: true, mode: 'string' }).notNull(),
		referenceId: varchar('reference_id', { length: 100 }),
		reason: text(),
		claimSubmittedDate: timestamp('claim_submitted_date', { withTimezone: true, mode: 'string' }),
		claimCaseId: varchar('claim_case_id', { length: 100 }),
		reimbursementDate: timestamp('reimbursement_date', { withTimezone: true, mode: 'string' }),
		reimbursementAmount: numeric('reimbursement_amount', { precision: 10, scale: 2 }),
		notes: text(),
		createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' })
			.defaultNow()
			.notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' })
			.defaultNow()
			.notNull()
	},
	(table) => [
		index('idx_claimable_items_asin').using('btree', table.asin.asc().nullsLast().op('text_ops')),
		index('idx_claimable_items_category').using(
			'btree',
			table.category.asc().nullsLast().op('enum_ops')
		),
		index('idx_claimable_items_event_date').using(
			'btree',
			table.eventDate.asc().nullsLast().op('timestamptz_ops')
		),
		index('idx_claimable_items_fnsku').using('btree', table.fnsku.asc().nullsLast().op('text_ops')),
		index('idx_claimable_items_sku').using('btree', table.sku.asc().nullsLast().op('text_ops')),
		index('idx_claimable_items_status').using(
			'btree',
			table.status.asc().nullsLast().op('enum_ops')
		)
	]
);
