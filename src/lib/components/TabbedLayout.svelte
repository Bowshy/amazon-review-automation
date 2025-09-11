<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import ReviewsTab from './ReviewsTab.svelte';
  import InventoryLedgerTab from './InventoryLedgerTab.svelte';
  import type { DashboardStats, LegacyAmazonOrder, InventoryLedgerStats, InventoryLedgerEvent } from '$lib/types';

  // Props
  let { 
    activeTab = 'reviews',
    reviewsData,
    inventoryData
  }: {
    activeTab?: 'reviews' | 'inventory';
    reviewsData: {
      stats: DashboardStats | null;
      orders: LegacyAmazonOrder[];
      loading: boolean;
      tableLoading: boolean;
      error: string;
      automationLoading: boolean;
      retryLoading: boolean;
      syncLoading: boolean;
      solicitationLoading: Record<string, boolean>;
      reviewTriggerLoading: Record<string, boolean>;
      currentPage: number;
      pageSize: number;
      totalOrders: number;
      totalPages: number;
      currentFilters: Record<string, any>;
      sortBy: string;
      sortOrder: 'asc' | 'desc';
    };
    inventoryData: {
      stats: InventoryLedgerStats | null;
      claimableEvents: InventoryLedgerEvent[];
      loading: boolean;
      error: string | null;
      refreshing: boolean;
    };
  } = $props();

  const dispatch = createEventDispatcher();

  function setActiveTab(tab: 'reviews' | 'inventory') {
    activeTab = tab;
    dispatch('tabChange', { tab });
  }

  // Reviews tab event handlers
  function handleReviewsRefresh() {
    dispatch('reviewsRefresh');
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

  function handleCheckSolicitation(event: CustomEvent<{ orderId: string }>) {
    dispatch('checkSolicitation', event.detail);
  }

  function handleTriggerReview(event: CustomEvent<{ orderId: string }>) {
    dispatch('triggerReview', event.detail);
  }

  function handleReviewsSort(event: CustomEvent<{ sortBy: string; sortOrder: 'asc' | 'desc' }>) {
    dispatch('reviewsSort', event.detail);
  }

  function handleReviewsPageChange(event: CustomEvent<{ page: number }>) {
    dispatch('reviewsPageChange', event.detail);
  }

  function handleReviewsFilterChange(event: CustomEvent<{ filters: Record<string, any> }>) {
    dispatch('reviewsFilterChange', event.detail);
  }

  // Inventory tab event handlers
  function handleInventoryRefresh() {
    dispatch('inventoryRefresh');
  }

  function handleInventorySort(event: CustomEvent<{ sortBy: string; sortOrder: 'asc' | 'desc' }>) {
    dispatch('inventorySort', event.detail);
  }

  function handleInventoryPageChange(event: CustomEvent<{ page: number }>) {
    dispatch('inventoryPageChange', event.detail);
  }

  function handleInventoryFilterChange(event: CustomEvent<{ filters: Record<string, any> }>) {
    dispatch('inventoryFilterChange', event.detail);
  }
</script>

<div class="min-h-screen bg-gray-50">
  <!-- Header -->
  <header class="bg-gradient-to-r from-blue-600 to-blue-700 shadow-lg">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex justify-between items-center py-8">
        <div>
          <h1 class="text-4xl font-bold text-white">Amazon Seller Suite</h1>
          <p class="text-blue-100 text-lg mt-2">Review Automation & Inventory Management Platform</p>
        </div>
        <div class="flex space-x-3">
          <button 
            onclick={() => handleReviewsRefresh()}
            class="bg-white text-blue-600 px-6 py-3 rounded-lg hover:bg-blue-50 transition-colors font-medium shadow-md"
          >
            <svg class="w-5 h-5 inline mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
        </div>
      </div>
    </div>
  </header>

  <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 -mt-4">
    <!-- Tab Navigation -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 mb-8">
      <nav class="flex">
        <button
          onclick={() => setActiveTab('reviews')}
          class="flex-1 py-4 px-6 text-center font-medium text-sm transition-all duration-200 {
            activeTab === 'reviews'
              ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-500'
              : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
          }"
        >
          <div class="flex items-center justify-center">
            <svg class="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
            <span class="font-semibold">Review Requests</span>
          </div>
        </button>
        <button
          onclick={() => setActiveTab('inventory')}
          class="flex-1 py-4 px-6 text-center font-medium text-sm transition-all duration-200 {
            activeTab === 'inventory'
              ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-500'
              : 'text-gray-600 hover:text-gray-800 hover:bg-gray-50'
          }"
        >
          <div class="flex items-center justify-center">
            <svg class="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <span class="font-semibold">Inventory Management</span>
          </div>
        </button>
      </nav>
    </div>

    <!-- Tab Content -->
    <div class="tab-content">
      {#if activeTab === 'reviews'}
        <ReviewsTab
          stats={reviewsData.stats}
          orders={reviewsData.orders}
          tableLoading={reviewsData.tableLoading}
          automationLoading={reviewsData.automationLoading}
          retryLoading={reviewsData.retryLoading}
          syncLoading={reviewsData.syncLoading}
          solicitationLoading={reviewsData.solicitationLoading}
          reviewTriggerLoading={reviewsData.reviewTriggerLoading}
          currentPage={reviewsData.currentPage}
          pageSize={reviewsData.pageSize}
          totalOrders={reviewsData.totalOrders}
          totalPages={reviewsData.totalPages}
          currentFilters={reviewsData.currentFilters}
          sortBy={reviewsData.sortBy}
          sortOrder={reviewsData.sortOrder}
          on:refresh={handleReviewsRefresh}
          on:runAutomation={handleRunAutomation}
          on:retryFailed={handleRetryFailed}
          on:syncOrders={handleSyncOrders}
          on:checkSolicitation={handleCheckSolicitation}
          on:triggerReview={handleTriggerReview}
          on:sort={handleReviewsSort}
          on:pageChange={handleReviewsPageChange}
          on:filterChange={handleReviewsFilterChange}
        />
      {:else if activeTab === 'inventory'}
        <InventoryLedgerTab
          stats={inventoryData.stats}
          claimableEvents={inventoryData.claimableEvents}
          loading={inventoryData.loading}
          error={inventoryData.error}
          refreshing={inventoryData.refreshing}
          on:refresh={handleInventoryRefresh}
          on:sort={handleInventorySort}
          on:pageChange={handleInventoryPageChange}
          on:filterChange={handleInventoryFilterChange}
        />
      {/if}
    </div>
  </main>
</div>

<style>
  .tab-content {
    animation: fadeIn 0.3s ease-in-out;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* Custom scrollbar for better aesthetics */
  :global(::-webkit-scrollbar) {
    width: 8px;
  }

  :global(::-webkit-scrollbar-track) {
    background: #f1f5f9;
  }

  :global(::-webkit-scrollbar-thumb) {
    background: #cbd5e1;
    border-radius: 4px;
  }

  :global(::-webkit-scrollbar-thumb:hover) {
    background: #94a3b8;
  }
</style>
