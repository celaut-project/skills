<script lang="ts">
  import type { Skill } from '$lib/types';

  export let skill: Skill;
  export let onClick: () => void;
</script>

<button class="skill-card" on:click={onClick}>
  <div class="flex items-start justify-between gap-2 mb-2">
    <h3 class="font-semibold text-left leading-tight">{skill.name}</h3>
    {#if skill.domain}
      <span class="badge badge-domain flex-shrink-0">{skill.domain}</span>
    {/if}
  </div>
  <p class="text-sm text-muted-foreground text-left mb-3 line-clamp-2">
    {skill.prose || 'No description.'}
  </p>
  <div class="flex flex-wrap gap-1 mb-3">
    {#each skill.tags.slice(0, 4) as tag}
      <span class="badge text-xs">{tag}</span>
    {/each}
  </div>
  <div class="flex gap-4 text-xs text-muted-foreground border-t border-border pt-2 mt-auto">
    <span>📡 {skill.coverages.length} services</span>
    <span>📊 {skill.benchmarkCount} benchmarks</span>
    {#if skill.otherSkillBoxIds.length > 0}
      <span>🔗 {skill.otherSkillBoxIds.length} related</span>
    {/if}
  </div>
</button>

<style lang="postcss">
  .skill-card {
    @apply flex flex-col p-4 rounded-lg border border-border bg-card cursor-pointer text-left transition-all;
  }
  .skill-card:hover {
    @apply border-primary/50 shadow-sm bg-accent/30;
  }

  .badge {
    @apply inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground;
  }
  .badge-domain {
    @apply bg-primary/10 text-primary;
  }

  :global(.line-clamp-2) {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
