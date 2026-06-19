<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Skill } from '$lib/types';

  export let skills: Skill[] = [];
  export let name: string = '';
  export let prose: string = '';
  export let domain: string = '';
  export let tags: string = '';
  export let errors: Record<string, string> = {};
  export let prefillRelatedBoxIds: string[] = [];

  let selectedRelated: string[] = [];
  let showRelatedList = false;

  // Apply prefill when it changes (e.g. from Fork Skill)
  $: if (prefillRelatedBoxIds.length > 0) {
    selectedRelated = [...prefillRelatedBoxIds];
    showRelatedList = true;
  }

  const dispatch = createEventDispatcher();

  function toggleRelated(boxId: string) {
    if (selectedRelated.includes(boxId)) {
      selectedRelated = selectedRelated.filter(id => id !== boxId);
    } else {
      selectedRelated = [...selectedRelated, boxId];
    }
    dispatch('relatedChange', selectedRelated);
  }

  // Validation
  export function validate(): Record<string, string> {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Skill name is required.';
    else if (name.trim().length < 3) errs.name = 'Name must be at least 3 characters.';
    if (prose.trim() && prose.trim().length < 10) errs.prose = 'Description should be at least 10 characters.';
    if (domain.trim() && !/^[a-zA-Z\/]+$/.test(domain.trim())) errs.domain = 'Domain should contain only letters (e.g. finance, ai/ml).';
    return errs;
  }

  $: parsedTags = tags.split(',').map(t => t.trim()).filter(Boolean);
  $: previewValid = name.trim().length > 0;
</script>

<!-- Related Skills Multi-select -->
{#if skills.length > 0}
  <div class="related-section">
    <button type="button" class="related-toggle" on:click={() => showRelatedList = !showRelatedList}>
      <span class="related-toggle-label">Related Skills</span>
      <span class="related-toggle-count">
        {selectedRelated.length} selected
      </span>
      <svg
        class="related-chevron"
        class:related-chevron-open={showRelatedList}
        width="14" height="14" viewBox="0 0 24 24"
        fill="none" stroke="currentColor" stroke-width="2"
      >
        <polyline points="6 9 12 15 18 9"/>
      </svg>
    </button>

    {#if showRelatedList}
      <div class="related-list">
        {#each skills as skill}
          <label class="related-item">
            <input
              type="checkbox"
              checked={selectedRelated.includes(skill.boxId)}
              on:change={() => toggleRelated(skill.boxId)}
              class="related-checkbox"
            />
            <span class="related-name">
              {skill.name} — rep {skill.reputation ?? 0} — {skill.boxId.slice(0, 4)}
            </span>
            {#if skill.domain}
              <span class="related-domain">{skill.domain}</span>
            {/if}
          </label>
        {/each}
      </div>
    {/if}
  </div>
{/if}

<!-- Inline Validation Errors -->
{#if Object.keys(errors).length > 0}
  <div class="validation-summary">
    {#each Object.entries(errors) as [field, msg]}
      <p class="validation-error">• {msg}</p>
    {/each}
  </div>
{/if}

<!-- Preview Card -->
{#if previewValid}
  <div class="preview-section">
    <p class="preview-label">Preview</p>
    <div class="preview-card">
      <div class="preview-header">
        <h3 class="preview-name">{name.trim() || 'Untitled Skill'}</h3>
        {#if domain.trim()}
          <span class="preview-domain">{domain.trim()}</span>
        {/if}
      </div>
      <p class="preview-prose">
        {prose.trim() || 'No description.'}
      </p>
      {#if parsedTags.length > 0}
        <div class="preview-tags">
          {#each parsedTags.slice(0, 5) as tag}
            <span class="preview-tag">{tag}</span>
          {/each}
        </div>
      {/if}
      <div class="preview-footer">
        <span>0 services</span>
        <span>0 benchmarks</span>
        <span>0 results</span>
        {#if selectedRelated.length > 0}
          <span>{selectedRelated.length} related</span>
        {/if}
      </div>
    </div>
  </div>
{/if}

<style lang="postcss">
  .related-section {
    border: 1px solid hsl(var(--border));
    border-radius: 0.5rem;
    overflow: hidden;
  }

  .related-toggle {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 0.75rem;
    background: none;
    border: none;
    cursor: pointer;
    color: hsl(var(--foreground));
    font-size: 0.875rem;
  }

  .related-toggle:hover {
    background-color: hsl(var(--muted) / 0.5);
  }

  .related-toggle-label {
    font-weight: 500;
  }

  .related-toggle-count {
    font-size: 0.75rem;
    color: hsl(var(--muted-foreground));
    margin-left: auto;
  }

  .related-chevron {
    transition: transform 0.2s;
    color: hsl(var(--muted-foreground));
  }

  .related-chevron-open {
    transform: rotate(180deg);
  }

  .related-list {
    border-top: 1px solid hsl(var(--border));
    max-height: 200px;
    overflow-y: auto;
  }

  .related-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.75rem;
    cursor: pointer;
    font-size: 0.8125rem;
    color: hsl(var(--foreground));
  }

  .related-item:hover {
    background-color: hsl(var(--muted) / 0.3);
  }

  .related-checkbox {
    accent-color: hsl(var(--foreground));
  }

  .related-name {
    flex: 1;
  }

  .related-domain {
    font-size: 0.7rem;
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    background-color: hsl(var(--muted));
    color: hsl(var(--muted-foreground));
  }

  .validation-summary {
    padding: 0.625rem 0.75rem;
    border-radius: 0.5rem;
    border: 1px solid hsl(var(--destructive) / 0.3);
    background-color: hsl(var(--destructive) / 0.05);
  }

  .validation-error {
    font-size: 0.8125rem;
    color: hsl(var(--destructive));
    margin: 0;
    line-height: 1.5;
  }

  .preview-section {
    margin-top: 0.5rem;
  }

  .preview-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: hsl(var(--muted-foreground));
    text-transform: uppercase;
    letter-spacing: 0.05em;
    margin-bottom: 0.5rem;
  }

  .preview-card {
    padding: 1rem;
    border-radius: 0.5rem;
    border: 1px dashed hsl(var(--border));
    background-color: hsl(var(--card));
  }

  .preview-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .preview-name {
    font-size: 0.9375rem;
    font-weight: 600;
    color: hsl(var(--foreground));
  }

  .preview-domain {
    font-size: 0.7rem;
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    background-color: hsl(var(--muted));
    color: hsl(var(--muted-foreground));
    flex-shrink: 0;
  }

  .preview-prose {
    font-size: 0.8125rem;
    color: hsl(var(--muted-foreground));
    margin-bottom: 0.5rem;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .preview-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    margin-bottom: 0.5rem;
  }

  .preview-tag {
    display: inline-flex;
    align-items: center;
    padding: 0.125rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.7rem;
    font-weight: 500;
    background-color: hsl(var(--muted));
    color: hsl(var(--muted-foreground));
  }

  .preview-footer {
    display: flex;
    gap: 1rem;
    font-size: 0.75rem;
    color: hsl(var(--muted-foreground));
    border-top: 1px solid hsl(var(--border));
    padding-top: 0.5rem;
  }
</style>
