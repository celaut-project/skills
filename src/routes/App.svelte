<script lang="ts">
  import { onMount } from "svelte";
  import { browser } from "$app/environment";
  import Theme from "./Theme.svelte";
  import { WalletButton, WalletAddressChangeHandler, walletConnected, walletAddress, walletBalance } from "wallet-svelte-component";
  // Forum is now rendered by a single full-height side-rail panel
  // (see ForumSidebar.svelte). Each "dialogue" button funnels through
  // `openForum(topicId, title)` instead of mounting its own Forum copy.
  import { web_explorer_uri_addr, web_explorer_uri_token, reputation_proof, explorer_uri, source_explorer_url } from "$lib/common/store";
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
  import RunServiceButton from "$lib/components/celaut/RunServiceButton.svelte";
  import ServiceSourceCard from "$lib/components/celaut/ServiceSourceCard.svelte";
  import ServiceInfoCard from "$lib/components/celaut/ServiceInfoCard.svelte";
  import ServiceInfoFilterBar from "$lib/components/celaut/ServiceInfoFilterBar.svelte";
  import { serviceFilters, serviceInfoRegistry, serviceMatches, resetServiceInfo } from "$lib/serviceFilters";
  import SortDropdown from "$lib/components/celaut/SortDropdown.svelte";
  import HowItWorks from "$lib/components/celaut/HowItWorks.svelte";
  import SkillLeaderboard from "$lib/components/celaut/SkillLeaderboard.svelte";
  import InfoTip from "$lib/components/celaut/InfoTip.svelte";
  import ExplorerLink from "$lib/components/celaut/ExplorerLink.svelte";
  import ProfileAvatar from "$lib/components/celaut/ProfileAvatar.svelte";
  import ClaimCoverageButton from "$lib/components/celaut/ClaimCoverageButton.svelte";
  import ShareModal from "$lib/components/celaut/ShareModal.svelte";
  import ProfileDetailsCard from "$lib/components/celaut/ProfileDetailsCard.svelte";
  import SubmitFormEnhancements from "$lib/components/celaut/SubmitFormEnhancements.svelte";
  import FormalSpecEditor from "$lib/components/celaut/FormalSpecEditor.svelte";
  import ForumSidebar from "$lib/components/celaut/ForumSidebar.svelte";
  import BackButton from "$lib/components/celaut/BackButton.svelte";
  import { openForum } from "$lib/components/celaut/forumSidebar";
  import { toasts } from "$lib/components/celaut/toastStore";
  import { portal } from "$lib/actions/portal";

  // ── API & Types ────────────────────────────────────────────────────────────
  import { formatServiceId, formatSourceHash, EXPLORER_API } from "$lib/api";
  import { fetchProfileById, type ReputationProof } from "reputation-system";
  import { loadSkills as loadSkillsFromData } from "$lib/data";
  import { createSkill, createBenchmark as createBenchmarkEntity } from "$lib/data";
  import type { Skill, Coverage, Benchmark, Result } from "$lib/types";
  import { categoryIcon, categoryColor } from "$lib/categoryIcons";
  import { calculateSkillReputation, calculateBenchmarkReputation, calculateResultReputation, formatReputation, NANOERG_PER_ERG } from "$lib/reputation";
  import {
    buildComparisonTensor,
    aggregateMetricForService,
    bucketByDescriptor,
    formatMetricValue,
    type ComparisonTensor
  } from "$lib/scoring";
  import { computeServiceScores, type ServiceScore } from "$lib/scoreGlobal";
  import { getUserProfiles, ensureUserProfile, boostProfileReputation, createAdditionalProfile, updateProfileContent } from "$lib/profileBootstrap";
  import { getMainReputationBox } from "$lib/reputationContext";
  import { demoMode } from "$lib/config";
  import { viewedProfileId, viewedNetworkId, viewedServiceId, networkPageReturn } from "$lib/stores";
  import NetworkPage from "$lib/components/celaut/NetworkPage.svelte";
  import ServicePage from "$lib/components/celaut/ServicePage.svelte";

  // ── Reputation threshold for hiding related skills ─────────────────────────
  // If skill A references skill B via extendedSkillBoxIds, and A's reputation >= this
  // threshold, then B is hidden from the main gallery (still accessible from A's detail).
  // Default 0 = any relationship hides the related skill.
  const REPUTATION_THRESHOLD = 0;

  // ── State ──────────────────────────────────────────────────────────────────
  let skills: Skill[] = [];
  let selectedSkill: Skill | null = null;
  let loading = true;
  let error: string | null = null;
  let searchQuery = "";
  // Minimum-reputation gallery filter: hide skills whose aggregate reputation
  // falls below this threshold. 0 = show everything (default).
  let minReputation = 0;
  // "" = no tab highlighted (used while the profile-detail view is open).
  let activeTab: "gallery" | "submit" | "profile" | "networks" | "howitworks" | "" = "gallery";
  let detailVisible = false;
  // When the Submit tab is reached via "Modify Skill", remember the skill the
  // user came from so we can offer a back button to its detail view (mirrors
  // the back-navigation the profile detail view has).
  let returnToSkill: Skill | null = null;
  // "Share Skill" modal (opened from the skill detail header).
  let shareModalOpen = false;
  // Deep-link target from `?skill=<boxId>`: resolved to a selected skill once
  // the gallery has loaded (see the reactive block below).
  let pendingSkillId: string | null = null;

  // ── Island header scroll behaviour ───────────────────────────────────────
  // Hide the floating header when scrolling down, reveal it when scrolling up
  // (mirrors the game-of-prompts/app navbar). A small delta threshold avoids
  // jitter on trackpads.
  let navHidden = false;

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
  let newSkillFormal = "";
  let newSkillTags = "";
  let newSkillDomain = "";
  let submitting = false;
  let submitTx: string | null = null;
  let submitError: string | null = null;

  // Create Benchmark form — multi-metric, multi-descriptor authoring
  // aligned with current Benchmark/BenchmarkCreationInput shape in types.ts.
  let benchmarkName = "";
  let benchmarkDescription = "";
  let benchmarkMetrics: { name: string; description: string; higherIsBetter: boolean }[] = [
    { name: "", description: "", higherIsBetter: true }
  ];
  let benchmarkDescriptors: { name: string; description: string }[] = [];
  let benchmarkSourceHash = "";
  let benchmarkSubmitting = false;
  let relatedSkillBoxIds: string[] = [];

  function addBenchmarkMetric() {
    benchmarkMetrics = [...benchmarkMetrics, { name: "", description: "", higherIsBetter: true }];
  }
  function removeBenchmarkMetric(i: number) {
    benchmarkMetrics = benchmarkMetrics.filter((_, idx) => idx !== i);
  }
  function addBenchmarkDescriptor() {
    benchmarkDescriptors = [...benchmarkDescriptors, { name: "", description: "" }];
  }
  function removeBenchmarkDescriptor(i: number) {
    benchmarkDescriptors = benchmarkDescriptors.filter((_, idx) => idx !== i);
  }

  // Wallet/profile bootstrap state
  let userProfiles: Awaited<ReturnType<typeof getUserProfiles>> = [];
  let profileLoading = false;
  let profileError: string | null = null;
  let profileCreateTx: string | null = null;
  let createProfileSubmitting = false;
  let profileSacrificeErg = "0";
  let lastProfileLookupKey = "";

  // ── Reputation profile actions (burn / new profile) ──────────────────────
  // Profile-data editing lives inside ProfileDetailsCard's own modal, which
  // dispatches the full key/value set via `updateProfileData` (PUT semantics).
  let showBurnModal = false;
  let burnErgAmount = "";
  let burnSubmitting = false;
  let showNewProfileModal = false;
  let newProfileSacrifice = "0";
  let newProfileSubmitting = false;
  // Source-application state
  let skillSources: FileSource[] = [];
  let showFileSourceModal = false;
  let modalFileHash = "";

  function openFileSourceModal(hash: string) {
    modalFileHash = hash;
    showFileSourceModal = true;
  }

  async function copyToClipboard(value: string, message = 'Copied to clipboard') {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      toasts.info(message);
    } catch {
      toasts.error('Failed to copy');
    }
  }

  function handleFileSourceAdded(txId: string) {
    toasts.info(`Source registered! Tx: ${txId.slice(0, 12)}…`);
    showFileSourceModal = false;
    // Reload sources for the current skill
    if (selectedSkill?.sourceHash) {
      loadSkillSources(selectedSkill.sourceHash);
    }
  }

  // Per-hash cache for source-application lookups. Selecting a skill, navigating
  // away, then returning shouldn't trigger another Explorer round-trip — the
  // source-application mapping is content-addressed by Blake2b256, so it never
  // changes for a given hash within a session.
  const fileSourceCache = new Map<string, FileSource[]>();

  async function fetchFileSourcesCached(hash: string): Promise<FileSource[]> {
    const hit = fileSourceCache.get(hash);
    if (hit) return hit;
    const fetched = (await fetchFileSourcesByHash($explorer_uri, hash)) ?? [];
    fileSourceCache.set(hash, fetched);
    return fetched;
  }

  async function loadSkillSources(hash: string) {
    try {
      skillSources = await fetchFileSourcesCached(hash);
    } catch {
      skillSources = [];
    }
  }

  // Reload sources when the selected skill changes. Gated on sourceHash because
  // skills without a declared source can never resolve in source-application.
  $: if (selectedSkill?.sourceHash) {
    loadSkillSources(selectedSkill.sourceHash);
  } else {
    skillSources = [];
  }

  // Compute reputation for selected skill — label is RELATIVE to all sibling
  // skills, so we pass the full population (thresholds built once inside).
  $: selectedSkillReputation = selectedSkill ? calculateSkillReputation(selectedSkill, skills) : null;

  // Reset the per-skill service-info registry + filters whenever the opened skill
  // changes, so stale service data from a previous skill can't leak into the
  // coverage filters.
  let lastServiceSkillId: string | null = null;
  $: if ((selectedSkill?.boxId ?? null) !== lastServiceSkillId) {
    lastServiceSkillId = selectedSkill?.boxId ?? null;
    resetServiceInfo();
  }

  // Category glyph for the detail title — swaps the old profile avatar for the
  // skill's category icon (with its accent color), mirroring SkillDetail.svelte.
  $: DetailCategoryIcon = categoryIcon(selectedSkill?.domain);

  // ── Best service highlight ────────────────────────────────────────────────
  // Surfaces the "best" service for a skill as a prominent card with a download
  // link when source-application has a binary registered for it. "Best" is the
  // Coverage whose serviceId scored highest across all benchmarks attached to
  // the skill, weighted by each benchmark's own reputation (so a service that
  // wins on a heavily-vouched benchmark beats one that wins on an obscure one).

  // A skill's "recommended" service is ranked by COMPOSITE SCORE + REPUTATION.
  // `selectedSkill.coverages` already merges direct coverage boxes AND
  // result-derived services (see loadCoverages), so it is the full candidate
  // pool. Crucially we DON'T drop services that lack comparative benchmark data:
  // the comparison tensor's z-score composite is 0 for a lone/unscored service,
  // so a unique service that only entered via a Result (composite 0, rep 0) must
  // still surface — it's simply the single best candidate.

  /**
   * Recommended service for the selected skill. Score = tensor composite score
   * (0 when the service has no comparative data) + the service's own reputation.
   * Highest score wins; a sole candidate always shows. Null only when the skill
   * has no service candidates at all.
   */
  // Computed in the MARKUP (via `{#each [computeRecommendedService(selectedSkill)]}`),
  // NOT a `$:` reactive. A skill's `coverages` get populated by in-place mutation
  // after the skill is selected (notably on a `?skill=` deep link); that mutates
  // the existing object without reassigning `selectedSkill` or `skills`, so no
  // reactive statement is ever invalidated and the card stayed permanently hidden.
  // Markup expressions re-evaluate on every render, so they always see the latest
  // coverages — the reliable place to derive this.
  function computeRecommendedService(skill: Skill | null) {
    if (!skill) return null;
    const candidates = skill.coverages.filter((c) => c.serviceId);
    if (!candidates.length) return null;
    // Rank by the SCORE.md global score (verified performance + reputation).
    // Wrapped defensively so sparse/edge-case data can't make the card vanish —
    // a sole result-derived service still surfaces (it's simply the top candidate).
    let scoreById = new Map<string, ServiceScore>();
    try {
      scoreById = new Map(computeServiceScores(skill).map((s) => [s.serviceId, s]));
    } catch {
      scoreById = new Map();
    }
    const ranked = candidates
      .map((coverage) => {
        const s = scoreById.get(coverage.serviceId!);
        return {
          coverage,
          scoreGlobal: s?.scoreGlobal ?? 0,
          scorePerf: s?.scorePerf ?? null,
          reputation: coverage.reputation ?? 0,
        };
      })
      .sort((a, b) => b.scoreGlobal - a.scoreGlobal || b.reputation - a.reputation);
    return ranked[0] ?? null;
  }

  // Optional download convenience on the recommended service (NOT part of
  // selection). Returns a STABLE promise per serviceId so the markup `{#await}`
  // doesn't re-fetch/flicker on every render.
  const NO_DOWNLOAD: Promise<FileSource | null> = Promise.resolve(null);
  const recommendedDownloadCache = new Map<string, Promise<FileSource | null>>();
  function recommendedDownloadPromise(serviceId: string | undefined): Promise<FileSource | null> {
    if (!serviceId) return NO_DOWNLOAD;
    let pr = recommendedDownloadCache.get(serviceId);
    if (!pr) {
      pr = fetchFileSourcesCached(serviceId)
        .then((srcs) =>
          srcs.length
            ? [...srcs].sort((a, b) => (b?.reputationAmount ?? 0) - (a?.reputationAmount ?? 0))[0]
            : null,
        )
        .catch(() => null);
      recommendedDownloadCache.set(serviceId, pr);
    }
    return pr;
  }

  // ── Load skills from active provider ────────────────────────────────────────
  async function loadSkills() {
    loading = true;
    error = null;
    try {
      skills = await loadSkillsFromData();
    } catch (e: any) {
      // Live mode: surface the error instead of silently swapping in mock data.
      // Demo mode: errors here would mean the mockDb itself failed — also worth surfacing.
      skills = [];
      error = e?.message || "Failed to load skills.";
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

  async function loadUserProfileState() {
    if ($demoMode || !$walletConnected) {
      userProfiles = [];
      profileError = null;
      profileCreateTx = null;
      reputation_proof.set(null);
      return;
    }

    profileLoading = true;
    profileError = null;
    try {
      const profiles = await getUserProfiles($explorer_uri);
      userProfiles = profiles;
      reputation_proof.set(profiles[0] ?? null);
    } catch (e: any) {
      userProfiles = [];
      reputation_proof.set(null);
      profileError = e?.message || "Failed to load reputation profiles.";
    } finally {
      profileLoading = false;
    }
  }

  async function handleCreateProfile() {
    if ($demoMode) {
      toasts.info("Profile creation is only needed in live mode.");
      return;
    }
    if (!$walletConnected) {
      toasts.error("Connect your wallet first.");
      return;
    }

    createProfileSubmitting = true;
    profileError = null;
    profileCreateTx = null;

    try {
      const parsedErg = Number(profileSacrificeErg || "0");
      if (!Number.isFinite(parsedErg) || parsedErg < 0) {
        throw new Error("Sacrifice must be a valid non-negative ERG amount.");
      }

      const sacrificeErg = parsedErg > 0 ? BigInt(Math.round(parsedErg * 1e9)) : 0n;
      const result = await ensureUserProfile($explorer_uri, {
        totalSupply: 1,
        sacrificeErg
      });

      if (result.status === "created") {
        profileCreateTx = result.txId;
        toasts.success("Reputation profile created.");
      } else {
        toasts.info("A reputation profile already exists for this wallet.");
      }

      await loadUserProfileState();
    } catch (e: any) {
      profileError = e?.message || "Profile creation failed.";
      toasts.error(profileError || "Profile creation failed.");
    } finally {
      createProfileSubmitting = false;
    }
  }

  function currentMainBox() {
    return getMainReputationBox($reputation_proof);
  }

  // ── Reputation profile action handlers ───────────────────────────────────
  /** Guard: profile actions are on-chain writes — live mode + wallet + proof. */
  function ensureLiveProfile(): boolean {
    if ($demoMode) {
      toasts.info("Switch off demo mode to manage your profile on-chain.");
      return false;
    }
    if (!$walletConnected) {
      toasts.error("Connect your wallet first.");
      return false;
    }
    if (!$reputation_proof) {
      toasts.error("No reputation profile loaded.");
      return false;
    }
    return true;
  }

  /** The active profile's self/main box, used as the target for writes. */
  function activeProfileBox() {
    return getMainReputationBox($reputation_proof);
  }

  function openBurnModal() {
    if (!ensureLiveProfile()) return;
    burnErgAmount = "";
    showBurnModal = true;
  }

  async function submitBurn() {
    if (!ensureLiveProfile()) return;
    const box = activeProfileBox();
    if (!box) {
      toasts.error("No profile box found to burn against.");
      return;
    }
    const parsed = Number(burnErgAmount || "0");
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toasts.error("Enter a positive ERG amount to burn.");
      return;
    }
    burnSubmitting = true;
    try {
      const nanoErg = BigInt(Math.round(parsed * 1e9));
      await boostProfileReputation($explorer_uri, box, nanoErg);
      toasts.success(`Burned ${parsed} ERG to your profile.`);
      showBurnModal = false;
      await loadUserProfileState();
    } catch (e: any) {
      toasts.error(e?.message || "Burn failed.");
    } finally {
      burnSubmitting = false;
    }
  }

  /**
   * Persist the full profile-data object (PUT semantics). The card's edit modal
   * dispatches the complete key/value set, so we write it verbatim — this both
   * adds and modifies fields in one update of the self/profile box.
   */
  async function handleUpdateProfileData(data: Record<string, unknown>) {
    if (!ensureLiveProfile()) return;
    const box = activeProfileBox();
    if (!box) {
      toasts.error("No profile box found.");
      return;
    }
    try {
      await updateProfileContent($explorer_uri, box, data);
      toasts.success("Profile data updated.");
      await loadUserProfileState();
    } catch (e: any) {
      toasts.error(e?.message || "Failed to update profile data.");
    }
  }

  /** Navigate from a profile-card entity (skill/benchmark/service/result) to its skill page. */
  function handleNavigateSkill(boxId: string) {
    const skill = skills.find((s) => s.boxId === boxId);
    viewedProfileId.set(null);
    activeTab = "gallery";
    if (skill) selectSkill(skill);
  }

  function openTab(tab: "gallery" | "submit" | "profile" | "howitworks") {
    activeTab = tab;
    if (tab === "gallery" || tab === "howitworks") {
      selectedSkill = null;
      syncSkillParam(null);
    }
    returnToSkill = null;
    viewedProfileId.set(null);
    viewedNetworkId.set(null);
    viewedServiceId.set(null);
    networkPageReturn.set(null);
    if (browser) {
      const u = new URL(window.location.href);
      u.searchParams.delete("network");
      u.searchParams.delete("service");
      window.history.pushState({}, "", u);
    }
  }

  function openNetworksTab() {
    activeTab = "networks";
    selectedSkill = null;
    returnToSkill = null;
    syncSkillParam(null);
    viewedProfileId.set(null);
    viewedServiceId.set(null);
    networkPageReturn.set(null);
    viewedNetworkId.set("browse");
    if (browser) {
      const u = new URL(window.location.href);
      u.searchParams.delete("service");
      u.searchParams.set("network", "browse");
      window.history.pushState({}, "", u);
    }
  }

  function openNewProfileModal() {
    if ($demoMode) {
      toasts.info("Switch off demo mode to create a profile.");
      return;
    }
    if (!$walletConnected) {
      toasts.error("Connect your wallet first.");
      return;
    }
    newProfileSacrifice = "0";
    showNewProfileModal = true;
  }

  async function submitNewProfile() {
    if ($demoMode || !$walletConnected) {
      toasts.error("Connect a wallet in live mode first.");
      return;
    }
    const parsed = Number(newProfileSacrifice || "0");
    if (!Number.isFinite(parsed) || parsed < 0) {
      toasts.error("Sacrifice must be a non-negative ERG amount.");
      return;
    }
    newProfileSubmitting = true;
    try {
      const sacrificeErg = parsed > 0 ? BigInt(Math.round(parsed * 1e9)) : 0n;
      await createAdditionalProfile($explorer_uri, { totalSupply: 1, sacrificeErg });
      toasts.success("New reputation profile created.");
      showNewProfileModal = false;
      await loadUserProfileState();
    } catch (e: any) {
      toasts.error(e?.message || "Failed to create profile.");
    } finally {
      newProfileSubmitting = false;
    }
  }

  /** Switch the globally-active profile to another one held by the wallet. */
  function handleSelectProfile(tokenId: string) {
    const next = userProfiles.find((p) => p.token_id === tokenId);
    if (!next) return;
    reputation_proof.set(next);
    toasts.info(`Switched to profile ${tokenId.slice(0, 6)}…`);
  }

  function requireProfileForWrite(): boolean {
    if ($demoMode) return true;
    if (!$walletConnected) {
      toasts.error("Connect your wallet first.");
      return false;
    }
    if (!currentMainBox()) {
      toasts.error("Create a reputation profile first.");
      return false;
    }
    return true;
  }

  // Reload when demo mode or wallet state changes
  let demoModeInitialized = false;
  $: {
    const _dm = $demoMode;
    if (browser && demoModeInitialized) {
      loadSkills();
    }
    demoModeInitialized = true;
  }

  $: {
    const profileLookupKey = `${$demoMode}:${$walletConnected}:${$walletAddress || ""}`;
    if (browser && profileLookupKey !== lastProfileLookupKey) {
      lastProfileLookupKey = profileLookupKey;
      loadUserProfileState();
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

  // ── Compute which boxIds are subsumed by a higher-reputation skill ───────
  // A skill B is hidden if another skill A references B in extendedSkillBoxIds
  // AND A's reputation >= REPUTATION_THRESHOLD AND A's reputation is strictly
  // greater than B's reputation. The strict-greater check stops a low-rep
  // descendant from masking a higher-rep ancestor (e.g. demo-img-003 rep 13
  // extending demo-img-001 rep 28 would otherwise hide the canonical entry).
  $: hiddenBoxIds = (() => {
    const hidden = new Set<string>();
    const skillByBoxId = new Map(skills.map((s) => [s.boxId, s] as const));
    for (const skill of skills) {
      const rep = calculateSkillReputation(skill).total;
      if (rep < REPUTATION_THRESHOLD || skill.extendedSkillBoxIds.length === 0) continue;
      for (const refId of skill.extendedSkillBoxIds) {
        const target = skillByBoxId.get(refId);
        if (!target) continue;
        const targetRep = calculateSkillReputation(target).total;
        if (rep > targetRep) hidden.add(refId);
      }
    }
    return hidden;
  })();

  // Collapse same-named submissions to the highest-reputation instance so the
  // gallery shows the canonical "Image Classification" (etc.) card. The other
  // submissions remain reachable from the skill-detail view via the
  // `siblingSkills` dropdown, which already lists every concurrent entry with
  // its own reputation badge.
  function pickCanonicalByName(list: Skill[]): Skill[] {
    const byName = new Map<string, Skill>();
    for (const s of list) {
      const current = byName.get(s.name);
      if (!current) {
        byName.set(s.name, s);
        continue;
      }
      const currentRep = calculateSkillReputation(current).total;
      const candidateRep = calculateSkillReputation(s).total;
      if (candidateRep > currentRep) byName.set(s.name, s);
    }
    return Array.from(byName.values());
  }

  // Apply the minimum-reputation gallery filter on top of search/category.
  // `minErg` is entered by the user in ERG; stored reputation is nanoERG, so we
  // convert before comparing.
  function filterByReputation(list: Skill[], minErg: number): Skill[] {
    if (!minErg || minErg <= 0) return list;
    const minNanoErg = minErg * NANOERG_PER_ERG;
    return list.filter(s => calculateSkillReputation(s).total >= minNanoErg);
  }

  $: displayedSkills = sortSkills(
    pickCanonicalByName(
      filterByReputation(
        filterByCategory(filtered, activeCategory).filter(s => !hiddenBoxIds.has(s.boxId)),
        minReputation
      )
    ),
    currentSort
  );
  $: totalServices = skills.reduce((sum, s) => sum + s.coverages.length, 0);
  $: totalResults = skills.reduce((sum, s) => sum + s.resultCount, 0);

  // Gallery counter reconciliation: the StatsBar shows every Skill on-chain, but
  // the listing hides skills that are nested under a higher-reputation parent
  // (extendedSkillBoxIds) or collapsed as duplicate-named submissions. When no
  // user filter is active, the gap between the two numbers is exactly those
  // hidden entries — surface it so the counts reconcile for the user.
  $: galleryUnfiltered = !searchQuery && activeCategory === "all" && (!minReputation || minReputation <= 0);
  $: hiddenFromListing = Math.max(0, skills.length - displayedSkills.length);

  // Track duplicate skill names to flag concurrent submissions. Anyone can post
  // a skill with the same human name as another — the chain doesn't enforce
  // uniqueness — so the UI must surface "this name is claimed by N others" and
  // let users jump between them via the sibling dropdown below.
  $: skillNameCounts = skills.reduce((acc, s) => {
    acc[s.name] = (acc[s.name] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // Sibling skills sharing the selected skill's name (excluding itself). Hoisted
  // out of the template so it's recomputed only when skills/selectedSkill
  // actually change, not on every render of the detail view.
  $: siblingSkills = selectedSkill
    ? skills.filter((s) => s.name === selectedSkill!.name && s.boxId !== selectedSkill!.boxId)
    : [];

  // Canonical topic id for the relationship between two skills. The id is
  // strictly `{skill_nueva}_{skill_antigua}` — newer box first, older second —
  // ordered by creation height (tie-broken by boxId for determinism). Ordering
  // by age means both skills resolve the pair to the SAME topic, so the debate
  // about how related they are lives in one shared thread rather than two.
  function relationshipTopicId(a: Skill, b: Skill): string {
    const aH = a.creationHeight ?? 0;
    const bH = b.creationHeight ?? 0;
    const aNewer = aH !== bH ? aH > bH : a.boxId > b.boxId;
    const [nueva, antigua] = aNewer ? [a, b] : [b, a];
    return `${nueva.boxId}_${antigua.boxId}`;
  }

  // Open the shared relationship discussion for the selected skill and a sibling.
  // Guarded here (not in the template) so the null-narrowing of `selectedSkill`
  // happens in TS rather than via a non-null assertion in a Svelte handler.
  function discussRelationship(sibling: Skill): void {
    if (!selectedSkill) return;
    openForum(
      relationshipTopicId(selectedSkill, sibling),
      `Relation: ${selectedSkill.name} ↔ ${sibling.name}`
    );
  }

  type RelatedSkillDirection = "outgoing" | "incoming" | "both";

  type RelatedSkillLink = {
    skill: Skill;
    direction: RelatedSkillDirection;
  };

  function relatedSkillDirectionLabel(direction: RelatedSkillDirection): string {
    switch (direction) {
      case "outgoing":
        return "references";
      case "incoming":
        return "referenced by";
      case "both":
        return "mutual";
    }
  }

  $: relatedSkills = selectedSkill
    ? (() => {
        const related = new Map<string, RelatedSkillLink>();

        const addRelated = (skill: Skill, direction: RelatedSkillDirection) => {
          const existing = related.get(skill.boxId);
          if (!existing) {
            related.set(skill.boxId, { skill, direction });
            return;
          }
          if (existing.direction !== direction) {
            existing.direction = "both";
          }
        };

        for (const refId of selectedSkill.extendedSkillBoxIds) {
          const match = skills.find((s) => s.boxId === refId);
          if (match && match.boxId !== selectedSkill.boxId) {
            addRelated(match, "outgoing");
          }
        }

        for (const skill of skills) {
          if (skill.boxId === selectedSkill.boxId) continue;
          if (skill.extendedSkillBoxIds.includes(selectedSkill.boxId)) {
            addRelated(skill, "incoming");
          }
        }

        return [...related.values()];
      })()
    : [];

  /**
   * Composite score for one service across the skill's full (benchmark × metric)
   * tensor — delegates to scoring.ts so the aggregation rule lives in one place.
   * See the TODO header in scoring.ts for the open Josemi questions on
   * aggregation/normalization.
   */
  function computeServiceCompositeScore(serviceId: string | undefined, skill: Skill): number {
    if (!serviceId) return 0;
    const tensor = buildComparisonTensor(skill);
    const row = tensor.rows.find((r) => r.serviceId === serviceId);
    return row?.composite ?? 0;
  }

  function formatHash(hash: string | undefined): string {
    if (!hash || hash.length <= 16) return hash || '-';
    return `${hash.slice(0, 8)}…${hash.slice(-4)}`;
  }

  // ── Skill deep-link sync ─────────────────────────────────────────────────
  // Keep `?skill=<boxId>` in the URL in sync with the open skill-detail view so
  // a skill page can be shared or refreshed (mirrors the `?profile=` handling).
  // Only pushes a history entry when the param actually changes to avoid
  // duplicate entries (e.g. when resolving an initial deep link).
  function syncSkillParam(boxId: string | null): void {
    if (!browser) return;
    const current = new URL(window.location.href);
    const currentParam = current.searchParams.get("skill");
    if (boxId) {
      if (currentParam === boxId) return;
      current.searchParams.set("skill", boxId);
    } else {
      if (!currentParam) return;
      current.searchParams.delete("skill");
    }
    window.history.pushState({}, "", current);
  }

  // ── Select skill with transition ───────────────────────────────────────────
  function selectSkill(skill: Skill) {
    detailVisible = false;
    selectedSkill = skill;
    detailTab = "benchmarks";
    selectedBenchmarkId = null;
    showCreateBenchmarkForm = false;
    syncSkillParam(skill.boxId);
    setTimeout(() => { detailVisible = true; }, 50);
    if (browser) window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function backToGallery() {
    detailVisible = false;
    syncSkillParam(null);
    setTimeout(() => { selectedSkill = null; }, 200);
  }

  // ── Fork / Edit skill ──────────────────────────────────────────────────────
  // Pre-populates the Submit form with the selected skill's data and switches view.
  // Adds the original skill's boxId to extendedSkillBoxIds so the new skill references it.
  let prefillRelatedBoxIds: string[] = [];

  function forkSkill(skill: Skill) {
    newSkillName = skill.name;
    newSkillProse = skill.prose;
    newSkillFormal = skill.formal ?? '';
    newSkillDomain = skill.domain;
    newSkillTags = skill.tags.join(', ');
    prefillRelatedBoxIds = [skill.boxId];
    relatedSkillBoxIds = [skill.boxId, ...skill.extendedSkillBoxIds];
    // Switch to submit tab, remembering where we came from so the Submit view
    // can offer a "Back to skill" button (Task: modify-skill back-navigation).
    returnToSkill = skill;
    selectedSkill = null;
    syncSkillParam(null);
    activeTab = "submit";
    if (browser) window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Return from the Submit ("Modify Skill") view to the skill detail the user
  // came from. Clears the remembered skill so the button only shows when
  // relevant.
  function backToSkillFromSubmit() {
    const skill = returnToSkill;
    returnToSkill = null;
    if (skill) {
      activeTab = "gallery";
      selectSkill(skill);
    }
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
    if (!requireProfileForWrite()) { submitError = !$walletConnected ? "Connect your wallet first." : "Create a reputation profile first."; return; }
    if (!newSkillName.trim()) { submitError = "Name is required."; validationErrors = { name: "Skill name is required." }; return; }

    submitting = true;
    submitError = null;
    submitTx = null;
    try {
      const txId = await createSkill({
        name: newSkillName.trim(),
        prose: newSkillProse.trim(),
        formal: newSkillFormal.trim(),
        tags: newSkillTags.split(",").map((t) => t.trim()).filter(Boolean),
        domain: newSkillDomain.trim(),
        extendedSkillBoxIds: [...relatedSkillBoxIds],
        sourceHash: "",
        tokenAmount: 1,
        mainBox: currentMainBox(),
      });
      submitTx = txId;
      await refreshSkills();
      toasts.success($demoMode ? "Skill submitted successfully (demo mode)." : "Skill published on-chain.");
      newSkillName = '';
      newSkillProse = '';
      newSkillFormal = '';
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
    const cleanedMetrics = benchmarkMetrics
      .map((m) => ({ name: m.name.trim(), description: m.description.trim(), higherIsBetter: !!m.higherIsBetter }))
      .filter((m) => m.name);
    if (cleanedMetrics.length === 0) {
      toasts.error("At least one performance metric is required.");
      return;
    }
    const cleanedDescriptors = benchmarkDescriptors
      .map((d) => ({ name: d.name.trim(), description: d.description.trim() }))
      .filter((d) => d.name);
    if (!requireProfileForWrite()) {
      return;
    }

    benchmarkSubmitting = true;
    try {
      await createBenchmarkEntity({
        skillBoxId: selectedSkill.boxId,
        name: benchmarkName.trim(),
        description: benchmarkDescription.trim(),
        caseDescriptors: cleanedDescriptors,
        performanceMetrics: cleanedMetrics,
        sourceHash: benchmarkSourceHash.trim() || undefined,
        mainBox: currentMainBox()
      });
      await refreshSkills(selectedSkill.boxId);
      toasts.success($demoMode ? "Benchmark created (demo mode)." : "Benchmark published on-chain.");
      benchmarkName = "";
      benchmarkDescription = "";
      benchmarkMetrics = [{ name: "", description: "", higherIsBetter: true }];
      benchmarkDescriptors = [];
      benchmarkSourceHash = "";
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
   * Per-benchmark breakdown of a service's results, grouped by descriptor
   * tuple. Each block has:
   *   - benchmark + its descriptor/metric schema
   *   - aggregateMetrics — median across every case (the headline number)
   *   - descriptorRows   — one row per unique caseMeta tuple, with per-metric
   *                        medians at that bucket
   *
   * This is the data the Coverages tab renders so a service's strength on a
   * particular descriptor sub-region (e.g. "fast at small batch, slow at
   * large") is visible, not flattened away.
   */
  interface ServiceBenchmarkBlock {
    benchmark: Benchmark;
    descriptors: { name: string; description?: string }[];
    metrics: { name: string; description?: string; higherIsBetter: boolean }[];
    aggregateMetrics: Array<{
      value: number | null;
      resultsReputation: number;
      caseCount: number;
      resultCount: number;
    }>;
    descriptorRows: Array<{
      caseMeta: number[];
      perMetric: Array<number | null>;
      caseCount: number;
    }>;
  }

  // ── "All cases (median)" expansion state ──────────────────────────────────
  // When a coverage's benchmark has no descriptors we collapse every case into
  // a single median row. Clicking that row expands the individual per-case
  // values so reviewers can audit the aggregate, keyed per (service, benchmark).
  let expandedAllCases: Record<string, boolean> = {};
  function allCasesKey(serviceId: string | undefined, benchmarkId: string): string {
    return `${serviceId ?? ''}::${benchmarkId}`;
  }
  function toggleAllCases(serviceId: string | undefined, benchmarkId: string): void {
    const key = allCasesKey(serviceId, benchmarkId);
    expandedAllCases = { ...expandedAllCases, [key]: !expandedAllCases[key] };
  }
  function collectIndividualCases(
    serviceId: string | undefined,
    benchmark: Benchmark
  ): Array<{ resultId: string; caseIndex: number; metricsValues: Array<number | null>; timestamp?: number }> {
    if (!serviceId) return [];
    const rows: Array<{ resultId: string; caseIndex: number; metricsValues: Array<number | null>; timestamp?: number }> = [];
    for (const r of benchmark.results) {
      if (r.serviceId !== serviceId) continue;
      const data = (r as any).data as Array<{ caseMeta: number[]; metricsValues: number[] }> | undefined;
      if (!Array.isArray(data) || data.length === 0) continue;
      data.forEach((c, i) => {
        rows.push({
          resultId: r.id,
          caseIndex: i,
          metricsValues: c.metricsValues.map((v) => (typeof v === 'number' ? v : null)),
          timestamp: (r as any).timestamp
        });
      });
    }
    return rows;
  }

  function collectServiceResults(
    serviceId: string | undefined,
    skill: Skill
  ): ServiceBenchmarkBlock[] {
    if (!serviceId) return [];
    const blocks: ServiceBenchmarkBlock[] = [];
    for (const bench of skill.benchmarks) {
      const metrics = bench.performanceMetrics ?? [];
      const descriptors = bench.caseDescriptors ?? [];
      if (metrics.length === 0) continue;

      const aggregateMetrics = metrics.map((_m, i) =>
        aggregateMetricForService(bench, serviceId, i)
      );
      // Skip benchmarks the service hasn't touched.
      if (aggregateMetrics.every((a) => a.resultCount === 0)) continue;

      const buckets = bucketByDescriptor(bench).filter((b) => b.serviceValues.has(serviceId));
      const descriptorRows = buckets.map((b) => ({
        caseMeta: b.caseMeta,
        perMetric: b.serviceValues.get(serviceId) ?? Array(metrics.length).fill(null),
        caseCount: b.caseCount
      }));

      blocks.push({
        benchmark: bench,
        descriptors,
        metrics,
        aggregateMetrics,
        descriptorRows
      });
    }
    return blocks;
  }

  /**
   * Comparison view = the full (service × metric-column) tensor.
   * See scoring.ts for column definitions and aggregation rules.
   */
  function buildComparisonMatrix(skill: Skill): ComparisonTensor {
    return buildComparisonTensor(skill);
  }

  onMount(() => {
    if (browser) {
      // Demo mode is URL-only and session-scoped: `?env=demo` (or `?env=dev`)
      // flips it on for this page load. No persistence — reloading without
      // the param goes back to live data (default false in config.ts).
      const url = new URL(window.location.href);
      const env = url.searchParams.get("env");
      if (env === "demo" || env === "dev") demoMode.set(true);
      const initialProfile = url.searchParams.get("profile");
      if (initialProfile) viewedProfileId.set(initialProfile);
      const initialSkill = url.searchParams.get("skill");
      if (initialSkill) pendingSkillId = initialSkill;
      const initialNetwork = url.searchParams.get("network");
      if (initialNetwork) {
        viewedNetworkId.set(initialNetwork);
        activeTab = "networks";
      }
      const initialService = url.searchParams.get("service");
      if (initialService) viewedServiceId.set(initialService);
      // Only now that the initial deep-link params have been consumed may the
      // reactive URL-sync touch the address bar — otherwise it runs during init
      // (before this onMount) and strips `?profile=`/`?skill=` before they're read.
      urlSyncEnabled = true;
      loadSkills();

      // Back/forward button: keep the profile- and skill-detail views in sync
      // with the URL (`?profile=` / `?skill=`).
      const popHandler = () => {
        const params = new URL(window.location.href).searchParams;
        viewedProfileId.set(params.get("profile") || null);
        const nextNetwork = params.get("network");
        viewedNetworkId.set(nextNetwork || null);
        if (nextNetwork) activeTab = "networks";
        viewedServiceId.set(params.get("service") || null);
        const nextSkill = params.get("skill");
        if (nextSkill) {
          const match = skills.find((s) => s.boxId === nextSkill);
          if (match) {
            selectedSkill = match;
            detailVisible = true;
          }
        } else {
          selectedSkill = null;
          detailVisible = false;
        }
      };
      window.addEventListener("popstate", popHandler);

      // Island-header scroll behaviour: the header is shown only at the top of
      // the page. Once the user scrolls past the threshold it stays hidden in
      // both directions (no scroll-up reveal) — they reach it by returning to
      // the top. requestAnimationFrame throttles the work.
      let scrollTicking = false;
      const updateNav = () => {
        const y = window.scrollY;
        navHidden = y > 80;
        scrollTicking = false;
      };
      const scrollHandler = () => {
        if (!scrollTicking) {
          scrollTicking = true;
          requestAnimationFrame(updateNav);
        }
      };
      window.addEventListener("scroll", scrollHandler, { passive: true });

      return () => {
        window.removeEventListener("popstate", popHandler);
        window.removeEventListener("scroll", scrollHandler);
      };
    }
  });

  // Mirror the active profile into the URL (`?profile=`) so the view is
  // bookmarkable/shareable and back/forward restores it. This covers BOTH
  // another user's profile (`viewedProfileId`) and the connected user's own
  // Profile tab (`activeTab === "profile"`).
  //
  // While any profile is on screen we also drop a stale `?skill=`: the
  // in-session "back to skill" button is driven by in-memory `returnToSkill`,
  // not the URL, so removing the param means someone opening a shared
  // `?profile=` link just sees the profile — no leftover skill, no dangling
  // back-navigation that only made sense in the original user's session.
  let lastSyncedProfileParam: string | null | undefined = undefined;
  // Enabled at the end of onMount, once initial `?profile=`/`?skill=` deep links
  // have been read — guards against this reactive stripping them during init.
  let urlSyncEnabled = false;
  $: desiredProfileParam =
    $viewedProfileId ??
    (activeTab === "profile" ? $reputation_proof?.token_id ?? null : null);
  $: if (browser && urlSyncEnabled && lastSyncedProfileParam !== desiredProfileParam) {
    const current = new URL(window.location.href);
    const currentParam = current.searchParams.get("profile");
    let changed = false;
    if (desiredProfileParam) {
      if (currentParam !== desiredProfileParam) {
        current.searchParams.set("profile", desiredProfileParam);
        changed = true;
      }
      if (current.searchParams.has("skill")) {
        current.searchParams.delete("skill");
        changed = true;
      }
    } else if (currentParam) {
      current.searchParams.delete("profile");
      changed = true;
    }
    if (changed) window.history.pushState({}, "", current);
    lastSyncedProfileParam = desiredProfileParam;
  }

  // Clear the tab highlight whenever a profile-detail view is open: the
  // profile view renders independently of the tabs (it short-circuits the
  // {#if $viewedProfileId} block), so no tab should appear "active".
  $: if ($viewedProfileId) activeTab = "";

  // Resolve a `?skill=<boxId>` deep link once the gallery has loaded: select the
  // matching skill so a shared link opens straight to its detail view.
  $: if (pendingSkillId && skills.length) {
    const match = skills.find((s) => s.boxId === pendingSkillId);
    pendingSkillId = null;
    if (match) {
      activeTab = "gallery";
      selectSkill(match);
    }
  }

  function closeProfileView(): void {
    viewedProfileId.set(null);
    // Restore the gallery so the main content isn't left blank (activeTab
    // was emptied while the profile view was open).
    activeTab = "gallery";
  }

  // ── Viewed-profile reputation proof ────────────────────────────────────────
  // Clicking a profile opens the SAME reputation-profile card the connected
  // user sees for their own profile, but read-only when it isn't theirs. We
  // need that profile's on-chain ReputationProof to render the card; the user's
  // own proof is already in the store, so reuse it when ids match and otherwise
  // fetch by id.
  let viewedProfileProof: ReputationProof | null = null;
  let viewedProfileLoading = false;
  // True when the viewed profile is the connected user's own profile — the only
  // case where the card stays editable.
  $: isOwnViewedProfile = !!$viewedProfileId && $reputation_proof?.token_id === $viewedProfileId;

  $: loadViewedProfileProof($viewedProfileId, $reputation_proof);

  async function loadViewedProfileProof(
    pid: string | null,
    ownProof: ReputationProof | null,
  ): Promise<void> {
    if (!pid) {
      viewedProfileProof = null;
      viewedProfileLoading = false;
      return;
    }
    if (ownProof && ownProof.token_id === pid) {
      viewedProfileProof = ownProof;
      viewedProfileLoading = false;
      return;
    }
    viewedProfileLoading = true;
    viewedProfileProof = null;
    try {
      const proof = await fetchProfileById(EXPLORER_API, pid);
      // Guard against a stale response if the user navigated on in the meantime.
      if (pid === $viewedProfileId) viewedProfileProof = proof ?? null;
    } catch {
      if (pid === $viewedProfileId) viewedProfileProof = null;
    } finally {
      if (pid === $viewedProfileId) viewedProfileLoading = false;
    }
  }
</script>

<!-- ── Demo mode topbar ───────────────────────────────────────────────────── -->
{#if $demoMode}
  <div class="demo-bar">
    DEMO MODE — using mock data, no on-chain calls
  </div>
{/if}

<!-- ── Header ─────────────────────────────────────────────────────────────── -->
<header
  class="navbar-container"
  class:navbar-with-demo-bar={$demoMode}
  class:navbar-hidden={navHidden}
>
  <div class="navbar-content">
    <!-- Single-row island header: logo · tabs · wallet/theme. Search now lives
         in the gallery view itself, so the old second-level row is gone. -->
    <div class="navbar-top">
      <a href="/" class="logo-container" on:click|preventDefault={() => openTab("gallery")}>
        <span class="logo-text">Unstoppable Skills</span>
      </a>

      <nav class="navbar-tabs">
        <button
          class="tab-btn"
          class:active={activeTab === "gallery"}
          on:click={() => openTab("gallery")}
        >
          Gallery
        </button>
        <button
          class="tab-btn"
          class:active={activeTab === "submit"}
          on:click={() => openTab("submit")}
        >
          Submit
        </button>
        <button
          class="tab-btn"
          class:active={activeTab === "profile"}
          on:click={() => openTab("profile")}
        >
          Profile
        </button>
        <button
          class="tab-btn"
          class:active={activeTab === "networks"}
          on:click={openNetworksTab}
        >
          Networks
        </button>
        <button
          class="tab-btn"
          class:active={activeTab === "howitworks"}
          on:click={() => openTab("howitworks")}
        >
          How it works
        </button>
      </nav>

      <div class="flex items-center gap-3">
        <WalletButton explorerUrl={$web_explorer_uri_addr} />
        <Theme />
      </div>
    </div>
  </div>
</header>

<!-- ── Main ────────────────────────────────────────────────────────────────── -->
<main class="main-content">

  {#if $viewedNetworkId}
    <!-- ── Network Definition Page (?network=<box_id|"new">) ─────────────── -->
    <div class="detail-view detail-visible">
      <NetworkPage
        networkId={$viewedNetworkId}
        on:back={() => {
          const ret = $networkPageReturn;
          viewedNetworkId.set(null);
          if (typeof window !== 'undefined') {
            const u = new URL(window.location.href);
            u.searchParams.delete('network');
            window.history.pushState({}, '', u);
          }
          if (ret?.type === 'service' && ret.serviceId) {
            viewedServiceId.set(ret.serviceId);
            if (typeof window !== 'undefined') {
              const u = new URL(window.location.href);
              u.searchParams.set('service', ret.serviceId);
              window.history.pushState({}, '', u);
            }
          } else {
            activeTab = "gallery";
          }
        }}
      />
    </div>

  {:else if $viewedServiceId}
    <!-- ── Service Page (?service=<serviceId>) ───────────────────────────── -->
    <div class="detail-view detail-visible">
      <ServicePage
        serviceId={$viewedServiceId}
        {skills}
        on:back={() => {
          viewedServiceId.set(null);
          if (typeof window !== 'undefined') {
            const u = new URL(window.location.href);
            u.searchParams.delete('service');
            window.history.pushState({}, '', u);
          }
        }}
        on:navigateSkill={(e) => {
          viewedServiceId.set(null);
          if (typeof window !== 'undefined') {
            const u = new URL(window.location.href);
            u.searchParams.delete('service');
            window.history.pushState({}, '', u);
          }
          handleNavigateSkill(e.detail);
        }}
      />
    </div>

  {:else if $viewedProfileId}
    <!-- ── Profile Detail (?profile=<token_id>) ─────────────────────────── -->
    <div class="detail-view detail-visible">
      <div class="detail-container">
        <BackButton label="Close profile" on:click={closeProfileView} />

        <div class="detail-card">
          <div class="flex items-center gap-3 mb-3">
            <ProfileAvatar profileId={$viewedProfileId} size={48} clickable={false} title={`Profile ${$viewedProfileId}`} />
            <div class="min-w-0">
              <h1 class="text-2xl md:text-3xl font-extrabold">
                {isOwnViewedProfile ? "Your Profile" : "Profile"}
              </h1>
              <code class="font-mono text-xs break-all text-muted-foreground">{$viewedProfileId}</code>
            </div>
            {#if !isOwnViewedProfile}
              <span class="profile-readonly-badge" title="You are viewing another profile — actions are disabled.">Read-only</span>
            {/if}
          </div>
        </div>

        <!-- Same reputation-profile card the connected user sees, but read-only
             unless this is the user's own profile. Passing the full `skills`
             list lets the card self-compute the same contributions (skills,
             benchmarks, services, results) it shows for the own profile. -->
        {#if viewedProfileLoading}
          <div class="detail-card">
            <p class="text-muted-foreground text-sm">Loading reputation profile…</p>
          </div>
        {:else if viewedProfileProof}
          <ProfileDetailsCard
            proof={viewedProfileProof}
            readOnly={!isOwnViewedProfile}
            skills={skills}
            on:navigateSkill={(e) => handleNavigateSkill(e.detail)}
          />
        {:else}
          <div class="detail-card">
            <p class="text-muted-foreground text-sm">No on-chain reputation profile could be loaded for this id.</p>
          </div>
        {/if}

      </div>
    </div>

  {:else if activeTab === "gallery"}

    {#if selectedSkill}
      <!-- ── Skill Detail ──────────────────────────────────────────────────── -->
      <div class="detail-view" class:detail-visible={detailVisible}>
        <div class="detail-container">
          <BackButton label="Back to gallery" on:click={backToGallery} />

          <ShareModal
            bind:open={shareModalOpen}
            skillName={selectedSkill.name}
            skillBoxId={selectedSkill.boxId}
            description={selectedSkill.prose}
          />

          <!-- Skill header card -->
          <div class="detail-card">
            <div class="flex flex-wrap gap-3 items-start justify-between mb-4">
              <div class="flex flex-wrap items-center gap-3 min-w-0">
                <span
                  class="detail-category-icon"
                  style="color: hsl({categoryColor(selectedSkill.domain)});"
                  title={`Category: ${selectedSkill.domain || 'Other'}`}
                  aria-hidden="true"
                >
                  <svelte:component this={DetailCategoryIcon} size={26} strokeWidth={1.8} />
                </span>
                <h1 class="text-2xl md:text-3xl font-extrabold">{selectedSkill.name}</h1>
                <InfoTip title="What is a Skill?">
                  <p>A <strong>Skill</strong> is an on-chain declaration of a capability: a name, a prose description (what an agent must accomplish), an optional formal spec, and tags. Services <em>cover</em> a skill by claiming they can perform it, and <em>benchmarks</em> measure how well.</p>
                  <p>Each skill is a UTXO of the Skill Type NFT — click the explorer icon next to it to see the box on-chain.</p>
                </InfoTip>
                <ExplorerLink boxId={selectedSkill.boxId} liveTooltip="View Skill box on Ergo Explorer" />
                {#if selectedSkillReputation}
                  <span class="detail-reputation-badge" title="Reputation: {selectedSkillReputation.label}">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                    {formatReputation(selectedSkillReputation.total)}
                    <span class="detail-reputation-label">{selectedSkillReputation.label}</span>
                  </span>
                  <InfoTip title="Skill reputation">
                    <p>Sum of the burn-backed reputation of the Skill's profile plus its coverages, benchmarks, and results. Computed from on-chain <code>create_opinion</code> proofs via the <code>reputation-system</code> library.</p>
                    <p>Labels (Trusted / Verified / Endorsed) are thresholds, not separate scores.</p>
                  </InfoTip>
                {/if}
              </div>
              {#if selectedSkill.domain}
                <span class="detail-domain-badge">{selectedSkill.domain}</span>
              {/if}
              <div class="detail-header-actions">
                <button class="share-skill-btn" on:click={() => (shareModalOpen = true)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                  </svg>
                  Share
                </button>
                <button class="fork-skill-btn" on:click={() => selectedSkill && forkSkill(selectedSkill)}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><circle cx="18" cy="6" r="3"/><path d="M18 9v1a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V9"/><line x1="12" y1="12" x2="12" y2="15"/>
                  </svg>
                  Modify Skill
                </button>
              </div>
            </div>
            <p class="skill-detail-prose">{selectedSkill.prose || "No description."}</p>
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
                    webExplorerUriTkn={$web_explorer_uri_token}
                  />
                  {#if $reputation_proof}
                    <button class="add-source-btn mt-2" on:click={() => openFileSourceModal(selectedSkill?.sourceHash || '')}>
                      + Add Download Source
                    </button>
                  {/if}
                </div>
              </details>
            {/if}
            <!-- Current submissions — other on-chain submissions of this same
                 skill (siblings: same name, different boxId). Always rendered,
                 with an empty state when there are none. -->
            <div class="submissions-block">
              <div class="submissions-head">
                <span class="submissions-label">Current submissions for this skill</span>
                <InfoTip title="Current submissions">
                  <p>Other on-chain <strong>submissions</strong> of this same skill — entries published with the same name but a different Box ID (alternative versions or authors).</p>
                  <p>Each is its own Skill UTXO; select one to view its services, benchmarks and reputation.</p>
                </InfoTip>
              </div>
              {#if siblingSkills.length === 0}
                <p class="submissions-empty">No other submissions for this skill yet.</p>
              {:else}
                <ul class="duplicate-notice-list">
                  {#each siblingSkills as sibling (sibling.boxId)}
                    {@const sibRep = calculateSkillReputation(sibling).total}
                    <li class="duplicate-notice-row">
                      <button type="button" class="duplicate-notice-item" on:click={() => selectSkill(sibling)}>
                        <ProfileAvatar profileId={sibling.profileId} size={16} title={`Submitted by ${sibling.profileId}`} />
                        <span class="duplicate-notice-item-name">{sibling.name}</span>
                        {#if sibling.domain}
                          <span class="duplicate-notice-item-domain">{sibling.domain}</span>
                        {/if}
                        <span class="duplicate-notice-item-rep" title="Reputation">
                          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                          </svg>
                          {formatReputation(sibRep)}
                        </span>
                        <span class="duplicate-notice-item-box">{formatSourceHash(sibling.boxId)}</span>
                      </button>
                      {#if selectedSkill}
                        <button
                          type="button"
                          class="duplicate-notice-discuss"
                          title={`Discuss relationship: ${selectedSkill.name} ↔ ${sibling.name}`}
                          aria-label={`Discuss relationship between ${selectedSkill.name} and ${sibling.name}`}
                          on:click|stopPropagation={() => discussRelationship(sibling)}
                        >
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                          </svg>
                        </button>
                      {/if}
                    </li>
                  {/each}
                </ul>
              {/if}
            </div>
            <div class="flex flex-wrap gap-2 mb-5">
              {#each selectedSkill.tags as tag}
                <span class="detail-tag">{tag}</span>
              {/each}
            </div>

            <!-- On-chain identifiers, folded into the main card (no separate box). -->
            <div class="detail-meta-row">
              <span class="detail-meta-item">
                <span class="detail-meta-label">Box ID</span>
                <code class="detail-meta-value">{selectedSkill.boxId}</code>
              </span>
              {#if selectedSkill.sourceHash}
                <span class="detail-meta-item">
                  <span class="detail-meta-label">Source Hash</span>
                  <code class="detail-meta-value">{formatSourceHash(selectedSkill.sourceHash)}</code>
                  <button
                    class="detail-meta-copy"
                    title="Copy full hash"
                    on:click={() => copyToClipboard(selectedSkill?.sourceHash || '', 'Hash copied to clipboard')}
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                    </svg>
                  </button>
                </span>
              {/if}
              <!-- Skill creator (submitter): icon + profile id, on its own bottom row. -->
              <span class="detail-meta-item detail-meta-creator">
                <span class="detail-meta-label">Creator</span>
                <ProfileAvatar profileId={selectedSkill.profileId} size={20} title={`Skill submitted by ${selectedSkill.profileId}`} />
                <code class="detail-meta-value">{selectedSkill.profileId}</code>
              </span>
            </div>
          </div>

          <!-- Recommended service: ranked by composite score + reputation; the
               sole/unscored service still surfaces (composite 0). Computed via
               the single-element {#each} so it re-derives on every render (see
               computeRecommendedService — coverages mutate in place and no $:
               reactive would catch it). -->
          {#each [computeRecommendedService(selectedSkill)] as recommendedService (recommendedService?.coverage.serviceId ?? 'none')}
            {#if recommendedService}
            <section class="best-service-card">
              <div class="best-service-eyebrow">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
                Recommended service for this skill
              </div>
              <div class="best-service-body">
                <div class="best-service-text">
                  <div class="best-service-name">{recommendedService.coverage.serviceId ? recommendedService.coverage.serviceId.slice(0, 8) : 'Unnamed Service'}</div>
                  {#if recommendedService.coverage.serviceId}
                    <code class="best-service-id">{formatServiceId(recommendedService.coverage.serviceId)}</code>
                  {/if}
                </div>
                <div class="best-service-score">
                  <span class="best-service-score-value">{recommendedService.scoreGlobal.toFixed(2)}</span>
                  <span class="best-service-score-label">global score</span>
                  <span class="best-service-rep">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                    </svg>
                    <span class="best-service-rep-value">{formatReputation(recommendedService.reputation)}</span>
                    <span class="best-service-rep-label">reputation</span>
                  </span>
                  <InfoTip title="Why this service is recommended">
                    <p>Ranked by its <strong>global score</strong> (0–1) from the multi-criteria scoring system: <code>β · Score_Perf + (1−β) · W_S</code> with β=0.7 — 70% verified benchmark performance (confidence-weighted by the reputation of each result, its uploader and the benchmark) and 30% the service's own reputation.</p>
                    <p>A service still shows here when it's the only one or has no benchmark results yet — it's then scored on its reputation alone — including services that solve the skill via a submitted result rather than a coverage box. Full method: see the scoring system on the <em>How it works</em> page.</p>
                  </InfoTip>
                </div>
              </div>
              <div class="best-service-actions">
                {#if recommendedService.coverage.serviceId}
                  <RunServiceButton serviceId={recommendedService.coverage.serviceId} large={true} label="Run" />
                {/if}
                {#await recommendedDownloadPromise(recommendedService.coverage.serviceId) then dl}
                  {#if dl?.source?.urlLink}
                    <a
                      class="best-service-download"
                      href={dl.source.urlLink}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                      Download from source-application
                    </a>
                  {/if}
                {/await}
              </div>
            </section>
            {/if}
          {/each}

          {#if !$demoMode && $walletConnected && !$reputation_proof}
            <section class="detail-section">
              <div class="submit-connect-card">
                <p class="text-muted-foreground mb-3">This wallet does not have a reputation profile yet. Create one in the <button type="button" class="link-btn" on:click={() => activeTab = 'profile'}>Profile tab</button> before adding a service solution or publishing benchmarks.</p>
              </div>
            </section>
          {/if}

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
            <!-- Secondary action, grouped with the CTAs but visually quieter (ghost link). -->
            <button
              class="open-discussion-link"
              type="button"
              on:click={() => selectedSkill && openForum(selectedSkill.boxId, `Skill: ${selectedSkill.name}`)}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
              </svg>
              Open discussion
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
                  <div class="form-label">Performance metrics <span class="text-red-500">*</span></div>
                  <p class="form-hint">Each metric is an axis of measurement (e.g. <code>accuracy ↑</code>, <code>latency_ms ↓</code>). At least one is required.</p>
                  <div class="bench-row-list">
                    {#each benchmarkMetrics as metric, i}
                      <div class="bench-row">
                        <input
                          class="form-input bench-row-name"
                          bind:value={metric.name}
                          placeholder="metric name (e.g. accuracy)"
                          aria-label="Metric name"
                        />
                        <input
                          class="form-input bench-row-desc"
                          bind:value={metric.description}
                          placeholder="description (optional)"
                          aria-label="Metric description"
                        />
                        <div class="form-toggle-group bench-row-toggle">
                          <button
                            type="button"
                            class="toggle-btn"
                            class:toggle-active={metric.higherIsBetter}
                            on:click={() => { metric.higherIsBetter = !metric.higherIsBetter; benchmarkMetrics = benchmarkMetrics; }}
                            title={metric.higherIsBetter ? 'Higher is better' : 'Lower is better'}
                          >
                            <span class="toggle-indicator" class:toggle-indicator-on={metric.higherIsBetter}></span>
                          </button>
                          <span class="toggle-label">{metric.higherIsBetter ? '↑ Higher' : '↓ Lower'}</span>
                        </div>
                        <button
                          type="button"
                          class="bench-row-remove"
                          on:click={() => removeBenchmarkMetric(i)}
                          disabled={benchmarkMetrics.length <= 1}
                          aria-label="Remove metric"
                        >×</button>
                      </div>
                    {/each}
                  </div>
                  <button type="button" class="bench-row-add" on:click={addBenchmarkMetric}>+ Add metric</button>
                </div>
                <div class="form-group">
                  <div class="form-label">Case descriptors</div>
                  <p class="form-hint">Optional problem-space dimensions (e.g. <code>batch_size</code>, <code>context_tokens</code>). Each result case must provide a value per descriptor.</p>
                  <div class="bench-row-list">
                    {#each benchmarkDescriptors as descriptor, i}
                      <div class="bench-row">
                        <input
                          class="form-input bench-row-name"
                          bind:value={descriptor.name}
                          placeholder="descriptor name (e.g. batch_size)"
                          aria-label="Descriptor name"
                        />
                        <input
                          class="form-input bench-row-desc"
                          bind:value={descriptor.description}
                          placeholder="description (optional)"
                          aria-label="Descriptor description"
                        />
                        <button
                          type="button"
                          class="bench-row-remove"
                          on:click={() => removeBenchmarkDescriptor(i)}
                          aria-label="Remove descriptor"
                        >×</button>
                      </div>
                    {/each}
                  </div>
                  <button type="button" class="bench-row-add" on:click={addBenchmarkDescriptor}>+ Add descriptor</button>
                </div>
                <div class="form-group">
                  <label class="form-label" for="bench-source">Source hash (optional)</label>
                  <input
                    id="bench-source"
                    class="form-input"
                    bind:value={benchmarkSourceHash}
                    placeholder="Blake2b256 hash of off-chain source file"
                  />
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
              Service solutions
              <span class="detail-tab-count">{selectedSkill.coverages.length}</span>
            </button>
            <button
              class="detail-tab-btn"
              class:detail-tab-active={detailTab === "compare"}
              on:click={() => detailTab = "compare"}
            >
              Comparative
            </button>
            <InfoTip title="Three views of the same skill">
              <ul>
                <li><strong>Benchmarks</strong> — definitions of <em>how</em> performance is measured (case descriptors + performance metrics). Submit results here.</li>
                <li><strong>Service solutions</strong> — services that implement (solve) the skill, and how each scores per benchmark, grouped by descriptor. Not to be confused with a benchmark's <em>runner</em> services.</li>
                <li><strong>Comparative</strong> — the full service × (benchmark → metric) tensor with a single composite score.</li>
              </ul>
            </InfoTip>
          </div>

          <!-- Benchmarks Tab -->
          {#if detailTab === "benchmarks"}
            <SkillLeaderboard
              benchmarks={selectedSkill.benchmarks}
              bind:selectedBenchmarkId
              skillName={selectedSkill.name}
              onAddSource={openFileSourceModal}
              on:created={() => refreshSkills(selectedSkill?.boxId ?? null)}
            />
          {/if}

          <!-- Coverages Tab — per-coverage per-benchmark performance -->
          {#if detailTab === "coverages"}
            <section class="detail-section">
              <div class="detail-section-header detail-section-header-bare">
                <InfoTip title="What is a service solution?">
                  <p>A <strong>service solution</strong> is a service that implements (solves) this skill — its on-chain claim that it can perform the skill, recorded as a Coverage UTXO pointing back at the Skill box. (A service that has submitted a Result counts too.)</p>
                  <p>These are distinct from a benchmark's <strong>runner</strong> services, which only execute the benchmark.</p>
                  <p>Per service, results are grouped per benchmark with two layers:</p>
                  <ul>
                    <li><strong>Aggregate row</strong> — median value across every case the service ran on that benchmark.</li>
                    <li><strong>Per-descriptor rows</strong> — median values at each unique caseMeta tuple, so you can see where a service is strong vs. weak inside the problem space.</li>
                  </ul>
                </InfoTip>
              </div>
              {#if selectedSkill.coverages.length === 0}
                <div class="detail-empty">
                  <p>No service solutions yet. Be the first to solve this skill.</p>
                </div>
              {:else}
                <ServiceInfoFilterBar />
                <div class="space-y-3">
                  {#each selectedSkill.coverages as cov}
                    {@const serviceBlocks = collectServiceResults(cov.serviceId, selectedSkill)}
                    {@const compositeScore = computeServiceCompositeScore(cov.serviceId, selectedSkill)}
                    {#if serviceMatches(cov.serviceId, $serviceInfoRegistry, $serviceFilters)}
                    <div class="coverage-card">
                      <div class="coverage-card-header">
                        <ProfileAvatar profileId={cov.profileId} size={18} title={`Service solution submitted by ${cov.profileId}`} />
                        <code class="font-mono text-xs px-1.5 py-0.5 rounded" style="background: hsl(var(--muted) / 0.5);">{formatHash(cov.serviceId || cov.boxId)}</code>
                        <ExplorerLink boxId={cov.boxId} liveTooltip="View Coverage box on Ergo Explorer" />
                        <span class="ml-auto coverage-score">
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="none" class="coverage-score-icon">
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                          </svg>
                          {formatMetricValue(compositeScore)}
                        </span>
                        <InfoTip title="Composite score" placement="bottom">
                          <p>Cross-benchmark score for this service: direction-signed z-score per metric column, weighted by <code>max(bench_rep, 1) × max(result_rep, 1)</code> and averaged.</p>
                          <p>Higher = better. A negative score means the service is below the population mean across the metric columns it participated in.</p>
                        </InfoTip>
                      </div>
                      {#if serviceBlocks.length === 0}
                        <p class="coverage-empty">No results submitted yet for this service.</p>
                      {:else}
                        {#each serviceBlocks as block}
                          <div class="benchmark-block">
                            <div class="benchmark-block-header">
                              <span class="benchmark-block-name">{block.benchmark.name}</span>
                              <span class="benchmark-block-meta">
                                {block.aggregateMetrics.reduce((acc, a) => acc + a.caseCount, 0)} case run{block.aggregateMetrics.reduce((acc, a) => acc + a.caseCount, 0) !== 1 ? 's' : ''}
                                · {block.aggregateMetrics[0]?.resultCount ?? 0} submission{(block.aggregateMetrics[0]?.resultCount ?? 0) !== 1 ? 's' : ''}
                              </span>
                            </div>
                            <table class="coverage-benchmark-table">
                              <thead>
                                <tr>
                                  {#each block.descriptors as d}
                                    <th title={d.description}><code class="font-mono text-xs">{d.name}</code></th>
                                  {/each}
                                  {#each block.metrics as m}
                                    <th class="num" title={m.description}>
                                      <code class="font-mono text-xs">{m.name}</code>
                                      <span class="text-xs text-muted-foreground">{m.higherIsBetter ? '↑' : '↓'}</span>
                                    </th>
                                  {/each}
                                </tr>
                              </thead>
                              <tbody>
                                <!-- Aggregate row: median across every case the service ran. -->
                                <tr class="aggregate-row" class:aggregate-row-clickable={block.descriptors.length === 0} on:click={() => block.descriptors.length === 0 && toggleAllCases(cov.serviceId, block.benchmark.id)}>
                                  {#each block.descriptors as _d}
                                    <td class="td-aggregate-label" colspan={1}>—</td>
                                  {/each}
                                  {#if block.descriptors.length === 0}
                                    <td class="td-aggregate-label">
                                      <span class="all-cases-toggle-icon" aria-hidden="true">{(expandedAllCases[allCasesKey(cov.serviceId, block.benchmark.id)] ?? false) ? '▾' : '▸'}</span>
                                      All cases (median)
                                    </td>
                                  {/if}
                                  {#each block.aggregateMetrics as a}
                                    <td class="num">{formatMetricValue(a.value)}</td>
                                  {/each}
                                </tr>
                                {#if block.descriptors.length === 0 && (expandedAllCases[allCasesKey(cov.serviceId, block.benchmark.id)] ?? false)}
                                  {@const cases = collectIndividualCases(cov.serviceId, block.benchmark)}
                                  {#if cases.length === 0}
                                    <tr class="all-cases-empty-row">
                                      <td colspan={block.metrics.length + 1} class="all-cases-empty-cell">No individual cases recorded.</td>
                                    </tr>
                                  {:else}
                                    {#each cases as c, i}
                                      <tr class="all-cases-detail-row">
                                        <td class="all-cases-detail-label">
                                          <span class="all-cases-detail-index">#{i + 1}</span>
                                          <code class="font-mono text-xs">{formatHash(c.resultId)}</code>
                                        </td>
                                        {#each c.metricsValues as v}
                                          <td class="num">{formatMetricValue(v)}</td>
                                        {/each}
                                      </tr>
                                    {/each}
                                  {/if}
                                {/if}
                                {#if block.descriptors.length > 0}
                                  <tr class="aggregate-label-row">
                                    <td colspan={block.descriptors.length + block.metrics.length} class="aggregate-label-row-td">
                                      <span>↑ Aggregate (median across all cases)</span>
                                      <span class="aggregate-label-row-divider">— per-descriptor breakdown below —</span>
                                    </td>
                                  </tr>
                                  {#each block.descriptorRows as r}
                                    <tr>
                                      {#each block.descriptors as _d, i}
                                        <td><code class="font-mono text-xs">{r.caseMeta[i] ?? '—'}</code></td>
                                      {/each}
                                      {#each r.perMetric as v}
                                        <td class="num">{formatMetricValue(v)}</td>
                                      {/each}
                                    </tr>
                                  {/each}
                                {/if}
                              </tbody>
                            </table>
                          </div>
                        {/each}
                      {/if}
                      <ServiceSourceCard
                        serviceId={cov.serviceId || ''}
                        compact={true}
                        on:addSource={(event) => openFileSourceModal(event.detail)}
                      />
                      <ServiceInfoCard serviceId={cov.serviceId || ''} compact={true} />
                      <div class="coverage-action-row mt-3">
                        <RunServiceButton serviceId={cov.serviceId || ''} label="Run" />
                        {#if cov.serviceId}
                          <button
                            class="dialogue-btn"
                            type="button"
                            on:click={() => {
                              viewedServiceId.set(cov.serviceId || '');
                              const u = new URL(window.location.href);
                              u.searchParams.set('service', cov.serviceId || '');
                              window.history.pushState({}, '', u);
                            }}
                          >
                            View service →
                          </button>
                        {/if}
                        <button
                          class="dialogue-btn"
                          type="button"
                          on:click={() => openForum(cov.boxId, `Coverage: ${formatServiceId(cov.serviceId || cov.boxId)}`)}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                          </svg>
                          Dialogue
                        </button>
                      </div>
                    </div>
                    {/if}
                  {/each}
                </div>
              {/if}
            </section>
          {/if}

          <!-- Comparative Tab — services × benchmarks matrix (best-reputation result per cell) -->
          {#if detailTab === "compare"}
            <section class="detail-section">
              <div class="detail-section-header detail-section-header-bare">
                <InfoTip title="How the composite is computed">
                  <p>Each row is a service, each column is a <em>(benchmark → metric)</em> pair. Cells show the <strong>median</strong> across the service's case executions.</p>
                  <p><strong>Composite</strong> per service:</p>
                  <ul>
                    <li>Each cell is normalised to a <code>z-score</code> against the population of services with a value for that column.</li>
                    <li>Lower-is-better metrics are negated, so higher composite is always better.</li>
                    <li>Weighted by <code>max(bench_rep, 1) × max(result_rep, 1)</code> — high-reputation benchmarks and well-vouched results dominate.</li>
                  </ul>
                  <p>Highlighted cells = best raw value in that column.</p>
                </InfoTip>
              </div>
              {#if selectedSkill.coverages.length === 0 || selectedSkill.benchmarks.length === 0}
                <div class="detail-empty">
                  <p>Comparison requires at least one service solution and one benchmark.</p>
                </div>
              {:else}
                {@const matrix = buildComparisonMatrix(selectedSkill)}
                {#if matrix.columns.length === 0}
                  <div class="detail-empty">
                    <p>None of this skill's benchmarks declare performance metrics yet.</p>
                  </div>
                {:else}
                  <div class="comparative-wrapper">
                    <table class="comparative-table">
                      <thead>
                        <tr>
                          <th class="comp-service-col">Service</th>
                          {#each matrix.columns as col}
                            <th class="num" title={`${col.benchmarkName} → ${col.metric.name} ${col.metric.higherIsBetter ? '↑' : '↓'}${col.metric.description ? ` · ${col.metric.description}` : ''}`}>
                              <div class="comp-col-bench">{col.benchmarkName}</div>
                              <div class="comp-col-metric">
                                <code class="font-mono text-xs">{col.metric.name}</code>
                                <span class="text-xs text-muted-foreground">{col.metric.higherIsBetter ? '↑' : '↓'}</span>
                              </div>
                            </th>
                          {/each}
                          <th class="num" title="Composite score across all metric columns, reputation-weighted (see scoring.ts).">Composite</th>
                        </tr>
                      </thead>
                      <tbody>
                        {#each matrix.rows as row}
                          <tr>
                            <td>
                              <code class="font-mono text-xs">{formatHash(row.serviceId)}</code>
                            </td>
                            {#each row.cells as cell, i}
                              <td class="num" class:comp-cell-best={cell.value !== null && cell.value === matrix.columnWinners[i]}>
                                {formatMetricValue(cell.value)}
                              </td>
                            {/each}
                            <td class="num">{formatMetricValue(row.composite)}</td>
                          </tr>
                        {/each}
                      </tbody>
                    </table>
                    <p class="comparative-note">Tensor: rows are services, columns are (benchmark → metric). Cells show the <strong>median</strong> across that service's case executions. Highlighted = best in column. Composite is the direction-signed <strong>z-score per column</strong>, weighted by <code>max(benchmark_rep, 1) × max(result_rep, 1)</code> — so higher = better across all benchmarks regardless of metric scale.</p>
                  </div>
                {/if}
              {/if}
            </section>
          {/if}

          <!-- Related skills -->
          {#if relatedSkills.length > 0}
          <!-- Lo ocultamos, pues es igual a "concurrent submissions for this skill"-->
            <section class="detail-section" hidden>
              <div class="detail-section-header">
                <h2 class="detail-section-title">Related Skills</h2>
                <span class="detail-count">{relatedSkills.length}</span>
              </div>
              <div class="space-y-2">
                {#each relatedSkills as related}
                  <button class="detail-related-btn" on:click={() => selectSkill(related.skill)}>
                    <span class="font-medium">{related.skill.name}</span>
                    <span class="detail-related-direction text-xs text-muted-foreground uppercase tracking-wide ml-auto">
                      {relatedSkillDirectionLabel(related.direction)}
                    </span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M5 12h14M12 5l7 7-7 7"/>
                    </svg>
                  </button>
                {/each}
              </div>
            </section>
          {/if}

        </div>
      </div>

    {:else}
      <!-- ── Hero + Skills Gallery ─────────────────────────────────────────── -->
      <HeroSection />

      <div id="skills-section" class="container mx-auto px-8 pb-8">
        <!-- Stats Bar -->
        <StatsBar totalSkills={skills.length} {totalServices} {totalResults} />

        <!-- Category Filter -->
        <CategoryFilter {activeCategory} {skills} on:filter={(e) => { activeCategory = e.detail; }} />

        <div class="gallery-header">
          <div>
            <h2 class="gallery-title">
              {#if searchQuery}
                Search Results
              {:else}
                All Skills
              {/if}
            </h2>
            <p class="text-sm text-muted-foreground mt-0.5 inline-flex items-center gap-1 flex-wrap">
              {#if galleryUnfiltered && hiddenFromListing > 0}
                <span>{displayedSkills.length} of {skills.length} skill{skills.length !== 1 ? "s" : ""} shown</span>
                <InfoTip title="Why fewer cards than the total?">
                  <p>The counter above shows every <strong>Skill registered on-chain</strong> ({skills.length}). The gallery lists <strong>{displayedSkills.length}</strong> of them.</p>
                  <p>The other {hiddenFromListing} {hiddenFromListing === 1 ? "is" : "are"} hidden because they're <strong>nested under a parent skill</strong> (a higher-reputation skill that extends them) or are duplicate-named submissions collapsed to their canonical entry. Open a skill to reach its nested and sibling skills.</p>
                </InfoTip>
              {:else}
                <span>
                  {displayedSkills.length} skill{displayedSkills.length !== 1 ? "s" : ""}
                  {searchQuery ? ` matching "${searchQuery}"` : ""}
                  {activeCategory !== "all" ? ` in ${activeCategory}` : " registered on-chain"}
                </span>
              {/if}
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

        <!-- Gallery search + min-reputation filter (moved out of the header). -->
        <div class="gallery-controls">
          <div class="gallery-search">
            <svg class="gallery-search-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" aria-hidden="true">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              type="text"
              bind:value={searchQuery}
              placeholder="Search skills, tags, domains..."
              class="search-input"
              aria-label="Search skills"
            />
            {#if searchQuery}
              <button class="gallery-search-clear" on:click={() => (searchQuery = "")} aria-label="Clear search" title="Clear search">✕</button>
            {/if}
          </div>
          <label class="gallery-minrep">
            <span class="gallery-minrep-label">Min reputation</span>
            <span class="gallery-minrep-field">
              <input
                type="number"
                min="0"
                step="1"
                bind:value={minReputation}
                class="gallery-minrep-input"
                aria-label="Minimum reputation in ERGs"
              />
              <span class="gallery-minrep-suffix">ERGs</span>
            </span>
          </label>
        </div>

        {#if loading}
          <div class="skills-grid">
            {#each [0, 1, 2, 3, 4, 5] as i}
              <SkeletonCard index={i} />
            {/each}
          </div>
        {:else if error}
          <div class="empty-state">
            <div class="empty-state-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </div>
            <p class="text-lg font-semibold">Couldn't load skills</p>
            <p class="text-sm text-muted-foreground mt-1">{error}</p>
            <button class="refresh-btn mt-3" on:click={loadSkills}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M2.5 22v-6h6"/><path d="M22 12A10 10 0 0 0 3.25 7.25M2 12a10 10 0 0 0 18.75 4.75"/></svg>
              Retry
            </button>
          </div>
        {:else if displayedSkills.length === 0}
          <div class="empty-state">
            <div class="empty-state-icon">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </div>
            <p class="text-lg font-semibold">No skills found</p>
            {#if searchQuery || activeCategory !== "all" || minReputation > 0}
              <p class="text-sm text-muted-foreground mt-1">Try a different search term, category, or lower the minimum reputation.</p>
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
                profileId={skill.profileId}
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
      <div class="w-full">
        {#if returnToSkill}
          <!-- Return to the skill detail this Submit view was opened from
               ("Modify Skill" → back navigation, matching the profile view). -->
          <BackButton label="Back to {returnToSkill.name}" on:click={backToSkillFromSubmit} />
        {/if}
        <div class="submit-header">
          <h2 class="text-2xl md:text-3xl font-extrabold mb-1">Submit a Skill</h2>
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
        {:else if !$demoMode && !$reputation_proof}
          <div class="submit-connect-card">
            <p class="text-muted-foreground mb-4">You need a reputation profile before publishing on-chain. Create one in the <button type="button" class="link-btn" on:click={() => activeTab = 'profile'}>Profile tab</button>.</p>
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
              <label class="form-label" for="skill-formal">Formal specification <span class="text-muted-foreground font-normal text-xs">(optional, JSON)</span></label>
              <FormalSpecEditor id="skill-formal" bind:value={newSkillFormal} schema={null} />
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
                <a href={`https://explorer.ergoplatform.com/en/transactions/${submitTx}`} target="_blank" rel="noopener noreferrer" class="text-sm break-all" style="color: hsl(var(--primary));">{submitTx}</a>
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

  {:else if activeTab === "profile"}
    <!-- ── Profile ──────────────────────────────────────────────────────── -->
    <div class="container mx-auto px-8 py-8">
      <div class="w-full">
        <div class="submit-header">
          <div class="submit-header-titlerow">
            <div class="submit-header-avatar">
              <ProfileAvatar profileId={$reputation_proof?.token_id} size={48} clickable={false} title="Your profile" />
            </div>
            <h2 class="text-2xl md:text-3xl font-extrabold">Reputation Profile</h2>
          </div>
          <p class="text-muted-foreground text-sm">
            Your on-chain reputation profile. Required before publishing skills, adding a service solution, or submitting benchmarks.
          </p>
        </div>

        {#if $demoMode}
          <div class="submit-connect-card">
            <p class="text-muted-foreground">Profile management is only available in live mode. Switch off demo mode to connect a wallet and create a reputation profile.</p>
          </div>
        {:else if !$walletConnected}
          <div class="submit-connect-card">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-muted-foreground mb-3">
              <rect x="2" y="6" width="20" height="12" rx="2"/><path d="M22 10H2"/><path d="M6 14h.01M10 14h.01"/>
            </svg>
            <p class="text-muted-foreground mb-4">Connect your wallet to view or create a reputation profile.</p>
            <WalletButton explorerUrl={$web_explorer_uri_addr} />
          </div>
        {:else if profileLoading}
          <div class="submit-connect-card">
            <p class="text-muted-foreground">Loading reputation profile…</p>
          </div>
        {:else if !$reputation_proof}
          <div class="submit-connect-card">
            <p class="text-muted-foreground mb-3">This wallet does not have a reputation profile yet. Create one to start publishing on-chain (optionally sacrifice ERG to seed reputation).</p>
            <div class="w-full grid gap-3" style="max-width: 28rem;">
              <div class="form-group">
                <label class="form-label" for="profile-tab-sacrifice">Optional ERG sacrifice</label>
                <input id="profile-tab-sacrifice" class="form-input" bind:value={profileSacrificeErg} type="number" min="0" step="0.001" placeholder="0" />
              </div>
              <button class="submit-btn" type="button" disabled={createProfileSubmitting || profileLoading} on:click={handleCreateProfile}>
                {#if createProfileSubmitting}
                  <div class="submit-spinner"></div>
                  Creating profile...
                {:else}
                  Create Reputation Profile
                {/if}
              </button>
            </div>
            {#if profileError}<p class="field-error-msg mt-3">{profileError}</p>{/if}
            {#if profileCreateTx}<p class="text-xs mt-3 break-all">Tx: {profileCreateTx}</p>{/if}
          </div>
        {:else}
          <ProfileDetailsCard
            proof={$reputation_proof}
            profiles={userProfiles}
            activeProfileId={$reputation_proof?.token_id}
            skills={skills}
            on:burn={openBurnModal}
            on:updateProfileData={(e) => handleUpdateProfileData(e.detail.data)}
            on:createProfile={openNewProfileModal}
            on:selectProfile={(e) => handleSelectProfile(e.detail)}
            on:navigateSkill={(e) => handleNavigateSkill(e.detail)}
          />
        {/if}
      </div>
    </div>

  {:else if activeTab === "howitworks"}
    <!-- ── How it works ─────────────────────────────────────────────────────── -->
    <div class="container mx-auto px-8 py-8">
      <HowItWorks />
    </div>

  {/if}

  {#if !$demoMode && $walletConnected && profileLoading && activeTab !== "profile"}
    <div class="container mx-auto px-8 pb-4">
      <p class="text-sm text-muted-foreground">Loading reputation profile...</p>
    </div>
  {/if}
</main>

<!-- ── Footer ─────────────────────────────────────────────────────────────── -->
<FooterComponent />

<!-- ── Toast Notifications ──────────────────────────────────────────────── -->
<Toast />

<!-- ── Single Forum side-rail (every dialogue button funnels here) ────── -->
<ForumSidebar />

<!-- ── File Source Creation Modal ──────────────────────────────────────── -->
{#if showFileSourceModal}
  <!-- svelte-ignore a11y-click-events-have-key-events -->
  <!-- svelte-ignore a11y-no-static-element-interactions -->
  <div class="file-source-modal-backdrop" use:portal on:click={() => showFileSourceModal = false}>
    <div class="file-source-modal-content file-source-modal-content--wide" on:click|stopPropagation>
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

<!-- ── Burn More ERG modal ─────────────────────────────────────────────── -->
{#if showBurnModal}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="file-source-modal-backdrop" use:portal on:click={() => (showBurnModal = false)}>
    <div class="file-source-modal-content" on:click|stopPropagation>
      <div class="file-source-modal-header">
        <h3 class="text-lg font-semibold">Burn ERG to your profile</h3>
        <button class="file-source-modal-close" on:click={() => (showBurnModal = false)}>✕</button>
      </div>
      <p class="text-sm text-muted-foreground mb-4">Sacrificed ERG is permanently burned into your reputation profile, raising its reputation. This cannot be undone.</p>
      <div class="form-group">
        <label class="form-label" for="burn-erg">ERG to burn</label>
        <input id="burn-erg" class="form-input" type="number" min="0" step="0.001" placeholder="0.000" bind:value={burnErgAmount} />
      </div>
      <button class="submit-btn mt-4" type="button" disabled={burnSubmitting} on:click={submitBurn}>
        {#if burnSubmitting}<div class="submit-spinner"></div>Burning…{:else}Burn ERG{/if}
      </button>
    </div>
  </div>
{/if}

<!-- ── New reputation profile modal ────────────────────────────────────── -->
{#if showNewProfileModal}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="file-source-modal-backdrop" use:portal on:click={() => (showNewProfileModal = false)}>
    <div class="file-source-modal-content" on:click|stopPropagation>
      <div class="file-source-modal-header">
        <h3 class="text-lg font-semibold">Create a new profile</h3>
        <button class="file-source-modal-close" on:click={() => (showNewProfileModal = false)}>✕</button>
      </div>
      <p class="text-sm text-muted-foreground mb-4">Mint an additional reputation profile (a new reputation token). You can optionally burn ERG into it at creation to seed its reputation.</p>
      <div class="form-group">
        <label class="form-label" for="new-profile-sacrifice">Optional ERG sacrifice</label>
        <input id="new-profile-sacrifice" class="form-input" type="number" min="0" step="0.001" placeholder="0" bind:value={newProfileSacrifice} />
      </div>
      <button class="submit-btn mt-4" type="button" disabled={newProfileSubmitting} on:click={submitNewProfile}>
        {#if newProfileSubmitting}<div class="submit-spinner"></div>Creating…{:else}Create profile{/if}
      </button>
    </div>
  </div>
{/if}

<WalletAddressChangeHandler />

<style lang="postcss">
  :global(body) {
    background-color: hsl(var(--background));
  }

  /* ── Navbar (floating island) ───────────────────────────────────────── */
  /* The header floats as a centred pill that hides on scroll-down and reveals
     on scroll-up (see the scroll handler in onMount). */
  .navbar-container {
    @apply sticky z-50 w-full px-4 pointer-events-none;
    top: 0.75rem;
    transition: transform 200ms ease, opacity 200ms ease;
  }

  .navbar-hidden {
    transform: translateY(calc(-100% - 1.5rem));
    opacity: 0;
  }

  .navbar-content {
    @apply flex flex-col gap-3 px-10 py-4 pointer-events-auto;
    max-width: 1200px;
    margin: 0 auto;
    width: 100%;
    border-radius: 1.5rem;
    border: 1px solid hsl(var(--border));
    background-color: hsl(var(--background) / 0.8);
    backdrop-filter: blur(14px);
    box-shadow: 0 8px 30px hsl(0 0% 0% / 0.08);
  }

  .navbar-top {
    @apply flex items-center gap-4 w-full;
  }

  .navbar-tabs {
    @apply flex items-center justify-center gap-2 flex-1;
  }

  .logo-container {
    @apply flex items-center gap-2.5 text-foreground no-underline whitespace-nowrap;
  }

  .logo-text {
    @apply text-2xl font-bold tracking-tight leading-none;
    font-family: var(--font-heading);
  }

  /* ── Demo mode topbar ─────────────────────────────────────────────── */
  .demo-bar {
    @apply fixed top-0 left-0 right-0 z-50 text-center text-xs font-bold py-1 px-4 shadow-sm;
    background: hsl(45 95% 55% / 0.95);
    color: hsl(0 0% 10%);
    backdrop-filter: blur(4px);
  }
  .navbar-with-demo-bar {
    margin-top: 1.5rem;
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

  /* ── Tabs (inside island header) ────────────────────────────────────── */
  /* Text-only labels (no icons) at a larger size for prominence. */
  .tab-btn {
    @apply flex items-center py-3 px-4 text-base font-semibold border-b-2 border-transparent text-muted-foreground transition-all duration-200 rounded-t-md;
  }
  .tab-btn.active {
    border-bottom-color: hsl(var(--foreground));
    color: hsl(var(--foreground));
  }
  .tab-btn:hover:not(.active) {
    @apply text-foreground;
    background: hsl(var(--muted) / 0.3);
  }

  /* ── Mobile header: stack logo + wallet on row 1, tabs scroll on row 2 ──────
     On phones the single-row island overflowed its right edge (logo + 4 tabs +
     wallet + theme don't fit at ~390px). Wrap the tabs to their own full-width
     row and let them scroll horizontally instead of pushing past the island. */
  @media (max-width: 640px) {
    .navbar-content {
      @apply px-4 py-3 gap-2;
      border-radius: 1rem;
    }
    .navbar-top {
      @apply flex-wrap gap-2;
    }
    .logo-text {
      @apply text-lg;
    }
    .navbar-tabs {
      order: 3;
      flex: 1 0 100%;
      justify-content: flex-start;
      gap: 0.25rem;
      overflow-x: auto;
      scrollbar-width: none;
      -webkit-overflow-scrolling: touch;
    }
    .navbar-tabs::-webkit-scrollbar {
      display: none;
    }
    .tab-btn {
      @apply py-2 px-2.5 text-sm;
      flex: 0 0 auto;
      white-space: nowrap;
    }
  }

  /* ── Main content ───────────────────────────────────────────────────── */
  .main-content {
    /* pb-12 (3rem) reserves space for the fixed page-footer (h-12 = 3rem) so
       trailing content isn't hidden behind it. */
    @apply min-h-[60vh] pb-12;
  }

  /* ── Gallery ────────────────────────────────────────────────────────── */
  .gallery-header {
    @apply flex items-end justify-between mb-6 pb-4 border-b;
    border-bottom-color: hsl(var(--border) / 0.5);
  }

  .gallery-title {
    @apply text-xl font-bold;
  }

  /* ── Gallery search + min-reputation controls ───────────────────────── */
  .gallery-controls {
    @apply flex items-center gap-3 mb-6 flex-wrap;
  }
  .gallery-search {
    @apply relative flex-1;
    min-width: 220px;
  }
  .gallery-search-icon {
    @apply absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4 pointer-events-none;
  }
  .gallery-search .search-input {
    @apply pr-9;
  }
  .gallery-search-clear {
    @apply absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs leading-none px-1.5 py-1 rounded;
  }
  .gallery-search-clear:hover {
    @apply text-foreground;
    background: hsl(var(--muted) / 0.5);
  }
  .gallery-minrep {
    @apply flex items-center gap-2 text-sm text-muted-foreground;
  }
  .gallery-minrep-label {
    @apply whitespace-nowrap;
  }
  .gallery-minrep-field {
    @apply relative inline-flex items-center;
  }
  .gallery-minrep-input {
    @apply w-28 pl-2.5 pr-12 py-2 rounded-lg text-sm;
    background: hsl(var(--muted) / 0.5);
    border: 1px solid hsl(var(--border));
    color: hsl(var(--foreground));
  }
  .gallery-minrep-input:focus {
    @apply outline-none;
    background: hsl(var(--background));
    border-color: hsl(var(--foreground) / 0.3);
    box-shadow: 0 0 0 3px hsl(var(--foreground) / 0.06);
  }
  .gallery-minrep-suffix {
    @apply absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none;
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
  /* Match the Skills Gallery width: use the same Tailwind `container` so the
     skill- and profile-detail views span exactly as wide as the gallery
     across every breakpoint. */
  .detail-view {
    @apply container mx-auto px-8 py-8;
    opacity: 0;
    transform: translateX(12px);
    transition: opacity 0.4s ease, transform 0.4s ease;
  }

  .detail-visible {
    opacity: 1;
    transform: translateX(0);
  }

  .detail-container {
    width: 100%;
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

  .detail-header-actions {
    @apply inline-flex items-center gap-2;
  }
  .fork-skill-btn,
  .share-skill-btn {
    @apply inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200;
    background: hsl(var(--muted) / 0.5);
    border: 1px solid hsl(var(--border));
    color: hsl(var(--muted-foreground));
    cursor: pointer;
  }
  .fork-skill-btn:hover,
  .share-skill-btn:hover {
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

  /* On-chain identifiers folded into the main card (replaces the old box). */
  .detail-meta-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem 1.5rem;
    padding-top: 0.875rem;
    border-top: 1px solid hsl(var(--border) / 0.6);
    font-size: 0.75rem;
  }

  .detail-meta-item {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
  }

  /* Creator sits on its own row at the bottom of the meta block. */
  .detail-meta-creator {
    flex-basis: 100%;
  }

  /* Category glyph next to the skill title (replaces the old profile avatar). */
  .detail-category-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .detail-meta-label {
    color: hsl(var(--muted-foreground));
    font-weight: 500;
    white-space: nowrap;
  }

  .detail-meta-value {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.7rem;
    color: hsl(var(--foreground));
    max-width: 22rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .detail-meta-copy {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.25rem;
    height: 1.25rem;
    border-radius: 0.25rem;
    border: none;
    background: none;
    color: hsl(var(--muted-foreground));
    cursor: pointer;
    transition: color 0.15s;
  }

  .detail-meta-copy:hover {
    color: hsl(var(--foreground));
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

  /* Tab context with no heading: just a discreet InfoTip, right-aligned,
     no heavy divider — the sub-tab already names the section. */
  .detail-section-header-bare {
    justify-content: flex-end;
    margin-bottom: 0.75rem;
    padding-bottom: 0;
    border-bottom: none;
  }

  .detail-empty {
    @apply rounded-lg p-6 text-center text-sm text-muted-foreground;
    background: hsl(var(--muted) / 0.3);
    border: 1px dashed hsl(var(--border));
  }

  .profile-readonly-badge {
    @apply ml-auto inline-flex items-center h-6 px-2.5 rounded-full text-xs font-semibold uppercase tracking-wide;
    background: hsl(var(--muted));
    color: hsl(var(--muted-foreground));
    border: 1px solid hsl(var(--border));
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

  .bench-row-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }
  .bench-row {
    display: grid;
    grid-template-columns: minmax(8rem, 1fr) minmax(8rem, 1.4fr) auto auto;
    gap: 0.5rem;
    align-items: center;
  }
  .bench-row-toggle {
    justify-content: flex-start;
  }
  .bench-row-remove {
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 0.375rem;
    border: 1px solid hsl(var(--border));
    background: hsl(var(--muted) / 0.4);
    color: hsl(var(--muted-foreground));
    font-size: 1rem;
    line-height: 1;
    cursor: pointer;
  }
  .bench-row-remove:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  .bench-row-add {
    margin-top: 0.5rem;
    font-size: 0.8125rem;
    font-weight: 500;
    color: hsl(var(--foreground));
    background: transparent;
    border: 1px dashed hsl(var(--border));
    border-radius: 0.375rem;
    padding: 0.4rem 0.75rem;
    cursor: pointer;
  }
  .bench-row-add:hover {
    border-color: hsl(var(--foreground) / 0.4);
    background: hsl(var(--muted) / 0.3);
  }
  .form-hint {
    @apply text-xs text-muted-foreground;
    margin-top: -0.25rem;
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
    background: hsl(var(--primary));
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

  /* Profile page: identicon avatar sits laterally next to the title (centered
     as a group), not stacked above it. */
  .submit-header-titlerow {
    @apply flex items-center justify-center gap-3 mb-2;
  }

  .submit-header-avatar {
    @apply inline-flex items-center justify-center shrink-0;
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
    @apply w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-semibold transition-all duration-200;
    background: hsl(var(--primary));
    color: hsl(var(--primary-foreground));
  }
  .submit-btn:hover:not(:disabled) {
    background: hsl(var(--primary) / 0.85);
  }
  .submit-btn:disabled {
    @apply opacity-50 cursor-not-allowed;
  }

  .link-btn {
    @apply inline underline font-semibold;
    color: hsl(var(--primary));
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
  }
  .link-btn:hover {
    color: hsl(var(--primary) / 0.7);
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

  /* ── Dialogue (Forum side-rail trigger) Button ─────────────────────── */
  .dialogue-btn {
    @apply inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border bg-transparent cursor-pointer transition-colors;
    color: hsl(var(--muted-foreground));
    border-color: hsl(var(--border));
  }
  .dialogue-btn:hover,
  .dialogue-btn:focus-visible {
    background: hsl(var(--muted));
    color: hsl(var(--foreground));
    outline: none;
  }
  .dialogue-btn-lg {
    @apply px-3 py-2 text-sm;
  }

  /* ── Best Service Highlight ────────────────────────────────────────── */
  .best-service-card {
    @apply mb-6 p-4 rounded-lg border;
    /* Sit on the solid card surface, then layer a clearer primary tint on top so
       the block reads as a distinct, recommended card — the old 0.06/0.02 wash
       was nearly invisible against the page background in light mode. */
    background:
      linear-gradient(
        135deg,
        hsl(var(--primary) / 0.16),
        hsl(var(--primary) / 0.06) 60%
      ),
      hsl(var(--card));
    border-color: hsl(var(--primary) / 0.5);
    box-shadow: 0 1px 3px hsl(var(--primary) / 0.12);
  }
  .best-service-eyebrow {
    @apply flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider mb-2;
    color: hsl(var(--primary));
  }
  .best-service-body {
    @apply flex items-center justify-between gap-4 flex-wrap;
  }
  .best-service-text {
    @apply flex flex-col gap-1 min-w-0;
  }
  .best-service-name {
    @apply text-xl font-bold leading-tight;
    color: hsl(var(--foreground));
  }
  .best-service-id {
    @apply text-xs;
    color: hsl(var(--muted-foreground));
    font-family: var(--font-mono, ui-monospace, monospace);
  }
  .best-service-score {
    @apply flex flex-col items-end shrink-0;
  }
  .best-service-score-value {
    @apply text-2xl font-extrabold leading-none;
    /* Use --foreground (not --primary) so the value stays legible against the
       card background in light mode — the peach primary (HSL 15 80% 73%) was
       too close to the surface tone and disappeared. */
    color: hsl(var(--foreground));
  }
  .best-service-score-label {
    @apply text-[0.65rem] uppercase tracking-wider mt-0.5;
    color: hsl(var(--muted-foreground));
  }
  /* Reputation chip under the composite score — subordinate annotation. */
  .best-service-rep {
    @apply inline-flex items-center gap-1 mt-1.5 px-1.5 py-0.5 rounded;
    background: hsl(var(--muted) / 0.4);
    color: hsl(var(--muted-foreground));
  }
  .best-service-rep-value {
    @apply text-xs font-semibold leading-none;
    font-variant-numeric: tabular-nums;
  }
  .best-service-rep-label {
    @apply text-[0.6rem] uppercase tracking-wider;
  }
  .best-service-actions {
    @apply flex flex-wrap items-center gap-3 mt-3;
  }

  .best-service-download {
    @apply inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium no-underline transition-colors;
    background: hsl(var(--primary));
    color: hsl(var(--primary-foreground));
  }
  .best-service-download:hover {
    opacity: 0.9;
  }

  /* ── Current submissions for this skill (siblings) ─────────────────── */
  .submissions-block {
    margin-bottom: 0.875rem;
  }
  .submissions-head {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    margin-bottom: 0.5rem;
  }
  .submissions-label {
    font-size: 0.8125rem;
    font-weight: 600;
    color: hsl(var(--muted-foreground));
  }
  .submissions-empty {
    display: inline-block;
    font-size: 0.75rem;
    color: hsl(var(--muted-foreground));
    padding: 0.5rem 0.75rem;
    border-radius: 0.375rem;
    background: hsl(var(--muted) / 0.3);
    border: 1px dashed hsl(var(--border));
  }
  /* The sibling list reuses .duplicate-notice-list rows but lives outside the
     old amber <details> box now, so drop its inner divider/padding. */
  .submissions-block .duplicate-notice-list {
    padding: 0;
    border-top: none;
    gap: 0.25rem;
  }

  /* ── Sibling submission rows (shared by the submissions block) ───────── */
  .duplicate-notice-list {
    list-style: none;
    margin: 0;
    padding: 0.25rem 0.25rem 0.375rem;
    border-top: 1px solid hsl(40 90% 50% / 0.2);
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }
  .duplicate-notice-row {
    display: flex;
    align-items: center;
    gap: 0.125rem;
  }
  .duplicate-notice-item {
    flex: 1 1 auto;
    min-width: 0;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0.5rem;
    background: transparent;
    border: 0;
    border-radius: 0.25rem;
    color: hsl(var(--foreground));
    text-align: left;
    cursor: pointer;
    font-size: 0.75rem;
    transition: background-color 0.12s ease;
  }
  .duplicate-notice-discuss {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    background: transparent;
    border: 0;
    border-radius: 0.25rem;
    color: hsl(var(--muted-foreground));
    cursor: pointer;
    transition: background-color 0.12s ease, color 0.12s ease;
  }
  .duplicate-notice-discuss:hover,
  .duplicate-notice-discuss:focus-visible {
    background: hsl(40 90% 50% / 0.12);
    color: hsl(var(--foreground));
    outline: none;
  }
  .duplicate-notice-item:hover,
  .duplicate-notice-item:focus-visible {
    background: hsl(40 90% 50% / 0.12);
    outline: none;
  }
  .duplicate-notice-item-name {
    font-weight: 500;
  }
  .duplicate-notice-item-domain {
    padding: 0.05rem 0.375rem;
    border-radius: 0.25rem;
    background: hsl(var(--muted));
    color: hsl(var(--muted-foreground));
    font-size: 0.6875rem;
  }
  .duplicate-notice-item-rep {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    margin-left: auto;
    padding: 0.05rem 0.375rem;
    border-radius: 9999px;
    background: hsl(45 90% 50% / 0.15);
    color: hsl(45 80% 35%);
    font-size: 0.6875rem;
    font-weight: 600;
  }
  :global(.dark) .duplicate-notice-item-rep {
    background: hsl(45 90% 50% / 0.12);
    color: hsl(45 80% 70%);
  }
  .duplicate-notice-item-box {
    font-family: var(--font-mono, ui-monospace, monospace);
    font-size: 0.6875rem;
    color: hsl(var(--muted-foreground));
  }

  /* ── Mobile: sibling submissions become cards, not dense single-line rows ───
     At phone widths the avatar + name + domain + rep + hash crammed onto one
     clipped line. Wrap each into a bordered card: name on its own line next to
     the avatar, domain/rep chips below, box hash on the final line. */
  @media (max-width: 640px) {
    .submissions-block .duplicate-notice-list {
      gap: 0.5rem;
    }
    .duplicate-notice-row {
      border: 1px solid hsl(var(--border));
      border-radius: 0.5rem;
      background: hsl(var(--muted) / 0.25);
      align-items: stretch;
      gap: 0;
    }
    .duplicate-notice-item {
      flex-wrap: wrap;
      align-items: center;
      gap: 0.375rem 0.5rem;
      padding: 0.625rem 0.75rem;
      font-size: 0.8125rem;
    }
    .duplicate-notice-item-name {
      flex: 1 1 auto;
      min-width: calc(100% - 1.75rem);
      font-size: 0.8125rem;
    }
    .duplicate-notice-item-rep {
      margin-left: 0;
    }
    .duplicate-notice-item-box {
      flex: 1 1 100%;
      word-break: break-all;
    }
    .duplicate-notice-discuss {
      align-self: center;
      margin-right: 0.375rem;
    }
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
    /* Above the sticky navbar; paired with use:portal so it covers the frame. */
    z-index: 1000;
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

  /* "Register Download Source" carries a denser form than the burn/new-profile
     dialogs, so give just that modal extra width. */
  .file-source-modal-content--wide {
    max-width: 56rem;
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

  /* ── Skill description: roomy, readable, WCAG-AA contrast ──────────── */
  .skill-detail-prose {
    width: 100%;
    max-width: 84ch;
    margin-bottom: 1.5rem;
    font-size: 1rem;
    line-height: 1.75;
    color: hsl(var(--foreground) / 0.85);
    white-space: pre-wrap;
  }

  /* ── Action row: Claim Coverage + Create Benchmark + Open discussion ── */
  .action-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }
  /* Secondary, quiet ghost link — grouped with the CTAs but not competing. */
  .open-discussion-link {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    margin-left: auto;
    padding: 0.625rem 0.75rem;
    font-size: 0.875rem;
    font-weight: 500;
    border-radius: 0.5rem;
    border: 1px solid transparent;
    background: transparent;
    color: hsl(var(--muted-foreground));
    cursor: pointer;
    transition: color 0.15s, background 0.15s;
  }
  .open-discussion-link:hover {
    color: hsl(var(--foreground));
    background: hsl(var(--muted) / 0.5);
  }
  @media (max-width: 560px) {
    .open-discussion-link { margin-left: 0; }
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

  .coverage-action-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex-wrap: wrap;
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

  .benchmark-block {
    margin-top: 0.75rem;
    border: 1px solid hsl(var(--border) / 0.5);
    border-radius: 0.375rem;
    overflow: hidden;
  }
  .benchmark-block-header {
    display: flex;
    align-items: baseline;
    gap: 0.75rem;
    padding: 0.4rem 0.625rem;
    background: hsl(var(--muted) / 0.2);
    border-bottom: 1px solid hsl(var(--border) / 0.4);
  }
  .benchmark-block-name {
    font-weight: 600;
    font-size: 0.8125rem;
  }
  .benchmark-block-meta {
    margin-left: auto;
    font-size: 0.6875rem;
    color: hsl(var(--muted-foreground));
  }
  .aggregate-row td {
    background: hsl(var(--muted) / 0.15);
    font-weight: 600;
  }
  .td-aggregate-label {
    color: hsl(var(--muted-foreground));
    font-style: italic;
    font-weight: 500 !important;
  }
  .aggregate-label-row td {
    background: hsl(var(--muted) / 0.1) !important;
    padding: 0.25rem 0.625rem !important;
  }
  .aggregate-label-row-td {
    display: flex;
    justify-content: space-between;
    gap: 0.5rem;
    font-size: 0.6875rem;
    color: hsl(var(--muted-foreground));
    font-style: italic;
  }
  .aggregate-label-row-divider {
    font-style: normal;
  }
  .aggregate-row-clickable {
    cursor: pointer;
  }
  .aggregate-row-clickable:hover td {
    background: hsl(var(--muted) / 0.3);
  }
  .all-cases-toggle-icon {
    display: inline-block;
    width: 0.85rem;
    margin-right: 0.25rem;
    color: hsl(var(--muted-foreground));
  }
  .all-cases-detail-row td {
    background: hsl(var(--background));
    font-weight: 400;
    font-size: 0.75rem;
    padding-top: 0.3rem;
    padding-bottom: 0.3rem;
  }
  .all-cases-detail-label {
    color: hsl(var(--muted-foreground));
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }
  .all-cases-detail-index {
    color: hsl(var(--muted-foreground));
    font-variant-numeric: tabular-nums;
    font-size: 0.7rem;
  }
  .all-cases-empty-row td {
    background: hsl(var(--background));
    font-style: italic;
    color: hsl(var(--muted-foreground));
    font-size: 0.75rem;
  }
  .all-cases-empty-cell {
    text-align: center;
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
