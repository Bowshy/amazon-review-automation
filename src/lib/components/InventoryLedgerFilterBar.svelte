<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { onMount } from 'svelte';

  export let loading = false;
  export let filters: {
    status: string[];
    eventType: string[];
    fulfillmentCenter: string[];
    dateFrom: Date | null;
    dateTo: Date | null;
    fnsku: string;
    asin: string;
    sku: string;
  } = {
    status: [],
    eventType: [],
    fulfillmentCenter: [],
    dateFrom: null,
    dateTo: null,
    fnsku: '',
    asin: '',
    sku: ''
  };

  const dispatch = createEventDispatcher();

  // Available filter options
  const statusOptions = [
    { value: 'WAITING', label: 'Waiting', color: 'yellow' },
    { value: 'CLAIMABLE', label: 'Claimable', color: 'green' },
    { value: 'RESOLVED', label: 'Resolved', color: 'blue' },
    { value: 'CLAIMED', label: 'Claimed', color: 'purple' },
    { value: 'PAID', label: 'Paid', color: 'gray' }
  ];

  const eventTypeOptions = [
    { value: 'Shipments', label: 'Shipments' },
    { value: 'WhseTransfers', label: 'Warehouse Transfers' },
    { value: 'Adjustments', label: 'Adjustments' },
    { value: 'Receipts', label: 'Receipts' }
  ];

  // Common fulfillment centers (this could be loaded from API)
  const fulfillmentCenterOptions = [
    { value: 'JFK8', label: 'JFK8' },
    { value: 'LAX9', label: 'LAX9' },
    { value: 'DFW6', label: 'DFW6' },
    { value: 'ATL6', label: 'ATL6' },
    { value: 'ORD2', label: 'ORD2' },
    { value: 'PHX3', label: 'PHX3' },
    { value: 'SDF8', label: 'SDF8' },
    { value: 'MCO1', label: 'MCO1' }
  ];

  let showAdvancedFilters = false;
  let localFilters = { ...filters };

  function handleFilterChange() {
    dispatch('filterChange', { filters: localFilters });
  }

  function handleStatusToggle(status: string) {
    if (localFilters.status.includes(status)) {
      localFilters.status = localFilters.status.filter(s => s !== status);
    } else {
      localFilters.status = [...localFilters.status, status];
    }
    handleFilterChange();
  }

  function handleEventTypeToggle(eventType: string) {
    if (localFilters.eventType.includes(eventType)) {
      localFilters.eventType = localFilters.eventType.filter(e => e !== eventType);
    } else {
      localFilters.eventType = [...localFilters.eventType, eventType];
    }
    handleFilterChange();
  }

  function handleFulfillmentCenterToggle(fc: string) {
    if (localFilters.fulfillmentCenter.includes(fc)) {
      localFilters.fulfillmentCenter = localFilters.fulfillmentCenter.filter(f => f !== fc);
    } else {
      localFilters.fulfillmentCenter = [...localFilters.fulfillmentCenter, fc];
    }
    handleFilterChange();
  }

  function handleDateChange(field: 'dateFrom' | 'dateTo', value: string) {
    localFilters[field] = value ? new Date(value) : null;
    handleFilterChange();
  }

  function handleTextChange(field: 'fnsku' | 'asin' | 'sku', value: string) {
    localFilters[field] = value;
    handleFilterChange();
  }

  function clearFilters() {
    localFilters = {
      status: [],
      eventType: [],
      fulfillmentCenter: [],
      dateFrom: null,
      dateTo: null,
      fnsku: '',
      asin: '',
      sku: ''
    };
    handleFilterChange();
  }

  function getStatusColor(status: string) {
    const option = statusOptions.find(s => s.value === status);
    return option?.color || 'gray';
  }

  function getActiveFilterCount() {
    let count = 0;
    if (localFilters.status.length > 0) count++;
    if (localFilters.eventType.length > 0) count++;
    if (localFilters.fulfillmentCenter.length > 0) count++;
    if (localFilters.dateFrom) count++;
    if (localFilters.dateTo) count++;
    if (localFilters.fnsku) count++;
    if (localFilters.asin) count++;
    if (localFilters.sku) count++;
    return count;
  }

  $: activeFilterCount = getActiveFilterCount();
</script>

<div class="bg-white rounded-lg shadow-sm border border-gray-200 p-4 mb-6">
  <!-- Filter Header -->
  <div class="flex items-center justify-between mb-4">
    <div class="flex items-center space-x-3">
      <h3 class="text-lg font-medium text-gray-900">Filters</h3>
      {#if activeFilterCount > 0}
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          {activeFilterCount} active
        </span>
      {/if}
    </div>
    <div class="flex items-center space-x-2">
      <button
        onclick={() => showAdvancedFilters = !showAdvancedFilters}
        class="text-sm text-blue-600 hover:text-blue-800 font-medium"
        disabled={loading}
      >
        {showAdvancedFilters ? 'Hide' : 'Show'} Advanced
      </button>
      {#if activeFilterCount > 0}
        <button
          onclick={clearFilters}
          class="text-sm text-gray-600 hover:text-gray-800 font-medium"
          disabled={loading}
        >
          Clear All
        </button>
      {/if}
    </div>
  </div>

  <!-- Quick Filters -->
  <div class="space-y-4">
    <!-- Status Filter -->
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-2">Status</label>
      <div class="flex flex-wrap gap-2">
        {#each statusOptions as option}
          <button
            onclick={() => handleStatusToggle(option.value)}
            disabled={loading}
            class="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium transition-colors duration-200 {
              localFilters.status.includes(option.value)
                ? 'bg-blue-100 text-blue-800 border-blue-200'
                : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
            } border disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span class="w-2 h-2 rounded-full mr-2 bg-{option.color}-500"></span>
            {option.label}
          </button>
        {/each}
      </div>
    </div>

    <!-- Event Type Filter -->
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-2">Event Type</label>
      <div class="flex flex-wrap gap-2">
        {#each eventTypeOptions as option}
          <button
            onclick={() => handleEventTypeToggle(option.value)}
            disabled={loading}
            class="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium transition-colors duration-200 {
              localFilters.eventType.includes(option.value)
                ? 'bg-green-100 text-green-800 border-green-200'
                : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
            } border disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {option.label}
          </button>
        {/each}
      </div>
    </div>

    <!-- Fulfillment Center Filter -->
    <div>
      <label class="block text-sm font-medium text-gray-700 mb-2">Fulfillment Center</label>
      <div class="flex flex-wrap gap-2">
        {#each fulfillmentCenterOptions as option}
          <button
            onclick={() => handleFulfillmentCenterToggle(option.value)}
            disabled={loading}
            class="inline-flex items-center px-3 py-1.5 rounded-full text-sm font-medium transition-colors duration-200 {
              localFilters.fulfillmentCenter.includes(option.value)
                ? 'bg-purple-100 text-purple-800 border-purple-200'
                : 'bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200'
            } border disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {option.label}
          </button>
        {/each}
      </div>
    </div>
  </div>

  <!-- Advanced Filters -->
  {#if showAdvancedFilters}
    <div class="mt-6 pt-6 border-t border-gray-200">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <!-- Date Range -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Date From</label>
          <input
            type="date"
            value={localFilters.dateFrom ? localFilters.dateFrom.toISOString().split('T')[0] : ''}
            oninput={(e) => handleDateChange('dateFrom', (e.target as HTMLInputElement)?.value || '')}
            disabled={loading}
            class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">Date To</label>
          <input
            type="date"
            value={localFilters.dateTo ? localFilters.dateTo.toISOString().split('T')[0] : ''}
            oninput={(e) => handleDateChange('dateTo', (e.target as HTMLInputElement)?.value || '')}
            disabled={loading}
            class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        <!-- Text Filters -->
        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">FNSKU</label>
          <input
            type="text"
            value={localFilters.fnsku}
            oninput={(e) => handleTextChange('fnsku', (e.target as HTMLInputElement)?.value || '')}
            placeholder="Search by FNSKU..."
            disabled={loading}
            class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">ASIN</label>
          <input
            type="text"
            value={localFilters.asin}
            oninput={(e) => handleTextChange('asin', (e.target as HTMLInputElement)?.value || '')}
            placeholder="Search by ASIN..."
            disabled={loading}
            class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-2">SKU</label>
          <input
            type="text"
            value={localFilters.sku}
            oninput={(e) => handleTextChange('sku', (e.target as HTMLInputElement)?.value || '')}
            placeholder="Search by SKU..."
            disabled={loading}
            class="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          />
        </div>
      </div>
    </div>
  {/if}
</div>
