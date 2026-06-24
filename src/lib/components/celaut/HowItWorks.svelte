<script lang="ts">
  import "katex/dist/katex.min.css";
  import { scoreDocHtml } from "$lib/renderScoreDoc";
</script>

<div class="how-it-works">
  <header class="how-header">
    <div class="how-header-icon">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="16" x2="12" y2="12"/>
        <line x1="12" y1="8" x2="12.01" y2="8"/>
      </svg>
    </div>
    <h1 class="how-title">How it works</h1>
  </header>

  <div class="how-content">
    <p class="how-intro">
      <strong>Unstoppable Skills</strong> is a decentralized registry built on one idea:
      a <strong>Skill</strong> says <em>what</em> to solve — a <strong>service</strong> says <em>how</em>.
    </p>

    <!-- The contrast: this is the punchline -->
    <div class="how-contrast">
      <div class="contrast-card messy">
        <div class="contrast-head">
          <span class="contrast-label">Other skill repos</span>
        </div>
        <p class="contrast-line">A skill is a pile of natural-language instructions <span class="plus">+</span> scripts.</p>
        <div class="contrast-tags">
          <span class="tag">prompt text</span>
          <span class="tag">setup.sh</span>
          <span class="tag">deps?</span>
          <span class="tag">version?</span>
          <span class="tag">which model?</span>
        </div>
        <p class="contrast-foot warn">The AI has to interpret the <em>how</em>. Different model, different reading — and scripts break on version &amp; dependency drift.</p>
      </div>

      <div class="contrast-card clean">
        <div class="contrast-head">
          <span class="contrast-label">Here</span>
        </div>
        <p class="contrast-line">A skill is a clean spec of <em>what</em>. The <em>how</em> is sealed inside a service.</p>
        <div class="contrast-tags">
          <span class="tag solid">🖥 exact OS</span>
          <span class="tag solid">📦 deps</span>
          <span class="tag solid">🤖 model</span>
        </div>
        <p class="contrast-foot ok">Each service is a VM that ships everything it was tested with. Reproducible by construction.</p>
      </div>
    </div>

    <div class="how-relationships">
      <p>
        <strong>Skills</strong> define <em>what</em> to solve. <strong>Coverages</strong> are services (VMs) that solve them their own way.
        <strong>Benchmarks</strong> define how to measure. <strong>Results</strong> are on-chain proof — and feed each service's reputation.
      </p>
    </div>

    <!-- Layered diagram: one WHAT, many sealed HOWs, judged by the community -->
    <div class="how-diagram">
      <div class="diagram-skill">
        <span class="node-kind">SKILL</span>
        <span class="node-sub">what to solve</span>
      </div>
      <div class="diagram-fan">
        <span class="fan-line"></span><span class="fan-line"></span><span class="fan-line"></span>
      </div>
      <div class="diagram-services">
        <div class="service-box">
          <span class="service-title">Service</span>
          <span class="service-meta">🖥 📦 🤖</span>
        </div>
        <div class="service-box">
          <span class="service-title">Service</span>
          <span class="service-meta">🖥 📦 🤖</span>
        </div>
        <div class="service-box">
          <span class="service-title">Service</span>
          <span class="service-meta">🖥 📦 🤖</span>
        </div>
      </div>
      <div class="diagram-caption">each a sealed VM — coverages of the same skill</div>
      <div class="diagram-bench">⭐ Benchmarks &amp; Results — the community scores every coverage</div>
    </div>

    <!-- Marketplace loop -->
    <div class="how-steps">
      <div class="step">
        <div class="step-number">1</div>
        <div class="step-content">
          <div class="step-title">Define</div>
          <div class="step-desc">Publish a Skill describing what to solve — never how.</div>
        </div>
      </div>
      <div class="step-arrow">&rarr;</div>
      <div class="step">
        <div class="step-number">2</div>
        <div class="step-content">
          <div class="step-title">Cover</div>
          <div class="step-desc">Anyone ships a service (VM) that solves it, deps and all.</div>
        </div>
      </div>
      <div class="step-arrow">&rarr;</div>
      <div class="step">
        <div class="step-number">3</div>
        <div class="step-content">
          <div class="step-title">Benchmark</div>
          <div class="step-desc">Coverages submit Results and rank on the leaderboard.</div>
        </div>
      </div>
      <div class="step-arrow">&rarr;</div>
      <div class="step">
        <div class="step-number">4</div>
        <div class="step-content">
          <div class="step-title">Choose</div>
          <div class="step-desc">Reputation grows on-chain; the best coverage wins.</div>
        </div>
      </div>
    </div>

    <!-- ── Scoring system: full SCORE.md spec, Markdown + KaTeX math ──────────── -->
    <section class="score-doc">
      <div class="score-doc-head">
        <span class="contrast-label">Scoring system</span>
        <p class="score-doc-sub">The full multi-criteria scoring specification that ranks every coverage.</p>
      </div>
      <!-- eslint-disable-next-line svelte/no-at-html-tags -- trusted in-repo doc (SCORE.md), math pre-rendered with KaTeX -->
      <div class="score-doc-body">{@html scoreDocHtml}</div>
    </section>
  </div>
</div>

<style lang="postcss">
  .how-it-works {
    margin-bottom: 1.5rem;
    border-radius: 0.75rem;
    border: 1px solid hsl(var(--border));
    background-color: hsl(var(--card));
    overflow: hidden;
  }

  .how-header {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 1.25rem 1.25rem 0.5rem;
  }

  .how-header-icon {
    display: flex;
    align-items: center;
    color: hsl(var(--muted-foreground));
  }

  .how-title {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 700;
    color: hsl(var(--foreground));
    letter-spacing: -0.01em;
  }

  .how-content {
    padding: 0.5rem 1.25rem 1.25rem;
    font-size: 0.875rem;
    color: hsl(var(--muted-foreground));
    line-height: 1.6;
  }

  .how-intro {
    margin-bottom: 1rem;
  }

  .how-intro em {
    font-style: normal;
    font-weight: 600;
    color: hsl(var(--foreground));
  }

  /* --- Contrast cards --- */
  .how-contrast {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.75rem;
    margin-bottom: 1rem;
  }

  .contrast-card {
    border-radius: 0.5rem;
    border: 1px solid hsl(var(--border));
    padding: 0.75rem;
  }

  .contrast-card em {
    font-style: normal;
    font-weight: 600;
    color: hsl(var(--foreground));
  }

  .contrast-card.messy {
    background-color: hsl(var(--muted) / 0.4);
    border-style: dashed;
  }

  .contrast-card.clean {
    background-color: hsl(var(--muted) / 0.5);
  }

  .contrast-head {
    margin-bottom: 0.5rem;
  }

  .contrast-label {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: hsl(var(--muted-foreground));
  }

  .contrast-line {
    font-size: 0.8125rem;
    color: hsl(var(--foreground));
    margin-bottom: 0.5rem;
  }

  .plus {
    color: hsl(var(--muted-foreground));
    font-weight: 700;
  }

  .contrast-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    margin-bottom: 0.5rem;
  }

  .tag {
    font-size: 0.6875rem;
    padding: 0.1rem 0.4rem;
    border-radius: 0.3rem;
    border: 1px dashed hsl(var(--border));
    color: hsl(var(--muted-foreground));
    background-color: hsl(var(--background) / 0.4);
  }

  .tag.solid {
    border-style: solid;
    border-color: hsl(var(--foreground) / 0.25);
    color: hsl(var(--foreground));
    background-color: hsl(var(--background) / 0.6);
  }

  .contrast-foot {
    font-size: 0.75rem;
    margin: 0;
  }

  .contrast-foot.warn {
    color: hsl(var(--muted-foreground));
  }

  .contrast-foot.ok {
    color: hsl(var(--foreground));
  }

  /* --- Relationships line --- */
  .how-relationships {
    margin-bottom: 1rem;
    padding: 0.625rem 0.75rem;
    border-radius: 0.5rem;
    background-color: hsl(var(--muted) / 0.5);
    font-size: 0.8125rem;
  }

  .how-relationships em {
    font-style: normal;
    font-weight: 600;
    color: hsl(var(--foreground));
  }

  /* --- Layered diagram --- */
  .how-diagram {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.4rem;
    margin-bottom: 1.25rem;
    padding: 0.875rem;
    border-radius: 0.5rem;
    border: 1px solid hsl(var(--border));
  }

  .diagram-skill {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 0.4rem 1rem;
    border-radius: 0.5rem;
    background-color: hsl(var(--foreground));
    color: hsl(var(--background));
  }

  .node-kind {
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.05em;
  }

  .node-sub {
    font-size: 0.65rem;
    opacity: 0.8;
  }

  .diagram-fan {
    display: flex;
    gap: 2.5rem;
    height: 0.75rem;
  }

  .fan-line {
    width: 1px;
    height: 100%;
    background-color: hsl(var(--border));
  }

  .diagram-services {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
    justify-content: center;
  }

  .service-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.15rem;
    padding: 0.35rem 0.6rem;
    border-radius: 0.4rem;
    border: 1px solid hsl(var(--foreground) / 0.25);
    background-color: hsl(var(--background) / 0.6);
  }

  .service-title {
    font-size: 0.7rem;
    font-weight: 600;
    color: hsl(var(--foreground));
  }

  .service-meta {
    font-size: 0.7rem;
    letter-spacing: 0.1em;
  }

  .diagram-caption {
    font-size: 0.7rem;
    color: hsl(var(--muted-foreground));
  }

  .diagram-bench {
    margin-top: 0.25rem;
    font-size: 0.75rem;
    font-weight: 600;
    color: hsl(var(--foreground));
    text-align: center;
  }

  /* --- Steps --- */
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
    background-color: hsl(var(--foreground));
    color: hsl(var(--background));
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

  /* --- Scoring system doc (rendered SCORE.md) --- */
  .score-doc {
    margin-top: 1.5rem;
    padding-top: 1.25rem;
    border-top: 1px solid hsl(var(--border));
  }

  .score-doc-head {
    margin-bottom: 1rem;
  }

  .score-doc-sub {
    margin: 0.35rem 0 0;
    font-size: 0.8125rem;
    color: hsl(var(--muted-foreground));
  }

  .score-doc-body {
    max-width: 70ch;
    font-size: 0.875rem;
    line-height: 1.65;
    /* KaTeX inherits currentColor, so formulas stay legible in light & dark. */
    color: hsl(var(--muted-foreground));
    overflow-x: auto;
  }

  .score-doc-body :global(h1),
  .score-doc-body :global(h2),
  .score-doc-body :global(h3) {
    color: hsl(var(--foreground));
    font-weight: 700;
    line-height: 1.25;
    margin: 1.5rem 0 0.6rem;
  }

  .score-doc-body :global(h1) {
    font-size: 1.25rem;
    margin-top: 0;
  }

  .score-doc-body :global(h2) {
    font-size: 1.0625rem;
  }

  .score-doc-body :global(h3) {
    font-size: 0.9375rem;
  }

  .score-doc-body :global(p) {
    margin: 0.6rem 0;
  }

  .score-doc-body :global(strong) {
    color: hsl(var(--foreground));
    font-weight: 600;
  }

  .score-doc-body :global(ul),
  .score-doc-body :global(ol) {
    margin: 0.6rem 0;
    padding-left: 1.4rem;
    list-style: disc;
  }

  .score-doc-body :global(ol) {
    list-style: decimal;
  }

  .score-doc-body :global(li) {
    margin: 0.3rem 0;
  }

  .score-doc-body :global(li::marker) {
    color: hsl(var(--muted-foreground));
  }

  .score-doc-body :global(hr) {
    margin: 1.25rem 0;
    border: none;
    border-top: 1px solid hsl(var(--border));
  }

  .score-doc-body :global(code) {
    font-size: 0.85em;
    padding: 0.1rem 0.3rem;
    border-radius: 0.3rem;
    background-color: hsl(var(--muted) / 0.6);
    color: hsl(var(--foreground));
  }

  .score-doc-body :global(em) {
    color: hsl(var(--muted-foreground));
  }

  /* Block math: let long formulas scroll instead of overflowing the card. */
  .score-doc-body :global(.katex-display) {
    margin: 1rem 0;
    overflow-x: auto;
    overflow-y: hidden;
    padding: 0.25rem 0;
  }

  @media (max-width: 640px) {
    .how-contrast {
      grid-template-columns: 1fr;
    }
    .how-steps {
      flex-direction: column;
    }
    .step-arrow {
      display: none;
    }
  }
</style>
