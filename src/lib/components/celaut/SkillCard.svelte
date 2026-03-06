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
    <span class:stat-muted={skill.coverages.length === 0}>
      <svg class="inline -mt-0.5 mr-0.5" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/></svg>
      {skill.coverages.length} services
    </span>
    <span class:stat-muted={skill.benchmarkCount === 0}>
      <svg class="inline -mt-0.5 mr-0.5" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
      {skill.benchmarkCount} benchmarks
    </span>
    <span class:stat-muted={skill.otherSkillBoxIds.length === 0}>
      <svg class="inline -mt-0.5 mr-0.5" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
      {skill.otherSkillBoxIds.length} related
    </span>
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

  .stat-muted {
    opacity: 0.4;
  }

  :global(.line-clamp-2) {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
