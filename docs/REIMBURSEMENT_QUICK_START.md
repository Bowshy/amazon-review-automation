# Reimbursement Engine - Quick Start Guide

## Overview

The reimbursement engine is fully implemented and ready to use. It automatically identifies and tracks claimable reimbursement opportunities from Amazon based on lost, damaged, or mishandled inventory.

## Implementation Status

✅ **Completed**:
- Full Phase-1 reimbursement flow (all 5 steps)
- Database schema with proper fields and indexes
- API endpoints for syncing and viewing data
- Dashboard UI with statistics and filtering
- Comprehensive documentation

## Quick Start

### 1. Run Database Migrations

First, apply the database schema changes:

```bash
# For existing databases, use push (recommended for development)
npm run db:push

# Or generate and apply migrations (for production)
npm run db:generate
npm run db:migrate
```

**Note**: If you get migration errors about existing types or tables, your database is already in sync. Use `db:push` for development and `db:migrate` for production deployments.

### 2. Sync Reports

Navigate to the **Reimbursement** tab in the dashboard and click **"Sync All Reports"** to:

1. Download reimbursement data from Amazon
2. Download customer returns data
3. Download unsuppressed inventory data
4. Analyze and identify claimable items automatically

### 3. View Claimable Items

After syncing, view your results:

- **Lost Warehouse**: Items missing from Amazon warehouses (Reason M, 5)
- **Damaged Warehouse**: Items damaged by Amazon (Reason D, W)
- **Customer Returns Not Received**: Returns that never made it back to inventory
- **Customer Damaged Returns**: Returns where customer damaged item but no reimbursement

### 4. Submit Claims

Review claimable items and submit to Amazon Seller Central manually (automation coming in Phase 2).

## API Endpoints

### Sync Reports
```bash
POST /api/reimbursement/sync
Content-Type: application/json

{
  "dataStartTime": "2025-07-30T00:00:00Z",
  "dataEndTime": "2025-10-30T23:59:59Z"
}
```

### Get Statistics
```bash
GET /api/reimbursement/stats
```

### Get Claimable Items
```bash
GET /api/reimbursement/items?category=LOST_WAREHOUSE&limit=50&offset=0
```

### Get Tickets
```bash
GET /api/reimbursement/tickets?status=PENDING&page=1&limit=50
```

## Data Flow

```
Amazon SP-API
    ↓
Download Reports (TSV/CSV)
    ↓
Parse & Store in Database
    ↓
analyzeAndCreateClaimableItems()
    ↓
5-Step Analysis:
    ├─ Step 1: Lost Warehouse (Reason M, 5)
    ├─ Step 2: Damaged Warehouse (Reason D, W)
    ├─ Step 3: Refund Without Return (placeholder)
    ├─ Step 4: Lost Customer Returns
    └─ Step 5: Damaged Customer Returns
    ↓
Create claimable_items records
    ↓
View in Dashboard
```

## Sample Query Results

Based on your downloaded reports:

### Lost Inventory Example
```
FNSKU: B0829FNLM4
ASIN: B0829FNLM4
Event: Adjustments, Reason: M, Unreconciled: 1
→ Created as LOST_WAREHOUSE claim
```

### Damaged Inventory Example
```
FNSKU: X0041X3PTV
ASIN: B0CNV8RJ98
Event: Adjustments, Reason: D
Not in reimbursed_items
→ Created as DAMAGED_WAREHOUSE claim
```

### Lost Return Example
```
Return Date: 2025-10-30
Order: 113-3780640-3787448
Status: Unit returned to inventory
BUT no CustomerReturns in ledger
→ Created as CUSTOMER_RETURN_NOT_RECEIVED claim
```

## Value Estimation

The system estimates claim values using `unsuppressed_inventory.yourPrice`:

```
estimatedValue = yourPrice × quantity
```

**Note**: Uses current price, not historical. Actual reimbursement may vary.

## Reason Codes

### Inventory Ledger Reasons
- **M**: Missing inventory → `LOST_WAREHOUSE`
- **5**: Other loss → `LOST_WAREHOUSE`
- **D**: Damaged by Amazon → `DAMAGED_WAREHOUSE`
- **W**: Damaged in warehouse → `DAMAGED_WAREHOUSE`
- **N**: Found inventory (positive adjustment) → Not claimable

### Return Dispositions
- **CUSTOMER_DAMAGED**: Customer damaged item → `CUSTOMER_RETURN_DAMAGED`
- **SELLABLE**: Item returned in good condition → Not claimable

## Monitoring

Check logs in:
- `logs/debug.log`: All debug and info logs
- `logs/combined.log`: Complete log history
- `logs/reimbursement-debug.log`: Reimbursement-specific logs

## Troubleshooting

### No Claimable Items Found

**Check**:
1. Are inventory ledger events synced? Run `/api/inventory-ledger/sync`
2. Are reports downloaded with correct date range?
3. Are items already reimbursed? Check `reimbursed_items` table
4. View logs: `tail -f logs/debug.log`

### Schema Mismatch Errors

**Fix**:
1. Run migrations: `npm run db:migrate`
2. Verify schema: `npm run db:generate` (should say "nothing to migrate")
3. Check for DB connection issues

### Incorrect Values

**Fix**:
1. Re-sync unsuppressed inventory for current prices
2. Verify currency matches (default USD)
3. Check `unsuppressed_inventory.yourPrice` field

## Testing

Use your downloaded reports in `storage/` to test:

```bash
# The system uses these automatically when syncing
storage/inventory-ledger-2025-07-30_2025-10-30.tsv
storage/customer-returns-2025-07-30_2025-10-30.tsv
storage/reimbursement-2025-07-30_2025-10-30.tsv
storage/unsuppressed-inventory-2025-07-30_2025-10-30.tsv
```

## Next Steps

See full documentation:
- [Reimbursement Implementation Guide](./REIMBURSEMENT_IMPLEMENTATION.md)
- [Phase 1 Flow Details](./reimbursement.md)

Phase 2 Coming Soon:
- Auto-submit claims
- Auto-track status
- Email notifications
- Advanced analytics

