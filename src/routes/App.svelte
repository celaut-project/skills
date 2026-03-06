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
  import HeroSection from "$lib/components/HeroSection.svelte";
  import SkillCard from "$lib/components/SkillCard.svelte";
  import SkeletonCard from "$lib/components/SkeletonCard.svelte";
  import FooterComponent from "$lib/components/Footer.svelte";

  // ── Feature expansion components ───────────────────────────────────────────
  import Toast from "$lib/components/celaut/Toast.svelte";
  import StatsBar from "$lib/components/celaut/StatsBar.svelte";
  import CategoryFilter from "$lib/components/celaut/CategoryFilter.svelte";
  import SortDropdown from "$lib/components/celaut/SortDropdown.svelte";
  import HowItWorks from "$lib/components/celaut/HowItWorks.svelte";
  import SkillLeaderboard from "$lib/components/celaut/SkillLeaderboard.svelte";
  import SkillMetadata from "$lib/components/celaut/SkillMetadata.svelte";
  import ClaimCoverageButton from "$lib/components/celaut/ClaimCoverageButton.svelte";
  import SubmitFormEnhancements from "$lib/components/celaut/SubmitFormEnhancements.svelte";
  import { toasts } from "$lib/components/celaut/toastStore";

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
  let detailVisible = false;

  // Feature expansion state
  let activeCategory = "all";
  let currentSort = "name";
  let validationErrors: Record<string, string> = {};
  let enhancementsRef: SubmitFormEnhancements;

  // Submit form
  let newSkillName = "";
  let newSkillProse = "";
  let newSkillTags = "";
  let newSkillDomain = "";
  let submitting = false;
  let submitTx: string | null = null;
  let submitError: string | null = null;

  // ── Type NFT IDs ──────────────────────────────────────────────────────────
  const SKILL_TYPE_ID = "celaut:skill:v1";
  const BENCHMARK_TYPE_ID = "celaut:benchmark:v1";
  const COVERAGE_TYPE_ID = "celaut:coverage:v1";
  const EXPLORER_API = "https://api.ergoplatform.com";

  // ── Load skills from chain ─────────────────────────────────────────────────
  async function loadSkills() {
    loading = true;
    error = null;
    try {
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
        skills = getDemoSkills();
      }
    } catch (e: any) {
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

  // ── Category + Sort pipeline ───────────────────────────────────────────────
  function filterByCategory(list: Skill[], category: string): Skill[] {
    if (category === "all") return list;
    return list.filter(s => s.domain.toLowerCase() === category.toLowerCase());
  }

  function sortSkills(list: Skill[], sort: string): Skill[] {
    const sorted = [...list];
    switch (sort) {
      case "name": return sorted.sort((a, b) => a.name.localeCompare(b.name));
      case "services": return sorted.sort((a, b) => b.coverages.length - a.coverages.length);
      case "benchmarks": return sorted.sort((a, b) => b.benchmarkCount - a.benchmarkCount);
      case "newest": return sorted.reverse();
      default: return sorted;
    }
  }

  $: displayedSkills = sortSkills(filterByCategory(filtered, activeCategory), currentSort);
  $: totalServices = skills.reduce((sum, s) => sum + s.coverages.length, 0);
  $: totalBenchmarks = skills.reduce((sum, s) => sum + s.benchmarkCount, 0);

  // ── Select skill with transition ───────────────────────────────────────────
  function selectSkill(skill: Skill) {
    detailVisible = false;
    selectedSkill = skill;
    loadForum();
    setTimeout(() => { detailVisible = true; }, 50);
    // Scroll to top
    if (browser) window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function backToGallery() {
    detailVisible = false;
    setTimeout(() => { selectedSkill = null; }, 200);
  }

  // ── Submit new skill ───────────────────────────────────────────────────────
  async function handleSubmitSkill() {
    // Run validation
    if (enhancementsRef) {
      validationErrors = enhancementsRef.validate();
      if (Object.keys(validationErrors).length > 0) {
        toasts.error("Please fix the form errors before submitting.");
        return;
      }
    }
    if (!$walletConnected) { submitError = "Connect your wallet first."; toasts.error("Connect your wallet first."); return; }
    if (!newSkillName.trim()) { submitError = "Name is required."; validationErrors = { name: "Skill name is required." }; return; }
    submitting = true;
    submitError = null;
    submitTx = null;
    try {
      const payload = JSON.stringify({
        name: newSkillName.trim(),
        prose: newSkillProse.trim(),
        tags: newSkillTags.split(",").map(t => t.trim()).filter(Boolean),
        domain: newSkillDomain.trim(),
        other_skill_box_ids: []
      });
      submitTx = null;
      submitError = "On-chain submission is ready — awaiting Type NFT deployment from Josemi. Your skill data is valid.";
      toasts.info("Skill data validated. Awaiting Type NFT deployment.");
    } catch (e: any) {
      submitError = e.message || "Submission failed.";
      toasts.error(submitError || "Submission failed.");
    } finally {
      submitting = false;
    }
  }

  // Clear validation errors when fields change
  $: if (newSkillName) { delete validationErrors["name"]; validationErrors = validationErrors; }
  $: if (newSkillProse) { delete validationErrors["prose"]; validationErrors = validationErrors; }
  $: if (newSkillDomain) { delete validationErrors["domain"]; validationErrors = validationErrors; }

  function scrollToCards() {
    if (browser) {
      const el = document.getElementById('skills-section');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  }

  onMount(() => {
    if (browser) loadSkills();
  });
</script>

<!-- ── Header ─────────────────────────────────────────────────────────────── -->
<header class="navbar-container">
  <div class="navbar-content">
    <a href="/" class="logo-container" on:click|preventDefault={() => { activeTab = 'gallery'; selectedSkill = null; }}>
      <div class="logo-icon">
        <svg width="18" height="18" viewBox="0 0 12 12" fill="none">
          <path d="M0.502 2.999L6 0L11.495 3.03L6.0025 5.96L0.502 2.999V2.999ZM6.5 6.8365V12L11.5 9.319V4.156L6.5 6.8365V6.8365ZM5.5 6.8365L0.5 4.131V9.319L5.5 12V6.8365Z" fill="currentColor"/>
        </svg>
      </div>
      <span class="logo-text">Celaut Skills</span>
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
          class="search-input"
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
<div class="tab-bar">
  <div class="container flex gap-1 px-4">
    <button
      class="tab-btn"
      class:active={activeTab === "gallery"}
      on:click={() => { activeTab = "gallery"; selectedSkill = null; }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
      </svg>
      Skills Gallery
    </button>
    <button
      class="tab-btn"
      class:active={activeTab === "submit"}
      on:click={() => activeTab = "submit"}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
      </svg>
      Submit Skill
    </button>
  </div>
</div>

<!-- ── Main ────────────────────────────────────────────────────────────────── -->
<main class="main-content">

  {#if activeTab === "gallery"}

    {#if selectedSkill}
      <!-- ── Skill Detail ──────────────────────────────────────────────────── -->
      <div class="detail-view" class:detail-visible={detailVisible}>
        <div class="max-w-3xl mx-auto">
          <button class="back-button" on:click={backToGallery}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Back to gallery
          </button>

          <!-- Skill header card -->
          <div class="detail-card detail-header-card">
            <div class="flex flex-wrap gap-3 items-start justify-between mb-4">
              <h1 class="text-2xl md:text-3xl font-extrabold">{selectedSkill.name}</h1>
              {#if selectedSkill.domain}
                <span class="detail-domain-badge">{selectedSkill.domain}</span>
              {/if}
            </div>
            <p class="text-muted-foreground mb-5 leading-relaxed">{selectedSkill.prose || "No description."}</p>
            <div class="flex flex-wrap gap-2 mb-5">
              {#each selectedSkill.tags as tag}
                <span class="detail-tag">{tag}</span>
              {/each}
            </div>
            <div class="detail-box-id">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
              </svg>
              <span class="font-mono text-xs">{selectedSkill.boxId}</span>
            </div>
          </div>

          <!-- Skill Metadata -->
          <SkillMetadata skillBoxId={selectedSkill.boxId} />

          <!-- Claim Coverage Button -->
          <ClaimCoverageButton />

          <!-- Coverages -->
          <section class="detail-section">
            <div class="detail-section-header">
              <div class="detail-section-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
                </svg>
              </div>
              <h2 class="detail-section-title">Services Covering This Skill</h2>
              <span class="detail-count">{selectedSkill.coverages.length}</span>
            </div>
            {#if selectedSkill.coverages.length === 0}
              <div class="detail-empty">
                <p>No services registered yet. Be the first to cover this skill.</p>
              </div>
            {:else}
              <div class="space-y-2">
                {#each selectedSkill.coverages as cov}
                  <div class="detail-item">
                    <div class="detail-item-icon">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                      </svg>
                    </div>
                    <span class="font-medium">{cov.label}</span>
                    <span class="ml-auto text-xs text-muted-foreground font-mono">{cov.serviceId.slice(0,12)}…</span>
                  </div>
                {/each}
              </div>
            {/if}
          </section>

          <!-- Benchmark Leaderboard -->
          <SkillLeaderboard skillBoxId={selectedSkill.boxId} benchmarkCount={selectedSkill.benchmarkCount} />

          <!-- Benchmarks -->
          <section class="detail-section">
            <div class="detail-section-header">
              <div class="detail-section-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
                </svg>
              </div>
              <h2 class="detail-section-title">Benchmarks</h2>
              <span class="detail-count">{selectedSkill.benchmarkCount}</span>
            </div>
            {#if selectedSkill.benchmarkCount === 0}
              <div class="detail-empty">
                <p>No benchmarks submitted yet. Submit one to establish performance standards.</p>
              </div>
            {:else}
              <div class="detail-bench-stat">
                <span class="detail-bench-number">{selectedSkill.benchmarkCount}</span>
                <span class="text-sm text-muted-foreground">comparative benchmark{selectedSkill.benchmarkCount !== 1 ? 's' : ''} verified on-chain</span>
              </div>
            {/if}
          </section>

          <!-- Related skills -->
          {#if selectedSkill.otherSkillBoxIds.length > 0}
            <section class="detail-section">
              <div class="detail-section-header">
                <div class="detail-section-icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
                  </svg>
                </div>
                <h2 class="detail-section-title">Related Skills</h2>
                <span class="detail-count">{selectedSkill.otherSkillBoxIds.length}</span>
              </div>
              <div class="space-y-2">
                {#each selectedSkill.otherSkillBoxIds as refId}
                  {@const related = skills.find(s => s.boxId === refId)}
                  {#if related}
                    <button class="detail-related-btn" on:click={() => selectSkill(related)}>
                      <span class="font-medium">{related.name}</span>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <path d="M5 12h14M12 5l7 7-7 7"/>
                      </svg>
                    </button>
                  {:else}
                    <div class="detail-item">
                      <span class="text-xs text-muted-foreground font-mono">{refId}</span>
                    </div>
                  {/if}
                {/each}
              </div>
            </section>
          {/if}

          <!-- Forum -->
          <section class="detail-section">
            <div class="detail-section-header">
              <div class="detail-section-icon">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
              </div>
              <h2 class="detail-section-title">Discussion</h2>
            </div>
            {#if ForumComponent}
              <svelte:component this={ForumComponent} topicIdentifier={selectedSkill.boxId} reputationTokenId="" />
            {:else}
              <div class="detail-empty">
                <p>Loading forum…</p>
              </div>
            {/if}
          </section>
        </div>
      </div>

    {:else}
      <!-- ── Hero + Skills Gallery ─────────────────────────────────────────── -->
      <HeroSection skillCount={skills.length} onExplore={scrollToCards} />

      <div id="skills-section" class="container mx-auto px-4 pb-8">
        <!-- How It Works -->
        <HowItWorks />

        <!-- Stats Bar -->
        <StatsBar totalSkills={skills.length} {totalServices} {totalBenchmarks} />

        <!-- Category Filter -->
        <CategoryFilter {activeCategory} on:filter={(e) => { activeCategory = e.detail; }} />

        <div class="gallery-header">
          <div>
            <h2 class="gallery-title">
              {#if searchQuery}
                Search Results
              {:else}
                All Skills
              {/if}
            </h2>
            <p class="text-sm text-muted-foreground mt-0.5">
              {displayedSkills.length} skill{displayedSkills.length !== 1 ? "s" : ""}
              {searchQuery ? ` matching "${searchQuery}"` : ""}
              {activeCategory !== "all" ? ` in ${activeCategory}` : " registered on-chain"}
            </p>
          </div>
          <div class="flex items-center gap-3">
            <SortDropdown {currentSort} on:sort={(e) => { currentSort = e.detail; }} />
            <button class="refresh-btn" on:click={loadSkills}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M2.5 22v-6h6"/><path d="M22 12A10 10 0 0 0 3.25 7.25M2 12a10 10 0 0 0 18.75 4.75"/></svg>
              Refresh
            </button>
          </div>
        </div>

        {#if loading}
          <div class="skills-grid">
            {#each [0, 1, 2, 3, 4, 5] as i}
              <SkeletonCard index={i} />
            {/each}
          </div>
        {:else if displayedSkills.length === 0}
          <div class="empty-state">
            <div class="empty-state-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </div>
            <p class="text-lg font-semibold">No skills found</p>
            {#if searchQuery || activeCategory !== "all"}
              <p class="text-sm text-muted-foreground mt-1">Try a different search term or category.</p>
            {:else}
              <p class="text-sm text-muted-foreground mt-1">Be the first to submit a skill!</p>
            {/if}
          </div>
        {:else}
          <div class="skills-grid">
            {#each displayedSkills as skill, i (skill.boxId)}
              <SkillCard
                name={skill.name}
                prose={skill.prose}
                tags={skill.tags}
                domain={skill.domain}
                coverageCount={skill.coverages.length}
                benchmarkCount={skill.benchmarkCount}
                relatedCount={skill.otherSkillBoxIds.length}
                index={i}
                on:click={() => selectSkill(skill)}
              />
            {/each}
          </div>
        {/if}
      </div>
    {/if}

  {:else if activeTab === "submit"}
    <!-- ── Submit Skill ───────────────────────────────────────────────────── -->
    <div class="container mx-auto px-4 py-8">
      <div class="max-w-lg mx-auto">
        <div class="submit-header">
          <div class="submit-header-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
            </svg>
          </div>
          <h2 class="text-2xl font-extrabold mb-1">Submit a Skill</h2>
          <p class="text-muted-foreground text-sm">
            Skills are published on-chain as Reputation Boxes. Connect your wallet to sign.
          </p>
        </div>

        {#if !$walletConnected}
          <div class="submit-connect-card">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-muted-foreground mb-3">
              <rect x="2" y="6" width="20" height="12" rx="2"/><path d="M22 10H2"/><path d="M6 14h.01M10 14h.01"/>
            </svg>
            <p class="text-muted-foreground mb-4">Connect your wallet to submit a skill.</p>
            <WalletButton explorerUrl={$web_explorer_uri_addr} />
          </div>
        {:else}
          <form on:submit|preventDefault={handleSubmitSkill} class="submit-form">
            <div class="form-group">
              <label class="form-label" for="skill-name">Name <span class="text-red-500">*</span></label>
              <input id="skill-name" class="form-input" class:form-input-error={validationErrors["name"]} bind:value={newSkillName} placeholder="e.g. Optimal XAU/BTC Performance" required />
              {#if validationErrors["name"]}
                <p class="field-error-msg">{validationErrors["name"]}</p>
              {/if}
            </div>
            <div class="form-group">
              <label class="form-label" for="skill-prose">Description</label>
              <textarea id="skill-prose" class="form-input form-textarea" class:form-input-error={validationErrors["prose"]} bind:value={newSkillProse} placeholder="What problem does this skill solve?"></textarea>
              {#if validationErrors["prose"]}
                <p class="field-error-msg">{validationErrors["prose"]}</p>
              {/if}
            </div>
            <div class="form-group">
              <label class="form-label" for="skill-domain">Domain</label>
              <input id="skill-domain" class="form-input" class:form-input-error={validationErrors["domain"]} bind:value={newSkillDomain} placeholder="e.g. finance, infrastructure, nlp" />
              {#if validationErrors["domain"]}
                <p class="field-error-msg">{validationErrors["domain"]}</p>
              {/if}
            </div>
            <div class="form-group">
              <label class="form-label" for="skill-tags">Tags <span class="text-muted-foreground font-normal text-xs">(comma-separated)</span></label>
              <input id="skill-tags" class="form-input" bind:value={newSkillTags} placeholder="trading, gold, bitcoin" />
            </div>

            <!-- Enhanced form sections: Related Skills + Preview -->
            <SubmitFormEnhancements
              bind:this={enhancementsRef}
              {skills}
              name={newSkillName}
              prose={newSkillProse}
              domain={newSkillDomain}
              tags={newSkillTags}
              errors={validationErrors}
            />

            <button type="submit" class="submit-btn" disabled={submitting}>
              {#if submitting}
                <div class="submit-spinner"></div>
                Publishing…
              {:else}
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
                </svg>
                Publish Skill On-Chain
              {/if}
            </button>
          </form>

          {#if submitTx}
            <div class="submit-success">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
              <div>
                <p class="font-semibold">Skill submitted!</p>
                <a href={`https://explorer.ergoplatform.com/en/transactions/${submitTx}`} target="_blank" rel="noopener noreferrer" class="text-blue-500 break-all text-sm">{submitTx}</a>
              </div>
            </div>
          {/if}
          {#if submitError}
            <div class="submit-warning">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <span>{submitError}</span>
            </div>
          {/if}
        {/if}
      </div>
    </div>
  {/if}
</main>

<!-- ── Footer ─────────────────────────────────────────────────────────────── -->
<FooterComponent />

<!-- ── Toast Notifications ──────────────────────────────────────────────── -->
<Toast />

<WalletAddressChangeHandler />

<style lang="postcss">
  :global(body) {
    background-color: hsl(var(--background));
  }

  /* ── Navbar ─────────────────────────────────────────────────────────── */
  .navbar-container {
    @apply sticky top-0 z-50 w-full border-b;
    background-color: hsl(var(--background) / 0.8);
    border-bottom-color: hsl(var(--border));
    backdrop-filter: blur(16px) saturate(180%);
    -webkit-backdrop-filter: blur(16px) saturate(180%);
  }

  .navbar-content {
    @apply container flex h-16 items-center px-4;
  }

  .logo-container {
    @apply flex items-center gap-2.5 text-foreground no-underline whitespace-nowrap;
  }

  .logo-icon {
    @apply flex items-center justify-center w-8 h-8 rounded-lg;
    background: var(--gradient-primary);
    color: white;
  }

  .logo-text {
    @apply text-base font-bold tracking-tight;
    font-family: var(--font-heading);
  }

  .search-input {
    @apply w-full pl-9 pr-4 py-2 rounded-lg text-sm transition-all duration-200;
    background: hsl(var(--muted) / 0.5);
    border: 1px solid hsl(var(--border));
    color: hsl(var(--foreground));
  }
  .search-input::placeholder {
    color: hsl(var(--muted-foreground));
  }
  .search-input:focus {
    @apply outline-none;
    background: hsl(var(--background));
    border-color: hsl(var(--primary) / 0.5);
    box-shadow: 0 0 0 3px hsl(var(--primary) / 0.1);
  }

  /* ── Tab bar ────────────────────────────────────────────────────────── */
  .tab-bar {
    @apply border-b;
    border-bottom-color: hsl(var(--border));
    background-color: hsl(var(--background));
  }

  .tab-btn {
    @apply flex items-center gap-2 py-3 px-3 text-sm font-medium border-b-2 border-transparent text-muted-foreground transition-all duration-200 rounded-t-md;
  }
  .tab-btn.active {
    border-bottom-color: hsl(var(--primary));
    color: hsl(var(--primary));
  }
  .tab-btn:hover:not(.active) {
    @apply text-foreground;
    background: hsl(var(--muted) / 0.3);
  }

  /* ── Main content ───────────────────────────────────────────────────── */
  .main-content {
    @apply min-h-[60vh];
  }

  /* ── Gallery ────────────────────────────────────────────────────────── */
  .gallery-header {
    @apply flex items-end justify-between mb-6 pb-4 border-b;
    border-bottom-color: hsl(var(--border) / 0.5);
  }

  .gallery-title {
    @apply text-xl font-bold;
  }

  .refresh-btn {
    @apply flex items-center gap-1.5 text-sm text-muted-foreground px-3 py-1.5 rounded-lg transition-all duration-200;
  }
  .refresh-btn:hover {
    @apply text-foreground;
    background: hsl(var(--muted) / 0.5);
  }

  .skills-grid {
    @apply grid gap-5;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  }

  .empty-state {
    @apply text-center py-24 flex flex-col items-center;
  }

  .empty-state-icon {
    @apply flex items-center justify-center w-16 h-16 rounded-2xl mb-4 text-muted-foreground;
    background: hsl(var(--muted) / 0.5);
  }

  /* ── Detail view ────────────────────────────────────────────────────── */
  .detail-view {
    @apply container mx-auto px-4 py-8;
    opacity: 0;
    transform: translateX(12px);
    transition: opacity 0.4s ease, transform 0.4s ease;
  }

  .detail-visible {
    opacity: 1;
    transform: translateX(0);
  }

  .back-button {
    @apply flex items-center gap-2 text-sm text-muted-foreground mb-6 px-3 py-1.5 -ml-3 rounded-lg transition-all duration-200;
  }
  .back-button:hover {
    @apply text-foreground;
    background: hsl(var(--muted) / 0.5);
  }

  .detail-card {
    @apply rounded-xl border p-6 mb-6;
    background: var(--glass-bg);
    border-color: hsl(var(--border));
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }

  .detail-header-card {
    box-shadow: var(--glass-shadow);
  }

  .detail-domain-badge {
    @apply inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider;
    background: var(--gradient-primary);
    color: white;
  }

  .detail-tag {
    @apply px-3 py-1 rounded-lg text-xs font-medium;
    background: hsl(var(--muted));
    color: hsl(var(--muted-foreground));
  }

  .detail-box-id {
    @apply flex items-center gap-2 text-muted-foreground pt-4 mt-4;
    border-top: 1px solid hsl(var(--border) / 0.5);
  }

  .detail-section {
    @apply mb-8;
  }

  .detail-section-header {
    @apply flex items-center gap-3 mb-4 pb-3;
    border-bottom: 1px solid hsl(var(--border) / 0.5);
  }

  .detail-section-icon {
    @apply flex items-center justify-center w-8 h-8 rounded-lg text-primary;
    background: hsl(var(--primary) / 0.1);
  }

  .detail-section-title {
    @apply text-lg font-bold flex-1;
  }

  .detail-count {
    @apply inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-full text-xs font-bold;
    background: var(--gradient-primary);
    color: white;
  }

  .detail-empty {
    @apply rounded-lg p-6 text-center text-sm text-muted-foreground;
    background: hsl(var(--muted) / 0.3);
    border: 1px dashed hsl(var(--border));
  }

  .detail-item {
    @apply flex items-center gap-3 rounded-lg p-3 border;
    background: var(--glass-bg);
    border-color: hsl(var(--border));
  }

  .detail-item-icon {
    @apply flex items-center justify-center w-7 h-7 rounded-md text-primary;
    background: hsl(var(--primary) / 0.1);
  }

  .detail-bench-stat {
    @apply flex items-center gap-3 rounded-lg p-4;
    background: hsl(var(--primary) / 0.05);
    border: 1px solid hsl(var(--primary) / 0.15);
  }

  .detail-bench-number {
    @apply text-3xl font-extrabold;
    font-family: var(--font-heading);
    background: var(--gradient-primary);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .detail-related-btn {
    @apply flex items-center justify-between gap-3 w-full rounded-lg p-3 border text-left transition-all duration-200;
    background: var(--glass-bg);
    border-color: hsl(var(--border));
  }
  .detail-related-btn:hover {
    border-color: hsl(var(--primary) / 0.3);
    background: hsl(var(--primary) / 0.05);
  }

  /* ── Submit form ────────────────────────────────────────────────────── */
  .submit-header {
    @apply text-center mb-8;
  }

  .submit-header-icon {
    @apply inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4 text-white;
    background: var(--gradient-primary);
  }

  .submit-connect-card {
    @apply rounded-xl border p-8 text-center flex flex-col items-center;
    background: var(--glass-bg);
    border-color: hsl(var(--border));
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }

  .submit-form {
    @apply space-y-5;
  }

  .form-group {
    @apply flex flex-col gap-1.5;
  }

  .form-label {
    @apply text-sm font-semibold text-foreground;
    font-family: var(--font-heading);
  }

  .form-input {
    @apply w-full px-4 py-2.5 rounded-lg text-sm transition-all duration-200;
    background: hsl(var(--muted) / 0.3);
    border: 1px solid hsl(var(--border));
    color: hsl(var(--foreground));
  }
  .form-input::placeholder {
    color: hsl(var(--muted-foreground));
  }
  .form-input:focus {
    @apply outline-none;
    background: hsl(var(--background));
    border-color: hsl(var(--primary) / 0.5);
    box-shadow: 0 0 0 3px hsl(var(--primary) / 0.1);
  }

  .form-textarea {
    @apply min-h-[120px] resize-y;
  }

  .form-input-error {
    border-color: hsl(var(--destructive)) !important;
  }
  .form-input-error:focus {
    box-shadow: 0 0 0 3px hsl(var(--destructive) / 0.15) !important;
  }

  .field-error-msg {
    @apply text-xs mt-1;
    color: hsl(var(--destructive));
  }

  .submit-btn {
    @apply w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold text-white transition-all duration-300;
    background: var(--gradient-primary);
    box-shadow: 0 4px 16px hsl(var(--primary) / 0.2);
  }
  .submit-btn:hover:not(:disabled) {
    background: var(--gradient-primary-hover);
    box-shadow: 0 6px 24px hsl(var(--primary) / 0.3);
    transform: translateY(-1px);
  }
  .submit-btn:disabled {
    @apply opacity-50 cursor-not-allowed;
    transform: none;
  }

  .submit-spinner {
    @apply w-4 h-4 rounded-full border-2 border-white/30 border-t-white;
    animation: spin 0.8s linear infinite;
  }

  .submit-success {
    @apply mt-4 p-4 rounded-lg flex items-start gap-3 text-sm;
    background: hsl(142 60% 50% / 0.1);
    border: 1px solid hsl(142 60% 50% / 0.3);
    color: hsl(142 60% 35%);
  }
  :global(.dark) .submit-success {
    color: hsl(142 60% 65%);
  }

  .submit-warning {
    @apply mt-4 p-4 rounded-lg flex items-start gap-3 text-sm;
    background: hsl(40 90% 50% / 0.1);
    border: 1px solid hsl(40 90% 50% / 0.3);
    color: hsl(40 90% 30%);
  }
  :global(.dark) .submit-warning {
    color: hsl(40 90% 70%);
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  :global(.line-clamp-2) {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
</style>
