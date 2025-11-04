We will build the Phase-1 reimbursement engine first.
This covers the highest value claims you can automate NOW using the reports in your hand.
After we validate results manually, we will expand to missing reports and full automation.

✅ Your Current Reports (Phase-1 Engine)
Report
Purpose
GET_LEDGER_DETAIL_VIEW_DATA
Lost/Damaged in warehouse logic
GET_FBA_FULFILLMENT_CUSTOMER_RETURNS_DATA
See if customer returned item or not
GET_FBA_REIMBURSEMENTS_DATA
Check if already reimbursed
GET_FBA_MYI_UNSUPPRESSED_INVENTORY_DATA
Verify stock location & disposition
GET_FBA_FULFILLMENT_INBOUND_NONCOMPLIANCE_DATA
See if inventory went inbound but stuck

💡 With only these, we can recover 60-70% of total reimbursement opportunities.

✅ The Full Phase-1 Flow (Your Current Logic Engine)
🔁 Step-1: Identify Lost Inventory in Warehouse
Source: GET_LEDGER_DETAIL_VIEW_DATA
Filter Logic:
EventType = "Adjustments"
AND Reason IN ("M", "5")
AND UnreconciledQuantity > 0

Output:
Missing FNSKUs + Quantities

🔁 Step-2: Identify Warehouse-Damaged Inventory Not Reimbursed
Source: GET_LEDGER_DETAIL_VIEW_DATA
Filter Logic:
EventType = "Adjustments"
AND Reason IN ("D", "W") # Damaged by Amazon or warehouse

Then check in GET_FBA_REIMBURSEMENTS_DATA:
IF NOT reimbursed for that FNSKU + Date
→ Claim

🔁 Step-3: Customer Refunded But Item Not Returned
Source: GET_FBA_FULFILLMENT_CUSTOMER_RETURNS_DATA
Find:
refund issued
AND no corresponding CustomerReturn event in ledger

Then check in reimbursement data:
IF no reimbursement → Claim

🔁 Step-4: Customer Returned Item BUT Amazon Lost It
Source:
Customer Returns Report

Ledger Report

Logic:
CustomerReturn event exists
BUT item never re-entered sellable inventory
AND no reimbursement yet

→ Claim

🔁 Step-5: Returned item came damaged but you refunded the customer
Source: Customer Returns Report
Disposition = Customer Damaged
Logic:
If Amazon did not reimburse you for customer-damaged return
→ Claim
