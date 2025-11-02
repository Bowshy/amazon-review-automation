<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import * as Sidebar from '$lib/components/ui/sidebar/index.js';
	import { MessageSquare, DollarSign, TrendingUp } from 'lucide-svelte';

	// Navigation items
	const navigationItems = [
		{
			title: 'Reviews',
			url: '/reviews',
			icon: MessageSquare,
			badge: null
		},
		{
			title: 'Reimbursements',
			url: '/reimbursement',
			icon: DollarSign,
			badge: null
		}
	];

	$: currentPath = $page.url.pathname;

	function isActive(url: string): boolean {
		return currentPath.startsWith(url);
	}

	function handleNavigation(url: string) {
		goto(url);
	}
</script>

<Sidebar.Root>
	<Sidebar.Header class="border-b border-sidebar-border p-4">
		<div class="flex items-center gap-2">
			<div class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
				<TrendingUp class="h-4 w-4" />
			</div>
			<div class="flex flex-col">
				<span class="text-sm font-semibold">Amazon Automation</span>
				<span class="text-xs text-muted-foreground">Review & Reimbursement</span>
			</div>
		</div>
	</Sidebar.Header>

	<Sidebar.Content class="px-2 py-4">
		<Sidebar.Group>
			<Sidebar.GroupContent>
				<Sidebar.Menu>
					{#each navigationItems as item}
						<Sidebar.MenuItem>
							<Sidebar.MenuButton
								isActive={isActive(item.url)}
								onclick={() => handleNavigation(item.url)}
								class="w-full justify-start"
							>
								<svelte:component this={item.icon} class="h-4 w-4" />
								<span>{item.title}</span>
							</Sidebar.MenuButton>
						</Sidebar.MenuItem>
					{/each}
				</Sidebar.Menu>
			</Sidebar.GroupContent>
		</Sidebar.Group>
	</Sidebar.Content>

	<Sidebar.Footer class="border-t border-sidebar-border p-4">
		<div class="text-xs text-muted-foreground">
			<div>Amazon Automation</div>
			<div>v1.0.0</div>
		</div>
	</Sidebar.Footer>
</Sidebar.Root>
