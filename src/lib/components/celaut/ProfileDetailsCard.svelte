<script lang="ts">
  /**
   * Profile details card — shown when the user has a reputation profile.
   *
   * Surfaces the two pieces of information Josemi asked for (TODO.md):
   *   1. R9 data (the profile's on-chain content — `proof.data`)
   *   2. Tokens sacrificed (`total_burned_string` from reputation-system)
   */
  import { total_burned_string, type ReputationProof } from 'reputation-system';

  export let proof: ReputationProof;

  // Pretty-print the profile's R9/content blob. The shape isn't strictly typed
  // by the library (it's `object`), so we coerce to string for display.
  $: r9Display = (() => {
    const data = (proof as any).data;
    if (data == null) return '(empty)';
    if (typeof data === 'string') return data;
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  })();

  $: burned = total_burned_string(proof);
  $: tokenIdShort = proof.token_id
    ? `${proof.token_id.slice(0, 10)}…${proof.token_id.slice(-6)}`
    : '—';
</script>

<div class="profile-details-card">
  <div class="profile-details-header">
    <span class="profile-details-title">Your Reputation Profile</span>
    <span class="profile-details-token" title={proof.token_id}>{tokenIdShort}</span>
  </div>
  <div class="profile-details-row">
    <span class="profile-details-label">Tokens sacrificed</span>
    <span class="profile-details-value">{burned} ERG</span>
  </div>
  <div class="profile-details-row profile-details-row-stack">
    <span class="profile-details-label">R9 data</span>
    <pre class="profile-details-r9">{r9Display}</pre>
  </div>
</div>

<style>
  .profile-details-card {
    border: 1px solid var(--border, #e5e7eb);
    border-radius: 0.75rem;
    padding: 1rem 1.25rem;
    background: var(--card, #fafafa);
    display: grid;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }
  .profile-details-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }
  .profile-details-title {
    font-weight: 600;
    font-size: 0.9rem;
  }
  .profile-details-token {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.75rem;
    color: var(--muted-foreground, #6b7280);
  }
  .profile-details-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    font-size: 0.85rem;
  }
  .profile-details-row-stack {
    flex-direction: column;
    align-items: stretch;
    gap: 0.25rem;
  }
  .profile-details-label {
    color: var(--muted-foreground, #6b7280);
  }
  .profile-details-value {
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-weight: 600;
  }
  .profile-details-r9 {
    margin: 0;
    padding: 0.5rem 0.75rem;
    background: var(--muted, #f3f4f6);
    border-radius: 0.5rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 0.75rem;
    max-height: 12rem;
    overflow: auto;
    white-space: pre-wrap;
    word-break: break-word;
  }
</style>
