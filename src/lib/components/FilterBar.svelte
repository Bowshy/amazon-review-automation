<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { ReviewRequestStatus } from '$lib/types';

	export let filters: Record<string, any> = {};
	export let loading = false;

	const dispatch = createEventDispatcher();

	let orderIdFilter = filters.orderId || '';
	let statusFilter = filters.status || [];
	let reviewStatusFilter = filters.reviewRequestStatus || [];
	let isReturned = filters.isReturned;

	const orderStatuses = [
		{ value: 'Pending', label: 'Pending' },
		{ value: 'Unshipped', label: 'Unshipped' },
		{ value: 'PartiallyShipped', label: 'Partially Shipped' },
		{ value: 'Shipped', label: 'Shipped' },
		{ value: 'Canceled', label: 'Canceled' },
		{ value: 'Unfulfillable', label: 'Unfulfillable' }
	];

	const reviewStatuses = [
		{ value: ReviewRequestStatus.SENT, label: 'Sent' },
		{ value: ReviewRequestStatus.FAILED, label: 'Failed' },
		{ value: ReviewRequestStatus.SKIPPED, label: 'Skipped' },
		{ value: ReviewRequestStatus.PENDING, label: 'Pending' }
	];

	function applyFilters() {
		if (loading) return;

		const newFilters: Record<string, any> = {
			orderId: orderIdFilter.trim() || undefined,
			status: statusFilter.length > 0 ? statusFilter : undefined,
			reviewRequestStatus: reviewStatusFilter.length > 0 ? reviewStatusFilter : undefined,
			isReturned: isReturned
		};

		// Remove undefined values
		Object.keys(newFilters).forEach((key) => {
			if (newFilters[key] === undefined) {
				delete newFilters[key];
			}
		});

		dispatch('filterChange', { filters: newFilters });
	}

	function clearFilters() {
		if (loading) return;

		orderIdFilter = '';
		statusFilter = [];
		reviewStatusFilter = [];
		isReturned = undefined;

		dispatch('filterChange', { filters: {} });
	}

	function handleStatusChange(value: string, checked: boolean) {
		if (loading) return;

		if (checked) {
			statusFilter = [...statusFilter, value];
		} else {
			statusFilter = statusFilter.filter((s: string) => s !== value);
		}
	}

	function handleReviewStatusChange(value: string, checked: boolean) {
		if (loading) return;

		if (checked) {
			reviewStatusFilter = [...reviewStatusFilter, value];
		} else {
			reviewStatusFilter = reviewStatusFilter.filter((s: string) => s !== value);
		}
	}
</script>

<div class="mb-6 rounded-lg border border-gray-200 bg-white p-6 shadow-lg">
	<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
		<!-- Order ID Filter -->
		<div>
			<label for="orderId" class="mb-2 block text-sm font-semibold text-gray-700">Order ID</label>
			<input
				id="orderId"
				type="text"
				bind:value={orderIdFilter}
				placeholder="Enter Amazon Order ID..."
				disabled={loading}
				class="w-full rounded-lg border border-gray-300 px-4 py-3 shadow-sm transition-colors duration-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-50"
			/>
		</div>

		<!-- Returned Filter -->
		<div>
			<label class="mb-2 block text-sm font-semibold text-gray-700">Returned Orders</label>
			<select
				bind:value={isReturned}
				disabled={loading}
				class="w-full rounded-lg border border-gray-300 px-4 py-3 shadow-sm transition-colors duration-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-50"
			>
				<option value={undefined}>All Orders</option>
				<option value={true}>Returned Only</option>
				<option value={false}>Not Returned</option>
			</select>
		</div>
	</div>

	<!-- Status Filters -->
	<div class="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2">
		<!-- Order Status -->
		<div class="rounded-lg bg-gray-50 p-4">
			<label class="mb-3 block text-sm font-semibold text-gray-700">Order Status</label>
			<div class="grid grid-cols-2 gap-3">
				{#each orderStatuses as status}
					<label
						class="flex cursor-pointer items-center {loading
							? 'cursor-not-allowed opacity-50'
							: ''}"
					>
						<input
							type="checkbox"
							checked={statusFilter.includes(status.value)}
							on:change={(e) =>
								handleStatusChange(status.value, (e.target as HTMLInputElement).checked)}
							disabled={loading}
							class="h-4 w-4 rounded border-gray-300 text-blue-600 transition-colors duration-200 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
						/>
						<span class="ml-3 text-sm font-medium text-gray-700">{status.label}</span>
					</label>
				{/each}
			</div>
		</div>

		<!-- Review Request Status -->
		<div class="rounded-lg bg-gray-50 p-4">
			<label class="mb-3 block text-sm font-semibold text-gray-700">Review Request Status</label>
			<div class="grid grid-cols-2 gap-3">
				{#each reviewStatuses as status}
					<label
						class="flex cursor-pointer items-center {loading
							? 'cursor-not-allowed opacity-50'
							: ''}"
					>
						<input
							type="checkbox"
							checked={reviewStatusFilter.includes(status.value)}
							on:change={(e) =>
								handleReviewStatusChange(status.value, (e.target as HTMLInputElement).checked)}
							disabled={loading}
							class="h-4 w-4 rounded border-gray-300 text-blue-600 transition-colors duration-200 focus:ring-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
						/>
						<span class="ml-3 text-sm font-medium text-gray-700">{status.label}</span>
					</label>
				{/each}
			</div>
		</div>
	</div>

	<!-- Action Buttons -->
	<div class="mt-6 flex justify-end space-x-4">
		<button
			on:click={clearFilters}
			disabled={loading}
			class="rounded-lg border border-gray-300 bg-white px-6 py-3 text-sm font-semibold text-gray-700 shadow-sm transition-colors duration-200 hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
		>
			Clear Filters
		</button>
		<button
			on:click={applyFilters}
			disabled={loading}
			class="flex items-center space-x-2 rounded-lg border border-transparent bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors duration-200 hover:bg-blue-700 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
		>
			{#if loading}
				<svg
					class="mr-2 -ml-1 h-4 w-4 animate-spin text-white"
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
				<span>Applying...</span>
			{:else}
				<span>Apply Filters</span>
			{/if}
		</button>
	</div>
</div>
