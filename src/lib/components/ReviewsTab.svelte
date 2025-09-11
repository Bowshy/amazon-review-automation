<script lang="ts">
  import { onMount, createEventDispatcher } from 'svelte';
  import type { DashboardStats, LegacyAmazonOrder } from '$lib/types';
  import type { DataTableAction } from '$lib/components/DataTable.types';
  import DataTable from '$lib/components/DataTable.svelte';
  import FilterBar from '$lib/components/FilterBar.svelte';
  import { format } from 'date-fns';

  export let stats: DashboardStats | null = null;
  export let orders: LegacyAmazonOrder[] = [];
  export let tableLoading = false;
  export let automationLoading = false;
  export let retryLoading = false;
  export let syncLoading = false;
  export let solicitationLoading: Record<string, boolean> = {};
  export let reviewTriggerLoading: Record<string, boolean> = {};
  
  // Pagination and filtering state
  export let currentPage = 1;
  export let pageSize = 20;
  export let totalOrders = 0;
  export let totalPages = 0;
  export let currentFilters: Record<string, any> = {};
  export let sortBy = 'deliveryDate';
  export let sortOrder: 'asc' | 'desc' = 'desc';

  // Event handlers
  const dispatch = createEventDispatcher();

  function getStatusColor(status: string) {
    switch (status) {
      case 'SENT': return 'text-green-600 bg-green-100';
      case 'FAILED': return 'text-red-600 bg-red-100';
      case 'SKIPPED': return 'text-yellow-600 bg-yellow-100';
      case 'PENDING': return 'text-blue-600 bg-blue-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  }

  function formatCurrency(amount: string, currency: string) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD'
    }).format(parseFloat(amount));
  }

  function handleRefresh() {
    dispatch('refresh');
  }

  function handleRunAutomation() {
    dispatch('runAutomation');
  }

  function handleRetryFailed() {
    dispatch('retryFailed');
  }

  function handleSyncOrders() {
    dispatch('syncOrders');
  }

  function handleCheckSolicitation(orderId: string) {
    dispatch('checkSolicitation', { orderId });
  }

  function handleTriggerReview(orderId: string) {
    dispatch('triggerReview', { orderId });
  }

  function handleSort(event: CustomEvent<{ sortBy: string; sortOrder: 'asc' | 'desc' }>) {
    dispatch('sort', event.detail);
  }

  function handlePageChange(event: CustomEvent<{ page: number }>) {
    dispatch('pageChange', event.detail);
  }

  function handleFilterChange(event: CustomEvent<{ filters: Record<string, any> }>) {
    dispatch('filterChange', event.detail);
  }
</script>

<div class="space-y-8">
  <!-- Stats Grid -->
  {#if stats}
    <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      <!-- Total Orders -->
      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <svg class="h-8 w-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-500">Total Orders</p>
            <p class="text-2xl font-semibold text-gray-900">{stats.totalOrders}</p>
          </div>
        </div>
      </div>

      <!-- Eligible for Review -->
      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <svg class="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-500">Eligible for Review</p>
            <p class="text-2xl font-semibold text-gray-900">{stats.eligibleForReview}</p>
          </div>
        </div>
      </div>

      <!-- Review Requests Sent -->
      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <svg class="h-8 w-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-500">Requests Sent</p>
            <p class="text-2xl font-semibold text-gray-900">{stats.reviewRequestsSent}</p>
          </div>
        </div>
      </div>

      <!-- Failed Requests -->
      <div class="bg-white rounded-lg shadow p-6">
        <div class="flex items-center">
          <div class="flex-shrink-0">
            <svg class="h-8 w-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
          </div>
          <div class="ml-4">
            <p class="text-sm font-medium text-gray-500">Failed Requests</p>
            <p class="text-2xl font-semibold text-gray-900">{stats.reviewRequestsFailed}</p>
          </div>
        </div>
      </div>
    </div>

    <!-- Additional Stats -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div class="bg-white rounded-lg shadow p-6">
        <h3 class="text-lg font-medium text-gray-900 mb-4">Review Request Status</h3>
        <div class="space-y-3">
          <div class="flex justify-between">
            <span class="text-sm text-gray-500">Pending Review Requests</span>
            <span class="text-sm font-medium text-blue-600">{stats.pendingReviewRequests}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-sm text-gray-500">Review Requests Sent</span>
            <span class="text-sm font-medium text-green-600">{stats.reviewRequestsSent}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-sm text-gray-500">Failed Review Requests</span>
            <span class="text-sm font-medium text-red-600">{stats.reviewRequestsFailed}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-sm text-gray-500">Skipped Review Requests</span>
            <span class="text-sm font-medium text-yellow-600">{stats.reviewRequestsSkipped}</span>
          </div>
        </div>
      </div>

      <div class="bg-white rounded-lg shadow p-6">
        <h3 class="text-lg font-medium text-gray-900 mb-4">Order Summary</h3>
        <div class="space-y-3">
          <div class="flex justify-between">
            <span class="text-sm text-gray-500">Total Orders</span>
            <span class="text-sm font-medium text-gray-900">{stats.totalOrders}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-sm text-gray-500">Returned Orders</span>
            <span class="text-sm font-medium text-red-600">{stats.returnedOrders}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-sm text-gray-500">Ineligible for Review</span>
            <span class="text-sm font-medium text-gray-600">{stats.ineligibleForReview}</span>
          </div>
          <div class="flex justify-between border-t pt-2">
            <span class="text-sm font-medium text-gray-700">Review-Eligible Orders</span>
            <span class="text-sm font-medium text-green-700">{stats.eligibleForReview}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Quick Actions -->
    <div class="bg-white rounded-lg shadow p-6">
      <h3 class="text-lg font-medium text-gray-900 mb-4">Quick Actions</h3>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        <button 
          on:click={handleRunAutomation}
          disabled={automationLoading}
          class="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {automationLoading ? 'Running...' : 'Run Daily Automation'}
        </button>
        <button 
          on:click={handleRetryFailed}
          disabled={retryLoading}
          class="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {retryLoading ? 'Retrying...' : 'Retry Failed Requests'}
        </button>
        <button 
          on:click={handleSyncOrders}
          disabled={syncLoading}
          class="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors text-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {syncLoading ? 'Syncing...' : 'Sync Orders'}
        </button>
      </div>
    </div>
  {/if}

  <!-- Orders Table -->
  <div class="bg-white rounded-lg shadow">
    <div class="px-6 py-4 border-b border-gray-200">
      <h2 class="text-lg font-medium text-gray-900">Orders</h2>
    </div>
    
    <!-- Filter Bar -->
    <FilterBar 
      filters={currentFilters} 
      loading={tableLoading}
      on:filterChange={handleFilterChange}
    />
    
    <!-- Data Table -->
    <DataTable
      data={orders}
      columns={[
        {
          key: 'amazonOrderId',
          label: 'Order ID',
          sortable: true,
          width: '200px'
        },
        {
          key: 'purchaseDate',
          label: 'Purchase Date',
          sortable: true,
          width: '150px',
          render: (value) => value ? format(new Date(value), 'MMM dd, yyyy') : '—'
        },
        {
          key: 'deliveryDate',
          label: 'Delivery Date',
          sortable: true,
          width: '150px',
          render: (value) => value ? format(new Date(value), 'MMM dd, yyyy') : '—'
        },
        {
          key: 'orderStatus',
          label: 'Status',
          sortable: true,
          width: '120px',
          render: (value) => {
            const colorClass = getStatusColor(value);
            return `<span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full ${colorClass}">${value}</span>`;
          }
        },
        {
          key: 'reviewRequestStatus',
          label: 'Review Request',
          sortable: true,
          width: '140px',
          render: (value, row) => {
            if (value) {
              const colorClass = getStatusColor(value);
              return `<span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full ${colorClass}">${value}</span>`;
            }
            return 'Not sent';
          }
        },
        {
          key: 'orderTotal',
          label: 'Total',
          sortable: true,
          width: '120px',
          align: 'right',
          render: (value) => formatCurrency(value.amount, value.currencyCode)
        },
        {
          key: 'solicitationActions',
          label: 'Actions',
          width: '200px',
          align: 'center',
          actions: (row) => {
            const actions = [];
            
            // Check if we need to check solicitation actions
            if (row.hasSolicitationActions === undefined) {
              actions.push({
                label: 'Check Actions',
                icon: '🔍',
                onClick: () => handleCheckSolicitation(row.amazonOrderId),
                disabled: solicitationLoading[row.amazonOrderId] || false,
                variant: 'secondary' as const
              });
            } else if (row.hasSolicitationActions && !row.reviewRequestSent) {
              // Show trigger review button if actions are available and review not sent
              actions.push({
                label: 'Trigger Review',
                icon: '⭐',
                onClick: () => handleTriggerReview(row.amazonOrderId),
                disabled: reviewTriggerLoading[row.amazonOrderId] || false,
                variant: 'success' as const
              });
            } else if (row.hasSolicitationActions === false) {
              // Show not available message
              actions.push({
                label: 'Not Available',
                icon: '❌',
                onClick: () => {},
                disabled: true,
                variant: 'secondary' as const
              });
            } else if (row.reviewRequestSent) {
              // Show already sent message
              actions.push({
                label: 'Already Sent',
                icon: '✅',
                onClick: () => {},
                disabled: true,
                variant: 'primary' as const
              });
            }
            
            return actions;
          }
        }
      ]}
      loading={tableLoading}
      pagination={{
        page: currentPage,
        limit: pageSize,
        total: totalOrders,
        totalPages: totalPages
      }}
      filters={currentFilters}
      {sortBy}
      {sortOrder}
      on:sort={handleSort}
      on:pageChange={handlePageChange}
    />
  </div>
</div>
