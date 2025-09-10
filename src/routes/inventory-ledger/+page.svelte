<script lang="ts">
  import { onMount } from 'svelte';
  import { DataTable } from '$lib/components/DataTable.svelte';
  import type { InventoryLedgerEvent, InventoryLedgerStats } from '$lib/types';

  let stats: InventoryLedgerStats | null = null;
  let claimableEvents: InventoryLedgerEvent[] = [];
  let loading = true;
  let error: string | null = null;

  // Table columns for claimable events
  const columns = [
    { key: 'eventDate', label: 'Date', sortable: true },
    { key: 'sku', label: 'SKU', sortable: true },
    { key: 'asin', label: 'ASIN', sortable: true },
    { key: 'productTitle', label: 'Product Title', sortable: false },
    { key: 'eventType', label: 'Event Type', sortable: true },
    { key: 'fulfillmentCenter', label: 'FC', sortable: true },
    { key: 'unreconciledQuantity', label: 'Qty Lost', sortable: true },
    { key: 'status', label: 'Status', sortable: true }
  ];

  onMount(async () => {
    await loadData();
  });

  async function loadData() {
    try {
      loading = true;
      error = null;

      // Load stats and claimable events in parallel
      const [statsResponse, claimableResponse] = await Promise.all([
        fetch('/api/inventory-ledger/stats'),
        fetch('/api/inventory-ledger/claimable?limit=100')
      ]);

      if (!statsResponse.ok) {
        throw new Error(`Failed to load stats: ${statsResponse.statusText}`);
      }

      if (!claimableResponse.ok) {
        throw new Error(`Failed to load claimable events: ${claimableResponse.statusText}`);
      }

      const statsData = await statsResponse.json();
      const claimableData = await claimableResponse.json();

      if (!statsData.success) {
        throw new Error(statsData.error || 'Failed to load stats');
      }

      if (!claimableData.success) {
        throw new Error(claimableData.error || 'Failed to load claimable events');
      }

      stats = statsData.data;
      claimableEvents = claimableData.data;

    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error occurred';
      console.error('Failed to load inventory ledger data:', err);
    } finally {
      loading = false;
    }
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
        await loadData(); // Refresh data
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

  function formatQuantity(quantity: number): string {
    return Math.abs(quantity).toString();
  }
</script>

<svelte:head>
  <title>Inventory Ledger - Amazon Review Automation</title>
</svelte:head>

<div class="min-h-screen bg-gray-50">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900">Inventory Ledger</h1>
      <p class="mt-2 text-gray-600">
        Monitor lost, damaged, and missing inventory from Amazon Inventory Ledger Report (AIRPA)
      </p>
    </div>

    <!-- Loading State -->
    {#if loading}
      <div class="flex justify-center items-center py-12">
        <div class="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span class="ml-3 text-gray-600">Loading inventory ledger data...</span>
      </div>
    {/if}

    <!-- Error State -->
    {#if error}
      <div class="bg-red-50 border border-red-200 rounded-md p-4 mb-6">
        <div class="flex">
          <div class="flex-shrink-0">
            <svg class="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
              <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd" />
            </svg>
          </div>
          <div class="ml-3">
            <h3 class="text-sm font-medium text-red-800">Error loading data</h3>
            <div class="mt-2 text-sm text-red-700">
              <p>{error}</p>
            </div>
            <div class="mt-4">
              <button
                on:click={loadData}
                class="bg-red-100 px-3 py-2 rounded-md text-sm font-medium text-red-800 hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                Try Again
              </button>
            </div>
          </div>
        </div>
      </div>
    {/if}

    <!-- Stats Cards -->
    {#if stats && !loading && !error}
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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

      <!-- Claimable Events Table -->
      <div class="bg-white shadow rounded-lg">
        <div class="px-4 py-5 sm:p-6">
          <h3 class="text-lg leading-6 font-medium text-gray-900 mb-4">
            Claimable Events ({claimableEvents.length})
          </h3>
          <p class="text-sm text-gray-500 mb-6">
            Events that are 7+ days old and still have unreconciled quantities. These are ready for claims.
          </p>

          {#if claimableEvents.length === 0}
            <div class="text-center py-8">
              <svg class="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 class="mt-2 text-sm font-medium text-gray-900">No claimable events</h3>
              <p class="mt-1 text-sm text-gray-500">All events are either waiting or resolved.</p>
            </div>
          {:else}
            <div class="overflow-x-auto">
              <table class="min-w-full divide-y divide-gray-200">
                <thead class="bg-gray-50">
                  <tr>
                    {#each columns as column}
                      <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {column.label}
                      </th>
                    {/each}
                    <th class="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody class="bg-white divide-y divide-gray-200">
                  {#each claimableEvents as event}
                    <tr class="hover:bg-gray-50">
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(event.eventDate)}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {event.sku}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {event.asin}
                      </td>
                      <td class="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                        {event.productTitle}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {event.eventType}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {event.fulfillmentCenter || 'N/A'}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatQuantity(event.unreconciledQuantity)}
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap">
                        <span class="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                          {event.status}
                        </span>
                      </td>
                      <td class="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div class="flex space-x-2">
                          <button
                            on:click={() => generateClaimText(event.id)}
                            class="text-blue-600 hover:text-blue-900"
                            title="Generate claim text"
                          >
                            📋
                          </button>
                          <button
                            on:click={() => markAsClaimed(event.id)}
                            class="text-green-600 hover:text-green-900"
                            title="Mark as claimed"
                          >
                            ✅
                          </button>
                        </div>
                      </td>
                    </tr>
                  {/each}
                </tbody>
              </table>
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>



