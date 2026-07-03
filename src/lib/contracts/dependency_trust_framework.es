/**
* ===================================================================================
* Contract for a "Dependency and Trust Framework" instance (Type NFT)
* ===================================================================================
*
* PURPOSE:
* A Dependency-and-Trust-Framework box attaches an objective, brand-free risk
* assessment to a Strict Definition (a Tag-Prose-Formal definition of a network
* / capability). It follows the Sigmaverse Quality Standard's Action-Centric
* Analysis: every fundamental action of the system is scored on two axes —
*
*   Trust Category  (how the action's validity is secured):
*     1 = trust-minimized (validity is exclusively the smart-contract script)
*     2 = crypto-economic (external incentive-secured actors)
*     3 = fiduciary       (permissioned devs / governance)
*
*   Access Category (user sovereignty over execution):
*     1 = Verifiable Artifact          (user runs it in their own environment)
*     2 = Centralized Service Dependency (relies on a third-party host)
*
* The box stores the raw per-action structure in R9 and the two summary scores
* in R6/R7. The two summary scores are NOT trusted as-declared: the guarding
* script recomputes them from R9 on-chain and refuses to let the box live in an
* inconsistent state. A box whose declared scores disagree with its structure is
* unspendable (can never be recreated / topped-up) and is trivially rejected by
* any indexer that recomputes. Any *live* framework box is therefore correct.
*
* SPENDING RULES:
* 1. Anyone can spend this box (no signature required) — it is a public good.
* 2. Spending is only valid if a single output box is created that is an exact
*    replica of the input (same NFT, script, and registers R4-R9), except its
*    ERG value which must be >= the input's (allows storage-rent top-ups).
* 3. The declared scores in R6/R7 MUST equal the on-chain recomputation from R9.
*
* -----------------------------------------------------------------------------------
* R4: Coll[Byte]        -> typeNftId       (Dependency-and-Trust-Framework Type NFT id; for indexing)
* R5: Coll[Byte]        -> strictDefBoxId  (box id of the Strict Definition being assessed)
* R6: Int               -> weakestLinkScore (computed: max level across every category)
* R7: Int               -> averageRiskScore (computed: mean level * 100, integer-scaled)
* R8: Coll[Byte]        -> reserved / off-chain content pointer (e.g. KyA report hash)
* R9: Coll[(Int, Int)]  -> actions: per fundamental action, (trustLevel, accessLevel)
* -----------------------------------------------------------------------------------
*/
{
  // ── On-chain score calculation (Sigmaverse Quality Standard) ──────────────
  // R9 is the authoritative structure: one (trustLevel, accessLevel) pair per
  // fundamental action of the assessed system.
  val actions = SELF.R9[Coll[(Int, Int)]].get
  val n = actions.size

  // A framework with no actions is meaningless — reject it outright.
  val hasActions = n > 0

  val trust  = actions.map { (a: (Int, Int)) => a._1 }
  val access = actions.map { (a: (Int, Int)) => a._2 }

  // Weakest Link Score = the single highest (worst) level across ALL categories.
  val maxOf = { (xs: Coll[Int]) =>
    xs.fold(0, { (m: Int, x: Int) => if (x > m) x else m })
  }
  val computedWeakest = {
    val mt = maxOf(trust)
    val ma = maxOf(access)
    if (mt > ma) mt else ma
  }

  // Average Risk Score = mean of every assigned level, scaled x100 so the
  // integer-only VM keeps two decimals of precision. Denominator is the total
  // number of assigned levels (two per action: one trust, one access).
  val sumOf = { (xs: Coll[Int]) => xs.fold(0, { (s: Int, x: Int) => s + x }) }
  val totalLevels = sumOf(trust) + sumOf(access)
  val levelCount  = n * 2
  val computedAverage = (totalLevels * 100) / levelCount

  val scoresAreCorrect =
    SELF.R6[Int].get == computedWeakest &&
    SELF.R7[Int].get == computedAverage

  // ── Immutable public-good preservation (mirrors digital_public_good.es) ────
  val successorOutputs = OUTPUTS.filter { (box: Box) =>
    box.tokens.size > 0 && box.tokens(0)._1 == SELF.tokens(0)._1
  }

  if (hasActions && scoresAreCorrect && successorOutputs.size == 1) {
    val successor = successorOutputs(0)

    val registersAreImmutable = (
      successor.R4[Coll[Byte]] == SELF.R4[Coll[Byte]] &&
      successor.R5[Coll[Byte]] == SELF.R5[Coll[Byte]] &&
      successor.R6[Int]        == SELF.R6[Int] &&
      successor.R7[Int]        == SELF.R7[Int] &&
      successor.R8[Coll[Byte]] == SELF.R8[Coll[Byte]] &&
      successor.R9[Coll[(Int, Int)]] == SELF.R9[Coll[(Int, Int)]]
    )

    val dataIsImmutable = (
      successor.propositionBytes == SELF.propositionBytes &&
      successor.tokens(0) == SELF.tokens(0) &&
      registersAreImmutable
    )

    val canOnlyAddErgs = successor.value >= SELF.value

    sigmaProp(dataIsImmutable && canOnlyAddErgs)
  } else {
    // No valid successor, empty structure, or inconsistent scores → frozen.
    sigmaProp(false)
  }
}
