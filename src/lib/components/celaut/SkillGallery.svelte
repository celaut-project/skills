<script lang="ts">
  import { filteredSkills, selectedSkill, loading, searchQuery, skills } from '$lib/stores';
  import { loadSkills as fetchSkills } from '$lib/api';
  import SkillCard from './SkillCard.svelte';
  import StatsBar from './StatsBar.svelte';
  import CategoryFilter from './CategoryFilter.svelte';
  import SortDropdown from './SortDropdown.svelte';
  import HowItWorks from './HowItWorks.svelte';
  import type { Skill } from '$lib/types';

  export let onSelectSkill: (skill: Skill) => void;

  let activeCategory = 'all';
  let currentSort = 'name';

  async function refresh() {
    $loading = true;
    const result = await fetchSkills();
    $skills = result;
    $loading = false;
  }

  // Apply category filter on top of search-filtered skills
  function filterByCategory(skills: Skill[], category: string): Skill[] {
    if (category === 'all') return skills;
    return skills.filter(s => s.domain.toLowerCase() === category.toLowerCase());
  }

  // Apply sorting
  function sortSkills(skills: Skill[], sort: string): Skill[] {
    const sorted = [...skills];
    switch (sort) {
      case 'name':
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      case 'services':
        return sorted.sort((a, b) => b.coverages.length - a.coverages.length);
      case 'benchmarks':
        return sorted.sort((a, b) => b.benchmarks.length - a.benchmarks.length);
      case 'newest':
        // demo data doesn't have timestamps, reverse order as proxy
        return sorted.reverse();
      default:
        return sorted;
    }
  }

  // Compute stats from all skills
  $: totalServices = $skills.reduce((sum, s) => sum + s.coverages.length, 0);
  $: totalResults = $skills.reduce((sum, s) => sum + s.resultCount, 0);

  // Pipeline: search filter → category filter → sort
  $: displayedSkills = sortSkills(filterByCategory($filteredSkills, activeCategory), currentSort);

  function handleFilter(e: CustomEvent<string>) {
    activeCategory = e.detail;
  }

  function handleSort(e: CustomEvent<string>) {
    currentSort = e.detail;
  }
</script>

{#if $loading}
  <div class="flex justify-center items-center py-24">
    <div class="spinner"></div>
    <span class="ml-3 text-muted-foreground">Loading skills from chain…</span>
  </div>
{:else}
  <!-- How It Works -->
  <HowItWorks />

  <!-- Stats Bar -->
  <StatsBar totalSkills={$skills.length} {totalServices} {totalResults} />

  <!-- Category Filter -->
  <CategoryFilter {activeCategory} on:filter={handleFilter} />

  <div class="mb-4 flex items-center justify-between gap-4 flex-wrap">
    <p class="text-sm text-muted-foreground">
      {displayedSkills.length} skill{displayedSkills.length !== 1 ? 's' : ''}
      {$searchQuery ? `matching "${$searchQuery}"` : ''}
      {activeCategory !== 'all' ? `in ${activeCategory}` : ''}
    </p>
    <div class="flex items-center gap-3">
      <SortDropdown {currentSort} on:sort={handleSort} />
      <button class="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1" on:click={refresh}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M2.5 22v-6h6"/><path d="M22 12A10 10 0 0 0 3.25 7.25M2 12a10 10 0 0 0 18.75 4.75"/></svg>
        Refresh
      </button>
    </div>
  </div>

  {#if displayedSkills.length === 0}
    <div class="text-center py-24 text-muted-foreground">
      <p class="text-lg">No skills found.</p>
      {#if $searchQuery || activeCategory !== 'all'}
        <p class="text-sm mt-2">Try a different search term or category.</p>
      {:else}
        <p class="text-sm mt-2">Be the first to submit a skill!</p>
      {/if}
    </div>
  {:else}
    <div class="skills-grid">
      {#each displayedSkills as skill (skill.boxId)}
        <SkillCard {skill} onClick={() => onSelectSkill(skill)} />
      {/each}
    </div>
  {/if}
{/if}

<style lang="postcss">
  .skills-grid {
    @apply flex flex-wrap justify-center gap-4;
  }

  .skills-grid > :global(*) {
    flex: 1 1 280px;
    max-width: 380px;
    min-width: 260px;
  }

  .spinner {
    @apply w-5 h-5 rounded-full border-2 border-muted border-t-primary;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
