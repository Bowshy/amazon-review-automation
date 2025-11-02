<script lang="ts">
	import { onMount } from 'svelte';

	let stats: any[] = [];
	let items: any[] = [];
	let tickets: any[] = [];
	let selectedCategory = '';
	let totalItems = 0;
	let totalTickets = 0;
	let loading = false;
	let ticketsLoading = false;
	let syncing = false;
	let syncError = '';
	let syncSuccess = false;
	let syncResult: any = null;
	let activeView: 'items' | 'tickets' = 'items';

	// Category display names
	const categoryLabels: Record<string, string> = {
		TO_RECOVER: 'To Recover',
		RECOVERED: 'Recovered',
		FOUND: 'Found',
		DENIED: 'Denied',
		PENDING: 'Pending',
		WAITING_ON_US: 'Waiting on Us',
		VERIFIED: 'Verified',
		NOT_VERIFIED: 'Not Verified'
	};

	// Category colors
	const categoryColors: Record<string, string> = {
		TO_RECOVER: 'bg-red-100 text-red-800',
		RECOVERED: 'bg-green-100 text-green-800',
		FOUND: 'bg-blue-100 text-blue-800',
		DENIED: 'bg-gray-100 text-gray-800',
		PENDING: 'bg-yellow-100 text-yellow-800',
		WAITING_ON_US: 'bg-orange-100 text-orange-800',
		VERIFIED: 'bg-purple-100 text-purple-800',
		NOT_VERIFIED: 'bg-indigo-100 text-indigo-800'
	};

	onMount(() => {
		loadStats();
		loadItems();
		loadTickets();
	});

	async function loadItems(category: string = '') {
		loading = true;
		try {
			const params = new URLSearchParams();
			if (category) params.set('category', category);
			params.set('limit', '50');

			const response = await fetch(`/api/reimbursement/items?${params}`);
			const result = await response.json();

			if (result.success) {
				items = result.items;
				totalItems = result.total;
			}
		} catch (error) {
			console.error('Failed to load items:', error);
		} finally {
			loading = false;
		}
	}

	async function syncReports() {
		syncing = true;
		syncError = '';
		syncSuccess = false;
		syncResult = null;

		try {
			const response = await fetch('/api/reimbursement/sync', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({})
			});

			const result = await response.json();

			if (result.success) {
				syncSuccess = true;
				syncResult = result;
				// Reload stats, items, and tickets
				await loadStats();
				await loadItems(selectedCategory);
				await loadTickets();
			} else {
				syncError = result.error || 'Sync failed';
			}
		} catch (error) {
			syncError = error instanceof Error ? error.message : 'Unknown error';
		} finally {
			syncing = false;
		}
	}

	async function loadTickets() {
		ticketsLoading = true;
		try {
			const response = await fetch('/api/reimbursement/tickets');
			const result = await response.json();

			if (result.success) {
				tickets = result.tickets;
				totalTickets = result.total;
			}
		} catch (error) {
			console.error('Failed to load tickets:', error);
		} finally {
			ticketsLoading = false;
		}
	}

	async function loadStats() {
		try {
			const response = await fetch('/api/reimbursement/stats');
			const result = await response.json();

			if (result.success) {
				stats = result.stats;
			}
		} catch (error) {
			console.error('Failed to load stats:', error);
		}
	}

	function selectCategory(category: string) {
		selectedCategory = category;
		loadItems(category);
	}

	function clearSelection() {
		selectedCategory = '';
		loadItems();
	}

	function formatCurrency(amount: number, currency: string = 'USD'): string {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: currency
		}).format(amount);
	}

	function formatDate(date: string | Date): string {
		return new Date(date).toLocaleDateString('en-US', {
			year: 'numeric',
			month: 'short',
			day: 'numeric'
		});
	}
</script>

<div class="space-y-6">
	<!-- Sync Section -->
	<div class="rounded-lg bg-white p-6 shadow">
		<div class="flex items-center justify-between">
			<div>
				<h2 class="text-lg font-medium text-gray-900">Sync Reports</h2>
				<p class="text-sm text-gray-500">Fetch latest reimbursement data from Amazon SP-API</p>
			</div>
			<button
				onclick={syncReports}
				disabled={syncing}
				class="inline-flex items-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
			>
				{#if syncing}
					<svg
						class="mr-3 -ml-1 h-5 w-5 animate-spin text-white"
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
					>
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
						></circle>
						<path
							class="opacity-75"
							fill="currentColor"
							d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
						></path>
					</svg>
					Syncing...
				{:else}
					<svg class="mr-2 -ml-1 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
						></path>
					</svg>
					Sync Reports
				{/if}
			</button>
		</div>

		<!-- Sync Status -->
		{#if syncError}
			<div class="mt-4 rounded-md border border-red-200 bg-red-50 p-4">
				<div class="flex">
					<svg class="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
						<path
							fill-rule="evenodd"
							d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
							clip-rule="evenodd"
						></path>
					</svg>
					<div class="ml-3">
						<h3 class="text-sm font-medium text-red-800">Sync Failed</h3>
						<p class="mt-1 text-sm text-red-700">{syncError}</p>
					</div>
				</div>
			</div>
		{/if}

		{#if syncSuccess && syncResult}
			<div class="mt-4 rounded-md border border-green-200 bg-green-50 p-4">
				<div class="flex">
					<svg class="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
						<path
							fill-rule="evenodd"
							d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
							clip-rule="evenodd"
						></path>
					</svg>
					<div class="ml-3">
						<h3 class="text-sm font-medium text-green-800">Sync Completed</h3>
						<div class="mt-1 text-sm text-green-700">
							<p>Processed {syncResult.processedCounts.reimbursed} reimbursement records</p>
							<p>Processed {syncResult.processedCounts.inventory} inventory records</p>
							<p>Processed {syncResult.processedCounts.returns} return records</p>
							<p>Identified {syncResult.processedCounts.claimable} claimable items</p>
						</div>
					</div>
				</div>
			</div>
		{/if}
	</div>

	<!-- Statistics Cards -->
	<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
		{#each stats as stat}
			<button
				type="button"
				class="w-full cursor-pointer rounded-lg bg-white p-6 text-left shadow transition-shadow hover:shadow-md {selectedCategory ===
				stat.category
					? 'ring-2 ring-blue-500'
					: ''}"
				onclick={() => selectCategory(stat.category)}
			>
				<div class="flex items-center">
					<div class="flex-shrink-0">
						<span
							class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {categoryColors[
								stat.category
							] || 'bg-gray-100 text-gray-800'}"
						>
							{categoryLabels[stat.category] || stat.category}
						</span>
					</div>
				</div>
				<div class="mt-4">
					<div class="text-2xl font-bold text-gray-900">{stat.itemCount}</div>
					<div class="text-sm text-gray-500">Items</div>
				</div>
				<div class="mt-2">
					<div class="text-lg font-semibold text-gray-900">
						{formatCurrency(stat.totalValue, stat.currency)}
					</div>
					<div class="text-sm text-gray-500">Total Value</div>
				</div>
				<div class="mt-2">
					<div class="text-sm text-gray-500">Quantity: {stat.totalQuantity}</div>
				</div>
			</button>
		{/each}
	</div>

	<!-- Category Filter -->
	{#if selectedCategory}
		<div class="rounded-lg bg-white p-4 shadow">
			<div class="flex items-center justify-between">
				<div class="flex items-center">
					<span
						class="inline-flex items-center rounded-full px-3 py-1 text-sm font-medium {categoryColors[
							selectedCategory
						] || 'bg-gray-100 text-gray-800'}"
					>
						{categoryLabels[selectedCategory] || selectedCategory}
					</span>
					<span class="ml-3 text-sm text-gray-500">{totalItems} items</span>
				</div>
				<button onclick={clearSelection} class="text-sm text-gray-500 hover:text-gray-700">
					Clear Filter
				</button>
			</div>
		</div>
	{/if}

	<!-- View Toggle -->
	<div class="mb-6 rounded-lg bg-white p-4 shadow">
		<div class="flex space-x-4">
			<button
				onclick={() => (activeView = 'items')}
				class="rounded-md px-4 py-2 text-sm font-medium transition-colors {activeView === 'items'
					? 'bg-blue-100 text-blue-700'
					: 'text-gray-500 hover:text-gray-700'}"
			>
				Items ({totalItems})
			</button>
			<button
				onclick={() => (activeView = 'tickets')}
				class="rounded-md px-4 py-2 text-sm font-medium transition-colors {activeView === 'tickets'
					? 'bg-blue-100 text-blue-700'
					: 'text-gray-500 hover:text-gray-700'}"
			>
				Tickets ({totalTickets})
			</button>
		</div>
	</div>

	<!-- Items Table -->
	{#if activeView === 'items'}
		<div class="overflow-hidden rounded-lg bg-white shadow">
			<div class="border-b border-gray-200 px-6 py-4">
				<h3 class="text-lg font-medium text-gray-900">
					{#if selectedCategory}
						{categoryLabels[selectedCategory] || selectedCategory} Items
					{:else}
						All Items
					{/if}
				</h3>
				<p class="text-sm text-gray-500">
					{#if loading}
						Loading...
					{:else}
						{totalItems} items total
					{/if}
				</p>
			</div>

			{#if loading}
				<div class="p-8 text-center">
					<svg
						class="mx-auto h-8 w-8 animate-spin text-gray-400"
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
					>
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
						></circle>
						<path
							class="opacity-75"
							fill="currentColor"
							d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
						></path>
					</svg>
					<p class="mt-2 text-sm text-gray-500">Loading items...</p>
				</div>
			{:else if items.length === 0}
				<div class="p-8 text-center">
					<svg
						class="mx-auto h-12 w-12 text-gray-400"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2M4 13h2m0 0V9a2 2 0 012-2h2m0 0V5a2 2 0 012-2h2m0 0v2M10 7h4m-4 4h4m-4 4h4"
						></path>
					</svg>
					<p class="mt-2 text-sm text-gray-500">No items found</p>
				</div>
			{:else}
				<div class="overflow-x-auto">
					<table class="min-w-full divide-y divide-gray-200">
						<thead class="bg-gray-50">
							<tr>
								<th
									class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
									>Product</th
								>
								<th
									class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
									>SKU</th
								>
								<th
									class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
									>Category</th
								>
								<th
									class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
									>Quantity</th
								>
								<th
									class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
									>Value</th
								>
								<th
									class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
									>Last Updated</th
								>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-200 bg-white">
							{#each items as item}
								<tr class="hover:bg-gray-50">
									<td class="px-6 py-4 whitespace-nowrap">
										<div class="text-sm font-medium text-gray-900">
											{item.productName || 'Unknown Product'}
										</div>
										<div class="text-sm text-gray-500">ASIN: {item.asin}</div>
									</td>
									<td class="px-6 py-4 text-sm whitespace-nowrap text-gray-900">{item.sku}</td>
									<td class="px-6 py-4 whitespace-nowrap">
										<span
											class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {categoryColors[
												item.category
											] || 'bg-gray-100 text-gray-800'}"
										>
											{categoryLabels[item.category] || item.category}
										</span>
									</td>
									<td class="px-6 py-4 text-sm whitespace-nowrap text-gray-900">{item.quantity}</td>
									<td class="px-6 py-4 text-sm whitespace-nowrap text-gray-900">
										{#if item.estimatedValue}
											{formatCurrency(parseFloat(item.estimatedValue), item.currency)}
										{:else}
											-
										{/if}
									</td>
									<td class="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
										{formatDate(item.updatedAt)}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	{/if}

	<!-- Tickets Table -->
	{#if activeView === 'tickets'}
		<div class="overflow-hidden rounded-lg bg-white shadow">
			<div class="border-b border-gray-200 px-6 py-4">
				<h3 class="text-lg font-medium text-gray-900">Reimbursement Tickets</h3>
				<p class="text-sm text-gray-500">
					{#if ticketsLoading}
						Loading...
					{:else}
						{totalTickets} tickets total
					{/if}
				</p>
			</div>

			{#if ticketsLoading}
				<div class="p-8 text-center">
					<svg
						class="mx-auto h-8 w-8 animate-spin text-gray-400"
						xmlns="http://www.w3.org/2000/svg"
						fill="none"
						viewBox="0 0 24 24"
					>
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"
						></circle>
						<path
							class="opacity-75"
							fill="currentColor"
							d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
						></path>
					</svg>
					<p class="mt-2 text-sm text-gray-500">Loading tickets...</p>
				</div>
			{:else if tickets.length === 0}
				<div class="p-8 text-center">
					<svg
						class="mx-auto h-12 w-12 text-gray-400"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
						></path>
					</svg>
					<p class="mt-2 text-sm text-gray-500">No tickets found</p>
				</div>
			{:else}
				<div class="overflow-x-auto">
					<table class="min-w-full divide-y divide-gray-200">
						<thead class="bg-gray-50">
							<tr>
								<th
									class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
									>Ticket ID</th
								>
								<th
									class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
									>Product</th
								>
								<th
									class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
									>Status</th
								>
								<th
									class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
									>Priority</th
								>
								<th
									class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
									>Amount</th
								>
								<th
									class="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
									>Submitted</th
								>
							</tr>
						</thead>
						<tbody class="divide-y divide-gray-200 bg-white">
							{#each tickets as ticket}
								<tr class="hover:bg-gray-50">
									<td class="px-6 py-4 whitespace-nowrap">
										<div class="text-sm font-medium text-gray-900">{ticket.ticketId}</div>
										{#if ticket.caseId}
											<div class="text-sm text-gray-500">Case: {ticket.caseId}</div>
										{/if}
									</td>
									<td class="px-6 py-4 whitespace-nowrap">
										<div class="text-sm font-medium text-gray-900">
											{ticket.item.productTitle || 'Unknown Product'}
										</div>
										<div class="text-sm text-gray-500">{ticket.item.sku} ({ticket.item.asin})</div>
									</td>
									<td class="px-6 py-4 whitespace-nowrap">
										<span
											class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {ticket.status ===
											'OPEN'
												? 'bg-red-100 text-red-800'
												: ticket.status === 'PENDING'
													? 'bg-yellow-100 text-yellow-800'
													: ticket.status === 'RESOLVED'
														? 'bg-green-100 text-green-800'
														: 'bg-gray-100 text-gray-800'}"
										>
											{ticket.status}
										</span>
									</td>
									<td class="px-6 py-4 whitespace-nowrap">
										<span
											class="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium {ticket.priority ===
											'HIGH'
												? 'bg-red-100 text-red-800'
												: ticket.priority === 'MEDIUM'
													? 'bg-yellow-100 text-yellow-800'
													: 'bg-green-100 text-green-800'}"
										>
											{ticket.priority}
										</span>
									</td>
									<td class="px-6 py-4 text-sm whitespace-nowrap text-gray-900">
										{#if ticket.estimatedAmount}
											{formatCurrency(ticket.estimatedAmount, ticket.currency)}
										{:else}
											-
										{/if}
									</td>
									<td class="px-6 py-4 text-sm whitespace-nowrap text-gray-500">
										{formatDate(ticket.submittedDate)}
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}
		</div>
	{/if}
</div>
