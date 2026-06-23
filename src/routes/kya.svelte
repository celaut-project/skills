<script lang="ts">
  import { browser } from "$app/environment";
  import * as Dialog from "$lib/components/ui/dialog";
  import { Button } from "$lib/components/ui/button";

  export let title: string = "Know Your Assumptions — Celaut Skills";
  export let closeBtnText: string = "I understand and I agree";
  export let autoOpen = false;

  let showModal = false;
  let isButtonEnabled = false;
  let contentDiv: HTMLDivElement;
  const KYA_ACCEPTED_KEY = "acceptedSkillsKYA";

  function hasAcceptedKya() {
    if (!browser) return false;
    return localStorage.getItem(KYA_ACCEPTED_KEY) === "true";
  }

  // Enable the agree button immediately if the content fits without scrolling,
  // otherwise it unlocks once the user has scrolled to the bottom (checkScroll).
  function refreshButtonState() {
    setTimeout(() => {
      if (contentDiv && contentDiv.scrollHeight <= contentDiv.clientHeight) {
        isButtonEnabled = true;
      }
    }, 0);
  }

  function checkScroll(e: Event) {
    const element = e.target as HTMLDivElement;
    if (Math.abs(element.scrollHeight - element.clientHeight - element.scrollTop) < 5) {
      isButtonEnabled = true;
    }
  }

  function openModal() {
    showModal = true;
    isButtonEnabled = false;
    refreshButtonState();
  }

  function handleCloseModal() {
    showModal = false;
    if (browser) {
      localStorage.setItem(KYA_ACCEPTED_KEY, "true");
    }
  }

  // Auto-open once when the wallet connects, unless already accepted.
  $: if (browser && autoOpen && !showModal && !hasAcceptedKya()) {
    openModal();
  }
</script>

<span
  class="text-muted-foreground cursor-pointer hover:underline"
  on:click={openModal}
  on:keydown={(e) => e.key === "Enter" && openModal()}
  role="button"
  tabindex="0"
>
  KYA
</span>

<Dialog.Root bind:open={showModal} preventScroll>
  <Dialog.Content class="w-[700px] max-w-[85vw] sm:max-w-[70vw]">
    <Dialog.Header>
      <Dialog.Title>{title}</Dialog.Title>
    </Dialog.Header>

    <div
      bind:this={contentDiv}
      on:scroll={checkScroll}
      class="max-h-[50vh] overflow-y-auto pr-4 text-sm"
    >
      <p class="mb-3">
        This document describes the key assumptions underlying the design, implementation, and
        operation of the Celaut Skills registry. Skills are AI-agent capabilities published
        on-chain as Reputation Boxes on the Ergo blockchain, and their reputation is the total ERG
        irreversibly burned (sacrificed) against a profile. Please read before connecting your
        wallet and interacting with the registry.
      </p>

      <h3 class="font-bold text-md mt-4 mb-2">Fundamental Assumptions</h3>
      <ul class="list-disc ml-6 space-y-2">
        <li>
          <strong>On-chain, permissionless registry:</strong> Skills are registered as Reputation
          Boxes on the Ergo blockchain. Publishing is open and permissionless — there is no central
          authority that reviews, curates, approves, or removes skills. Anyone can publish anything.
        </li>
        <li>
          <strong>Reputation = burned ERG (Proof of Sacrifice):</strong> A profile's reputation is
          the cumulative ERG <em>irreversibly burned</em> against its reputation proof. The model
          assumes economic sacrifice is a useful, sybil-resistant signal of seriousness — it is a
          <strong>signal, not a guarantee</strong> of correctness, safety, or quality.
        </li>
        <li>
          <strong>Reputation does not endorse a skill:</strong> A high score reflects ERG sacrificed
          and accumulated opinions, not an audit. A skill may be inaccurate, incomplete, malicious,
          or non-functional regardless of how much reputation it carries.
        </li>
        <li>
          <strong>Author-supplied, unverified content:</strong> Skill names, prose, formal
          definitions, tags, coverages, benchmarks, and relationships are provided by their authors
          and are not independently verified by this platform.
        </li>
        <li>
          <strong>Data sourced from public explorers/nodes:</strong> Skill listings and reputation
          are reconstructed from public Ergo explorer and node APIs. Availability, completeness, and
          timeliness depend on those third-party services and on chain state.
        </li>
        <li>
          <strong>Self-custody:</strong> You connect a self-custodial wallet (e.g. Nautilus). This
          platform never holds your keys or funds; every state-changing action is a transaction you
          sign and broadcast yourself.
        </li>
      </ul>

      <h3 class="font-bold text-md mt-4 mb-2">Assumptions to Validate and Potential Risks</h3>
      <ul class="list-disc ml-6 space-y-2">
        <li>Whether burned-ERG reputation remains a meaningful, hard-to-game signal as the registry grows.</li>
        <li>The accuracy and freshness of explorer/node data used to render skills and scores.</li>
        <li>The real safety of executing or relying on any third-party skill or linked service.</li>
        <li>The resilience of the reputation and relationship model against spam, sybil, and gaming attempts.</li>
        <li>The security of the underlying smart contracts and of the wallet integration.</li>
      </ul>

      <p class="font-bold mt-4">By connecting your wallet and using Celaut Skills, you acknowledge and agree that:</p>
      <ul class="list-disc ml-6 space-y-2">
        <li>You use the platform at your own risk.</li>
        <li>
          The platform is provided "as is," without warranties of any kind, express or implied,
          including, but not limited to, merchantability, fitness for a particular purpose, and
          non-infringement.
        </li>
        <li>
          <strong>Burning or sacrificing ERG to build reputation is irreversible</strong> — sacrificed
          ERG cannot be recovered, and reputation confers no refund, yield, or financial return.
        </li>
        <li>All blockchain interactions are irreversible; transactions cannot be undone once confirmed.</li>
        <li>You are solely responsible for the security of your keys, wallet, and any digital assets.</li>
        <li>
          Skills are published by third parties and are not verified by this platform; you are
          responsible for evaluating any skill before using, executing, or depending on it.
        </li>
        <li>There is no guarantee against errors, bugs, or the loss of data or digital assets.</li>
        <li>Reputation scores are informational only and are not financial, professional, or safety advice.</li>
      </ul>

      <p class="italic mt-6">
        Do you understand and agree to these assumptions and the associated risks of using the
        Celaut Skills registry?
      </p>
    </div>

    <Dialog.Footer class="mt-4">
      <Button on:click={handleCloseModal} disabled={!isButtonEnabled} class="w-full sm:w-auto">
        {closeBtnText}
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>
