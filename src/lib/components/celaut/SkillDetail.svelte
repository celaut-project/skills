<script lang="ts">
  import type { Skill, Coverage } from '$lib/types';
  import { skills, selectedSkill } from '$lib/stores';
  import SkillMetadata from './SkillMetadata.svelte';
  import SkillLeaderboard from './SkillLeaderboard.svelte';
  import ClaimCoverageButton from './ClaimCoverageButton.svelte';
  import ProfileAvatar from './ProfileAvatar.svelte';
  import InfoTip from './InfoTip.svelte';
  import RunServiceButton from './RunServiceButton.svelte';
  import BackButton from './BackButton.svelte';
  import { openForum } from './forumSidebar';
  import { categoryIcon } from '$lib/categoryIcons';
  import { formatServiceId } from '$lib/api';
  import { explorer_uri } from '$lib/common/store';
  import { fetchFileSourcesByHash } from 'source-application';

  export let skill: Skill;

  function goBack() {
    $selectedSkill = null;
  }

  function selectRelated(related: Skill) {
    $selectedSkill = related;
  }

  // Category icon replaces the old profile/generic icon in the title.
  $: CategoryIcon = categoryIcon(skill.domain);

  function shortId(id: string | undefined | null): string {
    if (!id) return '—';
    if (id.length <= 14) return id;
    return `${id.slice(0, 6)}…${id.slice(-4)}`;
  }

  // ── Source availability ──────────────────────────────────────────────────
  // A service's source count is needed for the recommended-service rule below.
  // Only hash-like ids can be resolved on-chain; everything else counts as 0.
  let sourceCounts: Record<string, number> = {};

  function looksLikeFileHash(value: string | undefined | null): boolean {
    return !!value && /^[0-9a-f]{64}$/i.test(value);
  }

  async function loadSourceCount(serviceId: string) {
    if (!looksLikeFileHash(serviceId) || serviceId in sourceCounts) return;
    try {
      const fetched = await fetchFileSourcesByHash($explorer_uri, serviceId);
      sourceCounts = { ...sourceCounts, [serviceId]: fetched?.length ?? 0 };
    } catch {
      sourceCounts = { ...sourceCounts, [serviceId]: 0 };
    }
  }

  // Load source counts for every coverage so the recommendation can require
  // "at least one source available".
  $: skill.coverages.forEach((c) => {
    if (c.serviceId) loadSourceCount(c.serviceId);
  });

  function sourceCountFor(cov: Coverage): number {
    return cov.serviceId ? (sourceCounts[cov.serviceId] ?? 0) : 0;
  }

  /**
   * Pick the skill's recommended service.
   *
   * Fixes two issues with a reputation-only rule:
   *  (a) A service that originates from a search result (not a coverage box)
   *      has reputation 0 and was never recommended — even when it was the
   *      ONLY service available. A sole available service is now always
   *      recommended.
   *  (b) Beyond reputation, a service must have at least one source available
   *      (>= 1) to be preferred. Source availability is the primary key;
   *      reputation breaks ties.
   */
  function pickRecommended(
    coverages: Coverage[],
    counts: Record<string, number>
  ): { coverage: Coverage; reason: string } | null {
    const candidates = coverages.filter((c) => c.serviceId);
    if (candidates.length === 0) return null;

    const sources = (c: Coverage) => (c.serviceId ? counts[c.serviceId] ?? 0 : 0);
    const rep = (c: Coverage) => c.reputation ?? 0;

    // Sole available service → always recommended (fix a).
    if (candidates.length === 1) {
      const only = candidates[0];
      const hasSrc = sources(only) >= 1;
      return {
        coverage: only,
        reason: hasSrc
          ? 'Only service available for this skill, and it has at least one published source.'
          : 'Only service available for this skill, so it is recommended by default — no published source resolved yet.'
      };
    }

    // Prefer services with >= 1 source (fix b); reputation breaks ties.
    const sorted = [...candidates].sort((a, b) => {
      const sa = sources(a) >= 1 ? 1 : 0;
      const sb = sources(b) >= 1 ? 1 : 0;
      if (sa !== sb) return sb - sa;
      return rep(b) - rep(a);
    });

    const best = sorted[0];
    const hasSrc = sources(best) >= 1;
    const reasonParts: string[] = [];
    if (hasSrc) reasonParts.push(`${sources(best)} source${sources(best) !== 1 ? 's' : ''} available`);
    reasonParts.push(`reputation ${rep(best)}`);
    return {
      coverage: best,
      reason: `Highest-ranked of ${candidates.length} services — ${reasonParts.join(', ')}. Source availability is weighed first, then reputation.`
    };
  }

  $: recommended = pickRecommended(skill.coverages, sourceCounts);
</script>

<div class="w-full">
  <BackButton label="Back to gallery" on:click={goBack} />

  <div class="card detail-head">
    <div class="title-row">
      <span class="category-icon" aria-hidden="true">
        <svelte:component this={CategoryIcon} size={26} strokeWidth={1.8} />
      </span>
      <h1 class="skill-title">{skill.name}</h1>
      {#if skill.domain}
        <span class="badge badge-domain">{skill.domain}</span>
      {/if}
    </div>

    <p class="skill-prose">{skill.prose || 'No description.'}</p>

    {#if skill.tags.length > 0}
      <div class="tag-row">
        {#each skill.tags as tag}
          <span class="badge">{tag}</span>
        {/each}
      </div>
    {/if}

    <!-- ID / Source Hash -->
    <SkillMetadata boxId={skill.boxId} sourceHash={skill.sourceHash || ''} />

    <!-- Skill creator (profile_id + icon), directly below ID/Source Hash. -->
    <div class="creator-block">
      <span class="creator-label">Creator</span>
      <ProfileAvatar profileId={skill.profileId} size={22} title={`Skill creator ${skill.profileId}`} />
      <code class="creator-id">{shortId(skill.profileId)}</code>
    </div>

    <!-- Current submissions — always rendered, even when empty. -->
    <div class="submissions-block">
      <div class="submissions-head">
        <span class="submissions-label">Current submissions for this skill</span>
        <InfoTip title="Current submissions">
          <p>Each <strong>submission</strong> is a service that implements (solves) this skill — a candidate solution proposed on-chain or surfaced from a service search.</p>
          <p>The highest-ranked one is highlighted as the <strong>recommended</strong> service above the list.</p>
        </InfoTip>
      </div>

      {#if skill.coverages.length === 0}
        <p class="submissions-empty">No services have been submitted for this skill yet.</p>
      {:else}
        {#if recommended}
          <div class="recommended-card">
            <div class="recommended-head">
              <span class="recommended-tag">Recommended</span>
              <code class="service-id">{formatServiceId(recommended.coverage.serviceId)}</code>
              <!-- Low-attention reason: a discreet info icon, not a prominent dialog. -->
              <InfoTip title="Why this is recommended">
                <p>{recommended.reason}</p>
              </InfoTip>
            </div>
            {#if recommended.coverage.serviceId}
              <RunServiceButton serviceId={recommended.coverage.serviceId} label="Run" />
            {/if}
          </div>
        {/if}

        <ul class="submissions-list">
          {#each skill.coverages as cov}
            <li class="submission-row">
              <ProfileAvatar profileId={cov.profileId} size={18} title={`Submitted by ${cov.profileId}`} />
              <code class="service-id">{cov.serviceId ? formatServiceId(cov.serviceId) : 'Unnamed service'}</code>
              {#if sourceCountFor(cov) > 0}
                <span class="submission-sources" title="Sources available on-chain">
                  {sourceCountFor(cov)} source{sourceCountFor(cov) !== 1 ? 's' : ''}
                </span>
              {/if}
              {#if cov.serviceId}
                <span class="submission-run">
                  <RunServiceButton serviceId={cov.serviceId} label="Run" />
                </span>
              {/if}
            </li>
          {/each}
        </ul>
      {/if}
    </div>
  </div>

  <!-- Benchmarks / leaderboard (its own tab-equivalent context, no title here) -->
  <SkillLeaderboard benchmarks={skill.benchmarks} skillName={skill.name} />

  <!-- Action: add a service solution -->
  <div class="action-row">
    <ClaimCoverageButton skillBoxId={skill.boxId} />
  </div>

  <!-- Related skills -->
  {#if skill.extendedSkillBoxIds.length > 0}
    <section class="related-section">
      <h2 class="related-title">Related skills</h2>
      {#each skill.extendedSkillBoxIds as refId}
        {@const related = $skills.find((s) => s.boxId === refId)}
        {#if related}
          <button class="card related-card" on:click={() => selectRelated(related)}>
            <span class="font-medium">{related.name}</span>
          </button>
        {:else}
          <div class="card related-card-static">
            <span class="text-xs text-muted-foreground font-mono">{refId}</span>
          </div>
        {/if}
      {/each}
    </section>
  {/if}

  <!-- Secondary: open discussion (text-link / ghost, must not compete with CTAs) -->
  <section class="discussion-section">
    <button
      class="discussion-link"
      type="button"
      on:click={() => openForum(skill.boxId, `Skill: ${skill.name}`)}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
      </svg>
      Open discussion
    </button>
  </section>
</div>

<style lang="postcss">
  .card {
    padding: 1.25rem;
    border-radius: 0.75rem;
    border: 1px solid hsl(var(--border));
    background: hsl(var(--card));
  }

  .detail-head {
    margin-bottom: 1.5rem;
  }

  /* ── Title ──────────────────────────────────────────────────────────── */
  .title-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.625rem;
    margin-bottom: 0.875rem;
  }

  .category-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 0.625rem;
    color: hsl(var(--primary));
    background: hsl(var(--primary) / 0.1);
    flex-shrink: 0;
  }

  .skill-title {
    font-size: 1.5rem;
    font-weight: 700;
    line-height: 1.2;
    margin: 0;
  }

  /* ── Description: roomier line-height + stronger contrast ───────────── */
  .skill-prose {
    font-size: 0.95rem;
    line-height: 1.7;
    color: hsl(var(--foreground) / 0.82);
    margin: 0 0 1rem;
    max-width: 62ch;
  }

  .tag-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    padding: 0.125rem 0.5rem;
    border-radius: 0.375rem;
    font-size: 0.75rem;
    font-weight: 500;
    background: hsl(var(--muted));
    color: hsl(var(--muted-foreground));
  }
  .badge-domain {
    background: hsl(var(--primary) / 0.1);
    color: hsl(var(--primary));
  }

  /* ── Creator ────────────────────────────────────────────────────────── */
  .creator-block {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-top: 0.875rem;
    padding-top: 0.875rem;
    border-top: 1px solid hsl(var(--border) / 0.5);
  }
  .creator-label {
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: hsl(var(--muted-foreground));
    margin-right: 0.25rem;
  }
  .creator-id {
    font-size: 0.75rem;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    color: hsl(var(--foreground));
  }

  /* ── Current submissions ────────────────────────────────────────────── */
  .submissions-block {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid hsl(var(--border) / 0.5);
  }

  .submissions-head {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.625rem;
  }
  .submissions-label {
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: hsl(var(--muted-foreground));
  }

  .submissions-empty {
    font-size: 0.8125rem;
    color: hsl(var(--muted-foreground));
    padding: 0.875rem 1rem;
    border: 1px dashed hsl(var(--border));
    border-radius: 0.5rem;
    margin: 0;
  }

  .recommended-card {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 0.75rem;
    padding: 0.75rem 0.875rem;
    border-radius: 0.625rem;
    border: 1px solid hsl(var(--primary) / 0.35);
    background: hsl(var(--primary) / 0.06);
    margin-bottom: 0.625rem;
  }
  .recommended-head {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1;
    min-width: 0;
  }
  .recommended-tag {
    display: inline-flex;
    align-items: center;
    padding: 0.125rem 0.5rem;
    border-radius: 9999px;
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    background: hsl(var(--primary) / 0.15);
    color: hsl(var(--primary));
    white-space: nowrap;
  }

  .submissions-list {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }
  .submission-row {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.625rem;
    border: 1px solid hsl(var(--border) / 0.6);
    border-radius: 0.5rem;
    background: hsl(var(--background));
  }
  .submission-sources {
    font-size: 0.6875rem;
    color: hsl(var(--muted-foreground));
  }
  .submission-run {
    margin-left: auto;
  }

  .service-id {
    font-size: 0.75rem;
    padding: 0.125rem 0.375rem;
    border-radius: 0.25rem;
    background: hsl(var(--muted) / 0.5);
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ── Actions ────────────────────────────────────────────────────────── */
  .action-row {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }

  /* ── Related skills ─────────────────────────────────────────────────── */
  .related-section {
    margin-bottom: 1.5rem;
  }
  .related-title {
    font-size: 1.125rem;
    font-weight: 600;
    margin-bottom: 0.75rem;
  }
  .related-card,
  .related-card-static {
    display: block;
    width: 100%;
    text-align: left;
    margin-bottom: 0.5rem;
    transition: background 0.15s ease;
  }
  .related-card:hover {
    background: hsl(var(--muted) / 0.5);
  }

  /* ── Discussion (secondary, text-link / ghost) ──────────────────────── */
  .discussion-section {
    margin-bottom: 1rem;
  }
  .discussion-link {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0;
    background: none;
    border: none;
    font-size: 0.8125rem;
    font-weight: 500;
    color: hsl(var(--muted-foreground));
    cursor: pointer;
    transition: color 0.15s ease;
  }
  .discussion-link:hover {
    color: hsl(var(--foreground));
    text-decoration: underline;
    text-underline-offset: 3px;
  }
</style>
