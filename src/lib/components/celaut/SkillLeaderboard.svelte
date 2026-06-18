<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import type { Benchmark, Result, CaseExecutionData } from '$lib/types';
  import { formatServiceId, formatSourceHash } from '$lib/api';
  import { aggregateMetricForService, bucketByDescriptor, median } from '$lib/scoring';
  import { toasts } from './toastStore';
  import { FileCard, fetchFileSourcesByHash } from 'source-application';
  import type { FileSource } from 'source-application';
  import { walletConnected } from 'wallet-svelte-component';
  import { reputation_proof, explorer_uri, source_explorer_url, web_explorer_uri_token } from '$lib/common/store';
  import { openForum } from './forumSidebar';
  // Result submission routes through the data facade so the same call path
  // works in demo mode (mockDb) and live mode (ergoProvider → create_opinion).
  import { createResult } from '$lib/data';
  import { demoMode } from '$lib/config';
  import { getMainReputationBox } from '$lib/reputationContext';

  // Parent (App.svelte) listens for `created` to refresh the skill tree after
  // a successful on-chain write. Mirrors the wiring used by ClaimCoverageButton
  // and the benchmark creation form.
  const dispatch = createEventDispatcher<{ created: { txId: string } }>();

  export let benchmarks: Benchmark[] = [];
  export let selectedBenchmarkId: string | null = null;
  export let onAddSource: ((hash: string) => void) | undefined = undefined;
  // Forwarded so dialogue buttons can produce friendly side-rail titles
  // ("Benchmark: …" / "Result for …") for whichever skill is in view.
  export let skillName: string = '';

  // Source cache per hash
  let sourceCache: Record<string, FileSource[]> = {};

  async function loadSources(hash: string) {
    if (!hash || sourceCache[hash]) return;
    try {
      const fetched = await fetchFileSourcesByHash($explorer_uri, hash);
      sourceCache[hash] = fetched ?? [];
      sourceCache = sourceCache; // trigger reactivity
    } catch {
      sourceCache[hash] = [];
      sourceCache = sourceCache;
    }
  }

  // Load sources when a benchmark with sourceHash is expanded
  $: if (selectedBenchmarkId) {
    const bench = benchmarks.find(b => b.id === selectedBenchmarkId);
    if (bench?.sourceHash) loadSources(bench.sourceHash);
    bench?.results?.forEach(r => {
      if (r.sourceHash) loadSources(r.sourceHash);
    });
  }

  // Submit result form state — see TODO at handleSubmitResult.
  let showSubmitForm = false;
  let submitServiceId = '';
  // Strings keyed by metric/descriptor index so partial typing stays valid.
  let submitMetricValues: Record<number, string> = {};
  let submitCaseMeta: Record<number, string> = {};
  let submitNotes = '';
  let submitting = false;

  function selectBenchmark(id: string) {
    selectedBenchmarkId = selectedBenchmarkId === id ? null : id;
    showSubmitForm = false;
    submitMetricValues = {};
    submitCaseMeta = {};
  }

  function formatScore(value: number | null | undefined): string {
    if (value === null || value === undefined || !Number.isFinite(value)) return '—';
    if (value === 0) return '0';
    if (Math.abs(value) >= 100) return value.toFixed(1);
    if (Math.abs(value) >= 10) return value.toFixed(2);
    return value.toPrecision(3);
  }

  function relativeTime(ts: number): string {
    if (!ts) return '-';
    const now = Date.now() / 1000;
    const diff = now - ts;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
    return new Date(ts * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function truncateNotes(notes: string, maxLen: number = 30): string {
    if (!notes) return '-';
    if (notes.length <= maxLen) return notes;
    return notes.slice(0, maxLen) + '…';
  }

  /**
   * Aggregate every service's median per metric for one benchmark — the row
   * set the leaderboard table renders.
   *
   * Cell aggregation: median across every case the service contributed.
   * Within-benchmark sort: per-column z-score, sign-flipped for
   * lower-is-better metrics, then a weighted mean by max(resultRep, 1).
   * (Same algorithm as the global composite — see scoring.ts — restricted
   * to this benchmark's columns. Cross-benchmark ranking lives in App.svelte.)
   */
  function leaderboardRows(benchmark: Benchmark) {
    const serviceIds = Array.from(new Set(benchmark.results.map((r) => r.serviceId).filter(Boolean)));
    const metrics = benchmark.performanceMetrics ?? [];
    const cells = serviceIds.map((serviceId) =>
      metrics.map((_m, i) => aggregateMetricForService(benchmark, serviceId, i))
    );

    // Per-column z-score params for within-benchmark ranking.
    const colStats = metrics.map((_m, i) => {
      const vals = cells.map((c) => c[i]?.value).filter((v): v is number => typeof v === 'number');
      if (vals.length === 0) return { mean: 0, sigma: 0 };
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const sigma =
        vals.length < 2
          ? 0
          : Math.sqrt(vals.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (vals.length - 1));
      return { mean, sigma };
    });

    const rows = serviceIds.map((serviceId, serviceIdx) => {
      const perMetric = metrics.map((m, i) => ({
        metricName: m.name,
        higherIsBetter: m.higherIsBetter,
        ...cells[serviceIdx][i]
      }));
      let weighted = 0;
      let weightTotal = 0;
      perMetric.forEach((cell, i) => {
        if (cell.value === null) return;
        const { mean, sigma } = colStats[i];
        const z = sigma === 0 ? 0 : (cell.value - mean) / sigma;
        const signed = cell.higherIsBetter ? z : -z;
        const w = Math.max(cell.resultsReputation, 1);
        weighted += signed * w;
        weightTotal += w;
      });
      const composite = weightTotal === 0 ? 0 : weighted / weightTotal;
      const latest = benchmark.results
        .filter((r) => r.serviceId === serviceId)
        .reduce((max, r) => Math.max(max, r.timestamp || 0), 0);
      const submissions = benchmark.results.filter((r) => r.serviceId === serviceId).length;
      return { serviceId, perMetric, composite, latest, submissions };
    });
    rows.sort((a, b) => b.composite - a.composite);
    return rows;
  }

  /**
   * Per-descriptor breakdown: each row is one (descriptor-tuple, service) pair
   * with the per-metric median at that bucket. Descriptor values are only
   * rendered once per bucket so adjacent rows visually group together.
   *
   * This is the answer to Josemi's "group by descriptor" requirement — the
   * aggregate leaderboard above collapses all cases into one row per service,
   * which hides the fact that two services may dominate on different
   * sub-regions of the descriptor space. The breakdown surfaces exactly that.
   */
  function descriptorBreakdownRows(benchmark: Benchmark) {
    const buckets = bucketByDescriptor(benchmark);
    const metricCount = benchmark.performanceMetrics?.length ?? 0;
    type Row = {
      bucketKey: string;
      caseMeta: number[];
      serviceId: string;
      perMetric: Array<number | null>;
      isFirstInBucket: boolean;
      bucketRowSpan: number;
    };
    const out: Row[] = [];
    for (const bucket of buckets) {
      const services = [...bucket.serviceValues.keys()];
      services.forEach((sid, i) => {
        const vals = bucket.serviceValues.get(sid) ?? Array(metricCount).fill(null);
        out.push({
          bucketKey: bucket.key,
          caseMeta: bucket.caseMeta,
          serviceId: sid,
          perMetric: vals,
          isFirstInBucket: i === 0,
          bucketRowSpan: services.length
        });
      });
    }
    return out;
  }

  async function copyHash(hash: string) {
    try {
      await navigator.clipboard.writeText(hash);
      toasts.info('Hash copied to clipboard');
    } catch {
      toasts.error('Failed to copy');
    }
  }

  /**
   * Submit a result for `benchmarkId` as a Result opinion.
   *
   * Builds a single CaseExecutionData from the form inputs:
   *   - caseMeta[i]      ← submitCaseMeta[i]
   *   - metricsValues[i] ← submitMetricValues[i]
   *
   * TODO Josemi: this only supports submitting ONE case execution per Result.
   * The on-chain Result entity already supports many cases per submission;
   * the UI should grow a "+ Add case" affordance so a single Result can
   * carry a full mini-tensor. Please confirm whether one-case-per-submission
   * is acceptable as a first step or whether we should block on multi-case
   * UX from the start.
   */
  async function handleSubmitResult(benchmark: Benchmark) {
    if (!submitServiceId.trim()) {
      toasts.error('Service ID is required.');
      return;
    }
    const metrics = benchmark.performanceMetrics ?? [];
    const descriptors = benchmark.caseDescriptors ?? [];

    // Validate every metric has a numeric value.
    const metricsValues: number[] = [];
    for (let i = 0; i < metrics.length; i += 1) {
      const raw = String(submitMetricValues[i] ?? '').trim();
      if (!raw) {
        toasts.error(`Metric "${metrics[i].name}" is required.`);
        return;
      }
      const n = Number(raw);
      if (!Number.isFinite(n)) {
        toasts.error(`Metric "${metrics[i].name}" must be a number.`);
        return;
      }
      metricsValues.push(n);
    }

    const caseMeta: number[] = [];
    for (let i = 0; i < descriptors.length; i += 1) {
      const raw = String(submitCaseMeta[i] ?? '').trim();
      if (!raw) {
        toasts.error(`Case descriptor "${descriptors[i].name}" is required.`);
        return;
      }
      const n = Number(raw);
      if (!Number.isFinite(n)) {
        toasts.error(`Case descriptor "${descriptors[i].name}" must be a number.`);
        return;
      }
      caseMeta.push(n);
    }

    // Live mode requires both a connected wallet (to sign the tx) and a
    // reputation profile box (used as `mainBox` for create_opinion). Demo
    // mode skips these — mockDb doesn't need a chain.
    if (!$demoMode) {
      if (!$walletConnected) {
        toasts.error('Connect wallet to submit a result.');
        return;
      }
      if (!$reputation_proof || !getMainReputationBox($reputation_proof)) {
        toasts.error('Create a reputation profile first.');
        return;
      }
    }

    submitting = true;
    try {
      const data: CaseExecutionData[] = [{ caseMeta, metricsValues }];
      const txId = await createResult({
        benchmarkId: benchmark.id,
        serviceId: submitServiceId.trim(),
        data,
        notes: submitNotes.trim(),
        timestamp: Math.floor(Date.now() / 1000),
        tokenAmount: 1,
        mainBox: $reputation_proof ? getMainReputationBox($reputation_proof) : undefined
      });

      toasts.success($demoMode ? 'Result submitted (demo mode).' : 'Result published on-chain.');
      dispatch('created', { txId });
      showSubmitForm = false;
      submitServiceId = '';
      submitMetricValues = {};
      submitCaseMeta = {};
      submitNotes = '';
    } catch (error: any) {
      toasts.error(error?.message || 'Result submission failed.');
    } finally {
      submitting = false;
    }
  }
</script>

{#if benchmarks.length > 0}
  <section class="benchmarks-section">
    <div class="section-header">
      <h2 class="section-title">Benchmarks</h2>
      <span class="section-count">{benchmarks.length}</span>
    </div>

    <div class="benchmarks-list">
      {#each benchmarks as benchmark}
        {@const metrics = benchmark.performanceMetrics ?? []}
        {@const descriptors = benchmark.caseDescriptors ?? []}
        <div class="benchmark-card" class:benchmark-card-selected={selectedBenchmarkId === benchmark.id}>
          <button class="benchmark-header" on:click={() => selectBenchmark(benchmark.id)}>
            <div class="benchmark-info">
              <h3 class="benchmark-name">{benchmark.name}</h3>
              <div class="benchmark-meta">
                {#if metrics.length === 0}
                  <span class="benchmark-metric benchmark-metric-empty">No metrics defined</span>
                {:else}
                  {#each metrics as m}
                    <span class="benchmark-metric">
                      <code>{m.name}</code>
                      <span class="metric-arrow" title={m.higherIsBetter ? 'Higher is better' : 'Lower is better'}>{m.higherIsBetter ? '↑' : '↓'}</span>
                    </span>
                  {/each}
                {/if}
                {#if descriptors.length > 0}
                  <span class="benchmark-descriptors" title="Case descriptors (problem-space dimensions)">
                    {descriptors.length} descriptor{descriptors.length !== 1 ? 's' : ''}
                  </span>
                {/if}
              </div>
            </div>
            <div class="benchmark-result-count">
              {benchmark.results.length} result{benchmark.results.length !== 1 ? 's' : ''}
            </div>
            <svg
              class="benchmark-chevron"
              class:benchmark-chevron-open={selectedBenchmarkId === benchmark.id}
              width="16" height="16" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" stroke-width="2"
            >
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>

          {#if selectedBenchmarkId === benchmark.id}
            <div class="benchmark-detail">
              <p class="benchmark-description">{benchmark.description}</p>

              {#if descriptors.length > 0 || metrics.length > 0}
                <div class="benchmark-schema">
                  {#if descriptors.length > 0}
                    <div class="schema-block">
                      <div class="schema-label">Case descriptors (problem dimensions)</div>
                      <ul class="schema-list">
                        {#each descriptors as d}
                          <li><code>{d.name}</code> — {d.description || 'no description'}</li>
                        {/each}
                      </ul>
                    </div>
                  {/if}
                  {#if metrics.length > 0}
                    <div class="schema-block">
                      <div class="schema-label">Performance metrics</div>
                      <ul class="schema-list">
                        {#each metrics as m}
                          <li>
                            <code>{m.name}</code> {m.higherIsBetter ? '↑' : '↓'}
                            {m.description ? `— ${m.description}` : ''}
                          </li>
                        {/each}
                      </ul>
                    </div>
                  {/if}
                </div>
              {/if}

              <!-- Source Hash (FileCard) -->
              {#if benchmark.sourceHash}
                <details class="source-details-inline">
                  <summary class="source-summary-inline">
                    <span>📄 Source:</span>
                    <code class="source-hash-code">{formatSourceHash(benchmark.sourceHash)}</code>
                  </summary>
                  <div class="source-card-inline">
                    <FileCard
                      fileHash={benchmark.sourceHash}
                      profile={$reputation_proof}
                      sources={sourceCache[benchmark.sourceHash] || []}
                      explorerUri={$explorer_uri}
                      source_explorer_url={$source_explorer_url}
                      webExplorerUriTkn={$web_explorer_uri_token}
                    />
                    {#if $reputation_proof && onAddSource}
                      <button class="add-source-btn-sm" on:click={() => onAddSource?.(benchmark.sourceHash || '')}>
                        + Add Source
                      </button>
                    {/if}
                  </div>
                </details>
              {/if}

              <!-- Per-service leaderboard table (aggregated across cases). -->
              {#if benchmark.results.length > 0 && metrics.length > 0}
                {@const rows = leaderboardRows(benchmark)}
                <div class="leaderboard-table-wrapper">
                  <table class="leaderboard-table">
                    <thead>
                      <tr>
                        <th class="th-rank">Rank</th>
                        <th class="th-service">Service</th>
                        {#each metrics as m}
                          <th class="th-metric" title={m.description}>
                            <code>{m.name}</code> {m.higherIsBetter ? '↑' : '↓'}
                          </th>
                        {/each}
                        <th class="th-runs" title="Number of Result submissions">Runs</th>
                        <th class="th-date">Latest</th>
                      </tr>
                    </thead>
                    <tbody>
                      {#each rows as row, i}
                        <tr class="leaderboard-row">
                          <td class="td-rank">
                            <span class="rank-num" class:rank-gold={i === 0} class:rank-silver={i === 1} class:rank-bronze={i === 2}>#{i + 1}</span>
                          </td>
                          <td class="td-service">
                            <code class="service-id">{formatServiceId(row.serviceId)}</code>
                          </td>
                          {#each row.perMetric as cell}
                            <td class="td-score" title={`${cell.metricName} · weighted mean across ${cell.resultCount} result(s)`}>
                              {formatScore(cell.value)}
                            </td>
                          {/each}
                          <td class="td-runs">{row.submissions}</td>
                          <td class="td-date">{relativeTime(row.latest)}</td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                </div>

                <!-- By-descriptor breakdown: shows per-(case, service) median. -->
                {#if descriptors.length > 0}
                  {@const breakdown = descriptorBreakdownRows(benchmark)}
                  {#if breakdown.length > 0}
                    <details class="descriptor-breakdown-details">
                      <summary class="descriptor-breakdown-summary">
                        By descriptor ({breakdown.length} row{breakdown.length !== 1 ? 's' : ''} across
                        {new Set(breakdown.map((r) => r.bucketKey)).size} case{new Set(breakdown.map((r) => r.bucketKey)).size !== 1 ? 's' : ''})
                      </summary>
                      <p class="descriptor-breakdown-hint">
                        Per-service medians at each unique
                        {descriptors.map((d) => d.name).join(' · ')} tuple. Cells empty when a
                        service didn't run that case.
                      </p>
                      <div class="leaderboard-table-wrapper">
                        <table class="descriptor-breakdown-table">
                          <thead>
                            <tr>
                              {#each descriptors as d}
                                <th class="th-descriptor" title={d.description}><code>{d.name}</code></th>
                              {/each}
                              <th>Service</th>
                              {#each metrics as m}
                                <th class="th-metric" title={m.description}>
                                  <code>{m.name}</code> {m.higherIsBetter ? '↑' : '↓'}
                                </th>
                              {/each}
                            </tr>
                          </thead>
                          <tbody>
                            {#each breakdown as row}
                              <tr class="leaderboard-row" class:descriptor-bucket-first={row.isFirstInBucket}>
                                {#each descriptors as _d, i}
                                  {#if row.isFirstInBucket}
                                    <td class="td-descriptor" rowspan={row.bucketRowSpan}>
                                      <code>{row.caseMeta[i] ?? '—'}</code>
                                    </td>
                                  {/if}
                                {/each}
                                <td class="td-service"><code class="service-id">{formatServiceId(row.serviceId)}</code></td>
                                {#each row.perMetric as v}
                                  <td class="td-score">{formatScore(v)}</td>
                                {/each}
                              </tr>
                            {/each}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  {/if}
                {/if}

                <!-- Raw per-result tensor (collapsed by default). -->
                <details class="raw-results-details">
                  <summary class="raw-results-summary">
                    Raw submissions ({benchmark.results.length})
                  </summary>
                  <div class="raw-results-list">
                    {#each benchmark.results as result}
                      <div class="raw-result">
                        <div class="raw-result-header">
                          <code class="service-id">{formatServiceId(result.serviceId)}</code>
                          <span class="raw-result-meta">
                            {result.data?.length ?? 0} case{(result.data?.length ?? 0) !== 1 ? 's' : ''}
                            · {relativeTime(result.timestamp)}
                          </span>
                          <button
                            class="forum-toggle-sm"
                            type="button"
                            on:click={() => openForum(result.id, `Result for ${formatServiceId(result.serviceId)} — ${benchmark.name}`)}
                            title="Open discussion for this result"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                            </svg>
                          </button>
                        </div>
                        {#if (result.data?.length ?? 0) === 0}
                          <p class="raw-result-empty">No case executions in this submission.</p>
                        {:else}
                          <table class="raw-cases-table">
                            <thead>
                              <tr>
                                {#each descriptors as d}
                                  <th><code>{d.name}</code></th>
                                {/each}
                                {#each metrics as m}
                                  <th class="num"><code>{m.name}</code></th>
                                {/each}
                              </tr>
                            </thead>
                            <tbody>
                              {#each result.data as c}
                                <tr>
                                  {#each descriptors as _, i}
                                    <td><code>{c.caseMeta[i] ?? '—'}</code></td>
                                  {/each}
                                  {#each metrics as _, i}
                                    <td class="num">{formatScore(c.metricsValues[i])}</td>
                                  {/each}
                                </tr>
                              {/each}
                            </tbody>
                          </table>
                        {/if}
                        {#if result.notes}
                          <p class="raw-result-notes" title={result.notes}>Notes: {truncateNotes(result.notes, 80)}</p>
                        {/if}
                        {#if result.sourceHash}
                          <details class="source-details-result">
                            <summary class="source-summary-result">
                              <span>📄</span>
                              <code class="source-hash-code-sm">{formatSourceHash(result.sourceHash)}</code>
                            </summary>
                            <div class="source-card-result">
                              <FileCard
                                fileHash={result.sourceHash}
                                profile={$reputation_proof}
                                sources={sourceCache[result.sourceHash] || []}
                                explorerUri={$explorer_uri}
                                source_explorer_url={$source_explorer_url}
                                webExplorerUriTkn={$web_explorer_uri_token}
                              />
                              {#if $reputation_proof && onAddSource}
                                <button class="add-source-btn-sm" on:click={() => onAddSource?.(result.sourceHash || '')}>
                                  + Add Source
                                </button>
                              {/if}
                            </div>
                          </details>
                        {/if}
                      </div>
                    {/each}
                  </div>
                </details>
              {:else if metrics.length === 0}
                <p class="no-results">This benchmark has no performance metrics yet — add metrics before submitting results.</p>
              {:else}
                <p class="no-results">No results submitted yet.</p>
              {/if}

              <!-- Benchmark discussion — opens side-rail with topic = benchmark.id. -->
              <div class="discussion-section">
                <button
                  class="discussion-toggle"
                  type="button"
                  on:click={() => openForum(benchmark.id, `Benchmark: ${benchmark.name}${skillName ? ` — ${skillName}` : ''}`)}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                  </svg>
                  Dialogue
                </button>
              </div>

              <!-- Submit Result Button/Form -->
              {#if metrics.length > 0}
                {#if !showSubmitForm}
                  <button class="submit-result-btn" on:click={() => showSubmitForm = true}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
                    </svg>
                    Submit Result
                  </button>
                {:else}
                  <form class="submit-result-form" on:submit|preventDefault={() => handleSubmitResult(benchmark)}>
                    <h4 class="form-title">Submit Result</h4>
                    <p class="form-hint">
                      One case execution per submission for now —
                      multi-case entry coming soon (see TODO in <code>SkillLeaderboard.svelte</code>).
                    </p>
                    <div class="form-row">
                      <label class="form-label" for="result-service-{benchmark.id}">Service ID <span class="text-red-500">*</span></label>
                      <input id="result-service-{benchmark.id}" class="form-input" bind:value={submitServiceId} placeholder="e.g. QmXf39bC4F7dNK2Pw..." required />
                    </div>
                    {#each descriptors as d, i}
                      <div class="form-row">
                        <label class="form-label" for="result-case-{benchmark.id}-{i}">
                          Case · <code>{d.name}</code>
                          {#if d.description}<span class="form-hint-inline">— {d.description}</span>{/if}
                          <span class="text-red-500">*</span>
                        </label>
                        <input
                          id="result-case-{benchmark.id}-{i}"
                          class="form-input"
                          type="number"
                          step="any"
                          bind:value={submitCaseMeta[i]}
                          placeholder="numeric value"
                          required
                        />
                      </div>
                    {/each}
                    {#each metrics as m, i}
                      <div class="form-row">
                        <label class="form-label" for="result-metric-{benchmark.id}-{i}">
                          Metric · <code>{m.name}</code> {m.higherIsBetter ? '↑' : '↓'}
                          <span class="text-red-500">*</span>
                        </label>
                        <input
                          id="result-metric-{benchmark.id}-{i}"
                          class="form-input"
                          type="number"
                          step="any"
                          bind:value={submitMetricValues[i]}
                          placeholder={m.description || 'numeric value'}
                          required
                        />
                      </div>
                    {/each}
                    <div class="form-row">
                      <label class="form-label" for="result-notes-{benchmark.id}">Notes</label>
                      <input id="result-notes-{benchmark.id}" class="form-input" bind:value={submitNotes} placeholder="Optional notes" />
                    </div>
                    <div class="form-actions">
                      <button type="submit" class="btn-submit" disabled={submitting}>
                        {submitting ? 'Submitting…' : 'Submit'}
                      </button>
                      <button type="button" class="btn-cancel" on:click={() => showSubmitForm = false} disabled={submitting}>Cancel</button>
                    </div>
                  </form>
                {/if}
              {/if}
            </div>
          {/if}
        </div>
      {/each}
    </div>
  </section>
{:else}
  <section class="benchmarks-section">
    <div class="section-header">
      <h2 class="section-title">Benchmarks</h2>
      <span class="section-count">0</span>
    </div>
    <div class="no-benchmarks">
      <p>No benchmarks defined yet. Create one to establish performance standards.</p>
    </div>
  </section>
{/if}

<style lang="postcss">
  .benchmarks-section {
    margin-bottom: 1.5rem;
  }

  .section-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0.75rem;
    padding-bottom: 0.75rem;
    border-bottom: 1px solid hsl(var(--border) / 0.5);
  }

  .section-title {
    font-size: 1.125rem;
    font-weight: 700;
  }

  .section-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 28px;
    height: 24px;
    padding: 0 0.5rem;
    border-radius: 9999px;
    font-size: 0.75rem;
    font-weight: 600;
    background: hsl(var(--muted));
    color: hsl(var(--muted-foreground));
  }

  .benchmarks-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .benchmark-card {
    border: 1px solid hsl(var(--border));
    border-radius: 0.5rem;
    background: hsl(var(--card));
    overflow: hidden;
    transition: border-color 0.2s;
  }

  .benchmark-card-selected {
    border-color: hsl(var(--foreground) / 0.2);
  }

  .benchmark-header {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: none;
    border: none;
    cursor: pointer;
    text-align: left;
    color: hsl(var(--foreground));
  }

  .benchmark-header:hover {
    background: hsl(var(--muted) / 0.3);
  }

  .benchmark-info {
    flex: 1;
  }

  .benchmark-name {
    font-size: 0.9375rem;
    font-weight: 600;
    margin-bottom: 0.125rem;
  }

  .benchmark-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    font-size: 0.75rem;
    color: hsl(var(--muted-foreground));
    align-items: center;
  }

  .benchmark-metric {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
  }

  .benchmark-metric code {
    font-size: 0.7rem;
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    background: hsl(var(--muted));
  }

  .benchmark-metric-empty {
    font-style: italic;
  }

  .benchmark-descriptors {
    padding: 0.0625rem 0.375rem;
    border-radius: 9999px;
    background: hsl(var(--muted) / 0.5);
    font-size: 0.6875rem;
  }

  .metric-arrow {
    font-size: 0.875rem;
    line-height: 1;
  }

  .benchmark-result-count {
    font-size: 0.75rem;
    color: hsl(var(--muted-foreground));
    white-space: nowrap;
  }

  .benchmark-chevron {
    transition: transform 0.2s;
    color: hsl(var(--muted-foreground));
    flex-shrink: 0;
  }

  .benchmark-chevron-open {
    transform: rotate(180deg);
  }

  .benchmark-detail {
    padding: 0 1rem 1rem;
    border-top: 1px solid hsl(var(--border) / 0.5);
  }

  .benchmark-description {
    font-size: 0.8125rem;
    color: hsl(var(--muted-foreground));
    margin: 0.75rem 0 0.5rem;
    line-height: 1.5;
  }

  .benchmark-schema {
    display: grid;
    grid-template-columns: 1fr;
    gap: 0.5rem;
    margin-bottom: 0.75rem;
    padding: 0.5rem 0.75rem;
    background: hsl(var(--muted) / 0.2);
    border-radius: 0.375rem;
    border: 1px solid hsl(var(--border) / 0.5);
  }
  @media (min-width: 640px) {
    .benchmark-schema {
      grid-template-columns: 1fr 1fr;
    }
  }

  .schema-label {
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: hsl(var(--muted-foreground));
    margin-bottom: 0.25rem;
  }

  .schema-list {
    list-style: none;
    padding: 0;
    margin: 0;
    font-size: 0.75rem;
    color: hsl(var(--foreground));
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .schema-list code {
    font-size: 0.6875rem;
    padding: 0.0625rem 0.25rem;
    border-radius: 0.1875rem;
    background: hsl(var(--muted) / 0.5);
  }

  /* ── Source Hash ────────────────────────────────────────────────────── */
  .source-details-inline,
  .source-details-result {
    border: 1px solid hsl(var(--border));
    border-radius: 0.375rem;
    margin-bottom: 0.75rem;
    overflow: hidden;
  }

  .source-details-result {
    margin-bottom: 0.25rem;
  }

  .source-summary-inline,
  .source-summary-result {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.625rem;
    cursor: pointer;
    font-size: 0.6875rem;
    font-weight: 500;
    color: hsl(var(--muted-foreground));
    list-style: none;
    background: hsl(var(--muted) / 0.2);
    transition: background 0.15s;
  }

  .source-summary-inline:hover,
  .source-summary-result:hover {
    background: hsl(var(--muted) / 0.4);
  }

  .source-summary-inline::-webkit-details-marker,
  .source-summary-result::-webkit-details-marker {
    display: none;
  }

  .source-hash-code {
    font-size: 0.625rem;
    font-family: monospace;
    color: hsl(var(--foreground));
    padding: 0.0625rem 0.25rem;
    border-radius: 0.1875rem;
    background: hsl(var(--muted) / 0.5);
  }

  .source-hash-code-sm {
    font-size: 0.5625rem;
    font-family: monospace;
    color: hsl(var(--foreground));
    padding: 0.0625rem 0.1875rem;
    border-radius: 0.125rem;
    background: hsl(var(--muted) / 0.5);
  }

  .source-card-inline,
  .source-card-result {
    padding: 0.5rem;
  }

  .add-source-btn-sm {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    margin-top: 0.375rem;
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    font-size: 0.6875rem;
    font-weight: 500;
    color: hsl(var(--muted-foreground));
    background: hsl(var(--muted) / 0.3);
    border: 1px solid hsl(var(--border));
    cursor: pointer;
    transition: all 0.15s;
  }

  .add-source-btn-sm:hover {
    color: hsl(var(--foreground));
    background: hsl(var(--muted) / 0.5);
  }

  /* ── Leaderboard Table ─────────────────────────────────────────────── */
  .leaderboard-table-wrapper {
    border: 1px solid hsl(var(--border));
    border-radius: 0.5rem;
    overflow: auto;
    margin-bottom: 0.75rem;
  }

  .leaderboard-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8125rem;
  }

  .leaderboard-table thead {
    background-color: hsl(var(--muted) / 0.5);
  }

  .leaderboard-table th {
    padding: 0.5rem 0.75rem;
    text-align: left;
    font-size: 0.6875rem;
    font-weight: 600;
    color: hsl(var(--muted-foreground));
    text-transform: uppercase;
    letter-spacing: 0.04em;
    white-space: nowrap;
  }

  .th-rank { width: 3.5rem; text-align: center; }
  .th-metric { text-align: right; }
  .th-runs { width: 3rem; text-align: right; }
  .th-date { width: 6rem; text-align: right; }

  .leaderboard-row {
    border-top: 1px solid hsl(var(--border));
  }

  .leaderboard-row:hover {
    background-color: hsl(var(--muted) / 0.3);
  }

  .leaderboard-table td {
    padding: 0.5rem 0.75rem;
    color: hsl(var(--foreground));
  }

  .td-rank { text-align: center; }
  .td-runs { text-align: right; font-variant-numeric: tabular-nums; }
  .td-date { text-align: right; font-size: 0.75rem; color: hsl(var(--muted-foreground)); }

  .rank-num {
    font-size: 0.75rem;
    color: hsl(var(--muted-foreground));
    font-weight: 600;
  }

  .rank-gold { color: hsl(45 90% 55%); }
  .rank-silver { color: hsl(0 0% 70%); }
  .rank-bronze { color: hsl(30 60% 55%); }

  .td-service {
    font-weight: 500;
  }

  .service-id {
    font-size: 0.75rem;
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    background: hsl(var(--muted) / 0.5);
  }

  .td-score {
    text-align: right;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: hsl(var(--foreground));
  }

  .forum-toggle-sm {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 0.25rem;
    border: 1px solid transparent;
    background: none;
    color: hsl(var(--muted-foreground));
    cursor: pointer;
    transition: all 0.15s;
  }
  .forum-toggle-sm:hover {
    background: hsl(var(--muted) / 0.4);
    color: hsl(var(--foreground));
    border-color: hsl(var(--border));
  }

  .descriptor-breakdown-details {
    margin-bottom: 0.75rem;
  }

  .descriptor-breakdown-summary {
    cursor: pointer;
    font-size: 0.75rem;
    color: hsl(var(--muted-foreground));
    padding: 0.375rem 0.625rem;
    border-radius: 0.375rem;
    background: hsl(var(--muted) / 0.2);
    display: inline-block;
  }
  .descriptor-breakdown-summary:hover {
    background: hsl(var(--muted) / 0.4);
  }

  .descriptor-breakdown-hint {
    font-size: 0.6875rem;
    color: hsl(var(--muted-foreground));
    margin: 0.5rem 0;
    line-height: 1.4;
  }

  .descriptor-breakdown-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.8125rem;
  }
  .descriptor-breakdown-table thead {
    background-color: hsl(var(--muted) / 0.5);
  }
  .descriptor-breakdown-table th {
    padding: 0.4rem 0.625rem;
    text-align: left;
    font-size: 0.6875rem;
    font-weight: 600;
    color: hsl(var(--muted-foreground));
    text-transform: uppercase;
    letter-spacing: 0.04em;
    white-space: nowrap;
  }
  .descriptor-breakdown-table .th-descriptor { background: hsl(var(--muted) / 0.3); }
  .descriptor-breakdown-table .th-metric { text-align: right; }
  .descriptor-breakdown-table td {
    padding: 0.4rem 0.625rem;
    color: hsl(var(--foreground));
    border-top: 1px solid hsl(var(--border) / 0.4);
  }
  .descriptor-breakdown-table .td-descriptor {
    vertical-align: top;
    background: hsl(var(--muted) / 0.15);
    border-right: 1px solid hsl(var(--border) / 0.5);
    font-variant-numeric: tabular-nums;
  }
  .descriptor-breakdown-table .td-score {
    text-align: right;
    font-variant-numeric: tabular-nums;
    font-weight: 600;
  }
  .descriptor-bucket-first {
    border-top: 2px solid hsl(var(--border) / 0.7);
  }

  .raw-results-details {
    margin-bottom: 1rem;
  }

  .raw-results-summary {
    cursor: pointer;
    font-size: 0.75rem;
    color: hsl(var(--muted-foreground));
    padding: 0.375rem 0.625rem;
    border-radius: 0.375rem;
    background: hsl(var(--muted) / 0.2);
    display: inline-block;
  }
  .raw-results-summary:hover {
    background: hsl(var(--muted) / 0.4);
  }

  .raw-results-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin-top: 0.5rem;
  }

  .raw-result {
    padding: 0.5rem 0.75rem;
    border: 1px solid hsl(var(--border) / 0.5);
    border-radius: 0.375rem;
    background: hsl(var(--background));
  }

  .raw-result-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.375rem;
  }

  .raw-result-meta {
    font-size: 0.6875rem;
    color: hsl(var(--muted-foreground));
    margin-left: auto;
    margin-right: 0.25rem;
  }

  .raw-cases-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.75rem;
  }
  .raw-cases-table th {
    text-align: left;
    padding: 0.25rem 0.5rem;
    font-weight: 500;
    color: hsl(var(--muted-foreground));
    font-size: 0.6875rem;
  }
  .raw-cases-table td {
    padding: 0.25rem 0.5rem;
    border-top: 1px solid hsl(var(--border) / 0.4);
  }
  .raw-cases-table td.num,
  .raw-cases-table th.num {
    text-align: right;
    font-variant-numeric: tabular-nums;
  }

  .raw-result-empty {
    font-size: 0.75rem;
    color: hsl(var(--muted-foreground));
    margin: 0.25rem 0;
  }

  .raw-result-notes {
    margin-top: 0.375rem;
    font-size: 0.6875rem;
    color: hsl(var(--muted-foreground));
  }

  .no-results, .no-benchmarks {
    font-size: 0.8125rem;
    color: hsl(var(--muted-foreground));
    padding: 1rem;
    border: 1px dashed hsl(var(--border));
    border-radius: 0.5rem;
    text-align: center;
  }

  /* ── Discussion ────────────────────────────────────────────────────── */
  .discussion-section {
    margin-bottom: 1rem;
  }

  .discussion-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0.75rem;
    border-radius: 0.375rem;
    border: 1px solid hsl(var(--border));
    background: hsl(var(--muted) / 0.2);
    color: hsl(var(--muted-foreground));
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
  }

  .discussion-toggle:hover {
    background: hsl(var(--muted) / 0.4);
    color: hsl(var(--foreground));
  }

  /* ── Submit Form ───────────────────────────────────────────────────── */
  .submit-result-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    border-radius: 0.5rem;
    font-size: 0.8125rem;
    font-weight: 600;
    background: hsl(142 50% 42%);
    color: white;
    border: none;
    cursor: pointer;
    transition: background 0.2s;
  }

  .submit-result-btn:hover {
    background: hsl(142 50% 38%);
  }

  .submit-result-form {
    padding: 1rem;
    border: 1px solid hsl(var(--border));
    border-radius: 0.5rem;
    background: hsl(var(--muted) / 0.2);
  }

  .form-title {
    font-size: 0.875rem;
    font-weight: 600;
    margin-bottom: 0.25rem;
  }

  .form-hint {
    font-size: 0.6875rem;
    color: hsl(var(--muted-foreground));
    margin-bottom: 0.625rem;
  }

  .form-hint-inline {
    font-weight: 400;
    color: hsl(var(--muted-foreground));
  }

  .form-row {
    margin-bottom: 0.625rem;
  }

  .form-label {
    display: block;
    font-size: 0.75rem;
    font-weight: 500;
    margin-bottom: 0.25rem;
    color: hsl(var(--foreground));
  }

  .form-input {
    width: 100%;
    padding: 0.5rem 0.75rem;
    border-radius: 0.375rem;
    border: 1px solid hsl(var(--border));
    background: hsl(var(--background));
    color: hsl(var(--foreground));
    font-size: 0.8125rem;
  }

  .form-input:focus {
    outline: none;
    border-color: hsl(var(--foreground) / 0.3);
    box-shadow: 0 0 0 2px hsl(var(--foreground) / 0.1);
  }

  .form-actions {
    display: flex;
    gap: 0.5rem;
    margin-top: 0.75rem;
  }

  .btn-submit {
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    font-size: 0.8125rem;
    font-weight: 600;
    background: hsl(142 50% 42%);
    color: white;
    border: none;
    cursor: pointer;
  }

  .btn-submit:hover {
    background: hsl(142 50% 38%);
  }

  .btn-cancel {
    padding: 0.5rem 1rem;
    border-radius: 0.375rem;
    font-size: 0.8125rem;
    font-weight: 500;
    background: hsl(var(--muted));
    color: hsl(var(--foreground));
    border: 1px solid hsl(var(--border));
    cursor: pointer;
  }

  .btn-cancel:hover {
    background: hsl(var(--muted) / 0.8);
  }
</style>
