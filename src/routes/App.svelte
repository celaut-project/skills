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

  // ── API & Types ────────────────────────────────────────────────────────────
  import { loadSkills as loadSkillsFromApi, getDemoSkills, formatServiceId } from "$lib/api";
  import type { Skill, Coverage, Benchmark } from "$lib/types";

  // ── State ──────────────────────────────────────────────────────────────────
  let skills: Skill[] = [];
  let selectedSkill: Skill | null = null;
  let loading = true;
  let error: string | null = null;
  let searchQuery = "";
  let activeTab: "gallery" | "submit" = "gallery";
  let detailVisible = false;

  // Detail view sub-tab
  let detailTab: "benchmarks" | "coverages" | "create-benchmark" = "benchmarks";
  let selectedBenchmarkId: string | null = null;

  // Feature expansion state
  let activeCategory = "all";
  let currentSort = "name";
  let validationErrors: Record<string, string> = {};
  let enhancementsRef: SubmitFormEnhancements;

  // Submit skill form
  let newSkillName = "";
  let newSkillProse = "";
  let newSkillTags = "";
  let newSkillDomain = "";
  let submitting = false;
  let submitTx: string | null = null;
  let submitError: string | null = null;

  // Create Benchmark form
  let benchmarkName = "";
  let benchmarkDescription = "";
  let benchmarkMetric = "";
  let benchmarkHigherIsBetter = true;

  // ── Load skills from chain ─────────────────────────────────────────────────
  async function loadSkills() {
    loading = true;
    error = null;
    try {
      skills = await loadSkillsFromApi();
    } catch (e: any) {
      skills = getDemoSkills();
    } finally {
      loading = false;
    }
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
      case "results": return sorted.sort((a, b) => b.resultCount - a.resultCount);
      case "newest": return sorted.reverse();
      default: return sorted;
    }
  }

  $: displayedSkills = sortSkills(filterByCategory(filtered, activeCategory), currentSort);
  $: totalServices = skills.reduce((sum, s) => sum + s.coverages.length, 0);
  $: totalResults = skills.reduce((sum, s) => sum + s.resultCount, 0);

  // ── Select skill with transition ───────────────────────────────────────────
  function selectSkill(skill: Skill) {
    detailVisible = false;
    selectedSkill = skill;
    detailTab = "benchmarks";
    selectedBenchmarkId = null;
    loadForum();
    setTimeout(() => { detailVisible = true; }, 50);
    if (browser) window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function backToGallery() {
    detailVisible = false;
    setTimeout(() => { selectedSkill = null; }, 200);
  }

  // ── Submit new skill ───────────────────────────────────────────────────────
  async function handleSubmitSkill() {
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
      submitError = "On-chain submission is ready -- awaiting Type NFT deployment from Josemi. Your skill data is valid.";
      toasts.info("Skill data validated. Awaiting Type NFT deployment.");
    } catch (e: any) {
      submitError = e.message || "Submission failed.";
      toasts.error(submitError || "Submission failed.");
    } finally {
      submitting = false;
    }
  }

  // ── Create Benchmark ───────────────────────────────────────────────────────
  function handleCreateBenchmark() {
    if (!benchmarkName.trim()) {
      toasts.error("Benchmark name is required.");
      return;
    }
    if (!benchmarkMetric.trim()) {
      toasts.error("Metric is required.");
      return;
    }
    console.log('Create benchmark:', { name: benchmarkName, description: benchmarkDescription, metric: benchmarkMetric, higherIsBetter: benchmarkHigherIsBetter });
    toasts.info("Benchmark created (pending Type NFT deployment)");
    benchmarkName = "";
    benchmarkDescription = "";
    benchmarkMetric = "";
    benchmarkHigherIsBetter = true;
    detailTab = "benchmarks";
  }

  // Clear validation errors when fields change
  $: if (newSkillName) { delete validationErrors["name"]; validationErrors = validationErrors; }
  $: if (newSkillProse) { delete validationErrors["prose"]; validationErrors = validationErrors; }
  $: if (newSkillDomain) { delete validationErrors["domain"]; validationErrors = validationErrors; }

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
          placeholder="Search skills, tags, domains..."
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
        <div class="detail-container">
          <button class="back-button" on:click={backToGallery}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Back to gallery
          </button>

          <!-- Skill header card -->
          <div class="detail-card">
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
          </div>

          <!-- Skill Metadata -->
          <SkillMetadata author={selectedSkill.author} boxId={selectedSkill.boxId} />

          <!-- Claim Coverage Button -->
          <ClaimCoverageButton />

          <!-- Detail sub-tabs -->
          <div class="detail-tabs">
            <button
              class="detail-tab-btn"
              class:detail-tab-active={detailTab === "benchmarks"}
              on:click={() => { detailTab = "benchmarks"; selectedBenchmarkId = null; }}
            >
              Benchmarks
              <span class="detail-tab-count">{selectedSkill.benchmarks.length}</span>
            </button>
            <button
              class="detail-tab-btn"
              class:detail-tab-active={detailTab === "coverages"}
              on:click={() => detailTab = "coverages"}
            >
              Coverages
              <span class="detail-tab-count">{selectedSkill.coverages.length}</span>
            </button>
            <button
              class="detail-tab-btn"
              class:detail-tab-active={detailTab === "create-benchmark"}
              on:click={() => detailTab = "create-benchmark"}
            >
              Create Benchmark
            </button>
          </div>

          <!-- Benchmarks Tab -->
          {#if detailTab === "benchmarks"}
            <SkillLeaderboard benchmarks={selectedSkill.benchmarks} bind:selectedBenchmarkId />
          {/if}

          <!-- Coverages Tab -->
          {#if detailTab === "coverages"}
            <section class="detail-section">
              <div class="detail-section-header">
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
                      <span class="ml-auto text-xs text-muted-foreground">
                        <code class="font-mono text-xs px-1.5 py-0.5 rounded" style="background: hsl(var(--muted) / 0.5);">{formatServiceId(cov.serviceId, cov.boxId)}</code>
                      </span>
                    </div>
                  {/each}
                </div>
              {/if}
            </section>
          {/if}

          <!-- Create Benchmark Tab -->
          {#if detailTab === "create-benchmark"}
            <section class="detail-section">
              <div class="detail-section-header">
                <h2 class="detail-section-title">Create Benchmark</h2>
              </div>
              <form class="create-benchmark-form" on:submit|preventDefault={handleCreateBenchmark}>
                <div class="form-group">
                  <label class="form-label" for="bench-name">Name <span class="text-red-500">*</span></label>
                  <input id="bench-name" class="form-input" bind:value={benchmarkName} placeholder="e.g. Sharpe Ratio (30d rolling)" required />
                </div>
                <div class="form-group">
                  <label class="form-label" for="bench-desc">Description</label>
                  <textarea id="bench-desc" class="form-input form-textarea" bind:value={benchmarkDescription} placeholder="What does this benchmark measure?"></textarea>
                </div>
                <div class="form-group">
                  <label class="form-label" for="bench-metric">Metric <span class="text-red-500">*</span></label>
                  <input id="bench-metric" class="form-input" bind:value={benchmarkMetric} placeholder="e.g. accuracy, latency_ms, f1_score" required />
                </div>
                <div class="form-group form-toggle-group">
                  <label class="form-label" for="bench-higher">Higher is better?</label>
                  <div class="toggle-wrapper">
                    <button
                      type="button"
                      class="toggle-btn"
                      class:toggle-active={benchmarkHigherIsBetter}
                      on:click={() => benchmarkHigherIsBetter = !benchmarkHigherIsBetter}
                    >
                      <span class="toggle-indicator" class:toggle-indicator-on={benchmarkHigherIsBetter}></span>
                    </button>
                    <span class="toggle-label">{benchmarkHigherIsBetter ? 'Yes' : 'No'}</span>
                  </div>
                </div>
                <button type="submit" class="submit-btn">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
                  </svg>
                  Create Benchmark
                </button>
              </form>
            </section>
          {/if}

          <!-- Related skills -->
          {#if selectedSkill.otherSkillBoxIds.length > 0}
            <section class="detail-section">
              <div class="detail-section-header">
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
              <h2 class="detail-section-title">Discussion</h2>
            </div>
            {#if ForumComponent}
              <svelte:component this={ForumComponent} topicIdentifier={selectedSkill.boxId} reputationTokenId="" />
            {:else}
              <div class="detail-empty">
                <p>Loading forum...</p>
              </div>
            {/if}
          </section>
        </div>
      </div>

    {:else}
      <!-- ── Hero + Skills Gallery ─────────────────────────────────────────── -->
      <HeroSection skillCount={skills.length} />

      <div id="skills-section" class="container mx-auto px-8 pb-8">
        <!-- How It Works -->
        <HowItWorks />

        <!-- Stats Bar -->
        <StatsBar totalSkills={skills.length} {totalServices} {totalResults} />

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
                author={skill.author}
                coverageCount={skill.coverages.length}
                benchmarkCount={skill.benchmarks.length}
                resultCount={skill.resultCount}
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
    <div class="container mx-auto px-8 py-8">
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
                Publishing...
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
                <a href={`https://explorer.ergoplatform.com/en/transactions/${submitTx}`} target="_blank" rel="noopener noreferrer" class="text-sm break-all" style="color: hsl(142 50% 42%);">{submitTx}</a>
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
    background-color: hsl(var(--background));
    border-bottom-color: hsl(var(--border));
  }

  .navbar-content {
    @apply flex h-16 items-center px-8;
    max-width: 1440px;
    margin: 0 auto;
    width: 100%;
  }

  .logo-container {
    @apply flex items-center gap-2.5 text-foreground no-underline whitespace-nowrap;
  }

  .logo-icon {
    @apply flex items-center justify-center w-8 h-8 rounded-lg;
    background: hsl(var(--foreground));
    color: hsl(var(--background));
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
    border-color: hsl(var(--foreground) / 0.3);
    box-shadow: 0 0 0 3px hsl(var(--foreground) / 0.06);
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
    border-bottom-color: hsl(var(--foreground));
    color: hsl(var(--foreground));
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
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 1.25rem;
  }

  @media (min-width: 1200px) {
    .skills-grid {
      grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    }
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
    @apply px-8 py-8;
    max-width: 1440px;
    margin: 0 auto;
    opacity: 0;
    transform: translateX(12px);
    transition: opacity 0.4s ease, transform 0.4s ease;
  }

  .detail-visible {
    opacity: 1;
    transform: translateX(0);
  }

  .detail-container {
    max-width: 900px;
    margin: 0 auto;
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
    background: hsl(var(--card));
    border-color: hsl(var(--border));
  }

  .detail-domain-badge {
    @apply inline-flex items-center px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider;
    background: hsl(var(--muted));
    color: hsl(var(--muted-foreground));
  }

  .detail-tag {
    @apply px-3 py-1 rounded-lg text-xs font-medium;
    background: hsl(var(--muted));
    color: hsl(var(--muted-foreground));
  }

  /* ── Detail sub-tabs ─────────────────────────────────────────────── */
  .detail-tabs {
    display: flex;
    gap: 0.25rem;
    margin-bottom: 1.5rem;
    border-bottom: 1px solid hsl(var(--border));
    padding-bottom: 0;
  }

  .detail-tab-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: hsl(var(--muted-foreground));
    border-bottom: 2px solid transparent;
    cursor: pointer;
    transition: all 0.15s;
    background: none;
    border-top: none;
    border-left: none;
    border-right: none;
  }

  .detail-tab-btn:hover {
    color: hsl(var(--foreground));
  }

  .detail-tab-active {
    color: hsl(var(--foreground));
    border-bottom-color: hsl(var(--foreground));
    font-weight: 600;
  }

  .detail-tab-count {
    font-size: 0.6875rem;
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    background: hsl(var(--muted));
    color: hsl(var(--muted-foreground));
    font-weight: 600;
  }

  .detail-section {
    @apply mb-8;
  }

  .detail-section-header {
    @apply flex items-center gap-3 mb-4 pb-3;
    border-bottom: 1px solid hsl(var(--border) / 0.5);
  }

  .detail-section-title {
    @apply text-lg font-bold flex-1;
  }

  .detail-count {
    @apply inline-flex items-center justify-center min-w-[28px] h-7 px-2 rounded-full text-xs font-bold;
    background: hsl(var(--muted));
    color: hsl(var(--muted-foreground));
  }

  .detail-empty {
    @apply rounded-lg p-6 text-center text-sm text-muted-foreground;
    background: hsl(var(--muted) / 0.3);
    border: 1px dashed hsl(var(--border));
  }

  .detail-item {
    @apply flex items-center gap-3 rounded-lg p-3 border;
    background: hsl(var(--card));
    border-color: hsl(var(--border));
  }

  .detail-item-icon {
    @apply flex items-center justify-center w-7 h-7 rounded-md;
    background: hsl(var(--muted));
    color: hsl(var(--muted-foreground));
  }

  .detail-related-btn {
    @apply flex items-center justify-between gap-3 w-full rounded-lg p-3 border text-left transition-all duration-200;
    background: hsl(var(--card));
    border-color: hsl(var(--border));
  }
  .detail-related-btn:hover {
    border-color: hsl(var(--foreground) / 0.2);
    background: hsl(var(--muted) / 0.3);
  }

  /* ── Create Benchmark form ──────────────────────────────────────── */
  .create-benchmark-form {
    @apply space-y-5;
  }

  .form-toggle-group {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .toggle-wrapper {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .toggle-btn {
    position: relative;
    width: 2.75rem;
    height: 1.5rem;
    border-radius: 9999px;
    border: none;
    cursor: pointer;
    background: hsl(var(--muted));
    transition: background 0.2s;
  }

  .toggle-active {
    background: hsl(142 50% 42%);
  }

  .toggle-indicator {
    position: absolute;
    top: 2px;
    left: 2px;
    width: 1.25rem;
    height: 1.25rem;
    border-radius: 50%;
    background: white;
    transition: transform 0.2s;
  }

  .toggle-indicator-on {
    transform: translateX(1.25rem);
  }

  .toggle-label {
    font-size: 0.8125rem;
    color: hsl(var(--muted-foreground));
    font-weight: 500;
  }

  /* ── Submit form ────────────────────────────────────────────────────── */
  .submit-header {
    @apply text-center mb-8;
  }

  .submit-header-icon {
    @apply inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4 text-white;
    background: hsl(var(--foreground));
  }

  .submit-connect-card {
    @apply rounded-xl border p-8 text-center flex flex-col items-center;
    background: hsl(var(--card));
    border-color: hsl(var(--border));
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
    border-color: hsl(var(--foreground) / 0.3);
    box-shadow: 0 0 0 3px hsl(var(--foreground) / 0.06);
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
    @apply w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold text-white transition-all duration-200;
    background: hsl(142 50% 42%);
  }
  .submit-btn:hover:not(:disabled) {
    background: hsl(142 50% 38%);
  }
  .submit-btn:disabled {
    @apply opacity-50 cursor-not-allowed;
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
