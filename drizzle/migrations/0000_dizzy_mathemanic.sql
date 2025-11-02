CREATE TYPE "public"."claim_category" AS ENUM('LOST_WAREHOUSE', 'DAMAGED_WAREHOUSE', 'LOST_INBOUND', 'DAMAGED_INBOUND', 'CUSTOMER_RETURN_NOT_RECEIVED', 'CUSTOMER_RETURN_DAMAGED', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."claim_status" AS ENUM('PENDING', 'CLAIMABLE', 'CLAIMED', 'REIMBURSED', 'DENIED', 'EXPIRED');--> statement-breakpoint
CREATE TYPE "public"."InventoryLedgerStatus" AS ENUM('WAITING', 'CLAIMABLE', 'RESOLVED', 'CLAIMED', 'PAID');--> statement-breakpoint
CREATE TABLE "activity_logs" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"action" varchar(100) NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb,
	"order_id" uuid,
	"created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "amazon_api_config" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"client_id" varchar(255) NOT NULL,
	"client_secret" varchar(255) NOT NULL,
	"refresh_token" text NOT NULL,
	"marketplace_id" varchar(50) NOT NULL,
	"access_token" text,
	"token_expires_at" timestamp(6) with time zone,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "amazon_orders" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"amazon_order_id" varchar(255) NOT NULL,
	"purchase_date" timestamp(6) with time zone NOT NULL,
	"delivery_date" timestamp(6) with time zone,
	"order_status" varchar(50) DEFAULT 'Shipped' NOT NULL,
	"order_total" jsonb NOT NULL,
	"marketplace_id" varchar(50) NOT NULL,
	"buyer_info" jsonb DEFAULT '{}'::jsonb,
	"items" jsonb DEFAULT '[]'::jsonb,
	"is_returned" boolean DEFAULT false,
	"return_date" timestamp(6) with time zone,
	"review_request_sent" boolean DEFAULT false,
	"review_request_date" timestamp(6) with time zone,
	"review_request_status" varchar(50),
	"review_request_error" text,
	"created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "claimable_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fnsku" varchar(50) NOT NULL,
	"asin" varchar(20) NOT NULL,
	"sku" varchar(100) NOT NULL,
	"product_name" text NOT NULL,
	"category" "claim_category" NOT NULL,
	"status" "claim_status" DEFAULT 'PENDING' NOT NULL,
	"quantity" integer NOT NULL,
	"estimated_value" numeric(10, 2),
	"currency" varchar(10) DEFAULT 'USD' NOT NULL,
	"fulfillment_center" varchar(20),
	"event_date" timestamp with time zone NOT NULL,
	"reference_id" varchar(100),
	"reason" text,
	"claim_submitted_date" timestamp with time zone,
	"claim_case_id" varchar(100),
	"reimbursement_date" timestamp with time zone,
	"reimbursement_amount" numeric(10, 2),
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customer_returns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"return_date" timestamp with time zone NOT NULL,
	"order_id" varchar(100) NOT NULL,
	"order_date" timestamp with time zone,
	"return_request_date" timestamp with time zone,
	"return_request_status" varchar(50),
	"amazon_rma_id" varchar(100),
	"merchant_rma_id" varchar(100),
	"label_type" varchar(50),
	"label_cost" numeric(10, 2),
	"currency_code" varchar(10),
	"return_carrier" varchar(100),
	"tracking_id" varchar(100),
	"label_to_be_paid_by" varchar(50),
	"a_to_z_claim" boolean DEFAULT false,
	"is_prime" boolean DEFAULT false,
	"asin" varchar(20) NOT NULL,
	"sku" varchar(100) NOT NULL,
	"merchant_sku" varchar(100),
	"fnsku" varchar(50) NOT NULL,
	"product_name" text,
	"item_name" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"return_quantity" integer,
	"fulfillment_center_id" varchar(20),
	"detailed_disposition" varchar(100),
	"reason" varchar(255),
	"return_reason" varchar(255),
	"status" varchar(100),
	"license_plate_number" varchar(100),
	"customer_comments" text,
	"in_policy" boolean,
	"return_type" varchar(50),
	"resolution" varchar(100),
	"invoice_number" varchar(100),
	"return_delivery_date" timestamp with time zone,
	"order_amount" numeric(10, 2),
	"order_quantity" integer,
	"saga_id" varchar(100),
	"reason_id" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_ledger_events" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"event_date" timestamp(3) NOT NULL,
	"fnsku" varchar(50) NOT NULL,
	"asin" varchar(20) NOT NULL,
	"sku" varchar(100) NOT NULL,
	"product_title" text NOT NULL,
	"event_type" varchar(50) NOT NULL,
	"reference_id" varchar(100),
	"quantity" integer NOT NULL,
	"fulfillment_center" varchar(20),
	"disposition" varchar(50),
	"reason" varchar(10),
	"reconciled_quantity" integer DEFAULT 0 NOT NULL,
	"unreconciled_quantity" integer DEFAULT 0 NOT NULL,
	"country" varchar(10) DEFAULT 'US' NOT NULL,
	"raw_timestamp" timestamp with time zone NOT NULL,
	"store_id" uuid,
	"status" "InventoryLedgerStatus" DEFAULT 'WAITING' NOT NULL,
	"created_at" timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);

--> statement-breakpoint
CREATE TABLE "reimbursed_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"approval_date" timestamp with time zone NOT NULL,
	"reimbursement_id" varchar(100),
	"case_id" varchar(100),
	"amazon_order_id" varchar(100),
	"reason" varchar(255),
	"sku" varchar(100) NOT NULL,
	"fnsku" varchar(50) NOT NULL,
	"asin" varchar(20) NOT NULL,
	"product_name" text NOT NULL,
	"condition" varchar(50),
	"currency_unit" varchar(10) DEFAULT 'USD' NOT NULL,
	"amount_per_unit" numeric(10, 2) NOT NULL,
	"amount_total" numeric(10, 2) NOT NULL,
	"quantity_reimbursed_cash" integer DEFAULT 0 NOT NULL,
	"quantity_reimbursed_inventory" integer DEFAULT 0 NOT NULL,
	"quantity_reimbursed_total" integer NOT NULL,
	"original_reimbursement_id" varchar(100),
	"original_reimbursement_type" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "reimbursement_sync_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sync_type" varchar(50) NOT NULL,
	"start_date" timestamp with time zone,
	"end_date" timestamp with time zone,
	"status" varchar(50) NOT NULL,
	"records_processed" integer DEFAULT 0 NOT NULL,
	"records_added" integer DEFAULT 0 NOT NULL,
	"records_updated" integer DEFAULT 0 NOT NULL,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "review_requests" (
	"id" uuid PRIMARY KEY DEFAULT uuid_generate_v4() NOT NULL,
	"order_id" uuid NOT NULL,
	"amazon_order_id" varchar(255) NOT NULL,
	"status" varchar(50) DEFAULT 'pending' NOT NULL,
	"sent_at" timestamp(6) with time zone,
	"error_message" text,
	"retry_count" integer DEFAULT 0,
	"created_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP,
	"updated_at" timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP
);
--> statement-breakpoint
CREATE TABLE "unsuppressed_inventory" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sku" varchar(100) NOT NULL,
	"fnsku" varchar(50) NOT NULL,
	"asin" varchar(20) NOT NULL,
	"product_name" text NOT NULL,
	"condition" varchar(50),
	"your_price" numeric(10, 2),
	"mfn_listing_exists" boolean,
	"mfn_fulfillable_quantity" integer,
	"afn_listing_exists" boolean,
	"afn_warehouse_quantity" integer,
	"afn_fulfillable_quantity" integer,
	"afn_unsellable_quantity" integer,
	"afn_reserved_quantity" integer,
	"afn_total_quantity" integer,
	"per_unit_volume" numeric(10, 4),
	"afn_inbound_working_quantity" integer,
	"afn_inbound_shipped_quantity" integer,
	"afn_inbound_receiving_quantity" integer,
	"afn_researching_quantity" integer,
	"afn_reserved_future_supply" integer,
	"afn_future_supply_buyable" integer,
	"sync_date" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "unsuppressed_inventory_sku_fnsku_asin_sync_date_key" UNIQUE("sku","fnsku","asin","sync_date")
);
--> statement-breakpoint
ALTER TABLE "activity_logs" ADD CONSTRAINT "activity_logs_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."amazon_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_requests" ADD CONSTRAINT "review_requests_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "public"."amazon_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_activity_logs_action" ON "activity_logs" USING btree ("action" text_ops);--> statement-breakpoint
CREATE INDEX "idx_activity_logs_created_at" ON "activity_logs" USING btree ("created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_activity_logs_order_id" ON "activity_logs" USING btree ("order_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "amazon_orders_amazon_order_id_key" ON "amazon_orders" USING btree ("amazon_order_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_amazon_orders_amazon_order_id" ON "amazon_orders" USING btree ("amazon_order_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_amazon_orders_delivery_date" ON "amazon_orders" USING btree ("delivery_date" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_amazon_orders_is_returned" ON "amazon_orders" USING btree ("is_returned" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_amazon_orders_marketplace_id" ON "amazon_orders" USING btree ("marketplace_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_amazon_orders_order_status" ON "amazon_orders" USING btree ("order_status" text_ops);--> statement-breakpoint
CREATE INDEX "idx_amazon_orders_review_request_sent" ON "amazon_orders" USING btree ("review_request_sent" bool_ops);--> statement-breakpoint
CREATE INDEX "idx_claimable_items_asin" ON "claimable_items" USING btree ("asin" text_ops);--> statement-breakpoint
CREATE INDEX "idx_claimable_items_category" ON "claimable_items" USING btree ("category" enum_ops);--> statement-breakpoint
CREATE INDEX "idx_claimable_items_event_date" ON "claimable_items" USING btree ("event_date" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_claimable_items_fnsku" ON "claimable_items" USING btree ("fnsku" text_ops);--> statement-breakpoint
CREATE INDEX "idx_claimable_items_sku" ON "claimable_items" USING btree ("sku" text_ops);--> statement-breakpoint
CREATE INDEX "idx_claimable_items_status" ON "claimable_items" USING btree ("status" enum_ops);--> statement-breakpoint
CREATE INDEX "idx_customer_returns_asin" ON "customer_returns" USING btree ("asin" text_ops);--> statement-breakpoint
CREATE INDEX "idx_customer_returns_sku" ON "customer_returns" USING btree ("sku" text_ops);--> statement-breakpoint
CREATE INDEX "idx_customer_returns_fnsku" ON "customer_returns" USING btree ("fnsku" text_ops);--> statement-breakpoint
CREATE INDEX "idx_customer_returns_return_date" ON "customer_returns" USING btree ("return_date" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_customer_returns_order_id" ON "customer_returns" USING btree ("order_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_customer_returns_return_request_date" ON "customer_returns" USING btree ("return_request_date" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_customer_returns_status" ON "customer_returns" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "idx_inventory_ledger_events_asin" ON "inventory_ledger_events" USING btree ("asin" text_ops);--> statement-breakpoint
CREATE INDEX "idx_inventory_ledger_events_event_date" ON "inventory_ledger_events" USING btree ("event_date" timestamp_ops);--> statement-breakpoint
CREATE INDEX "idx_inventory_ledger_events_event_type" ON "inventory_ledger_events" USING btree ("event_type" text_ops);--> statement-breakpoint
CREATE INDEX "idx_inventory_ledger_events_event_type_reason" ON "inventory_ledger_events" USING btree ("event_type" text_ops,"reason" text_ops);--> statement-breakpoint
CREATE INDEX "idx_inventory_ledger_events_event_type_status" ON "inventory_ledger_events" USING btree ("event_type" enum_ops,"status" enum_ops);--> statement-breakpoint
CREATE INDEX "idx_inventory_ledger_events_fnsku" ON "inventory_ledger_events" USING btree ("fnsku" text_ops);--> statement-breakpoint
CREATE INDEX "idx_inventory_ledger_events_fnsku_event_date" ON "inventory_ledger_events" USING btree ("fnsku" timestamp_ops,"event_date" text_ops);--> statement-breakpoint
CREATE INDEX "idx_inventory_ledger_events_fulfillment_center" ON "inventory_ledger_events" USING btree ("fulfillment_center" text_ops);--> statement-breakpoint
CREATE INDEX "idx_inventory_ledger_events_raw_timestamp" ON "inventory_ledger_events" USING btree ("raw_timestamp" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_inventory_ledger_events_sku" ON "inventory_ledger_events" USING btree ("sku" text_ops);--> statement-breakpoint
CREATE INDEX "idx_inventory_ledger_events_status" ON "inventory_ledger_events" USING btree ("status" enum_ops);--> statement-breakpoint
CREATE INDEX "idx_inventory_ledger_events_status_event_date" ON "inventory_ledger_events" USING btree ("status" timestamp_ops,"event_date" enum_ops);--> statement-breakpoint
CREATE INDEX "idx_inventory_ledger_events_store_id" ON "inventory_ledger_events" USING btree ("store_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_inventory_ledger_events_unreconciled_quantity" ON "inventory_ledger_events" USING btree ("unreconciled_quantity" int4_ops);--> statement-breakpoint
CREATE INDEX "idx_reimbursed_items_approval_date" ON "reimbursed_items" USING btree ("approval_date" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_reimbursed_items_asin" ON "reimbursed_items" USING btree ("asin" text_ops);--> statement-breakpoint
CREATE INDEX "idx_reimbursed_items_case_id" ON "reimbursed_items" USING btree ("case_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_reimbursed_items_fnsku" ON "reimbursed_items" USING btree ("fnsku" text_ops);--> statement-breakpoint
CREATE INDEX "idx_reimbursed_items_sku" ON "reimbursed_items" USING btree ("sku" text_ops);--> statement-breakpoint
CREATE INDEX "idx_reimbursement_sync_logs_created_at" ON "reimbursement_sync_logs" USING btree ("created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_reimbursement_sync_logs_status" ON "reimbursement_sync_logs" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "idx_reimbursement_sync_logs_sync_type" ON "reimbursement_sync_logs" USING btree ("sync_type" text_ops);--> statement-breakpoint
CREATE INDEX "idx_review_requests_amazon_order_id" ON "review_requests" USING btree ("amazon_order_id" text_ops);--> statement-breakpoint
CREATE INDEX "idx_review_requests_created_at" ON "review_requests" USING btree ("created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "idx_review_requests_order_id" ON "review_requests" USING btree ("order_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "idx_review_requests_status" ON "review_requests" USING btree ("status" text_ops);--> statement-breakpoint
CREATE INDEX "idx_unsuppressed_inventory_asin" ON "unsuppressed_inventory" USING btree ("asin" text_ops);--> statement-breakpoint
CREATE INDEX "idx_unsuppressed_inventory_fnsku" ON "unsuppressed_inventory" USING btree ("fnsku" text_ops);--> statement-breakpoint
CREATE INDEX "idx_unsuppressed_inventory_sku" ON "unsuppressed_inventory" USING btree ("sku" text_ops);--> statement-breakpoint
CREATE INDEX "idx_unsuppressed_inventory_sync_date" ON "unsuppressed_inventory" USING btree ("sync_date" timestamptz_ops);