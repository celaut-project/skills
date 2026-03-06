<script lang="ts">
  export let totalSkills: number = 0;
  export let totalServices: number = 0;
  export let totalBenchmarks: number = 0;
</script>

<div class="stats-bar">
  <div class="stat-item">
    <span class="stat-icon">🧠</span>
    <div class="stat-data">
      <span class="stat-value">{totalSkills}</span>
      <span class="stat-label">Skills</span>
    </div>
  </div>
  <div class="stat-divider"></div>
  <div class="stat-item">
    <span class="stat-icon">📡</span>
    <div class="stat-data">
      <span class="stat-value">{totalServices}</span>
      <span class="stat-label">Services</span>
    </div>
  </div>
  <div class="stat-divider"></div>
  <div class="stat-item">
    <span class="stat-icon">📊</span>
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
    font-size: 1.25rem;
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
