<script lang="ts">
  import type { Skill } from '$lib/types';
  import { skills, selectedSkill } from '$lib/stores';
  import ErrorBoundary from './ErrorBoundary.svelte';
  import SkillMetadata from './SkillMetadata.svelte';
  import SkillLeaderboard from './SkillLeaderboard.svelte';
  import ClaimCoverageButton from './ClaimCoverageButton.svelte';

  export let skill: Skill;
  export let ForumComponent: any = null;

  function goBack() {
    $selectedSkill = null;
  }

  function selectRelated(related: Skill) {
    $selectedSkill = related;
  }
</script>

<div class="max-w-3xl mx-auto">
  <button class="flex items-center gap-2 text-sm text-muted-foreground mb-6 hover:text-foreground" on:click={goBack}>
    ← Back to gallery
  </button>

  <div class="card mb-6">
    <div class="flex flex-wrap gap-2 items-start justify-between mb-3">
      <h1 class="text-2xl font-bold">{skill.name}</h1>
      {#if skill.domain}
        <span class="badge badge-domain">{skill.domain}</span>
      {/if}
    </div>
    <p class="text-muted-foreground mb-4">{skill.prose || 'No description.'}</p>
    <div class="flex flex-wrap gap-2 mb-4">
      {#each skill.tags as tag}
        <span class="badge">{tag}</span>
      {/each}
    </div>
    <p class="text-xs text-muted-foreground font-mono">Box: {skill.boxId}</p>
  </div>

  <!-- Skill Metadata -->
  <SkillMetadata boxId={skill.boxId} sourceHash={skill.sourceHash || ""} />

  <!-- Claim Coverage -->
  <ClaimCoverageButton />

  <!-- Coverages -->
  <section class="mb-6">
    <h2 class="text-lg font-semibold mb-3">Services covering this skill
      <span class="text-sm font-normal text-muted-foreground">({skill.coverages.length})</span>
    </h2>
    {#if skill.coverages.length === 0}
      <p class="text-muted-foreground text-sm">No services registered yet.</p>
    {:else}
      {#each skill.coverages as cov}
        <div class="card mb-2 flex items-center justify-between">
          <span class="font-medium">{cov.label}</span>
          <span class="text-xs text-muted-foreground font-mono">{(cov.serviceId || cov.boxId).slice(0,12)}…</span>
        </div>
      {/each}
    {/if}
  </section>

  <!-- Leaderboard -->
  <SkillLeaderboard benchmarks={skill.benchmarks} />

  <!-- Benchmarks count -->
  <section class="mb-6">
    <h2 class="text-lg font-semibold mb-3">Benchmarks
      <span class="text-sm font-normal text-muted-foreground">({skill.benchmarks.length})</span>
    </h2>
    {#if skill.benchmarks.length === 0}
      <p class="text-muted-foreground text-sm">No benchmarks submitted yet.</p>
    {:else}
      <p class="text-sm text-muted-foreground">{skill.benchmarks.length} comparative benchmark(s) on-chain.</p>
    {/if}
  </section>

  <!-- Related skills -->
  {#if skill.otherSkillBoxIds.length > 0}
    <section class="mb-6">
      <h2 class="text-lg font-semibold mb-3">Related skills</h2>
      {#each skill.otherSkillBoxIds as refId}
        {@const related = $skills.find(s => s.boxId === refId)}
        {#if related}
          <button class="card mb-2 w-full text-left hover:bg-accent transition-colors" on:click={() => selectRelated(related)}>
            <span class="font-medium">{related.name}</span>
          </button>
        {:else}
          <div class="card mb-2">
            <span class="text-xs text-muted-foreground font-mono">{refId}</span>
          </div>
        {/if}
      {/each}
    </section>
  {/if}

  <!-- Forum -->
  <section>
    <h2 class="text-lg font-semibold mb-3">Discussion</h2>
    <ErrorBoundary message="Forum failed to load. It may not be available in this environment.">
      {#if ForumComponent}
        <svelte:component this={ForumComponent} topicIdentifier={skill.boxId} reputationTokenId="" />
      {:else}
        <p class="text-sm text-muted-foreground">Loading forum…</p>
      {/if}
    </ErrorBoundary>
  </section>
</div>

<style lang="postcss">
  .card {
    @apply p-4 rounded-lg border border-border bg-card;
  }

  .badge {
    @apply inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground;
  }
  .badge-domain {
    @apply bg-primary/10 text-primary;
  }
</style>
