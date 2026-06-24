# Technical Specification: Multi-Criteria Global Scoring System

This document defines the mathematical architecture for calculating the global score of **Services** within the platform. The system assumes that all entities possess a pre-calculated external reputation, represented by an integer, and uses this value to weight confidence and empirical performance.

## 1. Domain Model and Entities

The system evaluates performance through the following entities, each with a **Raw Reputation ($R_{raw}$)** value assimilated as an integer in the range $\{-N_{max}, \dots, 0, \dots, N_{max}\}$:

* **Skill:** The global category within this formula.
* **User:** The actor who executes or uploads a result.
* **Service:** The software/algorithm being evaluated.
* **Benchmark:** Test suite featuring *Case Descriptors* and *Performance Metrics*.
* **Result:** The empirical data from a specific execution.

---

## 2. Confidence Normalization ($W_e$)

Since raw reputation ($R_{raw}$) can take extreme values (positive or negative), it cannot be used directly as a metric multiplier. We need to map it to a **Confidence Weight ($W_e$)** within the interval $[0, 1]$.

To prevent an entity with a massive reputation (a "whale") from driving everyone else's weight down to zero, we apply a **signed logarithmic scale**.

For any entity $e$, its confidence weight $W_e$ is calculated as follows:

* **If the reputation is positive or zero ($R_{raw} \ge 0$):**

$$W_e = 0.5 + 0.5 \cdot \frac{\log(1 + R_{raw}(e))}{\log(1 + N_{max})}$$

* **If the reputation is negative ($R_{raw} < 0$):**

$$W_e = 0.5 - 0.5 \cdot \frac{\log(1 + |R_{raw}(e)|)}{\log(1 + N_{max})}$$

**Behavior of this formula:**

* Strongly negative reputation $\rightarrow$ $W_e$ approaches $0$ (its impact is nullified).
* Reputation of $0$ (new/neutral entity) $\rightarrow$ $W_e = 0.5$ (medium impact).
* Strongly positive reputation $\rightarrow$ $W_e$ approaches $1$ (maximum confidence).

*(Note: $N_{max}$ is the maximum absolute reputation value observed solely within that Skill to keep the scale calibrated).*

---

## 3. Performance Metric Normalization ($N(x)$)

Raw benchmark results (e.g., milliseconds vs. success rate) must be brought into a common $[0, 1]$ scale. For each dimension of the problem $d$, historical minimums ($min_d$) and maximums ($max_d$) are used:

* **"Lower is better" metrics** (e.g., time, memory):

$$N(x) = \frac{max_d - x}{max_d - min_d}$$

* **"Higher is better" metrics** (e.g., success ratio):

$$N(x) = \frac{x - min_d}{max_d - min_d}$$

---

## 4. Confidence and Quality of a Result

When a user uploads a `Result` ($r$) for a service evaluated in a benchmark, we calculate two factors: **how real it is** and **how good it is**.

### A. Result Confidence Weight ($C_r$)

This combines the confidence weight of the user who uploaded the data ($W_u$) and the confidence weight of the result itself ($W_r$, derived from its own external reputation via votes received).

$$C_r = \alpha \cdot W_u + (1 - \alpha) \cdot W_r$$

*(Where $\alpha \in [0, 1]$, e.g., **0.4**, allows us to balance whether we trust the original creator more or the reputation that the result itself has garnered).*

### B. Performance Quality ($P_r$)

This is the weighted sum of its normalized metrics:

$$P_r = \sum_{m} (w_m \cdot N(x_m))$$

*(Where $w_m$ is the weight assigned to that specific metric by the benchmark creator, summing to $\sum w_m = 1$).*

---

## 5. The Global Score Formula ($Score_{Global}$)

The final score of the service is built from the bottom up.

### Step 1: Performance within a Specific Benchmark

All results ($r$) of the Service ($S$) in the Benchmark ($B$) are averaged, weighted by the confidence of each result ($C_r$):

$$P(S, B) = \frac{\sum (C_r \cdot P_r)}{\sum C_r}$$

*If a result has a poor reputation (fake/incorrect), its $C_r$ will be close to 0 and will not impact the service's score.*

### Step 2: Total Technical Performance ($Score_{Perf}$)

The service's performance across all benchmarks is consolidated, weighted by the confidence/reputation of each Benchmark ($W_B$):

$$Score_{Perf}(S) = \frac{\sum (W_B \cdot P(S, B))}{\sum W_B}$$

*Benchmarks with a poor reputation (badly designed or malicious) will barely impact the final score.*

### Step 3: Definitive Global Score

The final ranking of the Service is obtained by combining its verified empirical results ($Score_{Perf}$) with the direct reputation weight of the Service entity ($W_S$):

$$Score_{Global}(S) = \beta \cdot Score_{Perf}(S) + (1 - \beta) \cdot W_S$$

*(A value of $\beta = 0.7$ is recommended to give **70%** importance to verified technical performance and **30%** to the external reputation of the brand/service).*