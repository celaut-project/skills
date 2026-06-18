<script lang="ts">
  /**
   * Identicon avatar for a reputation profile (token_id / profile_id).
   *
   * Mirrors the avatar pattern from reputation-systems/forum-application —
   * `jdenticon.toSvg(profileId, size)` deterministically generates a unique
   * geometric SVG from the profile id, so every profile in the network has a
   * stable visual identity without needing an off-chain avatar registry.
   *
   * Falls back to a muted placeholder dot when no profileId is supplied.
   */
  import * as jdenticon from 'jdenticon';
  import { createEventDispatcher } from 'svelte';
  import { viewedProfileId } from '$lib/stores';

  export let profileId: string | undefined | null = '';
  /** Pixel size of the rendered SVG (width = height). */
  export let size: number = 20;
  /** Optional tooltip override; defaults to a truncated profile id. */
  export let title: string | undefined = undefined;
  /**
   * When true (default), the avatar is rendered as a button that emits a
   * `select` event with the profileId — App.svelte listens and routes to
   * `?profile={id}` to show that profile's detail page. Set to false for
   * purely decorative avatars (e.g. inside the user's own profile card).
   */
  export let clickable: boolean = true;

  const dispatch = createEventDispatcher<{ select: string }>();

  $: avatarSvg = profileId ? jdenticon.toSvg(profileId, size) : '';
  $: tooltip = title ?? (profileId ? `Profile ${shortId(profileId)}` : 'No profile');

  function shortId(id: string): string {
    if (id.length <= 14) return id;
    return `${id.slice(0, 6)}…${id.slice(-4)}`;
  }

  function handleClick(event: MouseEvent) {
    if (!profileId || !clickable) return;
    event.stopPropagation();
    viewedProfileId.set(profileId);
    dispatch('select', profileId);
  }

  function handleKey(event: KeyboardEvent) {
    if (!profileId || !clickable) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      viewedProfileId.set(profileId);
      dispatch('select', profileId);
    }
  }
</script>

{#if profileId}
  {#if clickable}
    <button
      type="button"
      class="profile-avatar profile-avatar-clickable"
      style="width: {size}px; height: {size}px;"
      title={tooltip}
      aria-label={tooltip}
      on:click={handleClick}
      on:keydown={handleKey}
    >
      {@html avatarSvg}
    </button>
  {:else}
    <span
      class="profile-avatar"
      style="width: {size}px; height: {size}px;"
      title={tooltip}
      aria-label={tooltip}
    >
      {@html avatarSvg}
    </span>
  {/if}
{:else}
  <span
    class="profile-avatar profile-avatar-empty"
    style="width: {size}px; height: {size}px;"
    title="No profile"
    aria-hidden="true"
  ></span>
{/if}

<style lang="postcss">
  .profile-avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    border-radius: 9999px;
    background: hsl(var(--muted) / 0.5);
    overflow: hidden;
    vertical-align: middle;
  }
  button.profile-avatar {
    padding: 0;
    border: 0;
    line-height: 0;
    font: inherit;
    color: inherit;
  }
  .profile-avatar-clickable {
    cursor: pointer;
    transition: box-shadow 120ms ease, transform 120ms ease;
  }
  .profile-avatar-clickable:hover,
  .profile-avatar-clickable:focus-visible {
    box-shadow: 0 0 0 2px hsl(var(--ring, var(--primary)));
    outline: none;
    transform: translateY(-1px);
  }

  .profile-avatar :global(svg) {
    width: 100%;
    height: 100%;
    display: block;
  }

  .profile-avatar-empty {
    background: hsl(var(--muted) / 0.4);
    border: 1px dashed hsl(var(--border));
  }
</style>
