import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import path from "path";

export default defineConfig({
	plugins: [sveltekit()],
	test: {
		globals: true, 
		environment: 'node', 
	},
  	resolve: {
    		alias: {
      			$lib: path.resolve("./src/lib"),
    		},
		dedupe: ['svelte', 'svelte/internal', 'svelte/store', 'svelte/transition', 'svelte/easing', 'svelte/animate', 'svelte/motion'],
  	},
	assetsInclude: ['**/*.es'],
	optimizeDeps: {
		exclude: ['reputation-system', 'source-application', 'forum-application', 'wallet-svelte-component']
	},
	ssr: {
		noExternal: ['reputation-system', 'source-application', 'forum-application', 'wallet-svelte-component']
	}
});

const config = {
	// …
	ssr: {
	  noExternal: ['three']
	}
  }
