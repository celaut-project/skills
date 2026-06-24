<script lang="ts">
  /**
   * Ambient day/night background. Sits behind all app content as a fixed,
   * non-interactive layer (`pointer-events: none`, `z-index: -1`).
   *
   * Theme-reactive purely via the `.dark` class that `mode-watcher` toggles on
   * `<html>` — no JS subscription needed:
   *   • LIGHT mode → a soft, slowly pulsing "sun" glow toward the top-right.
   *   • DARK mode  → a faint star field toward the top, gently twinkling.
   *
   * Deliberately very low opacity and very slow motion so it never competes
   * with content. Honours `prefers-reduced-motion` (motion disabled, static
   * gradients kept).
   *
   * The base surface colour lives on <html> (see app.css) so this negative
   * z-index layer can paint above the root backdrop but below app content.
   */
</script>

<div class="ambient" aria-hidden="true">
  <div class="ambient-gradient"></div>
  <div class="ambient-sun"></div>
  <div class="ambient-stars"></div>
</div>

<style>
  .ambient {
    position: fixed;
    inset: 0;
    z-index: -1;
    pointer-events: none;
    overflow: hidden;
  }

  .ambient-gradient,
  .ambient-sun,
  .ambient-stars {
    position: absolute;
    inset: 0;
  }

  /* Base wash — barely-there warm glow from the top, slowly drifting. */
  .ambient-gradient {
    background: radial-gradient(
      130% 90% at 50% -25%,
      hsl(var(--accent) / 0.06),
      transparent 60%
    );
    animation: ambient-drift 60s ease-in-out infinite alternate;
  }

  /* Sun — light mode only. Soft warm radial near the top-right. */
  .ambient-sun {
    opacity: 1;
    background: radial-gradient(
      42% 32% at 80% 6%,
      hsl(35 92% 70% / 0.16),
      hsl(22 85% 72% / 0.05) 45%,
      transparent 72%
    );
    animation: ambient-pulse 26s ease-in-out infinite alternate;
  }

  /* Stars — dark mode only. Confined to the top ~40% of the viewport. */
  .ambient-stars {
    opacity: 0;
    background-repeat: no-repeat;
    background-image:
      radial-gradient(1px 1px at 8% 11%, hsl(0 0% 100% / 0.8), transparent),
      radial-gradient(1px 1px at 17% 25%, hsl(0 0% 100% / 0.55), transparent),
      radial-gradient(1px 1px at 23% 7%, hsl(0 0% 100% / 0.7), transparent),
      radial-gradient(1px 1px at 31% 18%, hsl(0 0% 100% / 0.45), transparent),
      radial-gradient(1.5px 1.5px at 39% 5%, hsl(0 0% 100% / 0.85), transparent),
      radial-gradient(1px 1px at 46% 28%, hsl(0 0% 100% / 0.5), transparent),
      radial-gradient(1px 1px at 54% 13%, hsl(0 0% 100% / 0.7), transparent),
      radial-gradient(1px 1px at 61% 22%, hsl(0 0% 100% / 0.45), transparent),
      radial-gradient(1.5px 1.5px at 68% 9%, hsl(0 0% 100% / 0.8), transparent),
      radial-gradient(1px 1px at 74% 30%, hsl(0 0% 100% / 0.5), transparent),
      radial-gradient(1px 1px at 82% 15%, hsl(0 0% 100% / 0.7), transparent),
      radial-gradient(1px 1px at 89% 6%, hsl(0 0% 100% / 0.6), transparent),
      radial-gradient(1px 1px at 94% 24%, hsl(0 0% 100% / 0.45), transparent),
      radial-gradient(1px 1px at 4% 33%, hsl(0 0% 100% / 0.4), transparent);
    animation: ambient-twinkle 7s ease-in-out infinite alternate;
  }

  /* Second, offset twinkle pass for a touch of life without busyness. */
  .ambient-stars::after {
    content: "";
    position: absolute;
    inset: 0;
    background-repeat: no-repeat;
    background-image:
      radial-gradient(1px 1px at 13% 17%, hsl(210 60% 90% / 0.7), transparent),
      radial-gradient(1.5px 1.5px at 35% 12%, hsl(0 0% 100% / 0.75), transparent),
      radial-gradient(1px 1px at 58% 6%, hsl(210 60% 90% / 0.55), transparent),
      radial-gradient(1px 1px at 77% 21%, hsl(0 0% 100% / 0.6), transparent),
      radial-gradient(1px 1px at 90% 33%, hsl(210 60% 90% / 0.5), transparent);
    animation: ambient-twinkle-2 9s ease-in-out infinite alternate;
  }

  /* Dark mode: hide the sun, reveal the stars, cool the base wash. */
  :global(.dark) .ambient-sun {
    opacity: 0;
  }
  :global(.dark) .ambient-stars {
    opacity: 0.8;
  }
  :global(.dark) .ambient-gradient {
    background: radial-gradient(
      130% 90% at 50% -25%,
      hsl(205 55% 60% / 0.07),
      transparent 60%
    );
  }

  @keyframes ambient-drift {
    from {
      transform: translate3d(-1.5%, -1%, 0) scale(1.02);
    }
    to {
      transform: translate3d(1.5%, 1%, 0) scale(1.05);
    }
  }

  @keyframes ambient-pulse {
    from {
      opacity: 0.75;
      transform: scale(1);
    }
    to {
      opacity: 1;
      transform: scale(1.05);
    }
  }

  @keyframes ambient-twinkle {
    from {
      opacity: 0.55;
    }
    to {
      opacity: 0.85;
    }
  }

  @keyframes ambient-twinkle-2 {
    from {
      opacity: 0.35;
    }
    to {
      opacity: 0.7;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .ambient-gradient,
    .ambient-sun,
    .ambient-stars,
    .ambient-stars::after {
      animation: none;
    }
  }
</style>
