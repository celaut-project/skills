<script lang="ts">
  import type { Benchmark, Result, DiscussionEntry } from '$lib/types';
  import { formatServiceId, formatSourceHash } from '$lib/api';
  import { toasts } from './toastStore';
  import { FileCard, fetchFileSourcesByHash } from 'source-application';
  import type { FileSource } from 'source-application';
  import { reputation_proof, explorer_uri, source_explorer_url } from '$lib/common/store';
  import { web_explorer_uri_tkn } from '$lib/ergo/envs';

  export let benchmarks: Benchmark[] = [];
  export let selectedBenchmarkId: string | null = null;
  export let onAddSource: ((hash: string) => void) | undefined = undefined;

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

  // Submit result form state
  let showSubmitForm = false;
  let submitServiceId = '';
  let submitScore = '';
  let submitNotes = '';

  // Discussion state per benchmark
  let expandedDiscussions: Record<string, boolean> = {};
  // Discussion state per result
  let expandedResultDiscussions: Record<string, boolean> = {};

  function toggleDiscussion(id: string) {
    expandedDiscussions[id] = !expandedDiscussions[id];
    expandedDiscussions = expandedDiscussions;
  }

  function toggleResultDiscussion(id: string) {
    expandedResultDiscussions[id] = !expandedResultDiscussions[id];
    expandedResultDiscussions = expandedResultDiscussions;
  }

  function selectBenchmark(id: string) {
    selectedBenchmarkId = selectedBenchmarkId === id ? null : id;
    showSubmitForm = false;
  }

  function sortResults(results: Result[], higherIsBetter: boolean): Result[] {
    return [...results].sort((a, b) => higherIsBetter ? b.score - a.score : a.score - b.score);
  }

  function formatDate(ts: number): string {
    if (!ts) return '-';
    return new Date(ts * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
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

  function formatAuthor(author: string): string {
    if (!author) return '-';
    if (author.length <= 12) return author;
    return `${author.slice(0, 6)}...${author.slice(-4)}`;
  }

  function formatScore(score: number): string {
    if (score === 0) return '0';
    if (Math.abs(score) >= 100) return score.toFixed(1);
    if (Math.abs(score) >= 10) return score.toFixed(2);
    return score.toPrecision(3);
  }

  function truncateNotes(notes: string, maxLen: number = 30): string {
    if (!notes) return '-';
    if (notes.length <= maxLen) return notes;
    return notes.slice(0, maxLen) + '…';
  }

  function computeStats(results: Result[]): { mean: number; stddev: number } {
    if (results.length === 0) return { mean: 0, stddev: 0 };
    const scores = results.map(r => r.score);
    const mean = scores.reduce((a, b) => a + b, 0) / scores.length;
    const variance = scores.reduce((sum, s) => sum + (s - mean) ** 2, 0) / scores.length;
    return { mean, stddev: Math.sqrt(variance) };
  }

  async function copyHash(hash: string) {
    try {
      await navigator.clipboard.writeText(hash);
      toasts.info('Hash copied to clipboard');
    } catch {
      toasts.error('Failed to copy');
    }
  }

  function handleSubmitResult() {
    const scoreStr = String(submitScore).trim();
    if (!submitServiceId.trim() || !scoreStr) {
      toasts.error('Service ID and Score are required.');
      return;
    }
    console.log('Submit result:', { serviceId: submitServiceId, score: submitScore, notes: submitNotes });
    toasts.info('Result submitted (pending Type NFT deployment)');
    showSubmitForm = false;
    submitServiceId = '';
    submitScore = '';
    submitNotes = '';
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
        <div class="benchmark-card" class:benchmark-card-selected={selectedBenchmarkId === benchmark.id}>
          <button class="benchmark-header" on:click={() => selectBenchmark(benchmark.id)}>
            <div class="benchmark-info">
              <h3 class="benchmark-name">{benchmark.name}</h3>
              <div class="benchmark-meta">
                <span class="benchmark-metric">Metric: <code>{benchmark.metric}</code></span>
                <span class="benchmark-direction">{benchmark.higherIsBetter ? 'Higher is better' : 'Lower is better'}</span>
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
              <p class="benchmark-author">Created by <span class="font-mono text-xs">{formatAuthor(benchmark.author)}</span></p>

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
                      webExplorerUriTkn={web_explorer_uri_tkn}
                    />
                    {#if $reputation_proof && onAddSource}
                      <button class="add-source-btn-sm" on:click={() => onAddSource?.(benchmark.sourceHash || '')}>
                        + Add Source
                      </button>
                    {/if}
                  </div>
                </details>
              {/if}

              <!-- Results Table -->
              {#if benchmark.results.length > 0}
                {@const stats = computeStats(benchmark.results)}
                <div class="stats-summary">
                  <span class="stats-label">Mean:</span>
                  <span class="stats-value">{formatScore(stats.mean)}</span>
                  <span class="stats-separator">±</span>
                  <span class="stats-value">{formatScore(stats.stddev)}</span>
                  <span class="stats-label stats-label-secondary">({benchmark.results.length} results)</span>
                </div>

                <div class="leaderboard-table-wrapper">
                  <table class="leaderboard-table">
                    <thead>
                      <tr>
                        <th class="th-rank">Rank</th>
                        <th class="th-service">Service ID</th>
                        <th class="th-score">Score</th>
                        <th class="th-notes">Notes</th>
                        <th class="th-author">Author</th>
                        <th class="th-date">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {#each sortResults(benchmark.results, benchmark.higherIsBetter) as result, i}
                        <tr class="leaderboard-row">
                          <td class="td-rank">
                            <span class="rank-num" class:rank-gold={i === 0} class:rank-silver={i === 1} class:rank-bronze={i === 2}>#{i + 1}</span>
                          </td>
                          <td class="td-service">
                            <code class="service-id">{formatServiceId(result.serviceId)}</code>
                          </td>
                          <td class="td-score">{formatScore(result.score)}</td>
                          <td class="td-notes" title={result.notes || ''}>{truncateNotes(result.notes)}</td>
                          <td class="td-author">
                            <span class="font-mono text-xs">{formatAuthor(result.author)}</span>
                          </td>
                          <td class="td-date">{relativeTime(result.timestamp)}</td>
                        </tr>
                        <!-- Result Source Hash & Discussion -->
                        {#if result.sourceHash || (result.discussion && result.discussion.length > 0)}
                          <tr class="result-extras-row">
                            <td colspan="6" class="result-extras-cell">
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
                                      webExplorerUriTkn={web_explorer_uri_tkn}
                                    />
                                    {#if $reputation_proof && onAddSource}
                                      <button class="add-source-btn-sm" on:click={() => onAddSource?.(result.sourceHash || '')}>
                                        + Add Source
                                      </button>
                                    {/if}
                                  </div>
                                </details>
                              {/if}
                              {#if result.discussion && result.discussion.length > 0}
                                <button class="discussion-toggle discussion-toggle-inline" on:click={() => toggleResultDiscussion(result.id)}>
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                                  </svg>
                                  {result.discussion.length} {result.discussion.length === 1 ? 'comment' : 'comments'}
                                  <svg
                                    class="discussion-chevron"
                                    class:discussion-chevron-open={expandedResultDiscussions[result.id]}
                                    width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                                  >
                                    <polyline points="6 9 12 15 18 9"/>
                                  </svg>
                                </button>
                                {#if expandedResultDiscussions[result.id]}
                                  <div class="discussion-entries">
                                    {#each result.discussion as entry}
                                      <div class="discussion-entry">
                                        <div class="discussion-meta">
                                          <span class="font-mono text-[10px]">{formatAuthor(entry.author)}</span>
                                          <span class="discussion-time">{relativeTime(entry.timestamp)}</span>
                                        </div>
                                        <p class="discussion-text">{entry.text}</p>
                                      </div>
                                    {/each}
                                  </div>
                                {/if}
                              {/if}
                            </td>
                          </tr>
                        {/if}
                      {/each}
                    </tbody>
                  </table>
                </div>
              {:else}
                <p class="no-results">No results submitted yet.</p>
              {/if}

              <!-- Benchmark Discussion -->
              {#if benchmark.discussion && benchmark.discussion.length > 0}
                <div class="discussion-section">
                  <button class="discussion-toggle" on:click={() => toggleDiscussion(benchmark.id)}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                    </svg>
                    Discussion ({benchmark.discussion.length})
                    <svg
                      class="discussion-chevron"
                      class:discussion-chevron-open={expandedDiscussions[benchmark.id]}
                      width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
                    >
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </button>
                  {#if expandedDiscussions[benchmark.id]}
                    <div class="discussion-entries">
                      {#each benchmark.discussion as entry}
                        <div class="discussion-entry">
                          <div class="discussion-meta">
                            <span class="font-mono text-[10px]">{formatAuthor(entry.author)}</span>
                            <span class="discussion-time">{relativeTime(entry.timestamp)}</span>
                          </div>
                          <p class="discussion-text">{entry.text}</p>
                        </div>
                      {/each}
                    </div>
                  {/if}
                </div>
              {/if}

              <!-- Submit Result Button/Form -->
              {#if !showSubmitForm}
                <button class="submit-result-btn" on:click={() => showSubmitForm = true}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
                  </svg>
                  Submit Result
                </button>
              {:else}
                <form class="submit-result-form" on:submit|preventDefault={handleSubmitResult}>
                  <h4 class="form-title">Submit Result</h4>
                  <div class="form-row">
                    <label class="form-label" for="result-service-{benchmark.id}">Service ID <span class="text-red-500">*</span></label>
                    <input id="result-service-{benchmark.id}" class="form-input" bind:value={submitServiceId} placeholder="e.g. QmXf39bC4F7dNK2Pw..." required />
                  </div>
                  <div class="form-row">
                    <label class="form-label" for="result-score-{benchmark.id}">Score ({benchmark.metric}) <span class="text-red-500">*</span></label>
                    <input id="result-score-{benchmark.id}" class="form-input" type="number" step="any" bind:value={submitScore} placeholder="e.g. 94.2" required />
                  </div>
                  <div class="form-row">
                    <label class="form-label" for="result-notes-{benchmark.id}">Notes</label>
                    <input id="result-notes-{benchmark.id}" class="form-input" bind:value={submitNotes} placeholder="Optional notes" />
                  </div>
                  <div class="form-actions">
                    <button type="submit" class="btn-submit">Submit</button>
                    <button type="button" class="btn-cancel" on:click={() => showSubmitForm = false}>Cancel</button>
                  </div>
                </form>
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
    gap: 1rem;
    font-size: 0.75rem;
    color: hsl(var(--muted-foreground));
  }

  .benchmark-metric code {
    font-size: 0.7rem;
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    background: hsl(var(--muted));
  }

  .benchmark-direction {
    color: hsl(var(--muted-foreground));
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

  .benchmark-author {
    font-size: 0.75rem;
    color: hsl(var(--muted-foreground));
    margin-bottom: 0.75rem;
  }

  /* ── Source Hash ────────────────────────────────────────────────────── */
  /* ── Source Details (FileCard wrappers) ───────────────────────────── */
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

  /* ── Stats Summary ─────────────────────────────────────────────────── */
  .stats-summary {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    margin-bottom: 0.75rem;
    padding: 0.5rem 0.75rem;
    border-radius: 0.375rem;
    background: hsl(var(--muted) / 0.3);
    border: 1px solid hsl(var(--border) / 0.5);
    font-size: 0.8125rem;
  }

  .stats-label {
    color: hsl(var(--muted-foreground));
    font-weight: 500;
    font-size: 0.75rem;
  }

  .stats-label-secondary {
    margin-left: 0.25rem;
    font-weight: 400;
  }

  .stats-value {
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: hsl(var(--foreground));
  }

  .stats-separator {
    color: hsl(var(--muted-foreground));
    font-size: 0.75rem;
  }

  /* ── Leaderboard Table ─────────────────────────────────────────────── */
  .leaderboard-table-wrapper {
    border: 1px solid hsl(var(--border));
    border-radius: 0.5rem;
    overflow: hidden;
    margin-bottom: 1rem;
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
  }

  .th-rank { width: 3.5rem; text-align: center; }
  .th-score { width: 5rem; text-align: right; }
  .th-notes { width: 10rem; }
  .th-author { width: 7rem; }
  .th-date { width: 5.5rem; text-align: right; }

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

  .td-rank {
    text-align: center;
  }

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

  .td-notes {
    font-size: 0.75rem;
    color: hsl(var(--muted-foreground));
    max-width: 10rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .td-author {
    color: hsl(var(--muted-foreground));
  }

  .td-date {
    text-align: right;
    font-size: 0.75rem;
    color: hsl(var(--muted-foreground));
  }

  .result-extras-row {
    border-top: none;
  }

  .result-extras-cell {
    padding: 0.125rem 0.75rem 0.5rem 3.5rem !important;
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

  .discussion-toggle-inline {
    padding: 0.25rem 0.5rem;
    font-size: 0.6875rem;
    border: none;
    background: none;
  }

  .discussion-chevron {
    transition: transform 0.2s;
  }

  .discussion-chevron-open {
    transform: rotate(180deg);
  }

  .discussion-entries {
    margin-top: 0.5rem;
    padding-left: 0.75rem;
    border-left: 2px solid hsl(var(--border));
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .discussion-entry {
    padding: 0.375rem 0;
  }

  .discussion-meta {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.125rem;
  }

  .discussion-time {
    font-size: 0.625rem;
    color: hsl(var(--muted-foreground));
  }

  .discussion-text {
    font-size: 0.75rem;
    color: hsl(var(--foreground));
    line-height: 1.4;
    margin: 0;
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
    margin-bottom: 0.75rem;
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
