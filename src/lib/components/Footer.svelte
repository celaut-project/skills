<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { Github, Globe, Send } from 'lucide-svelte';
  import { walletConnected } from 'wallet-svelte-component';
  import { EXPLORER_API } from '$lib/api';
  import Kya from '../../routes/kya.svelte';

  // Auto-open the Know Your Assumptions notice on first wallet connect; the Kya
  // component no-ops if the user already accepted it (persisted in localStorage).
  // The footer also exposes a "KYA" link to re-read it at any time.
  let autoOpenKya = false;
  $: autoOpenKya = browser && $walletConnected;

  /**
   * Cyberpunk footer — ported from game-of-prompts/app per Josemi 2026-06-16.
   *
   * Three-zone fixed-bottom layout (left links / scrolling messages / block
   * height) at a strict 48px tall. The previous footer drifted taller on
   * narrower viewports because the brand+links row wrapped — this one keeps
   * its zones in a single flex line with overflow-clipped scroll text in the
   * middle, so the height never varies on desktop.
   */

  // Rotating banner text — index advances when the marquee animation iterates,
  // so users see a different tagline on each loop instead of one fixed string.
  const footerMessages = [
    'Descentraliced & unstoppable skill registry. Powered by Ergo Blockchain.',
    'Celaut paradigm: Find a skill for your problem and download the best solver.',
    'Public gateway hosted on GitHub. Or run it yourself for full P2P sovereignty.',
  ];
  let activeMessageIndex = 0;

  function handleAnimationIteration() {
    activeMessageIndex = (activeMessageIndex + 1) % footerMessages.length;
  }

  // Latest mainnet block height polled from the public Explorer. Refreshed
  // every 30s — Ergo's 2-minute block time means even a much slower poll
  // would feel fresh, 30s is generous against single missed requests.
  let blockHeight: number | null = null;
  let pollHandle: number | null = null;

  async function fetchBlockHeight() {
    try {
      const res = await fetch(`${EXPLORER_API}/api/v1/networkState`);
      if (!res.ok) return;
      const data = await res.json();
      // Explorer returns { height, lastBlockId, ... }; only height is shown.
      if (typeof data?.height === 'number') blockHeight = data.height;
    } catch {
      // Network failure → leave the previous value visible instead of blanking
      // the cell, so a momentary blip doesn't make the footer flicker.
    }
  }

  onMount(() => {
    if (!browser) return;
    fetchBlockHeight();
    pollHandle = window.setInterval(fetchBlockHeight, 30_000);
  });

  onDestroy(() => {
    if (pollHandle !== null) clearInterval(pollHandle);
  });
</script>

<footer class="page-footer">
  <div class="footer-left">
    <a
      href="https://github.com/celaut-project"
      target="_blank"
      rel="noopener noreferrer"
      class="footer-link"
      title="GitHub"
    >
      <Github class="h-4 w-4" />
    </a>
    <a
      href="https://celaut-project.github.io"
      target="_blank"
      rel="noopener noreferrer"
      class="footer-link"
      title="Celaut"
    >
      <Globe class="h-4 w-4" />
    </a>
    <a
      href="https://t.me/unstopbots"
      target="_blank"
      rel="noopener noreferrer"
      class="footer-link"
      title="Telegram"
    >
      <Send class="h-4 w-4" />
    </a>
    <span class="footer-link footer-kya" title="Know Your Assumptions">
      <Kya autoOpen={autoOpenKya} />
    </span>
  </div>

  <div class="footer-center">
    <div class="scrolling-text-wrapper" on:animationiteration={handleAnimationIteration}>
      {footerMessages[activeMessageIndex]}
    </div>
  </div>

  <div class="footer-right" title="Ergo mainnet block height">
    <svg width="14" height="14" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M0.502 2.999L6 0L11.495 3.03L6.0025 5.96L0.502 2.999V2.999ZM6.5 6.8365V12L11.5 9.319V4.156L6.5 6.8365V6.8365ZM5.5 6.8365L0.5 4.131V9.319L5.5 12V6.8365Z" fill="currentColor" />
    </svg>
    {#if blockHeight !== null}
      <span class="footer-block-height">{blockHeight.toLocaleString()}</span>
    {:else}
      <span class="footer-block-height footer-block-height-loading">—</span>
    {/if}
  </div>
</footer>

<style lang="postcss">
  .page-footer {
    /* Fixed-bottom, strict 48px height. The previous non-fixed footer let its
       inner content push it taller; this layout makes overflow physically
       impossible because each zone is a flex child with its own overflow rule. */
    @apply fixed bottom-0 left-0 right-0 z-40;
    @apply flex items-center;
    @apply h-12 px-6 gap-6;
    @apply text-sm;
    background-color: hsl(var(--background) / 0.85);
    border-top: 1px solid hsl(var(--primary) / 0.12);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 0.8rem;
    color: hsl(var(--muted-foreground));
  }

  .footer-left,
  .footer-right {
    @apply flex items-center gap-2 flex-shrink-0;
  }

  .footer-link {
    @apply transition-colors;
    color: hsl(var(--muted-foreground));
  }
  .footer-link:hover {
    color: hsl(var(--primary));
  }
  /* The KYA trigger renders text (not an icon); keep it footer-sized and aligned. */
  .footer-kya {
    @apply inline-flex items-center text-xs font-medium tracking-wide;
  }

  .footer-center {
    /* Mask edges so the scrolling text fades in/out instead of popping at the
       hard edges of the flex column. */
    @apply flex-1 overflow-hidden;
    -webkit-mask-image: linear-gradient(
      to right,
      transparent,
      black 10%,
      black 90%,
      transparent
    );
    mask-image: linear-gradient(
      to right,
      transparent,
      black 10%,
      black 90%,
      transparent
    );
  }

  .scrolling-text-wrapper {
    @apply inline-block whitespace-nowrap;
    animation: scroll-left 40s linear infinite;
  }

  @keyframes scroll-left {
    from { transform: translateX(100vw); }
    to   { transform: translateX(-100%); }
  }

  .footer-block-height {
    font-variant-numeric: tabular-nums;
  }
  .footer-block-height-loading {
    opacity: 0.5;
  }

  /* On phones: wrap is allowed but each row is height-capped, so the footer
     can grow to two rows (still under-thumb) without exploding to fit links. */
  @media (max-width: 640px) {
    .page-footer {
      @apply h-auto px-4 py-2 gap-2;
      flex-wrap: wrap;
    }
    .footer-center {
      order: -1;
      flex: 0 0 100%;
    }
    .footer-left,
    .footer-right {
      flex: 1 1 0;
    }
    .footer-right {
      justify-content: flex-end;
    }
  }
</style>
