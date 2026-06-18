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

  export let profileId: string | undefined | null = '';
  /** Pixel size of the rendered SVG (width = height). */
  export let size: number = 20;
  /** Optional tooltip override; defaults to a truncated profile id. */
  export let title: string | undefined = undefined;

  $: avatarSvg = profileId ? jdenticon.toSvg(profileId, size) : '';
  $: tooltip = title ?? (profileId ? `Profile ${shortId(profileId)}` : 'No profile');

  function shortId(id: string): string {
    if (id.length <= 14) return id;
    return `${id.slice(0, 6)}…${id.slice(-4)}`;
  }
</script>

{#if profileId}
  <span
    class="profile-avatar"
    style="width: {size}px; height: {size}px;"
    title={tooltip}
    aria-label={tooltip}
  >
    {@html avatarSvg}
  </span>
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
