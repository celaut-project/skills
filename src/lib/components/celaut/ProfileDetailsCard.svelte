<script lang="ts">
  /**
   * Profile details card — shown when the user has a reputation profile.
   *
   * Surfaces the two pieces of information Josemi asked for (TODO.md):
   *   1. R9 data (the profile's on-chain content)
   *   2. Tokens sacrificed (`total_burned_string` from reputation-system)
   */
  import { total_burned_string, type ReputationProof, type RPBox } from 'reputation-system';
  import { hexToUtf8 } from '$lib/ergo/envs';

  export let proof: ReputationProof;

  type Row = { key: string; value: string };

  /**
   * Resolve the profile's R9 content blob.
   *
   * `ReputationProof.data` is always `{}` in the current reputation-system
   * library — the real R9 payload lives on the proof's boxes, already decoded
   * (hex → UTF-8 → JSON) into `RPBox.content`. Matching the reference impl
   * (reputation-systems/reputation-system `Profile.svelte`), the profile box is
   * the self-pointing box (`object_pointer === token_id`); we read its content,
   * falling back to any box that carries content, then to `proof.data`.
   */
  function hasContent(content: unknown): boolean {
    if (content == null) return false;
    if (typeof content === 'string') return content.trim().length > 0;
    if (typeof content === 'object') return Object.keys(content as object).length > 0;
    return true;
  }

  function resolveR9Content(p: ReputationProof): unknown {
    const boxes: RPBox[] = p.current_boxes ?? [];
    const selfBox = boxes.find(
      (b) => b.object_pointer === p.token_id && hasContent(b.content)
    );
    const contentBox = selfBox ?? boxes.find((b) => hasContent(b.content));
    if (contentBox) return contentBox.content;
    return (p as any).data;
  }

  /**
   * Normalize the profile's R9/content blob into key/value rows.
   *
   * The on-chain R9 payload reaches us in several shapes depending on how the
   * profile was minted, and the previous card just dumped whichever one it got
   * as raw JSON (and often showed nothing, because a hex-encoded blob isn't
   * valid JSON to `JSON.stringify`). We now resolve it defensively:
   *   - a plain object  → one row per field
   *   - a JSON string   → parsed, then one row per field
   *   - a hex-encoded   → UTF-8 decoded first (R9 is a Coll[Byte]), then parsed
   *   - any leftover    → a single "value" row
   * Nothing here throws; an unparseable blob degrades to a best-effort string.
   */
  function toRows(raw: unknown): Row[] {
    let data: unknown = raw;

    // Unwrap string payloads: JSON first, then hex→UTF-8→JSON.
    if (typeof data === 'string') {
      const s = data.trim();
      if (!s) return [];
      try {
        data = JSON.parse(s);
      } catch {
        const decoded = /^[0-9a-fA-F]+$/.test(s) && s.length % 2 === 0
          ? hexToUtf8(s)
          : null;
        if (decoded) {
          try {
            data = JSON.parse(decoded);
          } catch {
            data = decoded;
          }
        }
      }
    }

    if (data == null) return [];

    if (typeof data === 'object' && !Array.isArray(data)) {
      return Object.entries(data as Record<string, unknown>).map(([key, value]) => ({
        key,
        value: stringifyValue(value)
      }));
    }

    if (Array.isArray(data)) {
      return data.map((value, i) => ({ key: `[${i}]`, value: stringifyValue(value) }));
    }

    return [{ key: 'value', value: stringifyValue(data) }];
  }

  function stringifyValue(value: unknown): string {
    if (value == null) return '—';
    if (typeof value === 'string') return value;
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch {
        return String(value);
      }
    }
    return String(value);
  }

  $: r9Rows = toRows(resolveR9Content(proof));

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
    {#if r9Rows.length}
      <table class="profile-details-table">
        <tbody>
          {#each r9Rows as row}
            <tr>
              <th scope="row">{row.key}</th>
              <td>{row.value}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    {:else}
      <span class="profile-details-empty">(empty)</span>
    {/if}
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
  .profile-details-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.75rem;
    border: 1px solid var(--border, #e5e7eb);
    border-radius: 0.5rem;
    overflow: hidden;
  }
  .profile-details-table tr {
    border-bottom: 1px solid var(--border, #e5e7eb);
  }
  .profile-details-table tr:last-child {
    border-bottom: 0;
  }
  .profile-details-table th {
    text-align: left;
    vertical-align: top;
    padding: 0.375rem 0.625rem;
    width: 35%;
    font-weight: 600;
    color: var(--muted-foreground, #6b7280);
    background: var(--muted, #f3f4f6);
    white-space: nowrap;
  }
  .profile-details-table td {
    padding: 0.375rem 0.625rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    word-break: break-word;
  }
  .profile-details-empty {
    font-size: 0.75rem;
    color: var(--muted-foreground, #6b7280);
    font-style: italic;
  }
</style>
