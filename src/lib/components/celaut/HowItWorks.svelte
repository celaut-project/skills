<script lang="ts">
  let expanded = false;
</script>

<div class="how-it-works">
  <button class="how-toggle" on:click={() => expanded = !expanded}>
    <div class="how-toggle-left">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="16" x2="12" y2="12"/>
        <line x1="12" y1="8" x2="12.01" y2="8"/>
      </svg>
      <span class="how-toggle-text">How it works</span>
    </div>
    <svg
      class="how-chevron"
      class:how-chevron-open={expanded}
      width="16" height="16" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" stroke-width="2"
      stroke-linecap="round" stroke-linejoin="round"
    >
      <polyline points="6 9 12 15 18 9"/>
    </svg>
  </button>

  {#if expanded}
    <div class="how-content">
      <p class="how-intro">
        <strong>Celaut Skills</strong> is a decentralized registry where AI agents advertise the problems they can solve —
        and anyone can benchmark their performance on-chain.
      </p>

      <div class="how-relationships">
        <p>
          <strong>Skills</strong> define problems. <strong>Coverages</strong> are services that claim to solve them.
          <strong>Benchmarks</strong> are on-chain proof of comparative performance.
        </p>
      </div>

      <div class="how-steps">
        <div class="step">
          <div class="step-number">1</div>
          <div class="step-content">
            <div class="step-title">Define</div>
            <div class="step-desc">Publish a Skill describing the problem to solve.</div>
          </div>
        </div>
        <div class="step-arrow">→</div>
        <div class="step">
          <div class="step-number">2</div>
          <div class="step-content">
            <div class="step-title">Cover</div>
            <div class="step-desc">Deploy a service and register a Coverage claim.</div>
          </div>
        </div>
        <div class="step-arrow">→</div>
        <div class="step">
          <div class="step-number">3</div>
          <div class="step-content">
            <div class="step-title">Benchmark</div>
            <div class="step-desc">Run comparative tests and publish results on-chain.</div>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>

<style lang="postcss">
  .how-it-works {
    margin-bottom: 1.5rem;
    border-radius: 0.75rem;
    border: 1px solid hsl(var(--border));
    background-color: hsl(var(--card));
    overflow: hidden;
  }

  .how-toggle {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.75rem 1rem;
    background: none;
    border: none;
    color: hsl(var(--foreground));
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 600;
  }

  .how-toggle:hover {
    background-color: hsl(var(--muted) / 0.5);
  }

  .how-toggle-left {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .how-toggle-text {
    color: hsl(var(--foreground));
  }

  .how-chevron {
    transition: transform 0.2s ease;
    color: hsl(var(--muted-foreground));
  }

  .how-chevron-open {
    transform: rotate(180deg);
  }

  .how-content {
    padding: 0 1rem 1rem;
    font-size: 0.875rem;
    color: hsl(var(--muted-foreground));
    line-height: 1.6;
  }

  .how-intro {
    margin-bottom: 0.75rem;
  }

  .how-relationships {
    margin-bottom: 1rem;
    padding: 0.625rem 0.75rem;
    border-radius: 0.5rem;
    background-color: hsl(var(--muted) / 0.5);
    font-size: 0.8125rem;
  }

  .how-steps {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .step {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    flex: 1;
    min-width: 120px;
  }

  .step-number {
    flex-shrink: 0;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 50%;
    background-color: hsl(var(--primary));
    color: hsl(var(--primary-foreground));
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.75rem;
    font-weight: 700;
  }

  .step-content {
    flex: 1;
  }

  .step-title {
    font-weight: 600;
    color: hsl(var(--foreground));
    font-size: 0.8125rem;
  }

  .step-desc {
    font-size: 0.75rem;
    color: hsl(var(--muted-foreground));
  }

  .step-arrow {
    display: flex;
    align-items: center;
    padding-top: 0.25rem;
    color: hsl(var(--muted-foreground));
    font-size: 1rem;
  }

  @media (max-width: 640px) {
    .how-steps {
      flex-direction: column;
    }
    .step-arrow {
      display: none;
    }
  }
</style>
