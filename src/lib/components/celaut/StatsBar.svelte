<script lang="ts">
  export let totalSkills: number = 0;
  export let totalServices: number = 0;
  export let totalResults: number = 0;
</script>

<div class="stats-bar">
  <div class="stat-item" title="Skills registered on-chain">
    <span class="stat-icon">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
      </svg>
    </span>
    <div class="stat-data">
      <span class="stat-value">{totalSkills}</span>
      <span class="stat-label">Skills</span>
    </div>
  </div>
  <div class="stat-divider"></div>
  <div class="stat-item" title="Service solutions claiming to cover a skill">
    <span class="stat-icon">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="2" width="20" height="8" rx="2" ry="2"/><rect x="2" y="14" width="20" height="8" rx="2" ry="2"/><line x1="6" y1="6" x2="6.01" y2="6"/><line x1="6" y1="18" x2="6.01" y2="18"/>
      </svg>
    </span>
    <div class="stat-data">
      <span class="stat-value">{totalServices}</span>
      <span class="stat-label">Services</span>
    </div>
  </div>
  <div class="stat-divider"></div>
  <div class="stat-item" title="Benchmark results submitted on-chain">
    <span class="stat-icon">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    </span>
    <div class="stat-data">
      <span class="stat-value">{totalResults}</span>
      <span class="stat-label">Results</span>
    </div>
  </div>
</div>

<style lang="postcss">
  /* Secondary metadata, not a hero card: no surface/border, muted, low weight.
     Reads as a quiet inline summary line under the subtitle. */
  .stats-bar {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-wrap: wrap;
    gap: 1.25rem;
    margin-bottom: 1.5rem;
  }

  .stat-item {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    color: hsl(var(--muted-foreground));
  }

  /* No boxed chip — just a small, dimmed inline glyph. */
  .stat-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: hsl(var(--muted-foreground));
    opacity: 0.65;
  }

  .stat-icon :global(svg) {
    width: 14px;
    height: 14px;
  }

  .stat-data {
    display: inline-flex;
    align-items: baseline;
    gap: 0.3rem;
  }

  .stat-value {
    font-size: 0.875rem;
    font-weight: 600;
    color: hsl(var(--foreground) / 0.72);
  }

  .stat-label {
    font-size: 0.72rem;
    color: hsl(var(--muted-foreground));
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  /* Divider is a faint dot, not a hard rule. */
  .stat-divider {
    width: 3px;
    height: 3px;
    border-radius: 9999px;
    background-color: hsl(var(--muted-foreground) / 0.4);
  }

  @media (max-width: 480px) {
    .stats-bar {
      gap: 0.85rem;
    }
  }
</style>
