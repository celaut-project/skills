<script lang="ts">
  export let totalSkills: number = 0;
  export let totalServices: number = 0;
  export let totalBenchmarks: number = 0;
</script>

<div class="stats-bar">
  <div class="stat-item">
    <span class="stat-icon">
      <!-- Grid/puzzle icon for Skills -->
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
  <div class="stat-item">
    <span class="stat-icon">
      <!-- Server/node icon for Services -->
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
  <div class="stat-item">
    <span class="stat-icon">
      <!-- Bar chart icon for Benchmarks -->
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
      </svg>
    </span>
    <div class="stat-data">
      <span class="stat-value">{totalBenchmarks}</span>
      <span class="stat-label">Benchmarks</span>
    </div>
  </div>
</div>

<style lang="postcss">
  .stats-bar {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1.5rem;
    padding: 0.75rem 1.5rem;
    margin-bottom: 1.5rem;
    border-radius: 0.75rem;
    border: 1px solid hsl(var(--border));
    background-color: hsl(var(--card));
  }

  .stat-item {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .stat-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border-radius: 0.5rem;
    background: hsl(var(--primary) / 0.1);
    color: hsl(var(--primary));
  }

  .stat-data {
    display: flex;
    flex-direction: column;
    line-height: 1.2;
  }

  .stat-value {
    font-size: 1.125rem;
    font-weight: 700;
    color: hsl(var(--foreground));
  }

  .stat-label {
    font-size: 0.7rem;
    color: hsl(var(--muted-foreground));
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .stat-divider {
    width: 1px;
    height: 2rem;
    background-color: hsl(var(--border));
  }

  @media (max-width: 480px) {
    .stats-bar {
      gap: 1rem;
      padding: 0.5rem 1rem;
    }
  }
</style>
