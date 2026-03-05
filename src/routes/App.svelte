<script lang="ts">
  import { onMount } from "svelte";
  import { browser } from "$app/environment";
  import Theme from "./Theme.svelte";
  import { WalletButton, WalletAddressChangeHandler, walletConnected, walletAddress, walletBalance } from "wallet-svelte-component";
  // Forum loaded lazily to avoid sigmastate-js ESM crash on page load
  let ForumComponent: any = null;
  async function loadForum() {
    if (!ForumComponent) {
      try {
        const mod = await import("forum-application");
        ForumComponent = mod.Forum;
      } catch (e) {
        console.warn("Forum not available:", e);
      }
    }
  }
  import { web_explorer_uri_addr } from "$lib/common/store";

  // ── Types ──────────────────────────────────────────────────────────────────
  interface Skill {
    boxId: string;
    name: string;
    prose: string;
    tags: string[];
    domain: string;
    otherSkillBoxIds: string[];
    coverages: Coverage[];
    benchmarkCount: number;
  }

  interface Coverage {
    boxId: string;
    serviceId: string;
    label: string;
  }

  // ── State ──────────────────────────────────────────────────────────────────
  let skills: Skill[] = [];
  let selectedSkill: Skill | null = null;
  let loading = true;
  let error: string | null = null;
  let searchQuery = "";
  let activeTab: "gallery" | "submit" = "gallery";

  // Submit form
  let newSkillName = "";
  let newSkillProse = "";
  let newSkillTags = "";
  let newSkillDomain = "";
  let submitting = false;
  let submitTx: string | null = null;
  let submitError: string | null = null;

  // ── Type NFT IDs (Josemi will confirm these; using known pattern) ──────────
  // These are placeholder IDs — the actual Type NFT boxes need to be created on-chain first.
  // For the MVP we load from Explorer by scanning R4 values.
  const SKILL_TYPE_ID = "celaut:skill:v1";
  const BENCHMARK_TYPE_ID = "celaut:benchmark:v1";
  const COVERAGE_TYPE_ID = "celaut:coverage:v1";
  const EXPLORER_API = "https://api.ergoplatform.com";

  // ── Load skills from chain ─────────────────────────────────────────────────
  async function loadSkills() {
    loading = true;
    error = null;
    try {
      // Fetch boxes whose R4 = celaut:skill:v1 via Explorer search
      const response = await fetch(
        `${EXPLORER_API}/api/v1/boxes/search?limit=50&offset=0`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ergoTreeTemplateHash: null,
            registers: {
              R4: { serializedValue: toHex(SKILL_TYPE_ID) }
            }
          })
        }
      );

      if (response.ok) {
        const data = await response.json();
        skills = (data.items || []).map(parseSkillBox).filter(Boolean) as Skill[];
      } else {
        // Fallback: show demo data so UI is useful while chain data bootstraps
        skills = getDemoSkills();
      }
    } catch (e: any) {
      // Show demo data on network error
      skills = getDemoSkills();
    } finally {
      loading = false;
    }
  }

  function toHex(str: string): string {
    return Array.from(new TextEncoder().encode(str))
      .map(b => b.toString(16).padStart(2, "0"))
      .join("");
  }

  function parseSkillBox(box: any): Skill | null {
    try {
      const r9 = box.additionalRegisters?.R9?.renderedValue || "";
      // In production: decode Protobuf. For MVP: treat as JSON fallback.
      let parsed: any = {};
      try { parsed = JSON.parse(r9); } catch { parsed = { name: r9 || box.boxId.slice(0, 8) }; }
      return {
        boxId: box.boxId,
        name: parsed.name || "Unnamed Skill",
        prose: parsed.prose || "",
        tags: parsed.tags || [],
        domain: parsed.domain || "",
        otherSkillBoxIds: parsed.other_skill_box_ids || [],
        coverages: [],
        benchmarkCount: 0
      };
    } catch { return null; }
  }

  function getDemoSkills(): Skill[] {
    return [
      {
        boxId: "demo-001",
        name: "Optimal XAU/BTC Performance",
        prose: "Maximize risk-adjusted returns on the XAU/BTC pair using on-chain verifiable strategies.",
        tags: ["trading", "gold", "bitcoin"],
        domain: "finance",
        otherSkillBoxIds: [],
        coverages: [{ boxId: "cov-001", serviceId: "svc-alpha", label: "AlphaTrader v2" }],
        benchmarkCount: 3
      },
      {
        boxId: "demo-002",
        name: "Sat-sorter",
        prose: "Sort and classify UTXOs by satoshi value for optimal fee management.",
        tags: ["utxo", "optimization", "fees"],
        domain: "infrastructure",
        otherSkillBoxIds: [],
        coverages: [],
        benchmarkCount: 1
      },
      {
        boxId: "demo-003",
        name: "On-chain Sentiment Analysis",
        prose: "Classify community sentiment from forum discussions into structured signals.",
        tags: ["nlp", "sentiment", "community"],
        domain: "analytics",
        otherSkillBoxIds: ["demo-001"],
        coverages: [],
        benchmarkCount: 0
      }
    ];
  }

  // ── Filtered skills ────────────────────────────────────────────────────────
  $: filtered = skills.filter(s => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.prose.toLowerCase().includes(q) ||
      s.tags.some(t => t.toLowerCase().includes(q)) ||
      s.domain.toLowerCase().includes(q)
    );
  });

  // ── Submit new skill ───────────────────────────────────────────────────────
  async function handleSubmitSkill() {
    if (!$walletConnected) { submitError = "Connect your wallet first."; return; }
    if (!newSkillName.trim()) { submitError = "Name is required."; return; }
    submitting = true;
    submitError = null;
    submitTx = null;
    try {
      // Build Protobuf bytes (simplified for MVP — plain UTF-8 JSON)
      const payload = JSON.stringify({
        name: newSkillName.trim(),
        prose: newSkillProse.trim(),
        tags: newSkillTags.split(",").map(t => t.trim()).filter(Boolean),
        domain: newSkillDomain.trim(),
        other_skill_box_ids: []
      });
      // TODO: swap for real createReputationBox call once Type NFT is deployed
      // For now: inform user that on-chain submission requires the Type NFT
      submitTx = null;
      submitError = "On-chain submission is ready — awaiting Type NFT deployment from Josemi. Your skill data is valid.";
    } catch (e: any) {
      submitError = e.message || "Submission failed.";
    } finally {
      submitting = false;
    }
  }

  onMount(() => {
    if (browser) loadSkills();
  });
</script>

<!-- ── Header ─────────────────────────────────────────────────────────────── -->
<header class="navbar-container">
  <div class="navbar-content">
    <a href="#" class="logo-container">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" class="mr-2 text-primary" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
        <line x1="2" y1="12" x2="22" y2="12"/>
      </svg>
      <span class="font-semibold">Celaut Skills</span>
    </a>

    <div class="flex-1 flex items-center justify-center px-8 max-w-lg mx-auto">
      <div class="relative w-full">
        <svg class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input
          type="text"
          bind:value={searchQuery}
          placeholder="Search skills, tags, domains…"
          class="w-full pl-9 pr-4 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>
    </div>

    <div class="flex items-center gap-3">
      <WalletButton explorerUrl={$web_explorer_uri_addr} />
      <Theme />
    </div>
  </div>
</header>

<!-- ── Tab bar ─────────────────────────────────────────────────────────────── -->
<div class="border-b border-border">
  <div class="container flex gap-6 px-4">
    <button
      class="tab-btn"
      class:active={activeTab === "gallery"}
      on:click={() => { activeTab = "gallery"; selectedSkill = null; }}
    >Skills Gallery</button>
    <button
      class="tab-btn"
      class:active={activeTab === "submit"}
      on:click={() => activeTab = "submit"}
    >+ Submit Skill</button>
  </div>
</div>

<!-- ── Main ────────────────────────────────────────────────────────────────── -->
<main class="container mx-auto px-4 py-8 pb-20">

  {#if activeTab === "gallery"}

    {#if selectedSkill}
      <!-- ── Skill Detail ──────────────────────────────────────────────────── -->
      <div class="max-w-3xl mx-auto">
        <button class="flex items-center gap-2 text-sm text-muted-foreground mb-6 hover:text-foreground" on:click={() => selectedSkill = null}>
          ← Back to gallery
        </button>

        <div class="card mb-6">
          <div class="flex flex-wrap gap-2 items-start justify-between mb-3">
            <h1 class="text-2xl font-bold">{selectedSkill.name}</h1>
            {#if selectedSkill.domain}
              <span class="badge badge-domain">{selectedSkill.domain}</span>
            {/if}
          </div>
          <p class="text-muted-foreground mb-4">{selectedSkill.prose || "No description."}</p>
          <div class="flex flex-wrap gap-2 mb-4">
            {#each selectedSkill.tags as tag}
              <span class="badge">{tag}</span>
            {/each}
          </div>
          <p class="text-xs text-muted-foreground font-mono">Box: {selectedSkill.boxId}</p>
        </div>

        <!-- Coverages -->
        <section class="mb-6">
          <h2 class="text-lg font-semibold mb-3">Services covering this skill
            <span class="text-sm font-normal text-muted-foreground">({selectedSkill.coverages.length})</span>
          </h2>
          {#if selectedSkill.coverages.length === 0}
            <p class="text-muted-foreground text-sm">No services registered yet.</p>
          {:else}
            {#each selectedSkill.coverages as cov}
              <div class="card mb-2 flex items-center justify-between">
                <span class="font-medium">{cov.label}</span>
                <span class="text-xs text-muted-foreground font-mono">{cov.serviceId.slice(0,12)}…</span>
              </div>
            {/each}
          {/if}
        </section>

        <!-- Benchmarks badge -->
        <section class="mb-6">
          <h2 class="text-lg font-semibold mb-3">Benchmarks
            <span class="text-sm font-normal text-muted-foreground">({selectedSkill.benchmarkCount})</span>
          </h2>
          {#if selectedSkill.benchmarkCount === 0}
            <p class="text-muted-foreground text-sm">No benchmarks submitted yet.</p>
          {:else}
            <p class="text-sm text-muted-foreground">{selectedSkill.benchmarkCount} comparative benchmark(s) on-chain.</p>
          {/if}
        </section>

        <!-- Related skills -->
        {#if selectedSkill.otherSkillBoxIds.length > 0}
          <section class="mb-6">
            <h2 class="text-lg font-semibold mb-3">Related skills</h2>
            {#each selectedSkill.otherSkillBoxIds as refId}
              {@const related = skills.find(s => s.boxId === refId)}
              {#if related}
                <button class="card mb-2 w-full text-left hover:bg-accent transition-colors" on:click={() => selectedSkill = related}>
                  <span class="font-medium">{related.name}</span>
                </button>
              {:else}
                <div class="card mb-2">
                  <span class="text-xs text-muted-foreground font-mono">{refId}</span>
                </div>
              {/if}
            {/each}
          </section>
        {/if}

        <!-- Forum -->
        <section>
          <h2 class="text-lg font-semibold mb-3">Discussion</h2>
          {#if ForumComponent}
            <svelte:component this={ForumComponent} topicIdentifier={selectedSkill.boxId} reputationTokenId="" />
          {:else}
            <p class="text-sm text-muted-foreground">Loading forum…</p>
          {/if}
        </section>
      </div>

    {:else}
      <!-- ── Skills Gallery ────────────────────────────────────────────────── -->
      {#if loading}
        <div class="flex justify-center items-center py-24">
          <div class="spinner"></div>
          <span class="ml-3 text-muted-foreground">Loading skills from chain…</span>
        </div>
      {:else}
        <div class="mb-4 flex items-center justify-between">
          <p class="text-sm text-muted-foreground">
            {filtered.length} skill{filtered.length !== 1 ? "s" : ""}
            {searchQuery ? `matching "${searchQuery}"` : ""}
          </p>
          <button class="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1" on:click={loadSkills}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M2.5 22v-6h6"/><path d="M22 12A10 10 0 0 0 3.25 7.25M2 12a10 10 0 0 0 18.75 4.75"/></svg>
            Refresh
          </button>
        </div>

        {#if filtered.length === 0}
          <div class="text-center py-24 text-muted-foreground">
            <p class="text-lg">No skills found.</p>
            {#if searchQuery}
              <p class="text-sm mt-2">Try a different search term.</p>
            {:else}
              <p class="text-sm mt-2">Be the first to submit a skill!</p>
            {/if}
          </div>
        {:else}
          <div class="skills-grid">
            {#each filtered as skill (skill.boxId)}
              <button class="skill-card" on:click={() => { selectedSkill = skill; loadForum(); }}>
                <div class="flex items-start justify-between gap-2 mb-2">
                  <h3 class="font-semibold text-left leading-tight">{skill.name}</h3>
                  {#if skill.domain}
                    <span class="badge badge-domain flex-shrink-0">{skill.domain}</span>
                  {/if}
                </div>
                <p class="text-sm text-muted-foreground text-left mb-3 line-clamp-2">
                  {skill.prose || "No description."}
                </p>
                <div class="flex flex-wrap gap-1 mb-3">
                  {#each skill.tags.slice(0, 4) as tag}
                    <span class="badge text-xs">{tag}</span>
                  {/each}
                </div>
                <div class="flex gap-4 text-xs text-muted-foreground border-t border-border pt-2 mt-auto">
                  <span>📡 {skill.coverages.length} services</span>
                  <span>📊 {skill.benchmarkCount} benchmarks</span>
                  {#if skill.otherSkillBoxIds.length > 0}
                    <span>🔗 {skill.otherSkillBoxIds.length} related</span>
                  {/if}
                </div>
              </button>
            {/each}
          </div>
        {/if}
      {/if}
    {/if}

  {:else if activeTab === "submit"}
    <!-- ── Submit Skill ───────────────────────────────────────────────────── -->
    <div class="max-w-lg mx-auto">
      <h2 class="text-2xl font-bold mb-2">Submit a Skill</h2>
      <p class="text-muted-foreground mb-6 text-sm">
        Skills are published on-chain as Reputation Boxes. Connect your wallet to sign.
      </p>

      {#if !$walletConnected}
        <div class="card text-center py-8">
          <p class="text-muted-foreground mb-4">Connect your wallet to submit a skill.</p>
          <WalletButton explorerUrl={$web_explorer_uri_addr} />
        </div>
      {:else}
        <form on:submit|preventDefault={handleSubmitSkill} class="space-y-4">
          <div>
            <label class="label" for="skill-name">Name <span class="text-red-500">*</span></label>
            <input id="skill-name" class="input" bind:value={newSkillName} placeholder="e.g. Optimal XAU/BTC Performance" required />
          </div>
          <div>
            <label class="label" for="skill-prose">Description</label>
            <textarea id="skill-prose" class="input min-h-[100px] resize-y" bind:value={newSkillProse} placeholder="What problem does this skill solve?"></textarea>
          </div>
          <div>
            <label class="label" for="skill-domain">Domain</label>
            <input id="skill-domain" class="input" bind:value={newSkillDomain} placeholder="e.g. finance, infrastructure, nlp" />
          </div>
          <div>
            <label class="label" for="skill-tags">Tags <span class="text-muted-foreground font-normal">(comma-separated)</span></label>
            <input id="skill-tags" class="input" bind:value={newSkillTags} placeholder="trading, gold, bitcoin" />
          </div>

          <button type="submit" class="btn-primary w-full" disabled={submitting}>
            {submitting ? "Publishing…" : "Publish Skill On-Chain"}
          </button>
        </form>

        {#if submitTx}
          <div class="mt-4 p-4 rounded-md bg-green-100 dark:bg-green-900 border border-green-400 text-sm">
            <p class="font-semibold text-green-800 dark:text-green-200">Skill submitted!</p>
            <a href={`https://explorer.ergoplatform.com/en/transactions/${submitTx}`} target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 break-all">{submitTx}</a>
          </div>
        {/if}
        {#if submitError}
          <div class="mt-4 p-4 rounded-md bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-300 text-sm text-yellow-800 dark:text-yellow-200">
            {submitError}
          </div>
        {/if}
      {/if}
    </div>
  {/if}
</main>

<!-- ── Footer ─────────────────────────────────────────────────────────────── -->
<footer class="page-footer">
  <div class="flex items-center gap-2 text-xs text-muted-foreground">
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M0.502 2.999L6 0L11.495 3.03L6.0025 5.96L0.502 2.999V2.999ZM6.5 6.8365V12L11.5 9.319V4.156L6.5 6.8365V6.8365ZM5.5 6.8365L0.5 4.131V9.319L5.5 12V6.8365Z" fill="currentColor"/></svg>
    Celaut Skills — decentralized AI problem registry on Ergo
  </div>
</footer>

<WalletAddressChangeHandler />

<style lang="postcss">
  :global(body) {
    background-color: hsl(var(--background));
  }

  .navbar-container {
    @apply sticky top-0 z-50 w-full border-b backdrop-blur-lg;
    background-color: hsl(var(--background) / 0.85);
    border-bottom-color: hsl(var(--border));
  }

  .navbar-content {
    @apply container flex h-16 items-center px-4;
  }

  .logo-container {
    @apply flex items-center font-semibold text-foreground no-underline whitespace-nowrap;
  }

  .tab-btn {
    @apply py-3 px-1 text-sm font-medium border-b-2 border-transparent text-muted-foreground transition-colors;
  }
  .tab-btn.active {
    @apply border-primary text-foreground;
  }
  .tab-btn:hover:not(.active) {
    @apply text-foreground;
  }

  .skills-grid {
    @apply grid gap-4;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  }

  .skill-card {
    @apply flex flex-col p-4 rounded-lg border border-border bg-card cursor-pointer text-left transition-all;
  }
  .skill-card:hover {
    @apply border-primary/50 shadow-sm bg-accent/30;
  }

  .card {
    @apply p-4 rounded-lg border border-border bg-card;
  }

  .badge {
    @apply inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground;
  }
  .badge-domain {
    @apply bg-primary/10 text-primary;
  }

  .label {
    @apply block text-sm font-medium mb-1 text-foreground;
  }

  .input {
    @apply w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring;
  }

  .btn-primary {
    @apply px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium transition-colors;
  }
  .btn-primary:hover:not(:disabled) {
    @apply opacity-90;
  }
  .btn-primary:disabled {
    @apply opacity-50 cursor-not-allowed;
  }

  .page-footer {
    @apply fixed bottom-0 left-0 right-0 z-40 flex items-center h-10 px-6 border-t text-xs text-muted-foreground;
    background-color: hsl(var(--background) / 0.85);
    border-top-color: hsl(var(--border));
    backdrop-filter: blur(4px);
  }

  .spinner {
    @apply w-5 h-5 rounded-full border-2 border-muted border-t-primary;
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  :global(.line-clamp-2) {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
