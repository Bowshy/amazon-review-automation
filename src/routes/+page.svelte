<script lang="ts">
  import { onMount } from 'svelte';
  import type { DashboardStats, LegacyAmazonOrder, InventoryLedgerStats, InventoryLedgerEvent } from '$lib/types';
  import TabbedLayout from '$lib/components/TabbedLayout.svelte';
  import { format } from 'date-fns';

  // Reviews data
  let stats: DashboardStats | null = null;
  let orders: LegacyAmazonOrder[] = [];
  let loading = true;
  let tableLoading = false;
  let error = '';
  let automationLoading = false;
  let retryLoading = false;
  let syncLoading = false;
  let solicitationLoading: Record<string, boolean> = {};
  let reviewTriggerLoading: Record<string, boolean> = {};
  
  // Pagination and filtering state for reviews
  let currentPage = 1;
  let pageSize = 20;
  let totalOrders = 0;
  let totalPages = 0;
  let currentFilters: Record<string, any> = {};
  let sortBy = 'deliveryDate';
  let sortOrder: 'asc' | 'desc' = 'desc';

  // Inventory ledger data
  let inventoryStats: InventoryLedgerStats | null = null;
  let claimableEvents: InventoryLedgerEvent[] = [];
  let inventoryLoading = false;
  let inventoryError: string | null = null;
  let inventoryRefreshing = false;

  // Active tab
  let activeTab: 'reviews' | 'inventory' = 'reviews';

  onMount(async () => {
    await loadDashboardData();
    await loadInventoryData();
  });

  async function loadOrders() {
    try {
      tableLoading = true;
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: pageSize.toString(),
        sortBy: sortBy,
        sortOrder: sortOrder
      });

      // Add filters to params
      Object.entries(currentFilters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          if (Array.isArray(value)) {
            value.forEach(v => params.append(key, v));
          } else {
            params.append(key, value.toString());
          }
        }
      });

      const ordersResponse = await fetch(`/api/orders?${params.toString()}`);
      const ordersResult = await ordersResponse.json();
      
      if (ordersResult.success && ordersResult.data) {
        orders = ordersResult.data;
        totalOrders = ordersResult.total;
        totalPages = ordersResult.totalPages;
      }
    } catch (err: any) {
      console.error('Error loading orders:', err);
    } finally {
      tableLoading = false;
    }
  }

  async function loadDashboardData() {
    try {
      loading = true;
      tableLoading = true;
      error = '';

      // Load dashboard stats
      const statsResponse = await fetch('/api/stats');
      const statsResult = await statsResponse.json();
      
      if (statsResult.success && statsResult.data) {
        stats = statsResult.data;
      } else {
        error = statsResult.error || 'Failed to load dashboard stats';
      }

      // Load orders with pagination
      await loadOrders();

    } catch (err: any) {
      error = err.message || 'An error occurred';
    } finally {
      loading = false;
      tableLoading = false;
    }
  }

  async function loadInventoryData() {
    try {
      inventoryLoading = true;
      inventoryError = null;

      // Load inventory ledger stats
      const statsResponse = await fetch('/api/inventory-ledger/stats?cache=no-cache');
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        if (statsData.success) {
          inventoryStats = statsData.data;
        }
      }

      // Load claimable events
      const claimableResponse = await fetch('/api/inventory-ledger/claimable?limit=100&cache=no-cache');
      if (claimableResponse.ok) {
        const claimableData = await claimableResponse.json();
        if (claimableData.success) {
          claimableEvents = claimableData.data;
        }
      }

    } catch (err) {
      inventoryError = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error('Failed to load inventory data:', err);
    } finally {
      inventoryLoading = false;
    }
  }

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

  // Event handlers for tabbed layout
  function handleTabChange(event: CustomEvent<{ tab: 'reviews' | 'inventory' }>) {
    activeTab = event.detail.tab;
  }

  function handleReviewsRefresh() {
    loadDashboardData();
  }

  function handleInventoryRefresh() {
    loadInventoryData();
  }

  function handleRunAutomation() {
    runDailyAutomation();
  }

  function handleRetryFailed() {
    retryFailedRequests();
  }

  function handleSyncOrders() {
    syncOrders();
  }

  function handleCheckSolicitation(event: CustomEvent<{ orderId: string }>) {
    checkSolicitationActions(event.detail.orderId);
  }

  function handleTriggerReview(event: CustomEvent<{ orderId: string }>) {
    triggerReviewRequest(event.detail.orderId);
  }

  function handleReviewsSort(event: CustomEvent<{ sortBy: string; sortOrder: 'asc' | 'desc' }>) {
    sortBy = event.detail.sortBy;
    sortOrder = event.detail.sortOrder;
    loadOrders();
  }

  function handleReviewsPageChange(event: CustomEvent<{ page: number }>) {
    currentPage = event.detail.page;
    loadOrders();
  }

  function handleReviewsFilterChange(event: CustomEvent<{ filters: Record<string, any> }>) {
    currentFilters = event.detail.filters;
    currentPage = 1;
    loadOrders();
  }

  function handleInventorySort(event: CustomEvent<{ sortBy: string; sortOrder: 'asc' | 'desc' }>) {
    // Handle inventory sorting if needed
    console.log('Inventory sort:', event.detail);
  }

  function handleInventoryPageChange(event: CustomEvent<{ page: number }>) {
    // Handle inventory pagination if needed
    console.log('Inventory page change:', event.detail);
  }

  function handleInventoryFilterChange(event: CustomEvent<{ filters: Record<string, any> }>) {
    // Handle inventory filtering if needed
    console.log('Inventory filter change:', event.detail);
  }

  async function runDailyAutomation() {
    try {
      automationLoading = true;
      const response = await fetch('/api/automation/run-daily', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();
      
      if (result.success) {
        alert(`Automation completed successfully!\n\nProcessed: ${result.processed}\nSent: ${result.sent}\nFailed: ${result.failed}\nSkipped: ${result.skipped}`);
        await loadDashboardData(); // Refresh data
        await loadOrders(); // Refresh orders
      } else {
        alert(`Automation failed: ${result.error}`);
      }
    } catch (err: any) {
      alert(`Error running automation: ${err.message}`);
    } finally {
      automationLoading = false;
    }
  }

  async function retryFailedRequests() {
    try {
      retryLoading = true;
      const response = await fetch('/api/automation/retry-failed', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();
      
      if (result.success) {
        alert(`Retry completed successfully!\n\nRetried: ${result.retried}\nSuccessful: ${result.successCount}`);
        await loadDashboardData(); // Refresh data
        await loadOrders(); // Refresh orders
      } else {
        alert(`Retry failed: ${result.error}`);
      }
    } catch (err: any) {
      alert(`Error retrying requests: ${err.message}`);
    } finally {
      retryLoading = false;
    }
  }

  async function checkSolicitationActions(orderId: string) {
    try {
      solicitationLoading[orderId] = true;
      
      const response = await fetch(`/api/orders/check-solicitation?orderId=${orderId}`);
      const result = await response.json();
      
      if (result.success) {
        // Update the order in the local state
        orders = orders.map(order => {
          if (order.amazonOrderId === orderId) {
            return {
              ...order,
              hasSolicitationActions: result.data.hasActions,
              solicitationActions: result.data.actions || []
            };
          }
          return order;
        });
        
        // Show success message
        if (result.data.hasActions) {
          console.log(`Order ${orderId} is eligible for review requests`);
        } else {
          console.log(`Order ${orderId} is not eligible for review requests`);
        }
      } else {
        console.error('Failed to check solicitation actions:', result.error);
        alert(`Failed to check solicitation actions: ${result.error}`);
      }
    } catch (error) {
      console.error('Error checking solicitation actions:', error);
      alert('Error checking solicitation actions. Please try again.');
    } finally {
      solicitationLoading[orderId] = false;
    }
  }

  async function triggerReviewRequest(orderId: string) {
    try {
      reviewTriggerLoading[orderId] = true;
      
      const response = await fetch('/api/orders/trigger-review', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ orderId })
      });
      
      const result = await response.json();
      
      if (result.success) {
        // Update the order in the local state
        orders = orders.map(order => {
          if (order.amazonOrderId === orderId) {
            return {
              ...order,
              reviewRequestSent: true,
              reviewRequestDate: new Date().toISOString(),
              reviewRequestStatus: 'SENT'
            };
          }
          return order;
        });
        
        // Reload dashboard data to update stats
        await loadDashboardData();
        
        // Show success message
        alert(`Review request sent successfully for order ${orderId}!`);
      } else {
        console.error('Failed to trigger review request:', result.error);
        alert(`Failed to trigger review request: ${result.error}`);
      }
    } catch (error) {
      console.error('Error triggering review request:', error);
      alert('Error triggering review request. Please try again.');
    } finally {
      reviewTriggerLoading[orderId] = false;
    }
  }

  async function syncOrders() {
    try {
      syncLoading = true;
      const response = await fetch('/api/orders/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ daysBack: 30 })
      });

      const result = await response.json();
      
      if (result.success) {
        alert(`Sync completed successfully!\n\nExisting Orders: ${result.existingOrders}\nNew Orders: ${result.newOrders}\nUpdated Orders: ${result.updatedOrders}\nErrors: ${result.errors}\n\nTotal Processed: ${result.totalProcessed}`);
        await loadDashboardData(); // Refresh data
        await loadOrders(); // Refresh orders
      } else {
        alert(`Sync failed: ${result.error}`);
      }
    } catch (err: any) {
      alert(`Error syncing orders: ${err.message}`);
    } finally {
      syncLoading = false;
    }
  }


</script>

<svelte:head>
  <title>Amazon Seller Suite - Review Automation & Inventory Management</title>
</svelte:head>

<TabbedLayout
  {activeTab}
  reviewsData={{
    stats,
    orders,
    loading,
    tableLoading,
    error,
    automationLoading,
    retryLoading,
    syncLoading,
    solicitationLoading,
    reviewTriggerLoading,
    currentPage,
    pageSize,
    totalOrders,
    totalPages,
    currentFilters,
    sortBy,
    sortOrder
  }}
  inventoryData={{
    stats: inventoryStats,
    claimableEvents,
    loading: inventoryLoading,
    error: inventoryError,
    refreshing: inventoryRefreshing
  }}
  on:tabChange={handleTabChange}
  on:reviewsRefresh={handleReviewsRefresh}
  on:inventoryRefresh={handleInventoryRefresh}
  on:runAutomation={handleRunAutomation}
  on:retryFailed={handleRetryFailed}
  on:syncOrders={handleSyncOrders}
  on:checkSolicitation={handleCheckSolicitation}
  on:triggerReview={handleTriggerReview}
  on:reviewsSort={handleReviewsSort}
  on:reviewsPageChange={handleReviewsPageChange}
  on:reviewsFilterChange={handleReviewsFilterChange}
  on:inventorySort={handleInventorySort}
  on:inventoryPageChange={handleInventoryPageChange}
  on:inventoryFilterChange={handleInventoryFilterChange}
/>
