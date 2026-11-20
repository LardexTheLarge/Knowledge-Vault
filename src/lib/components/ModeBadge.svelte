<script lang="ts">
	import type { InferenceSource } from '$lib/types';

	interface Props {
		source: InferenceSource;
	}

	let { source }: Props = $props();
</script>

<span
	class="badge badge-sm badge-outline {source === 'on-device' ? 'badge-info' : 'badge-primary'}"
>
	{source === 'on-device' ? 'Answered on-device' : 'Answered in cloud'}
</span>
