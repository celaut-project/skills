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
  import { web_explorer_uri_addr, reputation_proof, explorer_uri, source_explorer_url } from "$lib/common/store";
  import { web_explorer_uri_tkn } from "$lib/ergo/envs";
  import { FileCard, FileSourceCreation, fetchFileSourcesByHash } from "source-application";
  import type { FileSource } from "source-application";
  import { writable } from "svelte/store";
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
  import { getDemoSkills, formatServiceId, formatSourceHash } from "$lib/api";
  import { loadSkills as loadSkillsFromData } from "$lib/data";
  import { createSkill, createBenchmark as createBenchmarkEntity } from "$lib/data";
  import type { Skill, Coverage, Benchmark } from "$lib/types";
  import { calculateSkillReputation, calculateBenchmarkReputation, formatReputation } from "$lib/reputation";
  import { getMainReputationBox } from "$lib/reputationContext";
  import { demoMode } from "$lib/config";

  // ── Reputation threshold for hiding related skills ─────────────────────────
  // If skill A references skill B via otherSkillBoxIds, and A's reputation >= this
  // threshold, then B is hidden from the main gallery (still accessible from A's detail).
  // Default 0 = any relationship hides the related skill.
  const REPUTATION_THRESHOLD = 0;

  // ── State ──────────────────────────────────────────────────────────────────
  let skills: Skill[] = [];
  let selectedSkill: Skill | null = null;
  let loading = true;
  let error: string | null = null;
  let searchQuery = "";
  let activeTab: "gallery" | "submit" = "gallery";
  let detailVisible = false;

  // Detail view sub-tab
  let detailTab: "benchmarks" | "coverages" | "compare" = "benchmarks";
  let selectedBenchmarkId: string | null = null;

  // Create Benchmark form is now a collapsible inline panel, not a tab.
  let showCreateBenchmarkForm = false;

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
  let benchmarkSubmitting = false;
  let relatedSkillBoxIds: string[] = [];

  // Source-application state
  let skillSources: FileSource[] = [];
  let showFileSourceModal = false;
  let modalFileHash = "";

  function openFileSourceModal(hash: string) {
    modalFileHash = hash;
    showFileSourceModal = true;
  }

  function handleFileSourceAdded(txId: string) {
    toasts.info(`Source registered! Tx: ${txId.slice(0, 12)}…`);
    showFileSourceModal = false;
    // Reload sources for the current skill
    if (selectedSkill?.sourceHash) {
      loadSkillSources(selectedSkill.sourceHash);
    }
  }

  async function loadSkillSources(hash: string) {
    try {
      const fetched = await fetchFileSourcesByHash($explorer_uri, hash);
      skillSources = fetched ?? [];
    } catch {
      skillSources = [];
    }
  }

  // Reload sources when selected skill changes
  $: if (selectedSkill?.sourceHash) {
    loadSkillSources(selectedSkill.sourceHash);
  } else {
    skillSources = [];
  }

  // Compute reputation for selected skill
  $: selectedSkillReputation = selectedSkill ? calculateSkillReputation(selectedSkill) : null;

  // ── Load skills from active provider ────────────────────────────────────────
  async function loadSkills() {
    loading = true;
    error = null;
    try {
      skills = await loadSkillsFromData();
    } catch (e: any) {
      skills = getDemoSkills();
    } finally {
      loading = false;
    }
  }

  async function refreshSkills(preserveSelectedBoxId: string | null = selectedSkill?.boxId ?? null) {
    const selectedBoxId = preserveSelectedBoxId;
    await loadSkills();
    if (selectedBoxId) {
      selectedSkill = skills.find((skill) => skill.boxId === selectedBoxId) ?? selectedSkill;
    }
  }
  
  function currentMainBox() {
    return getMainReputationBox($reputation_proof);
  }

  // Reload when demo mode changes
  let demoModeInitialized = false;
  $: {
    const _dm = $demoMode; // Subscribe to changes
    if (browser && demoModeInitialized) {
      loadSkills();
    }
    demoModeInitialized = true;
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

  // ── Compute which boxIds are subsumed by a higher-reputation skill ───────
  // A skill B is hidden if another skill A references B in otherSkillBoxIds
  // AND A's reputation >= REPUTATION_THRESHOLD.
  $: hiddenBoxIds = (() => {
    const hidden = new Set<string>();
    for (const skill of skills) {
      const rep = calculateSkillReputation(skill);
      if (rep.total >= REPUTATION_THRESHOLD && skill.otherSkillBoxIds.length > 0) {
        for (const refId of skill.otherSkillBoxIds) {
          hidden.add(refId);
        }
      }
    }
    return hidden;
  })();

  $: displayedSkills = sortSkills(
    filterByCategory(filtered, activeCategory).filter(s => !hiddenBoxIds.has(s.boxId)),
    currentSort
  );
  $: totalServices = skills.reduce((sum, s) => sum + s.coverages.length, 0);
  $: totalResults = skills.reduce((sum, s) => sum + s.resultCount, 0);

  // Track duplicate skill names to flag concurrent submissions.
  $: skillNameCounts = skills.reduce((acc, s) => {
    acc[s.name] = (acc[s.name] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  /**
   * Compute a composite score for a coverage/service within a skill.
   * Score = sum of (result.score × benchmarkReputation) for all results
   * matching this service across the skill's benchmarks.
   */
  function computeServiceCompositeScore(serviceId: string | undefined, skill: Skill): number {
    if (!serviceId) return 0;
    let composite = 0;
    for (const bench of skill.benchmarks) {
      const benchRep = calculateBenchmarkReputation(bench).total;
      for (const result of bench.results) {
        if (result.serviceId === serviceId) {
          composite += result.score * benchRep;
        }
      }
    }
    return Math.round(composite * 100) / 100;
  }

  function formatHash(hash: string | undefined): string {
    if (!hash || hash.length <= 16) return hash || '-';
    return `${hash.slice(0, 8)}…${hash.slice(-4)}`;
  }

  // ── Select skill with transition ───────────────────────────────────────────
  function selectSkill(skill: Skill) {
    detailVisible = false;
    selectedSkill = skill;
    detailTab = "benchmarks";
    selectedBenchmarkId = null;
    showCreateBenchmarkForm = false;
    loadForum();
    setTimeout(() => { detailVisible = true; }, 50);
    if (browser) window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function backToGallery() {
    detailVisible = false;
    setTimeout(() => { selectedSkill = null; }, 200);
  }

  // ── Fork / Edit skill ──────────────────────────────────────────────────────
  // Pre-populates the Submit form with the selected skill's data and switches view.
  // Adds the original skill's boxId to otherSkillBoxIds so the new skill references it.
  let prefillRelatedBoxIds: string[] = [];

  function forkSkill(skill: Skill) {
    newSkillName = skill.name;
    newSkillProse = skill.prose;
    newSkillDomain = skill.domain;
    newSkillTags = skill.tags.join(', ');
    prefillRelatedBoxIds = [skill.boxId];
    relatedSkillBoxIds = [skill.boxId];
    // Switch to submit tab
    selectedSkill = null;
    activeTab = "submit";
    if (browser) window.scrollTo({ top: 0, behavior: 'smooth' });
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
    if (!$demoMode && !$walletConnected) { submitError = "Connect your wallet first."; toasts.error("Connect your wallet first."); return; }
    if (!newSkillName.trim()) { submitError = "Name is required."; validationErrors = { name: "Skill name is required." }; return; }
    submitting = true;
    submitError = null;
    submitTx = null;
    try {
      const txId = await createSkill({
        name: newSkillName.trim(),
        prose: newSkillProse.trim(),
        tags: newSkillTags.split(",").map((t) => t.trim()).filter(Boolean),
        domain: newSkillDomain.trim(),
        otherSkillBoxIds: [...relatedSkillBoxIds],
        sourceHash: "",
        tokenAmount: 1,
        mainBox: currentMainBox(),
      });
      submitTx = txId;
      await refreshSkills();
      toasts.success($demoMode ? "Skill submitted successfully (demo mode)." : "Skill published on-chain.");
      newSkillName = '';
      newSkillProse = '';
      newSkillDomain = '';
      newSkillTags = '';
      prefillRelatedBoxIds = [];
      relatedSkillBoxIds = [];
    } catch (e: any) {
      submitError = e.message || "Submission failed.";
      toasts.error(submitError || "Submission failed.");
    } finally {
      submitting = false;
    }
  }

  // ── Create Benchmark ───────────────────────────────────────────────────────
  async function handleCreateBenchmark() {
    if (!selectedSkill) {
      toasts.error("Select a skill first.");
      return;
    }
    if (!benchmarkName.trim()) {
      toasts.error("Benchmark name is required.");
      return;
    }
    if (!benchmarkMetric.trim()) {
      toasts.error("Metric is required.");
      return;
    }
    if (!$demoMode && !$walletConnected) {
      toasts.error("Connect your wallet first.");
      return;
    }

    benchmarkSubmitting = true;
    try {
      await createBenchmarkEntity({
        skillBoxId: selectedSkill.boxId,
        name: benchmarkName.trim(),
        description: benchmarkDescription.trim(),
        metric: benchmarkMetric.trim(),
        higherIsBetter: benchmarkHigherIsBetter,
        mainBox: currentMainBox()
      });
      await refreshSkills(selectedSkill.boxId);
      toasts.success($demoMode ? "Benchmark created (demo mode)." : "Benchmark published on-chain.");
      benchmarkName = "";
      benchmarkDescription = "";
      benchmarkMetric = "";
      benchmarkHigherIsBetter = true;
      detailTab = "benchmarks";
    } catch (e: any) {
      toasts.error(e?.message || "Benchmark creation failed.");
    } finally {
      benchmarkSubmitting = false;
    }
  }

  // Clear validation errors when fields change
  $: if (newSkillName) { delete validationErrors["name"]; validationErrors = validationErrors; }
  $: if (newSkillProse) { delete validationErrors["prose"]; validationErrors = validationErrors; }
  $: if (newSkillDomain) { delete validationErrors["domain"]; validationErrors = validationErrors; }

  // ── Coverage view helpers ──────────────────────────────────────────────────
  /**
   * For a given service, return its best-result row per benchmark (only benchmarks
   * the service has at least one result for). Used by the Coverages sub-tab.
   */
  function collectServiceResults(serviceId: string | undefined, skill: Skill) {
    if (!serviceId) return [] as Array<{ benchmark: Benchmark; bestResult: number | null; count: number }>;
    return skill.benchmarks
      .map((bench) => {
        const matches = bench.results.filter((r) => r.serviceId === serviceId);
        const bestResult = matches.length === 0
          ? null
          : bench.higherIsBetter
            ? Math.max(...matches.map((r) => r.score))
            : Math.min(...matches.map((r) => r.score));
        return { benchmark: bench, bestResult, count: matches.length };
      })
      .filter((row) => row.count > 0);
  }

  /**
   * Build a (coverage × benchmark) matrix where each cell holds the service's
   * best result for that benchmark and a flag indicating column-winning score.
   * Used by the Comparative sub-tab.
   */
  function buildComparisonMatrix(skill: Skill) {
    const bestPerService = (bench: Benchmark, sid: string | undefined): number | null => {
      if (!sid) return null;
      const matches = bench.results.filter((r) => r.serviceId === sid);
      if (matches.length === 0) return null;
      return bench.higherIsBetter
        ? Math.max(...matches.map((r) => r.score))
        : Math.min(...matches.map((r) => r.score));
    };
    const columnWinners = skill.benchmarks.map((bench) => {
      const allBests = skill.coverages
        .map((cov) => bestPerService(bench, cov.serviceId))
        .filter((v): v is number => v !== null);
      if (allBests.length === 0) return null;
      return bench.higherIsBetter ? Math.max(...allBests) : Math.min(...allBests);
    });
    const rows = skill.coverages.map((cov) => {
      const cells = skill.benchmarks.map((bench, i) => {
        const score = bestPerService(bench, cov.serviceId);
        const winner = columnWinners[i];
        const isBest = score !== null && winner !== null && score === winner;
        return { score, isBest };
      });
      return { serviceId: cov.serviceId || cov.boxId, cells };
    });
    return { rows };
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
      <span class="logo-text">Unstoppable Skills</span>
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
      <button
        class="demo-toggle"
        class:demo-toggle-on={$demoMode}
        on:click={() => demoMode.update(v => !v)}
        title={$demoMode ? 'Demo Mode ON — using mock data' : 'Live Mode — using Ergo blockchain'}
      >
        {#if $demoMode}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
            <line x1="12" y1="22.08" x2="12" y2="12"/>
          </svg>
          Demo
        {:else}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
          Live
        {/if}
      </button>
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
              <div class="flex items-center gap-3">
                <h1 class="text-2xl md:text-3xl font-extrabold">{selectedSkill.name}</h1>
                {#if selectedSkillReputation}
                  <span class="detail-reputation-badge" title="Reputation: {selectedSkillReputation.label}">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                    {formatReputation(selectedSkillReputation.total)}
                    <span class="detail-reputation-label">{selectedSkillReputation.label}</span>
                  </span>
                {/if}
              </div>
              {#if selectedSkill.domain}
                <span class="detail-domain-badge">{selectedSkill.domain}</span>
              {/if}
              <button class="fork-skill-btn" on:click={() => selectedSkill && forkSkill(selectedSkill)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <circle cx="12" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><path d="M18 9v1a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9"/><line x1="12" y1="12" x2="12" y2="15"/>
                </svg>
                Fork Skill
              </button>
            </div>
            <p class="text-muted-foreground mb-5 leading-relaxed">{selectedSkill.prose || "No description."}</p>
            {#if selectedSkill.sourceHash}
              <details class="source-details mb-4">
                <summary class="source-summary">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>
                  </svg>
                  <span>Source Document</span>
                  <code class="source-hash-inline-code">{formatSourceHash(selectedSkill.sourceHash)}</code>
                </summary>
                <div class="source-card-container mt-3">
                  <FileCard
                    fileHash={selectedSkill.sourceHash}
                    profile={$reputation_proof}
                    sources={skillSources}
                    explorerUri={$explorer_uri}
                    source_explorer_url={$source_explorer_url}
                    webExplorerUriTkn={web_explorer_uri_tkn}
                  />
                  {#if $reputation_proof}
                    <button class="add-source-btn mt-2" on:click={() => openFileSourceModal(selectedSkill?.sourceHash || '')}>
                      + Add Download Source
                    </button>
                  {/if}
                </div>
              </details>
            {/if}
            {#if skillNameCounts[selectedSkill.name] > 1}
              <div class="duplicate-notice">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4-4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
                </svg>
                <span>{skillNameCounts[selectedSkill.name]} concurrent submissions for this skill</span>
              </div>
            {/if}
            <div class="flex flex-wrap gap-2 mb-5">
              {#each selectedSkill.tags as tag}
                <span class="detail-tag">{tag}</span>
              {/each}
            </div>
          </div>

          <!-- Skill Metadata -->
          <SkillMetadata boxId={selectedSkill.boxId} sourceHash={selectedSkill.sourceHash || ''} />

          <!-- Action buttons: Claim Coverage + Create Benchmark -->
          <div class="action-row">
            <ClaimCoverageButton
              skillBoxId={selectedSkill.boxId}
              on:created={() => refreshSkills(selectedSkill?.boxId ?? null)}
            />
            <button
              class="create-benchmark-btn"
              class:create-benchmark-btn-active={showCreateBenchmarkForm}
              on:click={() => { showCreateBenchmarkForm = !showCreateBenchmarkForm; }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
              </svg>
              {showCreateBenchmarkForm ? 'Cancel' : 'Create Benchmark'}
            </button>
          </div>

          <!-- Create Benchmark inline form (toggled by button above) -->
          {#if showCreateBenchmarkForm}
            <section class="detail-section">
              <form class="create-benchmark-form" on:submit|preventDefault={async () => { await handleCreateBenchmark(); showCreateBenchmarkForm = false; }}>
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
                <button type="submit" class="submit-btn" disabled={benchmarkSubmitting}>
                  {#if benchmarkSubmitting}
                    <div class="submit-spinner"></div>
                    Creating Benchmark...
                  {:else}
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
                    </svg>
                    Create Benchmark
                  {/if}
                </button>
              </form>
            </section>
          {/if}

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
              class:detail-tab-active={detailTab === "compare"}
              on:click={() => detailTab = "compare"}
            >
              Comparative
            </button>
          </div>

          <!-- Benchmarks Tab -->
          {#if detailTab === "benchmarks"}
            <SkillLeaderboard
              benchmarks={selectedSkill.benchmarks}
              bind:selectedBenchmarkId
              onAddSource={openFileSourceModal}
              on:created={() => refreshSkills(selectedSkill?.boxId ?? null)}
            />
          {/if}

          <!-- Coverages Tab — per-coverage per-benchmark performance -->
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
                <div class="space-y-3">
                  {#each selectedSkill.coverages as cov}
                    {@const serviceResults = collectServiceResults(cov.serviceId, selectedSkill)}
                    {@const compositeScore = computeServiceCompositeScore(cov.serviceId, selectedSkill)}
                    <div class="coverage-card">
                      <div class="coverage-card-header">
                        <code class="font-mono text-xs px-1.5 py-0.5 rounded" style="background: hsl(var(--muted) / 0.5);">{formatHash(cov.serviceId || cov.boxId)}</code>
                        <span class="ml-auto coverage-score" title="Composite score: Σ(result.score × benchmarkReputation)">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none" class="coverage-score-icon">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                          </svg>
                          {formatReputation(compositeScore)}
                        </span>
                      </div>
                      {#if serviceResults.length === 0}
                        <p class="coverage-empty">No results submitted yet for this service.</p>
                      {:else}
                        <table class="coverage-benchmark-table">
                          <thead>
                            <tr>
                              <th>Benchmark</th>
                              <th class="num">Best result</th>
                              <th class="num">Runs</th>
                            </tr>
                          </thead>
                          <tbody>
                            {#each serviceResults as row}
                              <tr>
                                <td>{row.benchmark.name}</td>
                                <td class="num">{row.bestResult !== null ? formatReputation(row.bestResult) : '—'}</td>
                                <td class="num">{row.count}</td>
                              </tr>
                            {/each}
                          </tbody>
                        </table>
                      {/if}
                    </div>
                  {/each}
                </div>
              {/if}
            </section>
          {/if}

          <!-- Comparative Tab — services × benchmarks matrix (best-reputation result per cell) -->
          {#if detailTab === "compare"}
            <section class="detail-section">
              <div class="detail-section-header">
                <h2 class="detail-section-title">Service × Benchmark Comparison</h2>
              </div>
              {#if selectedSkill.coverages.length === 0 || selectedSkill.benchmarks.length === 0}
                <div class="detail-empty">
                  <p>Comparison requires at least one coverage and one benchmark.</p>
                </div>
              {:else}
                {@const matrix = buildComparisonMatrix(selectedSkill)}
                <div class="comparative-wrapper">
                  <table class="comparative-table">
                    <thead>
                      <tr>
                        <th class="comp-service-col">Service</th>
                        {#each selectedSkill.benchmarks as bench}
                          <th class="num" title={bench.description}>{bench.name}</th>
                        {/each}
                      </tr>
                    </thead>
                    <tbody>
                      {#each matrix.rows as row}
                        <tr>
                          <td>
                            <code class="font-mono text-xs">{formatHash(row.serviceId)}</code>
                          </td>
                          {#each row.cells as cell}
                            <td class="num" class:comp-cell-best={cell.isBest}>
                              {cell.score !== null ? formatReputation(cell.score) : '—'}
                            </td>
                          {/each}
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                  <p class="comparative-note">Highlighted cell = best-reputation result for that service/benchmark when multiple submissions exist.</p>
                </div>
              {/if}
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
              <svelte:component this={ForumComponent} topic_id={selectedSkill.boxId} />
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
                coverageCount={skill.coverages.length}
                benchmarkCount={skill.benchmarks.length}
                resultCount={skill.resultCount}
                isDuplicate={skillNameCounts[skill.name] > 1}
                reputation={calculateSkillReputation(skill).total}
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
      <div class="mx-auto" style="max-width: 1200px;">
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

        {#if !$demoMode && !$walletConnected}
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
              {prefillRelatedBoxIds}
              on:relatedChange={(event) => relatedSkillBoxIds = event.detail}
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

<!-- ── File Source Creation Modal ──────────────────────────────────────── -->
{#if showFileSourceModal}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="file-source-modal-backdrop" on:click={() => showFileSourceModal = false}>
    <div class="file-source-modal-content" on:click|stopPropagation>
      <div class="file-source-modal-header">
        <h3 class="text-lg font-semibold">Register Download Source</h3>
        <button class="file-source-modal-close" on:click={() => showFileSourceModal = false}>✕</button>
      </div>
      <FileSourceCreation
        profile={$reputation_proof}
        explorerUri={$explorer_uri}
        source_explorer_url={$source_explorer_url}
        onSourceAdded={handleFileSourceAdded}
        hash={writable(modalFileHash)}
      />
    </div>
  </div>
{/if}

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

  /* ── Demo toggle ──────────────────────────────────────────────────── */
  .demo-toggle {
    @apply flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200;
    background: hsl(var(--muted) / 0.5);
    border: 1px solid hsl(var(--border));
    color: hsl(var(--muted-foreground));
  }
  .demo-toggle:hover {
    background: hsl(var(--muted));
    color: hsl(var(--foreground));
  }
  .demo-toggle-on {
    background: hsl(142 50% 42% / 0.12);
    border-color: hsl(142 50% 42% / 0.3);
    color: hsl(142 50% 35%);
  }
  :global(.dark) .demo-toggle-on {
    color: hsl(142 50% 65%);
  }
  .demo-toggle-on:hover {
    background: hsl(142 50% 42% / 0.2);
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
    max-width: 1200px;
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

  .fork-skill-btn {
    @apply inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200;
    background: hsl(var(--muted) / 0.5);
    border: 1px solid hsl(var(--border));
    color: hsl(var(--muted-foreground));
    cursor: pointer;
  }
  .fork-skill-btn:hover {
    background: hsl(var(--muted));
    color: hsl(var(--foreground));
    border-color: hsl(var(--foreground) / 0.2);
  }

  .detail-reputation-badge {
    @apply inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold;
    background: hsl(45 90% 50% / 0.15);
    color: hsl(45 80% 35%);
  }
  :global(.dark) .detail-reputation-badge {
    background: hsl(45 90% 50% / 0.12);
    color: hsl(45 80% 70%);
  }

  .detail-reputation-label {
    @apply text-xs font-medium opacity-75 ml-0.5;
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

  .coverage-score {
    @apply inline-flex items-center gap-1 text-xs font-bold tabular-nums;
    color: hsl(45 80% 35%);
  }
  :global(.dark) .coverage-score {
    color: hsl(45 80% 70%);
  }

  .coverage-score-icon {
    color: hsl(45 90% 50%);
    flex-shrink: 0;
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

  /* ── Duplicate Skill Notice ────────────────────────────────────────── */
  .duplicate-notice {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
    padding: 0.375rem 0.75rem;
    border-radius: 0.375rem;
    background: hsl(40 90% 50% / 0.08);
    border: 1px solid hsl(40 90% 50% / 0.2);
    font-size: 0.75rem;
    color: hsl(var(--muted-foreground));
    width: fit-content;
  }

  /* ── Source Details (collapsible FileCard wrapper) ──────────────────── */
  .source-details {
    border: 1px solid hsl(var(--border));
    border-radius: 0.5rem;
    overflow: hidden;
  }

  .source-summary {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 0.875rem;
    cursor: pointer;
    font-size: 0.8125rem;
    font-weight: 500;
    color: hsl(var(--foreground));
    list-style: none;
    background: hsl(var(--muted) / 0.2);
    transition: background 0.15s;
  }

  .source-summary:hover {
    background: hsl(var(--muted) / 0.4);
  }

  .source-summary::-webkit-details-marker {
    display: none;
  }

  .source-hash-inline-code {
    margin-left: auto;
    font-size: 0.6875rem;
    font-family: monospace;
    color: hsl(var(--muted-foreground));
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    background: hsl(var(--muted) / 0.5);
  }

  .source-card-container {
    padding: 0.75rem;
  }

  .add-source-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.75rem;
    border-radius: 0.375rem;
    font-size: 0.75rem;
    font-weight: 500;
    color: hsl(var(--muted-foreground));
    background: hsl(var(--muted) / 0.3);
    border: 1px solid hsl(var(--border));
    cursor: pointer;
    transition: all 0.15s;
  }

  .add-source-btn:hover {
    color: hsl(var(--foreground));
    background: hsl(var(--muted) / 0.5);
    border-color: hsl(var(--foreground) / 0.2);
  }

  /* ── File Source Creation Modal ─────────────────────────────────────── */
  .file-source-modal-backdrop {
    position: fixed;
    inset: 0;
    z-index: 100;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
  }

  .file-source-modal-content {
    width: 100%;
    max-width: 40rem;
    max-height: 90vh;
    overflow-y: auto;
    border-radius: 0.75rem;
    border: 1px solid hsl(var(--border));
    background: hsl(var(--background));
    padding: 1.5rem;
    margin: 1rem;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  }

  .file-source-modal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid hsl(var(--border));
  }

  .file-source-modal-close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border-radius: 0.375rem;
    border: none;
    background: none;
    color: hsl(var(--muted-foreground));
    cursor: pointer;
    font-size: 1rem;
    transition: all 0.15s;
  }

  .file-source-modal-close:hover {
    color: hsl(var(--foreground));
    background: hsl(var(--muted) / 0.5);
  }

  /* ── Action row: Claim Coverage + Create Benchmark ─────────────────── */
  .action-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }

  .create-benchmark-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1rem;
    font-size: 0.875rem;
    font-weight: 600;
    border-radius: 0.5rem;
    border: 1px solid hsl(var(--border));
    background: hsl(var(--card));
    color: hsl(var(--foreground));
    cursor: pointer;
    transition: all 0.15s;
  }
  .create-benchmark-btn:hover {
    background: hsl(var(--muted) / 0.5);
    border-color: hsl(var(--foreground) / 0.2);
  }
  .create-benchmark-btn-active {
    background: hsl(var(--muted));
    border-color: hsl(var(--foreground) / 0.3);
  }

  /* ── Coverages: per-service per-benchmark card ─────────────────────── */
  .coverage-card {
    border: 1px solid hsl(var(--border));
    border-radius: 0.5rem;
    background: hsl(var(--card));
    padding: 0.875rem 1rem;
  }
  .coverage-card-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
  }
  .coverage-score {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.75rem;
    font-weight: 700;
    color: hsl(45 80% 35%);
  }
  :global(.dark) .coverage-score {
    color: hsl(45 80% 70%);
  }
  .coverage-score-icon {
    opacity: 0.8;
  }
  .coverage-empty {
    font-size: 0.8125rem;
    color: hsl(var(--muted-foreground));
    margin: 0;
    padding: 0.5rem 0;
  }
  .coverage-benchmark-table {
    width: 100%;
    font-size: 0.8125rem;
    border-collapse: collapse;
  }
  .coverage-benchmark-table th,
  .coverage-benchmark-table td {
    padding: 0.375rem 0.5rem;
    border-bottom: 1px solid hsl(var(--border) / 0.5);
    text-align: left;
  }
  .coverage-benchmark-table th {
    font-weight: 600;
    font-size: 0.6875rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: hsl(var(--muted-foreground));
  }
  .coverage-benchmark-table .num,
  .comparative-table .num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  /* ── Comparative (services × benchmarks) matrix ────────────────────── */
  .comparative-wrapper {
    overflow-x: auto;
  }
  .comparative-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8125rem;
  }
  .comparative-table th,
  .comparative-table td {
    padding: 0.5rem 0.75rem;
    border-bottom: 1px solid hsl(var(--border) / 0.5);
    text-align: left;
    white-space: nowrap;
  }
  .comparative-table th {
    font-weight: 600;
    font-size: 0.6875rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: hsl(var(--muted-foreground));
    background: hsl(var(--muted) / 0.3);
  }
  .comp-service-col {
    text-align: left;
  }
  .comp-cell-best {
    background: hsl(45 90% 50% / 0.18);
    font-weight: 700;
    color: hsl(45 80% 35%);
  }
  :global(.dark) .comp-cell-best {
    background: hsl(45 90% 50% / 0.18);
    color: hsl(45 80% 75%);
  }
  .comparative-note {
    margin-top: 0.75rem;
    font-size: 0.75rem;
    color: hsl(var(--muted-foreground));
  }
</style>
