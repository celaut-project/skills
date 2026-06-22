<script lang="ts">
  import { onMount } from 'svelte';
  import { walletConnected } from 'wallet-svelte-component';
  import { forumSidebar, closeForum } from './forumSidebar';

  /**
   * Single full-height side-rail panel that hosts the Forum component.
   * Replaces every per-section Forum embed in the app — see PR for context.
   *
   * Loads `forum-application` lazily to match the existing dynamic-import
   * pattern (avoids the ESM-init crash that was hitting top-level imports).
   */

  let ForumComponent: any = null;
  let loadError: string | null = null;

  async function ensureForumLoaded() {
    if (ForumComponent) return;
    try {
      const mod = await import('forum-application');
      ForumComponent = mod.Forum;
    } catch (err: any) {
      loadError = err?.message ?? 'Failed to load forum-application.';
    }
  }

  // Whenever the panel opens, kick off the lazy load.
  $: if ($forumSidebar.open) {
    ensureForumLoaded();
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && $forumSidebar.open) closeForum();
  }

  onMount(() => {
    document.addEventListener('keydown', onKeydown);
    return () => document.removeEventListener('keydown', onKeydown);
  });
</script>

{#if $forumSidebar.open}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="forum-backdrop" on:click={closeForum}></div>
{/if}

<aside class="forum-rail" class:forum-rail-open={$forumSidebar.open} aria-hidden={!$forumSidebar.open}>
  <header class="forum-rail-header">
    <div class="forum-rail-titles">
      <span class="forum-rail-eyebrow">Discussion</span>
      <h2 class="forum-rail-title" title={$forumSidebar.title}>{$forumSidebar.title || 'Topic'}</h2>
    </div>
    <button class="forum-rail-close" type="button" on:click={closeForum} aria-label="Close discussion">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  </header>

  <div class="forum-rail-body">
    {#if $forumSidebar.open}
      {#if loadError}
        <div class="forum-rail-error">{loadError}</div>
      {:else if ForumComponent && $forumSidebar.topicId}
        <!--
          {#key topicId} forces Forum to remount when the user jumps between
          topics. Forum holds per-topic state (subscriptions, draft text) in
          internal closures that aren't reactive to a topic_id prop change, so
          a plain re-render would leave the previous topic's draft visible.
        -->
        {#key $forumSidebar.topicId}
          <svelte:component
            this={ForumComponent}
            topic_id={$forumSidebar.topicId}
            connected={$walletConnected}
          />
        {/key}
      {:else}
        <div class="forum-rail-loading">Loading discussion…</div>
      {/if}
    {/if}
  </div>
</aside>

<style lang="postcss">
  .forum-backdrop {
    position: fixed;
    inset: 0;
    background: hsl(0 0% 0% / 0.35);
    z-index: 80;
  }

  .forum-rail {
    position: fixed;
    top: 0;
    right: 0;
    height: 100vh;
    /* Per Josemi 2026-06-16: bumped from 380px → 520px. Forum threads include
       multi-line prompts and quoted prior posts; the narrower rail was forcing
       awkward word-wrapping and made the embedded composer feel cramped.
       2026-06-22: switched to a viewport-relative 40vw so the rail scales with
       wide screens, with a min-width floor so phones/narrow windows keep a
       usable composer and a 90vw cap so it never fully covers the page. */
    width: 40vw;
    min-width: 320px;
    max-width: 90vw;
    background: hsl(var(--background));
    border-left: 1px solid hsl(var(--border));
    box-shadow: -8px 0 24px hsl(0 0% 0% / 0.18);
    display: flex;
    flex-direction: column;
    transform: translateX(100%);
    transition: transform 220ms ease;
    z-index: 90;
  }
  .forum-rail-open {
    transform: translateX(0);
  }

  .forum-rail-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid hsl(var(--border));
    flex-shrink: 0;
  }
  .forum-rail-titles {
    display: flex;
    flex-direction: column;
    min-width: 0;
    flex: 1;
  }
  .forum-rail-eyebrow {
    font-size: 0.65rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: hsl(var(--muted-foreground));
  }
  .forum-rail-title {
    font-size: 0.95rem;
    font-weight: 600;
    margin: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: hsl(var(--foreground));
  }
  .forum-rail-close {
    background: transparent;
    border: 0;
    padding: 0.375rem;
    border-radius: 0.25rem;
    color: hsl(var(--muted-foreground));
    cursor: pointer;
  }
  .forum-rail-close:hover {
    background: hsl(var(--muted));
    color: hsl(var(--foreground));
  }

  .forum-rail-body {
    flex: 1;
    overflow-y: auto;
    padding: 0.75rem 1rem 1rem;
  }
  .forum-rail-loading,
  .forum-rail-error {
    font-size: 0.875rem;
    color: hsl(var(--muted-foreground));
    padding: 1rem 0;
  }
  .forum-rail-error {
    color: hsl(var(--destructive));
  }
</style>
