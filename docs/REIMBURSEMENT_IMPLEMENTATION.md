# Reimbursement Engine Implementation Guide

## Overview

The reimbursement engine is a Phase-1 implementation designed to identify and claim reimbursements from Amazon for lost, damaged, or mishandled inventory. This document provides a comprehensive guide to how the system works, what it does, and how to use it.

## Architecture

### Data Flow

```
Amazon SP-API Reports → Parse & Store → Analyze & Identify → Create Claims
```

1. **Sync Reports**: Fetch data from Amazon using SP-API
2. **Parse & Store**: Convert CSV/TSV data into structured database records
3. **Analyze**: Apply business logic to identify claimable items
4. **Create Claims**: Generate claimable item records for review

### Database Schema

The reimbursement system uses several key tables:

#### `inventory_ledger_events`

Stores all inventory movements and events from `GET_LEDGER_DETAIL_VIEW_DATA`:

- `eventType`: Type of event (Adjustments, CustomerReturns, Shipments, etc.)
- `reason`: Adjustment reason code (M, 5, D, W, etc.)
- `unreconciledQuantity`: Amount that cannot be accounted for
- `fnsku`, `asin`, `sku`: Product identifiers

#### `reimbursed_items`

Tracks items that Amazon has already reimbursed:

- Used to avoid duplicate claims
- Key fields: `fnsku`, `asin`, `approvalDate`, `amountTotal`

#### `customer_returns`

Stores customer return information from `GET_FBA_FULFILLMENT_CUSTOMER_RETURNS_DATA`:

- `returnDate`, `orderId`, `fnsku`, `asin`, `sku`
- `detailedDisposition`: CUSTOMER_DAMAGED, SELLABLE, etc.
- `status`: Unit returned to inventory, etc.

#### `unsuppressed_inventory`

Current inventory snapshot from `GET_FBA_MYI_UNSUPPRESSED_INVENTORY_DATA`:

- Used to calculate estimated values for claims
- `yourPrice`: Product price for value estimation

#### `claimable_items`

Generated claims ready for submission to Amazon:

- `category`: LOST_WAREHOUSE, DAMAGED_WAREHOUSE, CUSTOMER_RETURN_NOT_RECEIVED, CUSTOMER_RETURN_DAMAGED, etc.
- `status`: PENDING, CLAIMABLE, CLAIMED, REIMBURSED, DENIED, EXPIRED
- `estimatedValue`: Calculated reimbursement amount
- `reason`: Detailed explanation for the claim

## Phase-1 Reimbursement Flow

### Step 1: Lost Inventory in Warehouse

**Source**: `GET_LEDGER_DETAIL_VIEW_DATA` (inventory_ledger_events)

**Filter Logic**:

```
EventType = "Adjustments"
AND Reason IN ("M", "5")
AND UnreconciledQuantity > 0
```

**What this means**:

- **M**: Missing inventory (cannot be found)
- **5**: Other loss reasons
- **UnreconciledQuantity**: Inventory that should be there but isn't

**Implementation**:

- Queries `inventory_ledger_events` for matching events
- Excludes items already reimbursed (checked in `reimbursed_items`)
- Excludes items already in claimable_items
- Estimates value from `unsuppressed_inventory.yourPrice`
- Creates `claimable_items` with category `LOST_WAREHOUSE`

**Example**:

```sql
-- Find FNSKU X002886EVR lost on Oct 22
SELECT * FROM inventory_ledger_events
WHERE event_type = 'Adjustments'
AND reason = 'M'
AND unreconciled_quantity > 0
AND fnsku = 'X002886EVR'
AND event_date = '2025-10-22';
```

### Step 2: Warehouse-Damaged Inventory Not Reimbursed

**Source**: `GET_LEDGER_DETAIL_VIEW_DATA` (inventory_ledger_events)

**Filter Logic**:

```
EventType = "Adjustments"
AND Reason IN ("D", "W")
```

**What this means**:

- **D**: Damaged by Amazon
- **W**: Damaged in warehouse/fulfillment center

**Additional Check**:
Cross-reference with `GET_FBA_REIMBURSEMENTS_DATA` (reimbursed_items) to ensure Amazon hasn't already paid.

**Implementation**:

- Finds adjustment events with damage reasons
- Verifies no reimbursement exists for that `fnsku` + date
- Estimates value and creates claimable item with category `DAMAGED_WAREHOUSE`

**Example**:

```sql
-- Find damaged items on Oct 24
SELECT * FROM inventory_ledger_events
WHERE event_type = 'Adjustments'
AND reason IN ('D', 'W')
AND event_date >= '2025-10-24';
```

### Step 3: Customer Refunded But Item Not Returned ⚠️ Placeholder

**Source**: `GET_FBA_FULFILLMENT_CUSTOMER_RETURNS_DATA`

**Logic**:
Customer received refund but never returned the item.

**Status**: Not fully implemented - requires additional refund data structure analysis.

**Future Enhancement**:

- Need to identify which customer returns had refunds issued
- Cross-reference with ledger to verify item was never returned
- Create claims for `CUSTOMER_RETURN_NOT_RECEIVED` category

### Step 4: Customer Returned Item But Amazon Lost It

**Source**:

- `GET_FBA_FULFILLMENT_CUSTOMER_RETURNS_DATA` (customer_returns)
- `GET_LEDGER_DETAIL_VIEW_DATA` (inventory_ledger_events)

**Filter Logic**:

```
Status = "Unit returned to inventory"
AND No corresponding CustomerReturns event in ledger
AND No reimbursement exists
```

**What this means**:
Customer returned item to Amazon, Amazon marked it as "returned to inventory", but the item never actually re-entered inventory tracking.

**Implementation**:

- Gets all customer returns with status "Unit returned to inventory"
- Checks for matching `CustomerReturns` event in `inventory_ledger_events`
- If no event found, checks if already reimbursed
- Creates claimable item with category `CUSTOMER_RETURN_NOT_RECEIVED`

**Example**:

```sql
-- Find returns that never showed up in ledger
SELECT cr.* FROM customer_returns cr
WHERE cr.status = 'Unit returned to inventory'
AND NOT EXISTS (
  SELECT 1 FROM inventory_ledger_events ile
  WHERE ile.fnsku = cr.fnsku
  AND ile.event_type = 'CustomerReturns'
  AND ile.event_date >= cr.return_date
);
```

### Step 5: Customer Damaged Return Without Reimbursement

**Source**: `GET_FBA_FULFILLMENT_CUSTOMER_RETURNS_DATA`

**Filter Logic**:

```
detailedDisposition = "CUSTOMER_DAMAGED"
AND No reimbursement exists
```

**What this means**:
Customer returned item damaged (their fault), but Amazon didn't reimburse the seller for accepting damaged inventory.

**Implementation**:

- Finds all returns with `detailedDisposition = CUSTOMER_DAMAGED`
- Checks if already reimbursed in `reimbursed_items`
- Estimates value and creates claimable item with category `CUSTOMER_RETURN_DAMAGED`

**Example from sample data**:

```
Line 6: X0041X3PTV returned as CUSTOMER_DAMAGED on Oct 28
→ Check: Is there a reimbursement in reimbursed_items?
→ If NO: Create claim for $X
```

## Usage

### Running the Sync

```typescript
// Via API endpoint
POST /api/reimbursement/sync
Body: {
  dataStartTime: "2025-07-30T00:00:00Z",
  dataEndTime: "2025-10-30T23:59:59Z"
}

// Or programmatically
import { ReimbursementService } from '$lib/db/services/reimbursement';

const service = new ReimbursementService();
const result = await service.syncAllReports(startTime, endTime);

console.log(result);
// {
//   success: true,
//   reportIds: { reimbursement: "...", customerReturns: "...", unsuppressedInventory: "..." },
//   processedCounts: { reimbursed: 100, returns: 50, inventory: 200, claimable: 15 },
//   errors: []
// }
```

### Viewing Claimable Items

```typescript
const service = new ReimbursementService();

// Get all claimable items
const { items, total } = await service.getClaimableItems(limit: 50, offset: 0);

// Get by category
const lostItems = await service.getClaimableItems(50, 0, 'LOST_WAREHOUSE');
const damagedItems = await service.getClaimableItems(50, 0, 'DAMAGED_WAREHOUSE');

// Get statistics
const stats = await service.getStats();
// Returns breakdown by category: RECOVERED, LOST_WAREHOUSE, etc.
```

### API Endpoints

```
GET  /api/reimbursement/items?category=LOST_WAREHOUSE&limit=50&offset=0
GET  /api/reimbursement/tickets
GET  /api/reimbursement/stats
POST /api/reimbursement/sync
```

## Reason Codes Reference

### Inventory Ledger Adjustment Reasons

| Code | Meaning                               | Claimable?                 |
| ---- | ------------------------------------- | -------------------------- |
| M    | Missing inventory                     | ✅ Yes - LOST_WAREHOUSE    |
| 5    | Other loss                            | ✅ Yes - LOST_WAREHOUSE    |
| D    | Damaged by Amazon                     | ✅ Yes - DAMAGED_WAREHOUSE |
| W    | Damaged in warehouse                  | ✅ Yes - DAMAGED_WAREHOUSE |
| N    | Found inventory (positive adjustment) | ❌ No                      |

### Customer Return Dispositions

| Disposition      | Meaning                             | Category                |
| ---------------- | ----------------------------------- | ----------------------- |
| SELLABLE         | Item returned in sellable condition | -                       |
| CUSTOMER_DAMAGED | Customer damaged the item           | CUSTOMER_RETURN_DAMAGED |

## Value Estimation

The system estimates claim values using `unsuppressed_inventory.yourPrice`:

```typescript
estimatedValue = yourPrice × quantity
```

**Limitations**:

- Uses current price, not historical price
- Doesn't account for marketplace fluctuations
- May not reflect actual reimbursement amount

**Future Enhancement**:

- Track historical prices
- Use date-specific pricing
- Apply Amazon's reimbursement formula

## Deduplication Logic

The system prevents duplicate claims by checking:

1. **Already Reimbursed**: Queries `reimbursed_items` to find existing reimbursements
2. **Already Claimable**: Queries `claimable_items` to find existing claims
3. **Unique Keys**: Uses `fnsku` + `category` + `eventDate` as deduplication key

## Error Handling

Each step of the analysis is wrapped in try-catch to ensure one failure doesn't stop the entire process:

```typescript
try {
	const lostCount = await this.findLostWarehouseInventory();
} catch (error) {
	logger.error('Failed to find lost warehouse inventory', { error });
	// Returns 0, process continues
	return 0;
}
```

## Logging

All operations are logged using the structured logger:

```typescript
logger.info('Reimbursement analysis completed', {
	totalClaimableCount: 15,
	byStep: {
		lostWarehouse: 5,
		damagedWarehouse: 3,
		refundWithoutReturn: 0,
		lostReturns: 4,
		damagedReturns: 3
	}
});
```

Logs are available in:

- `logs/debug.log`: Debug and info logs
- `logs/combined.log`: All logs
- `logs/reimbursement-debug.log`: Reimbursement-specific logs

## Testing the Implementation

### Sample Data Verification

The system has sample data in `storage/` directory:

```
storage/
  inventory-ledger-2025-07-30_2025-10-30.csv
  customer-returns-2025-07-30_2025-10-30.csv
  reimbursement-2025-07-30_2025-10-30.csv
```

You can use these files to verify parsing and analysis logic.

### Manual Testing

```bash
# Run the sync
curl -X POST http://localhost:5173/api/reimbursement/sync \
  -H "Content-Type: application/json" \
  -d '{}'

# Check results
curl http://localhost:5173/api/reimbursement/stats
curl http://localhost:5173/api/reimbursement/items?limit=10
```

## Future Enhancements

### Phase 2 - Additional Reports

- `GET_FBA_FULFILLMENT_INBOUND_NONCOMPLIANCE_DATA`: Stuck inbound shipments
- `GET_REPLACEMENT_ORDER_DATA`: Replacement order analysis
- `GET_FBA_RECEIVED_INVENTORY_DATA`: Cross-reference receipts

### Phase 3 - Automation

- Auto-submit claims via Seller Central API
- Auto-tracking of claim status
- Auto-escalation of denied claims
- Email notifications for high-value claims

### Phase 4 - Advanced Analytics

- Pattern detection (warehouses with high loss rates)
- Predictive analytics (identify likely issues before claims)
- ROI reporting (recovery rate by category/period)
- Reconciliation with actual Amazon reimbursements

## Troubleshooting

### No Claimable Items Found

**Possible Causes**:

1. No data synced yet - run sync first
2. All items already reimbursed or claimed
3. Incorrect date range
4. Schema mismatch

**Debug**:

```bash
# Check raw data
curl http://localhost:5173/api/inventory-ledger

# Check reimbursed items
curl http://localhost:5173/api/reimbursement/items?category=RECOVERED

# Check logs
tail -f logs/debug.log
```

### Incorrect Values

**Possible Causes**:

1. Missing `unsuppressed_inventory` data
2. Outdated pricing data
3. Currency mismatch

**Fix**:

- Re-sync `GET_FBA_MYI_UNSUPPRESSED_INVENTORY_DATA`
- Verify `yourPrice` is current
- Check currency unit matches

### Migration Errors

If you encounter schema issues:

```bash
# Generate new migration
npm run db:generate

# Apply migration
npm run db:push

# Or via Supabase
supabase db push
```

## Database Indexes

For optimal performance, the following indexes are created:

**inventory_ledger_events**:

- `idx_inventory_ledger_events_event_type_reason`: For Step 1 & 2 filtering
- `idx_inventory_ledger_events_fnsku`: For cross-referencing
- `idx_inventory_ledger_events_event_date`: For time-based queries

**customer_returns**:

- `idx_customer_returns_fnsku`: For cross-referencing
- `idx_customer_returns_return_date`: For time-based queries
- `idx_customer_returns_status`: For Step 4 filtering

**claimable_items**:

- `idx_claimable_items_category`: For category filtering
- `idx_claimable_items_status`: For status-based queries

## Performance Considerations

### Optimization Strategies

1. **Batch Processing**: Analysis processes items in batches to avoid memory issues
2. **Efficient Queries**: Uses indexed fields for lookups
3. **Deduplication**: Single query to check existing claims
4. **Connection Pooling**: Drizzle ORM handles connection pooling

### Expected Performance

- **Sync**: ~30 seconds for 3-month range (depends on Amazon API)
- **Analysis**: ~5-10 seconds for 1000 events
- **Query**: <100ms for paginated results

### Scaling

For large datasets:

- Add pagination to analysis steps
- Use database views for complex queries
- Consider materialized views for statistics
- Implement incremental sync

## Security

### API Keys

Amazon credentials stored in environment variables:

```env
AMAZON_CLIENT_ID=...
AMAZON_CLIENT_SECRET=...
AMAZON_REFRESH_TOKEN=...
AMAZON_MARKETPLACE_ID=...
```

**Never commit `.env` to version control!**

### Access Control

Currently no authentication - add in production:

- User authentication
- Role-based access control
- Audit logging of all claims

## Monitoring

### Key Metrics

Track these metrics:

1. **Recovery Rate**: (Reimbursements / Claimable Items) × 100
2. **Average Claim Value**: Total Value / Number of Claims
3. **Processing Time**: Sync duration + Analysis duration
4. **Error Rate**: Failed syncs / Total syncs

### Alerts

Set up alerts for:

- Sync failures
- High-value claims (>$1000)
- Unusual patterns (sudden spike in losses)
- System errors

## Support

For issues or questions:

1. Check logs in `logs/debug.log`
2. Review this documentation
3. Test with sample data in `storage/`
4. Contact development team

## References

- **Amazon SP-API Docs**: https://developer-docs.amazon.com/sp-api/
- **Reimbursement Policy**: https://sellercentral.amazon.com/gp/help/G201431110
- **Leadger Detail View**: GET_LEDGER_DETAIL_VIEW_DATA report specification
- **Customer Returns**: GET_FBA_FULFILLMENT_CUSTOMER_RETURNS_DATA report specification
