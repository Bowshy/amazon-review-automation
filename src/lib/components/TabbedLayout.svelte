<script lang="ts">
	import ReviewsTab from './ReviewsTab.svelte';
	import ReimbursementTab from './ReimbursementTab.svelte';
	import type {
		DashboardStats,
		LegacyAmazonOrder
	} from '$lib/types';

	// Props
	let {
		activeTab = 'reviews',
		reviewsData,
		ontabChange,
		onreviewsRefresh,
		onrunAutomation,
		onretryFailed,
		onsyncOrders,
		oncheckSolicitation,
		ontriggerReview,
		onreviewsSort,
		onreviewsPageChange,
		onreviewsFilterChange
	}: {
		activeTab?: 'reviews' | 'reimbursement';
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
		ontabChange?: (detail: { tab: 'reviews' | 'reimbursement' }) => void;
		onreviewsRefresh?: () => void;
		onrunAutomation?: () => void;
		onretryFailed?: () => void;
		onsyncOrders?: () => void;
		oncheckSolicitation?: (orderId: string) => void;
		ontriggerReview?: (orderId: string) => void;
		onreviewsSort?: (detail: { sortBy: string; sortOrder: 'asc' | 'desc' }) => void;
		onreviewsPageChange?: (detail: { page: number }) => void;
		onreviewsFilterChange?: (detail: { filters: Record<string, any> }) => void;
	} = $props();

	function setActiveTab(tab: 'reviews' | 'reimbursement') {
		activeTab = tab;
		ontabChange?.({ tab });
	}

	// Reviews tab callback handlers
	function handleReviewsRefresh() {
		onreviewsRefresh?.();
	}

	function handleRunAutomation() {
		onrunAutomation?.();
	}

	function handleRetryFailed() {
		onretryFailed?.();
	}

	function handleSyncOrders() {
		onsyncOrders?.();
	}

	function handleCheckSolicitation(orderId: string) {
		oncheckSolicitation?.(orderId);
	}

	function handleTriggerReview(orderId: string) {
		ontriggerReview?.(orderId);
	}

	function handleReviewsSort(detail: { sortBy: string; sortOrder: 'asc' | 'desc' }) {
		onreviewsSort?.(detail);
	}

	function handleReviewsPageChange(detail: { page: number }) {
		onreviewsPageChange?.(detail);
	}

	function handleReviewsFilterChange(detail: { filters: Record<string, any> }) {
		onreviewsFilterChange?.(detail);
	}

</script>

<div class="min-h-screen bg-gray-50">
	<!-- Header -->
	<header class="bg-gradient-to-r from-blue-600 to-blue-700 shadow-lg">
		<div class="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
			<div class="flex items-center justify-between py-8">
				<div>
					<h1 class="text-4xl font-bold text-white">Amazon Seller Suite</h1>
					<p class="mt-2 text-lg text-blue-100">
						Review Automation & Inventory Management Platform
					</p>
				</div>
				<div class="flex space-x-3">
					<button
						onclick={() => handleReviewsRefresh()}
						class="rounded-lg bg-white px-6 py-3 font-medium text-blue-600 shadow-md transition-colors hover:bg-blue-50"
					>
						<svg class="mr-2 inline h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
							/>
						</svg>
						Refresh
					</button>
				</div>
			</div>
		</div>
	</header>

	<main class="mx-auto -mt-4 max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
		<!-- Tab Navigation -->
		<div class="mb-8 rounded-lg border border-gray-200 bg-white shadow-sm">
			<nav class="flex">
				<button
					onclick={() => setActiveTab('reviews')}
					class="flex-1 px-6 py-4 text-center text-sm font-medium transition-all duration-200 {activeTab ===
					'reviews'
						? 'border-b-2 border-blue-500 bg-blue-50 text-blue-700'
						: 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'}"
				>
					<div class="flex items-center justify-center">
						<svg class="mr-3 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
							/>
						</svg>
						<span class="font-semibold">Review Requests</span>
					</div>
				</button>
				<button
					onclick={() => setActiveTab('reimbursement')}
					class="flex-1 px-6 py-4 text-center text-sm font-medium transition-all duration-200 {activeTab ===
					'reimbursement'
						? 'border-b-2 border-blue-500 bg-blue-50 text-blue-700'
						: 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'}"
				>
					<div class="flex items-center justify-center">
						<svg class="mr-3 h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path
								stroke-linecap="round"
								stroke-linejoin="round"
								stroke-width="2"
								d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1"
							/>
						</svg>
						<span class="font-semibold">Reimbursement</span>
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
					onrefresh={handleReviewsRefresh}
					onrunAutomation={handleRunAutomation}
					onretryFailed={handleRetryFailed}
					onsyncOrders={handleSyncOrders}
					oncheckSolicitation={handleCheckSolicitation}
					ontriggerReview={handleTriggerReview}
					onsort={handleReviewsSort}
					onpageChange={handleReviewsPageChange}
					onfilterChange={handleReviewsFilterChange}
				/>
			{:else if activeTab === 'reimbursement'}
				<ReimbursementTab />
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
