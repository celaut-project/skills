<script lang="ts">
  import "katex/dist/katex.min.css";
  import { scoreDocHtml } from "$lib/renderScoreDoc";

  // Lower container has two tabs: the formal scoring spec and a plain-English FAQ.
  type LearnTab = "scoring" | "faq";
  let activeTab: LearnTab = "scoring";

  // FAQ content (English — the whole site is English). Each answer is an array
  // of paragraphs so it renders without {@html}.
  const faqs: { q: string; a: string[] }[] = [
    {
      q: "What is Unstoppable Skills?",
      a: [
        "Unstoppable Skills separates the what from the how. A Skill is a pure declarative contract — what problem it solves, the expected inputs and outputs, and the success criteria or benchmarks that define “done”. It contains no code.",
        "A Service is a sealed, fully reproducible virtual machine that actually solves the skill: an exact OS, dependencies, model, scripts, API, architecture and filesystem frozen together as a trustworthy long-term black box. By default it connects to no network — your Celaut Node decides what it can reach.",
        "Benchmarks and on-chain results turn that into transparent reputation: anyone can run the verifiable tests, and users simply pick the service with the best track record."
      ]
    },
    {
      q: "Why are the results verifiable?",
      a: [
        "Because a Service's specification is completely closed. It doesn't depend on external sources or repository downloads that rot over time — it ships everything it was tested with.",
        "A Service runs identically today as it will in four years, so any benchmark result recorded on-chain can always be reproduced."
      ]
    },
    {
      q: "What problems does it solve?",
      a: [
        "Four recurring ones: version dependency and drift (scripts that break when a dependency changes), ambiguous interpretation (different LLMs read the same natural-language instructions differently), the difficulty of objectively comparing alternatives, and the long-term fragility of solutions that quietly stop working."
      ]
    },
    {
      q: "How do I choose between services?",
      a: [
        "By reputation. Each Service accrues reputation from on-chain, verified benchmark results — real evidence rather than promises. The service with the strongest track record on the benchmarks you care about is the one to pick."
      ]
    },
    {
      q: "Can I create my own Services?",
      a: [
        "Yes. Anyone can publish a Service (a VM) that covers an existing Skill and compete on performance, cost, speed and quality. The best service rises on the leaderboard."
      ]
    },
    {
      q: "Are Services paid?",
      a: [
        "Optionally, yes. Payment is handled by external methods (for example NiPoPoW-based or other payment systems) and is entirely outside the Unstoppable Skills platform itself."
      ]
    },
    {
      q: "Is it decentralized?",
      a: [
        "Yes. Skills, Services and benchmark results are all stored immutably on the Ergo Blockchain."
      ]
    },
    {
      q: "What's the main advantage?",
      a: [
        "Guaranteed reproducibility plus real competition on verifiable results instead of marketing claims. You choose tools by what they have provably done, not by what they say they can do."
      ]
    }
  ];
</script>

<!-- ── Card 1: How it works ─────────────────────────────────────────────────── -->
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
        <strong>Skills</strong> define <em>what</em> to solve. <strong>Services</strong> are Virtual Machines (VMs) that solve them their own way.
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
      <div class="diagram-caption">each a sealed VM — services covering the same skill</div>
      <div class="diagram-bench">⭐ Benchmarks &amp; Results — the community scores every service</div>
    </div>

    <!-- Marketplace loop -->
    <div class="how-steps">
      <div class="step">
        <div class="step-number">1</div>
        <div class="step-content">
          <div class="step-title">Define</div>
          <div class="step-desc">Publish a Skill — a declarative spec of the problem: inputs, outputs, success criteria. No implementation.</div>
        </div>
      </div>
      <div class="step-arrow">&rarr;</div>
      <div class="step">
        <div class="step-number">2</div>
        <div class="step-content">
          <div class="step-title">Cover</div>
          <div class="step-desc">Build a service: a sealed VM that ships the exact OS, dependencies, and model it was tested with.</div>
        </div>
      </div>
      <div class="step-arrow">&rarr;</div>
      <div class="step">
        <div class="step-number">3</div>
        <div class="step-content">
          <div class="step-title">Benchmark</div>
          <div class="step-desc">Anyone can run a benchmark against any service and submit results on-chain — transparent, verifiable proof.</div>
        </div>
      </div>
      <div class="step-arrow">&rarr;</div>
      <div class="step">
        <div class="step-number">4</div>
        <div class="step-content">
          <div class="step-title">Choose</div>
          <div class="step-desc">Results accumulate into on-chain reputation. Users pick the service with the strongest verified track record.</div>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- ── Card 2: Scoring system + FAQ (separate white card, tabbed) ───────────── -->
<div class="learn-more">
  <div class="learn-tabs" role="tablist" aria-label="Learn more">
    <button
      class="learn-tab"
      class:active={activeTab === "scoring"}
      role="tab"
      aria-selected={activeTab === "scoring"}
      on:click={() => (activeTab = "scoring")}
    >
      Scoring System
    </button>
    <button
      class="learn-tab"
      class:active={activeTab === "faq"}
      role="tab"
      aria-selected={activeTab === "faq"}
      on:click={() => (activeTab = "faq")}
    >
      FAQ
    </button>
  </div>

  {#if activeTab === "scoring"}
    <section class="score-doc">
      <div class="score-doc-head">
        <span class="contrast-label">Scoring system</span>
        <p class="score-doc-sub">The full multi-criteria scoring specification that ranks every service.</p>
      </div>
      <!-- eslint-disable-next-line svelte/no-at-html-tags -- trusted in-repo doc (SCORE.md), math pre-rendered with KaTeX -->
      <div class="score-doc-body">{@html scoreDocHtml}</div>
    </section>
  {:else}
    <section class="faq">
      <div class="faq-head">
        <span class="contrast-label">FAQ</span>
        <p class="faq-sub">The short version — what this is, why it's trustworthy, and how to use it.</p>
      </div>
      <div class="faq-list">
        {#each faqs as item}
          <details class="faq-item">
            <summary class="faq-q">{item.q}</summary>
            <div class="faq-a">
              {#each item.a as para}
                <p>{para}</p>
              {/each}
            </div>
          </details>
        {/each}
      </div>
    </section>
  {/if}
</div>

<!-- ── Demo-mode CTA: explore the app populated with example data ───────────── -->
<div class="how-demo-cta">
  <a href="?env=dev" class="demo-cta-link">See it with example data &rarr;</a>
  <span class="demo-cta-note">Loads the gallery in demo mode with sample skills, services and benchmark results — no wallet needed.</span>
</div>

<style lang="postcss">
  .how-it-works {
    margin-bottom: 1.5rem;
    border-radius: 0.75rem;
    border: 1px solid hsl(var(--border));
    background-color: hsl(var(--card));
    overflow: hidden;
  }

  /* Page header — centered, matching the unified header treatment used across
     the Gallery / Submit / Profile tabs (icon sits to the side of the title). */
  .how-header {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.625rem;
    padding: 1.5rem 1.25rem 0.75rem;
  }

  .how-header-icon {
    display: flex;
    align-items: center;
    color: hsl(var(--muted-foreground));
  }

  .how-title {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 800;
    color: hsl(var(--foreground));
    letter-spacing: -0.02em;
  }

  @media (min-width: 768px) {
    .how-title {
      font-size: 1.875rem;
    }
  }

  .how-content {
    padding: 0.5rem 1.25rem 1.5rem;
    /* Comfortable, readable body: a touch larger than 0.875rem with a higher
       line-height and stronger contrast than plain muted text. */
    font-size: 0.9375rem;
    color: hsl(var(--foreground) / 0.78);
    line-height: 1.65;
    max-width: 68ch;
    margin: 0 auto;
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
    text-align: center;
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

  /* ── Card 2: Learn more (separate white card with tabs) ─────────────────── */
  .learn-more {
    margin-bottom: 1.5rem;
    border-radius: 0.75rem;
    border: 1px solid hsl(var(--border));
    background-color: hsl(var(--card));
    overflow: hidden;
  }

  .learn-tabs {
    display: flex;
    gap: 0.25rem;
    padding: 0.75rem 1.25rem 0;
    border-bottom: 1px solid hsl(var(--border));
  }

  .learn-tab {
    appearance: none;
    border: none;
    background: none;
    padding: 0.5rem 0.875rem;
    font-size: 0.8125rem;
    font-weight: 600;
    color: hsl(var(--muted-foreground));
    cursor: pointer;
    border-bottom: 2px solid transparent;
    margin-bottom: -1px;
    transition: color 0.15s, border-color 0.15s;
  }

  .learn-tab:hover {
    color: hsl(var(--foreground));
  }

  .learn-tab.active {
    color: hsl(var(--foreground));
    border-bottom-color: hsl(var(--foreground));
  }

  /* --- Scoring system doc (rendered SCORE.md) --- */
  .score-doc {
    padding: 1.25rem;
  }

  /* Item 3: heading/intro centered; body stays left-aligned for readability. */
  .score-doc-head {
    margin-bottom: 1.25rem;
    text-align: center;
  }

  .score-doc-sub {
    margin: 0.35rem 0 0;
    font-size: 0.8125rem;
    color: hsl(var(--muted-foreground));
  }

  .score-doc-body {
    max-width: 70ch;
    margin: 0 auto;
    font-size: 0.9rem;
    line-height: 1.7;
    /* KaTeX inherits currentColor, so formulas stay legible in light & dark. */
    color: hsl(var(--foreground) / 0.82);
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

  /* Tables can be wide — let them scroll horizontally rather than overflow. */
  .score-doc-body :global(table) {
    display: block;
    width: max-content;
    max-width: 100%;
    overflow-x: auto;
    border-collapse: collapse;
    font-size: 0.85em;
    margin: 0.75rem 0;
  }

  .score-doc-body :global(th),
  .score-doc-body :global(td) {
    border: 1px solid hsl(var(--border));
    padding: 0.35rem 0.55rem;
    text-align: left;
  }

  /* --- FAQ --- */
  .faq {
    padding: 1.25rem;
  }

  .faq-head {
    margin-bottom: 1.25rem;
    text-align: center;
  }

  .faq-sub {
    margin: 0.35rem 0 0;
    font-size: 0.8125rem;
    color: hsl(var(--muted-foreground));
  }

  .faq-list {
    max-width: 70ch;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .faq-item {
    border: 1px solid hsl(var(--border));
    border-radius: 0.5rem;
    background-color: hsl(var(--muted) / 0.25);
    overflow: hidden;
  }

  .faq-q {
    cursor: pointer;
    list-style: none;
    padding: 0.75rem 0.875rem;
    font-size: 0.875rem;
    font-weight: 600;
    color: hsl(var(--foreground));
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .faq-q::-webkit-details-marker {
    display: none;
  }

  .faq-q::before {
    content: "+";
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.1rem;
    height: 1.1rem;
    flex-shrink: 0;
    font-weight: 700;
    color: hsl(var(--muted-foreground));
  }

  .faq-item[open] .faq-q::before {
    content: "−";
  }

  .faq-a {
    padding: 0 0.875rem 0.875rem 2.375rem;
    font-size: 0.875rem;
    line-height: 1.65;
    color: hsl(var(--foreground) / 0.8);
  }

  .faq-a :global(p) {
    margin: 0 0 0.6rem;
  }

  .faq-a :global(p:last-child) {
    margin-bottom: 0;
  }

  /* --- Demo-mode CTA --- */
  .how-demo-cta {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.35rem;
    text-align: center;
    margin-bottom: 1.5rem;
    padding: 1.25rem;
    border-radius: 0.75rem;
    border: 1px dashed hsl(var(--border));
    background-color: hsl(var(--muted) / 0.2);
  }

  .demo-cta-link {
    font-size: 0.9375rem;
    font-weight: 700;
    color: hsl(var(--primary));
    text-decoration: none;
  }

  .demo-cta-link:hover {
    text-decoration: underline;
  }

  .demo-cta-note {
    font-size: 0.75rem;
    color: hsl(var(--muted-foreground));
    max-width: 42ch;
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
    .how-content {
      padding-left: 1rem;
      padding-right: 1rem;
    }
    .score-doc,
    .faq {
      padding: 1rem;
    }
  }
</style>
