<script lang="ts">
  export let skillBoxId: string = '';
  export let benchmarkCount: number = 0;

  // Mock benchmark leaderboard data — keyed by skill box ID
  const mockBenchmarks: Record<string, Array<{ service: string; score: number; date: string }>> = {
    'demo-001': [
      { service: 'AlphaTrader v2', score: 94.2, date: '2025-12-14' },
      { service: 'QuantErgo Signals', score: 88.7, date: '2025-11-28' },
      { service: 'SigmaSwap AI', score: 81.3, date: '2025-11-10' },
      { service: 'ErgoYield Bot', score: 76.9, date: '2025-10-22' },
      { service: 'DeFi Oracle v1', score: 72.1, date: '2025-10-05' }
    ],
    'demo-002': [
      { service: 'UTXOptimizer', score: 97.1, date: '2025-12-20' },
      { service: 'BoxConsolidator', score: 91.4, date: '2025-11-15' }
    ],
    'demo-003': [
      { service: 'SentimentScope', score: 85.6, date: '2025-12-01' }
    ],
    'demo-004': [
      { service: 'MEVShield Pro', score: 96.8, date: '2025-12-18' },
      { service: 'FlashGuard', score: 93.1, date: '2025-12-10' },
      { service: 'DarkForest Monitor', score: 89.4, date: '2025-11-22' },
      { service: 'SandwichBlocker', score: 84.7, date: '2025-11-05' },
      { service: 'MempoolEye', score: 79.2, date: '2025-10-15' },
      { service: 'ErgoArmor', score: 74.8, date: '2025-10-01' },
      { service: 'TxShield Basic', score: 68.3, date: '2025-09-20' }
    ],
    'demo-005': [
      { service: 'PathFinder DEX', score: 91.5, date: '2025-12-15' },
      { service: 'BridgeHopper', score: 87.2, date: '2025-11-28' },
      { service: 'LiqRoute AI', score: 82.8, date: '2025-11-10' },
      { service: 'SwapMaster', score: 78.4, date: '2025-10-20' }
    ],
    'demo-006': [
      { service: 'SigmaAudit', score: 92.3, date: '2025-12-12' },
      { service: 'ErgoSentinel', score: 88.9, date: '2025-11-30' },
      { service: 'ContractInspector', score: 83.1, date: '2025-11-08' }
    ]
  };

  $: entries = (mockBenchmarks[skillBoxId] || []).sort((a, b) => b.score - a.score);
</script>

<section class="leaderboard">
  <h2 class="leaderboard-heading">
    Leaderboard
    <span class="leaderboard-count">({entries.length} result{entries.length !== 1 ? 's' : ''})</span>
  </h2>

  {#if entries.length > 0}
    <div class="leaderboard-table-wrapper">
      <table class="leaderboard-table">
        <thead>
          <tr>
            <th class="th-rank">Rank</th>
            <th class="th-service">Service</th>
            <th class="th-score">Score</th>
            <th class="th-date">Date</th>
          </tr>
        </thead>
        <tbody>
          {#each entries as entry, i}
            <tr class="leaderboard-row">
              <td class="td-rank">
                {#if i === 0}
                  <span class="rank-badge">🥇</span>
                {:else if i === 1}
                  <span class="rank-badge">🥈</span>
                {:else if i === 2}
                  <span class="rank-badge">🥉</span>
                {:else}
                  <span class="rank-num">#{i + 1}</span>
                {/if}
              </td>
              <td class="td-service">{entry.service}</td>
              <td class="td-score">{entry.score.toFixed(1)}</td>
              <td class="td-date">{entry.date}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {:else if benchmarkCount > 0}
    <p class="leaderboard-note">{benchmarkCount} benchmark(s) on-chain. Detailed results loading…</p>
  {:else}
    <p class="leaderboard-note">No benchmark results yet. Be the first to benchmark this skill!</p>
  {/if}
</section>

<style lang="postcss">
  .leaderboard {
    margin-bottom: 1.5rem;
  }

  .leaderboard-heading {
    font-size: 1.125rem;
    font-weight: 600;
    margin-bottom: 0.75rem;
    color: hsl(var(--foreground));
  }

  .leaderboard-count {
    font-size: 0.875rem;
    font-weight: 400;
    color: hsl(var(--muted-foreground));
  }

  .leaderboard-table-wrapper {
    border: 1px solid hsl(var(--border));
    border-radius: 0.5rem;
    overflow: hidden;
  }

  .leaderboard-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  .leaderboard-table thead {
    background-color: hsl(var(--muted) / 0.5);
  }

  .leaderboard-table th {
    padding: 0.5rem 0.75rem;
    text-align: left;
    font-size: 0.75rem;
    font-weight: 600;
    color: hsl(var(--muted-foreground));
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .th-rank { width: 4rem; }
  .th-score { width: 5rem; text-align: right; }
  .th-date { width: 7rem; text-align: right; }

  .leaderboard-row {
    border-top: 1px solid hsl(var(--border));
  }

  .leaderboard-row:hover {
    background-color: hsl(var(--muted) / 0.3);
  }

  .leaderboard-table td {
    padding: 0.625rem 0.75rem;
    color: hsl(var(--foreground));
  }

  .td-rank {
    text-align: center;
  }

  .rank-badge {
    font-size: 1rem;
  }

  .rank-num {
    font-size: 0.8125rem;
    color: hsl(var(--muted-foreground));
    font-weight: 500;
  }

  .td-service {
    font-weight: 500;
  }

  .td-score {
    text-align: right;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    color: hsl(var(--primary));
  }

  .td-date {
    text-align: right;
    font-size: 0.8125rem;
    color: hsl(var(--muted-foreground));
  }

  .leaderboard-note {
    font-size: 0.875rem;
    color: hsl(var(--muted-foreground));
  }
</style>
