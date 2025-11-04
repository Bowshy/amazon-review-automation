<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';

	onMount(() => {
		goto('/reviews');
	});
</script>

<svelte:head>
	<title>Amazon Review Automation</title>
</svelte:head>

<div class="flex items-center justify-center h-full">
	<p class="text-muted-foreground">Redirecting to Reviews...</p>
</div>