<script lang="ts">
  // Footer component
</script>

<footer class="page-footer">
  <div class="footer-inner">
    <div class="footer-brand">
      <svg width="18" height="18" viewBox="0 0 12 12" fill="none" class="footer-logo">
        <path d="M0.502 2.999L6 0L11.495 3.03L6.0025 5.96L0.502 2.999V2.999ZM6.5 6.8365V12L11.5 9.319V4.156L6.5 6.8365V6.8365ZM5.5 6.8365L0.5 4.131V9.319L5.5 12V6.8365Z" fill="currentColor"/>
      </svg>
      <span class="footer-name">Celaut Skills</span>
      <span class="footer-divider">·</span>
      <span class="footer-tagline">Decentralized AI Problem Registry</span>
    </div>
    
    <div class="footer-links">
      <a href="https://github.com/celaut-project" target="_blank" rel="noopener noreferrer" class="footer-link">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
        </svg>
        GitHub
      </a>
      <a href="https://ergoplatform.org" target="_blank" rel="noopener noreferrer" class="footer-link">
        <svg width="14" height="14" viewBox="0 0 12 12" fill="none">
          <path d="M0.502 2.999L6 0L11.495 3.03L6.0025 5.96L0.502 2.999V2.999ZM6.5 6.8365V12L11.5 9.319V4.156L6.5 6.8365V6.8365ZM5.5 6.8365L0.5 4.131V9.319L5.5 12V6.8365Z" fill="currentColor"/>
        </svg>
        Ergo
      </a>
      <a href="/docs" class="footer-link">Docs</a>
    </div>
  </div>
</footer>

<style lang="postcss">
  .page-footer {
    @apply w-full border-t py-6 px-6 mt-12;
    background-color: hsl(var(--background) / 0.85);
    border-top-color: hsl(var(--border));
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }

  .footer-inner {
    @apply container mx-auto flex flex-col sm:flex-row items-center justify-between gap-4;
  }

  .footer-brand {
    @apply flex items-center gap-2 text-sm text-muted-foreground;
  }

  .footer-logo {
    @apply text-primary opacity-60;
  }

  .footer-name {
    @apply font-semibold text-foreground;
    font-family: var(--font-heading);
  }

  .footer-divider {
    @apply opacity-30;
  }

  .footer-tagline {
    @apply text-xs;
  }

  .footer-links {
    @apply flex items-center gap-4;
  }

  .footer-link {
    @apply flex items-center gap-1.5 text-xs text-muted-foreground no-underline transition-colors duration-200;
  }
  .footer-link:hover {
    @apply text-foreground;
  }
</style>
