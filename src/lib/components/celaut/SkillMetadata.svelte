<script lang="ts">
  export let author: string = '';
  export let boxId: string = '';
</script>

<div class="skill-meta">
  <div class="meta-row">
    <span class="meta-label">Author</span>
    <span class="meta-value meta-mono">{author || 'Unknown'}</span>
  </div>
  <div class="meta-row">
    <span class="meta-label">Box ID</span>
    <span class="meta-value meta-mono">{boxId}</span>
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
    max-width: 280px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
