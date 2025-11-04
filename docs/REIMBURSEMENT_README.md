# Amazon FBA Reimbursement System

## Overview

The Amazon FBA Reimbursement System automatically identifies and tracks claimable reimbursement opportunities from Amazon for lost, damaged, or mishandled inventory. This system analyzes data from multiple Amazon SP-API reports to find items that qualify for reimbursement, helping sellers recover revenue from inventory losses.

---

## Table of Contents

- [Quick Start](#quick-start)
- [How It Works](#how-it-works)
- [Claimable Item Categories](#claimable-item-categories)
- [Amazon Reports Used](#amazon-reports-used)
- [Sync Workflow](#sync-workflow)
- [5-Step Reimbursement Analysis](#5-step-reimbursement-analysis)
- [Dashboard Features](#dashboard-features)
- [Technical Architecture](#technical-architecture)
- [FAQ](#faq)

---

## Quick Start

### Prerequisites

Ensure you have the following Amazon SP-API credentials configured in your `.env` file:

```env
AMAZON_CLIENT_ID=your_client_id
AMAZON_CLIENT_SECRET=your_client_secret
AMAZON_REFRESH_TOKEN=your_refresh_token
AMAZON_MARKETPLACE_ID=your_marketplace_id
```

### Using the System

1. **Navigate to Reimbursement Tab** in the application dashboard
2. **Click "Sync All Reports"** button to fetch latest data from Amazon
3. **Review Statistics Cards** to see breakdown by category
4. **View Claimable Items** in the items table
5. **Submit Claims** through Amazon Seller Central (manual process in Phase 1)

---

## How It Works

The reimbursement system follows this automated workflow:

```
Amazon SP-API Reports → Sync & Parse → Store in Database → Analyze → Identify Claimable Items → Display in Dashboard
```

### Process Flow

1. **Sync Reports**: Fetches 4 key reports from Amazon SP-API for the last 90 days
2. **Parse & Store**: Converts TSV/CSV data into structured database records
3. **Analyze**: Applies 5-step analysis to identify claimable items
4. **Deduplicate**: Prevents duplicate claims by cross-referencing existing records
5. **Calculate Value**: Estimates claim amounts using current inventory pricing
6. **Display**: Shows results in user-friendly dashboard with filters and statistics

---

## Claimable Item Categories

The system identifies reimbursement opportunities in the following categories:

### LOST_WAREHOUSE
- **Description**: Inventory that went missing in Amazon's fulfillment centers
- **Amazon Reason Codes**: M (Missing), 5 (Other Loss)
- **Example**: 10 units of ASIN B07XYZ shipped to Amazon, only 7 units received in system

### DAMAGED_WAREHOUSE
- **Description**: Inventory damaged by Amazon during storage or fulfillment
- **Amazon Reason Codes**: D (Damaged by Amazon), W (Warehouse Damaged)
- **Example**: Items damaged during warehouse handling or preparation

### CUSTOMER_RETURN_NOT_RECEIVED
- **Description**: Customer returned item but Amazon never received it back into inventory
- **Detection Logic**: Customer return marked as "returned to inventory" but no corresponding ledger event
- **Example**: Customer returned item, Amazon confirmed receipt, but item never re-appeared in inventory

### CUSTOMER_RETURN_DAMAGED
- **Description**: Customer returned item damaged (customer's fault), seller should be reimbursed
- **Amazon Disposition**: CUSTOMER_DAMAGED
- **Example**: Customer damaged the product and returned it, Amazon accepted the return

### Additional Tracking Categories

- **RECOVERED**: Items Amazon has already reimbursed
- **PENDING**: Claims submitted and awaiting Amazon review
- **DENIED**: Claims rejected by Amazon
- **VERIFIED**: Claims verified and approved

---

## Amazon Reports Used

The system relies on 4 critical Amazon SP-API reports:

### 1. GET_FBA_REIMBURSEMENTS_DATA
- **Purpose**: Track items Amazon has already reimbursed
- **Usage**: Prevent duplicate claims
- **Key Fields**:
  - reimbursementId
  - fnsku, asin
  - approvalDate
  - amountTotal
  - quantityReimbursedTotal
- **Storage**: `reimbursed_items` table

### 2. GET_LEDGER_DETAIL_VIEW_DATA (Most Important)
- **Purpose**: Track all inventory movements and adjustments in Amazon warehouses
- **Usage**: Primary source for identifying lost/damaged inventory
- **Key Fields**:
  - eventType (e.g., "Adjustments", "Receipts", "CustomerReturns")
  - reason (codes: M, D, W, 5, N)
  - unreconciledQuantity
  - fnsku, asin
  - eventDate
  - fulfillmentCenter
- **Configuration**: `aggregatedByTimePeriod: 'DAILY'`
- **Storage**: `inventory_ledger_events` table

### 3. GET_FBA_FULFILLMENT_CUSTOMER_RETURNS_DATA
- **Purpose**: Track customer return information
- **Usage**: Identify lost or damaged returns
- **Key Fields**:
  - returnDate
  - orderId
  - fnsku, asin
  - detailedDisposition (CUSTOMER_DAMAGED, SELLABLE, etc.)
  - status (e.g., "Unit returned to inventory")
- **Storage**: `customer_returns` table

### 4. GET_FBA_MYI_UNSUPPRESSED_INVENTORY_DATA
- **Purpose**: Current inventory snapshot with pricing information
- **Usage**: Calculate estimated claim values
- **Key Fields**:
  - fnsku, asin
  - yourPrice (critical for value estimation)
  - afnFulfillableQuantity
  - afnWarehouseQuantity
- **Storage**: `unsuppressed_inventory` table

---

## Sync Workflow

### What Happens When You Click "Sync All Reports"

**API Endpoint**: `POST /api/reimbursement/sync`

**Date Range**: Automatically set to last 90 days (ending 3 days ago to account for Amazon's data delay)

#### Step-by-Step Process

1. **Initialize Amazon API** (2-3 seconds)
   - Validate credentials
   - Establish connection to Amazon SP-API

2. **Sync Reimbursement Report** (5-10 seconds)
   - Request: `GET_FBA_REIMBURSEMENTS_DATA`
   - Wait for Amazon to generate report
   - Download TSV file
   - Parse and store in `reimbursed_items` table

3. **Sync Customer Returns Report** (5-10 seconds)
   - Request: `GET_FBA_FULFILLMENT_CUSTOMER_RETURNS_DATA`
   - Download and parse
   - Store in `customer_returns` table
   - Deduplicate by orderId + fnsku + returnDate

4. **Sync Inventory Ledger Report** (10-20 seconds)
   - Request: `GET_LEDGER_DETAIL_VIEW_DATA`
   - Download all inventory movement events
   - Store in `inventory_ledger_events` table
   - This is the **most important** report

5. **Sync Unsuppressed Inventory Report** (5-10 seconds)
   - Request: `GET_FBA_MYI_UNSUPPRESSED_INVENTORY_DATA`
   - Clear old data, insert fresh snapshot
   - Store in `unsuppressed_inventory` table

6. **Analyze and Identify Claimable Items** (5-10 seconds)
   - Run 5-step analysis (see next section)
   - Create records in `claimable_items` table
   - Calculate estimated values

7. **Log Sync Operation**
   - Record metadata in `reimbursement_sync_logs`
   - Track duration, counts, and any errors

**Total Duration**: Approximately 30-60 seconds

#### Sync Response

```json
{
  "success": true,
  "reportIds": {
    "reimbursement": "amzn1.spdoc.1...",
    "customerReturns": "amzn1.spdoc.1...",
    "inventoryLedger": "amzn1.spdoc.1...",
    "unsuppressedInventory": "amzn1.spdoc.1..."
  },
  "processedCounts": {
    "reimbursed": 150,
    "returns": 75,
    "ledgerEvents": 450,
    "inventory": 280,
    "claimable": 23
  },
  "errors": [],
  "duration": 45000
}
```

---

## 5-Step Reimbursement Analysis

After syncing reports, the system runs 5 analysis steps to identify claimable items:

### Step 1: Find Lost Inventory in Warehouse

**Logic**:
```
EventType = "Adjustments"
AND Reason IN ("M", "5")
AND UnreconciledQuantity > 0
```

**Reason Codes**:
- **M**: Missing inventory (cannot be found by Amazon)
- **5**: Other unexplained loss

**Process**:
1. Query `inventory_ledger_events` for adjustment events with loss reasons
2. Cross-check against `reimbursed_items` to exclude already reimbursed
3. Cross-check against `claimable_items` to prevent duplicates
4. Estimate value using `unsuppressed_inventory.yourPrice × quantity`
5. Create claimable item with category `LOST_WAREHOUSE`

**Example**: 5 units of SKU ABC-123 marked as "Missing" (reason M) on 2025-10-15

**Implementation**: [reimbursement.ts:847-962](src/lib/db/services/reimbursement.ts#L847-L962)

---

### Step 2: Find Warehouse-Damaged Inventory

**Logic**:
```
EventType = "Adjustments"
AND Reason IN ("D", "W")
```

**Reason Codes**:
- **D**: Damaged by Amazon (during fulfillment process)
- **W**: Warehouse damaged (during storage or handling)

**Process**:
1. Query adjustment events with damage reasons
2. Exclude already reimbursed items
3. Exclude already claimable items
4. Estimate value and create claim with category `DAMAGED_WAREHOUSE`

**Example**: 3 units of SKU XYZ-789 damaged during warehouse handling (reason W)

**Implementation**: [reimbursement.ts:964-1070](src/lib/db/services/reimbursement.ts#L964-L1070)

---

### Step 3: Find Customer Refunded But Item Not Returned

**Status**: Placeholder - Not Fully Implemented in Phase 1

**Logic**: Customer received refund but never actually returned the item to Amazon

**Future Enhancement**: Requires additional refund data analysis

**Implementation**: [reimbursement.ts:1072-1090](src/lib/db/services/reimbursement.ts#L1072-L1090)

---

### Step 4: Find Lost Customer Returns

**Logic**:
```
Status = "Unit returned to inventory"
AND No corresponding "CustomerReturns" event in inventory ledger
AND Not already reimbursed
```

**Meaning**: Customer returned item to Amazon, Amazon marked it as "returned to inventory", but the item never actually re-entered the inventory tracking system.

**Process**:
1. Get all customer returns with status "Unit returned to inventory" from `customer_returns`
2. Search for matching `CustomerReturns` event in `inventory_ledger_events`
3. If no ledger event found, item is potentially lost
4. Verify not already reimbursed
5. Create claimable item with category `CUSTOMER_RETURN_NOT_RECEIVED`

**Example**: Customer returned item on 2025-09-20, marked as "returned to inventory", but no ledger entry shows it was received

**Implementation**: [reimbursement.ts:1092-1206](src/lib/db/services/reimbursement.ts#L1092-L1206)

---

### Step 5: Find Customer-Damaged Returns

**Logic**:
```
detailedDisposition = "CUSTOMER_DAMAGED"
AND Not already reimbursed
```

**Meaning**: Customer damaged the item and returned it. Seller should be reimbursed for accepting damaged inventory.

**Process**:
1. Query `customer_returns` for `detailedDisposition = "CUSTOMER_DAMAGED"`
2. Verify not already reimbursed
3. Verify not already claimable
4. Estimate value and create claim with category `CUSTOMER_RETURN_DAMAGED`

**Example**: Customer returned a phone with cracked screen, disposition marked as "CUSTOMER_DAMAGED"

**Implementation**: [reimbursement.ts:1208-1302](src/lib/db/services/reimbursement.ts#L1208-L1302)

---

## Dashboard Features

### Statistics Cards

Displays summary statistics by category:
- **To Recover**: Items ready to claim
- **Recovered**: Items Amazon has reimbursed
- **Lost Warehouse**: Missing inventory
- **Damaged Warehouse**: Amazon-damaged items
- **Customer Return Issues**: Lost or damaged returns

Each card shows:
- Item count
- Total quantity
- Total estimated value
- Currency

**Implementation**: [ReimbursementTab.svelte:245-282](src/lib/components/ReimbursementTab.svelte#L245-L282)

---

### Items Table

**View**: List of all claimable and reimbursed items

**Columns**:
- Product (ASIN, title, image)
- SKU (FNSKU)
- Category (LOST_WAREHOUSE, DAMAGED_WAREHOUSE, etc.)
- Quantity
- Estimated Value
- Last Updated

**Features**:
- Filter by category (click statistics cards)
- Sort by column
- Pagination (100 items per page)
- Click to view details

**API**: `GET /api/reimbursement/items`

**Implementation**: [ReimbursementTab.svelte:328-449](src/lib/components/ReimbursementTab.svelte#L328-L449)

---

### Tickets Table

**View**: Reimbursement tickets/claims organized by submission status

**Columns**:
- Ticket ID
- Product (ASIN, title)
- Status (OPEN, PENDING, RESOLVED)
- Priority (HIGH, MEDIUM, LOW)
- Amount
- Submitted Date

**Priority Calculation**:
- **HIGH**: Estimated value ≥ $500
- **MEDIUM**: Estimated value ≥ $100
- **LOW**: Estimated value < $100

**Features**:
- Filter by status, priority, category
- Pagination (50 tickets per page)
- Color-coded status badges
- Priority indicators

**API**: `GET /api/reimbursement/tickets`

**Implementation**: [ReimbursementTab.svelte:452-589](src/lib/components/ReimbursementTab.svelte#L452-L589)

---

### Sync Controls

**Button**: "Sync All Reports"

**Features**:
- One-click sync of all 4 Amazon reports
- Progress indicator during sync
- Success message with counts
- Error handling with user-friendly messages

**Date Range**: Automatically uses last 90 days (ending 3 days ago)

**Implementation**: [ReimbursementTab.svelte:160-243](src/lib/components/ReimbursementTab.svelte#L160-L243)

---

## Technical Architecture

### Database Schema

#### Key Tables

**inventory_ledger_events**
- Stores all inventory movements from Amazon warehouses
- 11 indexes for fast querying
- Fields: eventType, reason, unreconciledQuantity, fnsku, asin, eventDate, fulfillmentCenter

**reimbursed_items**
- Items already reimbursed by Amazon
- Used for deduplication
- Unique constraint on reimbursementId

**customer_returns**
- Customer return tracking
- Unique constraint on orderId + fnsku + returnDate
- Fields: returnDate, status, detailedDisposition

**unsuppressed_inventory**
- Current inventory snapshot with pricing
- yourPrice field critical for value estimation

**claimable_items**
- Generated claims ready for submission
- Categories: LOST_WAREHOUSE, DAMAGED_WAREHOUSE, etc.
- Statuses: PENDING, CLAIMABLE, CLAIMED, REIMBURSED, DENIED, EXPIRED
- Fields: category, status, estimatedValue, eventDate, referenceId

**reimbursement_sync_logs**
- Audit trail of sync operations
- Tracks status, duration, records processed, errors

**Schema File**: [schema.ts](src/lib/db/schema.ts)

---

### API Endpoints

#### POST /api/reimbursement/sync
Trigger full reimbursement sync

**Request Body** (optional):
```json
{
  "dataStartTime": "2025-08-01T00:00:00Z",
  "dataEndTime": "2025-10-30T23:59:59Z"
}
```

**Response**: Sync result with reportIds, processedCounts, errors, duration

**File**: [sync/+server.ts](src/routes/api/reimbursement/sync/+server.ts)

---

#### GET /api/reimbursement/stats
Get reimbursement statistics by category

**Response**:
```json
{
  "success": true,
  "stats": [
    {
      "category": "RECOVERED",
      "itemCount": 50,
      "totalQuantity": 75,
      "totalValue": "1250.00",
      "currency": "USD"
    }
  ]
}
```

**File**: [stats/+server.ts](src/routes/api/reimbursement/stats/+server.ts)

---

#### GET /api/reimbursement/items
Get claimable or reimbursed items with pagination

**Query Parameters**:
- `category` (optional): Filter by category
- `limit` (default: 100): Items per page
- `offset` (default: 0): Pagination offset
- `sortBy` (default: lastUpdated)
- `sortOrder` (default: desc)

**File**: [items/+server.ts](src/routes/api/reimbursement/items/+server.ts)

---

#### GET /api/reimbursement/tickets
Get reimbursement tickets with filters

**Query Parameters**:
- `status` (optional): Filter by claim status
- `priority` (optional): Filter by priority
- `category` (optional): Filter by category
- `page` (default: 1)
- `limit` (default: 50)

**File**: [tickets/+server.ts](src/routes/api/reimbursement/tickets/+server.ts)

---

### Key Files

1. **Core Service**: [reimbursement.ts](src/lib/db/services/reimbursement.ts) (1,575 lines)
   - ReimbursementService class
   - All sync and analysis logic
   - 5-step analysis implementation

2. **Amazon API Client**: [amazon-api.ts](src/lib/amazon-api.ts)
   - Report creation and download
   - TSV/CSV parsing
   - SP-API integration

3. **UI Component**: [ReimbursementTab.svelte](src/lib/components/ReimbursementTab.svelte) (592 lines)
   - Dashboard interface
   - Sync controls
   - Statistics and tables

4. **Database Schema**: [schema.ts](src/lib/db/schema.ts)
   - Table definitions
   - Indexes and constraints

---

### Performance

**Sync Duration**: 30-60 seconds for 90-day range

**Analysis Duration**: 5-10 seconds for 1,000 events

**Query Performance**: <100ms for paginated results

**Optimizations**:
- 11 database indexes on critical tables
- Batch processing for large datasets
- Efficient deduplication queries
- Caching for repeated queries

---

## FAQ

### How often should I sync?

**Recommendation**: Sync once per week or bi-weekly

**Reasoning**:
- Amazon data has 48-72 hour delay
- Most reimbursement cases don't require immediate action
- API rate limits (Amazon throttles requests)

---

### What is the estimated accuracy?

**Phase 1 Accuracy**: 60-70% of total claimable opportunities

**Why Not 100%?**:
- Some cases require additional reports (Phase 2+)
- Complex scenarios need manual review
- Amazon's data may have inconsistencies

---

### Can I submit claims automatically?

**Phase 1**: Manual submission via Amazon Seller Central

**Future (Phase 3)**: Planned automation through Seller Central API

---

### What if a claim is denied?

1. Review the denial reason in Amazon Seller Central
2. Gather additional evidence if available
3. Resubmit with more details
4. Escalate to Amazon support if appropriate

**Tip**: High-value claims (>$500) may need escalation to Amazon case managers

---

### How is estimated value calculated?

```
Estimated Value = Current Price × Quantity
```

**Source**: `unsuppressed_inventory.yourPrice`

**Limitations**:
- Uses current price, not historical
- Doesn't account for price fluctuations
- May not match actual reimbursement amount

**Future Enhancement**: Historical price tracking

---

### What if I see duplicate claims?

The system has robust deduplication logic, but if you encounter duplicates:

1. Check if items have different event dates
2. Review the claimable items table
3. Report the issue for investigation

**Deduplication Keys**: fnsku + category + eventDate

---

### Can I customize the date range?

**Current**: Automatic 90-day range (ending 3 days ago)

**Custom Range**: Possible via API request body
```json
{
  "dataStartTime": "2025-07-01T00:00:00Z",
  "dataEndTime": "2025-09-30T23:59:59Z"
}
```

**Note**: Amazon has retention limits (typically 18 months)

---

### What happens if sync fails?

**Error Handling**:
- Each step is independent (one failure doesn't stop others)
- Errors logged to `reimbursement_sync_logs`
- User sees error message with details
- Partial results still saved

**Common Issues**:
- Amazon API timeout (retry in a few minutes)
- Invalid credentials (check .env file)
- Rate limiting (wait before retrying)

---

### How do I verify results?

**Recommended Verification**:
1. Cross-reference with Amazon Seller Central reports
2. Review ledger events for specific ASINs
3. Check reimbursement history in Seller Central
4. Spot-check high-value claims manually

**Files for Verification**:
- [REIMBURSEMENT_IMPLEMENTATION.md](docs/REIMBURSEMENT_IMPLEMENTATION.md)
- [REIMBURSEMENT_QUICK_START.md](docs/REIMBURSEMENT_QUICK_START.md)

---

## Support and Documentation

### Additional Documentation

- **Implementation Guide**: [REIMBURSEMENT_IMPLEMENTATION.md](docs/REIMBURSEMENT_IMPLEMENTATION.md) - Complete technical documentation
- **Quick Start Guide**: [REIMBURSEMENT_QUICK_START.md](docs/REIMBURSEMENT_QUICK_START.md) - Setup and usage instructions
- **Flow Diagram**: [reimbursement.md](docs/reimbursement.md) - Visual workflow overview

### Troubleshooting

**Issue**: Sync takes too long
- **Solution**: Check internet connection, verify Amazon API credentials, reduce date range

**Issue**: No claimable items found
- **Solution**: May indicate good inventory management, or Amazon has already reimbursed, or try longer date range

**Issue**: Incorrect estimated values
- **Solution**: Verify pricing in `unsuppressed_inventory`, check for recent price changes

**Issue**: API authentication errors
- **Solution**: Refresh Amazon SP-API tokens, verify credentials in `.env` file

---

## Future Roadmap

### Phase 2 - Additional Reports
- GET_FBA_FULFILLMENT_INBOUND_NONCOMPLIANCE_DATA: Stuck inbound shipments
- GET_REPLACEMENT_ORDER_DATA: Replacement order analysis
- GET_FBA_RECEIVED_INVENTORY_DATA: Receipt cross-referencing

### Phase 3 - Automation
- Auto-submit claims via Seller Central API
- Auto-track claim status updates
- Auto-escalate denied claims
- Email notifications for high-value claims

### Phase 4 - Advanced Analytics
- Pattern detection (warehouses with high loss rates)
- Predictive analytics for future losses
- ROI reporting and profitability tracking
- Historical price tracking for accurate valuations

---

## License and Credits

**Version**: Phase 1 (Initial Release)

**Last Updated**: 2025-10-30

**Documentation**: Comprehensive technical details available in [docs/](docs/) folder

---

## Contact

For questions, issues, or feature requests, please consult the additional documentation files or contact the development team.
