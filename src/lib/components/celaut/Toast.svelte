<script lang="ts">
  import { fly, fade } from 'svelte/transition';
  import { toasts } from './toastStore';
</script>

{#if $toasts.length > 0}
  <div class="toast-container">
    {#each $toasts as toast (toast.id)}
      <div
        class="toast-item toast-{toast.type}"
        in:fly={{ y: 40, duration: 250 }}
        out:fade={{ duration: 150 }}
      >
        <span class="toast-icon">
          {#if toast.type === 'success'}✓{:else if toast.type === 'error'}✕{:else}ℹ{/if}
        </span>
        <span class="toast-message">{toast.message}</span>
        <button class="toast-close" on:click={() => toasts.dismiss(toast.id)}>×</button>
      </div>
    {/each}
  </div>
{/if}

<style lang="postcss">
  .toast-container {
    position: fixed;
    bottom: 3.5rem;
    right: 1rem;
    z-index: 100;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    max-width: 360px;
  }

  .toast-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    border-radius: 0.5rem;
    border: 1px solid hsl(var(--border));
    background-color: hsl(var(--card));
    color: hsl(var(--foreground));
    font-size: 0.875rem;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }

  .toast-success {
    border-left: 3px solid hsl(142, 71%, 45%);
  }
  .toast-error {
    border-left: 3px solid hsl(var(--destructive));
  }
  .toast-info {
    border-left: 3px solid hsl(215 15% 50%);
  }

  .toast-icon {
    flex-shrink: 0;
    width: 1.25rem;
    height: 1.25rem;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    font-size: 0.7rem;
    font-weight: 700;
  }

  .toast-success .toast-icon {
    background-color: hsl(142, 71%, 45% / 0.15);
    color: hsl(142, 71%, 45%);
  }
  .toast-error .toast-icon {
    background-color: hsl(var(--destructive) / 0.15);
    color: hsl(var(--destructive));
  }
  .toast-info .toast-icon {
    background-color: hsl(215 15% 50% / 0.15);
    color: hsl(215 15% 50%);
  }

  .toast-message {
    flex: 1;
  }

  .toast-close {
    flex-shrink: 0;
    background: none;
    border: none;
    color: hsl(var(--muted-foreground));
    cursor: pointer;
    font-size: 1rem;
    padding: 0 0.25rem;
    line-height: 1;
  }
  .toast-close:hover {
    color: hsl(var(--foreground));
  }
</style>
