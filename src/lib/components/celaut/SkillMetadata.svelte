<script lang="ts">
  import { formatSourceHash } from '$lib/api';
  import { toasts } from './toastStore';

  export let author: string = '';
  export let boxId: string = '';
  export let sourceHash: string = '';

  async function copyHash() {
    if (!sourceHash) return;
    try {
      await navigator.clipboard.writeText(sourceHash);
      toasts.info('Hash copied to clipboard');
    } catch {
      toasts.error('Failed to copy');
    }
  }
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
  {#if sourceHash}
    <div class="meta-row">
      <span class="meta-label">📄 Source Hash</span>
      <span class="meta-value meta-mono meta-hash">
        {formatSourceHash(sourceHash)}
        <button class="copy-btn" on:click={copyHash} title="Copy full hash">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
          </svg>
        </button>
      </span>
    </div>
  {/if}
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

  .meta-hash {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
  }

  .copy-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.25rem;
    height: 1.25rem;
    border-radius: 0.25rem;
    border: none;
    background: none;
    color: hsl(var(--muted-foreground));
    cursor: pointer;
    transition: color 0.15s;
  }

  .copy-btn:hover {
    color: hsl(var(--foreground));
  }
</style>
