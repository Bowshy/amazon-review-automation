<script lang="ts">
	import { onMount } from 'svelte';
	import type { DashboardStats, LegacyAmazonOrder } from '$lib/types';
	import * as Card from '$lib/components/ui/card/index.js';
	import { Button } from '$lib/components/ui/button/index.js';
	import { Badge } from '$lib/components/ui/badge/index.js';
	import { Input } from '$lib/components/ui/input/index.js';
	import { Skeleton } from '$lib/components/ui/skeleton/index.js';
	import { Separator } from '$lib/components/ui/separator/index.js';
	import * as Table from '$lib/components/ui/table/index.js';
	import {
		MessageSquare,
		Play,
		RotateCcw,
		Search,
		Filter,
		RefreshCw,
		CheckCircle,
		XCircle,
		Clock,
		AlertTriangle
	} from 'lucide-svelte';
	import { format } from 'date-fns';

	// State
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

	// Pagination and filtering
	let currentPage = 1;
	let pageSize = 20;
	let totalOrders = 0;
	let totalPages = 0;
	let searchTerm = '';
	let statusFilter = '';

	onMount(async () => {
		await loadDashboardData();
	});

	async function loadOrders() {
		try {
			tableLoading = true;
			const params = new URLSearchParams({
				page: currentPage.toString(),
				limit: pageSize.toString(),
				sortBy: 'deliveryDate',
				sortOrder: 'desc'
			});

			if (searchTerm) {
				params.append('search', searchTerm);
			}
			if (statusFilter) {
				params.append('status', statusFilter);
			}

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
			error = '';

			// Load dashboard stats
			const statsResponse = await fetch('/api/stats');
			const statsResult = await statsResponse.json();

			if (statsResult.success && statsResult.data) {
				stats = statsResult.data;
			} else {
				error = statsResult.error || 'Failed to load dashboard stats';
			}

			// Load orders
			await loadOrders();
		} catch (err: any) {
			error = err.message || 'An error occurred';
		} finally {
			loading = false;
		}
	}

	function getStatusBadge(status: string) {
		switch (status) {
			case 'SENT':
				return { variant: 'default', icon: CheckCircle, class: 'text-green-600' };
			case 'FAILED':
				return { variant: 'destructive', icon: XCircle, class: 'text-red-600' };
			case 'SKIPPED':
				return { variant: 'secondary', icon: AlertTriangle, class: 'text-yellow-600' };
			case 'PENDING':
				return { variant: 'outline', icon: Clock, class: 'text-blue-600' };
			default:
				return { variant: 'outline', icon: Clock, class: 'text-gray-600' };
		}
	}

	function formatCurrency(amount: string, currency: string) {
		return new Intl.NumberFormat('en-US', {
			style: 'currency',
			currency: currency || 'USD'
		}).format(parseFloat(amount));
	}

	async function runDailyAutomation() {
		try {
			automationLoading = true;
			const response = await fetch('/api/automation/run-daily', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' }
			});

			const result = await response.json();
			if (result.success) {
				alert(`Automation completed!\nProcessed: ${result.processed}\nSent: ${result.sent}\nFailed: ${result.failed}\nSkipped: ${result.skipped}`);
				await loadDashboardData();
			} else {
				alert(`Automation failed: ${result.error}`);
			}
		} catch (err: any) {
			alert(`Error: ${err.message}`);
		} finally {
			automationLoading = false;
		}
	}

	async function retryFailedRequests() {
		try {
			retryLoading = true;
			const response = await fetch('/api/automation/retry-failed', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' }
			});

			const result = await response.json();
			if (result.success) {
				alert(`Retry completed!\nRetried: ${result.retried}\nSuccessful: ${result.successCount}`);
				await loadDashboardData();
			} else {
				alert(`Retry failed: ${result.error}`);
			}
		} catch (err: any) {
			alert(`Error: ${err.message}`);
		} finally {
			retryLoading = false;
		}
	}

	async function syncOrders() {
		try {
			syncLoading = true;
			const response = await fetch('/api/orders/sync', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ daysBack: 30 })
			});

			const result = await response.json();
			if (result.success) {
				alert(`Sync completed!\nNew: ${result.newOrders}\nUpdated: ${result.updatedOrders}\nTotal: ${result.totalProcessed}`);
				await loadDashboardData();
			} else {
				alert(`Sync failed: ${result.error}`);
			}
		} catch (err: any) {
			alert(`Error: ${err.message}`);
		} finally {
			syncLoading = false;
		}
	}

	async function checkSolicitationActions(orderId: string) {
		try {
			solicitationLoading[orderId] = true;
			const response = await fetch(`/api/orders/check-solicitation?orderId=${orderId}`);
			const result = await response.json();

			if (result.success) {
				orders = orders.map((order) => {
					if (order.amazonOrderId === orderId) {
						return {
							...order,
							hasSolicitationActions: result.data.hasActions,
							solicitationActions: result.data.actions || []
						};
					}
					return order;
				});
			} else {
				alert(`Failed to check solicitation: ${result.error}`);
			}
		} catch (error) {
			alert('Error checking solicitation actions');
		} finally {
			solicitationLoading[orderId] = false;
		}
	}

	async function triggerReviewRequest(orderId: string) {
		try {
			reviewTriggerLoading[orderId] = true;
			const response = await fetch('/api/orders/trigger-review', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ orderId })
			});

			const result = await response.json();
			if (result.success) {
				orders = orders.map((order) => {
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
				await loadDashboardData();
				alert(`Review request sent for order ${orderId}!`);
			} else {
				alert(`Failed to trigger review: ${result.error}`);
			}
		} catch (error) {
			alert('Error triggering review request');
		} finally {
			reviewTriggerLoading[orderId] = false;
		}
	}

	function handleSearch() {
		currentPage = 1;
		loadOrders();
	}

	function handlePageChange(page: number) {
		currentPage = page;
		loadOrders();
	}
</script>

<svelte:head>
	<title>Reviews - Amazon Review Automation</title>
</svelte:head>

<div class="space-y-6">
	<!-- Header -->
	<div class="flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-bold tracking-tight">Review Management</h1>
			<p class="text-muted-foreground">
				Manage and automate Amazon review requests
			</p>
		</div>
		<Button onclick={loadDashboardData} disabled={loading} class="gap-2">
			<RefreshCw class="h-4 w-4 {loading ? 'animate-spin' : ''}" />
			Refresh
		</Button>
	</div>

	<!-- Stats Cards -->
	<div class="grid gap-4 md:grid-cols-4">
		<Card.Root>
			<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
				<Card.Title class="text-sm font-medium">Total Orders</Card.Title>
				<MessageSquare class="h-4 w-4 text-muted-foreground" />
			</Card.Header>
			<Card.Content>
				{#if loading}
					<Skeleton class="h-8 w-20" />
				{:else}
					<div class="text-2xl font-bold">{stats?.totalOrders?.toLocaleString() || 0}</div>
				{/if}
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
				<Card.Title class="text-sm font-medium">Requests Sent</Card.Title>
				<CheckCircle class="h-4 w-4 text-green-500" />
			</Card.Header>
			<Card.Content>
				{#if loading}
					<Skeleton class="h-8 w-20" />
				{:else}
					<div class="text-2xl font-bold">{stats?.reviewRequestsSent?.toLocaleString() || 0}</div>
				{/if}
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
				<Card.Title class="text-sm font-medium">Failed Requests</Card.Title>
				<XCircle class="h-4 w-4 text-red-500" />
			</Card.Header>
			<Card.Content>
				{#if loading}
					<Skeleton class="h-8 w-20" />
				{:else}
					<div class="text-2xl font-bold">{stats?.reviewRequestsFailed?.toLocaleString() || 0}</div>
				{/if}
			</Card.Content>
		</Card.Root>

		<Card.Root>
			<Card.Header class="flex flex-row items-center justify-between space-y-0 pb-2">
				<Card.Title class="text-sm font-medium">Success Rate</Card.Title>
				<MessageSquare class="h-4 w-4 text-muted-foreground" />
			</Card.Header>
			<Card.Content>
				{#if loading}
					<Skeleton class="h-8 w-20" />
				{:else}
					<div class="text-2xl font-bold">
						{stats?.reviewRequestsRate ? `${(stats.reviewRequestsRate * 100).toFixed(1)}%` : '0%'}
					</div>
				{/if}
			</Card.Content>
		</Card.Root>
	</div>

	<!-- Actions -->
	<Card.Root>
		<Card.Header>
			<Card.Title>Automation Actions</Card.Title>
			<Card.Description>Run automation tasks and sync data</Card.Description>
		</Card.Header>
		<Card.Content>
			<div class="flex flex-wrap gap-3">
				<Button onclick={runDailyAutomation} disabled={automationLoading} class="gap-2">
					<Play class="h-4 w-4" />
					{automationLoading ? 'Running...' : 'Run Daily Automation'}
				</Button>
				<Button onclick={retryFailedRequests} disabled={retryLoading} variant="outline" class="gap-2">
					<RotateCcw class="h-4 w-4" />
					{retryLoading ? 'Retrying...' : 'Retry Failed'}
				</Button>
				<Button onclick={syncOrders} disabled={syncLoading} variant="outline" class="gap-2">
					<RefreshCw class="h-4 w-4" />
					{syncLoading ? 'Syncing...' : 'Sync Orders'}
				</Button>
			</div>
		</Card.Content>
	</Card.Root>

	<!-- Orders Table -->
	<Card.Root>
		<Card.Header>
			<Card.Title>Orders</Card.Title>
			<Card.Description>Manage review requests for your orders</Card.Description>
		</Card.Header>
		<Card.Content>
			<!-- Search and Filter -->
			<div class="flex items-center gap-4 mb-4">
				<div class="relative flex-1">
					<Search class="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
					<Input
						placeholder="Search orders..."
						bind:value={searchTerm}
						on:keydown={(e) => e.key === 'Enter' && handleSearch()}
						class="pl-8"
					/>
				</div>
				<Button on:click={handleSearch} variant="outline" class="gap-2">
					<Filter class="h-4 w-4" />
					Filter
				</Button>
			</div>

		<!-- Table -->
		{#if tableLoading}
			<div class="space-y-2">
				{#each Array(5) as _}
					<Skeleton class="h-12 w-full" />
				{/each}
			</div>
		{:else if orders.length > 0}
			<Table.Root>
				<Table.Header>
					<Table.Row>
						<Table.Head>Order ID</Table.Head>
						<Table.Head>Purchase Date</Table.Head>
						<Table.Head>Total</Table.Head>
						<Table.Head>Status</Table.Head>
						<Table.Head>Review Status</Table.Head>
						<Table.Head>Actions</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{#each orders as order}
						<Table.Row>
							<Table.Cell class="font-medium">{order.amazonOrderId}</Table.Cell>
							<Table.Cell>
								{order.purchaseDate ? format(new Date(order.purchaseDate), 'MMM dd, yyyy') : 'N/A'}
							</Table.Cell>
							<Table.Cell>
								{order.orderTotal ? formatCurrency(order.orderTotal.amount, order.orderTotal.currencyCode) : 'N/A'}
							</Table.Cell>
							<Table.Cell>
								<Badge variant="outline">{order.orderStatus}</Badge>
							</Table.Cell>
							<Table.Cell>
								{#if order.reviewRequestStatus}
									{@const statusInfo = getStatusBadge(order.reviewRequestStatus)}
									<Badge variant={statusInfo.variant} class="gap-1">
										<svelte:component this={statusInfo.icon} class="h-3 w-3" />
										{order.reviewRequestStatus}
									</Badge>
								{:else}
									<Badge variant="outline">Not Sent</Badge>
								{/if}
							</Table.Cell>
							<Table.Cell>
								<div class="flex items-center gap-2">
									<Button
										size="sm"
										variant="outline"
										on:click={() => checkSolicitationActions(order.amazonOrderId)}
										disabled={solicitationLoading[order.amazonOrderId]}
									>
										{solicitationLoading[order.amazonOrderId] ? 'Checking...' : 'Check'}
									</Button>
									<Button
										size="sm"
										on:click={() => triggerReviewRequest(order.amazonOrderId)}
										disabled={reviewTriggerLoading[order.amazonOrderId] || order.reviewRequestStatus === 'SENT'}
									>
										{reviewTriggerLoading[order.amazonOrderId] ? 'Sending...' : 'Send Review'}
									</Button>
								</div>
							</Table.Cell>
						</Table.Row>
					{/each}
				</Table.Body>
			</Table.Root>

				<!-- Pagination -->
				{#if totalPages > 1}
					<div class="flex items-center justify-between mt-4">
						<div class="text-sm text-muted-foreground">
							Showing {(currentPage - 1) * pageSize + 1} to {Math.min(currentPage * pageSize, totalOrders)} of {totalOrders} orders
						</div>
						<div class="flex items-center gap-2">
							<Button
								variant="outline"
								size="sm"
								on:click={() => handlePageChange(currentPage - 1)}
								disabled={currentPage <= 1}
							>
								Previous
							</Button>
							<span class="text-sm">Page {currentPage} of {totalPages}</span>
							<Button
								variant="outline"
								size="sm"
								on:click={() => handlePageChange(currentPage + 1)}
								disabled={currentPage >= totalPages}
							>
								Next
							</Button>
						</div>
					</div>
				{/if}
			{:else}
				<div class="text-center py-8">
					<MessageSquare class="h-12 w-12 text-muted-foreground mx-auto mb-4" />
					<h3 class="text-lg font-medium">No orders found</h3>
					<p class="text-muted-foreground">Try adjusting your search or sync new orders.</p>
				</div>
			{/if}
		</Card.Content>
	</Card.Root>
</div>
