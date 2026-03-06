<script lang="ts">
  import type { Benchmark, Result } from '$lib/types';
  import { formatServiceId } from '$lib/api';
  import { toasts } from './toastStore';

  export let benchmarks: Benchmark[] = [];
  export let selectedBenchmarkId: string | null = null;

  // Submit result form state
  let showSubmitForm = false;
  let submitServiceId = '';
  let submitScore = '';
  let submitNotes = '';

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

  function formatAuthor(author: string): string {
    if (!author) return '-';
    if (author.length <= 12) return author;
    return `${author.slice(0, 6)}...${author.slice(-4)}`;
  }

  function handleSubmitResult() {
    if (!submitServiceId.trim() || !submitScore.trim()) {
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

              <!-- Results Leaderboard -->
              {#if benchmark.results.length > 0}
                <div class="leaderboard-table-wrapper">
                  <table class="leaderboard-table">
                    <thead>
                      <tr>
                        <th class="th-rank">Rank</th>
                        <th class="th-service">Service ID</th>
                        <th class="th-score">Score</th>
                        <th class="th-author">Author</th>
                        <th class="th-date">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {#each sortResults(benchmark.results, benchmark.higherIsBetter) as result, i}
                        <tr class="leaderboard-row">
                          <td class="td-rank">
                            <span class="rank-num">#{i + 1}</span>
                          </td>
                          <td class="td-service">
                            <code class="service-id">{formatServiceId(result.serviceId)}</code>
                          </td>
                          <td class="td-score">{typeof result.score === 'number' && result.score < 10 ? result.score.toFixed(3) : result.score.toFixed(1)}</td>
                          <td class="td-author">
                            <span class="font-mono text-xs">{formatAuthor(result.author)}</span>
                          </td>
                          <td class="td-date">{formatDate(result.timestamp)}</td>
                        </tr>
                      {/each}
                    </tbody>
                  </table>
                </div>
              {:else}
                <p class="no-results">No results submitted yet.</p>
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
    margin-bottom: 1rem;
  }

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
  .th-author { width: 7rem; }
  .th-date { width: 7rem; text-align: right; }

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

  .td-author {
    color: hsl(var(--muted-foreground));
  }

  .td-date {
    text-align: right;
    font-size: 0.75rem;
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
