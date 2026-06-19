<script lang="ts">
  /**
   * FormalSpecEditor — structured editor for a Skill's `formal` field.
   *
   * The on-chain Skill type carries `formal: string` (an opaque
   * machine-readable spec, e.g. JSON-Schema / typed grammar). Until Josemi
   * publishes the canonical JSON-Schema for the field, this component is
   * schema-agnostic: it edits an arbitrary JSON value via a structured
   * key/value editor and a raw-JSON fallback toggle, then emits the result
   * as a canonical JSON string for storage in `formal`.
   *
   * When `schema` is provided (future state), the structured editor renders
   * one field per schema property (string / number / boolean / object / array).
   * In schema-less mode (current state) it just dumps the parsed object as a
   * list of editable key/value pairs.
   *
   * Two-way bind: bind:value={formalString}. The component owns the parsed
   * representation internally; the outside world only ever sees the JSON
   * string (which is what gets serialized into the on-chain register).
   */
  import { createEventDispatcher } from 'svelte';

  /** Stringified JSON value (or empty). Two-way bound. */
  export let value: string = '';

  /** Optional JSON-Schema describing the expected `formal` shape. Currently
   * unused (schema-less mode); reserved for the schema-driven path. */
  export let schema: Record<string, unknown> | null = null;

  /** Field id for label association. */
  export let id: string = 'formal-spec-editor';

  const dispatch = createEventDispatcher<{ change: string }>();

  type Mode = 'structured' | 'raw';
  let mode: Mode = 'structured';
  let rawError: string | null = null;

  interface Pair { k: string; v: string; }

  /** Parsed object representation for the structured editor. */
  let pairs: Pair[] = [];
  /** Raw JSON text mirror (in raw mode the user edits this directly). */
  let rawText: string = '';
  /** Guards reentrancy when we update internal state from `value`. */
  let syncing = false;

  function tryParse(text: string): { ok: true; obj: Record<string, unknown> } | { ok: false; err: string } {
    const trimmed = text.trim();
    if (!trimmed) return { ok: true, obj: {} };
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return { ok: true, obj: parsed as Record<string, unknown> };
      }
      return { ok: false, err: 'Formal spec must be a JSON object at the top level.' };
    } catch (e: any) {
      return { ok: false, err: e?.message || 'Invalid JSON.' };
    }
  }

  function pairsFromObject(obj: Record<string, unknown>): Pair[] {
    return Object.entries(obj).map(([k, v]) => ({
      k,
      v: typeof v === 'string' ? v : JSON.stringify(v)
    }));
  }

  function objectFromPairs(ps: Pair[]): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const { k, v } of ps) {
      if (!k.trim()) continue;
      // Try to coerce v as JSON literal (numbers/booleans/null/objects/arrays)
      const trimmed = v.trim();
      if (trimmed.startsWith('{') || trimmed.startsWith('[')
          || trimmed === 'true' || trimmed === 'false' || trimmed === 'null'
          || /^-?\d+(\.\d+)?$/.test(trimmed)) {
        try { out[k] = JSON.parse(trimmed); continue; } catch { /* fall through */ }
      }
      out[k] = v;
    }
    return out;
  }

  // Sync incoming `value` -> internal state (one-shot per change).
  $: if (!syncing) syncFromValue(value);

  function syncFromValue(s: string) {
    syncing = true;
    const parsed = tryParse(s);
    if (parsed.ok) {
      pairs = pairsFromObject(parsed.obj);
      rawText = s.trim() ? s : '';
      rawError = null;
    } else {
      // keep whatever pairs we had; surface the raw text + error so user can fix it
      rawText = s;
      rawError = parsed.err;
      mode = 'raw';
    }
    syncing = false;
  }

  function emit(next: string) {
    syncing = true;
    value = next;
    dispatch('change', next);
    queueMicrotask(() => { syncing = false; });
  }

  function emitFromPairs() {
    const obj = objectFromPairs(pairs);
    const next = Object.keys(obj).length === 0 ? '' : JSON.stringify(obj);
    rawText = next;
    rawError = null;
    emit(next);
  }

  function onRawInput() {
    const parsed = tryParse(rawText);
    if (parsed.ok) {
      pairs = pairsFromObject(parsed.obj);
      rawError = null;
      emit(rawText.trim() ? JSON.stringify(parsed.obj) : '');
    } else {
      rawError = parsed.err;
      // Don't propagate invalid JSON up.
    }
  }

  function addPair() {
    pairs = [...pairs, { k: '', v: '' }];
  }
  function removePair(i: number) {
    pairs = pairs.filter((_, idx) => idx !== i);
    emitFromPairs();
  }
  function updatePair(i: number, field: 'k' | 'v', val: string) {
    pairs = pairs.map((p, idx) => (idx === i ? { ...p, [field]: val } : p));
    emitFromPairs();
  }
  function toggleMode() {
    mode = mode === 'structured' ? 'raw' : 'structured';
  }
</script>

<div class="formal-editor">
  <div class="formal-toolbar">
    <button type="button" class="mode-toggle" on:click={toggleMode}>
      {mode === 'structured' ? 'Edit raw JSON' : 'Edit as key/value'}
    </button>
    {#if !schema}
      <span class="schema-hint">Schema-less mode — arbitrary JSON object.</span>
    {/if}
  </div>

  {#if mode === 'structured'}
    <div class="pairs">
      {#each pairs as pair, i (i)}
        <div class="pair-row">
          <input
            class="pair-key"
            type="text"
            placeholder="key"
            value={pair.k}
            on:input={(e) => updatePair(i, 'k', e.currentTarget.value)}
          />
          <input
            class="pair-val"
            type="text"
            placeholder='value (string, number, true/false, null, or JSON)'
            value={pair.v}
            on:input={(e) => updatePair(i, 'v', e.currentTarget.value)}
          />
          <button type="button" class="pair-remove" on:click={() => removePair(i)} aria-label="Remove">×</button>
        </div>
      {/each}
      <button type="button" class="pair-add" on:click={addPair}>+ Add field</button>
      {#if pairs.length === 0}
        <p class="empty">No fields yet — click <em>Add field</em> or switch to raw JSON.</p>
      {/if}
    </div>
  {:else}
    <textarea
      {id}
      class="raw-input"
      bind:value={rawText}
      on:input={onRawInput}
      placeholder={'{\n  "type": "function",\n  "inputs": [...],\n  "output": "..."\n}'}
      rows="6"
    ></textarea>
    {#if rawError}
      <p class="raw-error">{rawError}</p>
    {/if}
  {/if}
</div>

<style>
  .formal-editor {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .formal-toolbar {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.75rem;
  }
  .mode-toggle {
    background: transparent;
    border: 1px solid hsl(var(--border));
    color: hsl(var(--foreground));
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.75rem;
  }
  .mode-toggle:hover { background: hsl(var(--muted)); }
  .schema-hint { color: hsl(var(--muted-foreground)); }
  .pairs {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }
  .pair-row {
    display: grid;
    grid-template-columns: minmax(120px, 1fr) 2fr auto;
    gap: 0.375rem;
    align-items: center;
  }
  .pair-key, .pair-val {
    padding: 0.375rem 0.5rem;
    border: 1px solid hsl(var(--border));
    background: hsl(var(--background));
    color: hsl(var(--foreground));
    border-radius: 4px;
    font-size: 0.875rem;
    font-family: ui-monospace, monospace;
  }
  .pair-key { font-weight: 500; }
  .pair-remove {
    background: transparent;
    border: 1px solid hsl(var(--border));
    color: hsl(var(--muted-foreground));
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 1rem;
    line-height: 1;
  }
  .pair-remove:hover {
    color: hsl(var(--destructive));
    border-color: hsl(var(--destructive));
  }
  .pair-add {
    align-self: flex-start;
    background: transparent;
    border: 1px dashed hsl(var(--border));
    color: hsl(var(--muted-foreground));
    padding: 0.375rem 0.75rem;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.75rem;
  }
  .pair-add:hover { color: hsl(var(--foreground)); border-color: hsl(var(--foreground)); }
  .empty {
    font-size: 0.75rem;
    color: hsl(var(--muted-foreground));
    margin: 0;
  }
  .raw-input {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid hsl(var(--border));
    background: hsl(var(--background));
    color: hsl(var(--foreground));
    border-radius: 4px;
    font-family: ui-monospace, monospace;
    font-size: 0.8125rem;
    min-height: 8rem;
  }
  .raw-error {
    color: hsl(var(--destructive));
    font-size: 0.75rem;
    margin: 0;
  }
</style>
