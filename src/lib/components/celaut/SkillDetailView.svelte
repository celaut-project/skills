<script lang="ts">
  import BackButton from '$lib/components/celaut/BackButton.svelte';
  import ShareModal from '$lib/components/celaut/ShareModal.svelte';
  import InfoTip from '$lib/components/celaut/InfoTip.svelte';
  import ExplorerLink from '$lib/components/celaut/ExplorerLink.svelte';
  import ProfileAvatar from '$lib/components/celaut/ProfileAvatar.svelte';
  import { FileCard } from 'source-application';
  import RunServiceButton from '$lib/components/celaut/RunServiceButton.svelte';
  import ClaimCoverageButton from '$lib/components/celaut/ClaimCoverageButton.svelte';
  import SkillLeaderboard from '$lib/components/celaut/SkillLeaderboard.svelte';
  import ServiceInfoFilterBar from '$lib/components/celaut/ServiceInfoFilterBar.svelte';

  import { reputation_proof, explorer_uri, source_explorer_url, web_explorer_uri_token } from '$lib/common/store';
  import { demoMode } from '$lib/config';
  import { walletConnected } from 'wallet-svelte-component';
  import { serviceFilters, serviceInfoRegistry, serviceMatches } from '$lib/serviceFilters';
  import { viewedServiceId } from '$lib/stores';

  import { formatServiceId, formatSourceHash } from '$lib/api';
  import { categoryIcon, categoryColor } from '$lib/categoryIcons';
  import { calculateSkillReputation, formatReputation } from '$lib/reputation';
  import { formatMetricValue } from '$lib/scoring';
  import { openForum } from '$lib/components/celaut/forumSidebar';

  import type { Skill, Benchmark, Coverage } from '$lib/types';
  import type { FileSource } from 'source-application';
  import type { ComparisonTensor } from '$lib/scoring';

  // ── Local types ──────────────────────────────────────────────────────────
  type RelatedSkillDirection = 'outgoing' | 'incoming' | 'both';

  interface RelatedSkillLink {
    skill: Skill;
    direction: RelatedSkillDirection;
  }

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

  type RecommendedService = {
    coverage: Coverage;
    scoreGlobal: number;
    scorePerf: number | null;
    reputation: number;
  };

  type IndividualCase = {
    resultId: string;
    caseIndex: number;
    metricsValues: Array<number | null>;
    timestamp?: number;
  };

  // ── Props: data ──────────────────────────────────────────────────────────
  export let selectedSkill: Skill;
  export let siblingSkills: Skill[] = [];
  export let relatedSkills: RelatedSkillLink[] = [];
  export let selectedSkillReputation: ReturnType<typeof calculateSkillReputation> | null = null;
  export let skillSources: FileSource[] = [];

  // ── Bind props: UI state owned by parent ─────────────────────────────────
  export let detailVisible = false;
  export let detailTab: 'benchmarks' | 'coverages' | 'compare' = 'benchmarks';
  export let selectedBenchmarkId: string | null = null;
  export let shareModalOpen = false;
  export let showCreateBenchmarkForm = false;
  export let benchmarkName = '';
  export let benchmarkDescription = '';
  export let benchmarkMetrics: { name: string; description: string; higherIsBetter: boolean }[] = [];
  export let benchmarkDescriptors: { name: string; description: string }[] = [];
  export let benchmarkSourceHash = '';
  export let benchmarkSubmitting = false;
  export let expandedAllCases: Record<string, boolean> = {};

  // ── Callback props ────────────────────────────────────────────────────────
  export let backToGallery: () => void;
  export let selectSkill: (skill: Skill) => void;
  export let forkSkill: (skill: Skill) => void;
  export let discussRelationship: (sibling: Skill) => void;
  export let refreshSkills: (boxId?: string | null) => Promise<void>;
  export let openFileSourceModal: (hash: string) => void;
  export let handleCreateBenchmark: () => Promise<void>;
  export let addBenchmarkMetric: () => void;
  export let removeBenchmarkMetric: (i: number) => void;
  export let addBenchmarkDescriptor: () => void;
  export let removeBenchmarkDescriptor: (i: number) => void;
  export let computeRecommendedService: (skill: Skill | null) => RecommendedService | null;
  export let recommendedDownloadPromise: (serviceId: string | undefined) => Promise<FileSource | null>;
  export let collectServiceResults: (serviceId: string | undefined, skill: Skill) => ServiceBenchmarkBlock[];
  export let computeServiceCompositeScore: (serviceId: string | undefined, skill: Skill) => number;
  export let toggleAllCases: (serviceId: string | undefined, benchmarkId: string) => void;
  export let allCasesKey: (serviceId: string | undefined, benchmarkId: string) => string;
  export let collectIndividualCases: (serviceId: string | undefined, benchmark: Benchmark) => IndividualCase[];
  export let buildComparisonMatrix: (skill: Skill) => ComparisonTensor;
  export let relatedSkillDirectionLabel: (direction: RelatedSkillDirection) => string;
  export let copyToClipboard: (value: string, message?: string) => Promise<void>;
  export let formatHash: (hash: string | undefined) => string;
  export let goToProfile: () => void;

  // ── Local reactive ────────────────────────────────────────────────────────
  $: DetailCategoryIcon = categoryIcon(selectedSkill.domain);
</script>

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
          <button class="fork-skill-btn" on:click={() => forkSkill(selectedSkill)}>
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
          <p class="text-muted-foreground mb-3">This wallet does not have a reputation profile yet. Create one in the <button type="button" class="link-btn" on:click={goToProfile}>Profile tab</button> before adding a service solution or publishing benchmarks.</p>
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
        on:click={() => openForum(selectedSkill.boxId, `Skill: ${selectedSkill.name}`)}
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
                      View service details →
                    </button>
                  {/if}
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

<style lang="postcss">
  /* ── Detail view ─────────────────────────────────────────────────────── */
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

  .detail-meta-creator {
    flex-basis: 100%;
  }

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

  .detail-related-btn {
    @apply flex items-center justify-between gap-3 w-full rounded-lg p-3 border text-left transition-all duration-200;
    background: hsl(var(--card));
    border-color: hsl(var(--border));
  }
  .detail-related-btn:hover {
    border-color: hsl(var(--foreground) / 0.2);
    background: hsl(var(--muted) / 0.3);
  }

  /* ── Skill description ──────────────────────────────────────────────── */
  .skill-detail-prose {
    width: 100%;
    max-width: 84ch;
    margin-bottom: 1.5rem;
    font-size: 1rem;
    line-height: 1.75;
    color: hsl(var(--foreground) / 0.85);
    white-space: pre-wrap;
  }

  /* ── Source Details ─────────────────────────────────────────────────── */
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

  /* ── Current submissions (siblings) ─────────────────────────────────── */
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
  .submissions-block .duplicate-notice-list {
    padding: 0;
    border-top: none;
    gap: 0.25rem;
  }

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

  /* ── Best Service Highlight ──────────────────────────────────────────── */
  .best-service-card {
    @apply mb-6 p-4 rounded-lg border;
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
    color: hsl(var(--foreground));
  }
  .best-service-score-label {
    @apply text-[0.65rem] uppercase tracking-wider mt-0.5;
    color: hsl(var(--muted-foreground));
  }
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

  /* ── Action row ──────────────────────────────────────────────────────── */
  .action-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }
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

  /* ── Create Benchmark form ──────────────────────────────────────────── */
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

  /* ── Form (benchmark creation) ──────────────────────────────────────── */
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

  .submit-spinner {
    @apply w-4 h-4 rounded-full border-2 border-white/30 border-t-white;
    animation: spin 0.8s linear infinite;
  }

  @keyframes spin { to { transform: rotate(360deg); } }

  .submit-connect-card {
    @apply rounded-xl border p-8 text-center flex flex-col items-center;
    background: hsl(var(--card));
    border-color: hsl(var(--border));
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

  /* ── Coverages ──────────────────────────────────────────────────────── */
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

  /* ── Dialogue button ────────────────────────────────────────────────── */
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

  /* ── Comparative (services × benchmarks) matrix ──────────────────────── */
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
