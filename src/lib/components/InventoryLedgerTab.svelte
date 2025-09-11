<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import DataTable from '$lib/components/DataTable.svelte';
  import InventoryLedgerFilterBar from '$lib/components/InventoryLedgerFilterBar.svelte';
  import type { InventoryLedgerEvent, InventoryLedgerStats } from '$lib/types';

  let { 
    stats = null, 
    claimableEvents = [], 
    loading = false, 
    error = null, 
    refreshing = false 
  }: {
    stats?: InventoryLedgerStats | null;
    claimableEvents?: InventoryLedgerEvent[];
    loading?: boolean;
    error?: string | null;
    refreshing?: boolean;
  } = $props();

  // Local state for sync operations
  let inventoryRefreshing = $state(false);
  let inventoryError = $state<string | null>(null);

  // Table columns for claimable events
  const columns = [
    { 
      key: 'eventDate', 
      label: 'Date', 
      sortable: true, 
      width: '120px',
      render: (value: Date) => formatDate(value)
    },
    { key: 'sku', label: 'SKU', sortable: true, width: '150px' },
    { key: 'asin', label: 'ASIN', sortable: true, width: '120px' },
    { 
      key: 'productTitle', 
      label: 'Product Title', 
      sortable: false, 
      width: '300px',
      render: (value: string) => value.length > 50 ? value.substring(0, 50) + '...' : value
    },
    { key: 'eventType', label: 'Event Type', sortable: true, width: '120px' },
    { 
      key: 'fulfillmentCenter', 
      label: 'FC', 
      sortable: true, 
      width: '80px',
      render: (value: string | null) => value || 'N/A'
    },
    { 
      key: 'unreconciledQuantity', 
      label: 'Qty Lost', 
      sortable: true, 
      width: '100px',
      render: (value: number) => Math.abs(value).toString()
    },
    { 
      key: 'status', 
      label: 'Status', 
      sortable: true, 
      width: '100px',
      render: (value: string) => `<span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">${value}</span>`
    },
    { 
      key: 'actions', 
      label: 'Actions', 
      sortable: false, 
      width: '120px',
      actions: (event: InventoryLedgerEvent) => [
        {
          label: 'Generate Claim',
          icon: '📋',
          variant: 'primary' as const,
          onClick: () => generateClaimText(event.id),
          disabled: refreshing
        },
        {
          label: 'Mark Claimed',
          icon: '✅',
          variant: 'success' as const,
          onClick: () => markAsClaimed(event.id),
          disabled: refreshing
        }
      ]
    }
  ];

  // Pagination state
  let currentPage = 1;
  let pageSize = 20;
  const totalPages = $derived(Math.ceil(claimableEvents.length / pageSize));

  // Sorting state
  let sortBy = 'eventDate';
  let sortOrder: 'asc' | 'desc' = 'desc';

  // Filter state
  let filters = $state({
    status: [] as string[],
    eventType: [] as string[],
    fulfillmentCenter: [] as string[],
    dateFrom: null as Date | null,
    dateTo: null as Date | null,
    fnsku: '',
    asin: '',
    sku: ''
  });

  // Sync date range state
  let syncDateRange = $state({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    endDate: new Date() // today
  });

  // Computed pagination info
  const pagination = $derived({
    page: currentPage,
    limit: pageSize,
    total: claimableEvents.length,
    totalPages: totalPages
  });

  // Computed paginated data
  const paginatedEvents = $derived(claimableEvents.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  ));

  // Event handlers
  const dispatch = createEventDispatcher();

  function handleRefresh() {
    dispatch('refresh');
  }

  async function handleSyncInventoryLedger() {
    try {
      inventoryRefreshing = true;
      inventoryError = null;

      const response = await fetch('/api/inventory-ledger/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          dataStartTime: syncDateRange.startDate.toISOString(),
          dataEndTime: syncDateRange.endDate.toISOString()
        })
      });

      const data = await response.json();

      if (data.success) {
        const result = data.data;
        alert(`Inventory ledger sync completed successfully!\n\nEvents processed: ${result.eventsProcessed || 0}\nNew events: ${result.newEvents || 0}\nUpdated events: ${result.updatedEvents || 0}\n\nDate range: ${syncDateRange.startDate.toLocaleDateString()} - ${syncDateRange.endDate.toLocaleDateString()}`);
        // Refresh the data after successful sync
        handleRefresh();
      } else {
        inventoryError = data.error || 'Failed to sync inventory ledger';
        alert(`Sync failed: ${inventoryError}`);
      }
    } catch (err) {
      inventoryError = err instanceof Error ? err.message : 'Unknown error occurred';
      alert(`Sync error: ${inventoryError}`);
    } finally {
      inventoryRefreshing = false;
    }
  }

  function handleSort(event: CustomEvent<{ sortBy: string; sortOrder: 'asc' | 'desc' }>) {
    sortBy = event.detail.sortBy;
    sortOrder = event.detail.sortOrder;
    dispatch('sort', event.detail);
  }

  function handlePageChange(event: CustomEvent<{ page: number }>) {
    currentPage = event.detail.page;
  }

  function handleLimitChange(event: CustomEvent<{ limit: number }>) {
    pageSize = event.detail.limit;
    currentPage = 1; // Reset to first page
  }

  function handleFilterChange(event: CustomEvent<{ filters: Record<string, any> }>) {
    const newFilters = event.detail.filters;
    filters.status = newFilters.status || [];
    filters.eventType = newFilters.eventType || [];
    filters.fulfillmentCenter = newFilters.fulfillmentCenter || [];
    filters.dateFrom = newFilters.dateFrom || null;
    filters.dateTo = newFilters.dateTo || null;
    filters.fnsku = newFilters.fnsku || '';
    filters.asin = newFilters.asin || '';
    filters.sku = newFilters.sku || '';
    currentPage = 1; // Reset to first page
    dispatch('filterChange', event.detail);
  }

  async function generateClaimText(eventId: string) {
    try {
      const response = await fetch(`/api/inventory-ledger/claim-text/${eventId}`);
      const data = await response.json();

      if (data.success) {
        // Copy to clipboard
        await navigator.clipboard.writeText(data.data.claimText);
        alert('Claim text copied to clipboard!');
      } else {
        alert(`Failed to generate claim text: ${data.error}`);
      }
    } catch (err) {
      alert(`Error generating claim text: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  async function markAsClaimed(eventId: string) {
    if (!confirm('Are you sure you want to mark this event as claimed?')) {
      return;
    }

    try {
      const response = await fetch(`/api/inventory-ledger/${eventId}/claim`, {
        method: 'POST'
      });
      const data = await response.json();

      if (data.success) {
        alert('Event marked as claimed successfully!');
        handleRefresh(); // Refresh data
      } else {
        alert(`Failed to mark as claimed: ${data.error}`);
      }
    } catch (err) {
      alert(`Error marking as claimed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  }

  function formatDate(date: string | Date): string {
    return new Date(date).toLocaleDateString();
  }
</script>

<div class="space-y-8">
  <!-- Stats Cards -->
  {#if stats && !loading && !error}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <!-- Total Claimable Units -->
      <div class="bg-white overflow-hidden shadow rounded-lg">
        <div class="p-5">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <svg class="h-6 w-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 19.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <div class="ml-5 w-0 flex-1">
              <dl>
                <dt class="text-sm font-medium text-gray-500 truncate">Total Claimable Units</dt>
                <dd class="text-lg font-medium text-gray-900">{stats.totalClaimableUnits}</dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <!-- Total Waiting -->
      <div class="bg-white overflow-hidden shadow rounded-lg">
        <div class="p-5">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <svg class="h-6 w-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div class="ml-5 w-0 flex-1">
              <dl>
                <dt class="text-sm font-medium text-gray-500 truncate">Total Waiting</dt>
                <dd class="text-lg font-medium text-gray-900">{stats.totalWaiting}</dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <!-- Claimable Events Count -->
      <div class="bg-white overflow-hidden shadow rounded-lg">
        <div class="p-5">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <svg class="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div class="ml-5 w-0 flex-1">
              <dl>
                <dt class="text-sm font-medium text-gray-500 truncate">Claimable Events</dt>
                <dd class="text-lg font-medium text-gray-900">{stats.claimableEventsCount}</dd>
              </dl>
            </div>
          </div>
        </div>
      </div>

      <!-- Total Resolved -->
      <div class="bg-white overflow-hidden shadow rounded-lg">
        <div class="p-5">
          <div class="flex items-center">
            <div class="flex-shrink-0">
              <svg class="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div class="ml-5 w-0 flex-1">
              <dl>
                <dt class="text-sm font-medium text-gray-500 truncate">Total Resolved</dt>
                <dd class="text-lg font-medium text-gray-900">{stats.totalResolved}</dd>
              </dl>
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}

  <!-- Sync Actions -->
  <div class="bg-white rounded-lg shadow p-6 mb-8">
    <div class="flex items-center justify-between">
      <div>
        <h3 class="text-lg font-medium text-gray-900">Amazon Inventory Ledger Sync</h3>
        <p class="text-sm text-gray-500 mt-1">
          Fetch and process the latest Amazon Inventory Ledger Report (AIRPA) to detect lost/damaged/missing inventory
        </p>
        <div class="mt-3 text-xs text-gray-400">
          <p><strong>What this does:</strong> Fetches daily inventory events from Amazon, applies business logic to identify potential losses (quantity &lt; 0 AND unreconciled_quantity &gt; 0), and updates event statuses based on age and reconciliation status.</p>
        </div>
      </div>
      <div class="flex flex-col space-y-4">
        <!-- Date Range Selector -->
        <div class="flex items-center space-x-4">
          <div class="flex items-center space-x-2">
            <label for="sync-start-date" class="text-sm font-medium text-gray-700">From:</label>
            <input
              id="sync-start-date"
              type="date"
              value={syncDateRange.startDate.toISOString().split('T')[0]}
              oninput={(e) => syncDateRange.startDate = new Date((e.target as HTMLInputElement).value)}
              disabled={inventoryRefreshing}
              class="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
          <div class="flex items-center space-x-2">
            <label for="sync-end-date" class="text-sm font-medium text-gray-700">To:</label>
            <input
              id="sync-end-date"
              type="date"
              value={syncDateRange.endDate.toISOString().split('T')[0]}
              oninput={(e) => syncDateRange.endDate = new Date((e.target as HTMLInputElement).value)}
              disabled={inventoryRefreshing}
              class="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>
          <button
            onclick={() => {
              syncDateRange.startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
              syncDateRange.endDate = new Date();
            }}
            disabled={inventoryRefreshing}
            class="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Last 30 days
          </button>
        </div>
        
        <!-- Action Buttons -->
        <div class="flex space-x-3">
          <button
          onclick={handleSyncInventoryLedger}
          disabled={inventoryRefreshing}
          class="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
        >
          {#if inventoryRefreshing}
            <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Syncing...
          {:else}
            <svg class="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Sync Inventory Ledger
          {/if}
        </button>
        <button
          onclick={handleRefresh}
          disabled={inventoryRefreshing}
          class="bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-colors font-medium shadow-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
        >
          <svg class="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh Data
        </button>
      </div>
    </div>
    
    {#if inventoryError}
      <div class="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
        <div class="flex">
          <div class="flex-shrink-0">
            <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
            </svg>
          </div>
          <div class="ml-3">
            <h3 class="text-sm font-medium text-red-800">Sync Error</h3>
            <p class="text-sm text-red-700 mt-1">{inventoryError}</p>
          </div>
        </div>
      </div>
    {/if}
  </div>

  <!-- Filter Bar -->
  <InventoryLedgerFilterBar 
    filters={filters} 
    loading={loading}
    on:filterChange={handleFilterChange}
  />

  <!-- Claimable Events Table -->
  <div class="bg-white shadow rounded-lg">
    <div class="px-4 py-5 sm:p-6">
      <div class="flex items-center justify-between mb-4">
        <div>
          <h3 class="text-lg leading-6 font-medium text-gray-900">
            Claimable Events ({claimableEvents.length})
          </h3>
          <p class="text-sm text-gray-500 mt-1">
            Events that are 7+ days old and still have unreconciled quantities. These are ready for claims.
          </p>
        </div>
        <button
          onclick={handleRefresh}
          disabled={refreshing}
          class="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {#if refreshing}
            <svg class="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Refreshing...
          {:else}
            <svg class="-ml-1 mr-2 h-4 w-4 text-gray-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          {/if}
        </button>
      </div>

      {#if claimableEvents.length === 0}
        <div class="text-center py-12">
          <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 class="mt-2 text-sm font-medium text-gray-900">No claimable events</h3>
          <p class="mt-1 text-sm text-gray-500">All events are either waiting or resolved.</p>
        </div>
      {:else}
        <DataTable
          data={paginatedEvents}
          columns={columns}
          pagination={pagination}
          loading={refreshing}
          on:sort={handleSort}
          on:pageChange={handlePageChange}
          on:limitChange={handleLimitChange}
        />
      {/if}
    </div>
  </div>
</div>
</div>
