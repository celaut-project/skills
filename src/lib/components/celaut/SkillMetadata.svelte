<script lang="ts">
  export let skillBoxId: string = '';

  // Mock metadata keyed by box ID
  const mockMeta: Record<string, { created: string; updated: string; creator: string }> = {
    'demo-001': { created: '2025-10-15', updated: '2025-12-14', creator: '9hY16vzHmmfyVBwKeFGHvb2bMFsG4Q1d...' },
    'demo-002': { created: '2025-11-02', updated: '2025-12-20', creator: '9f5ZKbECVTm25JTRQHDHGM4rME3G1JAAA...' },
    'demo-003': { created: '2025-11-18', updated: '2025-12-01', creator: '9hY16vzHmmfyVBwKeFGHvb2bMFsG4Q1d...' },
    'demo-004': { created: '2025-09-28', updated: '2025-12-18', creator: '9gNYeyfRFUipiWZ3AJ9p5bHh1PcWnU2F...' },
    'demo-005': { created: '2025-10-30', updated: '2025-12-15', creator: '9f5ZKbECVTm25JTRQHDHGM4rME3G1JAAA...' },
    'demo-006': { created: '2025-11-05', updated: '2025-12-12', creator: '9gNYeyfRFUipiWZ3AJ9p5bHh1PcWnU2F...' }
  };

  $: meta = mockMeta[skillBoxId] || { created: 'Unknown', updated: 'Unknown', creator: 'Unknown' };
</script>

<div class="skill-meta">
  <div class="meta-row">
    <span class="meta-label">Created</span>
    <span class="meta-value">{meta.created}</span>
  </div>
  <div class="meta-row">
    <span class="meta-label">Last updated</span>
    <span class="meta-value">{meta.updated}</span>
  </div>
  <div class="meta-row">
    <span class="meta-label">Creator</span>
    <span class="meta-value meta-mono">{meta.creator}</span>
  </div>
</div>

<style lang="postcss">
  .skill-meta {
    padding: 0.75rem 1rem;
    border-radius: 0.5rem;
    border: 1px solid hsl(var(--border));
    background-color: hsl(var(--muted) / 0.3);
    margin-bottom: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .meta-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 0.8125rem;
  }

  .meta-label {
    color: hsl(var(--muted-foreground));
    font-weight: 500;
  }

  .meta-value {
    color: hsl(var(--foreground));
  }

  .meta-mono {
    font-family: monospace;
    font-size: 0.75rem;
    max-width: 220px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
