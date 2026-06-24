<script lang="ts">
	import '../app.css';
	import { ModeWatcher } from "mode-watcher";
	import AmbientBackground from "$lib/components/celaut/AmbientBackground.svelte";
</script>

<ModeWatcher />
<AmbientBackground />
<slot></slot>
