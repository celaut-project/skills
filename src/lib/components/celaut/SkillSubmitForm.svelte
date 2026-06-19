<script lang="ts">
  import { WalletButton, walletConnected } from 'wallet-svelte-component';
  import { web_explorer_uri_addr } from '$lib/common/store';
  import { skills } from '$lib/stores';
  import { toasts } from './toastStore';
  import SubmitFormEnhancements from './SubmitFormEnhancements.svelte';
  import { createSkill } from '$lib/data';
  import { demoMode } from '$lib/config';
  import { reputation_proof } from '$lib/common/store';
  import { getMainReputationBox } from '$lib/reputationContext';

  function currentMainBox() {
    return getMainReputationBox($reputation_proof);
  }

  // Submit form state
  let newSkillName = '';
  let newSkillProse = '';
  let newSkillFormal = '';
  let newSkillTags = '';
  let newSkillDomain = '';
  let relatedSkillBoxIds: string[] = [];
  let submitting = false;
  let submitTx: string | null = null;
  let submitError: string | null = null;
  let validationErrors: Record<string, string> = {};

  let enhancementsRef: SubmitFormEnhancements;

  async function handleSubmitSkill() {
    // Run validation from enhancements component
    if (enhancementsRef) {
      validationErrors = enhancementsRef.validate();
      if (Object.keys(validationErrors).length > 0) {
        toasts.error('Please fix the form errors before submitting.');
        return;
      }
    }

    if (!$walletConnected) {
      submitError = 'Connect your wallet first.';
      toasts.error('Connect your wallet first.');
      return;
    }
    if (!newSkillName.trim()) {
      submitError = 'Name is required.';
      validationErrors = { name: 'Skill name is required.' };
      return;
    }
    submitting = true;
    submitError = null;
    submitTx = null;
    try {
      // Routes to ergoProvider.createSkill in chain mode (mints a Skill Type
      // NFT via reputation-system's create_opinion against SKILL_TYPE_ID) or
      // to mockDb.createSkill in demo mode. Mirrors handleSubmitSkill in
      // App.svelte / handleCreateBenchmark / etc.
      const txId = await createSkill({
        name: newSkillName.trim(),
        prose: newSkillProse.trim(),
        formal: newSkillFormal.trim(),
        tags: newSkillTags.split(',').map((t) => t.trim()).filter(Boolean),
        domain: newSkillDomain.trim(),
        extendedSkillBoxIds: [...relatedSkillBoxIds],
        sourceHash: '',
        tokenAmount: 1,
        mainBox: currentMainBox()
      });
      submitTx = txId;
      toasts.success($demoMode ? 'Skill submitted successfully (demo mode).' : 'Skill published on-chain.');
      newSkillName = '';
      newSkillProse = '';
      newSkillFormal = '';
      newSkillDomain = '';
      newSkillTags = '';
      relatedSkillBoxIds = [];
    } catch (e: any) {
      submitError = e.message || 'Submission failed.';
      toasts.error(submitError || 'Submission failed.');
    } finally {
      submitting = false;
    }
  }

  // Clear validation errors when fields change
  $: if (newSkillName) { delete validationErrors['name']; validationErrors = validationErrors; }
  $: if (newSkillProse) { delete validationErrors['prose']; validationErrors = validationErrors; }
  $: if (newSkillDomain) { delete validationErrors['domain']; validationErrors = validationErrors; }
</script>

<div class="max-w-lg mx-auto">
  <h2 class="text-2xl font-bold mb-2">Submit a Skill</h2>
  <p class="text-muted-foreground mb-6 text-sm">
    Skills are published on-chain as Reputation Boxes. Connect your wallet to sign.
  </p>

  {#if !$walletConnected}
    <div class="card text-center py-8">
      <p class="text-muted-foreground mb-4">Connect your wallet to submit a skill.</p>
      <WalletButton explorerUrl={$web_explorer_uri_addr} />
    </div>
  {:else}
    <form on:submit|preventDefault={handleSubmitSkill} class="space-y-4">
      <div>
        <label class="label" for="skill-name">Name <span class="text-red-500">*</span></label>
        <input id="skill-name" class="input" class:input-error={validationErrors['name']} bind:value={newSkillName} placeholder="e.g. Optimal XAU/BTC Performance" required />
        {#if validationErrors['name']}
          <p class="field-error">{validationErrors['name']}</p>
        {/if}
      </div>
      <div>
        <label class="label" for="skill-prose">Description</label>
        <textarea id="skill-prose" class="input min-h-[100px] resize-y" class:input-error={validationErrors['prose']} bind:value={newSkillProse} placeholder="What problem does this skill solve?"></textarea>
        {#if validationErrors['prose']}
          <p class="field-error">{validationErrors['prose']}</p>
        {/if}
      </div>
      <div>
        <label class="label" for="skill-domain">Domain</label>
        <input id="skill-domain" class="input" class:input-error={validationErrors['domain']} bind:value={newSkillDomain} placeholder="e.g. finance, infrastructure, nlp" />
        {#if validationErrors['domain']}
          <p class="field-error">{validationErrors['domain']}</p>
        {/if}
      </div>
      <div>
        <label class="label" for="skill-tags">Tags <span class="text-muted-foreground font-normal">(comma-separated)</span></label>
        <input id="skill-tags" class="input" bind:value={newSkillTags} placeholder="trading, gold, bitcoin" />
      </div>

      <!-- Enhanced form sections -->
      <SubmitFormEnhancements
        bind:this={enhancementsRef}
        skills={$skills}
        name={newSkillName}
        prose={newSkillProse}
        domain={newSkillDomain}
        tags={newSkillTags}
        errors={validationErrors}
        on:relatedChange={(event) => (relatedSkillBoxIds = event.detail)}
      />

      <button type="submit" class="btn-primary w-full" disabled={submitting}>
        {submitting ? 'Publishing…' : 'Publish Skill On-Chain'}
      </button>
    </form>

    {#if submitTx}
      <div class="mt-4 p-4 rounded-md bg-green-100 dark:bg-green-900 border border-green-400 text-sm">
        <p class="font-semibold text-green-800 dark:text-green-200">Skill submitted!</p>
        <a href={`https://explorer.ergoplatform.com/en/transactions/${submitTx}`} target="_blank" rel="noopener noreferrer" class="text-blue-600 dark:text-blue-400 break-all">{submitTx}</a>
      </div>
    {/if}
    {#if submitError}
      <div class="mt-4 p-4 rounded-md bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-300 text-sm text-yellow-800 dark:text-yellow-200">
        {submitError}
      </div>
    {/if}
  {/if}
</div>

<style lang="postcss">
  .card {
    @apply p-4 rounded-lg border border-border bg-card;
  }

  .label {
    @apply block text-sm font-medium mb-1 text-foreground;
  }

  .input {
    @apply w-full px-3 py-2 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring;
  }

  .input-error {
    border-color: hsl(var(--destructive));
  }
  .input-error:focus {
    box-shadow: 0 0 0 2px hsl(var(--destructive) / 0.3);
  }

  .field-error {
    margin-top: 0.25rem;
    font-size: 0.75rem;
    color: hsl(var(--destructive));
  }

  .btn-primary {
    @apply px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium transition-colors;
  }
  .btn-primary:hover:not(:disabled) {
    @apply opacity-90;
  }
  .btn-primary:disabled {
    @apply opacity-50 cursor-not-allowed;
  }
</style>
