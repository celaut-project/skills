<script lang="ts">
  /**
   * "Share Skill" modal — lets a user share a skill to Twitter/X, Telegram or
   * LinkedIn, or copy a pre-filled message with a deep link to the skill.
   *
   * Styled to match the app's portal-based modal pattern (see
   * ClaimCoverageButton). Adapted from the game-of-prompts ShareModal.
   */
  import { createEventDispatcher } from 'svelte';
  import { portal } from '$lib/actions/portal';
  import {
    type SharePlatform,
    type ShareConfig,
    getShareUrl,
    getShareText,
    getSkillUrl,
    openShareUrl,
    copyToClipboard,
    getPlatformMetadata
  } from './share-utils';

  export let open = false;
  export let skillName = '';
  export let skillBoxId = '';
  export let description = '';

  const dispatch = createEventDispatcher<{ close: void }>();

  const platforms: SharePlatform[] = ['twitter', 'telegram', 'linkedin'];

  let selectedPlatform: SharePlatform | null = null;
  let copyFeedback = false;
  let copyTimeout: ReturnType<typeof setTimeout>;
  let isSharing = false;

  $: shareConfig = { skillName, skillBoxId, description } satisfies ShareConfig;
  $: previewUrl = skillBoxId ? getSkillUrl(skillBoxId) : '';

  // Reset transient state whenever the modal closes.
  $: if (!open) {
    selectedPlatform = null;
    isSharing = false;
  }

  function close() {
    open = false;
    selectedPlatform = null;
    dispatch('close');
  }

  function handleShare() {
    if (!selectedPlatform) return;
    isSharing = true;
    try {
      openShareUrl(getShareUrl(selectedPlatform, shareConfig), selectedPlatform);
      setTimeout(close, 400);
    } catch (error) {
      console.error('Share error:', error);
      isSharing = false;
    }
  }

  async function handleCopy() {
    const ok = await copyToClipboard(getShareText(shareConfig));
    if (!ok) return;
    copyFeedback = true;
    if (copyTimeout) clearTimeout(copyTimeout);
    copyTimeout = setTimeout(() => (copyFeedback = false), 2000);
  }
</script>

{#if open}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="share-modal-backdrop" use:portal on:click={close}>
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
    <div class="share-modal-content" on:click|stopPropagation role="dialog" aria-modal="true" aria-label="Share skill">
      <div class="share-modal-header">
        <h3 class="share-modal-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
          </svg>
          Share Skill
        </h3>
        <button class="share-modal-close" on:click={close} aria-label="Close">✕</button>
      </div>
      <p class="share-modal-desc">
        Share <strong>{skillName || 'this skill'}</strong> with your network. Pick a
        platform for a pre-filled post, or copy the message with a link.
      </p>

      <div class="share-platforms">
        {#each platforms as platform}
          <button
            type="button"
            class="share-platform"
            class:selected={selectedPlatform === platform}
            on:click={() => (selectedPlatform = platform)}
          >
            {#if platform === 'twitter'}
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24h-6.656l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231 5.45-6.231zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/>
              </svg>
              <span>Twitter (X)</span>
            {:else if platform === 'telegram'}
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M21.94 4.3a1.2 1.2 0 0 0-1.27-.18L3.3 11.04c-.86.34-.84 1.57.03 1.88l4.3 1.5 1.66 5.02c.2.6.96.78 1.42.34l2.4-2.28 4.36 3.2c.5.37 1.22.1 1.36-.5l3.2-14.4a1.2 1.2 0 0 0-.45-1.2zM9.7 14.13l8.2-5.07-6.77 6.1c-.18.16-.3.39-.34.63l-.27 2.02-1.0-3.02a.6.6 0 0 1 .18-.66z"/>
              </svg>
              <span>Telegram</span>
            {:else if platform === 'linkedin'}
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M4.98 3.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5zM3 9h4v12H3zM10 9h3.8v1.64h.05c.53-1 1.83-2.05 3.77-2.05 4.03 0 4.78 2.65 4.78 6.1V21h-4v-5.4c0-1.29-.02-2.95-1.8-2.95-1.8 0-2.08 1.4-2.08 2.85V21h-4z"/>
              </svg>
              <span>LinkedIn</span>
            {/if}
          </button>
        {/each}
      </div>

      <div class="share-preview">
        <p class="share-preview-label">Preview message</p>
        <p class="share-preview-text">Check out the "{skillName || 'this skill'}" skill on Unstoppable Skills 🤖</p>
        {#if previewUrl}
          <p class="share-preview-url">{previewUrl}</p>
        {/if}
      </div>

      <button type="button" class="share-copy-btn" on:click={handleCopy}>
        {#if copyFeedback}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          Copied!
        {:else}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          Copy message
        {/if}
      </button>

      <div class="share-modal-actions">
        <button class="share-modal-cancel" on:click={close}>Cancel</button>
        <button class="share-modal-submit" on:click={handleShare} disabled={!selectedPlatform || isSharing}>
          {#if isSharing}
            Opening…
          {:else}
            Share{selectedPlatform ? ` on ${getPlatformMetadata(selectedPlatform).name}` : ''}
          {/if}
        </button>
      </div>
    </div>
  </div>
{/if}

<style lang="postcss">
  .share-modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
    background-color: rgba(0, 0, 0, 0.55);
    backdrop-filter: blur(2px);
  }

  .share-modal-content {
    width: 100%;
    max-width: 30rem;
    border-radius: 0.875rem;
    border: 1px solid hsl(var(--border));
    background-color: hsl(var(--card));
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
    padding: 1.25rem 1.25rem 1rem;
  }

  .share-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 0.5rem;
  }

  .share-modal-title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 1.05rem;
    font-weight: 700;
    color: hsl(var(--foreground));
    margin: 0;
  }

  .share-modal-close {
    border: none;
    background: none;
    color: hsl(var(--muted-foreground));
    font-size: 1rem;
    cursor: pointer;
    line-height: 1;
    padding: 0.25rem;
  }

  .share-modal-close:hover {
    color: hsl(var(--foreground));
  }

  .share-modal-desc {
    font-size: 0.85rem;
    color: hsl(var(--muted-foreground));
    margin: 0 0 0.875rem;
    line-height: 1.5;
  }

  .share-platforms {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.625rem;
    margin-bottom: 0.875rem;
  }

  .share-platform {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.375rem;
    padding: 0.75rem 0.5rem;
    border-radius: 0.625rem;
    border: 2px solid hsl(var(--border));
    background-color: hsl(var(--muted) / 0.3);
    color: hsl(var(--foreground));
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .share-platform:hover {
    border-color: hsl(var(--primary) / 0.5);
  }

  .share-platform.selected {
    border-color: hsl(var(--primary));
    background-color: hsl(var(--primary) / 0.1);
  }

  .share-preview {
    border-radius: 0.625rem;
    border: 1px solid hsl(var(--border));
    background-color: hsl(var(--muted) / 0.4);
    padding: 0.75rem 0.875rem;
    margin-bottom: 0.875rem;
  }

  .share-preview-label {
    font-size: 0.65rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: hsl(var(--muted-foreground));
    margin: 0 0 0.375rem;
  }

  .share-preview-text {
    font-size: 0.85rem;
    color: hsl(var(--foreground));
    margin: 0;
    line-height: 1.5;
  }

  .share-preview-url {
    font-size: 0.75rem;
    color: hsl(var(--muted-foreground));
    margin: 0.375rem 0 0;
    word-break: break-all;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  }

  .share-copy-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    width: 100%;
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    font-size: 0.8125rem;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid hsl(var(--border));
    background-color: transparent;
    color: hsl(var(--foreground));
    transition: background 0.15s ease;
  }

  .share-copy-btn:hover {
    background-color: hsl(var(--muted) / 0.5);
  }

  .share-modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 0.5rem;
    margin-top: 1rem;
  }

  .share-modal-cancel,
  .share-modal-submit {
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid hsl(var(--border));
  }

  .share-modal-cancel {
    background-color: transparent;
    color: hsl(var(--muted-foreground));
  }

  .share-modal-cancel:hover {
    background-color: hsl(var(--muted) / 0.5);
  }

  .share-modal-submit {
    background-color: hsl(var(--primary));
    color: hsl(var(--primary-foreground));
    border-color: hsl(var(--primary) / 0.85);
  }

  .share-modal-submit:hover:not(:disabled) {
    background-color: hsl(var(--primary) / 0.85);
  }

  .share-modal-submit:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
</style>
